'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var zip = require('./actions/zip.cjs.js');
var writeFile = require('./actions/fs/writeFile.cjs.js');
var appendFile = require('./actions/fs/appendFile.cjs.js');
var parseFile = require('./actions/fs/parseFile.cjs.js');
var replaceInFile = require('./actions/fs/replaceInFile.cjs.js');
var merge = require('./actions/merge/merge.cjs.js');
var sleep = require('./actions/sleep.cjs.js');
var jsonata = require('./actions/jsonata/jsonata.cjs.js');
var yaml$1 = require('./actions/jsonata/yaml.cjs.js');
var json = require('./actions/jsonata/json.cjs.js');
var json$1 = require('./actions/serialize/json.cjs.js');
var yaml = require('./actions/serialize/yaml.cjs.js');

const scaffolderBackendModuleUtils = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "scaffolder-backend-module-utils",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(
          appendFile.createAppendFileAction(),
          jsonata.createJSONataAction(),
          json.createJsonJSONataTransformAction(),
          merge.createMergeAction(),
          merge.createMergeJSONAction({}),
          parseFile.createParseFileAction(),
          replaceInFile.createReplaceInFileAction(),
          json$1.createSerializeJsonAction(),
          yaml.createSerializeYamlAction(),
          sleep.createSleepAction(),
          writeFile.createWriteFileAction(),
          yaml$1.createYamlJSONataTransformAction(),
          zip.createZipAction()
        );
      }
    });
  }
});

exports.scaffolderBackendModuleUtils = scaffolderBackendModuleUtils;
//# sourceMappingURL=module.cjs.js.map
