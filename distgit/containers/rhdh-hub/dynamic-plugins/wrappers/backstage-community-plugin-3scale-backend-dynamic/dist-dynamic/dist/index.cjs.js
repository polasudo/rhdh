'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$1$2 = require('@backstage/plugin-catalog-node/alpha');
var require$$0$2 = require('@backstage/catalog-model');
var require$$1$1 = require('@backstage/errors');
var require$$0$1 = require('openapi-merge');
var require$$1 = require('swagger2openapi');
var require$$2 = require('swagger-converter');

var index_cjs = {};

var ThreeScaleAPIConnector_cjs = {};

function listServices(baseUrl, access_token, page, size) {
  return fetch(
    `${baseUrl}/admin/api/services.json?access_token=${access_token}&page=${page}&size=${size}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}
function listApiDocs(baseUrl, access_token) {
  return fetch(
    `${baseUrl}/admin/api/active_docs.json?access_token=${access_token}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}
function getProxyConfig(baseUrl, access_token, service_id) {
  return fetch(
    `${baseUrl}/admin/api/services/${service_id}/proxy.json?access_token=${access_token}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}

ThreeScaleAPIConnector_cjs.getProxyConfig = getProxyConfig;
ThreeScaleAPIConnector_cjs.listApiDocs = listApiDocs;
ThreeScaleAPIConnector_cjs.listServices = listServices;

var module_cjs = {};

var ThreeScaleApiEntityProvider_cjs = {};

var config_cjs = {};

var backendPluginApi$1 = require$$0;

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
  const schedule = config.has("schedule") ? backendPluginApi$1.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
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

config_cjs.readThreeScaleApiEntityConfigs = readThreeScaleApiEntityConfigs;

var types_cjs = {};

function isNonEmptyArray(arr) {
  return arr.length > 0;
}

types_cjs.isNonEmptyArray = isNonEmptyArray;

var openApiMergerConverter_cjs = {};

var openapiMerge = require$$0$1;
var Swagger2OpenAPI = require$$1;
var SwaggerConverter = require$$2;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Swagger2OpenAPI__default = /*#__PURE__*/_interopDefaultCompat(Swagger2OpenAPI);
var SwaggerConverter__default = /*#__PURE__*/_interopDefaultCompat(SwaggerConverter);

function isSwagger1_2(apiDoc) {
  return apiDoc.swaggerVersion && apiDoc.swaggerVersion === "1.2";
}
function isSwagger2_0(apiDoc) {
  return apiDoc.swagger && apiDoc.swagger === "2.0";
}
function isOpenAPI3_0(apiDoc) {
  return apiDoc.openapi;
}
class OpenAPIMergerAndConverter {
  async mergeOpenAPI3Docs(docs) {
    const mergeInput = docs.map((doc) => {
      return { oas: doc };
    });
    const result = await openapiMerge.merge(mergeInput);
    if (openapiMerge.isErrorResult(result)) {
      throw new Error(result.message);
    }
    return result.output;
  }
  // Convert api doc to format openAPI 3. Do nothing with doc if it has format openAPI 3.0.
  // 3scale supports API docs in formats:
  // - swagger 1.2
  // - swagger 2.0
  // - openAPI 3.0
  async convertAPIDocToOpenAPI3(apiDoc) {
    if (isOpenAPI3_0(apiDoc)) {
      return apiDoc;
    }
    if (isSwagger1_2(apiDoc)) {
      const swagger2_0Doc = await this.convertSwagger1_2To2_0(apiDoc);
      return await this.convertSwagger2_0ToOpenAPI3_0(swagger2_0Doc);
    }
    if (isSwagger2_0(apiDoc)) {
      return await this.convertSwagger2_0ToOpenAPI3_0(apiDoc);
    }
    throw new Error(
      `Unsupported API document. Plugin supports Swagger 1.2, 2.0, 3.0(Open API 3.0)`
    );
  }
  async convertSwagger1_2To2_0(swaggerDoc) {
    try {
      const result = SwaggerConverter__default.default.convert(swaggerDoc, {});
      return result;
    } catch (error) {
      console.error("Error converting Swagger 1.2 to Swagger 2.0:", error);
      throw error;
    }
  }
  async convertSwagger2_0ToOpenAPI3_0(swaggerDoc) {
    try {
      const result = await Swagger2OpenAPI__default.default.convertObj(swaggerDoc, {
        patch: true,
        // patch: true  helps to fix minor issues
        warnOnly: true
        // Do not throw on non-patchable errors
      });
      return result.openapi;
    } catch (error) {
      console.error("Error converting Swagger 2.0 to OpenAPI 3.0:", error);
      throw error;
    }
  }
}

openApiMergerConverter_cjs.OpenAPIMergerAndConverter = OpenAPIMergerAndConverter;
openApiMergerConverter_cjs.isOpenAPI3_0 = isOpenAPI3_0;
openApiMergerConverter_cjs.isSwagger1_2 = isSwagger1_2;
openApiMergerConverter_cjs.isSwagger2_0 = isSwagger2_0;

var catalogModel = require$$0$2;
var errors = require$$1$1;
var ThreeScaleAPIConnector$1 = ThreeScaleAPIConnector_cjs;
var config = config_cjs;
var types = types_cjs;
var openApiMergerConverter = openApiMergerConverter_cjs;

class ThreeScaleApiEntityProvider$2 {
  static SERVICES_FETCH_SIZE = 500;
  env;
  baseUrl;
  accessToken;
  logger;
  scheduleFn;
  openApiMerger;
  connection;
  static fromConfig(deps, options) {
    const providerConfigs = config.readThreeScaleApiEntityConfigs(deps.config);
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    return providerConfigs.map((providerConfig) => {
      if (!options.schedule && !providerConfig.schedule) {
        throw new errors.InputError(
          `No schedule provided via config for ThreeScaleApiEntityProvider:${providerConfig.id}.`
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
      return new ThreeScaleApiEntityProvider$2(
        providerConfig,
        deps.logger,
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
    this.openApiMerger = new openApiMergerConverter.OpenAPIMergerAndConverter();
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
      throw new errors.NotFoundError("Not initialized");
    }
    this.logger.info(`Discovering ApiEntities from 3scale ${this.baseUrl}`);
    const entities = [];
    let page = 0;
    let services;
    let apiDocs;
    let fetchServices = true;
    while (fetchServices) {
      services = await ThreeScaleAPIConnector$1.listServices(
        this.baseUrl,
        this.accessToken,
        page,
        ThreeScaleApiEntityProvider$2.SERVICES_FETCH_SIZE
      );
      apiDocs = await ThreeScaleAPIConnector$1.listApiDocs(this.baseUrl, this.accessToken);
      for (const element of services.services) {
        const service = element;
        this.logger.debug(`Find service ${service.service.name}`);
        const docs = apiDocs.api_docs.filter(
          (obj) => obj.api_doc.service_id === service.service.id
        );
        const proxy = await ThreeScaleAPIConnector$1.getProxyConfig(
          this.baseUrl,
          this.accessToken,
          service.service.id
        );
        if (types.isNonEmptyArray(docs)) {
          this.logger.info(JSON.stringify(docs));
          const apiEntity = await this.buildApiEntityFromService(
            service,
            docs,
            proxy
          );
          entities.push(apiEntity);
          this.logger.debug(`Discovered ApiEntity ${service.service.name}`);
        }
      }
      if (services.services.length < ThreeScaleApiEntityProvider$2.SERVICES_FETCH_SIZE) {
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
  async buildApiEntityFromService(service, apiDocs, proxy) {
    const location = `url:${this.baseUrl}/apiconfig/services/${service.service.id}`;
    const serviceDescription = service.service.description || "";
    let entityDescription;
    const docs = apiDocs.map((doc) => JSON.parse(doc.api_doc.body));
    let swaggerDocJSON;
    if (docs.length > 1) {
      let mergedDescription = `[Merged ${docs.length} API docs]`;
      let mergedTitle = mergedDescription;
      const convertedDocs = [];
      for (const doc of docs) {
        const convertedDoc = await this.openApiMerger.convertAPIDocToOpenAPI3(
          doc
        );
        convertedDocs.push(convertedDoc);
        mergedDescription = getDocInfo(convertedDoc)?.description ? `${mergedDescription} ${getDocInfo(convertedDoc)?.description}` : mergedDescription;
        mergedTitle = getDocInfo(convertedDoc)?.title ? `${mergedTitle} ${getDocInfo(convertedDoc)?.title}` : mergedTitle;
      }
      if (types.isNonEmptyArray(convertedDocs)) {
        swaggerDocJSON = await this.openApiMerger.mergeOpenAPI3Docs(
          convertedDocs
        );
        swaggerDocJSON.info.description = mergedDescription;
        swaggerDocJSON.info.title = mergedTitle;
        entityDescription = mergedDescription;
      }
    }
    if (docs.length === 1) {
      swaggerDocJSON = docs[0];
      const spec = JSON.parse(apiDocs[0].api_doc.body);
      if (openApiMergerConverter.isSwagger1_2(spec)) {
        swaggerDocJSON = await this.openApiMerger.convertSwagger1_2To2_0(spec);
      }
      entityDescription = getDocInfo(spec)?.description;
    }
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
        description: entityDescription || serviceDescription,
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
        definition: JSON.stringify(swaggerDocJSON, null, 2)
      }
    };
  }
}
function getDocInfo(spec) {
  if (openApiMergerConverter.isSwagger2_0(spec) || openApiMergerConverter.isOpenAPI3_0(spec)) {
    return spec.info;
  }
  return void 0;
}

ThreeScaleApiEntityProvider_cjs.ThreeScaleApiEntityProvider = ThreeScaleApiEntityProvider$2;

var backendPluginApi = require$$0;
var alpha = require$$1$2;
var ThreeScaleApiEntityProvider$1 = ThreeScaleApiEntityProvider_cjs;

const catalogModule3ScaleEntityProvider = backendPluginApi.createBackendModule({
  moduleId: "catalog-backend-module-3scale",
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
          ThreeScaleApiEntityProvider$1.ThreeScaleApiEntityProvider.fromConfig(
            { config, logger },
            {
              scheduler,
              schedule: scheduler.createScheduledTaskRunner({
                frequency: { minutes: 30 },
                timeout: { minutes: 3 }
              })
            }
          )
        );
      }
    });
  }
});

module_cjs.catalogModule3ScaleEntityProvider = catalogModule3ScaleEntityProvider;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var ThreeScaleAPIConnector = ThreeScaleAPIConnector_cjs;
var module$1 = module_cjs;
var ThreeScaleApiEntityProvider = ThreeScaleApiEntityProvider_cjs;



index_cjs.getProxyConfig = ThreeScaleAPIConnector.getProxyConfig;
index_cjs.listApiDocs = ThreeScaleAPIConnector.listApiDocs;
index_cjs.listServices = ThreeScaleAPIConnector.listServices;
var _default = index_cjs.default = module$1.catalogModule3ScaleEntityProvider;
index_cjs.ThreeScaleApiEntityProvider = ThreeScaleApiEntityProvider.ThreeScaleApiEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
