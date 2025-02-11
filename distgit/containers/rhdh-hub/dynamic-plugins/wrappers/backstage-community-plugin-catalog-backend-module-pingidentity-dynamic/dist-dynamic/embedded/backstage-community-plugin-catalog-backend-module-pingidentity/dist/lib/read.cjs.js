'use strict';

var catalogModel = require('@backstage/catalog-model');
var constants = require('./constants.cjs.js');
var defaultTransformers = require('./defaultTransformers.cjs.js');

const findGroupMemberships = (userId, groups, groupMembersMap) => {
  const groupMemberships = [];
  groups.forEach((group) => {
    const groupId = group.metadata.annotations ? group.metadata.annotations[constants.PING_IDENTITY_ID_ANNOTATION] : undefined;
    if (groupId && groupMembersMap.has(groupId) && groupMembersMap.get(groupId)?.has(userId)) {
      groupMemberships.push(group.metadata.name);
    }
  });
  return groupMemberships;
};
const getEntityLocation = (config, entityKind, entityId) => {
  return `url:${config.apiPath}/environments/${config.envId}/${entityKind}/${entityId}`;
};
const parsePingIdentityUsers = async (client, groups, groupMembersMap, userQuerySize, userTransformer) => {
  const transformer = userTransformer ?? defaultTransformers.defaultUserTransformer;
  const pingIdentityUsers = await client.getUsers(
    userQuerySize
  );
  const transformedUsers = await Promise.all(
    pingIdentityUsers.map(async (user) => {
      const userLocation = getEntityLocation(
        client.getConfig(),
        "users",
        user.id
      );
      return await transformer(
        {
          apiVersion: "backstage.io/v1beta1",
          kind: "User",
          metadata: {
            name: user.username,
            annotations: {
              [constants.PING_IDENTITY_ID_ANNOTATION]: user.id,
              [catalogModel.ANNOTATION_LOCATION]: userLocation,
              [catalogModel.ANNOTATION_ORIGIN_LOCATION]: userLocation
            }
          },
          spec: {
            profile: {
              email: user.email,
              ...user.name.given || user.name.family ? {
                displayName: [user.name.given, user.name.family].filter(Boolean).join(" ")
              } : {}
            },
            memberOf: findGroupMemberships(user.id, groups, groupMembersMap)
          }
        },
        user,
        client.getConfig().envId,
        groups
      );
    })
  );
  return transformedUsers.filter((user) => user !== undefined);
};
const parsePingIdentityGroups = async (client, groupMembersMap, parentGroupMap, groupQuerySize, groupTransformer) => {
  const transformer = groupTransformer ?? defaultTransformers.defaultGroupTransformer;
  const pingIdentityGroups = await client.getGroups(
    groupQuerySize
  );
  const transformedGroups = await Promise.all(
    pingIdentityGroups.map(async (group) => {
      const groupLocation = getEntityLocation(
        client.getConfig(),
        "groups",
        group.id
      );
      groupMembersMap.set(
        group.id,
        new Set(await client.getUsersInGroup(group.id))
      );
      const parentGroupId = await client.getParentGroupId(group.id);
      if (parentGroupId) parentGroupMap.set(group.id, parentGroupId);
      return await transformer(
        {
          apiVersion: "backstage.io/v1beta1",
          kind: "Group",
          metadata: {
            name: group.name,
            annotations: {
              [constants.PING_IDENTITY_ID_ANNOTATION]: group.id,
              [catalogModel.ANNOTATION_LOCATION]: groupLocation,
              [catalogModel.ANNOTATION_ORIGIN_LOCATION]: groupLocation
            },
            description: group.description
          },
          spec: {
            type: "group",
            profile: {
              displayName: group.name
            },
            children: [],
            parent: undefined
            // will be updated later
          }
        },
        group,
        client.getConfig().envId
      );
    })
  );
  return transformedGroups.filter(
    (group) => group !== undefined
  );
};
const readPingIdentity = async (client, options) => {
  const groupMembersMap = /* @__PURE__ */ new Map();
  const parentGroupMap = /* @__PURE__ */ new Map();
  const groups = await parsePingIdentityGroups(
    client,
    groupMembersMap,
    parentGroupMap,
    options?.userQuerySize,
    options?.groupTransformer
  );
  const groupsMap = /* @__PURE__ */ new Map();
  groups.forEach((group) => {
    const groupId = group.metadata.annotations[constants.PING_IDENTITY_ID_ANNOTATION];
    groupsMap.set(groupId, group);
  });
  groups.forEach((group) => {
    const parentGroupId = parentGroupMap.get(
      group.metadata.annotations[constants.PING_IDENTITY_ID_ANNOTATION]
    );
    if (parentGroupId) {
      const parentGroup = groupsMap.get(parentGroupId);
      group.spec.parent = parentGroup?.metadata.name;
    }
  });
  const users = await parsePingIdentityUsers(
    client,
    groups,
    groupMembersMap,
    options?.groupQuerySize,
    options?.userTransformer
  );
  return { users, groups };
};

exports.readPingIdentity = readPingIdentity;
//# sourceMappingURL=read.cjs.js.map
