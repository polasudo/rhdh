'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var PingIdentityEntityProvider = require('../providers/PingIdentityEntityProvider.cjs.js');
var extensions = require('../extensions.cjs.js');

const catalogModulePingIdentityEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "pingidentity",
  register(reg) {
    let userTransformer;
    let groupTransformer;
    reg.registerExtensionPoint(extensions.pingIdentityTransformerExtensionPoint, {
      setUserTransformer(transformer) {
        if (userTransformer) {
          throw new Error("User transformer may only be set once");
        }
        userTransformer = transformer;
      },
      setGroupTransformer(transformer) {
        if (groupTransformer) {
          throw new Error("Group transformer may only be set once");
        }
        groupTransformer = transformer;
      }
    });
    reg.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          PingIdentityEntityProvider.PingIdentityEntityProvider.fromConfig(config, {
            logger,
            scheduler,
            userTransformer,
            groupTransformer
          })
        );
      }
    });
  }
});

exports.catalogModulePingIdentityEntityProvider = catalogModulePingIdentityEntityProvider;
//# sourceMappingURL=catalogModulePingIdentityEntityProvider.cjs.js.map
