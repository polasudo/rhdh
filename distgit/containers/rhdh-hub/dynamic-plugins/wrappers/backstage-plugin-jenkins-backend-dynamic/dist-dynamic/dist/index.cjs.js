'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/catalog-model');
var require$$2 = require('express');
var require$$3 = require('express-promise-router');
var require$$4 = require('jenkins');
var require$$5 = require('@backstage/plugin-permission-common');
var alpha$1 = require('@backstage/plugin-catalog-common/alpha');
var require$$7 = require('node-fetch');
var require$$8 = require('@backstage/errors');
var require$$9 = require('@backstage/plugin-permission-node');
var require$$10 = require('@backstage/backend-plugin-api');
var require$$11 = require('@backstage/plugin-catalog-node/alpha');

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var index_cjs = {};

const jenkinsExecutePermission = require$$5.createPermission({
  name: "jenkins.execute",
  attributes: {
    action: "update"
  },
  resourceType: alpha$1.RESOURCE_TYPE_CATALOG_ENTITY
});
const jenkinsPermissions = [jenkinsExecutePermission];

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	jenkinsExecutePermission: jenkinsExecutePermission,
	jenkinsPermissions: jenkinsPermissions
});

var require$$6 = /*@__PURE__*/getAugmentedNamespace(index_esm);

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendCommon = require$$0;
var catalogModel = require$$1;
var express = require$$2;
var Router = require$$3;
var Jenkins = require$$4;
var pluginPermissionCommon = require$$5;
var pluginJenkinsCommon = require$$6;
var fetch = require$$7;
var errors = require$$8;
var pluginPermissionNode = require$$9;
var backendPluginApi = require$$10;
var alpha = require$$11;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var Jenkins__default = /*#__PURE__*/_interopDefaultCompat(Jenkins);
var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class JenkinsConfig {
  constructor(instances) {
    this.instances = instances;
  }
  /**
   * Read all Jenkins instance configurations.
   * @param config - Root configuration
   * @returns A JenkinsConfig that contains all configured Jenkins instances.
   */
  static fromConfig(config) {
    var _a;
    const DEFAULT_JENKINS_NAME = "default";
    const jenkinsConfig = config.getConfig("jenkins");
    const namedInstanceConfig = ((_a = jenkinsConfig.getOptionalConfigArray("instances")) == null ? void 0 : _a.map((c) => ({
      name: c.getString("name"),
      baseUrl: c.getString("baseUrl"),
      username: c.getString("username"),
      apiKey: c.getString("apiKey"),
      extraRequestHeaders: c.getOptional("extraRequestHeaders"),
      crumbIssuer: c.getOptionalBoolean("crumbIssuer")
    }))) || [];
    const hasNamedDefault = namedInstanceConfig.some(
      (x) => x.name === DEFAULT_JENKINS_NAME
    );
    const baseUrl = jenkinsConfig.getOptionalString("baseUrl");
    const username = jenkinsConfig.getOptionalString("username");
    const apiKey = jenkinsConfig.getOptionalString("apiKey");
    const crumbIssuer = jenkinsConfig.getOptionalBoolean("crumbIssuer");
    const extraRequestHeaders = jenkinsConfig.getOptional("extraRequestHeaders");
    if (hasNamedDefault && (baseUrl || username || apiKey)) {
      throw new Error(
        `Found both a named jenkins instance with name ${DEFAULT_JENKINS_NAME} and top level baseUrl, username or apiKey config. Use only one style of config.`
      );
    }
    const unnamedNonePresent = !baseUrl && !username && !apiKey;
    const unnamedAllPresent = baseUrl && username && apiKey;
    if (!(unnamedAllPresent || unnamedNonePresent)) {
      throw new Error(
        `Found partial default jenkins config. All (or none) of baseUrl, username and apiKey must be provided.`
      );
    }
    if (unnamedAllPresent) {
      return new JenkinsConfig([
        ...namedInstanceConfig,
        {
          name: DEFAULT_JENKINS_NAME,
          baseUrl,
          username,
          apiKey,
          extraRequestHeaders,
          crumbIssuer
        }
      ]);
    }
    return new JenkinsConfig(namedInstanceConfig);
  }
  /**
   * Gets a Jenkins instance configuration by name, or the default one if no
   * name is provided.
   * @param jenkinsName - Optional name of the Jenkins instance.
   * @returns The requested Jenkins instance.
   */
  getInstanceConfig(jenkinsName) {
    const DEFAULT_JENKINS_NAME = "default";
    if (!jenkinsName || jenkinsName === DEFAULT_JENKINS_NAME) {
      const instanceConfig2 = this.instances.find(
        (c) => c.name === DEFAULT_JENKINS_NAME
      );
      if (!instanceConfig2) {
        throw new Error(
          `Couldn't find a default jenkins instance in the config. Either configure an instance with name ${DEFAULT_JENKINS_NAME} or add a prefix to your annotation value.`
        );
      }
      return instanceConfig2;
    }
    const instanceConfig = this.instances.find((c) => c.name === jenkinsName);
    if (!instanceConfig) {
      throw new Error(
        `Couldn't find a jenkins instance in the config with name ${jenkinsName}`
      );
    }
    return instanceConfig;
  }
}
const _DefaultJenkinsInfoProvider = class _DefaultJenkinsInfoProvider {
  constructor(config, catalog, auth) {
    this.config = config;
    this.catalog = catalog;
    this.auth = auth;
  }
  static fromConfig(options) {
    const { auth } = backendCommon.createLegacyAuthAdapters(options);
    return new _DefaultJenkinsInfoProvider(
      JenkinsConfig.fromConfig(options.config),
      options.catalog,
      auth
    );
  }
  async getInstance(opt) {
    const entity = await this.catalog.getEntityByRef(
      opt.entityRef,
      opt.credentials && await this.auth.getPluginRequestToken({
        onBehalfOf: opt.credentials,
        targetPluginId: "catalog"
      })
    );
    if (!entity) {
      throw new Error(
        `Couldn't find entity with name: ${catalogModel.stringifyEntityRef(opt.entityRef)}`
      );
    }
    const jenkinsAndJobName = _DefaultJenkinsInfoProvider.getEntityAnnotationValue(entity);
    if (!jenkinsAndJobName) {
      throw new Error(
        `Couldn't find jenkins annotation (${_DefaultJenkinsInfoProvider.NEW_JENKINS_ANNOTATION}) on entity with name: ${catalogModel.stringifyEntityRef(opt.entityRef)}`
      );
    }
    let jobFullName;
    let jenkinsName;
    const splitIndex = jenkinsAndJobName.indexOf(":");
    if (splitIndex === -1) {
      jobFullName = jenkinsAndJobName;
    } else {
      jenkinsName = jenkinsAndJobName.substring(0, splitIndex);
      jobFullName = jenkinsAndJobName.substring(
        splitIndex + 1,
        jenkinsAndJobName.length
      );
    }
    const instanceConfig = this.config.getInstanceConfig(jenkinsName);
    const creds = Buffer.from(
      `${instanceConfig.username}:${instanceConfig.apiKey}`,
      "binary"
    ).toString("base64");
    return {
      baseUrl: instanceConfig.baseUrl,
      headers: {
        Authorization: `Basic ${creds}`,
        ...instanceConfig.extraRequestHeaders
      },
      jobFullName,
      crumbIssuer: instanceConfig.crumbIssuer
    };
  }
  static getEntityAnnotationValue(entity) {
    var _a, _b;
    return ((_a = entity.metadata.annotations) == null ? void 0 : _a[_DefaultJenkinsInfoProvider.OLD_JENKINS_ANNOTATION]) || ((_b = entity.metadata.annotations) == null ? void 0 : _b[_DefaultJenkinsInfoProvider.NEW_JENKINS_ANNOTATION]);
  }
};
__publicField$1(_DefaultJenkinsInfoProvider, "OLD_JENKINS_ANNOTATION", "jenkins.io/github-folder");
__publicField$1(_DefaultJenkinsInfoProvider, "NEW_JENKINS_ANNOTATION", "jenkins.io/job-full-name");
let DefaultJenkinsInfoProvider = _DefaultJenkinsInfoProvider;

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const _JenkinsApiImpl = class _JenkinsApiImpl {
  constructor(permissionApi) {
    this.permissionApi = permissionApi;
  }
  /**
   * Get a list of projects for the given JenkinsInfo.
   * @see ../../../jenkins/src/api/JenkinsApi.ts#getProjects
   */
  async getProjects(jenkinsInfo, branches) {
    const client = await _JenkinsApiImpl.getClient(jenkinsInfo);
    const projects = [];
    if (branches) {
      const job = await Promise.any(
        branches.map(
          (branch) => client.job.get({
            name: `${jenkinsInfo.jobFullName}/${encodeURIComponent(branch)}`,
            tree: _JenkinsApiImpl.jobTreeSpec.replace(/\s/g, "")
          })
        )
      );
      projects.push(this.augmentProject(job));
    } else {
      const project = await client.job.get({
        name: jenkinsInfo.jobFullName,
        // Filter only be the information we need, instead of loading all fields.
        // Limit to only show the latest build for each job and only load 50 jobs
        // at all.
        // Whitespaces are only included for readability here and stripped out
        // before sending to Jenkins
        tree: _JenkinsApiImpl.jobsTreeSpec.replace(/\s/g, "")
      });
      const isStandaloneProject = !project.jobs;
      if (isStandaloneProject) {
        const standaloneProject = await client.job.get({
          name: jenkinsInfo.jobFullName,
          tree: _JenkinsApiImpl.jobTreeSpec.replace(/\s/g, "")
        });
        projects.push(this.augmentProject(standaloneProject));
        return projects;
      }
      for (const jobDetails of project.jobs) {
        projects.push(this.augmentProject(jobDetails));
      }
    }
    return projects;
  }
  /**
   * Get a single build.
   * @see ../../../jenkins/src/api/JenkinsApi.ts#getBuild
   */
  async getBuild(jenkinsInfo, jobFullName, buildNumber) {
    const client = await _JenkinsApiImpl.getClient(jenkinsInfo);
    const project = await client.job.get({
      name: jobFullName,
      depth: 1
    });
    const build = await client.build.get(jobFullName, buildNumber);
    const jobScmInfo = _JenkinsApiImpl.extractScmDetailsFromJob(project);
    return this.augmentBuild(build, jobScmInfo);
  }
  /**
   * Trigger a build of a project
   * @see ../../../jenkins/src/api/JenkinsApi.ts#retry
   */
  async rebuildProject(jenkinsInfo, jobFullName, buildNumber, resourceRef, options) {
    if (this.permissionApi) {
      const response2 = await this.permissionApi.authorize(
        [{ permission: pluginJenkinsCommon.jenkinsExecutePermission, resourceRef }],
        { credentials: options.credentials }
      );
      const { result } = response2[0];
      if (result === pluginPermissionCommon.AuthorizeResult.DENY) {
        return 401;
      }
    }
    const buildUrl = this.getBuildUrl(jenkinsInfo, jobFullName, buildNumber);
    const response = await fetch__default.default(`${buildUrl}/replay/rebuild`, {
      method: "post",
      headers: jenkinsInfo.headers
    });
    return response.status;
  }
  // private helper methods
  static async getClient(jenkinsInfo) {
    return new Jenkins__default.default({
      baseUrl: jenkinsInfo.baseUrl,
      headers: jenkinsInfo.headers,
      promisify: true,
      crumbIssuer: jenkinsInfo.crumbIssuer
    });
  }
  augmentProject(project) {
    let status;
    if (project.inQueue) {
      status = "queued";
    } else if (!project.lastBuild) {
      status = "build not found";
    } else if (project.lastBuild.building) {
      status = "running";
    } else if (!project.lastBuild.result) {
      status = "unknown";
    } else {
      status = project.lastBuild.result;
    }
    const jobScmInfo = _JenkinsApiImpl.extractScmDetailsFromJob(project);
    return {
      ...project,
      lastBuild: project.lastBuild ? this.augmentBuild(project.lastBuild, jobScmInfo) : null,
      status
      // actions: undefined,
    };
  }
  augmentBuild(build, jobScmInfo) {
    const source = build.actions.filter(
      (action) => (action == null ? void 0 : action._class) === "hudson.plugins.git.util.BuildData"
    ).map((action) => {
      const [first] = Object.values(action.buildsByBranchName);
      const branch = first.revision.branch[0];
      return {
        branchName: branch.name,
        commit: {
          hash: branch.SHA1.substring(0, 8)
        }
      };
    }).pop() || {};
    if (jobScmInfo) {
      source.url = jobScmInfo.url;
      source.displayName = jobScmInfo.displayName;
      source.author = jobScmInfo.author;
    }
    let status;
    if (build.building) {
      status = "running";
    } else if (!build.result) {
      status = "unknown";
    } else {
      status = build.result;
    }
    return {
      ...build,
      status,
      source,
      tests: this.getTestReport(build)
    };
  }
  static extractScmDetailsFromJob(project) {
    const scmInfo = project.actions.filter(
      (action) => (action == null ? void 0 : action._class) === "jenkins.scm.api.metadata.ObjectMetadataAction"
    ).map((action) => {
      return {
        url: action == null ? void 0 : action.objectUrl,
        // https://javadoc.jenkins.io/plugin/scm-api/jenkins/scm/api/metadata/ObjectMetadataAction.html
        // branch name for regular builds, pull request title on pull requests
        displayName: action == null ? void 0 : action.objectDisplayName
      };
    }).pop();
    if (!scmInfo) {
      return void 0;
    }
    const author = project.actions.filter(
      (action) => (action == null ? void 0 : action._class) === "jenkins.scm.api.metadata.ContributorMetadataAction"
    ).map((action) => {
      return action.contributorDisplayName;
    }).pop();
    if (author) {
      scmInfo.author = author;
    }
    return scmInfo;
  }
  getTestReport(build) {
    return build.actions.filter(
      (action) => (action == null ? void 0 : action._class) === "hudson.tasks.junit.TestResultAction"
    ).map((action) => {
      return {
        total: action.totalCount,
        passed: action.totalCount - action.failCount - action.skipCount,
        skipped: action.skipCount,
        failed: action.failCount,
        testUrl: `${build.url}${action.urlName}/`
      };
    }).pop();
  }
  getBuildUrl(jenkinsInfo, jobFullName, buildId) {
    const jobs = jobFullName.split("/");
    return `${jenkinsInfo.baseUrl}/job/${jobs.join("/job/")}/${buildId}`;
  }
  async getJobBuilds(jenkinsInfo, jobFullName) {
    let jobName = jobFullName;
    if (jobFullName.includes("/")) {
      const arr = jobFullName.split("/");
      const multibranchJobName = arr.shift();
      jobName = [
        multibranchJobName,
        "job",
        encodeURIComponent(arr.join("/"))
      ].join("/");
    }
    const response = await fetch__default.default(
      `${jenkinsInfo.baseUrl}/job/${jobName}/api/json?tree=${_JenkinsApiImpl.jobBuildsTreeSpec.replace(
        /\s/g,
        ""
      )}`,
      {
        method: "get",
        headers: jenkinsInfo.headers
      }
    );
    const jobBuilds = await response.json();
    return jobBuilds;
  }
};
__publicField(_JenkinsApiImpl, "lastBuildTreeSpec", `lastBuild[
                    number,
                    url,
                    fullDisplayName,
                    displayName,
                    building,
                    result,
                    timestamp,
                    duration,
                    actions[
                      *[
                        *[
                          *[
                            *
                          ]
                        ]
                      ]
                    ]
                  ],`);
