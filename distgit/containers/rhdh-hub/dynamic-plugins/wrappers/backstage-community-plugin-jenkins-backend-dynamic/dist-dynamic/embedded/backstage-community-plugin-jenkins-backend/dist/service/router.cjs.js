'use strict';

var backendCommon = require('@backstage/backend-common');
var express = require('express');
var Router = require('express-promise-router');
var jenkinsApi = require('./jenkinsApi.cjs.js');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var pluginPermissionNode = require('@backstage/plugin-permission-node');
var pluginJenkinsCommon = require('@backstage-community/plugin-jenkins-common');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

async function createRouter(options) {
  const { jenkinsInfoProvider, permissions, logger } = options;
  let permissionEvaluator;
  if (permissions && "authorizeConditional" in permissions) {
    permissionEvaluator = permissions;
  } else {
    logger.warn(
      "PermissionAuthorizer is deprecated. Please use an instance of PermissionEvaluator instead of PermissionAuthorizer in PluginEnvironment#permissions"
    );
    permissionEvaluator = permissions ? pluginPermissionCommon.toPermissionEvaluator(permissions) : void 0;
  }
  const { httpAuth } = backendCommon.createLegacyAuthAdapters(options);
  const jenkinsApi$1 = new jenkinsApi.JenkinsApiImpl(permissionEvaluator);
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.use(
    pluginPermissionNode.createPermissionIntegrationRouter({
      permissions: pluginJenkinsCommon.jenkinsPermissions
    })
  );
  router.get(
    "/v1/entity/:namespace/:kind/:name/projects",
    async (request, response) => {
      const { namespace, kind, name } = request.params;
      const branch = request.query.branch;
      let branches;
      if (branch === void 0) {
        branches = void 0;
      } else if (typeof branch === "string") {
        branches = branch.split(/,/g);
      } else {
        response.status(400).send("Something was unexpected about the branch queryString");
        return;
      }
      const jenkinsInfo = await jenkinsInfoProvider.getInstance({
        entityRef: {
          kind,
          namespace,
          name
        },
        credentials: await httpAuth.credentials(request)
      });
      try {
        const projects = await jenkinsApi$1.getProjects(jenkinsInfo, branches);
        response.json({
          projects
        });
      } catch (err) {
        if (err.errors) {
          throw new Error(
            `Unable to fetch projects, for ${jenkinsInfo.jobFullName}: ${errors.stringifyError(err.errors)}`
          );
        }
        throw err;
      }
    }
  );
  router.get(
    "/v1/entity/:namespace/:kind/:name/job/:jobFullName/:buildNumber",
    async (request, response) => {
      const { namespace, kind, name, jobFullName, buildNumber } = request.params;
      const jenkinsInfo = await jenkinsInfoProvider.getInstance({
        entityRef: {
          kind,
          namespace,
          name
        },
        jobFullName,
        credentials: await httpAuth.credentials(request)
      });
      const build = await jenkinsApi$1.getBuild(
        jenkinsInfo,
        jobFullName,
        parseInt(buildNumber, 10)
      );
      response.json({
        build
      });
    }
  );
  router.get(
    "/v1/entity/:namespace/:kind/:name/job/:jobFullName",
    async (request, response) => {
      const { namespace, kind, name, jobFullName } = request.params;
      const jenkinsInfo = await jenkinsInfoProvider.getInstance({
        entityRef: {
          kind,
          namespace,
          name
        },
        jobFullName,
        credentials: await httpAuth.credentials(request)
      });
      const build = await jenkinsApi$1.getJobBuilds(jenkinsInfo, jobFullName);
      response.json({
        build
      });
    }
  );
  router.post(
    "/v1/entity/:namespace/:kind/:name/job/:jobFullName/:buildNumber",
    async (request, response) => {
      const { namespace, kind, name, jobFullName, buildNumber } = request.params;
      const jenkinsInfo = await jenkinsInfoProvider.getInstance({
        entityRef: {
          kind,
          namespace,
          name
        },
        jobFullName,
        credentials: await httpAuth.credentials(request)
      });
      const resourceRef = catalogModel.stringifyEntityRef({ kind, namespace, name });
      const status = await jenkinsApi$1.rebuildProject(
        jenkinsInfo,
        jobFullName,
        parseInt(buildNumber, 10),
        resourceRef,
        {
          credentials: await httpAuth.credentials(request)
        }
      );
      response.json({}).status(status);
    }
  );
  router.use(backendCommon.errorHandler());
  return router;
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
