'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var createSonarQubeProject = require('./actions/createSonarQubeProject.cjs.js');

const scaffolderModuleSonarqubeActions = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-sonarqube",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(createSonarQubeProject.createSonarQubeProjectAction());
      }
    });
  }
});

exports.scaffolderModuleSonarqubeActions = scaffolderModuleSonarqubeActions;
//# sourceMappingURL=module.cjs.js.map
