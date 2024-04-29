'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var integration = require('@backstage/integration');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var scaffolderBackendModuleAzureRepositories = require('@parfuemerie-douglas/scaffolder-backend-module-azure-repositories');

const azureRepositoriesActions = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-azure-repositories",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ config, scaffolder }) {
        const integrations = integration.ScmIntegrations.fromConfig(config);
        scaffolder.addActions(
          scaffolderBackendModuleAzureRepositories.cloneAzureRepoAction({ integrations }),
          scaffolderBackendModuleAzureRepositories.pushAzureRepoAction({ integrations, config }),
          scaffolderBackendModuleAzureRepositories.pullRequestAzureRepoAction({ integrations })
        );
      }
    });
  }
});

exports["default"] = azureRepositoriesActions;
//# sourceMappingURL=index.cjs.js.map
