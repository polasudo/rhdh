'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$1 = require('@backstage/backend-common');
var require$$0 = require('@backstage/plugin-scaffolder-backend');
var require$$2 = require('@backstage/errors');
var require$$3 = require('adm-zip');
var require$$2$1 = require('fs-extra');
var require$$3$1 = require('yaml');
var require$$0$1 = require('@backstage/plugin-scaffolder-node');
var require$$3$2 = require('path');
var require$$4 = require('lodash');
var require$$6 = require('yawn-yaml');
var require$$8 = require('detect-indent');
var require$$1$1 = require('jsonata');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$1$2 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var zip_cjs = {};

var backendCommon$7 = require$$1;
var pluginScaffolderBackend$8 = require$$0;
var errors$2 = require$$2;
var AdmZip = require$$3;
var fs$7 = require$$2$1;

function _interopDefaultCompat$9 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var AdmZip__default = /*#__PURE__*/_interopDefaultCompat$9(AdmZip);
var fs__default$7 = /*#__PURE__*/_interopDefaultCompat$9(fs$7);

function createZipAction() {
  return pluginScaffolderBackend$8.createTemplateAction({
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
      const sourceFilepath = backendCommon$7.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      const destFilepath = backendCommon$7.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.outputPath
      );
      if (!fs__default$7.default.existsSync(sourceFilepath)) {
        throw new errors$2.InputError(
          `File ${ctx.input.path} does not exist. Can't zip it.`
        );
      }
      if (fs__default$7.default.lstatSync(sourceFilepath).isDirectory()) {
        zip.addLocalFolder(sourceFilepath);
      } else if (fs__default$7.default.lstatSync(sourceFilepath).isFile()) {
        zip.addLocalFile(sourceFilepath);
      }
      zip.writeZip(destFilepath);
      ctx.output("outputPath", ctx.input.outputPath);
    }
  });
}

zip_cjs.createZipAction = createZipAction;

var writeFile_cjs = {};

var pluginScaffolderBackend$7 = require$$0;
var backendCommon$6 = require$$1;
var fs$6 = require$$2$1;

function _interopDefaultCompat$8 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$6 = /*#__PURE__*/_interopDefaultCompat$8(fs$6);

function createWriteFileAction() {
  return pluginScaffolderBackend$7.createTemplateAction({
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
      const destFilepath = backendCommon$6.resolveSafeChildPath(
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
      fs__default$6.default.outputFileSync(destFilepath, formattedContent);
      ctx.output("path", destFilepath);
    }
  });
}

writeFile_cjs.createWriteFileAction = createWriteFileAction;

var appendFile_cjs = {};

var pluginScaffolderBackend$6 = require$$0;
var backendCommon$5 = require$$1;
var fs$5 = require$$2$1;

function _interopDefaultCompat$7 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$5 = /*#__PURE__*/_interopDefaultCompat$7(fs$5);

function createAppendFileAction() {
  return pluginScaffolderBackend$6.createTemplateAction({
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
      const sourceFilepath = backendCommon$5.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      fs__default$5.default.appendFileSync(sourceFilepath, ctx.input.content);
      ctx.output("path", sourceFilepath);
    }
  });
}

appendFile_cjs.createAppendFileAction = createAppendFileAction;

var parseFile_cjs = {};

var pluginScaffolderBackend$5 = require$$0;
var backendCommon$4 = require$$1;
var fs$4 = require$$2$1;
var YAML$3 = require$$3$1;

function _interopDefaultCompat$6 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$4 = /*#__PURE__*/_interopDefaultCompat$6(fs$4);
var YAML__default$3 = /*#__PURE__*/_interopDefaultCompat$6(YAML$3);

const parsers = {
  yaml: (cnt) => YAML__default$3.default.parse(cnt),
  json: (cnt) => JSON.parse(cnt),
  multiyaml: (cnt) => YAML__default$3.default.parseAllDocuments(cnt).map((doc) => doc.toJSON())
};
function createParseFileAction() {
  return pluginScaffolderBackend$5.createTemplateAction({
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
      const sourceFilepath = backendCommon$4.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      const parserName = ctx.input.parser;
      let parser = (content2) => content2;
      if (parserName) {
        parser = parsers[parserName];
      }
      const content = parser(
        fs__default$4.default.readFileSync(sourceFilepath).toString()
      );
      ctx.output("content", content);
    }
  });
}

