'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginSonarqubeBackend = require('@backstage/plugin-sonarqube-backend');

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "sonarqube",
    async createPlugin(env) {
      return await pluginSonarqubeBackend.createRouter({
        logger: env.logger,
        sonarqubeInfoProvider: pluginSonarqubeBackend.DefaultSonarqubeInfoProvider.fromConfig(
          env.config
        )
      });
    }
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
