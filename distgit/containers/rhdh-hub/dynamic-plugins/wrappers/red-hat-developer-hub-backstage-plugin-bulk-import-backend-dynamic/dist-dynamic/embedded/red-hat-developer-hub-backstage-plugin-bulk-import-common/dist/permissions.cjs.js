'use strict';

var pluginPermissionCommon = require('@backstage/plugin-permission-common');

const bulkImportPermission = pluginPermissionCommon.createPermission({
  name: "bulk.import",
  attributes: {},
  resourceType: "bulk-import"
});

exports.bulkImportPermission = bulkImportPermission;
//# sourceMappingURL=permissions.cjs.js.map
