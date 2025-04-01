'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var helpers = require('./helpers.cjs.js');

function createHttpBackstageAction(options) {
  const { discovery, auth } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "http:backstage:request",
    description: "Sends a HTTP request to the Backstage API. It uses the token of the user who triggers the task to authenticate requests.",
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["path", "method"],
        properties: {
          method: {
            title: "Method",
            type: "string",
            description: "The method type of the request",
            enum: [
              "GET",
              "HEAD",
              "OPTIONS",
              "POST",
              "UPDATE",
              "DELETE",
              "PUT",
              "PATCH"
            ]
          },
          path: {
            title: "Request path",
            description: "The url path you want to query",
            type: "string"
          },
          headers: {
            title: "Request headers",
            description: "The headers you would like to pass to your request",
            type: "object"
          },
          params: {
            title: "Request query params",
            description: "The query parameters you would like to pass to your request",
            type: "object"
          },
          body: {
            title: "Request body",
            description: "The body you would like to pass to your request",
            type: ["object", "string", "array"]
          },
          logRequestPath: {
            title: "Request path logging",
            description: "Option to turn request path logging off. On by default",
            type: "boolean"
          },
          continueOnBadResponse: {
            title: "Continue on error",
            description: "Return response code and body and continue to next scaffolder step if the response status is 4xx or 5xx. By default the step will fail if any status code is returned 400 and above.",
            type: "boolean",
            default: "false"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          code: {
            title: "Response Code",
            type: "string"
          },
          headers: {
            title: "Response Headers",
            type: "object"
          },
          body: {
            title: "Response Body",
            type: "object"
          }
        }
      }
    },
    async handler(ctx) {
      const { input } = ctx;
      const pluginId = helpers.getPluginId(input.path);
      const { token } = await auth?.getPluginRequestToken({
        onBehalfOf: await ctx.getInitiatorCredentials(),
        targetPluginId: pluginId
      }) ?? { token: ctx.secrets?.backstageToken };
      const { method, params } = input;
      const logRequestPath = input.logRequestPath ?? true;
      const continueOnBadResponse = input.continueOnBadResponse || false;
      const url = await helpers.generateBackstageUrl(discovery, input.path);
      if (logRequestPath) {
        ctx.logger.info(
          `Creating ${method} request with ${this.id} scaffolder action against ${input.path}`
        );
      } else {
        ctx.logger.info(
          `Creating ${method} request with ${this.id} scaffolder action`
        );
      }
      const queryParams = params ? new URLSearchParams(params).toString() : "";
      let inputBody = void 0;
      if (input.body && typeof input.body !== "string" && input.headers && input.headers["content-type"] && input.headers["content-type"].includes("application/json")) {
        inputBody = JSON.stringify(input.body);
      } else {
        inputBody = input.body;
      }
      const httpOptions = {
        method: input.method,
        url: queryParams !== "" ? `${url}?${queryParams}` : url,
        headers: input.headers ? input.headers : {},
        body: inputBody
      };
      const authToken = helpers.getObjFieldCaseInsensitively(
        input.headers,
        "authorization"
      );
      if (token && !authToken) {
        ctx.logger.info(`Token is defined. Setting authorization header.`);
        httpOptions.headers.authorization = `Bearer ${token}`;
      }
      const dryRunSafeMethods = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
      if (ctx.isDryRun === true && !dryRunSafeMethods.has(method)) {
        ctx.logger.info(
          `Dry run mode. Skipping non dry-run safe method '${method}' request to ${queryParams !== "" ? `${input.path}?${queryParams}` : input.path}`
        );
        return;
      }
      const { code, headers, body } = await helpers.http(
        httpOptions,
        ctx.logger,
        continueOnBadResponse
      );
      ctx.output("code", code);
      ctx.output("headers", headers);
      ctx.output("body", body);
    }
  });
}

exports.createHttpBackstageAction = createHttpBackstageAction;
//# sourceMappingURL=backstageRequest.cjs.js.map
