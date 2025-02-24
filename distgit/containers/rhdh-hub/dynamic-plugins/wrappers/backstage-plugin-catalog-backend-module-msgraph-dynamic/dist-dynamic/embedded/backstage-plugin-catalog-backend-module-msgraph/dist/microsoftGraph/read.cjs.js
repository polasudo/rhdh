'use strict';

var catalogModel = require('@backstage/catalog-model');
var limiterFactory = require('p-limit');
var constants = require('./constants.cjs.js');
var org = require('./org.cjs.js');
var defaultTransformers = require('./defaultTransformers.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var limiterFactory__default = /*#__PURE__*/_interopDefaultCompat(limiterFactory);

const PAGE_SIZE = 999;
async function readMicrosoftGraphUsers(client, options) {
  const users = client.getUsers(
    {
      filter: options.userFilter,
      expand: options.userExpand,
      select: options.userSelect,
      top: PAGE_SIZE
    },
    options.queryMode
  );
  return {
    users: await transformUsers(
      client,
      users,
      options.logger,
      options.loadUserPhotos,
      options.transformer
    )
  };
}
async function readMicrosoftGraphUsersInGroups(client, options) {
  const limiter = limiterFactory__default.default(10);
  const userGroupMemberPromises = [];
  const userGroupMembers = /* @__PURE__ */ new Map();
  for await (const group of client.getGroups(
    {
      expand: options.groupExpand,
      filter: options.userGroupMemberFilter,
      search: options.userGroupMemberSearch,
      select: ["id", "displayName"],
      top: PAGE_SIZE
    },
    options.queryMode
  )) {
    userGroupMemberPromises.push(
      limiter(async () => {
        let groupMemberCount = 0;
        for await (const user of client.getGroupUserMembers(
          group.id,
          {
            expand: options.userExpand,
            filter: options.userFilter,
            select: options.userSelect,
            top: PAGE_SIZE
          },
          options.queryMode
        )) {
          userGroupMembers.set(user.id, user);
          groupMemberCount++;
        }
        options.logger.debug("Read users from group", {
          groupId: group.id,
          groupName: group.displayName,
          memberCount: groupMemberCount
        });
      })
    );
  }
  await Promise.all(userGroupMemberPromises);
  options.logger.info("Read users from group membership", {
    groupCount: userGroupMemberPromises.length,
    userCount: userGroupMembers.size
  });
  return {
    users: await transformUsers(
      client,
      userGroupMembers.values(),
      options.logger,
      options.loadUserPhotos,
      options.transformer
    )
  };
}
async function readMicrosoftGraphOrganization(client, tenantId, options) {
  const organization = await client.getOrganization(tenantId);
  const transformer = options?.transformer ?? defaultTransformers.defaultOrganizationTransformer;
  const rootGroup = await transformer(organization);
  return { rootGroup };
}
async function readMicrosoftGraphGroups(client, tenantId, options) {
  const groups = [];
  const groupMember = /* @__PURE__ */ new Map();
  const groupMemberOf = /* @__PURE__ */ new Map();
  const limiter = limiterFactory__default.default(10);
  const { rootGroup } = await readMicrosoftGraphOrganization(client, tenantId, {
    transformer: options?.organizationTransformer
  });
  if (rootGroup) {
    groupMember.set(rootGroup.metadata.name, /* @__PURE__ */ new Set());
    groups.push(rootGroup);
  }
  const transformer = options?.groupTransformer ?? defaultTransformers.defaultGroupTransformer;
  const promises = [];
  for await (const group of client.getGroups(
    {
      expand: options?.groupExpand,
      filter: options?.groupFilter,
      search: options?.groupSearch,
      select: options?.groupSelect,
      top: PAGE_SIZE
    },
    options?.queryMode
  )) {
    promises.push(
      limiter(async () => {
        const entity = await transformer(
          group
          /* , groupPhoto*/
        );
        if (!entity) {
          return;
        }
        for await (const member of client.getGroupMembers(group.id, {
          top: PAGE_SIZE
        })) {
          if (!member.id) {
            continue;
          }
          if (member["@odata.type"] === "#microsoft.graph.user") {
            ensureItem(groupMemberOf, member.id, group.id);
          }
          if (member["@odata.type"] === "#microsoft.graph.group") {
            ensureItem(groupMember, group.id, member.id);
            if (options?.groupIncludeSubGroups) {
              const groupMemberEntity = await transformer(member);
              if (groupMemberEntity) {
                groups.push(groupMemberEntity);
                for await (const subMember of client.getGroupMembers(
                  member.id,
                  { top: PAGE_SIZE }
                )) {
                  if (!subMember.id) {
                    continue;
                  }
                  if (subMember["@odata.type"] === "#microsoft.graph.user") {
                    ensureItem(groupMemberOf, subMember.id, member.id);
                  }
                  if (subMember["@odata.type"] === "#microsoft.graph.group") {
                    ensureItem(groupMember, member.id, subMember.id);
                  }
                }
              }
            }
          }
        }
        groups.push(entity);
      })
    );
  }
  await Promise.all(promises);
  return {
    groups,
    rootGroup,
    groupMember,
    groupMemberOf
  };
}
function resolveRelations(rootGroup, groups, users, groupMember, groupMemberOf) {
  const groupMap = /* @__PURE__ */ new Map();
  for (const group of groups) {
    if (group.metadata.annotations[constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION]) {
      groupMap.set(
        group.metadata.annotations[constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION],
        group
      );
    }
    if (group.metadata.annotations[constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION]) {
      groupMap.set(
        group.metadata.annotations[constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION],
        group
      );
    }
  }
  const parentGroups = /* @__PURE__ */ new Map();
  groupMember.forEach(
    (members, groupId) => members.forEach((m) => ensureItem(parentGroups, m, groupId))
  );
  if (rootGroup) {
    const tenantId = rootGroup.metadata.annotations[constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION];
    groups.forEach((group) => {
      const groupId = group.metadata.annotations[constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION];
      if (!groupId) {
        return;
      }
      if (retrieveItems(parentGroups, groupId).size === 0) {
        ensureItem(parentGroups, groupId, tenantId);
        ensureItem(groupMember, tenantId, groupId);
      }
    });
  }
  groups.forEach((group) => {
    const id = group.metadata.annotations[constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION] ?? group.metadata.annotations[constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION];
    retrieveItems(groupMember, id).forEach((m) => {
      const childGroup = groupMap.get(m);
      if (childGroup) {
        group.spec.children.push(catalogModel.stringifyEntityRef(childGroup));
      }
    });
    retrieveItems(parentGroups, id).forEach((p) => {
      const parentGroup = groupMap.get(p);
      if (parentGroup) {
        group.spec.parent = catalogModel.stringifyEntityRef(parentGroup);
      }
    });
  });
  org.buildOrgHierarchy(groups);
  users.forEach((user) => {
    const id = user.metadata.annotations[constants.MICROSOFT_GRAPH_USER_ID_ANNOTATION];
    retrieveItems(groupMemberOf, id).forEach((p) => {
      const parentGroup = groupMap.get(p);
      if (parentGroup) {
        if (!user.spec.memberOf) {
          user.spec.memberOf = [];
        }
        user.spec.memberOf.push(catalogModel.stringifyEntityRef(parentGroup));
      }
    });
  });
  org.buildMemberOf(groups, users);
}
async function readMicrosoftGraphOrg(client, tenantId, options) {
  let users = [];
  if (options.userGroupMemberFilter || options.userGroupMemberSearch) {
    const { users: usersInGroups } = await readMicrosoftGraphUsersInGroups(
      client,
      {
        queryMode: options.queryMode,
        userExpand: options.userExpand,
        userFilter: options.userFilter,
        userSelect: options.userSelect,
        userGroupMemberFilter: options.userGroupMemberFilter,
        userGroupMemberSearch: options.userGroupMemberSearch,
        loadUserPhotos: options.loadUserPhotos,
        transformer: options.userTransformer,
        logger: options.logger
      }
    );
    users = usersInGroups;
  } else {
    const { users: usersWithFilter } = await readMicrosoftGraphUsers(client, {
      queryMode: options.queryMode,
      userExpand: options.userExpand,
      userFilter: options.userFilter,
      userSelect: options.userSelect,
      loadUserPhotos: options.loadUserPhotos,
      transformer: options.userTransformer,
      logger: options.logger
    });
    users = usersWithFilter;
  }
  const { groups, rootGroup, groupMember, groupMemberOf } = await readMicrosoftGraphGroups(client, tenantId, {
    queryMode: options.queryMode,
    groupExpand: options.groupExpand,
    groupFilter: options.groupFilter,
    groupSearch: options.groupSearch,
    groupSelect: options.groupSelect,
    groupIncludeSubGroups: options.groupIncludeSubGroups,
    groupTransformer: options.groupTransformer,
    organizationTransformer: options.organizationTransformer
  });
  resolveRelations(rootGroup, groups, users, groupMember, groupMemberOf);
  users.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  groups.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  return { users, groups };
}
async function transformUsers(client, users, logger, loadUserPhotos = true, transformer) {
  const limiter = limiterFactory__default.default(10);
  const resolvedTransformer = transformer ?? defaultTransformers.defaultUserTransformer;
  const promises = [];
  const entities = [];
  for await (const user of users) {
    promises.push(
      limiter(async () => {
        let userPhoto;
        try {
          if (loadUserPhotos) {
            userPhoto = await client.getUserPhotoWithSizeLimit(
              user.id,
              // We are limiting the photo size, as users with full resolution photos
              // can make the Backstage API slow
              120
            );
          }
        } catch (e) {
          logger.warn(`Unable to load user photo for`, {
            user: user.id,
            error: e
          });
        }
        const entity = await resolvedTransformer(user, userPhoto);
        if (entity) {
          entities.push(entity);
        }
      })
    );
  }
  await Promise.all(promises);
  logger.debug("Finished transforming users", {
    microsoftUserCount: promises.length,
    backstageUserCount: entities.length
  });
  return entities;
}
function ensureItem(target, key, value) {
  let set = target.get(key);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    target.set(key, set);
  }
  set.add(value);
}
function retrieveItems(target, key) {
  return target.get(key) ?? /* @__PURE__ */ new Set();
}

exports.readMicrosoftGraphGroups = readMicrosoftGraphGroups;
exports.readMicrosoftGraphOrg = readMicrosoftGraphOrg;
exports.readMicrosoftGraphOrganization = readMicrosoftGraphOrganization;
exports.readMicrosoftGraphUsers = readMicrosoftGraphUsers;
exports.readMicrosoftGraphUsersInGroups = readMicrosoftGraphUsersInGroups;
exports.resolveRelations = resolveRelations;
//# sourceMappingURL=read.cjs.js.map
