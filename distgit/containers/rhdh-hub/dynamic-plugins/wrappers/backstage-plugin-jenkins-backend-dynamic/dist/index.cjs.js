'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginJenkinsBackend = require('@backstage/plugin-jenkins-backend');
var catalogClient = require('@backstage/catalog-client');

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "jenkins",
    async createPlugin(env) {
      const catalog = new catalogClient.CatalogClient({
        discoveryApi: env.discovery
      });
      return await pluginJenkinsBackend.createRouter({
        logger: env.logger,
        jenkinsInfoProvider: pluginJenkinsBackend.DefaultJenkinsInfoProvider.fromConfig({
          config: env.config,
          catalog
        }),
        permissions: env.permissions
      });
    }
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
