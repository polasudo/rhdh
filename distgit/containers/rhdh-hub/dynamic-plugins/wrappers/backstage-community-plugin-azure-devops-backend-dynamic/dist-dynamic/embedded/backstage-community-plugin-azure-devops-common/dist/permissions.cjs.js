'use strict';

var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var alpha = require('@backstage/plugin-catalog-common/alpha');

const azureDevOpsPullRequestReadPermission = pluginPermissionCommon.createPermission({
  name: "azure.devops.pullrequest.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPullRequestDashboardReadPermission = pluginPermissionCommon.createPermission({
  name: "azure.devops.pullrequest.dashboard.read",
  attributes: { action: "read" }
});
const azureDevOpsPipelineReadPermission = pluginPermissionCommon.createPermission({
  name: "azure.devops.pipeline.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsGitTagReadPermission = pluginPermissionCommon.createPermission({
  name: "azure.devops.gittag.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsReadmeReadPermission = pluginPermissionCommon.createPermission({
  name: "azure.devops.readme.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPermissions = [
  azureDevOpsPullRequestReadPermission,
  azureDevOpsPipelineReadPermission,
  azureDevOpsGitTagReadPermission,
  azureDevOpsReadmeReadPermission,
  azureDevOpsPullRequestDashboardReadPermission
];

exports.azureDevOpsGitTagReadPermission = azureDevOpsGitTagReadPermission;
exports.azureDevOpsPermissions = azureDevOpsPermissions;
exports.azureDevOpsPipelineReadPermission = azureDevOpsPipelineReadPermission;
exports.azureDevOpsPullRequestDashboardReadPermission = azureDevOpsPullRequestDashboardReadPermission;
exports.azureDevOpsPullRequestReadPermission = azureDevOpsPullRequestReadPermission;
exports.azureDevOpsReadmeReadPermission = azureDevOpsReadmeReadPermission;
//# sourceMappingURL=permissions.cjs.js.map
