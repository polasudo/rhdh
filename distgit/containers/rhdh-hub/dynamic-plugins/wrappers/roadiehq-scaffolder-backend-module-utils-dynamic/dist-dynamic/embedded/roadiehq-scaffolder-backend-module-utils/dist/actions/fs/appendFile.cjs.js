'use strict';

var pluginScaffolderBackend = require('@backstage/plugin-scaffolder-backend');
var backendCommon = require('@backstage/backend-common');
var fs = require('fs-extra');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

function createAppendFileAction() {
  return pluginScaffolderBackend.createTemplateAction({
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
      const sourceFilepath = backendCommon.resolveSafeChildPath(
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
