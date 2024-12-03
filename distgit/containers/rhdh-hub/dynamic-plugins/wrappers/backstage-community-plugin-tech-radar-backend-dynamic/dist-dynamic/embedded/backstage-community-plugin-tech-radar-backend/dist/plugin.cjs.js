'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./service/router.cjs.js');

const techRadarPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "tech-radar",
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        reader: backendPluginApi.coreServices.urlReader
      },
      async init({ httpRouter, logger, config, reader }) {
        httpRouter.use(
          await router.createRouter({
            logger,
            config,
            reader
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

exports.techRadarPlugin = techRadarPlugin;
//# sourceMappingURL=plugin.cjs.js.map
