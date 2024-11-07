'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0 = require('@backstage/catalog-model');
var require$$1 = require('@backstage/plugin-catalog-node');

var index_cjs = {};

var relations_cjs = {};

const RELATION_SCAFFOLDER_OF = "scaffolderOf";
const RELATION_SCAFFOLDED_FROM = "scaffoldedFrom";

relations_cjs.RELATION_SCAFFOLDED_FROM = RELATION_SCAFFOLDED_FROM;
relations_cjs.RELATION_SCAFFOLDER_OF = RELATION_SCAFFOLDER_OF;

var module_cjs = {};

var ScaffolderRelationEntityProcessor_cjs = {};

var catalogModel = require$$0;
var pluginCatalogNode = require$$1;
var relations$1 = relations_cjs;

class ScaffolderRelationEntityProcessor$2 {
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
      relations$1.RELATION_SCAFFOLDED_FROM,
      relations$1.RELATION_SCAFFOLDER_OF
    );
    return entity;
  }
}

ScaffolderRelationEntityProcessor_cjs.ScaffolderRelationEntityProcessor = ScaffolderRelationEntityProcessor$2;

var backendPluginApi = require$$0$1;
var alpha = require$$1$1;
var ScaffolderRelationEntityProcessor$1 = ScaffolderRelationEntityProcessor_cjs;

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
        catalog.addProcessor(new ScaffolderRelationEntityProcessor$1.ScaffolderRelationEntityProcessor());
      }
    });
  }
});

module_cjs.catalogModuleScaffolderRelationProcessor = catalogModuleScaffolderRelationProcessor;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var relations = relations_cjs;
var module$1 = module_cjs;
var ScaffolderRelationEntityProcessor = ScaffolderRelationEntityProcessor_cjs;



index_cjs.RELATION_SCAFFOLDED_FROM = relations.RELATION_SCAFFOLDED_FROM;
index_cjs.RELATION_SCAFFOLDER_OF = relations.RELATION_SCAFFOLDER_OF;
var _default = index_cjs.default = module$1.catalogModuleScaffolderRelationProcessor;
index_cjs.ScaffolderRelationEntityProcessor = ScaffolderRelationEntityProcessor.ScaffolderRelationEntityProcessor;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
