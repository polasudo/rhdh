'use strict';

var catalogModel = require('@backstage/catalog-model');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var packages = require('../json-schema/packages.json.cjs.js');

class MarketplacePackageProcessor {
  validators = [catalogModel.entityKindSchemaValidator(packages.default)];
  getProcessorName() {
    return "MarketplacePackageProcessor";
  }
  // validateEntityKind is responsible for signaling to the catalog processing
  // engine that this entity is valid and should therefore be submitted for
  // further processing.
  async validateEntityKind(entity) {
    if (backstagePluginMarketplaceCommon.isMarketplacePackage(entity)) {
      for (const validator of this.validators) {
        if (validator(entity)) {
          return true;
        }
      }
    }
    return false;
  }
  async postProcessEntity(entity, _location, emit) {
    if (backstagePluginMarketplaceCommon.isMarketplacePackage(entity)) {
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
      if (entity.spec?.partOf && entity.spec.partOf.length > 0) {
        entity.spec.partOf.forEach((pluginName) => {
          const pluginRef = catalogModel.parseEntityRef(pluginName, {
            defaultKind: backstagePluginMarketplaceCommon.MarketplaceKind.Plugin,
            defaultNamespace: entity.metadata.namespace
          });
          if (pluginRef) {
            emit(
              pluginCatalogNode.processingResult.relation({
                type: catalogModel.RELATION_PART_OF,
                source: thisEntityRef,
                target: pluginRef
              })
            );
            emit(
              pluginCatalogNode.processingResult.relation({
                type: catalogModel.RELATION_HAS_PART,
                source: pluginRef,
                target: thisEntityRef
              })
            );
          }
        });
      }
    }
    return entity;
  }
}

exports.MarketplacePackageProcessor = MarketplacePackageProcessor;
//# sourceMappingURL=MarketplacePackageProcessor.cjs.js.map
