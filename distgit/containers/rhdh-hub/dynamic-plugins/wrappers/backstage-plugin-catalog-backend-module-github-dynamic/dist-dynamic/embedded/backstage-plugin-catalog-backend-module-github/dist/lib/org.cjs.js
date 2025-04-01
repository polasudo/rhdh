'use strict';

var catalogModel = require('@backstage/catalog-model');

function buildOrgHierarchy(groups) {
  const groupsByName = new Map(groups.map((g) => [g.metadata.name, g]));
  for (const group of groups) {
    const selfName = group.metadata.name;
    const parentName = group.spec.parent;
    if (parentName) {
      const parent = groupsByName.get(parentName);
      if (parent && !parent.spec.children.includes(selfName)) {
        parent.spec.children.push(selfName);
      }
    }
  }
  for (const group of groups) {
    const selfName = group.metadata.name;
    for (const childName of group.spec.children) {
      const child = groupsByName.get(childName);
      if (child && !child.spec.parent) {
        child.spec.parent = selfName;
      }
    }
  }
}
function assignGroupsToUsers(users, groups) {
  const groupMemberUsers = new Map(
    groups.map((group) => {
      const groupKey = group.metadata.namespace && group.metadata.namespace !== catalogModel.DEFAULT_NAMESPACE ? `${group.metadata.namespace}/${group.metadata.name}` : group.metadata.name;
      return [
        groupKey,
        group.spec.members?.map(
          (m) => catalogModel.stringifyEntityRef(catalogModel.parseEntityRef(m, { defaultKind: "user" }))
        ) || []
      ];
    })
  );
  const usersByRef = new Map(users.map((u) => [catalogModel.stringifyEntityRef(u), u]));
  for (const [groupName, userRefs] of groupMemberUsers.entries()) {
    for (const ref of userRefs) {
      const user = usersByRef.get(ref);
      if (user && !user.spec.memberOf?.includes(groupName)) {
        if (!user.spec.memberOf) {
          user.spec.memberOf = [];
        }
        user.spec.memberOf.push(groupName);
      }
    }
  }
}

exports.assignGroupsToUsers = assignGroupsToUsers;
exports.buildOrgHierarchy = buildOrgHierarchy;
//# sourceMappingURL=org.cjs.js.map
