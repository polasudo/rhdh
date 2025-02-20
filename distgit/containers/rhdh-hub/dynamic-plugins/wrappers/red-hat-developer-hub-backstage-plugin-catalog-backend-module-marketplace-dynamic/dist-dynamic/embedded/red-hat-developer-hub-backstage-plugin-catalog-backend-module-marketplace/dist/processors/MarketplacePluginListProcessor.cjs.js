'use strict';

var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var catalogModel = require('@backstage/catalog-model');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');

const pluginListJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema",
  $id: "PluginListV1alpha1",
  description: "A PluginList contains a curated list of plugins.",
  allOf: [
    {
      type: "object",
      properties: {
        apiVersion: {
          type: "string",
          enum: ["marketplace.backstage.io/v1alpha1"]
        },
        kind: {
          type: "string",
          enum: ["PluginList"]
        },
        metadata: {
          type: "object",
          properties: {
            name: {
              type: "string"
            },
            title: {
              type: "string"
            },
            description: {
              type: "string"
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              }
            },
            labels: {
              type: "object"
            },
            annotations: {
              type: "object"
            }
          },
          required: ["name", "title", "description"]
        },
        spec: {
          type: "object",
          properties: {
            type: {
              type: "string"
            },
            lifecycle: {
              type: "string"
            },
            owner: {
              type: "string"
            },
            plugins: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: ["plugins"]
        }
      },
      required: ["apiVersion", "kind", "metadata", "spec"]
    }
  ],
  examples: [
    {
      apiVersion: {
        enum: ["marketplace.backstage.io/v1alpha1"]
      },
      kind: {
        enum: ["PluginList"]
      },
      metadata: {
        name: "testpluginlist",
        title: "Test PluginList",
        description: "Creates Lorems like a pro."
      },
      spec: {
        type: "plugin-list",
        lifecycle: "production",
        owner: "redhat"
      }
    }
  ]
};
class MarketplacePluginListProcessor {
  validators = [
    catalogModel.entityKindSchemaValidator(pluginListJsonSchema)
  ];
  // validateEntityKind is responsible for signaling to the catalog processing
  // engine that this entity is valid and should therefore be submitted for
  // further processing.
  async validateEntityKind(entity) {
    for (const validator of this.validators) {
      if (validator(entity)) {
        return true;
      }
    }
    return false;
  }
  // Return processor name
  getProcessorName() {
    return "MarketplacePluginListProcessor";
  }
  async postProcessEntity(entity, _location, emit) {
    if (entity.apiVersion === backstagePluginMarketplaceCommon.MARKETPLACE_API_VERSION && entity.kind === backstagePluginMarketplaceCommon.MarketplaceKinds.pluginList) {
      const thisEntityRef = catalogModel.getCompoundEntityRef(entity);
      const target = entity?.spec?.owner;
      const plugins = entity.spec?.plugins || [];
      if (target) {
        const targetRef = catalogModel.parseEntityRef(
          {
            name: target,
            kind: "Group"
          },
          {
            defaultNamespace: thisEntityRef.namespace
          }
        );
        emit(
          pluginCatalogNode.processingResult.relation({
            type: catalogModel.RELATION_OWNED_BY,
            target: targetRef,
            source: thisEntityRef
          })
        );
        plugins.forEach((plugin) => {
          const pluginRef = catalogModel.parseEntityRef({
            name: plugin,
            kind: backstagePluginMarketplaceCommon.MarketplaceKinds.plugin
          });
          if (pluginRef) {
            emit(
              pluginCatalogNode.processingResult.relation({
                type: catalogModel.RELATION_PART_OF,
                target: pluginRef,
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

exports.MarketplacePluginListProcessor = MarketplacePluginListProcessor;
//# sourceMappingURL=MarketplacePluginListProcessor.cjs.js.map
