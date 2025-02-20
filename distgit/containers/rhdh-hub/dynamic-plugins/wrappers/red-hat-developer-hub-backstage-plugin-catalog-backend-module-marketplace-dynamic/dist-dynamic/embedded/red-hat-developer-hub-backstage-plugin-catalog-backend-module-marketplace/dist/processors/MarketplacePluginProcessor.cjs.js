'use strict';

var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var catalogModel = require('@backstage/catalog-model');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');

const pluginJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema",
  $id: "PluginV1alpha1",
  description: 'A Plugin describes a software component. It is typically intimately linked to the source code that constitutes the component, and should be what a developer may regard a "unit of software", usually with a distinct deployable or linkable artifact.',
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
          enum: ["Plugin"]
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
            }
          }
          // required: ['type', 'lifecycle', 'owner'],
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
        enum: ["Plugin"]
      },
      metadata: {
        name: "testplugin",
        title: "Test Plugin",
        description: "Creates Lorems like a pro.",
        labels: {
          product_name: "test-product"
        },
        annotations: {
          docs: "https://github.com/..../tree/develop/doc"
        }
      },
      spec: {
        type: "frontend-plugin",
        lifecycle: "production",
        owner: "redhat"
      }
    }
  ]
};
class MarketplacePluginProcessor {
  validators = [catalogModel.entityKindSchemaValidator(pluginJsonSchema)];
  // Return processor name
  getProcessorName() {
    return "MarketplacePluginProcessor";
  }
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
  async postProcessEntity(entity, _location, emit) {
    if (entity.apiVersion === backstagePluginMarketplaceCommon.MARKETPLACE_API_VERSION && entity.kind === backstagePluginMarketplaceCommon.MarketplaceKinds.plugin) {
      const thisEntityRef = catalogModel.getCompoundEntityRef(entity);
      const target = entity?.spec?.owner;
      if (target) {
        const targetRef = catalogModel.parseEntityRef(target, {
          defaultKind: "Group",
          defaultNamespace: thisEntityRef.namespace
        });
        emit(
          pluginCatalogNode.processingResult.relation({
            type: catalogModel.RELATION_OWNED_BY,
            target: targetRef,
            source: thisEntityRef
          })
        );
      }
    }
    return entity;
  }
}

exports.MarketplacePluginProcessor = MarketplacePluginProcessor;
//# sourceMappingURL=MarketplacePluginProcessor.cjs.js.map