parseFile_cjs.createParseFileAction = createParseFileAction;

var replaceInFile_cjs = {};

var pluginScaffolderNode$2 = require$$0$1;
var fs$3 = require$$2$1;
var errors$1 = require$$2;
var backendCommon$3 = require$$1;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$3 = /*#__PURE__*/_interopDefaultCompat$5(fs$3);

function createReplaceInFileAction() {
  return pluginScaffolderNode$2.createTemplateAction({
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
        throw new errors$1.InputError("files must be an Array");
      }
      for (const file of ctx.input.files) {
        if (!file.file) {
          throw new errors$1.InputError("Path to file needs to be defined");
        }
        if (!file.find || !file.replaceWith) {
          throw new errors$1.InputError(
            "each file must have a find and replaceWith property"
          );
        }
        const sourceFilepath = backendCommon$3.resolveSafeChildPath(
          ctx.workspacePath,
          file.file
        );
        const content = fs__default$3.default.readFileSync(sourceFilepath).toString();
        let find = file.find;
        if (file.matchRegex) {
          find = new RegExp(file.find, "g");
        }
        const replacedContent = content.replaceAll(find, file.replaceWith);
        fs__default$3.default.writeFileSync(sourceFilepath, replacedContent);
      }
    }
  });
}

replaceInFile_cjs.createReplaceInFileAction = createReplaceInFileAction;

var merge_cjs = {};

var types_cjs = {};

const yamlOptionsSchema = {
  title: "Options",
  description: "YAML stringify options",
  type: "object",
  properties: {
    blockQuote: {
      description: "(default: true) - use block quote styles for scalar values where applicable",
      type: "boolean | 'folded' | 'literal'"
    },
    collectionStyle: {
      description: "(default: 'any') - enforce 'block' or 'flow' style on maps and sequences. By default, allows each collection to set its own flow: boolean property",
      type: "'any' | 'block' | 'flow'"
    },
    defaultKeyType: {
      description: "(default: null) - if not null, overrides defaultStringType for implicit key values",
      type: "'BLOCK_FOLDED' \u23AE 'BLOCK_LITERAL' \u23AE 'QUOTE_DOUBLE' \u23AE 'QUOTE_SINGLE' \u23AE 'PLAIN' \u23AE null"
    },
    defaultStringType: {
      description: "(default: 'PLAIN') - the default type of string literal used to stringify values",
      type: "'BLOCK_FOLDED' \u23AE 'BLOCK_LITERAL' \u23AE 'QUOTE_DOUBLE' \u23AE 'QUOTE_SINGLE' \u23AE 'PLAIN'"
    },
    directives: {
      description: "(default: null) - include directives in the output. If true, at least the document-start marker --- is always included. If false, no directives or marker is ever included. If null, directives and marker may be included if required",
      type: "boolean | null"
    },
    doubleQuotedAsJSON: {
      description: "(default: false) - if true, restrict double-quoted strings to use JSON-compatible syntax",
      type: "boolean"
    },
    doubleQuotedMinMultiLineLength: {
      description: "(default: 40) - minimum length for double-quoted strings to use multiple lines to represent the value instead of escaping newlines",
      type: "number"
    },
    falseStr: {
      description: "(default: 'false') - string representation for false boolean values",
      type: "string"
    },
    flowCollectionPadding: {
      description: "(default: true) - if true, a single space of padding will be added inside the delimiters of non-empty single-line flow collections",
      type: "boolean"
    },
    indent: {
      description: "(default: 2) - the number of spaces to use when indenting code. Should be a strictly positive integer",
      type: "number"
    },
    indentSeq: {
      description: "(default: true) - if true, block sequences should be indented",
      type: "boolean"
    },
    lineWidth: {
      description: "(default: 80) -maximum line width (set to 0 to disable folding). This is a soft limit, as only double-quoted semantics allow for inserting a line break in the middle of a word ",
      type: "number"
    },
    minContentWidth: {
      description: "(default: 20) - minimum line width for highly-indented content (set to 0 to disable)",
      type: "number"
    },
    nullStr: {
      description: "(default: 'null') - string representation for null values",
      type: "number"
    },
    simpleKeys: {
      description: "(default: false) - if true, require keys to be scalars and always use implicit rather than explicit notation",
      type: "boolean"
    },
    singleQuote: {
      description: "(default: null) - Use single quote rather than double quote where applicable. Set to false to disable single quotes completely",
      type: "boolean | null"
    },
    trueStr: {
      description: "(default: 'true') - string representation for true boolean values",
      type: "string"
    }
  }
};

