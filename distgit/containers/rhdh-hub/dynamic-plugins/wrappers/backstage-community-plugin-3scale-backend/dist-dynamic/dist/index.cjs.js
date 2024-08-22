'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/catalog-model');
var require$$1 = require('@backstage/backend-tasks');

var ThreeScaleApiEntityProviderB3TyzFXk_cjs = {};

var catalogModel = require$$0;
var backendTasks = require$$1;

function listServices$1(baseUrl, access_token, page, size) {
  return fetch(
    `${baseUrl}/admin/api/services.json?access_token=${access_token}&page=${page}&size=${size}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}
function listApiDocs$1(baseUrl, access_token) {
  return fetch(
    `${baseUrl}/admin/api/active_docs.json?access_token=${access_token}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}
function getProxyConfig$1(baseUrl, access_token, service_id) {
  return fetch(
    `${baseUrl}/admin/api/services/${service_id}/proxy.json?access_token=${access_token}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}

function readThreeScaleApiEntityConfigs(config) {
  const providerConfigs = config.getOptionalConfig(
    "catalog.providers.threeScaleApiEntity"
  );
  if (!providerConfigs) {
    return [];
  }
  return providerConfigs.keys().map(
    (id) => readThreeScaleApiEntityConfig(id, providerConfigs.getConfig(id))
  );
}
function readThreeScaleApiEntityConfig(id, config) {
  const baseUrl = config.getString("baseUrl");
  const accessToken = config.getString("accessToken");
  const systemLabel = config.getOptionalString("systemLabel");
  const ownerLabel = config.getOptionalString("ownerLabel");
  const addLabels = config.getOptionalBoolean("addLabels") || true;
  const schedule = config.has("schedule") ? backendTasks.readTaskScheduleDefinitionFromConfig(config.getConfig("schedule")) : void 0;
  return {
    id,
    baseUrl,
    accessToken,
    systemLabel,
    ownerLabel,
    addLabels,
    schedule
  };
}

class ThreeScaleApiEntityProvider$1 {
  static SERVICES_FETCH_SIZE = 500;
  env;
  baseUrl;
  accessToken;
  logger;
  scheduleFn;
  connection;
  static fromConfig(configRoot, options) {
    const providerConfigs = readThreeScaleApiEntityConfigs(configRoot);
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    return providerConfigs.map((providerConfig) => {
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for ThreeScaleApiEntityProvider:${providerConfig.id}.`
        );
      }
      let taskRunner;
      if (options.scheduler && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if (options.schedule) {
        taskRunner = options.schedule;
      } else {
        throw new Error("Neither schedule nor scheduler is provided.");
      }
      return new ThreeScaleApiEntityProvider$1(
        providerConfig,
        options.logger,
        taskRunner
      );
    });
  }
  constructor(config, logger, taskRunner) {
    this.env = config.id;
    this.baseUrl = config.baseUrl;
    this.accessToken = config.accessToken;
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
            this.logger.error(
              `Error while syncing 3scale API from ${this.baseUrl}`,
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
      });
    };
  }
  getProviderName() {
    return `ThreeScaleApiEntityProvider:${this.env}`;
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  async run() {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    this.logger.info(`Discovering ApiEntities from 3scale ${this.baseUrl}`);
    const entities = [];
    let page = 0;
    let services;
    let apiDocs;
    let fetchServices = true;
    while (fetchServices) {
      services = await listServices$1(
        this.baseUrl,
        this.accessToken,
        page,
        ThreeScaleApiEntityProvider$1.SERVICES_FETCH_SIZE
      );
      apiDocs = await listApiDocs$1(this.baseUrl, this.accessToken);
      for (const element of services.services) {
        const service = element;
        this.logger.debug(`Find service ${service.service.name}`);
        const apiDoc = apiDocs.api_docs.find((obj) => {
          if (obj.api_doc.service_id !== void 0) {
            return obj.api_doc.service_id === service.service.id;
          }
          return false;
        });
        const proxy = await getProxyConfig$1(
          this.baseUrl,
          this.accessToken,
          service.service.id
        );
        if (apiDoc !== void 0) {
          this.logger.info(JSON.stringify(apiDoc));
          const apiEntity = this.buildApiEntityFromService(
            service,
            apiDoc,
            proxy
          );
          entities.push(apiEntity);
          this.logger.debug(`Discovered ApiEntity ${service.service.name}`);
        }
      }
      if (services.services.length < ThreeScaleApiEntityProvider$1.SERVICES_FETCH_SIZE) {
        fetchServices = false;
      }
      page++;
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
  buildApiEntityFromService(service, apiDoc, proxy) {
    const location = `url:${this.baseUrl}/apiconfig/services/${service.service.id}`;
    const spec = JSON.parse(apiDoc.api_doc.body);
    return {
      kind: "API",
      apiVersion: "backstage.io/v1alpha1",
      metadata: {
        annotations: {
          [catalogModel.ANNOTATION_LOCATION]: location,
          [catalogModel.ANNOTATION_ORIGIN_LOCATION]: location
        },
        //  TODO: add tenant name
        name: `${service.service.system_name}`,
        description: spec.info.description || `Version: ${service.service.description}`,
        //  TODO: add labels
        //  labels: this.getApiEntityLabels(service),
        links: [
          {
            url: `${this.baseUrl}/apiconfig/services/${service.service.id}`,
            title: "3scale Overview"
          },
          {
            url: `${proxy.proxy.sandbox_endpoint}`,
            title: "Staging Apicast Endpoint"
          },
          {
            url: `${proxy.proxy.endpoint}`,
            title: "Production Apicast Endpoint"
          }
        ]
      },
      spec: {
        type: "openapi",
        lifecycle: this.env,
        system: "3scale",
        owner: "3scale",
        definition: apiDoc.api_doc.body
      }
    };
  }
}

ThreeScaleApiEntityProviderB3TyzFXk_cjs.ThreeScaleApiEntityProvider = ThreeScaleApiEntityProvider$1;
ThreeScaleApiEntityProviderB3TyzFXk_cjs.getProxyConfig = getProxyConfig$1;
ThreeScaleApiEntityProviderB3TyzFXk_cjs.listApiDocs = listApiDocs$1;
ThreeScaleApiEntityProviderB3TyzFXk_cjs.listServices = listServices$1;

var ThreeScaleApiEntityProvider = ThreeScaleApiEntityProviderB3TyzFXk_cjs;



const dynamicPluginInstaller = {
  kind: "legacy",
  async catalog(builder, env) {
    builder.addEntityProvider(
      ThreeScaleApiEntityProvider.ThreeScaleApiEntityProvider.fromConfig(env.config, {
        logger: env.logger,
        scheduler: env.scheduler,
        schedule: env.scheduler.createScheduledTaskRunner({
          frequency: { minutes: 1 },
          timeout: { minutes: 1 }
        })
      })
    );
  }
};

var ThreeScaleApiEntityProvider_1 = ThreeScaleApiEntityProvider.ThreeScaleApiEntityProvider;
var getProxyConfig = ThreeScaleApiEntityProvider.getProxyConfig;
var listApiDocs = ThreeScaleApiEntityProvider.listApiDocs;
var listServices = ThreeScaleApiEntityProvider.listServices;
var dynamicPluginInstaller_1 = dynamicPluginInstaller;

exports.ThreeScaleApiEntityProvider = ThreeScaleApiEntityProvider_1;
exports.dynamicPluginInstaller = dynamicPluginInstaller_1;
exports.getProxyConfig = getProxyConfig;
exports.listApiDocs = listApiDocs;
exports.listServices = listServices;
//# sourceMappingURL=index.cjs.js.map
