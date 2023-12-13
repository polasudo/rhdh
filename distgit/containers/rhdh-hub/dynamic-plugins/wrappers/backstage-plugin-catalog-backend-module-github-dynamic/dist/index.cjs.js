'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginCatalogBackendModuleGithub = require('@backstage/plugin-catalog-backend-module-github');

const dynamicPluginInstaller = {
  kind: "legacy",
  async catalog(builder, env) {
    builder.addEntityProvider(
      pluginCatalogBackendModuleGithub.GithubEntityProvider.fromConfig(env.config, {
        logger: env.logger,
        scheduler: env.scheduler
      })
    );
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
