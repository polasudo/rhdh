'use strict';

var catalogModel = require('@backstage/catalog-model');

const isUserEntityRef = (ref) => catalogModel.parseEntityRef(ref).kind.toLocaleLowerCase() === "user";
const partitionEntityRefs = (refs) => refs.reduce(
  ([userEntityRefs, otherEntityRefs], ref) => {
    return isUserEntityRef(ref) ? [[...userEntityRefs, ref], otherEntityRefs] : [userEntityRefs, [...otherEntityRefs, ref]];
  },
  [[], []]
);
const getUsersForEntityRef = async (entityRef, excludeEntityRefs, options) => {
  const { auth, catalogClient } = options;
  if (entityRef === null) {
    return [];
  }
  const { token } = await auth.getPluginRequestToken({
    onBehalfOf: await auth.getOwnServiceCredentials(),
    targetPluginId: "catalog"
  });
  const excluded = Array.isArray(excludeEntityRefs) ? excludeEntityRefs : [excludeEntityRefs];
  const refsArr = Array.isArray(entityRef) ? entityRef : [entityRef];
  const [userEntityRefs, otherEntityRefs] = partitionEntityRefs(refsArr);
  const users = userEntityRefs.filter((ref) => !excluded.includes(ref));
  const entityRefs = otherEntityRefs.filter((ref) => !excluded.includes(ref));
  const fields = ["kind", "metadata.name", "metadata.namespace", "relations"];
  let entities = [];
  if (entityRefs.length > 0) {
    const fetchedEntities = await catalogClient.getEntitiesByRefs(
      {
        entityRefs,
        fields
      },
      { token }
    );
    entities = fetchedEntities.items;
  }
  const mapEntity = async (entity) => {
    if (!entity) {
      return [];
    }
    const currentEntityRef = catalogModel.stringifyEntityRef(entity);
    if (excluded.includes(currentEntityRef)) {
      return [];
    }
    if (catalogModel.isUserEntity(entity)) {
      return [currentEntityRef];
    }
    if (catalogModel.isGroupEntity(entity)) {
      if (!entity.relations?.length) {
        return [];
      }
      const groupUsers = entity.relations.filter(
        (relation) => relation.type === catalogModel.RELATION_HAS_MEMBER && isUserEntityRef(relation.targetRef)
      ).map((r) => r.targetRef);
      const childGroupRefs = entity.relations.filter((relation) => relation.type === catalogModel.RELATION_PARENT_OF).map((r) => r.targetRef);
      let childGroupUsers = [];
      if (childGroupRefs.length > 0) {
        const childGroups = await catalogClient.getEntitiesByRefs(
          {
            entityRefs: childGroupRefs,
            fields
          },
          { token }
        );
        childGroupUsers = await Promise.all(childGroups.items.map(mapEntity));
      }
      return [...groupUsers, ...childGroupUsers.flat(2)].filter(
        (ref) => !excluded.includes(ref)
      );
    }
    if (entity.relations?.length) {
      const ownerRef = entity.relations.find(
        (relation) => relation.type === catalogModel.RELATION_OWNED_BY
      )?.targetRef;
      if (!ownerRef) {
        return [];
      }
      if (isUserEntityRef(ownerRef)) {
        if (excluded.includes(ownerRef)) {
          return [];
        }
        return [ownerRef];
      }
      const owner = await catalogClient.getEntityByRef(ownerRef, { token });
      return mapEntity(owner);
    }
    return [];
  };
  for (const entity of entities) {
    const u = await mapEntity(entity);
    users.push(...u);
  }
  return [...new Set(users)].filter(Boolean);
};

exports.getUsersForEntityRef = getUsersForEntityRef;
//# sourceMappingURL=getUsersForEntityRef.cjs.js.map
