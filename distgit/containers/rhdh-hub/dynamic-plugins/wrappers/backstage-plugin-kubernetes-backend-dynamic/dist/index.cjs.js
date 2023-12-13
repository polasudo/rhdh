'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginKubernetesBackend = require('@backstage/plugin-kubernetes-backend');
var catalogClient = require('@backstage/catalog-client');

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "kubernetes",
    async createPlugin(env) {
      const catalogApi = new catalogClient.CatalogClient({ discoveryApi: env.discovery });
      const { router } = await pluginKubernetesBackend.KubernetesBuilder.createBuilder({
        logger: env.logger,
        config: env.config,
        permissions: env.permissions,
        catalogApi
      }).build();
      return router;
    }
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
