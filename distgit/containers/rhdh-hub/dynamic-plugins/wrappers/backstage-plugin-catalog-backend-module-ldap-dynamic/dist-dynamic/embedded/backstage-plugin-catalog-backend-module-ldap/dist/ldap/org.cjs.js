'use strict';

var catalogModel = require('@backstage/catalog-model');

function buildOrgHierarchy(groups) {
  const groupsByRef = new Map(groups.map((g) => [catalogModel.stringifyEntityRef(g), g]));
  for (const group of groups) {
    const selfRef = catalogModel.stringifyEntityRef(group);
    const parentRef = group.spec.parent;
    if (parentRef) {
      const parent = groupsByRef.get(parentRef);
      if (parent && !parent.spec.children.includes(selfRef)) {
        parent.spec.children.push(selfRef);
      }
    }
  }
  for (const group of groups) {
    const selfRef = catalogModel.stringifyEntityRef(group);
    for (const childRef of group.spec.children) {
      const child = groupsByRef.get(childRef);
      if (child && !child.spec.parent) {
        child.spec.parent = selfRef;
      }
    }
  }
}

exports.buildOrgHierarchy = buildOrgHierarchy;
//# sourceMappingURL=org.cjs.js.map
