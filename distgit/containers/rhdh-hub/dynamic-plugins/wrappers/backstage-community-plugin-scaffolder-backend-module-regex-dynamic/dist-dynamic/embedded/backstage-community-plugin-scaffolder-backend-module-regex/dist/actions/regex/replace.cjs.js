'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var yaml = require('yaml');
var zod = require('zod');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);

const schemaInput = zod.z.object({
  regExps: zod.z.array(
    zod.z.object({
      pattern: zod.z.string().refine(
        // You should not parse a regex (regular language) with a regex (regular language),
        // you actually need a context free grammar to parse a regex (regular language).
        // Hence, we are using a string comparison here.
        (value) => !value.startsWith("/") && !value.endsWith("/"),
        {
          message: "The RegExp constructor cannot take a string pattern with a leading and trailing forward slash."
        }
      ).describe(
        "The regex pattern to match the value like in String.prototype.replace()"
      ),
      flags: zod.z.array(
        // Prefer array over set here because input values are normally defined in YAML which doesn't support Sets.
        zod.z.enum(["g", "m", "i", "y", "u", "s", "d"], {
          invalid_type_error: "Invalid flag, possible values are: g, m, i, y, u, s, d"
        })
      ).optional().describe("The flags for the regex"),
      replacement: zod.z.string().describe(
        "The replacement value for the regex like in String.prototype.replace()"
      ),
      values: zod.z.array(
        zod.z.object({
          key: zod.z.string().describe("The key to access the regex value"),
          value: zod.z.string().describe("The input value of the regex")
        })
      )
    })
  )
});
const exampleValue = "The quick brown fox jumps over the lazy dog. If the dog reacted, was it really lazy?";
const id = "regex:replace";
const examples = [
  {
    description: "Create a regex to capture the first word of a string",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "regexValues",
          action: id,
          name: "Regex Values",
          input: {
            regExps: [
              {
                pattern: "^(\\S+).*$",
                replacement: "$1",
                values: [
                  { key: "eg1", value: "Hello world!" },
                  { key: "eg2", value: "Test world!" }
                ]
              }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Create a regex to replace a word in a string",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "regexValues",
          action: id,
          name: "Regex Values",
          input: {
            regExps: [
              {
                pattern: "dog",
                replacement: "monkey",
                values: [
                  {
                    key: "eg1",
                    value: exampleValue
                  }
                ]
              },
              {
                pattern: "Dog",
                replacement: "ferret",
                flags: ["i"],
                values: [
                  {
                    key: "eg2",
                    value: exampleValue
                  }
                ]
              }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Create a regex to replace a word globally in a string",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "regexValues",
          action: id,
          name: "Regex Values",
          input: {
            regExps: [
              {
                pattern: "dog",
                replacement: "monkey",
                flags: ["g"],
                values: [
                  {
                    key: "eg1",
                    value: exampleValue
                  }
                ]
              },
              {
                pattern: "Dog",
                replacement: "ferret",
                flags: ["gi"],
                values: [
                  {
                    key: "eg2",
                    value: exampleValue
                  }
                ]
              }
            ]
          }
        }
      ]
    })
  }
];
const createReplaceAction = () => {
  return pluginScaffolderNode.createTemplateAction({
    id,
    description: "Replaces strings that match a regular expression pattern with a specified replacement string",
    examples,
    schema: {
      input: schemaInput
    },
    async handler(ctx) {
      const input = ctx.input;
      const values = {};
      for (const {
        pattern,
        flags: flagsInput,
        replacement,
        values: valuesInput
      } of input.regExps) {
        const flags = flagsInput ? Array.from(new Set(flagsInput)).join("") : "";
        const regex = new RegExp(pattern, flags);
        for (const { key, value } of valuesInput) {
          const match = value.replace(regex, replacement);
          if (values.hasOwnProperty(key)) {
            throw new Error(
              `The key '${key}' is used more than once in the input.`
            );
          }
          values[key] = match;
        }
      }
      ctx.output("values", values);
    }
  });
};

exports.createReplaceAction = createReplaceAction;
//# sourceMappingURL=replace.cjs.js.map
