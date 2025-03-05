'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var jsonata = require('jsonata');
var backendPluginApi = require('@backstage/backend-plugin-api');
var fs = require('fs-extra');
var YAML = require('yaml');
var types = require('../../types.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var jsonata__default = /*#__PURE__*/_interopDefaultCompat(jsonata);
var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var YAML__default = /*#__PURE__*/_interopDefaultCompat(YAML);

function createYamlJSONataTransformAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:jsonata:yaml:transform",
    description: "Allows performing JSONata operations and transformations on a YAML file in the workspace. The result can be read from the `result` step output.",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["path", "expression"],
        properties: {
          path: {
            title: "Path",
            description: "Input path to read yaml file",
            type: "string"
          },
          expression: {
            title: "Expression",
            description: "JSONata expression to perform on the input",
            type: "string"
          },
          loadAll: {
            title: "Load All",
            description: "Use this if the yaml source file contains multiple yaml objects",
            type: "boolean"
          },
          as: {
            title: "Desired Result Type",
            description: 'Permitted values are: "string" (default) and "object"',
            type: "string",
            enum: ["string", "object"]
          },
          options: types.yamlOptionsSchema
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
        resultHandler = (rz) => YAML__default.default.stringify(rz, ctx.input.options);
      }
      const sourceFilepath = backendPluginApi.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      let data;
      if (ctx.input.loadAll) {
        data = YAML__default.default.parseAllDocuments(
          fs__default.default.readFileSync(sourceFilepath).toString()
        ).map((doc) => doc.toJSON());
      } else {
        data = YAML__default.default.parse(fs__default.default.readFileSync(sourceFilepath).toString());
      }
      const expression = jsonata__default.default(ctx.input.expression);
      const result = await expression.evaluate(data);
      ctx.output("result", resultHandler(result));
    }
  });
}

exports.createYamlJSONataTransformAction = createYamlJSONataTransformAction;
//# sourceMappingURL=yaml.cjs.js.map
