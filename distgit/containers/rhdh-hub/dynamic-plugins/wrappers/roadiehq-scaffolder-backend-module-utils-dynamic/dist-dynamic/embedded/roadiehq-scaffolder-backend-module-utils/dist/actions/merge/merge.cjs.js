'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var backendCommon = require('@backstage/backend-common');
var fs = require('fs-extra');
var path = require('path');
var lodash = require('lodash');
var YAML = require('yaml');
var YAWN = require('yawn-yaml');
var types = require('../../types.cjs.js');
var detectIndent = require('detect-indent');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var YAML__default = /*#__PURE__*/_interopDefaultCompat(YAML);
var YAWN__default = /*#__PURE__*/_interopDefaultCompat(YAWN);
var detectIndent__default = /*#__PURE__*/_interopDefaultCompat(detectIndent);

function mergeArrayCustomiser(objValue, srcValue) {
  if (lodash.isArray(objValue) && !lodash.isNull(objValue)) {
    return Array.from(new Set(objValue.concat(srcValue)));
  }
  return void 0;
}
function createMergeJSONAction({ actionId }) {
  return pluginScaffolderNode.createTemplateAction({
    id: actionId || "roadiehq:utils:json:merge",
    description: "Merge new data into an existing JSON file.",
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
            description: "This will be merged into to the file. Can be either an object or a string.",
            title: "Content",
            type: ["string", "object"]
          },
          mergeArrays: {
            type: "boolean",
            default: false,
            title: "Merge Arrays?",
            description: "Where a value is an array the merge function should concatenate the provided array value with the target array"
          },
          matchFileIndent: {
            type: "boolean",
            default: false,
            title: "Match file indent?",
            description: "Make the output file indentation match that of the specified input file."
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
      let existingContent;
      if (fs__default.default.existsSync(sourceFilepath)) {
        existingContent = JSON.parse(
          fs__default.default.readFileSync(sourceFilepath).toString()
        );
      } else {
        ctx.logger.info(
          `The file ${sourceFilepath} does not exist, creating it.`
        );
        existingContent = {};
      }
      const content = typeof ctx.input.content === "string" ? JSON.parse(ctx.input.content) : ctx.input.content;
      let fileIndent = 2;
      if (ctx.input.matchFileIndent) {
        fileIndent = detectIndent__default.default(
          fs__default.default.readFileSync(sourceFilepath, "utf8")
        ).amount;
        if (!fileIndent) {
          fileIndent = 2;
          ctx.logger.info(
            `Failed to detect source file indentation, using default value of 2.`
          );
        }
      }
      fs__default.default.writeFileSync(
        sourceFilepath,
        JSON.stringify(
          lodash.mergeWith(
            existingContent,
            content,
            ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
          ),
          null,
          fileIndent
        )
      );
      ctx.output("path", sourceFilepath);
    }
  });
}
function createMergeAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:merge",
    description: "Merges data into an existing structured file.",
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
            description: "This will be merged into to the file. Can be either an object or a string.",
            title: "Content",
            type: ["string", "object"]
          },
          mergeArrays: {
            type: "boolean",
            default: false,
            title: "Merge Arrays?",
            description: "Where a value is an array the merge function should concatenate the provided array value with the target array"
          },
          preserveYamlComments: {
            type: "boolean",
            default: false,
            title: "Preserve Comments?",
            description: "Will preserve standalone and inline comments in YAML files"
          },
          options: {
            ...types.yamlOptionsSchema,
            description: `${types.yamlOptionsSchema.description}  (for YAML output only)`
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
      if (!fs__default.default.existsSync(sourceFilepath)) {
        ctx.logger.error(`The file ${sourceFilepath} does not exist.`);
        throw new Error(`The file ${sourceFilepath} does not exist.`);
      }
      const originalContent = fs__default.default.readFileSync(sourceFilepath).toString();
      let mergedContent;
      switch (path.extname(sourceFilepath)) {
        case ".json": {
          const newContent = typeof ctx.input.content === "string" ? JSON.parse(ctx.input.content) : ctx.input.content;
          mergedContent = JSON.stringify(
            lodash.mergeWith(
              YAML__default.default.parse(originalContent),
              newContent,
              ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
            ),
            null,
            2
          );
          break;
        }
        case ".yml":
        case ".yaml": {
          const newContent = typeof ctx.input.content === "string" ? YAML__default.default.parse(ctx.input.content) : ctx.input.content;
          if (ctx.input.preserveYamlComments) {
            const yawn = new YAWN__default.default(originalContent);
            const parsedOriginal = yawn.json;
            const mergedJsonContent = lodash.mergeWith(
              parsedOriginal,
              newContent,
              ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
            );
            yawn.json = mergedJsonContent;
            mergedContent = YAML__default.default.stringify(
              YAML__default.default.parseDocument(yawn.yaml),
              ctx.input.options
            );
          } else {
            mergedContent = YAML__default.default.stringify(
              lodash.mergeWith(
                YAML__default.default.parse(originalContent),
                newContent,
                ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
              ),
              ctx.input.options
            );
          }
          break;
        }
      }
      if (!mergedContent) {
        return;
      }
      fs__default.default.writeFileSync(sourceFilepath, mergedContent);
      ctx.output("path", sourceFilepath);
    }
  });
}

exports.createMergeAction = createMergeAction;
exports.createMergeJSONAction = createMergeJSONAction;
//# sourceMappingURL=merge.cjs.js.map
