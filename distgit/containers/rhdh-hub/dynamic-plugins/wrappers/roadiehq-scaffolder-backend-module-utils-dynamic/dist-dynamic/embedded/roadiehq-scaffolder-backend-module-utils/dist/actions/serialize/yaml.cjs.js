'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var YAML = require('yaml');
var types = require('../../types.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var YAML__default = /*#__PURE__*/_interopDefaultCompat(YAML);

function createSerializeYamlAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:serialize:yaml",
    description: "Allows performing serialization on an object",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            title: "Data",
            description: "Input data to perform seriazation on.",
            type: "object"
          },
          replacer: {
            title: "Replacer",
            description: "Replacer array",
            type: "array",
            items: {
              type: "string"
            }
          },
          options: types.yamlOptionsSchema
        }
      },
      output: {
        type: "string",
        properties: {
          serialized: {
            title: "Output result from serialization",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      ctx.output(
        "serialized",
        YAML__default.default.stringify(ctx.input.data, ctx.input.options)
      );
    }
  });
}

exports.createSerializeYamlAction = createSerializeYamlAction;
//# sourceMappingURL=yaml.cjs.js.map
