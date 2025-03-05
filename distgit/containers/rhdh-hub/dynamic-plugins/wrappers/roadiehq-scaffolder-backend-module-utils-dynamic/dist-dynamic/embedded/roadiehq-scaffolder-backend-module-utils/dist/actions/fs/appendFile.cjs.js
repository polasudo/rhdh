'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var backendPluginApi = require('@backstage/backend-plugin-api');
var fs = require('fs-extra');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

function createAppendFileAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:fs:append",
    description: "Append content to the end of the given file, it will create the file if it does not exist.",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["content", "path"],
        properties: {
          path: {
            title: "Path",
            description: "Path to existing file to append.",
            type: "string"
          },
          content: {
            title: "Content",
            description: "This will be appended to the file",
            type: "string"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          path: {
            title: "Path",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const sourceFilepath = backendPluginApi.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      fs__default.default.appendFileSync(sourceFilepath, ctx.input.content);
      ctx.output("path", sourceFilepath);
    }
  });
}

exports.createAppendFileAction = createAppendFileAction;
//# sourceMappingURL=appendFile.cjs.js.map
