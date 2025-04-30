'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var backendPluginApi = require('@backstage/backend-plugin-api');
var fs = require('fs-extra');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

function createWriteFileAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:fs:write",
    description: "Creates a file with the content on the given path",
    supportsDryRun: true,
    schema: {
      input: {
        required: ["path", "content"],
        type: "object",
        properties: {
          path: {
            title: "Path",
            description: "Relative path",
            type: "string"
          },
          content: {
            title: "Content",
            description: "This will be the content of the file",
            type: "string"
          },
          preserveFormatting: {
            title: "Preserve Formatting",
            description: "Specify whether to preserve formatting for JSON content",
            type: "boolean",
            default: false
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
      const destFilepath = backendPluginApi.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      let formattedContent = ctx.input.content;
      if (ctx.input.preserveFormatting) {
        try {
          const parsedContent = JSON.parse(ctx.input.content);
          formattedContent = JSON.stringify(parsedContent, null, 2);
        } catch (error) {
        }
      }
      fs__default.default.outputFileSync(destFilepath, formattedContent);
      ctx.output("path", destFilepath);
    }
  });
}

exports.createWriteFileAction = createWriteFileAction;
//# sourceMappingURL=writeFile.cjs.js.map
