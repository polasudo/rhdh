'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var ThreeScaleApiEntityProvider = require('./providers/ThreeScaleApiEntityProvider.cjs.js');

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
          ThreeScaleApiEntityProvider.ThreeScaleApiEntityProvider.fromConfig(
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

exports.catalogModule3ScaleEntityProvider = catalogModule3ScaleEntityProvider;
//# sourceMappingURL=module.cjs.js.map
