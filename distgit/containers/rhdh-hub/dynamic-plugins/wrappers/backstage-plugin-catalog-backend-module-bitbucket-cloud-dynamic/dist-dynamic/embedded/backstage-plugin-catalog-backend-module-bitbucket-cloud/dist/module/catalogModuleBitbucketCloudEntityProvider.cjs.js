'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginEventsNode = require('@backstage/plugin-events-node');
var BitbucketCloudEntityProvider = require('../providers/BitbucketCloudEntityProvider.cjs.js');

const catalogModuleBitbucketCloudEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "bitbucket-cloud-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        auth: backendPluginApi.coreServices.auth,
        catalog: alpha.catalogProcessingExtensionPoint,
        catalogApi: alpha.catalogServiceRef,
        config: backendPluginApi.coreServices.rootConfig,
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({
        auth,
        catalog,
        catalogApi,
        config,
        events,
        logger,
        scheduler
      }) {
        const providers = BitbucketCloudEntityProvider.BitbucketCloudEntityProvider.fromConfig(config, {
          auth,
          catalogApi,
          events,
          logger,
          scheduler
        });
        catalog.addEntityProvider(providers);
      }
    });
  }
});

exports.catalogModuleBitbucketCloudEntityProvider = catalogModuleBitbucketCloudEntityProvider;
//# sourceMappingURL=catalogModuleBitbucketCloudEntityProvider.cjs.js.map
