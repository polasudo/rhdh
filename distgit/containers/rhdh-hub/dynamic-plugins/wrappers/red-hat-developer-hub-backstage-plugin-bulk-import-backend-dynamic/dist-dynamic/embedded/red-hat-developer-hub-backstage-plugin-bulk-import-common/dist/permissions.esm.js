import { createPermission } from '@backstage/plugin-permission-common';

const bulkImportPermission = createPermission({
  name: "bulk.import",
  attributes: {},
  resourceType: "bulk-import"
});

export { bulkImportPermission };
//# sourceMappingURL=permissions.esm.js.map
