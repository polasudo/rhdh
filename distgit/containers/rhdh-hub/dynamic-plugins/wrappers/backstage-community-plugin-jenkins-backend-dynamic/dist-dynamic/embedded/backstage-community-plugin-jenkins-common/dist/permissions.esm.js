import { RESOURCE_TYPE_CATALOG_ENTITY } from '@backstage/plugin-catalog-common/alpha';
import { createPermission } from '@backstage/plugin-permission-common';

const jenkinsExecutePermission = createPermission({
  name: "jenkins.execute",
  attributes: {
    action: "update"
  },
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY
});
const jenkinsPermissions = [jenkinsExecutePermission];

export { jenkinsExecutePermission, jenkinsPermissions };
//# sourceMappingURL=permissions.esm.js.map
