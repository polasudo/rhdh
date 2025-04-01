'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var fs = require('fs-extra');
var errors = require('@backstage/errors');
var backendPluginApi = require('@backstage/backend-plugin-api');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

function createReplaceInFileAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:fs:replace",
    description: "Replaces content of a file with given values.",
    supportsDryRun: true,
    schema: {
      input: {
        required: ["files"],
        type: "object",
        properties: {
          files: {
            title: "Files",
            description: "A list of files and replacements to be done",
            type: "array",
            items: {
              type: "object",
              required: [],
              properties: {
                file: {
                  type: "string",
                  title: "The source location of the file to be used to run replace against"
                },
                find: {
                  type: "string",
                  title: "A string to be replaced"
                },
                matchRegex: {
                  type: "bool",
                  title: "Use regex to match the find string"
                },
                replaceWith: {
                  type: "string",
                  title: "Text to be used to replace the found lines with"
                }
              }
            }
          }
        }
      }
    },
    async handler(ctx) {
      if (!Array.isArray(ctx.input?.files)) {
        throw new errors.InputError("files must be an Array");
      }
      for (const file of ctx.input.files) {
        if (!file.file) {
          throw new errors.InputError("Path to file needs to be defined");
        }
        if (!file.find || !file.replaceWith) {
          throw new errors.InputError(
            "each file must have a find and replaceWith property"
          );
        }
        const sourceFilepath = backendPluginApi.resolveSafeChildPath(
          ctx.workspacePath,
          file.file
        );
        const content = fs__default.default.readFileSync(sourceFilepath).toString();
        let find = file.find;
        if (file.matchRegex) {
          find = new RegExp(file.find, "g");
        }
        const replacedContent = content.replaceAll(find, file.replaceWith);
        fs__default.default.writeFileSync(sourceFilepath, replacedContent);
      }
    }
  });
}

exports.createReplaceInFileAction = createReplaceInFileAction;
//# sourceMappingURL=replaceInFile.cjs.js.map
