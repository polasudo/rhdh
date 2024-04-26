'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var scaffolderBackendModuleHttpRequest = require('@roadiehq/scaffolder-backend-module-http-request');

const scaffolderModuleHttpRequest = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-module-http-request",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery
      },
      async init({ scaffolder, discovery }) {
        scaffolder.addActions(scaffolderBackendModuleHttpRequest.createHttpBackstageAction({ discovery }));
      }
    });
  }
});

exports["default"] = scaffolderModuleHttpRequest;
//# sourceMappingURL=index.cjs.js.map
