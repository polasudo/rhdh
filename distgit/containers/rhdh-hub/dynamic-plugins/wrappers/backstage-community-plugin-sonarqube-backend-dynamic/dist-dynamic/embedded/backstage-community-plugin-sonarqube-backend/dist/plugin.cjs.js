'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');
var sonarqubeInfoProvider = require('./service/sonarqubeInfoProvider.cjs.js');
var router = require('./service/router.cjs.js');

const sonarqubePlugin = backendPluginApi.createBackendPlugin({
  pluginId: "sonarqube",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        httpRouter: backendPluginApi.coreServices.httpRouter
      },
      async init({ logger, config, httpRouter }) {
        const router$1 = await router.createRouter({
          /**
           * Logger for logging purposes
           */
          logger,
          /**
           * Info provider to be able to get all necessary information for the APIs
           */
          sonarqubeInfoProvider: sonarqubeInfoProvider.DefaultSonarqubeInfoProvider.fromConfig(
            config,
            logger
          )
        });
        const factory = rootHttpRouter.MiddlewareFactory.create({ logger, config });
        router$1.use(factory.error());
        httpRouter.use(router$1);
      }
    });
  }
});

exports.sonarqubePlugin = sonarqubePlugin;
//# sourceMappingURL=plugin.cjs.js.map
