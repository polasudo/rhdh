'use strict';

var backendCommon = require('@backstage/backend-common');
var backendPluginApi = require('@backstage/backend-plugin-api');
var pluginCatalogBackendModuleGitlab = require('@backstage/plugin-catalog-backend-module-gitlab');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginEventsNode = require('@backstage/plugin-events-node');

const catalogModuleGitlabOrgDiscoveryEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "gitlabOrgDiscoveryEntityProvider",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        catalog: alpha.catalogProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        events: pluginEventsNode.eventsServiceRef
      },
      async init({ config, catalog, logger, scheduler, events }) {
        const gitlabOrgDiscoveryEntityProvider = pluginCatalogBackendModuleGitlab.GitlabOrgDiscoveryEntityProvider.fromConfig(config, {
          logger: backendCommon.loggerToWinstonLogger(logger),
          events,
          scheduler
        });
        catalog.addEntityProvider(gitlabOrgDiscoveryEntityProvider);
      }
    });
  }
});

exports.catalogModuleGitlabOrgDiscoveryEntityProvider = catalogModuleGitlabOrgDiscoveryEntityProvider;
//# sourceMappingURL=catalogModuleGitlabOrgDiscoveryEntityProvider.cjs.js.map
