'use strict';

var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var catalogModel = require('@backstage/catalog-model');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var plugins = require('../json-schema/plugins.json.cjs.js');

class MarketplacePluginProcessor {
  validators = [catalogModel.entityKindSchemaValidator(plugins.default)];
  getProcessorName() {
    return "MarketplacePluginProcessor";
  }
  // validateEntityKind is responsible for signaling to the catalog processing
  // engine that this entity is valid and should therefore be submitted for
  // further processing.
  async validateEntityKind(entity) {
    if (backstagePluginMarketplaceCommon.isMarketplacePlugin(entity)) {
      for (const validator of this.validators) {
        if (validator(entity)) {
          return true;
        }
      }
    }
    return false;
  }
  async postProcessEntity(entity, _location, emit) {
    if (backstagePluginMarketplaceCommon.isMarketplacePlugin(entity)) {
      if (!entity.metadata.annotations?.[backstagePluginMarketplaceCommon.MarketplaceAnnotation.PRE_INSTALLED]) {
        entity.metadata.annotations = {
          ...entity.metadata.annotations,
          [backstagePluginMarketplaceCommon.MarketplaceAnnotation.PRE_INSTALLED]: "false"
        };
      }
      const authors = [];
      if (typeof entity.spec?.author === "string") {
        authors.push({ name: entity.spec.author });
      }
      if (Array.isArray(entity.spec?.authors)) {
        entity.spec.authors.forEach((author) => {
          if (typeof author === "string") {
            authors.push({ name: author });
          } else {
            authors.push(author);
          }
        });
      }
      if (typeof entity.spec?.developer === "string") {
        authors.push({ name: entity.spec.developer });
      }
      delete entity.spec?.author;
      delete entity.spec?.authors;
      delete entity.spec?.developer;
      if (authors.length > 0) {
        if (!entity.spec) entity.spec = {};
        entity.spec.authors = authors;
      }
      const thisEntityRef = catalogModel.getCompoundEntityRef(entity);
      if (entity?.spec?.owner) {
        const ownerRef = catalogModel.parseEntityRef(entity?.spec?.owner, {
          defaultKind: "Group",
          defaultNamespace: entity.metadata.namespace
        });
        emit(
          pluginCatalogNode.processingResult.relation({
            type: catalogModel.RELATION_OWNED_BY,
            source: thisEntityRef,
            target: ownerRef
          })
        );
      }
      if (entity.spec?.packages && entity.spec.packages.length > 0) {
        entity.spec.packages.forEach((packageName) => {
          const packageRef = catalogModel.parseEntityRef(packageName, {
            defaultKind: backstagePluginMarketplaceCommon.MarketplaceKind.Package,
            defaultNamespace: entity.metadata.namespace
          });
          if (packageRef) {
            emit(
              pluginCatalogNode.processingResult.relation({
                type: catalogModel.RELATION_PART_OF,
                source: packageRef,
                target: thisEntityRef
              })
            );
            emit(
              pluginCatalogNode.processingResult.relation({
                type: catalogModel.RELATION_HAS_PART,
                target: packageRef,
                source: thisEntityRef
              })
            );
          }
        });
      }
    }
    return entity;
  }
}

exports.MarketplacePluginProcessor = MarketplacePluginProcessor;
//# sourceMappingURL=MarketplacePluginProcessor.cjs.js.map
