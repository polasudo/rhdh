'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginCatalogBackendModuleGitlab = require('@backstage/plugin-catalog-backend-module-gitlab');

const dynamicPluginInstaller = {
  kind: "legacy",
  async catalog(builder, env) {
    builder.addEntityProvider(
      ...pluginCatalogBackendModuleGitlab.GitlabDiscoveryEntityProvider.fromConfig(env.config, {
        logger: env.logger,
        scheduler: env.scheduler
      })
    );
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
