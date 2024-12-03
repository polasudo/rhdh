'use strict';

var express = require('express');
var Router = require('express-promise-router');
var jenkinsApi = require('./jenkinsApi.cjs.js');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

class JenkinsBuilder {
  constructor(env) {
    this.env = env;
  }
  static createBuilder(env) {
    return new JenkinsBuilder(env);
  }
  async build() {
    const logger = this.env.logger;
    const config = this.env.config;
    const httpAuth = this.env.httpAuth;
    const permissions = this.env.permissions;
    const jenkinsInfoProvider = this.env.jenkinsInfoProvider;
    logger.info("Initializing Jenkins backend");
    if (!config.has("jenkins")) {
      if (process.env.NODE_ENV !== "development") {
        throw new Error("Jenkins configuration is missing");
      }
      logger.warn(
        "Failed to initialize Jenkins backend: Jenkins config is missing"
      );
      return {
        router: Router__default.default()
      };
    }
    const router = this.buildRouter(jenkinsInfoProvider, permissions, httpAuth);
    return {
      router
    };
  }
  buildRouter(jenkinsInfoProvider, permissionApi, httpAuth) {
    const logger = this.env.logger;
    let permissionEvaluator;
    if (permissionApi && "authorizeConditional" in permissionApi) {
      permissionEvaluator = permissionApi;
    } else {
      logger.warn(
        "PermissionAuthorizer is deprecated. Please use an instance of PermissionEvaluator instead of PermissionAuthorizer in PluginEnvironment#permissions"
      );
      permissionEvaluator = permissionApi ? pluginPermissionCommon.toPermissionEvaluator(permissionApi) : void 0;
    }
    const jenkinsApi$1 = new jenkinsApi.JenkinsApiImpl(permissionEvaluator);
    const router = Router__default.default();
    router.use(express__default.default.json());
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
    return router;
  }
}

exports.JenkinsBuilder = JenkinsBuilder;
//# sourceMappingURL=JenkinsBuilder.cjs.js.map
