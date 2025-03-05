'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var errors = require('@backstage/errors');

function createSleepAction(options) {
  return pluginScaffolderNode.createTemplateAction({
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

exports.createSleepAction = createSleepAction;
//# sourceMappingURL=sleep.cjs.js.map
