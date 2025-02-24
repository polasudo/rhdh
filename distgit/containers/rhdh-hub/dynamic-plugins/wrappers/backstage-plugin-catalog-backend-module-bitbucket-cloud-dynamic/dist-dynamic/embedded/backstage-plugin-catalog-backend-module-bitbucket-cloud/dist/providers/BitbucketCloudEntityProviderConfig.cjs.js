'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

const DEFAULT_CATALOG_PATH = "/catalog-info.yaml";
const DEFAULT_PROVIDER_ID = "default";
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.bitbucketCloud"
  );
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("workspace")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  const workspace = config.getString("workspace");
  const catalogPath = config.getOptionalString("catalogPath") ?? DEFAULT_CATALOG_PATH;
  const projectKeyPattern = config.getOptionalString("filters.projectKey");
  const repoSlugPattern = config.getOptionalString("filters.repoSlug");
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    catalogPath,
    workspace,
    filters: {
      projectKey: projectKeyPattern ? compileRegExp(projectKeyPattern) : void 0,
      repoSlug: repoSlugPattern ? compileRegExp(repoSlugPattern) : void 0
    },
    schedule
  };
}
function compileRegExp(pattern) {
  let fullLinePattern = pattern;
  if (!fullLinePattern.startsWith("^")) {
    fullLinePattern = `^${fullLinePattern}`;
  }
  if (!fullLinePattern.endsWith("$")) {
    fullLinePattern = `${fullLinePattern}$`;
  }
  return new RegExp(fullLinePattern);
}

exports.readProviderConfigs = readProviderConfigs;
//# sourceMappingURL=BitbucketCloudEntityProviderConfig.cjs.js.map
