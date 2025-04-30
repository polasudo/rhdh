'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./service/router.cjs.js');
var argocdService_ref = require('./refs/argocdService.ref.cjs.js');

const ArgoCDPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "argocd",
  register(env) {
    env.registerInit({
      deps: {
        http: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        argocdService: argocdService_ref.argocdServiceRef
      },
      async init({ http, logger, config, argocdService }) {
        logger.info("ArgoCD plugin is initializing");
        http.use(
          await router.createRouter({
            logger,
            config,
            argocdService
          })
        );
      }
    });
  }
});

exports.ArgoCDPlugin = ArgoCDPlugin;
//# sourceMappingURL=plugin.cjs.js.map
