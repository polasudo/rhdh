'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

const notificationsEmailTemplateExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "notifications.email.templates"
});

exports.notificationsEmailTemplateExtensionPoint = notificationsEmailTemplateExtensionPoint;
//# sourceMappingURL=extensions.cjs.js.map
