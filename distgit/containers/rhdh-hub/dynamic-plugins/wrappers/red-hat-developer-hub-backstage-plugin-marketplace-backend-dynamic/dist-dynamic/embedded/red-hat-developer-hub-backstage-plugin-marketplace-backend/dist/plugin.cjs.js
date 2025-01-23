'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./router.cjs.js');
var MarketplaceCatalogService = require('./services/MarketplaceCatalogService.cjs.js');
var catalogClient = require('@backstage/catalog-client');

const marketplacePlugin = backendPluginApi.createBackendPlugin({
  pluginId: "marketplace",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        auth: backendPluginApi.coreServices.auth,
        config: backendPluginApi.coreServices.rootConfig,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        discovery: backendPluginApi.coreServices.discovery
      },
      async init({ logger, auth, config, httpAuth, httpRouter, discovery }) {
        const catalogApi = new catalogClient.CatalogClient({ discoveryApi: discovery });
        const marketplaceService = new MarketplaceCatalogService.MarketplaceCatalogService({
          logger,
          auth,
          config,
          catalogApi
        });
        httpRouter.use(
          await router.createRouter({
            httpAuth,
            marketplaceService
          })
        );
      }
    });
  }
});

exports.marketplacePlugin = marketplacePlugin;
//# sourceMappingURL=plugin.cjs.js.map
