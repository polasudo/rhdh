'use strict';

var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');
var pluginPermissionNode = require('@backstage/plugin-permission-node');
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
var auditorUtils = require('../helpers/auditorUtils.cjs.js');
var bulkImports = require('./handlers/import/bulkImports.cjs.js');
var organizations = require('./handlers/organization/organizations.cjs.js');
var ping = require('./handlers/ping/ping.cjs.js');
var repositories = require('./handlers/repository/repositories.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);

var Operations;
((Operations2) => {
  Operations2.PING = "ping";
  Operations2.FIND_ALL_ORGANIZATIONS = "findAllOrganizations";
  Operations2.FIND_ALL_REPOSITORIES = "findAllRepositories";
  Operations2.FIND_REPOSITORIES_BY_ORGANIZATION = "findRepositoriesByOrganization";
  Operations2.FIND_ALL_IMPORTS = "findAllImports";
  Operations2.CREATE_IMPORT_JOBS = "createImportJobs";
  Operations2.FIND_IMPORT_STATUS_BY_REPO = "findImportStatusByRepo";
  Operations2.DELETE_IMPORT_BY_REPO = "deleteImportByRepo";
})(Operations || (Operations = {}));
async function createRouter(options) {
  const {
    logger,
    httpAuth,
    auth: auth$1,
    permissions,
    config,
    cache,
    discovery,
    catalogApi,
    auditor
  } = options;
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
  api.register(
    Operations.PING,
    async (_c, _req, res) => {
      const result = await ping.ping(logger);
      return res.status(result.statusCode).json(result.responseBody);
    }
  );
  api.register(
    Operations.FIND_ALL_ORGANIZATIONS,
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
    Operations.FIND_ALL_REPOSITORIES,
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
    Operations.FIND_REPOSITORIES_BY_ORGANIZATION,
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
    Operations.FIND_ALL_IMPORTS,
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
      if (apiVersion === undefined || apiVersion === "v1") {
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
          pageSize: size,
          sortColumn: q.sortColumn,
          sortOrder: q.sortOrder
        }
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    Operations.CREATE_IMPORT_JOBS,
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
    Operations.FIND_IMPORT_STATUS_BY_REPO,
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
    Operations.DELETE_IMPORT_BY_REPO,
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
        auditor,
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
    const auditorEvent = await createAuditorEventByOperationId(
      operationId,
      req,
      auditor
    );
    try {
      const response = await api.handleRequest(reqCast, req, res);
      auditorEvent?.success({ meta: { responseStatus: response.statusCode } });
      next();
    } catch (err) {
      auditorEvent?.fail({ error: err, meta: { responseStatus: 500 } });
      next(err);
    }
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config });
  router.use(middleware.error());
  return router;
}
async function createAuditorEventByOperationId(operationId, req, auditor) {
  let auditorEvent;
  switch (operationId) {
    case Operations.PING:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "ping", req);
      break;
    case Operations.FIND_ALL_ORGANIZATIONS:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "org-read", req, {
        queryType: req.query.search ? "by-query" : "all",
        search: req.query?.search
      });
      break;
    case Operations.FIND_ALL_REPOSITORIES:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "repo-read", req, {
        queryType: req.query.search ? "by-query" : "all",
        search: req.query.search
      });
      break;
    case Operations.FIND_REPOSITORIES_BY_ORGANIZATION: {
      const organizationName = req.params.organizationName?.toString();
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "repo-read", req, {
        queryType: "by-org",
        organizationName
      });
      break;
    }
    case Operations.FIND_ALL_IMPORTS:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "import-read", req, {
        queryType: req.query.search ? "by-query" : "all",
        search: req.query.search
      });
      break;
    case Operations.CREATE_IMPORT_JOBS:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "import-write", req, {
        actionType: "create",
        dryRun: req.query.dryRun
      });
      break;
    case Operations.FIND_IMPORT_STATUS_BY_REPO:
      auditorEvent = await auditorUtils.auditCreateEvent(
        auditor,
        "import-status-read",
        req,
        { queryType: "by-query", repo: req.query.repo }
      );
      break;
    case Operations.DELETE_IMPORT_BY_REPO:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, "import-write", req, {
        actionType: "delete",
        repository: req.query.repo
      });
      break;
    case undefined:
      auditorEvent = await auditorUtils.auditCreateEvent(auditor, operationId, req);
      break;
  }
  return auditorEvent;
}
function stringToNumber(s) {
  return s ? Number.parseInt(s.toString(), 10) : undefined;
}
function stringToBoolean(s) {
  if (!s) {
    return undefined;
  }
  return s.toString() === "true";
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
