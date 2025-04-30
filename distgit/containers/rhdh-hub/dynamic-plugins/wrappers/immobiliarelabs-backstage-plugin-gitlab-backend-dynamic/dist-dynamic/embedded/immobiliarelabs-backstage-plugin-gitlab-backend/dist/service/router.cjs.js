'use strict';

var backendCommon = require('@backstage/backend-common');
var integration = require('@backstage/integration');
var Router = require('express-promise-router');
var httpProxyMiddleware = require('http-proxy-middleware');
var bodyParser = require('body-parser');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var bodyParser__default = /*#__PURE__*/_interopDefaultCompat(bodyParser);

function getBasePath(config) {
  const baseUrl = config.getOptionalString("backend.baseUrl");
  if (!baseUrl) {
    return undefined;
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

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
