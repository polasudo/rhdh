'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./service/router.cjs.js');
var backendCommon = require('@backstage/backend-common');

const ArgoCDPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "argocd",
  register(env) {
    env.registerInit({
      deps: {
        http: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ http, logger, config }) {
        logger.info("ArgoCD plugin is initializing");
        http.use(
          await router.createRouter({
            logger: backendCommon.loggerToWinstonLogger(logger),
            config
          })
        );
      }
    });
  }
});

exports.ArgoCDPlugin = ArgoCDPlugin;
//# sourceMappingURL=plugin.cjs.js.map
