'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

const DEFAULT_CATALOG_PATH = "/catalog-info.yaml";
const DEFAULT_PROVIDER_ID = "default";
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.bitbucketServer"
  );
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("host")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  const host = config.getString("host");
  const catalogPath = config.getOptionalString("catalogPath") ?? DEFAULT_CATALOG_PATH;
  const projectKeyPattern = config.getOptionalString("filters.projectKey");
  const repoSlugPattern = config.getOptionalString("filters.repoSlug");
  const skipArchivedReposFlag = config.getOptionalBoolean(
    "filters.skipArchivedRepos"
  );
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    host,
    catalogPath,
    filters: {
      projectKey: projectKeyPattern ? new RegExp(projectKeyPattern) : void 0,
      repoSlug: repoSlugPattern ? new RegExp(repoSlugPattern) : void 0,
      skipArchivedRepos: skipArchivedReposFlag
    },
    schedule
  };
}

exports.readProviderConfigs = readProviderConfigs;
//# sourceMappingURL=BitbucketServerEntityProviderConfig.cjs.js.map
