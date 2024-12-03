'use strict';

var pluginAzureDevopsCommon = require('@backstage-community/plugin-azure-devops-common');
var AzureDevOpsApi = require('../api/AzureDevOpsApi.cjs.js');
var PullRequestsDashboardProvider = require('../api/PullRequestsDashboardProvider.cjs.js');
var Router = require('express-promise-router');
var express = require('express');
var errors = require('@backstage/errors');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var pluginPermissionNode = require('@backstage/plugin-permission-node');
var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var express__default = /*#__PURE__*/_interopDefaultCompat(express);

const DEFAULT_TOP = 10;
async function createRouter(options) {
  const { logger, reader, config, permissions, httpAuth } = options;
  const permissionIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: pluginAzureDevopsCommon.azureDevOpsPermissions
  });
  const azureDevOpsApi = options.azureDevOpsApi || AzureDevOpsApi.AzureDevOpsApi.fromConfig(config, { logger, urlReader: reader });
  const pullRequestsDashboardProvider = await PullRequestsDashboardProvider.PullRequestsDashboardProvider.create(logger, azureDevOpsApi);
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.use(permissionIntegrationRouter);
  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  router.get("/projects", async (_req, res) => {
    const projects = await azureDevOpsApi.getProjects();
    res.status(200).json(projects);
  });
  router.get("/repository/:projectName/:repoName", async (req, res) => {
    const { projectName, repoName } = req.params;
    const gitRepository = await azureDevOpsApi.getGitRepository(
      projectName,
      repoName
    );
    res.status(200).json(gitRepository);
  });
  router.get("/builds/:projectName/:repoId", async (req, res) => {
    const { projectName, repoId } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const buildList = await azureDevOpsApi.getBuildList(
      projectName,
      repoId,
      top,
      host,
      org
    );
    res.status(200).json(buildList);
  });
  router.get("/repo-builds/:projectName/:repoName", async (req, res) => {
    const { projectName, repoName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const gitRepository = await azureDevOpsApi.getRepoBuilds(
      projectName,
      repoName,
      top,
      host,
      org
    );
    res.status(200).json(gitRepository);
  });
  router.get("/git-tags/:projectName/:repoName", async (req, res) => {
    const { projectName, repoName } = req.params;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsGitTagReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const gitTags = await azureDevOpsApi.getGitTags(
      projectName,
      repoName,
      host,
      org
    );
    res.status(200).json(gitTags);
  });
  router.get("/pull-requests/:projectName/:repoName", async (req, res) => {
    const { projectName, repoName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const teamsLimit = req.query.teamsLimit ? Number(req.query.teamsLimit) : PullRequestsDashboardProvider.DEFAULT_TEAMS_LIMIT;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const status = req.query.status ? Number(req.query.status) : pluginAzureDevopsCommon.PullRequestStatus.Active;
    const pullRequestOptions = {
      top,
      status,
      teamsLimit
    };
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const gitPullRequest = await azureDevOpsApi.getPullRequests(
      projectName,
      repoName,
      pullRequestOptions,
      host,
      org
    );
    res.status(200).json(gitPullRequest);
  });
  router.get("/dashboard-pull-requests/:projectName", async (req, res) => {
    const { projectName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const teamsLimit = req.query.teamsLimit ? Number(req.query.teamsLimit) : PullRequestsDashboardProvider.DEFAULT_TEAMS_LIMIT;
    const status = req.query.status ? Number(req.query.status) : pluginAzureDevopsCommon.PullRequestStatus.Active;
    const pullRequestOptions = {
      top,
      status,
      teamsLimit
    };
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestDashboardReadPermission
        }
      ],
      { credentials: await httpAuth.credentials(req) }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const pullRequests = await pullRequestsDashboardProvider.getDashboardPullRequests(
      projectName,
      pullRequestOptions
    );
    res.status(200).json(pullRequests);
  });
  router.get("/all-teams", async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : void 0;
    const allTeams = await pullRequestsDashboardProvider.getAllTeams({ limit });
    res.status(200).json(allTeams);
  });
  router.get(
    "/build-definitions/:projectName/:definitionName",
    async (req, res) => {
      const { projectName, definitionName } = req.params;
      const host = req.query.host?.toString();
      const org = req.query.org?.toString();
      const buildDefinitionList = await azureDevOpsApi.getBuildDefinitions(
        projectName,
        definitionName,
        host,
        org
      );
      res.status(200).json(buildDefinitionList);
    }
  );
  router.get("/builds/:projectName", async (req, res) => {
    const { projectName } = req.params;
    const repoName = req.query.repoName?.toString();
    const definitionName = req.query.definitionName?.toString();
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPipelineReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const builds = await azureDevOpsApi.getBuildRuns(
      projectName,
      top,
      repoName,
      definitionName,
      host,
      org
    );
    res.status(200).json(builds);
  });
  router.get("/users/:userId/team-ids", async (req, res) => {
    const { userId } = req.params;
    const teamIds = await pullRequestsDashboardProvider.getUserTeamIds(userId);
    res.status(200).json(teamIds);
  });
  router.get("/readme/:projectName/:repoName", async (req, res) => {
    const host = req.query.host?.toString() ?? config.getString("azureDevOps.host");
    const org = req.query.org?.toString() ?? config.getString("azureDevOps.organization");
    let path = req.query.path;
    if (path === void 0) {
      path = "README.md";
    }
    if (typeof path !== "string") {
      throw new errors.InputError("Invalid path param");
    }
    if (path === "") {
      throw new errors.InputError("If present, the path param should not be empty");
    }
    const { projectName, repoName } = req.params;
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const readme = await azureDevOpsApi.getReadme(
      host,
      org,
      projectName,
      repoName,
      path
    );
    res.status(200).json(readme);
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config });
  router.use(middleware.error());
  return router;
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