types_cjs.yamlOptionsSchema = yamlOptionsSchema;

var pluginScaffolderNode$1 = require$$0$1;
var backendCommon$2 = require$$1;
var fs$2 = require$$2$1;
var path = require$$3$2;
var lodash = require$$4;
var YAML$2 = require$$3$1;
var YAWN = require$$6;
var types$2 = types_cjs;
var detectIndent = require$$8;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$2 = /*#__PURE__*/_interopDefaultCompat$4(fs$2);
var YAML__default$2 = /*#__PURE__*/_interopDefaultCompat$4(YAML$2);
var YAWN__default = /*#__PURE__*/_interopDefaultCompat$4(YAWN);
var detectIndent__default = /*#__PURE__*/_interopDefaultCompat$4(detectIndent);

function mergeArrayCustomiser(objValue, srcValue) {
  if (lodash.isArray(objValue) && !lodash.isNull(objValue)) {
    return Array.from(new Set(objValue.concat(srcValue)));
  }
  return void 0;
}
function createMergeJSONAction({ actionId }) {
  return pluginScaffolderNode$1.createTemplateAction({
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
      const sourceFilepath = backendCommon$2.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      let existingContent;
      if (fs__default$2.default.existsSync(sourceFilepath)) {
        existingContent = JSON.parse(
          fs__default$2.default.readFileSync(sourceFilepath).toString()
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
          fs__default$2.default.readFileSync(sourceFilepath, "utf8")
        ).amount;
        if (!fileIndent) {
          fileIndent = 2;
          ctx.logger.info(
            `Failed to detect source file indentation, using default value of 2.`
          );
        }
      }
      fs__default$2.default.writeFileSync(
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
  return pluginScaffolderNode$1.createTemplateAction({
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
            ...types$2.yamlOptionsSchema,
            description: `${types$2.yamlOptionsSchema.description}  (for YAML output only)`
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
      const sourceFilepath = backendCommon$2.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      if (!fs__default$2.default.existsSync(sourceFilepath)) {
        ctx.logger.error(`The file ${sourceFilepath} does not exist.`);
        throw new Error(`The file ${sourceFilepath} does not exist.`);
      }
      const originalContent = fs__default$2.default.readFileSync(sourceFilepath).toString();
      let mergedContent;
      switch (path.extname(sourceFilepath)) {
        case ".json": {
          const newContent = typeof ctx.input.content === "string" ? JSON.parse(ctx.input.content) : ctx.input.content;
          mergedContent = JSON.stringify(
            lodash.mergeWith(
              YAML__default$2.default.parse(originalContent),
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
          const newContent = typeof ctx.input.content === "string" ? YAML__default$2.default.parse(ctx.input.content) : ctx.input.content;
          if (ctx.input.preserveYamlComments) {
            const yawn = new YAWN__default.default(originalContent);
            const parsedOriginal = yawn.json;
            const mergedJsonContent = lodash.mergeWith(
              parsedOriginal,
              newContent,
              ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
            );
            yawn.json = mergedJsonContent;
            mergedContent = YAML__default$2.default.stringify(
              YAML__default$2.default.parseDocument(yawn.yaml),
              ctx.input.options
            );
          } else {
            mergedContent = YAML__default$2.default.stringify(
              lodash.mergeWith(
                YAML__default$2.default.parse(originalContent),
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
      fs__default$2.default.writeFileSync(sourceFilepath, mergedContent);
      ctx.output("path", sourceFilepath);
    }
  });
}

merge_cjs.createMergeAction = createMergeAction;
merge_cjs.createMergeJSONAction = createMergeJSONAction;

var sleep_cjs = {};

var pluginScaffolderBackend$4 = require$$0;
var errors = require$$2;

function createSleepAction(options) {
  return pluginScaffolderBackend$4.createTemplateAction({
    id: "roadiehq:utils:sleep",
    description: "Halts the scaffolding for the given amount of seconds",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["amount"],
        properties: {
          amount: {
            title: "Sleep Amount",
            description: "How much seconds should this step take.",
            type: "number"
          }
        }
      }
    },
    async handler(ctx) {
      if (isNaN(ctx.input?.amount)) {
        throw new errors.InputError("amount must be a number");
      } else if (options?.maxSleep && ctx.input.amount > options.maxSleep) {
        throw new errors.InputError(
          `sleep amount can not be greater than maxSleep. amount: ${ctx.input.amount}, maxSleep: ${options.maxSleep}`
        );
      }
      ctx.logger.info(`Waiting ${ctx.input.amount} seconds`);
      await new Promise((resolve) => {
        setTimeout(resolve, ctx.input.amount * 1e3);
      });
    }
  });
}

sleep_cjs.createSleepAction = createSleepAction;

var jsonata_cjs = {};

var pluginScaffolderBackend$3 = require$$0;
var jsonata$4 = require$$1$1;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var jsonata__default$2 = /*#__PURE__*/_interopDefaultCompat$3(jsonata$4);

function createJSONataAction() {
  return pluginScaffolderBackend$3.createTemplateAction({
    id: "roadiehq:utils:jsonata",
    description: "Allows performing JSONata operations and transformations on input objects and produces the output result as a step output.",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["data", "expression"],
        properties: {
          data: {
            title: "Data",
            description: "Input data to be transformed",
            type: [
              "object",
              "array",
              "string",
              "number",
              "integer",
              "boolean",
              "null"
            ]
          },
          expression: {
            title: "Expression",
            description: "JSONata expression to perform on the input",
            type: "string"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          result: {
            title: "Output result from JSONata",
            type: "object"
          }
        }
      }
    },
    async handler(ctx) {
      try {
        const expression = jsonata__default$2.default(ctx.input.expression);
        const result = await expression.evaluate(ctx.input.data);
        ctx.output("result", result);
      } catch (e) {
        const message = e.hasOwnProperty("message") ? e.message : "unknown JSONata evaluation error";
        throw new Error(
          `JSONata failed to evaluate the expression: ${message}`
        );
      }
    }
  });
}

jsonata_cjs.createJSONataAction = createJSONataAction;

var yaml_cjs$1 = {};

var pluginScaffolderBackend$2 = require$$0;
var jsonata$3 = require$$1$1;
var backendCommon$1 = require$$1;
var fs$1 = require$$2$1;
var YAML$1 = require$$3$1;
var types$1 = types_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var jsonata__default$1 = /*#__PURE__*/_interopDefaultCompat$2(jsonata$3);
var fs__default$1 = /*#__PURE__*/_interopDefaultCompat$2(fs$1);
var YAML__default$1 = /*#__PURE__*/_interopDefaultCompat$2(YAML$1);

function createYamlJSONataTransformAction() {
  return pluginScaffolderBackend$2.createTemplateAction({
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
          options: types$1.yamlOptionsSchema
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
        resultHandler = (rz) => YAML__default$1.default.stringify(rz, ctx.input.options);
      }
      const sourceFilepath = backendCommon$1.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      let data;
      if (ctx.input.loadAll) {
        data = YAML__default$1.default.parseAllDocuments(
          fs__default$1.default.readFileSync(sourceFilepath).toString()
        ).map((doc) => doc.toJSON());
      } else {
        data = YAML__default$1.default.parse(fs__default$1.default.readFileSync(sourceFilepath).toString());
      }
      const expression = jsonata__default$1.default(ctx.input.expression);
      const result = await expression.evaluate(data);
      ctx.output("result", resultHandler(result));
    }
  });
}

yaml_cjs$1.createYamlJSONataTransformAction = createYamlJSONataTransformAction;

var json_cjs$1 = {};

var pluginScaffolderBackend$1 = require$$0;
var jsonata$2 = require$$1$1;
var backendCommon = require$$1;
var fs = require$$2$1;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var jsonata__default = /*#__PURE__*/_interopDefaultCompat$1(jsonata$2);
var fs__default = /*#__PURE__*/_interopDefaultCompat$1(fs);

function createJsonJSONataTransformAction() {
  return pluginScaffolderBackend$1.createTemplateAction({
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
      const sourceFilepath = backendCommon.resolveSafeChildPath(
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

json_cjs$1.createJsonJSONataTransformAction = createJsonJSONataTransformAction;

var json_cjs = {};

var pluginScaffolderBackend = require$$0;

function createSerializeJsonAction() {
  return pluginScaffolderBackend.createTemplateAction({
    id: "roadiehq:utils:serialize:json",
    description: "Allows performing serialization on an object",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            title: "Data",
            description: "Input data to perform seriazation on.",
            type: "object"
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
        type: "string",
        properties: {
          serialized: {
            title: "Output result from serialization",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      ctx.output(
        "serialized",
        JSON.stringify(ctx.input.data, ctx.input.replacer, ctx.input.space)
      );
    }
  });
}

json_cjs.createSerializeJsonAction = createSerializeJsonAction;

var yaml_cjs = {};

var pluginScaffolderNode = require$$0$1;
var YAML = require$$3$1;
var types = types_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var YAML__default = /*#__PURE__*/_interopDefaultCompat(YAML);

function createSerializeYamlAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "roadiehq:utils:serialize:yaml",
    description: "Allows performing serialization on an object",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            title: "Data",
            description: "Input data to perform seriazation on.",
            type: "object"
          },
          replacer: {
            title: "Replacer",
            description: "Replacer array",
            type: "array",
            items: {
              type: "string"
            }
          },
          options: types.yamlOptionsSchema
        }
      },
      output: {
        type: "string",
        properties: {
          serialized: {
            title: "Output result from serialization",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      ctx.output(
        "serialized",
        YAML__default.default.stringify(ctx.input.data, ctx.input.options)
      );
    }
  });
}

yaml_cjs.createSerializeYamlAction = createSerializeYamlAction;

var module_cjs = {};

var backendPluginApi = require$$0$2;
var alpha = require$$1$2;
var zip$1 = zip_cjs;
var writeFile$1 = writeFile_cjs;
var appendFile$1 = appendFile_cjs;
var parseFile$1 = parseFile_cjs;
var replaceInFile$1 = replaceInFile_cjs;
var merge$1 = merge_cjs;
var sleep$1 = sleep_cjs;
var jsonata$1 = jsonata_cjs;
var yaml$1$1 = yaml_cjs$1;
var json$2 = json_cjs$1;
var json$1$1 = json_cjs;
var yaml$2 = yaml_cjs;

const scaffolderBackendModuleUtils = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "scaffolder-backend-module-utils",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(
          appendFile$1.createAppendFileAction(),
          jsonata$1.createJSONataAction(),
          json$2.createJsonJSONataTransformAction(),
          merge$1.createMergeAction(),
          merge$1.createMergeJSONAction({}),
          parseFile$1.createParseFileAction(),
          replaceInFile$1.createReplaceInFileAction(),
          json$1$1.createSerializeJsonAction(),
          yaml$2.createSerializeYamlAction(),
          sleep$1.createSleepAction(),
          writeFile$1.createWriteFileAction(),
          yaml$1$1.createYamlJSONataTransformAction(),
          zip$1.createZipAction()
        );
      }
    });
  }
});

