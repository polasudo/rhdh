'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var AapResourceEntityProvider = require('./providers/AapResourceEntityProvider.cjs.js');

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
          AapResourceEntityProvider.AapResourceEntityProvider.fromConfig(
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

exports.catalogModuleAapResourceEntityProvider = catalogModuleAapResourceEntityProvider;
//# sourceMappingURL=module.cjs.js.map
