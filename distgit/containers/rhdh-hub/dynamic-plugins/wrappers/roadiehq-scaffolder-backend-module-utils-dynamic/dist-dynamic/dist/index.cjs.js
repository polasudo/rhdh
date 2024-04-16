'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/plugin-scaffolder-backend');
var require$$2 = require('@backstage/errors');
var require$$3 = require('adm-zip');
var require$$4 = require('fs-extra');
var require$$5 = require('yaml');
var require$$6 = require('@backstage/plugin-scaffolder-node');
var require$$7 = require('path');
var require$$8 = require('lodash');
var require$$9 = require('detect-indent');
var require$$10 = require('jsonata');

var backendCommon = require$$0;
var pluginScaffolderBackend = require$$1;
var errors = require$$2;
var AdmZip = require$$3;
var fs = require$$4;
var YAML = require$$5;
var pluginScaffolderNode = require$$6;
var path = require$$7;
var lodash = require$$8;
var detectIndent = require$$9;
var jsonata = require$$10;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var AdmZip__default = /*#__PURE__*/_interopDefaultCompat(AdmZip);
var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var YAML__default = /*#__PURE__*/_interopDefaultCompat(YAML);
var detectIndent__default = /*#__PURE__*/_interopDefaultCompat(detectIndent);
var jsonata__default = /*#__PURE__*/_interopDefaultCompat(jsonata);

function createZipAction() {
  return pluginScaffolderBackend.createTemplateAction({
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
      const sourceFilepath = backendCommon.resolveSafeChildPath(
        ctx.workspacePath,
        ctx.input.path
      );
      const destFilepath = backendCommon.resolveSafeChildPath(
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

function createWriteFileAction() {
  return pluginScaffolderBackend.createTemplateAction({
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
      const destFilepath = backendCommon.resolveSafeChildPath(
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

function createAppendFileAction() {
  return pluginScaffolderBackend.createTemplateAction({
    id: "roadiehq:utils:fs:append",
    description: "Append content to the end of the given file, it will create the file if it does not exist.",
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
      var _a;
      if (!Array.isArray((_a = ctx.input) == null ? void 0 : _a.files)) {
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
        const sourceFilepath = backendCommon.resolveSafeChildPath(
          ctx.workspacePath,
          file.file
        );
        const content = fs__default.default.readFileSync(sourceFilepath).toString();
        const replacedContent = content.replaceAll(file.find, file.replaceWith);
        fs__default.default.writeFileSync(sourceFilepath, replacedContent);
      }
    }
  });
}

const yamlOptionsSchema = {
  title: "Options",
  description: "YAML stringify options",
  type: "object",
  properties: {
    indent: {
      description: "(default: 2) - indentation width to use (in spaces)",
      type: "number"
    },
    noArrayIndent: {
      description: "(default: false) - when true, will not add an indentation level to array elements",
      type: "boolean"
    },
    skipInvalid: {
      description: "(default: false) - do not throw on invalid types (like function in the safe schema) and skip pairs and single values with such types",
      type: "boolean"
    },
    flowLevel: {
      description: "(default: -1) - specifies level of nesting, when to switch from block to flow style for collections. -1 means block style everwhere",
      type: "number"
    },
    sortKeys: {
      description: "(default: false) - if true, sort keys when dumping YAML. If a function, use the function to sort the keys",
      type: "boolean"
    },
    lineWidth: {
      description: "(default: 80) - set max line width. Set -1 for unlimited width",
      type: "number"
    },
    noRefs: {
      description: "(default: false) - if true, don't convert duplicate objects into references",
      type: "boolean"
    },
    noCompatMode: {
      description: `(default: false) - if true don't try to be compatible with older yaml versions. Currently: don't quote "yes", "no" and so on, as required for YAML 1.1`,
      type: "boolean"
    },
    condenseFlow: {
      description: `(default: false) - if true flow sequences will be condensed, omitting the space between a, b. Eg. '[a,b]', and omitting the space between key: value and quoting the key. Eg. '{"a":b}' Can be useful when using yaml for pretty URL query params as spaces are %-encoded.`,
      type: "boolean"
    },
    quotingType: {
      description: `(' or ", default: ') - strings will be quoted using this quoting style. If you specify single quotes, double quotes will still be used for non-printable characters.`,
      type: "string"
    },
    forceQuotes: {
      description: "(default: false) - if true, all non-key strings will be quoted even if they normally don't need to.",
      type: "boolean"
    }
  }
};

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
          options: {
            ...yamlOptionsSchema,
            description: `${yamlOptionsSchema.description}  (for YAML output only)`
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
          mergedContent = YAML__default.default.stringify(
            lodash.mergeWith(
              YAML__default.default.parse(originalContent),
              newContent,
              ctx.input.mergeArrays ? mergeArrayCustomiser : void 0
            ),
            ctx.input.options
          );
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

function createSleepAction(options) {
  return pluginScaffolderBackend.createTemplateAction({
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
      var _a;
      if (isNaN((_a = ctx.input) == null ? void 0 : _a.amount)) {
        throw new errors.InputError("amount must be a number");
      } else if ((options == null ? void 0 : options.maxSleep) && ctx.input.amount > options.maxSleep) {
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

function createJSONataAction() {
  return pluginScaffolderBackend.createTemplateAction({
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
        const expression = jsonata__default.default(ctx.input.expression);
        const result = expression.evaluate(ctx.input.data);
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

function createYamlJSONataTransformAction() {
  return pluginScaffolderBackend.createTemplateAction({
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
          options: yamlOptionsSchema
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
      const sourceFilepath = backendCommon.resolveSafeChildPath(
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
      const result = expression.evaluate(data);
      ctx.output("result", resultHandler(result));
    }
  });
}

function createJsonJSONataTransformAction() {
  return pluginScaffolderBackend.createTemplateAction({
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
      const result = expression.evaluate(data);
      ctx.output("result", resultHandler(result));
    }
  });
}

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
          options: yamlOptionsSchema
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

var createAppendFileAction_1 = createAppendFileAction;
var createJSONataAction_1 = createJSONataAction;
var createJsonJSONataTransformAction_1 = createJsonJSONataTransformAction;
var createMergeAction_1 = createMergeAction;
var createMergeJSONAction_1 = createMergeJSONAction;
var createParseFileAction_1 = createParseFileAction;
var createReplaceInFileAction_1 = createReplaceInFileAction;
var createSerializeJsonAction_1 = createSerializeJsonAction;
var createSerializeYamlAction_1 = createSerializeYamlAction;
var createSleepAction_1 = createSleepAction;
var createWriteFileAction_1 = createWriteFileAction;
var createYamlJSONataTransformAction_1 = createYamlJSONataTransformAction;
var createZipAction_1 = createZipAction;

const scaffolderBackendModuleUtils = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-module-utils",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery
      },
      async init({ scaffolder }) {
        for (const action of [
          createZipAction_1,
          createSleepAction_1,
          createWriteFileAction_1,
          createAppendFileAction_1,
          createMergeJSONAction_1,
          createMergeAction_1,
          createParseFileAction_1,
          createReplaceInFileAction_1,
          createSerializeYamlAction_1,
          createSerializeJsonAction_1,
          createJSONataAction_1,
          createYamlJSONataTransformAction_1,
          createJsonJSONataTransformAction_1
        ]) {
          scaffolder.addActions(action({}));
        }
      }
    });
  }
});

exports["default"] = scaffolderBackendModuleUtils;
//# sourceMappingURL=index.cjs.js.map
