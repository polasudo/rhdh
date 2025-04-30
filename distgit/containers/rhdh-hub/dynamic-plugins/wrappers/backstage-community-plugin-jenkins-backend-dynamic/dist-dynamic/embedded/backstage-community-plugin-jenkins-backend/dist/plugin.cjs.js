'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var jenkinsInfoProvider = require('./service/jenkinsInfoProvider.cjs.js');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var JenkinsBuilder = require('./service/JenkinsBuilder.cjs.js');

const jenkinsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "jenkins",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        permissions: backendPluginApi.coreServices.permissions,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        config: backendPluginApi.coreServices.rootConfig,
        catalogClient: alpha.catalogServiceRef,
        discovery: backendPluginApi.coreServices.discovery,
        auth: backendPluginApi.coreServices.auth,
        httpAuth: backendPluginApi.coreServices.httpAuth
      },
      async init({
        logger,
        permissions,
        httpRouter,
        config,
        catalogClient,
        discovery,
        auth,
        httpAuth
      }) {
        const jenkinsInfoProvider$1 = jenkinsInfoProvider.DefaultJenkinsInfoProvider.fromConfig({
          auth,
          httpAuth,
          config,
          catalog: catalogClient,
          discovery,
          logger
        });
        const builder = JenkinsBuilder.JenkinsBuilder.createBuilder({
          /**
           * Logger for logging purposes
           */
          logger,
          /**
           * Info provider to be able to get all necessary information for the APIs
           */
          jenkinsInfoProvider: jenkinsInfoProvider$1,
          config,
          permissions,
          discovery,
          auth,
          httpAuth
        });
        const { router } = await builder.build();
        httpRouter.use(router);
      }
    });
  }
});

exports.jenkinsPlugin = jenkinsPlugin;
//# sourceMappingURL=plugin.cjs.js.map
