'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var catalogClient = require('@backstage/catalog-client');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var createKubernetesNamespace = require('./actions/createKubernetesNamespace.cjs.js');

const scaffolderModuleKubernetesAction = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-kubernetes",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery
      },
      async init({ scaffolder, discovery }) {
        const catalogClient$1 = new catalogClient.CatalogClient({
          discoveryApi: discovery
        });
        scaffolder.addActions(createKubernetesNamespace.createKubernetesNamespaceAction(catalogClient$1));
      }
    });
  }
});

exports.scaffolderModuleKubernetesAction = scaffolderModuleKubernetesAction;
//# sourceMappingURL=module.cjs.js.map
