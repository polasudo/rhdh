'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var jsonata = require('jsonata');
var backendPluginApi = require('@backstage/backend-plugin-api');
var fs = require('fs-extra');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var jsonata__default = /*#__PURE__*/_interopDefaultCompat(jsonata);
var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

function createJsonJSONataTransformAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:jsonata:json:transform",
    description: "Allows performing JSONata operations and transformations on a JSON file in the workspace. The result can be read from the `result` step output.",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["path", "expression"],
        properties: {
          path: {
            title: "Path",
            description: "Input path to read json file",
            type: "string"
          },
          expression: {
            title: "Expression",
            description: "JSONata expression to perform on the input",
            type: "string"
          },
          as: {
            title: "Desired Result Type",
            description: 'Permitted values are: "string" (default) and "object"',
            type: "string",
            enum: ["string", "object"]
          },
          replacer: {
            title: "Replacer",
            description: "Replacer array",
            type: "array",
            items: {
              type: "string"
            }
          },
          space: {
            title: "Space",
            description: "Space character",
            type: "string"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          result: {
            title: "Output result from JSONata",
            type: "object | string"
          }
        }
      }
    },
    async handler(ctx) {
      let resultHandler;
      if (ctx.input.as === "object") {
        resultHandler = (rz) => rz;
      } else {
        resultHandler = (rz) => JSON.stringify(rz, ctx.input.replacer, ctx.input.space);
      }
      const sourceFilepath = backendPluginApi.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      const data = JSON.parse(fs__default.default.readFileSync(sourceFilepath).toString());
      const expression = jsonata__default.default(ctx.input.expression);
      const result = await expression.evaluate(data);
      ctx.output("result", resultHandler(result));
    }
  });
}

exports.createJsonJSONataTransformAction = createJsonJSONataTransformAction;
//# sourceMappingURL=json.cjs.js.map
