'use strict';

var catalogModel = require('@backstage/catalog-model');

function areGroupEntities(entities) {
  return entities.every((e) => catalogModel.isGroupEntity(e));
}
function areUserEntities(entities) {
  return entities.every((e) => catalogModel.isUserEntity(e));
}

exports.areGroupEntities = areGroupEntities;
exports.areUserEntities = areUserEntities;
//# sourceMappingURL=guards.cjs.js.map
