'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var catalogClient = require('@backstage/catalog-client');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var router = require('./router.cjs.js');

const marketplacePlugin = backendPluginApi.createBackendPlugin({
  pluginId: "marketplace",
  register(env) {
    env.registerInit({
      deps: {
        auth: backendPluginApi.coreServices.auth,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        discovery: backendPluginApi.coreServices.discovery
      },
      async init({ auth, httpAuth, httpRouter, discovery }) {
        const catalogApi = new catalogClient.CatalogClient({ discoveryApi: discovery });
        const marketplaceApi = new backstagePluginMarketplaceCommon.MarketplaceCatalogClient({
          auth,
          catalogApi
        });
        httpRouter.use(
          await router.createRouter({
            httpAuth,
            marketplaceApi
          })
        );
      }
    });
  }
});

exports.marketplacePlugin = marketplacePlugin;
//# sourceMappingURL=plugin.cjs.js.map