__publicField(_JenkinsApiImpl, "jobTreeSpec", `actions[*],
                   ${_JenkinsApiImpl.lastBuildTreeSpec}
                   jobs{0,1},
                   url,
                   name,
                   fullName,
                   displayName,
                   fullDisplayName,
                   inQueue`);
__publicField(_JenkinsApiImpl, "jobsTreeSpec", `jobs[
                   ${_JenkinsApiImpl.jobTreeSpec}
                 ]{0,50}`);
__publicField(_JenkinsApiImpl, "jobBuildsTreeSpec", `
                   name,
                   description,
                   url,
                   fullName,
                   displayName,
                   fullDisplayName,
                   inQueue,
                   builds[*]`);
let JenkinsApiImpl = _JenkinsApiImpl;

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
  const jenkinsApi = new JenkinsApiImpl(permissionEvaluator);
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
        const projects = await jenkinsApi.getProjects(jenkinsInfo, branches);
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
      const build = await jenkinsApi.getBuild(
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
      const build = await jenkinsApi.getJobBuilds(jenkinsInfo, jobFullName);
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
      const status = await jenkinsApi.rebuildProject(
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

const jenkinsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "jenkins",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        permissions: backendPluginApi.coreServices.permissions,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        config: backendPluginApi.coreServices.rootConfig,
        catalogClient: alpha.catalogServiceRef,
        discovery: backendPluginApi.coreServices.discovery,
        auth: backendPluginApi.coreServices.auth,
        httpAuth: backendPluginApi.coreServices.httpAuth
      },
      async init({
        logger,
        permissions,
        httpRouter,
        config,
        catalogClient,
        discovery,
        auth,
        httpAuth
      }) {
        const winstonLogger = backendCommon.loggerToWinstonLogger(logger);
        const jenkinsInfoProvider = DefaultJenkinsInfoProvider.fromConfig({
          auth,
          httpAuth,
          config,
          catalog: catalogClient,
          discovery
        });
        httpRouter.use(
          await createRouter({
            permissions,
            /**
             * Logger for logging purposes
             */
            logger: winstonLogger,
            /**
             * Info provider to be able to get all necessary information for the APIs
             */
            jenkinsInfoProvider,
            discovery,
            auth,
            httpAuth
          })
        );
      }
    });
  }
});

index_cjs.DefaultJenkinsInfoProvider = DefaultJenkinsInfoProvider;
index_cjs.JenkinsConfig = JenkinsConfig;
index_cjs.createRouter = createRouter;
var _default = index_cjs.default = jenkinsPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
