'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./service/router.cjs.js');

const azureDevOpsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "azure-devops",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        reader: backendPluginApi.coreServices.urlReader,
        permissions: backendPluginApi.coreServices.permissions,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        httpAuth: backendPluginApi.coreServices.httpAuth
      },
      async init({
        config,
        logger,
        reader,
        permissions,
        httpRouter,
        httpAuth
      }) {
        httpRouter.use(
          await router.createRouter({
            config,
            logger,
            reader,
            permissions,
            httpAuth
          })
        );
        httpRouter.addAuthPolicy({
          path: "/health",
          allow: "unauthenticated"
        });
      }
    });
  }
});

exports.azureDevOpsPlugin = azureDevOpsPlugin;
//# sourceMappingURL=plugin.cjs.js.map
