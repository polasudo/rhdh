import { createPermission } from '@backstage/plugin-permission-common';
import { RESOURCE_TYPE_CATALOG_ENTITY } from '@backstage/plugin-catalog-common/alpha';

const azureDevOpsPullRequestReadPermission = createPermission({
  name: "azure.devops.pullrequest.read",
  attributes: { action: "read" },
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPullRequestDashboardReadPermission = createPermission({
  name: "azure.devops.pullrequest.dashboard.read",
  attributes: { action: "read" }
});
const azureDevOpsPipelineReadPermission = createPermission({
  name: "azure.devops.pipeline.read",
  attributes: { action: "read" },
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsGitTagReadPermission = createPermission({
  name: "azure.devops.gittag.read",
  attributes: { action: "read" },
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsReadmeReadPermission = createPermission({
  name: "azure.devops.readme.read",
  attributes: { action: "read" },
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPermissions = [
  azureDevOpsPullRequestReadPermission,
  azureDevOpsPipelineReadPermission,
  azureDevOpsGitTagReadPermission,
  azureDevOpsReadmeReadPermission,
  azureDevOpsPullRequestDashboardReadPermission
];

export { azureDevOpsGitTagReadPermission, azureDevOpsPermissions, azureDevOpsPipelineReadPermission, azureDevOpsPullRequestDashboardReadPermission, azureDevOpsPullRequestReadPermission, azureDevOpsReadmeReadPermission };
//# sourceMappingURL=permissions.esm.js.map
