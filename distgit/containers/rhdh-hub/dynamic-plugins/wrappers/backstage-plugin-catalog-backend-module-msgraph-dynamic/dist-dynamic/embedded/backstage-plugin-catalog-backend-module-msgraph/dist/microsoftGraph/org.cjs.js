'use strict';

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
function buildMemberOf(groups, users) {
  const groupsByName = new Map(groups.map((g) => [g.metadata.name, g]));
  users.forEach((user) => {
    const transitiveMemberOf = /* @__PURE__ */ new Set();
    const todo = [
      ...user.spec.memberOf ?? [],
      ...groups.filter((g) => g.spec.members?.includes(user.metadata.name)).map((g) => g.metadata.name)
    ];
    for (; ; ) {
      const current = todo.pop();
      if (!current) {
        break;
      }
      if (!transitiveMemberOf.has(current)) {
        transitiveMemberOf.add(current);
        const group = groupsByName.get(current);
        if (group?.spec.parent) {
          todo.push(group.spec.parent);
        }
      }
    }
    user.spec.memberOf = [...transitiveMemberOf];
  });
}

exports.buildMemberOf = buildMemberOf;
exports.buildOrgHierarchy = buildOrgHierarchy;
//# sourceMappingURL=org.cjs.js.map
