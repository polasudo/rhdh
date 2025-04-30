'use strict';

function updateOpenAPIConfig(OpenAPI, config) {
  OpenAPI.BASE = config.getString("servicenow.baseUrl");
  OpenAPI.USERNAME = config.getString("servicenow.username");
  OpenAPI.PASSWORD = config.getString("servicenow.password");
}

exports.updateOpenAPIConfig = updateOpenAPIConfig;
//# sourceMappingURL=helpers.cjs.js.map
