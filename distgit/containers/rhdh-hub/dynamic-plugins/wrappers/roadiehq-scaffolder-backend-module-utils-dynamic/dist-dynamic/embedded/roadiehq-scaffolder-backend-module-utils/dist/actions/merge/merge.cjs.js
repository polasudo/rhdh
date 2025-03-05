'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var backendPluginApi = require('@backstage/backend-plugin-api');
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
const existPathInObject = (object, path, value) => {
  const keys = path.split(".");
  if (typeof object !== "object") {
    return false;
  }
  let current = object;
  for (const key of keys) {
    if (current[key] === void 0) {
      current = void 0;
      break;
    }
    current = current[key];
  }
  return current?.toString() === value;
};
function createMergeJSONAction({
  actionId
}) {
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
      const sourceFilepath = backendPluginApi.resolveSafeChildPath(
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
          useDocumentIncludingField: {
            type: "object",
            title: "Use Document Including Field",
            default: void 0,
            description: "This option is only applicable to YAML files. It allows you to specify a field to use as a key to find the document to merge into.",
            properties: {
              key: {
                title: "Key",
                description: "The key of the field to use to find the document to merge into.",
                type: "string"
              },
              value: {
                title: "Value",
                description: "The value of the field to use to find the document to merge into.",
                type: "string"
              }
            }
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
      const sourceFilepath = backendPluginApi.resolveSafeChildPath(
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
        case ".yaml":
          {
            const newContent = typeof ctx.input.content === "string" ? YAML__default.default.parse(ctx.input.content) : ctx.input.content;
            if (ctx.input.preserveYamlComments) {
              mergedContent = mergeContentPreserveComments(
                originalContent,
                newContent,
                ctx
              ).map((doc) => YAML__default.default.stringify(doc, ctx.input.options)).join("---\n");
            } else {
              mergedContent = mergeDocumentsRemovingComments(
                originalContent,
                newContent,
                ctx
              ).map((doc) => YAML__default.default.stringify(doc, ctx.input.options)).join("---\n");
            }
          }
          break;
      }
      if (!mergedContent) {
        return;
      }
      fs__default.default.writeFileSync(sourceFilepath, mergedContent);
      ctx.output("path", sourceFilepath);
    }
  });
}
function mergeDocumentsRemovingComments(originalContent, newContent, ctx) {
  const documents = YAML__default.default.parseAllDocuments(originalContent);
  checkDocumentExists(ctx, documents);
  if (documents.length === 1) {
    return [
      lodash.mergeWith(
        documents[0].toJSON(),
        newContent,
        ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
      )
    ];
  }
  checkUseDocumentIncludingFieldSet(ctx);
  const { key, value } = ctx.input.useDocumentIncludingField;
  return documents.map((document) => {
    let includingField = document.get(key);
    if (typeof includingField === "number") {
      includingField = includingField.toString();
    }
    if (typeof includingField !== "string") {
      ctx.logger.error(
        `The value at "${key}" defined in useDocumentIncludingField must be a string or a number.`
      );
      throw new Error(
        `The value at "${key}" defined in useDocumentIncludingField must be a string or a number.`
      );
    }
    if (includingField === value) {
      return lodash.mergeWith(
        document.toJSON(),
        newContent,
        ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
      );
    }
    return document.toJSON();
  });
}
function mergeContentPreserveComments(originalContent, newContent, ctx) {
  const yawns = splitYaml(originalContent).map(
    (document) => new YAWN__default.default(document)
  );
  checkDocumentExists(ctx, yawns);
  if (yawns.length === 1) {
    return [
      YAML__default.default.parseDocument(
        mergeYawn(yawns[0], newContent, ctx.input.mergeArrays).yaml
      )
    ];
  }
  checkUseDocumentIncludingFieldSet(ctx);
  const { key, value } = ctx.input.useDocumentIncludingField;
  return yawns.map(
    (yawn) => YAML__default.default.parseDocument(
      existPathInObject(yawn.json, key, value) ? mergeYawn(yawn, newContent, ctx.input.mergeArrays).yaml : yawn.yaml
    )
  );
}
function checkDocumentExists(ctx, documents) {
  if (documents.length === 0) {
    ctx.logger.error(
      `No documents found in the input content. Please provide a valid YAML file.`
    );
    throw new Error(
      `No documents found in the input content. Please provide a valid YAML file.`
    );
  }
}
function checkUseDocumentIncludingFieldSet(ctx) {
  if (!ctx.input.useDocumentIncludingField) {
    ctx.logger.error(
      `Multiple documents found in the input content. Please provide a key and value to use to find the document to merge into.`
    );
    throw new Error(
      `Multiple documents found in the input content. Please provide a key and value to use to find the document to merge into.`
    );
  }
}
function mergeYawn(yawn, newContent, mergeArrays) {
  const parsedOriginal = yawn.json;
  yawn.json = lodash.mergeWith(
    parsedOriginal,
    newContent,
    mergeArrays ? mergeArrayCustomiser : void 0
  );
  return yawn;
}
function splitYaml(originalContent) {
  return originalContent.split(/^---\s*$/m).filter((doc) => doc.trim() !== "");
}

exports.createMergeAction = createMergeAction;
exports.createMergeJSONAction = createMergeJSONAction;
//# sourceMappingURL=merge.cjs.js.map
