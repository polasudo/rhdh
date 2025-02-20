'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var router = require('./service/router.cjs.js');

const bulkImportPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "bulk-import",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        http: backendPluginApi.coreServices.httpRouter,
        cache: backendPluginApi.coreServices.cache,
        discovery: backendPluginApi.coreServices.discovery,
        permissions: backendPluginApi.coreServices.permissions,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        auth: backendPluginApi.coreServices.auth,
        catalogApi: alpha.catalogServiceRef
      },
      async init({
        config,
        logger,
        http,
        cache,
        discovery,
        permissions,
        httpAuth,
        auth,
        catalogApi
      }) {
        const router$1 = await router.createRouter({
          config,
          cache,
          discovery,
          permissions,
          logger,
          httpAuth,
          auth,
          catalogApi
        });
        http.use(router$1);
        http.addAuthPolicy({
          path: "/ping",
          allow: "unauthenticated"
        });
      }
    });
  }
});

exports.bulkImportPlugin = bulkImportPlugin;
//# sourceMappingURL=plugin.cjs.js.map
