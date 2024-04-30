'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendCommon = require('@backstage/backend-common');
var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginCatalogBackendModuleGitlab = require('@backstage/plugin-catalog-backend-module-gitlab');

const catalogModuleGitlabOrgDiscoveryEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "gitlab-org-discovery-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        catalog: alpha.catalogProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ config, catalog, logger, scheduler }) {
        catalog.addEntityProvider(
          pluginCatalogBackendModuleGitlab.GitlabOrgDiscoveryEntityProvider.fromConfig(config, {
            logger: backendCommon.loggerToWinstonLogger(logger),
            scheduler
          })
        );
      }
    });
  }
});

exports["default"] = catalogModuleGitlabOrgDiscoveryEntityProvider;
//# sourceMappingURL=index.cjs.js.map
