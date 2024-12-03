'use strict';

var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');
var pluginPermissionNode = require('@backstage/plugin-permission-node');
var backstagePluginAuditLogNode = require('@janus-idp/backstage-plugin-audit-log-node');
var formats = require('ajv-formats/dist/formats');
var express = require('express');
var openapiBackend = require('openapi-backend');
var backstagePluginBulkImportCommon = require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var catalogHttpClient = require('../catalog/catalogHttpClient.cjs.js');
var catalogInfoGenerator = require('../catalog/catalogInfoGenerator.cjs.js');
var openapidocument = require('../generated/openapidocument.cjs.js');
require('@octokit/auth-app');
require('@octokit/rest');
require('git-url-parse');
require('luxon');
var githubApiService = require('../github/githubApiService.cjs.js');
var auth = require('../helpers/auth.cjs.js');
require('@backstage/errors');
var auditLogUtils = require('../helpers/auditLogUtils.cjs.js');
var bulkImports = require('./handlers/import/bulkImports.cjs.js');
var organizations = require('./handlers/organization/organizations.cjs.js');
var ping = require('./handlers/ping/ping.cjs.js');
var repositories = require('./handlers/repository/repositories.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);

async function createRouter(options) {
  const {
    logger,
    httpAuth,
    auth: auth$1,
    permissions,
    config,
    cache,
    discovery,
    catalogApi
  } = options;
  const auditLogger = new backstagePluginAuditLogNode.DefaultAuditLogger({
    logger,
    authService: auth$1,
    httpAuthService: httpAuth
  });
  const githubApiService$1 = new githubApiService.GithubApiService(logger, config, cache);
  const catalogHttpClient$1 = new catalogHttpClient.CatalogHttpClient({
    logger,
    config,
    discovery,
    auth: auth$1,
    catalogApi
  });
  const catalogInfoGenerator$1 = new catalogInfoGenerator.CatalogInfoGenerator(
    logger,
    catalogHttpClient$1
  );
  const api = new openapiBackend.OpenAPIBackend({
    ajvOpts: {
      verbose: true,
      formats: formats.fullFormats
      // open issue: https://github.com/openapistack/openapi-backend/issues/280
    },
    validate: true,
    definition: openapidocument.openApiDocument,
    handlers: {
      validationFail: async (c, _req, res) => res.status(400).json({ err: c.validation.errors }),
      notFound: async (_c, req, res) => res.status(404).json({ err: `'${req.method} ${req.path}' not found` }),
      notImplemented: async (_c, req, res) => res.status(500).json({ err: `'${req.method} ${req.path}' not implemented` })
    }
  });
  await api.init();
  api.register("ping", async (_c, _req, res) => {
    const result = await ping.ping(logger);
    return res.status(result.statusCode).json(result.responseBody);
  });
  api.register(
    "findAllOrganizations",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.pagePerIntegration = stringToNumber(q.pagePerIntegration);
      q.sizePerIntegration = stringToNumber(q.sizePerIntegration);
      const response = await organizations.findAllOrganizations(
        logger,
        githubApiService$1,
        q.search,
        q.pagePerIntegration,
        q.sizePerIntegration
      );
      return res.status(response.statusCode).json({
        errors: response.responseBody?.errors,
        organizations: response.responseBody?.organizations,
        totalCount: response.responseBody?.totalCount,
        pagePerIntegration: response.responseBody?.pagePerIntegration,
        sizePerIntegration: response.responseBody?.sizePerIntegration
      });
    }
  );
  api.register(
    "findAllRepositories",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.pagePerIntegration = stringToNumber(q.pagePerIntegration);
      q.sizePerIntegration = stringToNumber(q.sizePerIntegration);
      q.checkImportStatus = stringToBoolean(q.checkImportStatus);
      const response = await repositories.findAllRepositories(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        {
          search: q.search,
          checkStatus: q.checkImportStatus,
          pageNumber: q.pagePerIntegration,
          pageSize: q.sizePerIntegration
        }
      );
      const repos = response.responseBody?.repositories;
      return res.status(response.statusCode).json({
        errors: response.responseBody?.errors,
        repositories: repos,
        totalCount: response.responseBody?.totalCount,
        pagePerIntegration: q.pagePerIntegration,
        sizePerIntegration: q.sizePerIntegration
      });
    }
  );
  api.register(
    "findRepositoriesByOrganization",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.pagePerIntegration = stringToNumber(q.pagePerIntegration);
      q.sizePerIntegration = stringToNumber(q.sizePerIntegration);
      q.checkImportStatus = stringToBoolean(q.checkImportStatus);
      const response = await repositories.findRepositoriesByOrganization(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        c.request.params.organizationName?.toString(),
        q.search,
        q.checkImportStatus,
        q.pagePerIntegration,
        q.sizePerIntegration
      );
      const repos = response.responseBody?.repositories;
      return res.status(response.statusCode).json({
        errors: response.responseBody?.errors,
        repositories: repos,
        totalCount: response.responseBody?.totalCount,
        pagePerIntegration: q.pagePerIntegration,
        sizePerIntegration: q.sizePerIntegration
      });
    }
  );
  api.register(
    "findAllImports",
    async (c, _req, res) => {
      const h = {
        ...c.request.headers
      };
      const apiVersion = h["api-version"];
      const q = {
        ...c.request.query
      };
      let page;
      let size;
      if (apiVersion === void 0 || apiVersion === "v1") {
        page = stringToNumber(q.page || q.pagePerIntegration);
        size = stringToNumber(q.size || q.sizePerIntegration);
      } else {
        page = stringToNumber(q.page);
        size = stringToNumber(q.size);
      }
      const response = await bulkImports.findAllImports(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        {
          apiVersion
        },
        {
          search: q.search,
          pageNumber: page,
          pageSize: size
        }
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    "createImportJobs",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.dryRun = stringToBoolean(q.dryRun);
      const response = await bulkImports.createImportJobs(
        {
          logger,
          config,
          auth: auth$1,
          catalogApi,
          githubApiService: githubApiService$1,
          catalogInfoGenerator: catalogInfoGenerator$1,
          catalogHttpClient: catalogHttpClient$1
        },
        {
          importRequests: c.request.requestBody,
          dryRun: q.dryRun
        }
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    "findImportStatusByRepo",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      if (!q.repo?.trim()) {
        throw new Error("missing or blank parameter");
      }
      const response = await bulkImports.findImportStatusByRepo(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        q.repo,
        q.defaultBranch,
        true
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    "deleteImportByRepo",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      if (!q.repo?.trim()) {
        throw new Error('missing or blank "repo" parameter');
      }
      const response = await bulkImports.deleteImportByRepo(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        q.repo,
        q.defaultBranch
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  const router = express.Router();
  router.use(express__default.default.json());
  const permissionIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: [backstagePluginBulkImportCommon.bulkImportPermission]
  });
  router.use(permissionIntegrationRouter);
  router.use(async (req, _res, next) => {
    if (req.path !== "/ping") {
      await auth.permissionCheck(
        auditLogger,
        api.matchOperation(req)?.operationId,
        permissions,
        httpAuth,
        req
      ).catch(next);
    }
    next();
  });
  router.use(async (req, res, next) => {
    const reqCast = req;
    const operationId = api.matchOperation(reqCast)?.operationId;
    try {
      const response = await api.handleRequest(reqCast, req, res);
      auditLogUtils.auditLogRequestSuccess(
        auditLogger,
        operationId,
        req,
        response.statusCode
      );
      next();
    } catch (err) {
      auditLogUtils.auditLogRequestError(auditLogger, operationId, req, err);
      next(err);
    }
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config });
  router.use(middleware.error());
  return router;
}
function stringToNumber(s) {
  return s ? Number.parseInt(s.toString(), 10) : void 0;
}
function stringToBoolean(s) {
  if (!s) {
    return void 0;
  }
  return s.toString() === "true";
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
