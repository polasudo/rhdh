'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var replace = require('./actions/regex/replace.cjs.js');

const scaffolderModuleRegexActions = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-regexp",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(replace.createReplaceAction());
      }
    });
  }
});

exports.scaffolderModuleRegexActions = scaffolderModuleRegexActions;
//# sourceMappingURL=module.cjs.js.map
