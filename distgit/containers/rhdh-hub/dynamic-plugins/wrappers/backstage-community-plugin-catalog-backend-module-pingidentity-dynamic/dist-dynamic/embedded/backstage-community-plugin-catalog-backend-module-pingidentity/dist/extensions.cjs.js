'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

const pingIdentityTransformerExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "pingIdentity.transformer"
});

exports.pingIdentityTransformerExtensionPoint = pingIdentityTransformerExtensionPoint;
//# sourceMappingURL=extensions.cjs.js.map
