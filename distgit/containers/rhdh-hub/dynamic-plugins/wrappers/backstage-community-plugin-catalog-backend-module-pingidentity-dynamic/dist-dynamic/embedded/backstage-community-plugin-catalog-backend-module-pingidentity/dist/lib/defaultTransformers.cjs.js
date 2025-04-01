'use strict';

const defaultGroupTransformer = async (entity, _envId) => {
  entity.metadata.name = entity.metadata.name.replace(
    /[^a-zA-Z0-9_\-\.]/g,
    "_"
  );
  return entity;
};
const defaultUserTransformer = async (entity, _envId, _groups) => {
  entity.metadata.name = entity.metadata.name.replace(
    /[^a-zA-Z0-9_\-\.]/g,
    "_"
  );
  return entity;
};

exports.defaultGroupTransformer = defaultGroupTransformer;
exports.defaultUserTransformer = defaultUserTransformer;
//# sourceMappingURL=defaultTransformers.cjs.js.map
