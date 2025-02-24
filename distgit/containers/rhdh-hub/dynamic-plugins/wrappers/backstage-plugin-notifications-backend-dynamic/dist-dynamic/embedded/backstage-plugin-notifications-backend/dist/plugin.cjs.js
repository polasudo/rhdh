'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var router = require('./service/router.cjs.js');
var pluginSignalsNode = require('@backstage/plugin-signals-node');
var pluginNotificationsNode = require('@backstage/plugin-notifications-node');
var alpha = require('@backstage/plugin-catalog-node/alpha');

class NotificationsProcessingExtensionPointImpl {
  #processors = new Array();
  addProcessor(...processors) {
    this.#processors.push(...processors.flat());
  }
  get processors() {
    return this.#processors;
  }
}
const notificationsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "notifications",
  register(env) {
    const processingExtensions = new NotificationsProcessingExtensionPointImpl();
    env.registerExtensionPoint(
      pluginNotificationsNode.notificationsProcessingExtensionPoint,
      processingExtensions
    );
    env.registerInit({
      deps: {
        auth: backendPluginApi.coreServices.auth,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        userInfo: backendPluginApi.coreServices.userInfo,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        database: backendPluginApi.coreServices.database,
        signals: pluginSignalsNode.signalsServiceRef,
        config: backendPluginApi.coreServices.rootConfig,
        catalog: alpha.catalogServiceRef
      },
      async init({
        auth,
        httpAuth,
        userInfo,
        httpRouter,
        logger,
        database,
        signals,
        config,
        catalog
      }) {
        httpRouter.use(
          await router.createRouter({
            auth,
            httpAuth,
            userInfo,
            logger,
            config,
            database,
            catalog,
            signals,
            processors: processingExtensions.processors
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

exports.notificationsPlugin = notificationsPlugin;
//# sourceMappingURL=plugin.cjs.js.map
