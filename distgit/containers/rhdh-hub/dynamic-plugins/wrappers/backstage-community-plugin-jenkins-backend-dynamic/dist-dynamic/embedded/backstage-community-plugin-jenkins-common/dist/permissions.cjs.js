'use strict';

var alpha = require('@backstage/plugin-catalog-common/alpha');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');

const jenkinsExecutePermission = pluginPermissionCommon.createPermission({
  name: "jenkins.execute",
  attributes: {
    action: "update"
  },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const jenkinsPermissions = [jenkinsExecutePermission];

exports.jenkinsExecutePermission = jenkinsExecutePermission;
exports.jenkinsPermissions = jenkinsPermissions;
//# sourceMappingURL=permissions.cjs.js.map
