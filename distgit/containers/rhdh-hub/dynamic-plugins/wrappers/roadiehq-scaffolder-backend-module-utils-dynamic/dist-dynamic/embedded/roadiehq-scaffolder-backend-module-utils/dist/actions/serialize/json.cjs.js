'use strict';

var pluginScaffolderBackend = require('@backstage/plugin-scaffolder-backend');

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

exports.createSerializeJsonAction = createSerializeJsonAction;
//# sourceMappingURL=json.cjs.js.map
