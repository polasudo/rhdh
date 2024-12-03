'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

const DEFAULT_CATALOG_PATH = "/catalog-info.yaml";
const DEFAULT_PROVIDER_ID = "default";
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig("catalog.providers.github");
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("organization")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  const organization = config.getString("organization");
  const catalogPath = config.getOptionalString("catalogPath") ?? DEFAULT_CATALOG_PATH;
  const host = config.getOptionalString("host") ?? "github.com";
  const repositoryPattern = config.getOptionalString("filters.repository");
  const branchPattern = config.getOptionalString("filters.branch");
  const allowForks = config.getOptionalBoolean("filters.allowForks") ?? true;
  const topicFilterInclude = config?.getOptionalStringArray(
    "filters.topic.include"
  );
  const topicFilterExclude = config?.getOptionalStringArray(
    "filters.topic.exclude"
  );
  const validateLocationsExist = config?.getOptionalBoolean("validateLocationsExist") ?? false;
  const catalogPathContainsWildcard = catalogPath.includes("*");
  const visibilityFilterInclude = config?.getOptionalStringArray("filters.visibility");
  if (validateLocationsExist && catalogPathContainsWildcard) {
    throw Error(
      `Error while processing GitHub provider config. The catalog path ${catalogPath} contains a wildcard, which is incompatible with validation of locations existing before emitting them. Ensure that validateLocationsExist is set to false.`
    );
  }
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    catalogPath,
    organization,
    host,
    filters: {
      repository: repositoryPattern ? compileRegExp(repositoryPattern) : void 0,
      branch: branchPattern || void 0,
      allowForks,
      topic: {
        include: topicFilterInclude,
        exclude: topicFilterExclude
      },
      visibility: visibilityFilterInclude
    },
    schedule,
    validateLocationsExist
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
//# sourceMappingURL=GithubEntityProviderConfig.cjs.js.map
