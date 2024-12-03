'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');

function readThreeScaleApiEntityConfigs(config) {
  const providerConfigs = config.getOptionalConfig(
    "catalog.providers.threeScaleApiEntity"
  );
  if (!providerConfigs) {
    return [];
  }
  return providerConfigs.keys().map(
    (id) => readThreeScaleApiEntityConfig(id, providerConfigs.getConfig(id))
  );
}
function readThreeScaleApiEntityConfig(id, config) {
  const baseUrl = config.getString("baseUrl");
  const accessToken = config.getString("accessToken");
  const systemLabel = config.getOptionalString("systemLabel");
  const ownerLabel = config.getOptionalString("ownerLabel");
  const addLabels = config.getOptionalBoolean("addLabels") || true;
  const schedule = config.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    baseUrl,
    accessToken,
    systemLabel,
    ownerLabel,
    addLabels,
    schedule
  };
}

exports.readThreeScaleApiEntityConfigs = readThreeScaleApiEntityConfigs;
//# sourceMappingURL=config.cjs.js.map
