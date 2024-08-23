'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0 = require('@backstage/catalog-model');
var require$$1 = require('@backstage/plugin-catalog-node');

var alpha_cjs = {};

var ScaffolderRelationEntityProcessorCDT3f59_cjs = {};

var catalogModel = require$$0;
var pluginCatalogNode = require$$1;

const RELATION_SCAFFOLDER_OF = "scaffolderOf";
const RELATION_SCAFFOLDED_FROM = "scaffoldedFrom";

class ScaffolderRelationEntityProcessor$1 {
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
      RELATION_SCAFFOLDED_FROM,
      RELATION_SCAFFOLDER_OF
    );
    return entity;
  }
}

ScaffolderRelationEntityProcessorCDT3f59_cjs.RELATION_SCAFFOLDED_FROM = RELATION_SCAFFOLDED_FROM;
ScaffolderRelationEntityProcessorCDT3f59_cjs.RELATION_SCAFFOLDER_OF = RELATION_SCAFFOLDER_OF;
ScaffolderRelationEntityProcessorCDT3f59_cjs.ScaffolderRelationEntityProcessor = ScaffolderRelationEntityProcessor$1;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0$1;
var alpha = require$$1$1;
var ScaffolderRelationEntityProcessor = ScaffolderRelationEntityProcessorCDT3f59_cjs;



const catalogModuleScaffolderRelationProcessor = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "scaffolder-relation-processor",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ catalog, logger }) {
        logger.debug(
          "Registering the scaffolder-relation-processor catalog module"
        );
        catalog.addProcessor(new ScaffolderRelationEntityProcessor.ScaffolderRelationEntityProcessor());
      }
    });
  }
});

var _default = alpha_cjs.default = catalogModuleScaffolderRelationProcessor;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
