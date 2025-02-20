'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./cjs/router-BGCd_2TI.cjs.js');
var backendCommon = require('@backstage/backend-common');
require('express');
require('express-promise-router');
require('cross-fetch');

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

exports.default = ArgoCDPlugin;
//# sourceMappingURL=alpha.cjs.js.map
