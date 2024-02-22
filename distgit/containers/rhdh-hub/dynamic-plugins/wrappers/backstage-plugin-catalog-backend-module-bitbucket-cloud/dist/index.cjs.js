'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendCommon = require('@backstage/backend-common');
var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginCatalogBackendModuleBitbucketCloud = require('@backstage/plugin-catalog-backend-module-bitbucket-cloud');

const catalogModuleBitbucketCloudEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "bitbucket-cloud-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        catalogApi: alpha.catalogServiceRef,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        tokenManager: backendPluginApi.coreServices.tokenManager
      },
      async init({
        catalog,
        catalogApi,
        config,
        logger,
        scheduler,
        tokenManager
      }) {
        const winstonLogger = backendCommon.loggerToWinstonLogger(logger);
        const providers = pluginCatalogBackendModuleBitbucketCloud.BitbucketCloudEntityProvider.fromConfig(config, {
          catalogApi,
          logger: winstonLogger,
          scheduler,
          tokenManager
        });
        catalog.addEntityProvider(providers);
      }
    });
  }
});

exports["default"] = catalogModuleBitbucketCloudEntityProvider;
//# sourceMappingURL=index.cjs.js.map
