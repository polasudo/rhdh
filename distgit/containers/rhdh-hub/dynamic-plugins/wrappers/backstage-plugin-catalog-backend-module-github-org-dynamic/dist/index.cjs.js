'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginCatalogBackendModuleGithub = require('@backstage/plugin-catalog-backend-module-github');

const dynamicPluginInstaller = {
  kind: "legacy",
  async catalog(builder, env) {
    const providersConfig = env.config.getOptionalConfig(
      "catalog.providers.githubOrg"
    );
    providersConfig == null ? void 0 : providersConfig.keys().forEach((id) => {
      const githubOrgConfig = providersConfig == null ? void 0 : providersConfig.getConfig(id);
      const githubOrgId = githubOrgConfig.getString("id");
      const githubOrgUrl = githubOrgConfig.getString("orgUrl");
      builder.addEntityProvider(
        pluginCatalogBackendModuleGithub.GithubOrgEntityProvider.fromConfig(env.config, {
          id: githubOrgId,
          orgUrl: githubOrgUrl,
          logger: env.logger,
          // TODO (davidfestal): we don't have a schedule field here.
          // Its might be that this provider is be a bit old,
          // and should be replaced by GithubMultiOrgEntityProvider
          schedule: env.scheduler.createScheduledTaskRunner({
            frequency: { minutes: 60 },
            timeout: { minutes: 15 },
            initialDelay: { seconds: 15 }
          })
        })
      );
    });
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
