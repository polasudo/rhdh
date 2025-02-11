'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

const readProviderConfig = (id, providerConfigInstance) => {
  const apiPath = providerConfigInstance.getString("apiPath");
  const authPath = providerConfigInstance.getString("authPath");
  const envId = providerConfigInstance.getString("envId");
  const clientId = providerConfigInstance.getOptionalString("clientId");
  const clientSecret = providerConfigInstance.getOptionalString("clientSecret");
  const userQuerySize = providerConfigInstance.getOptionalNumber("userQuerySize");
  const groupQuerySize = providerConfigInstance.getOptionalNumber("groupQuerySize");
  if (clientId && !clientSecret) {
    throw new Error(`clientSecret must be provided when clientId is defined.`);
  }
  if (clientSecret && !clientId) {
    throw new Error(`clientId must be provided when clientSecret is defined.`);
  }
  const schedule = providerConfigInstance.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    providerConfigInstance.getConfig("schedule")
  ) : undefined;
  return {
    id,
    apiPath,
    authPath,
    envId,
    clientId,
    clientSecret,
    schedule,
    userQuerySize,
    groupQuerySize
  };
};
const readProviderConfigs = (config) => {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.pingIdentityOrg"
  );
  if (!providersConfig) {
    return [];
  }
  return providersConfig.keys().map((id) => {
    const providerConfigInstance = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfigInstance);
  });
};

exports.readProviderConfigs = readProviderConfigs;
//# sourceMappingURL=config.cjs.js.map
