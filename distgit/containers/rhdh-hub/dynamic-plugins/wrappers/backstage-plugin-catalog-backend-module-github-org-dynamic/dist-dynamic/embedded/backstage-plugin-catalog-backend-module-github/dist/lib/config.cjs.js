'use strict';

function readGithubMultiOrgConfig(config) {
  const orgConfigs = config.getOptionalConfigArray("orgs") ?? [];
  return orgConfigs.map((c) => ({
    name: c.getString("name"),
    groupNamespace: (c.getOptionalString("groupNamespace") ?? c.getString("name")).toLowerCase(),
    userNamespace: c.getOptionalString("userNamespace") ?? void 0
  }));
}

exports.readGithubMultiOrgConfig = readGithubMultiOrgConfig;
//# sourceMappingURL=config.cjs.js.map
