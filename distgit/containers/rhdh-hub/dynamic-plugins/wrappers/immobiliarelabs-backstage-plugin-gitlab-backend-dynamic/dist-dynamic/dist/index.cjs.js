'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/integration');
var require$$2 = require('express-promise-router');
var require$$3 = require('http-proxy-middleware');
var require$$4 = require('body-parser');
require('path');
var require$$6 = require('@backstage/backend-plugin-api');
var require$$7 = require('@backstage/plugin-catalog-node/alpha');

var backendCommon = require$$0;
var integration = require$$1;
var Router = require$$2;
var httpProxyMiddleware = require$$3;
var bodyParser = require$$4;

var backendPluginApi = require$$6;
var alpha = require$$7;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var bodyParser__default = /*#__PURE__*/_interopDefaultCompat(bodyParser);

function getBasePath(config) {
  const baseUrl = config.getOptionalString("backend.baseUrl");
  if (!baseUrl) {
    return void 0;
  }
  return new URL(baseUrl).pathname.replace(/\/$/, "");
}
function headersManipulation(headers) {
  if (headers["authorization"]) delete headers["authorization"];
  if (headers["gitlab-authorization"]) {
    headers["authorization"] = headers["gitlab-authorization"];
    delete headers["gitlab-authorization"];
  }
}
async function createRouter(options) {
  const { logger, config } = options;
  const secure = config.getOptionalBoolean("gitlab.proxySecure");
  const useOAuth = config.getOptionalBoolean("gitlab.useOAuth");
  const basePath = getBasePath(config) || "";
  const gitlabIntegrations = integration.readGitLabIntegrationConfigs(
    config.getConfigArray("integrations.gitlab")
  );
  const router = Router__default.default();
  router.use(bodyParser__default.default.json());
  router.use(bodyParser__default.default.urlencoded({ extended: true }));
  router.use(bodyParser__default.default.text());
  const filter = (_pathname, req) => {
    headersManipulation(req.headers);
    return req.method === "GET";
  };
  const graphqlFilter = (_pathname, req) => {
    headersManipulation(req.headers);
    return req.method === "POST" && !req.body.query?.includes("mutation");
  };
  for (const { host, apiBaseUrl, token } of gitlabIntegrations) {
    const apiUrl = new URL(apiBaseUrl);
    router.use(
      `/graphql/${host}`,
      httpProxyMiddleware.createProxyMiddleware(graphqlFilter, {
        target: apiUrl.origin,
        changeOrigin: true,
        headers: {
          // If useOAuth is true, we don't not add the token
          ...token && !useOAuth ? { "PRIVATE-TOKEN": token } : {}
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
          // If useOAuth is true, we don't not add the token
          ...token && !useOAuth ? { "PRIVATE-TOKEN": token } : {}
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

function getProjectPath(target, subPath) {
  const url = new URL(target);
  const out = url.pathname.split("/blob/").splice(0, 1).join("/").split("/-").splice(0, 1).join("/").slice(1);
  subPath = subPath?.startsWith("/") ? subPath.slice(1) : subPath;
  if (subPath && out.startsWith(subPath)) {
    return out.replace(subPath, "").split("/").filter(Boolean).join("/");
  }
  return out;
}

const GITLAB_PROJECT_SLUG = "gitlab.com/project-slug";
const GITLAB_PROJECT_ID = "gitlab.com/project-id";
const GITLAB_INSTANCE = "gitlab.com/instance";

class GitlabFillerProcessor {
  allowedKinds;
  gitLabIntegrationsConfig;
  constructor(config) {
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
    if (this.isAllowedEntity(entity)) {
      const gitlabInstanceConfig = this.getGitlabInstanceConfig(
        location.target
      );
      if (gitlabInstanceConfig) {
        if (!entity.metadata.annotations)
          entity.metadata.annotations = {};
        if (!entity.metadata.annotations?.[GITLAB_INSTANCE]) {
          entity.metadata.annotations[GITLAB_INSTANCE] = gitlabInstanceConfig?.host;
        }
        if (!entity.metadata.annotations?.[GITLAB_PROJECT_ID] && !entity.metadata.annotations?.[GITLAB_PROJECT_SLUG]) {
          entity.metadata.annotations[GITLAB_PROJECT_SLUG] = getProjectPath(
            location.target,
            this.getGitlabSubPath(gitlabInstanceConfig)
          );
        }
      }
    }
    return entity;
  }
  getGitlabSubPath(config) {
    if (config.baseUrl) return new URL(config.baseUrl).pathname;
    return;
  }
  getGitlabInstanceConfig(target) {
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
    return gitlabConfig;
  }
  isAllowedEntity(entity) {
    return this.allowedKinds.has(entity.kind.toLowerCase());
  }
}

const catalogPluginGitlabFillerProcessorModule = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "gitlabFillerProcessor",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        extensionPoint: alpha.catalogProcessingExtensionPoint
      },
      async init({ config, extensionPoint }) {
        extensionPoint.addProcessor(new GitlabFillerProcessor(config));
      }
    });
  }
});
const gitlabPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "gitlab",
  register(env) {
    env.registerInit({
      deps: {
        http: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ config, logger, http }) {
        const winstonLogger = backendCommon.loggerToWinstonLogger(logger);
        http.use(
          await createRouter({
            logger: winstonLogger,
            config
          })
        );
      }
    });
  }
});
var catalogPluginGitlabFillerProcessorModule_1 = catalogPluginGitlabFillerProcessorModule;
var gitlabPlugin_1 = gitlabPlugin;

const dynamicPluginInstaller = {
  kind: "new",
  install: () => [catalogPluginGitlabFillerProcessorModule_1(), gitlabPlugin_1()]
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
