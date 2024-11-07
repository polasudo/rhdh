'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0$1 = require('@backstage/catalog-model');
var require$$1 = require('@backstage/errors');

var index_cjs = {};

var AapResourceConnector_cjs = {};

async function listJobTemplates(baseUrl, access_token) {
  const res = await fetch(`${baseUrl}/api/v2/job_templates`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: access_token
    },
    method: "GET"
  });
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  const data = await res.json();
  return data.results;
}
async function listWorkflowJobTemplates(baseUrl, access_token) {
  const res = await fetch(`${baseUrl}/api/v2/workflow_job_templates`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: access_token
    },
    method: "GET"
  });
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  const data = await res.json();
  return data.results;
}

AapResourceConnector_cjs.listJobTemplates = listJobTemplates;
AapResourceConnector_cjs.listWorkflowJobTemplates = listWorkflowJobTemplates;

var module_cjs = {};

var AapResourceEntityProvider_cjs = {};

var config_cjs = {};

var backendPluginApi$1 = require$$0;

function readAapApiEntityConfigs(config) {
  const providerConfigs = config.getOptionalConfig("catalog.providers.aap");
  if (!providerConfigs) {
    return [];
  }
  return providerConfigs.keys().map((id) => readAapApiEntityConfig(id, providerConfigs.getConfig(id)));
}
function readAapApiEntityConfig(id, config) {
  const baseUrl = config.getString("baseUrl");
  const authorization = config.getString("authorization");
  const system = config.getOptionalString("system");
  const owner = config.getOptionalString("owner") ?? "unknown";
  const schedule = config.has("schedule") ? backendPluginApi$1.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    baseUrl,
    authorization,
    system,
    owner,
    schedule
  };
}

config_cjs.readAapApiEntityConfigs = readAapApiEntityConfigs;

var catalogModel = require$$0$1;
var errors = require$$1;
var AapResourceConnector$1 = AapResourceConnector_cjs;
var config = config_cjs;

class AapResourceEntityProvider$2 {
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
      return new AapResourceEntityProvider$2(providerConfig, logger, taskRunner);
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
      AapResourceConnector$1.listJobTemplates(this.baseUrl, this.authorization),
      AapResourceConnector$1.listWorkflowJobTemplates(this.baseUrl, this.authorization)
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

AapResourceEntityProvider_cjs.AapResourceEntityProvider = AapResourceEntityProvider$2;

var backendPluginApi = require$$0;
var alpha = require$$1$1;
var AapResourceEntityProvider$1 = AapResourceEntityProvider_cjs;

const catalogModuleAapResourceEntityProvider = backendPluginApi.createBackendModule({
  moduleId: "catalog-backend-module-aap",
  pluginId: "catalog",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          AapResourceEntityProvider$1.AapResourceEntityProvider.fromConfig(
            { config, logger },
            {
              schedule: scheduler.createScheduledTaskRunner({
                frequency: { minutes: 30 },
                timeout: { minutes: 3 }
              }),
              scheduler
            }
          )
        );
      }
    });
  }
});

module_cjs.catalogModuleAapResourceEntityProvider = catalogModuleAapResourceEntityProvider;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var AapResourceConnector = AapResourceConnector_cjs;
var module$1 = module_cjs;
var AapResourceEntityProvider = AapResourceEntityProvider_cjs;



index_cjs.listJobTemplates = AapResourceConnector.listJobTemplates;
index_cjs.listWorkflowJobTemplates = AapResourceConnector.listWorkflowJobTemplates;
var _default = index_cjs.default = module$1.catalogModuleAapResourceEntityProvider;
index_cjs.AapResourceEntityProvider = AapResourceEntityProvider.AapResourceEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
