'use strict';

var pluginScaffolderBackend = require('@backstage/plugin-scaffolder-backend');
var backendCommon = require('@backstage/backend-common');
var fs = require('fs-extra');
var YAML = require('yaml');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var YAML__default = /*#__PURE__*/_interopDefaultCompat(YAML);

const parsers = {
  yaml: (cnt) => YAML__default.default.parse(cnt),
  json: (cnt) => JSON.parse(cnt),
  multiyaml: (cnt) => YAML__default.default.parseAllDocuments(cnt).map((doc) => doc.toJSON())
};
function createParseFileAction() {
  return pluginScaffolderBackend.createTemplateAction({
    id: "roadiehq:utils:fs:parse",
    description: "Reads a file from the workspace and optionally parses it",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["path"],
        properties: {
          path: {
            title: "Path",
            description: "Path to the file to read.",
            type: "string"
          },
          parser: {
            title: "Parse",
            description: "Optionally parse the content to an object.",
            type: "string",
            enum: ["yaml", "json", "multiyaml"]
          }
        }
      },
      output: {
        type: "object",
        properties: {
          content: {
            title: "Content of the file",
            type: ["string", "object"]
          }
        }
      }
    },
    async handler(ctx) {
      const sourceFilepath = backendCommon.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      const parserName = ctx.input.parser;
      let parser = (content2) => content2;
      if (parserName) {
        parser = parsers[parserName];
      }
      const content = parser(
        fs__default.default.readFileSync(sourceFilepath).toString()
      );
      ctx.output("content", content);
    }
  });
}

exports.createParseFileAction = createParseFileAction;
//# sourceMappingURL=parseFile.cjs.js.map
