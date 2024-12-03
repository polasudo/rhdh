'use strict';

var errors = require('@backstage/errors');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var backstagePluginBulkImportCommon = require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var auditLogUtils = require('./auditLogUtils.cjs.js');

async function permissionCheck(auditLogger, openApiOperationId, permissions, httpAuth, req) {
  const decision = (await permissions.authorize(
    [
      {
        permission: backstagePluginBulkImportCommon.bulkImportPermission,
        resourceRef: backstagePluginBulkImportCommon.bulkImportPermission.resourceType
      }
    ],
    {
      credentials: await httpAuth.credentials(req)
    }
  ))[0];
  if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
    const err = new errors.NotAllowedError("Unauthorized");
    auditLogUtils.auditLogAuthError(auditLogger, openApiOperationId, req, err);
    throw err;
  }
}
async function getTokenForPlugin(auth, targetPluginId) {
  const resp = await auth.getPluginRequestToken({
    onBehalfOf: await auth.getOwnServiceCredentials(),
    targetPluginId
  });
  return resp.token;
}

exports.getTokenForPlugin = getTokenForPlugin;
exports.permissionCheck = permissionCheck;
//# sourceMappingURL=auth.cjs.js.map
