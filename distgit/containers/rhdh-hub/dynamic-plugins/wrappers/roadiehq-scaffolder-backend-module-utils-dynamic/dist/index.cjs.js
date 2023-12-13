'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var scaffolderBackendModuleUtils = require('@roadiehq/scaffolder-backend-module-utils');

const dynamicPluginInstaller = {
  kind: "legacy",
  scaffolder: () => [
    scaffolderBackendModuleUtils.createZipAction(),
    scaffolderBackendModuleUtils.createSleepAction(),
    scaffolderBackendModuleUtils.createWriteFileAction(),
    scaffolderBackendModuleUtils.createAppendFileAction(),
    scaffolderBackendModuleUtils.createMergeJSONAction({}),
    scaffolderBackendModuleUtils.createMergeAction(),
    scaffolderBackendModuleUtils.createParseFileAction(),
    scaffolderBackendModuleUtils.createReplaceInFileAction(),
    scaffolderBackendModuleUtils.createSerializeYamlAction(),
    scaffolderBackendModuleUtils.createSerializeJsonAction(),
    scaffolderBackendModuleUtils.createJSONataAction(),
    scaffolderBackendModuleUtils.createYamlJSONataTransformAction(),
    scaffolderBackendModuleUtils.createJsonJSONataTransformAction()
  ]
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
