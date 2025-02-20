'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var index = require('./actions/servicenow/index.cjs.js');

const scaffolderModuleServicenowActions = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-servicenow",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config }) {
        scaffolder.addActions(...index.createServiceNowActions({ config }));
      }
    });
  }
});

exports.scaffolderModuleServicenowActions = scaffolderModuleServicenowActions;
//# sourceMappingURL=module.cjs.js.map
