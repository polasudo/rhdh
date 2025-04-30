'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var $schema = "http://json-schema.org/draft-07/schema";
var $id = "https://extensions.backstage.io/v1alpha1/plugins";
var $ref = "#/$defs/MarketplacePlugin";
var $defs = {
	MarketplacePlugin: {
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
				$ref: "#/$defs/MarketplacePluginSpec"
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
			"name"
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
	MarketplacePluginSpec: {
		type: "object",
		properties: {
			icon: {
				type: "string"
			},
			author: {
				$ref: "#/$defs/MarketplaceAuthor"
			},
			authors: {
				type: "array",
				items: {
					$ref: "#/$defs/MarketplaceAuthor"
				}
			},
			publisher: {
				$ref: "#/$defs/MarketplaceAuthor"
			},
			categories: {
				type: "array",
				items: {
					type: "string"
				}
			},
			highlights: {
				type: "array",
				items: {
					type: "string"
				}
			},
			support: {
				type: "string"
			},
			lifecycle: {
				type: "string"
			},
			documentation: {
				type: "array",
				items: {
					$ref: "#/$defs/Documentation"
				}
			},
			assets: {
				type: "array",
				items: {
					$ref: "#/$defs/Asset"
				}
			},
			history: {
				$ref: "#/$defs/History"
			}
		}
	},
	MarketplaceAuthor: {
		oneOf: [
			{
				type: "string"
			},
			{
				type: "object",
				properties: {
					name: {
						type: "string"
					},
					url: {
						type: "string"
					}
				},
				required: [
					"name"
				]
			}
		]
	},
	Asset: {
		type: "object",
		additionalProperties: false,
		properties: {
			type: {
				type: "string"
			},
			filename: {
				type: "string"
			},
			originUri: {
				type: "string"
			}
		},
		required: [
			"filename",
			"originUri",
			"type"
		]
	},
	Developer: {
		type: "object",
		additionalProperties: false,
		properties: {
			name: {
				type: "string"
			}
		},
		required: [
			"name"
		]
	},
	Documentation: {
		type: "object",
		additionalProperties: false,
		properties: {
			type: {
				type: "string"
			},
			markdown: {
				type: "string"
			},
			title: {
				type: "string"
			}
		},
		required: [
			"markdown",
			"type"
		]
	},
	History: {
		type: "object",
		additionalProperties: false,
		properties: {
			added: {
				type: "string"
			}
		},
		required: [
			"added"
		]
	}
};
var pluginJsonSchema = {
	$schema: $schema,
	$id: $id,
	$ref: $ref,
	$defs: $defs
};

exports.$defs = $defs;
exports.$id = $id;
exports.$ref = $ref;
exports.$schema = $schema;
exports.default = pluginJsonSchema;
//# sourceMappingURL=plugins.json.cjs.js.map
