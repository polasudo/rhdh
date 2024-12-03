'use strict';

var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var ThreeScaleAPIConnector = require('../clients/ThreeScaleAPIConnector.cjs.js');
var config = require('./config.cjs.js');
var types = require('./types.cjs.js');
var openApiMergerConverter = require('./open-api-merger-converter.cjs.js');

class ThreeScaleApiEntityProvider {
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
      return new ThreeScaleApiEntityProvider(
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
      services = await ThreeScaleAPIConnector.listServices(
        this.baseUrl,
        this.accessToken,
        page,
        ThreeScaleApiEntityProvider.SERVICES_FETCH_SIZE
      );
      apiDocs = await ThreeScaleAPIConnector.listApiDocs(this.baseUrl, this.accessToken);
      for (const element of services.services) {
        const service = element;
        this.logger.debug(`Find service ${service.service.name}`);
        const docs = apiDocs.api_docs.filter(
          (obj) => obj.api_doc.service_id === service.service.id
        );
        const proxy = await ThreeScaleAPIConnector.getProxyConfig(
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
      if (services.services.length < ThreeScaleApiEntityProvider.SERVICES_FETCH_SIZE) {
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

exports.ThreeScaleApiEntityProvider = ThreeScaleApiEntityProvider;
//# sourceMappingURL=ThreeScaleApiEntityProvider.cjs.js.map
