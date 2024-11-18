'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var deprecated = require('./deprecated.cjs.js');
var pluginEventsNode = require('@backstage/plugin-events-node');

const signalsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "signals",
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        lifecycle: backendPluginApi.coreServices.rootLifecycle,
        discovery: backendPluginApi.coreServices.discovery,
        userInfo: backendPluginApi.coreServices.userInfo,
        auth: backendPluginApi.coreServices.auth,
        events: pluginEventsNode.eventsServiceRef
      },
      async init({
        httpRouter,
        logger,
        config,
        lifecycle,
        discovery,
        userInfo,
        auth,
        events
      }) {
        httpRouter.use(
          await deprecated.createRouter({
            logger,
            config,
            lifecycle,
            discovery,
            userInfo,
            auth,
            events
          })
        );
        httpRouter.addAuthPolicy({
          path: "/",
          allow: "unauthenticated"
        });
      }
    });
  }
});

exports.signalsPlugin = signalsPlugin;
//# sourceMappingURL=plugin.cjs.js.map
