'use strict';

var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var AapResourceConnector = require('../clients/AapResourceConnector.cjs.js');
var config = require('./config.cjs.js');

class AapResourceEntityProvider {
  env;
  baseUrl;
  authorization;
  owner;
  system;
  logger;
  scheduleFn;
  connection;
  static fromConfig(deps, options) {
    const { config: config$1, logger } = deps;
    const providerConfigs = config.readAapApiEntityConfigs(config$1);
    return providerConfigs.map((providerConfig) => {
      let taskRunner;
      if ("scheduler" in options && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if ("schedule" in options) {
        taskRunner = options.schedule;
      } else {
        throw new errors.InputError(
          `No schedule provided via config for AapResourceEntityProvider:${providerConfig.id}.`
        );
      }
      return new AapResourceEntityProvider(providerConfig, logger, taskRunner);
    });
  }
  constructor(config, logger, taskRunner) {
    this.env = config.id;
    this.baseUrl = config.baseUrl;
    this.authorization = config.authorization;
    this.owner = config.owner;
    this.system = config.system ?? "";
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
  }
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:run`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          try {
            await this.run();
          } catch (error) {
            if (errors.isError(error)) {
              this.logger.error(
                `Error while syncing resources from AAP ${this.baseUrl}`,
                {
                  // Default Error properties:
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                  // Additional status code if available:
                  status: error.response?.status
                }
              );
            }
          }
        }
      });
    };
  }
  getProviderName() {
    return `AapResourceEntityProvider:${this.env}`;
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  async run() {
    if (!this.connection) {
      throw new errors.NotFoundError("Not initialized");
    }
    this.logger.info(`Discovering ResourceEntities from AAP ${this.baseUrl}`);
    const entities = [];
    const templatesData = await Promise.allSettled([
      AapResourceConnector.listJobTemplates(this.baseUrl, this.authorization),
      AapResourceConnector.listWorkflowJobTemplates(this.baseUrl, this.authorization)
    ]);
    const templates = [];
    templatesData.forEach((results) => {
      if (results.status === "fulfilled") {
        templates.push(...results.value);
      } else if (results.status === "rejected") {
        const error = results.reason || {};
        this.logger.error("Failed to fetch AAP job templates", {
          // Default Error properties:
          name: error.name,
          message: error.message,
          stack: error.stack,
          // Additional status code if available:
          status: error.response?.status
        });
      }
    });
    for (const template of templates) {
      const resourceEntity = this.buildApiEntityFromJobTemplate(template);
      entities.push(resourceEntity);
      this.logger.debug(`Discovered ResourceEntity "${template.name}"`);
    }
    this.logger.info(`Applying the mutation with ${entities.length} entities`);
    await this.connection.applyMutation({
      type: "full",
      entities: entities.map((entity) => ({
        entity,
        locationKey: this.getProviderName()
      }))
    });
  }
  buildApiEntityFromJobTemplate(template) {
    const templateDetailsUrl = `${this.baseUrl}/#/templates/${template.type}/${template.id}/details`;
    const jobTemplateTransformedName = `${template.name.replace(/ /g, "_")}-${template.summary_fields?.organization?.name || template.id}-${this.env}`;
    return {
      kind: "Resource",
      apiVersion: "backstage.io/v1alpha1",
      metadata: {
        annotations: {
          [catalogModel.ANNOTATION_LOCATION]: this.getProviderName(),
          [catalogModel.ANNOTATION_ORIGIN_LOCATION]: this.getProviderName()
        },
        name: `${jobTemplateTransformedName}`,
        title: `${template.name}`,
        description: `${template.description}`,
        links: [
          {
            url: `${this.baseUrl}`,
            title: "AAP Dashboard"
          },
          {
            url: `${templateDetailsUrl}`,
            title: "Template Details"
          }
        ]
      },
      spec: {
        type: `${template.type}`,
        owner: `${this.owner}`,
        ...this.system && { system: `${this.system}` }
      }
    };
  }
}

exports.AapResourceEntityProvider = AapResourceEntityProvider;
//# sourceMappingURL=AapResourceEntityProvider.cjs.js.map
