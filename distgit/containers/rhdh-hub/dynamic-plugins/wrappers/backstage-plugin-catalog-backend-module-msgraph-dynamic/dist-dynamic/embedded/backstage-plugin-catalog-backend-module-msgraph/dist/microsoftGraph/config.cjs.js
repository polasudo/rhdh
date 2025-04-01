'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var lodash = require('lodash');

const DEFAULT_PROVIDER_ID = "default";
const DEFAULT_TARGET = "https://graph.microsoft.com/v1.0";
function readMicrosoftGraphConfig(config) {
  const providers = [];
  const providerConfigs = config.getOptionalConfigArray("providers") ?? [];
  for (const providerConfig of providerConfigs) {
    const target = lodash.trimEnd(
      providerConfig.getOptionalString("target") ?? DEFAULT_TARGET,
      "/"
    );
    const authority = providerConfig.getOptionalString("authority");
    const tenantId = providerConfig.getString("tenantId");
    const clientId = providerConfig.getOptionalString("clientId");
    const clientSecret = providerConfig.getOptionalString("clientSecret");
    const userExpand = providerConfig.getOptionalString("userExpand");
    const userFilter = providerConfig.getOptionalString("userFilter");
    const userSelect = providerConfig.getOptionalStringArray("userSelect");
    const userGroupMemberFilter = providerConfig.getOptionalString(
      "userGroupMemberFilter"
    );
    const userGroupMemberSearch = providerConfig.getOptionalString(
      "userGroupMemberSearch"
    );
    const groupExpand = providerConfig.getOptionalString("groupExpand");
    const groupFilter = providerConfig.getOptionalString("groupFilter");
    const groupSearch = providerConfig.getOptionalString("groupSearch");
    if (userFilter && userGroupMemberFilter) {
      throw new Error(
        `userFilter and userGroupMemberFilter are mutually exclusive, only one can be specified.`
      );
    }
    if (userFilter && userGroupMemberSearch) {
      throw new Error(
        `userGroupMemberSearch cannot be specified when userFilter is defined.`
      );
    }
    const groupSelect = providerConfig.getOptionalStringArray("groupSelect");
    const queryMode = providerConfig.getOptionalString("queryMode");
    if (queryMode !== void 0 && queryMode !== "basic" && queryMode !== "advanced") {
      throw new Error(`queryMode must be one of: basic, advanced`);
    }
    if (clientId && !clientSecret) {
      throw new Error(
        `clientSecret must be provided when clientId is defined.`
      );
    }
    if (clientSecret && !clientId) {
      throw new Error(
        `clientId must be provided when clientSecret is defined.`
      );
    }
    providers.push({
      id: target,
      target,
      authority,
      tenantId,
      clientId,
      clientSecret,
      userExpand,
      userFilter,
      userSelect,
      userGroupMemberFilter,
      userGroupMemberSearch,
      groupExpand,
      groupFilter,
      groupSearch,
      groupSelect,
      queryMode
    });
  }
  return providers;
}
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.microsoftGraphOrg"
  );
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("clientId")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  const target = lodash.trimEnd(
    config.getOptionalString("target") ?? DEFAULT_TARGET,
    "/"
  );
  const authority = config.getOptionalString("authority");
  const tenantId = config.getString("tenantId");
  const clientId = config.getOptionalString("clientId");
  const clientSecret = config.getOptionalString("clientSecret");
  const userExpand = config.getOptionalString("user.expand");
  const userFilter = config.getOptionalString("user.filter");
  const userSelect = config.getOptionalStringArray("user.select");
  const loadUserPhotos = config.getOptionalBoolean("user.loadPhotos");
  const groupExpand = config.getOptionalString("group.expand");
  const groupFilter = config.getOptionalString("group.filter");
  const groupSearch = config.getOptionalString("group.search");
  const groupSelect = config.getOptionalStringArray("group.select");
  const groupIncludeSubGroups = config.getOptionalBoolean(
    "group.includeSubGroups"
  );
  const queryMode = config.getOptionalString("queryMode");
  if (queryMode !== void 0 && queryMode !== "basic" && queryMode !== "advanced") {
    throw new Error(`queryMode must be one of: basic, advanced`);
  }
  const userGroupMemberFilter = config.getOptionalString(
    "userGroupMember.filter"
  );
  const userGroupMemberSearch = config.getOptionalString(
    "userGroupMember.search"
  );
  if (userFilter && userGroupMemberFilter) {
    throw new Error(
      `userFilter and userGroupMemberFilter are mutually exclusive, only one can be specified.`
    );
  }
  if (userFilter && userGroupMemberSearch) {
    throw new Error(
      `userGroupMemberSearch cannot be specified when userFilter is defined.`
    );
  }
  if (clientId && !clientSecret) {
    throw new Error(`clientSecret must be provided when clientId is defined.`);
  }
  if (clientSecret && !clientId) {
    throw new Error(`clientId must be provided when clientSecret is defined.`);
  }
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    target,
    authority,
    clientId,
    clientSecret,
    tenantId,
    userExpand,
    userFilter,
    userSelect,
    loadUserPhotos,
    groupExpand,
    groupFilter,
    groupSearch,
    groupSelect,
    groupIncludeSubGroups,
    queryMode,
    userGroupMemberFilter,
    userGroupMemberSearch,
    schedule
  };
}

exports.readMicrosoftGraphConfig = readMicrosoftGraphConfig;
exports.readProviderConfig = readProviderConfig;
exports.readProviderConfigs = readProviderConfigs;
//# sourceMappingURL=config.cjs.js.map