module_cjs.scaffolderBackendModuleUtils = scaffolderBackendModuleUtils;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var zip = zip_cjs;
var writeFile = writeFile_cjs;
var appendFile = appendFile_cjs;
var parseFile = parseFile_cjs;
var replaceInFile = replaceInFile_cjs;
var merge = merge_cjs;
var sleep = sleep_cjs;
var jsonata = jsonata_cjs;
var yaml = yaml_cjs$1;
var json = json_cjs$1;
var json$1 = json_cjs;
var yaml$1 = yaml_cjs;
var module$1 = module_cjs;



index_cjs.createZipAction = zip.createZipAction;
index_cjs.createWriteFileAction = writeFile.createWriteFileAction;
index_cjs.createAppendFileAction = appendFile.createAppendFileAction;
index_cjs.createParseFileAction = parseFile.createParseFileAction;
index_cjs.createReplaceInFileAction = replaceInFile.createReplaceInFileAction;
index_cjs.createMergeAction = merge.createMergeAction;
index_cjs.createMergeJSONAction = merge.createMergeJSONAction;
index_cjs.createSleepAction = sleep.createSleepAction;
index_cjs.createJSONataAction = jsonata.createJSONataAction;
index_cjs.createYamlJSONataTransformAction = yaml.createYamlJSONataTransformAction;
index_cjs.createJsonJSONataTransformAction = json.createJsonJSONataTransformAction;
index_cjs.createSerializeJsonAction = json$1.createSerializeJsonAction;
index_cjs.createSerializeYamlAction = yaml$1.createSerializeYamlAction;
var _default = index_cjs.default = module$1.scaffolderBackendModuleUtils;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
