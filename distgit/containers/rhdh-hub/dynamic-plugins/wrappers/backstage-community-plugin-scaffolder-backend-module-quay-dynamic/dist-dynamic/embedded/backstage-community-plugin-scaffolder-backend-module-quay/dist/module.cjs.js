'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var createQuayRepository = require('./actions/createQuayRepository.cjs.js');

const scaffolderModuleQuayAction = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-quay",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(createQuayRepository.createQuayRepositoryAction());
      }
    });
  }
});

exports.scaffolderModuleQuayAction = scaffolderModuleQuayAction;
//# sourceMappingURL=module.cjs.js.map
