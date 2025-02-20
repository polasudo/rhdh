'use strict';

var catalogModel = require('@backstage/catalog-model');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var relations = require('./relations.cjs.js');

class ScaffolderRelationEntityProcessor {
  getProcessorName() {
    return "ScaffolderRelationEntityProcessor";
  }
  async postProcessEntity(entity, _location, emit) {
    const selfRef = catalogModel.getCompoundEntityRef(entity);
    function doEmit(targets, context, outgoingRelation, incomingRelation) {
      if (!targets) {
        return;
      }
      for (const target of [targets].flat()) {
        const targetRef = catalogModel.parseEntityRef(target, context);
        emit(
          pluginCatalogNode.processingResult.relation({
            source: selfRef,
            type: outgoingRelation,
            target: {
              kind: targetRef.kind,
              namespace: targetRef.namespace,
              name: targetRef.name
            }
          })
        );
        emit(
          pluginCatalogNode.processingResult.relation({
            source: {
              kind: targetRef.kind,
              namespace: targetRef.namespace,
              name: targetRef.name
            },
            type: incomingRelation,
            target: selfRef
          })
        );
      }
    }
    const arbitraryEntity = entity;
    doEmit(
      arbitraryEntity.spec?.scaffoldedFrom,
      { defaultKind: "Template", defaultNamespace: selfRef.namespace },
      relations.RELATION_SCAFFOLDED_FROM,
      relations.RELATION_SCAFFOLDER_OF
    );
    return entity;
  }
}

exports.ScaffolderRelationEntityProcessor = ScaffolderRelationEntityProcessor;
//# sourceMappingURL=ScaffolderRelationEntityProcessor.cjs.js.map
