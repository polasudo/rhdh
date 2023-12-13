'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var integration = require('@backstage/integration');
var pluginScaffolderBackendModuleGitlab = require('@backstage/plugin-scaffolder-backend-module-gitlab');

const dynamicPluginInstaller = {
  kind: "legacy",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scaffolder(env) {
    const integrations = integration.ScmIntegrations.fromConfig(env.config);
    return [
      pluginScaffolderBackendModuleGitlab.createGitlabProjectAccessTokenAction({ integrations }),
      pluginScaffolderBackendModuleGitlab.createGitlabProjectDeployTokenAction({ integrations }),
      pluginScaffolderBackendModuleGitlab.createGitlabProjectVariableAction({ integrations }),
      pluginScaffolderBackendModuleGitlab.createGitlabGroupEnsureExistsAction({ integrations })
    ];
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
