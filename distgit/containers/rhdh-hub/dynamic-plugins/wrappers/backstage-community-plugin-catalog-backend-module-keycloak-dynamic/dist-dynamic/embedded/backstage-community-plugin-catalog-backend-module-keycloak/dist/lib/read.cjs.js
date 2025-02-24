'use strict';

var constants = require('./constants.cjs.js');
var transformers = require('./transformers.cjs.js');
var authenticate = require('./authenticate.cjs.js');

const parseGroup = async (keycloakGroup, realm, groupTransformer) => {
  const transformer = groupTransformer ?? transformers.noopGroupTransformer;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "Group",
    metadata: {
      name: keycloakGroup.name,
      annotations: {
        [constants.KEYCLOAK_ID_ANNOTATION]: keycloakGroup.id,
        [constants.KEYCLOAK_REALM_ANNOTATION]: realm
      }
    },
    spec: {
      type: "group",
      profile: {
        displayName: keycloakGroup.name
      },
      // children, parent and members are updated again after all group and user transformers applied.
      children: keycloakGroup.subGroups?.map((g) => g.name) ?? [],
      parent: keycloakGroup.parent,
      members: keycloakGroup.members
    }
  };
  return await transformer(entity, keycloakGroup, realm);
};
const parseUser = async (user, realm, keycloakGroups, groupIndex, userTransformer) => {
  const transformer = userTransformer ?? transformers.noopUserTransformer;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "User",
    metadata: {
      name: user.username,
      annotations: {
        [constants.KEYCLOAK_ID_ANNOTATION]: user.id,
        [constants.KEYCLOAK_REALM_ANNOTATION]: realm
      }
    },
    spec: {
      profile: {
        email: user.email,
        ...user.firstName || user.lastName ? {
          displayName: [user.firstName, user.lastName].filter(Boolean).join(" ")
        } : {}
      },
      memberOf: groupIndex.get(user.username) ?? []
    }
  };
  return await transformer(entity, user, realm, keycloakGroups);
};
async function getEntities(getEntitiesFn, config, logger, limit, entityQuerySize = constants.KEYCLOAK_ENTITY_QUERY_SIZE) {
  const entitiesAPI = await getEntitiesFn();
  const rawEntityCount = await entitiesAPI.count({ realm: config.realm });
  const entityCount = typeof rawEntityCount === "number" ? rawEntityCount : rawEntityCount.count;
  const pageCount = Math.ceil(entityCount / entityQuerySize);
  const entityPromises = Array.from(
    { length: pageCount },
    (_, i) => limit(
      () => getEntitiesFn().then((entities) => {
        return entities.find({
          realm: config.realm,
          max: entityQuerySize,
          first: i * entityQuerySize
        }).then((ents) => {
          logger.debug(
            `Importing keycloak entities batch with index ${i} from pages: ${pageCount}`
          );
          return ents;
        }).catch((err) => {
          logger.warn("Failed to retieve Keycloak entities.", err);
          return [];
        });
      })
    )
  );
  const entityResults = (await Promise.all(entityPromises)).flat();
  return entityResults;
}
async function getAllGroupMembers(groupsAPI, groupId, config, options) {
  const querySize = options?.userQuerySize || 100;
  let allMembers = [];
  let page = 0;
  let totalMembers = 0;
  do {
    const groups = await groupsAPI();
    const members = await groups.listMembers({
      id: groupId,
      max: querySize,
      realm: config.realm,
      first: page * querySize
    });
    if (members.length > 0) {
      allMembers = allMembers.concat(members.map((m) => m.username));
      totalMembers = members.length;
    } else {
      totalMembers = 0;
    }
    page++;
  } while (totalMembers > 0);
  return allMembers;
}
async function processGroupsRecursively(kcAdminClient, config, logger, topLevelGroups) {
  const allGroups = [];
  for (const group of topLevelGroups) {
    allGroups.push(group);
    if (group.subGroupCount > 0) {
      await authenticate.ensureTokenValid(kcAdminClient, config, logger);
      const subgroups = await kcAdminClient.groups.listSubGroups({
        parentId: group.id,
        first: 0,
        max: group.subGroupCount,
        briefRepresentation: true
      });
      const subGroupResults = await processGroupsRecursively(
        kcAdminClient,
        config,
        logger,
        subgroups
      );
      allGroups.push(...subGroupResults);
    }
  }
  return allGroups;
}
function* traverseGroups(group) {
  yield group;
  for (const g of group.subGroups ?? []) {
    g.parent = group.name;
    yield* traverseGroups(g);
  }
}
const readKeycloakRealm = async (client, config, logger, limit, options) => {
  const kUsers = await getEntities(
    async () => {
      await authenticate.ensureTokenValid(client, config, logger);
      return client.users;
    },
    config,
    logger,
    limit,
    options?.userQuerySize
  );
  logger.debug(`Fetched ${kUsers.length} users from Keycloak`);
  const topLevelKGroups = await getEntities(
    async () => {
      await authenticate.ensureTokenValid(client, config, logger);
      return client.groups;
    },
    config,
    logger,
    limit,
    options?.groupQuerySize
  );
  logger.debug(`Fetched ${topLevelKGroups.length} groups from Keycloak`);
  let serverVersion;
  try {
    await authenticate.ensureTokenValid(client, config, logger);
    const serverInfo = await client.serverInfo.find();
    serverVersion = parseInt(
      serverInfo.systemInfo?.version?.slice(0, 2) || "",
      10
    );
  } catch (error) {
    throw new Error(`Failed to retrieve Keycloak server information: ${error}`);
  }
  const isVersion23orHigher = serverVersion >= 23;
  let rawKGroups = [];
  logger.debug(`Processing groups recursively`);
  if (isVersion23orHigher) {
    rawKGroups = await processGroupsRecursively(
      client,
      config,
      logger,
      topLevelKGroups
    );
  } else {
    rawKGroups = topLevelKGroups.reduce(
      (acc, g) => acc.concat(...traverseGroups(g)),
      []
    );
  }
  logger.debug(`Fetching group members for keycloak groups and list subgroups`);
  const kGroups = await Promise.all(
    rawKGroups.map(
      (g) => limit(async () => {
        g.members = await getAllGroupMembers(
          async () => {
            await authenticate.ensureTokenValid(client, config, logger);
            return client.groups;
          },
          g.id,
          config,
          options
        );
        if (isVersion23orHigher) {
          if (g.subGroupCount > 0) {
            await authenticate.ensureTokenValid(client, config, logger);
            g.subGroups = await client.groups.listSubGroups({
              parentId: g.id,
              first: 0,
              max: g.subGroupCount,
              briefRepresentation: false,
              realm: config.realm
            });
          }
          if (g.parentId) {
            await authenticate.ensureTokenValid(client, config, logger);
            const groupParent = await client.groups.findOne({
              id: g.parentId,
              realm: config.realm
            });
            g.parent = groupParent?.name;
          }
        }
        return g;
      })
    )
  );
  logger.debug(`Parsing groups`);
  const parsedGroups = await Promise.all(
    kGroups.map(async (g) => {
      if (!g) {
        return null;
      }
      const entity = await parseGroup(
        g,
        config.realm,
        options?.groupTransformer
      );
      if (entity) {
        return { ...g, entity };
      }
      return null;
    })
  );
  const filteredParsedGroups = parsedGroups.filter(
    (group) => group !== null
  );
  const groupIndex = /* @__PURE__ */ new Map();
  filteredParsedGroups.forEach((group) => {
    if (group.members) {
      group.members.forEach((member) => {
        if (!groupIndex.has(member)) {
          groupIndex.set(member, []);
        }
        groupIndex.get(member)?.push(group.entity.metadata.name);
      });
    }
  });
  logger.debug("Parsing users");
  const parsedUsers = await Promise.all(
    kUsers.map(async (u) => {
      if (!u) {
        return null;
      }
      const entity = await parseUser(
        u,
        config.realm,
        filteredParsedGroups,
        groupIndex,
        options?.userTransformer
      );
      if (entity) {
        return { ...u, entity };
      }
      return null;
    })
  );
  const filteredParsedUsers = parsedUsers.filter(
    (user) => user !== null
  );
  logger.debug(`Set up group members and children information`);
  const userMap = new Map(
    filteredParsedUsers.map((user) => [user.username, user.entity.metadata.name])
  );
  const groupMap = new Map(
    filteredParsedGroups.map((group) => [group.name, group.entity.metadata.name])
  );
  const groups = filteredParsedGroups.map((g) => {
    const entity = g.entity;
    entity.spec.members = g.entity.spec.members?.flatMap((m) => userMap.get(m) ?? []) ?? [];
    entity.spec.children = g.entity.spec.children?.flatMap((c) => groupMap.get(c) ?? []) ?? [];
    entity.spec.parent = groupMap.get(entity.spec.parent);
    return entity;
  });
  logger.info(
    `Prepared to ingest  ${parsedUsers.length} users and ${groups.length} groups into the catalog from Keycloak`
  );
  return { users: filteredParsedUsers.map((u) => u.entity), groups };
};

exports.getEntities = getEntities;
exports.parseGroup = parseGroup;
exports.parseUser = parseUser;
exports.processGroupsRecursively = processGroupsRecursively;
exports.readKeycloakRealm = readKeycloakRealm;
exports.traverseGroups = traverseGroups;
//# sourceMappingURL=read.cjs.js.map
