'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/integration');
var require$$2 = require('express-promise-router');
var require$$3 = require('http-proxy-middleware');
var require$$4 = require('body-parser');
require('path');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendCommon = require$$0;
var integration = require$$1;
var Router = require$$2;
var httpProxyMiddleware = require$$3;
var bodyParser = require$$4;


function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Router__default = /*#__PURE__*/_interopDefaultLegacy$1(Router);
var bodyParser__default = /*#__PURE__*/_interopDefaultLegacy$1(bodyParser);

function getBasePath(config) {
  const baseUrl = config.getOptionalString("backend.baseUrl");
  if (!baseUrl) {
    return void 0;
  }
  return new URL(baseUrl).pathname.replace(/\/$/, "");
}
async function createRouter(options) {
  const { logger, config } = options;
  const secure = config.getOptionalBoolean("gitlab.proxySecure");
  const basePath = getBasePath(config) || "";
  const gitlabIntegrations = integration.readGitLabIntegrationConfigs(
    config.getConfigArray("integrations.gitlab")
  );
  const router = Router__default["default"]();
  router.use(bodyParser__default["default"].json());
  router.use(bodyParser__default["default"].urlencoded({ extended: true }));
  router.use(bodyParser__default["default"].text());
  const filter = (_pathname, req) => {
    if (req.headers["authorization"])
      delete req.headers["authorization"];
    return req.method === "GET";
  };
  const graphqlFilter = (_pathname, req) => {
    var _a;
    if (req.headers["authorization"])
      delete req.headers["authorization"];
    return req.method === "POST" && !((_a = req.body.query) == null ? void 0 : _a.includes("mutation"));
  };
  for (const { host, apiBaseUrl, token } of gitlabIntegrations) {
    const apiUrl = new URL(apiBaseUrl);
    router.use(
      `/graphql/${host}`,
      httpProxyMiddleware.createProxyMiddleware(graphqlFilter, {
        target: apiUrl.origin,
        changeOrigin: true,
        headers: {
          ...token ? { "PRIVATE-TOKEN": token } : {}
        },
        secure,
        onProxyReq: (proxyReq, req) => {
          if (req.body) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader("Content-Type", "application/json");
            proxyReq.setHeader(
              "Content-Length",
              Buffer.byteLength(bodyData)
            );
            proxyReq.write(bodyData);
          }
        },
        logProvider: () => logger,
        pathRewrite: {
          [`^${basePath}/api/gitlab/graphql/${host}`]: `/api/graphql`
        }
      })
    );
    router.use(
      `/rest/${host}`,
      httpProxyMiddleware.createProxyMiddleware(filter, {
        target: apiUrl.origin,
        changeOrigin: true,
        headers: {
          ...token ? { "PRIVATE-TOKEN": token } : {}
        },
        secure,
        logProvider: () => logger,
        pathRewrite: {
          [`^${basePath}/api/gitlab/rest/${host}`]: apiUrl.pathname
        }
      })
    );
  }
  router.use(backendCommon.errorHandler());
  return router;
}

function getProjectPath(target) {
  const url = new URL(target);
  return url.pathname.split("/blob/").splice(0, 1).join("/").split("/-").splice(0, 1).join("/").slice(1);
}

const GITLAB_PROJECT_SLUG = "gitlab.com/project-slug";
const GITLAB_PROJECT_ID = "gitlab.com/project-id";
const GITLAB_INSTANCE = "gitlab.com/instance";

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitlabFillerProcessor {
  constructor(config) {
    __publicField(this, "allowedKinds");
    __publicField(this, "gitLabIntegrationsConfig");
    const allowedKinds = config.getOptionalStringArray(
      "gitlab.allowedKinds"
    ) || ["Component"];
    this.gitLabIntegrationsConfig = integration.readGitLabIntegrationConfigs(
      config.getConfigArray("integrations.gitlab")
    );
    this.allowedKinds = new Set(
      allowedKinds.map((str) => str.toLowerCase())
    );
  }
  getProcessorName() {
    return "GitlabFillerProcessor";
  }
  async postProcessEntity(entity, location, _emit) {
    var _a, _b, _c;
    if (this.isAllowedEntity(entity)) {
      const gitlabInstance = this.getGitlabInstance(location.target);
      if (gitlabInstance) {
        if (!entity.metadata.annotations)
          entity.metadata.annotations = {};
        if (!((_a = entity.metadata.annotations) == null ? void 0 : _a[GITLAB_INSTANCE])) {
          entity.metadata.annotations[GITLAB_INSTANCE] = gitlabInstance;
        }
        if (!((_b = entity.metadata.annotations) == null ? void 0 : _b[GITLAB_PROJECT_ID]) && !((_c = entity.metadata.annotations) == null ? void 0 : _c[GITLAB_PROJECT_SLUG])) {
          entity.metadata.annotations[GITLAB_PROJECT_SLUG] = getProjectPath(location.target);
        }
      }
    }
    return entity;
  }
  getGitlabInstance(target) {
    let url;
    try {
      url = new URL(target);
    } catch (e) {
      return void 0;
    }
    const gitlabConfig = this.gitLabIntegrationsConfig.find((config) => {
      const baseUrl = config.baseUrl ? new URL(config.baseUrl) : new URL(`https://${config.host}`);
      return baseUrl.origin === url.origin;
    });
    return gitlabConfig == null ? void 0 : gitlabConfig.host;
  }
  isAllowedEntity(entity) {
    return this.allowedKinds.has(entity.kind.toLowerCase());
  }
}

var GitlabFillerProcessor_1 = index_cjs.GitlabFillerProcessor = GitlabFillerProcessor;
var createRouter_1 = index_cjs.createRouter = createRouter;

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "gitlab",
    createPlugin: createRouter_1
  },
  async catalog(builder, env) {
    builder.addProcessor(new GitlabFillerProcessor_1(env.config));
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
