'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var errors = require('@backstage/errors');
var AdmZip = require('adm-zip');
var fs = require('fs-extra');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var AdmZip__default = /*#__PURE__*/_interopDefaultCompat(AdmZip);
var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

function createZipAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:zip",
    description: "Zips the content of the path",
    supportsDryRun: true,
    schema: {
      input: {
        required: ["path"],
        type: "object",
        properties: {
          path: {
            title: "Path",
            description: "Relative path you would like to zip",
            type: "string"
          },
          outputPath: {
            title: "Output Path",
            description: "The name of the result of the zip command",
            type: "string"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          outputPath: {
            title: "Zip Path",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const zip = new AdmZip__default.default();
      const sourceFilepath = backendPluginApi.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      const destFilepath = backendPluginApi.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.outputPath
      );
      if (!fs__default.default.existsSync(sourceFilepath)) {
        throw new errors.InputError(
          `File ${ctx.input.path} does not exist. Can't zip it.`
        );
      }
      if (fs__default.default.lstatSync(sourceFilepath).isDirectory()) {
        zip.addLocalFolder(sourceFilepath);
      } else if (fs__default.default.lstatSync(sourceFilepath).isFile()) {
        zip.addLocalFile(sourceFilepath);
      }
      zip.writeZip(destFilepath);
      ctx.output("outputPath", ctx.input.outputPath);
    }
  });
}

exports.createZipAction = createZipAction;
//# sourceMappingURL=zip.cjs.js.map
