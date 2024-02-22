'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var scaffolderBackendModuleUtils$1 = require('@roadiehq/scaffolder-backend-module-utils');

const scaffolderBackendModuleUtils = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-module-utils",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery
      },
      async init({ scaffolder }) {
        for (const action of [
          scaffolderBackendModuleUtils$1.createZipAction,
          scaffolderBackendModuleUtils$1.createSleepAction,
          scaffolderBackendModuleUtils$1.createWriteFileAction,
          scaffolderBackendModuleUtils$1.createAppendFileAction,
          scaffolderBackendModuleUtils$1.createMergeJSONAction,
          scaffolderBackendModuleUtils$1.createMergeAction,
          scaffolderBackendModuleUtils$1.createParseFileAction,
          scaffolderBackendModuleUtils$1.createReplaceInFileAction,
          scaffolderBackendModuleUtils$1.createSerializeYamlAction,
          scaffolderBackendModuleUtils$1.createSerializeJsonAction,
          scaffolderBackendModuleUtils$1.createJSONataAction,
          scaffolderBackendModuleUtils$1.createYamlJSONataTransformAction,
          scaffolderBackendModuleUtils$1.createJsonJSONataTransformAction
        ]) {
          scaffolder.addActions(action({}));
        }
      }
    });
  }
});

exports["default"] = scaffolderBackendModuleUtils;
//# sourceMappingURL=index.cjs.js.map
