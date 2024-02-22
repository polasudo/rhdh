'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendCommon = require('@backstage/backend-common');
var backendPluginApi = require('@backstage/backend-plugin-api');
var backstagePluginArgoCdBackend = require('@roadiehq/backstage-plugin-argo-cd-backend');

const argocdPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "argocd",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        http: backendPluginApi.coreServices.httpRouter
      },
      async init({ config, logger, http }) {
        http.use(
          await backstagePluginArgoCdBackend.createRouter({
            logger: backendCommon.loggerToWinstonLogger(logger),
            config
          })
        );
      }
    });
  }
});

exports["default"] = argocdPlugin;
//# sourceMappingURL=index.cjs.js.map
