'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/plugin-scaffolder-node');
var require$$0 = require('cross-fetch');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var backstageRequest_cjs = {};

var helpers_cjs = {};

var crossFetch = require$$0;

class HttpError extends Error {
}
const DEFAULT_TIMEOUT = 6e4;
const getPluginId = (path) => {
  const pluginId = (path.startsWith("/") ? path.substring(1) : path).split(
    "/"
  )[0];
  return pluginId;
};
const generateBackstageUrl = async (discovery, path) => {
  const [pluginId, ...rest] = (path.startsWith("/") ? path.substring(1) : path).split("/");
  return `${await discovery.getBaseUrl(pluginId)}/${rest.join("/")}`;
};
const http = async (options, logger, continueOnBadResponse = false) => {
  let res;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  const { url, ...other } = options;
  const httpOptions = { ...other, signal: controller.signal };
  try {
    res = await crossFetch.fetch(url, httpOptions);
    if (!res) {
      throw new HttpError(
        `Request was aborted as it took longer than ${DEFAULT_TIMEOUT / 1e3} seconds`
      );
    }
  } catch (e) {
    throw new HttpError(`There was an issue with the request: ${e}`);
  }
  clearTimeout(timeoutId);
  const headers = {};
  for (const [name, value] of res.headers) {
    headers[name] = value;
  }
  const isJSON = () => headers["content-type"] && headers["content-type"].includes("application/json");
  let body;
  try {
    body = isJSON() ? await res.json() : { message: await res.text() };
  } catch (e) {
    throw new HttpError(`Could not parse response body: ${e}`);
  }
  if (res.status >= 400) {
    logger.error(
      `There was an issue with your request. Status code: ${res.status} Response body: ${JSON.stringify(body)}`
    );
    if (continueOnBadResponse) {
      return { code: res.status, headers: {}, body };
    }
    throw new HttpError("Unable to complete request");
  }
  return { code: res.status, headers, body };
};
const getObjFieldCaseInsensitively = (obj = {}, fieldName) => {
  const [, value = ""] = Object.entries(obj).find(
    ([key]) => key.toLowerCase() === fieldName.toLowerCase()
  ) || [];
  return value;
};

helpers_cjs.generateBackstageUrl = generateBackstageUrl;
helpers_cjs.getObjFieldCaseInsensitively = getObjFieldCaseInsensitively;
helpers_cjs.getPluginId = getPluginId;
helpers_cjs.http = http;

var pluginScaffolderNode = require$$0$1;
var helpers = helpers_cjs;

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

backstageRequest_cjs.createHttpBackstageAction = createHttpBackstageAction;

var module_cjs = {};

var backendPluginApi = require$$0$2;
var alpha = require$$1;
var backstageRequest$1 = backstageRequest_cjs;

const scaffolderBackendModuleHttpRequest = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "scaffolder-backend-module-http-request",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery,
        auth: backendPluginApi.coreServices.auth
      },
      async init({ scaffolder, discovery, auth }) {
        scaffolder.addActions(
          backstageRequest$1.createHttpBackstageAction({ discovery, auth })
        );
      }
    });
  }
});

module_cjs.scaffolderBackendModuleHttpRequest = scaffolderBackendModuleHttpRequest;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backstageRequest = backstageRequest_cjs;
var module$1 = module_cjs;



index_cjs.createHttpBackstageAction = backstageRequest.createHttpBackstageAction;
var _default = index_cjs.default = module$1.scaffolderBackendModuleHttpRequest;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
