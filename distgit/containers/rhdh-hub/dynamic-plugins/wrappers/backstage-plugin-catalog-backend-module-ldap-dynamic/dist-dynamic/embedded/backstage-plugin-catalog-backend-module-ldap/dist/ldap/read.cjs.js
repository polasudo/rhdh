'use strict';

var catalogModel = require('@backstage/catalog-model');
var lodashSet = require('lodash/set');
var cloneDeep = require('lodash/cloneDeep');
var org = require('./org.cjs.js');
var constants = require('./constants.cjs.js');
var util = require('./util.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var lodashSet__default = /*#__PURE__*/_interopDefaultCompat(lodashSet);
var cloneDeep__default = /*#__PURE__*/_interopDefaultCompat(cloneDeep);

async function defaultUserTransformer(vendor, config, entry) {
  const { set, map } = config;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "User",
    metadata: {
      name: "",
      annotations: {}
    },
    spec: {
      profile: {},
      memberOf: []
    }
  };
  if (set) {
    for (const [path, value] of Object.entries(set)) {
      lodashSet__default.default(entity, path, cloneDeep__default.default(value));
    }
  }
  util.mapStringAttr(entry, vendor, map.name, (v) => {
    entity.metadata.name = v;
  });
  util.mapStringAttr(entry, vendor, map.description, (v) => {
    entity.metadata.description = v;
  });
  util.mapStringAttr(entry, vendor, map.rdn, (v) => {
    entity.metadata.annotations[constants.LDAP_RDN_ANNOTATION] = v;
  });
  util.mapStringAttr(entry, vendor, vendor.uuidAttributeName, (v) => {
    entity.metadata.annotations[constants.LDAP_UUID_ANNOTATION] = v;
  });
  util.mapStringAttr(entry, vendor, vendor.dnAttributeName, (v) => {
    entity.metadata.annotations[constants.LDAP_DN_ANNOTATION] = v;
  });
  util.mapStringAttr(entry, vendor, map.displayName, (v) => {
    entity.spec.profile.displayName = v;
  });
  util.mapStringAttr(entry, vendor, map.email, (v) => {
    entity.spec.profile.email = v;
  });
  util.mapStringAttr(entry, vendor, map.picture, (v) => {
    entity.spec.profile.picture = v;
  });
  return entity;
}
async function readLdapUsers(client, userConfig, vendorConfig, opts) {
  if (userConfig.length === 0) {
    return { users: [], userMemberOf: /* @__PURE__ */ new Map() };
  }
  const entities = [];
  const userMemberOf = /* @__PURE__ */ new Map();
  const vendorDefaults = await client.getVendor();
  const vendor = {
    dnAttributeName: vendorConfig?.dnAttributeName ?? vendorDefaults.dnAttributeName,
    uuidAttributeName: vendorConfig?.uuidAttributeName ?? vendorDefaults.uuidAttributeName,
    decodeStringAttribute: vendorDefaults.decodeStringAttribute
  };
  const transformer = opts?.transformer ?? defaultUserTransformer;
  for (const cfg of userConfig) {
    const { dn, options, map } = cfg;
    await client.searchStreaming(dn, options, async (user) => {
      const entity = await transformer(vendor, cfg, user);
      if (!entity) {
        return;
      }
      mapReferencesAttr(user, vendor, map.memberOf, (myDn, vs) => {
        ensureItems(userMemberOf, myDn, vs);
      });
      entities.push(entity);
    });
  }
  return { users: entities, userMemberOf };
}
async function defaultGroupTransformer(vendor, config, entry) {
  const { set, map } = config;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "Group",
    metadata: {
      name: "",
      annotations: {}
    },
    spec: {
      type: "unknown",
      profile: {},
      children: []
    }
  };
  if (set) {
    for (const [path, value] of Object.entries(set)) {
      lodashSet__default.default(entity, path, cloneDeep__default.default(value));
    }
  }
  util.mapStringAttr(entry, vendor, map.name, (v) => {
    entity.metadata.name = v;
  });
  util.mapStringAttr(entry, vendor, map.description, (v) => {
    entity.metadata.description = v;
  });
  util.mapStringAttr(entry, vendor, map.rdn, (v) => {
    entity.metadata.annotations[constants.LDAP_RDN_ANNOTATION] = v;
  });
  util.mapStringAttr(entry, vendor, vendor.uuidAttributeName, (v) => {
    entity.metadata.annotations[constants.LDAP_UUID_ANNOTATION] = v;
  });
  util.mapStringAttr(entry, vendor, vendor.dnAttributeName, (v) => {
    entity.metadata.annotations[constants.LDAP_DN_ANNOTATION] = v;
  });
  util.mapStringAttr(entry, vendor, map.type, (v) => {
    entity.spec.type = v;
  });
  util.mapStringAttr(entry, vendor, map.displayName, (v) => {
    entity.spec.profile.displayName = v;
  });
  util.mapStringAttr(entry, vendor, map.email, (v) => {
    entity.spec.profile.email = v;
  });
  util.mapStringAttr(entry, vendor, map.picture, (v) => {
    entity.spec.profile.picture = v;
  });
  return entity;
}
async function readLdapGroups(client, groupConfig, vendorConfig, opts) {
  if (groupConfig.length === 0) {
    return { groups: [], groupMemberOf: /* @__PURE__ */ new Map(), groupMember: /* @__PURE__ */ new Map() };
  }
  const groups = [];
  const groupMemberOf = /* @__PURE__ */ new Map();
  const groupMember = /* @__PURE__ */ new Map();
  const vendorDefaults = await client.getVendor();
  const vendor = {
    dnAttributeName: vendorConfig?.dnAttributeName ?? vendorDefaults.dnAttributeName,
    uuidAttributeName: vendorConfig?.uuidAttributeName ?? vendorDefaults.uuidAttributeName,
    decodeStringAttribute: vendorDefaults.decodeStringAttribute
  };
  const transformer = opts?.transformer ?? defaultGroupTransformer;
  for (const cfg of groupConfig) {
    const { dn, map, options } = cfg;
    await client.searchStreaming(dn, options, async (entry) => {
      if (!entry) {
        return;
      }
      const entity = await transformer(vendor, cfg, entry);
      if (!entity) {
        return;
      }
      mapReferencesAttr(entry, vendor, map.memberOf, (myDn, vs) => {
        ensureItems(groupMemberOf, myDn, vs);
      });
      mapReferencesAttr(entry, vendor, map.members, (myDn, vs) => {
        ensureItems(groupMember, myDn, vs);
      });
      groups.push(entity);
    });
  }
  return {
    groups,
    groupMemberOf,
    groupMember
  };
}
async function readLdapOrg(client, userConfig, groupConfig, vendorConfig, options) {
  const { users, userMemberOf } = await readLdapUsers(
    client,
    userConfig,
    vendorConfig,
    {
      transformer: options?.userTransformer
    }
  );
  const { groups, groupMemberOf, groupMember } = await readLdapGroups(
    client,
    groupConfig,
    vendorConfig,
    { transformer: options?.groupTransformer }
  );
  resolveRelations(groups, users, userMemberOf, groupMemberOf, groupMember);
  users.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  groups.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  return { users, groups };
}
function mapReferencesAttr(entry, vendor, attributeName, setter) {
  if (attributeName) {
    const values = vendor.decodeStringAttribute(entry, attributeName);
    const dn = vendor.decodeStringAttribute(entry, vendor.dnAttributeName);
    if (values && dn && dn.length === 1) {
      setter(dn[0], values);
    }
  }
}
function ensureItems(target, key, values) {
  if (key) {
    let set = target.get(key);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      target.set(key, set);
    }
    for (const value of values) {
      if (value) {
        set.add(value);
      }
    }
  }
}
function resolveRelations(groups, users, userMemberOf, groupMemberOf, groupMember) {
  const userMap = /* @__PURE__ */ new Map();
  const groupMap = /* @__PURE__ */ new Map();
  for (const user of users) {
    userMap.set(catalogModel.stringifyEntityRef(user), user);
    userMap.set(user.metadata.annotations[constants.LDAP_DN_ANNOTATION], user);
    userMap.set(user.metadata.annotations[constants.LDAP_RDN_ANNOTATION], user);
    userMap.set(user.metadata.annotations[constants.LDAP_UUID_ANNOTATION], user);
  }
  for (const group of groups) {
    groupMap.set(catalogModel.stringifyEntityRef(group), group);
    groupMap.set(group.metadata.annotations[constants.LDAP_DN_ANNOTATION], group);
    groupMap.set(group.metadata.annotations[constants.LDAP_RDN_ANNOTATION], group);
    groupMap.set(group.metadata.annotations[constants.LDAP_UUID_ANNOTATION], group);
  }
  userMap.delete("");
  groupMap.delete("");
  userMap.delete(void 0);
  groupMap.delete(void 0);
  const newUserMemberOf = /* @__PURE__ */ new Map();
  const newGroupParents = /* @__PURE__ */ new Map();
  const newGroupChildren = /* @__PURE__ */ new Map();
  for (const [userN, groupsN] of userMemberOf.entries()) {
    const user = userMap.get(userN);
    if (user) {
      for (const groupN of groupsN) {
        const group = groupMap.get(groupN);
        if (group) {
          ensureItems(newUserMemberOf, catalogModel.stringifyEntityRef(user), [
            catalogModel.stringifyEntityRef(group)
          ]);
        }
      }
    }
  }
  for (const [groupN, parentsN] of groupMemberOf.entries()) {
    const group = groupMap.get(groupN);
    if (group) {
      for (const parentN of parentsN) {
        const parentGroup = groupMap.get(parentN);
        if (parentGroup) {
          ensureItems(newGroupParents, catalogModel.stringifyEntityRef(group), [
            catalogModel.stringifyEntityRef(parentGroup)
          ]);
          ensureItems(newGroupChildren, catalogModel.stringifyEntityRef(parentGroup), [
            catalogModel.stringifyEntityRef(group)
          ]);
        }
      }
    }
  }
  for (const [groupN, membersN] of groupMember.entries()) {
    const group = groupMap.get(groupN);
    if (group) {
      for (const memberN of membersN) {
        const memberUser = userMap.get(memberN);
        if (memberUser) {
          ensureItems(newUserMemberOf, catalogModel.stringifyEntityRef(memberUser), [
            catalogModel.stringifyEntityRef(group)
          ]);
        } else {
          const memberGroup = groupMap.get(memberN);
          if (memberGroup) {
            ensureItems(newGroupChildren, catalogModel.stringifyEntityRef(group), [
              catalogModel.stringifyEntityRef(memberGroup)
            ]);
            ensureItems(newGroupParents, catalogModel.stringifyEntityRef(memberGroup), [
              catalogModel.stringifyEntityRef(group)
            ]);
          }
        }
      }
    }
  }
  for (const [userN, groupsN] of newUserMemberOf.entries()) {
    const user = userMap.get(userN);
    if (user) {
      user.spec.memberOf = Array.from(groupsN).sort();
    }
  }
  for (const [groupN, parentsN] of newGroupParents.entries()) {
    if (parentsN.size === 1) {
      const group = groupMap.get(groupN);
      if (group) {
        group.spec.parent = parentsN.values().next().value;
      }
    }
  }
  for (const [groupN, childrenN] of newGroupChildren.entries()) {
    const group = groupMap.get(groupN);
    if (group) {
      group.spec.children = Array.from(childrenN).sort();
    }
  }
  org.buildOrgHierarchy(groups);
}

exports.defaultGroupTransformer = defaultGroupTransformer;
exports.defaultUserTransformer = defaultUserTransformer;
exports.readLdapGroups = readLdapGroups;
exports.readLdapOrg = readLdapOrg;
exports.readLdapUsers = readLdapUsers;
exports.resolveRelations = resolveRelations;
//# sourceMappingURL=read.cjs.js.map
