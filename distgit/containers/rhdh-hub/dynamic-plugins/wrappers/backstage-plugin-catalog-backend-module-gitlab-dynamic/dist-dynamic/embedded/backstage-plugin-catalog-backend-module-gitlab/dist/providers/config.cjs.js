'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

function readGitlabConfig(id, config) {
  const group = config.getOptionalString("group") ?? "";
  const host = config.getString("host");
  const branch = config.getOptionalString("branch");
  const fallbackBranch = config.getOptionalString("fallbackBranch") ?? "master";
  const catalogFile = config.getOptionalString("entityFilename") ?? "catalog-info.yaml";
  const projectPattern = new RegExp(
    config.getOptionalString("projectPattern") ?? /[\s\S]*/
  );
  const userPattern = new RegExp(
    config.getOptionalString("userPattern") ?? /[\s\S]*/
  );
  const groupPattern = new RegExp(
    config.getOptionalString("groupPattern") ?? /[\s\S]*/
  );
  const orgEnabled = config.getOptionalBoolean("orgEnabled") ?? false;
  const allowInherited = config.getOptionalBoolean("allowInherited") ?? false;
  const relations = config.getOptionalStringArray("relations") ?? [];
  const skipForkedRepos = config.getOptionalBoolean("skipForkedRepos") ?? false;
  const excludeRepos = config.getOptionalStringArray("excludeRepos") ?? [];
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  const restrictUsersToGroup = config.getOptionalBoolean("restrictUsersToGroup") ?? false;
  const includeUsersWithoutSeat = config.getOptionalBoolean("includeUsersWithoutSeat") ?? false;
  return {
    id,
    group,
    branch,
    fallbackBranch,
    host,
    catalogFile,
    projectPattern,
    userPattern,
    groupPattern,
    schedule,
    orgEnabled,
    allowInherited,
    relations,
    skipForkedRepos,
    excludeRepos,
    restrictUsersToGroup,
    includeUsersWithoutSeat
  };
}
function readGitlabConfigs(config) {
  const configs = [];
  const providerConfigs = config.getOptionalConfig("catalog.providers.gitlab");
  if (!providerConfigs) {
    return configs;
  }
  for (const id of providerConfigs.keys()) {
    configs.push(readGitlabConfig(id, providerConfigs.getConfig(id)));
  }
  return configs;
}

exports.readGitlabConfigs = readGitlabConfigs;
//# sourceMappingURL=config.cjs.js.map
