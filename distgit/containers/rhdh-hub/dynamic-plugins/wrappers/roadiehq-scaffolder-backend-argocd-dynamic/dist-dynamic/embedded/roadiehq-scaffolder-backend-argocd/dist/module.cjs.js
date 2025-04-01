'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var backendCommon = require('@backstage/backend-common');
var argocd = require('./actions/run/argocd.cjs.js');

const scaffolderBackendArgoCD = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "scaffolder-backend-argocd",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ scaffolder, config, logger }) {
        scaffolder.addActions(
          argocd.createArgoCdResources(
            config,
            backendCommon.loggerToWinstonLogger(logger)
          )
        );
      }
    });
  }
});

exports.scaffolderBackendArgoCD = scaffolderBackendArgoCD;
//# sourceMappingURL=module.cjs.js.map
