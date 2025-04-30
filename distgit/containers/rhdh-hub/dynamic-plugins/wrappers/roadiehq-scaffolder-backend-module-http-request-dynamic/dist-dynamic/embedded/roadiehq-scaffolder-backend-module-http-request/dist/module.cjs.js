'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var backstageRequest = require('./actions/run/backstageRequest.cjs.js');

const scaffolderBackendModuleHttpRequest = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "scaffolder-backend-module-http-request",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery,
        auth: backendPluginApi.coreServices.auth
      },
      async init({ scaffolder, discovery, auth }) {
        scaffolder.addActions(
          backstageRequest.createHttpBackstageAction({ discovery, auth })
        );
      }
    });
  }
});

exports.scaffolderBackendModuleHttpRequest = scaffolderBackendModuleHttpRequest;
//# sourceMappingURL=module.cjs.js.map
