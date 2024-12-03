'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

function readAapApiEntityConfigs(config) {
  const providerConfigs = config.getOptionalConfig("catalog.providers.aap");
  if (!providerConfigs) {
    return [];
  }
  return providerConfigs.keys().map((id) => readAapApiEntityConfig(id, providerConfigs.getConfig(id)));
}
function readAapApiEntityConfig(id, config) {
  const baseUrl = config.getString("baseUrl");
  const authorization = config.getString("authorization");
  const system = config.getOptionalString("system");
  const owner = config.getOptionalString("owner") ?? "unknown";
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    baseUrl,
    authorization,
    system,
    owner,
    schedule
  };
}

exports.readAapApiEntityConfigs = readAapApiEntityConfigs;
//# sourceMappingURL=config.cjs.js.map
