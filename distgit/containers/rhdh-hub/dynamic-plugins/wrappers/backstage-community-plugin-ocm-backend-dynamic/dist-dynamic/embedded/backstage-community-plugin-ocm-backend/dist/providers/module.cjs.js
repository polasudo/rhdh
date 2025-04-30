'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var ManagedClusterProvider = require('./ManagedClusterProvider.cjs.js');

const catalogModuleOCMEntityProvider = backendPluginApi.createBackendModule({
  moduleId: "catalog-backend-module-ocm",
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
          ManagedClusterProvider.ManagedClusterProvider.fromConfig(
            { config, logger },
            {
              schedule: scheduler.createScheduledTaskRunner({
                frequency: { hours: 1 },
                timeout: { minutes: 15 },
                initialDelay: { seconds: 15 }
              }),
              scheduler
            }
          )
        );
      }
    });
  }
});

exports.catalogModuleOCMEntityProvider = catalogModuleOCMEntityProvider;
//# sourceMappingURL=module.cjs.js.map
