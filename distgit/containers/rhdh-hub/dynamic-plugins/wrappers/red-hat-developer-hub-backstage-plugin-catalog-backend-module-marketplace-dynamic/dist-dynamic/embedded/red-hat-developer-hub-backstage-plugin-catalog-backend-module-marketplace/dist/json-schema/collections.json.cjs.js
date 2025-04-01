'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var $schema = "http://json-schema.org/draft-07/schema";
var $id = "https://extensions.backstage.io/v1alpha1/collections";
var $ref = "#/$defs/MarketplaceCollection";
var $defs = {
	MarketplaceCollection: {
		type: "object",
		additionalProperties: false,
		properties: {
			apiVersion: {
				type: "string"
			},
			kind: {
				type: "string"
			},
			metadata: {
				$ref: "#/$defs/EntityMetadata"
			},
			spec: {
				$ref: "#/$defs/MarketplaceCollectionSpec"
			}
		},
		required: [
			"apiVersion",
			"kind",
			"metadata",
			"spec"
		]
	},
	EntityMetadata: {
		type: "object",
		additionalProperties: false,
		properties: {
			name: {
				type: "string"
			},
			namespace: {
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
				type: "object",
				additionalProperties: {
					type: "string"
				}
			},
			annotations: {
				type: "object",
				additionalProperties: {
					type: "string"
				}
			},
			links: {
				type: "array",
				items: {
					$ref: "#/$defs/EntityMetadataLink"
				}
			}
		},
		required: [
			"name",
			"title",
			"description"
		]
	},
	EntityMetadataLink: {
		type: "object",
		additionalProperties: false,
		properties: {
			url: {
				type: "string"
			},
			title: {
				type: "string"
			},
			icon: {
				type: "string"
			},
			type: {
				type: "string"
			}
		},
		required: [
			"title",
			"url"
		]
	},
	MarketplaceCollectionSpec: {
		type: "object",
		additionalProperties: false,
		properties: {
			type: {
				type: "string",
				"enum": [
					"curated"
				]
			},
			plugins: {
				type: "array",
				items: {
					type: "string"
				}
			}
		},
		required: [
			"type"
		]
	}
};
var collectionJsonSchema = {
	$schema: $schema,
	$id: $id,
	$ref: $ref,
	$defs: $defs
};

exports.$defs = $defs;
exports.$id = $id;
exports.$ref = $ref;
exports.$schema = $schema;
exports.default = collectionJsonSchema;
//# sourceMappingURL=collections.json.cjs.js.map
