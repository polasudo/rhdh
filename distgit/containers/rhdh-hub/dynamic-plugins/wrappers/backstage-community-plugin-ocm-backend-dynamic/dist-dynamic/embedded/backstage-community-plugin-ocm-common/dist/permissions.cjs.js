'use strict';

var pluginPermissionCommon = require('@backstage/plugin-permission-common');

const ocmClusterReadPermission = pluginPermissionCommon.createPermission({
  name: "ocm.cluster.read",
  attributes: {
    action: "read"
  }
});
const ocmEntityReadPermission = pluginPermissionCommon.createPermission({
  name: "ocm.entity.read",
  attributes: {
    action: "read"
  }
});
const ocmEntityPermissions = [
  ocmClusterReadPermission,
  ocmEntityReadPermission
];

exports.ocmClusterReadPermission = ocmClusterReadPermission;
exports.ocmEntityPermissions = ocmEntityPermissions;
exports.ocmEntityReadPermission = ocmEntityReadPermission;
//# sourceMappingURL=permissions.cjs.js.map
