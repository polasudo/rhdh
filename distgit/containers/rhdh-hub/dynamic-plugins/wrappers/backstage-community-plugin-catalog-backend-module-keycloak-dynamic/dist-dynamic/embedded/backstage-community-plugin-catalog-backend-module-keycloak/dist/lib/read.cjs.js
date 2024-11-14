'use strict';

var constants = require('./constants.cjs.js');
var transformers = require('./transformers.cjs.js');

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
const parseUser = async (user, realm, keycloakGroups, userTransformer) => {
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
      memberOf: keycloakGroups.filter((g) => g.members?.includes(user.username)).map((g) => g.entity.metadata.name)
    }
  };
  return await transformer(entity, user, realm, keycloakGroups);
};
async function getEntities(entities, config, logger, entityQuerySize = constants.KEYCLOAK_ENTITY_QUERY_SIZE) {
  const rawEntityCount = await entities.count({ realm: config.realm });
  const entityCount = typeof rawEntityCount === "number" ? rawEntityCount : rawEntityCount.count;
  const pageCount = Math.ceil(entityCount / entityQuerySize);
  const entityPromises = Array.from(
    { length: pageCount },
    (_, i) => entities.find({
      realm: config.realm,
      max: entityQuerySize,
      first: i * entityQuerySize
    }).catch(
      (err) => logger.warn("Failed to retieve Keycloak entities.", err)
    )
  );
  const entityResults = (await Promise.all(entityPromises)).flat();
  return entityResults;
}
async function getAllGroupMembers(groups, groupId, config, options) {
  const querySize = options?.userQuerySize || 100;
  let allMembers = [];
  let page = 0;
  let totalMembers = 0;
  do {
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
async function processGroupsRecursively(topLevelGroups, entities, realm) {
  const allGroups = [];
  for (const group of topLevelGroups) {
    allGroups.push(group);
    if (group.subGroupCount > 0) {
      const subgroups = await entities.listSubGroups({
        parentId: group.id,
        first: 0,
        max: group.subGroupCount,
        briefRepresentation: true,
        realm
      });
      const subGroupResults = await processGroupsRecursively(
        subgroups,
        entities,
        realm
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
const readKeycloakRealm = async (client, config, logger, options) => {
  const kUsers = await getEntities(
    client.users,
    config,
    logger,
    options?.userQuerySize
  );
  const topLevelKGroups = await getEntities(
    client.groups,
    config,
    logger,
    options?.groupQuerySize
  );
  let serverVersion;
  try {
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
  if (isVersion23orHigher) {
    rawKGroups = await processGroupsRecursively(
      topLevelKGroups,
      client.groups,
      config.realm
    );
  } else {
    rawKGroups = topLevelKGroups.reduce(
      (acc, g) => acc.concat(...traverseGroups(g)),
      []
    );
  }
  const kGroups = await Promise.all(
    rawKGroups.map(async (g) => {
      g.members = await getAllGroupMembers(
        client.groups,
        g.id,
        config,
        options
      );
      if (isVersion23orHigher) {
        if (g.subGroupCount > 0) {
          g.subGroups = await client.groups.listSubGroups({
            parentId: g.id,
            first: 0,
            max: g.subGroupCount,
            briefRepresentation: false,
            realm: config.realm
          });
        }
        if (g.parentId) {
          const groupParent = await client.groups.findOne({
            id: g.parentId,
            realm: config.realm
          });
          g.parent = groupParent?.name;
        }
      }
      return g;
    })
  );
  const parsedGroups = await kGroups.reduce(async (promise, g) => {
    const partial = await promise;
    const entity = await parseGroup(g, config.realm, options?.groupTransformer);
    if (entity) {
      const group = {
        ...g,
        entity
      };
      partial.push(group);
    }
    return partial;
  }, Promise.resolve([]));
  const parsedUsers = await kUsers.reduce(async (promise, u) => {
    const partial = await promise;
    const entity = await parseUser(
      u,
      config.realm,
      parsedGroups,
      options?.userTransformer
    );
    if (entity) {
      const user = { ...u, entity };
      partial.push(user);
    }
    return partial;
  }, Promise.resolve([]));
  const groups = parsedGroups.map((g) => {
    const entity = g.entity;
    entity.spec.members = g.entity.spec.members?.flatMap((m) => {
      const name = parsedUsers.find((p) => p.username === m)?.entity.metadata.name;
      return name ? [name] : [];
    }) ?? [];
    entity.spec.children = g.entity.spec.children?.flatMap((c) => {
      const child = parsedGroups.find((p) => p.name === c)?.entity.metadata.name;
      return child ? [child] : [];
    }) ?? [];
    entity.spec.parent = parsedGroups.find(
      (p) => p.name === entity.spec.parent
    )?.entity.metadata.name;
    return entity;
  });
  return { users: parsedUsers.map((u) => u.entity), groups };
};

exports.getEntities = getEntities;
exports.parseGroup = parseGroup;
exports.parseUser = parseUser;
exports.processGroupsRecursively = processGroupsRecursively;
exports.readKeycloakRealm = readKeycloakRealm;
exports.traverseGroups = traverseGroups;
//# sourceMappingURL=read.cjs.js.map
