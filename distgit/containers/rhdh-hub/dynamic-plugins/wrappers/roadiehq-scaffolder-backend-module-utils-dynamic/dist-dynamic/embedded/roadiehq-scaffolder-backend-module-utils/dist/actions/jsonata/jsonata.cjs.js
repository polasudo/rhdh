'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var jsonata = require('jsonata');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var jsonata__default = /*#__PURE__*/_interopDefaultCompat(jsonata);

function createJSONataAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:jsonata",
    description: "Allows performing JSONata operations and transformations on input objects and produces the output result as a step output.",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["data", "expression"],
        properties: {
          data: {
            title: "Data",
            description: "Input data to be transformed",
            type: [
              "object",
              "array",
              "string",
              "number",
              "integer",
              "boolean",
              "null"
            ]
          },
          expression: {
            title: "Expression",
            description: "JSONata expression to perform on the input",
            type: "string"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          result: {
            title: "Output result from JSONata",
            type: "object"
          }
        }
      }
    },
    async handler(ctx) {
      try {
        const expression = jsonata__default.default(ctx.input.expression);
        const result = await expression.evaluate(ctx.input.data);
        ctx.output("result", result);
      } catch (e) {
        const message = e.hasOwnProperty("message") ? e.message : "unknown JSONata evaluation error";
        throw new Error(
          `JSONata failed to evaluate the expression: ${message}`
        );
      }
    }
  });
}

exports.createJSONataAction = createJSONataAction;
//# sourceMappingURL=jsonata.cjs.js.map
