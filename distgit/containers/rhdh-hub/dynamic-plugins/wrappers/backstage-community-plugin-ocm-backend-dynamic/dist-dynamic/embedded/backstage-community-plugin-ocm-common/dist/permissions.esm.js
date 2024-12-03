import { createPermission } from '@backstage/plugin-permission-common';

const ocmClusterReadPermission = createPermission({
  name: "ocm.cluster.read",
  attributes: {
    action: "read"
  }
});
const ocmEntityReadPermission = createPermission({
  name: "ocm.entity.read",
  attributes: {
    action: "read"
  }
});
const ocmEntityPermissions = [
  ocmClusterReadPermission,
  ocmEntityReadPermission
];

export { ocmClusterReadPermission, ocmEntityPermissions, ocmEntityReadPermission };
//# sourceMappingURL=permissions.esm.js.map
