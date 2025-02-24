'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var BitbucketServerEntityProvider = require('../providers/BitbucketServerEntityProvider.cjs.js');

const catalogModuleBitbucketServerEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "bitbucket-server-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        const providers = BitbucketServerEntityProvider.BitbucketServerEntityProvider.fromConfig(config, {
          logger,
          scheduler
        });
        catalog.addEntityProvider(providers);
      }
    });
  }
});

exports.catalogModuleBitbucketServerEntityProvider = catalogModuleBitbucketServerEntityProvider;
//# sourceMappingURL=catalogModuleBitbucketServerEntityProvider.cjs.js.map
