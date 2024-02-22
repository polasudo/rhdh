'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var scaffolderBackendArgocd = require('@roadiehq/scaffolder-backend-argocd');
var backendCommon = require('@backstage/backend-common');

const scaffolderBackendModuleArgocd = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-module-argocd",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ scaffolder, config, logger }) {
        scaffolder.addActions(
          scaffolderBackendArgocd.createArgoCdResources(config, backendCommon.loggerToWinstonLogger(logger))
        );
      }
    });
  }
});

exports["default"] = scaffolderBackendModuleArgocd;
//# sourceMappingURL=index.cjs.js.map
