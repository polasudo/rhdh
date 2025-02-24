'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginNotificationsNode = require('@backstage/plugin-notifications-node');
var NotificationsEmailProcessor = require('./processor/NotificationsEmailProcessor.cjs.js');
var extensions = require('./extensions.cjs.js');

const notificationsModuleEmail = backendPluginApi.createBackendModule({
  pluginId: "notifications",
  moduleId: "email",
  register(reg) {
    let templateRenderer;
    reg.registerExtensionPoint(extensions.notificationsEmailTemplateExtensionPoint, {
      setTemplateRenderer(renderer) {
        if (templateRenderer) {
          throw new Error(`Email template renderer was already registered`);
        }
        templateRenderer = renderer;
      }
    });
    reg.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        notifications: pluginNotificationsNode.notificationsProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger,
        auth: backendPluginApi.coreServices.auth,
        cache: backendPluginApi.coreServices.cache,
        catalog: alpha.catalogServiceRef
      },
      async init({ config, notifications, logger, auth, cache, catalog }) {
        notifications.addProcessor(
          new NotificationsEmailProcessor.NotificationsEmailProcessor(
            logger,
            config,
            catalog,
            auth,
            cache,
            templateRenderer
          )
        );
      }
    });
  }
});

exports.notificationsModuleEmail = notificationsModuleEmail;
//# sourceMappingURL=module.cjs.js.map
