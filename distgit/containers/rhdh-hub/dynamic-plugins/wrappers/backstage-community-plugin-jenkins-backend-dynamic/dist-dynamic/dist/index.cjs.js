'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/catalog-model');
var require$$1$2 = require('express');
var require$$2 = require('express-promise-router');
var require$$0$1 = require('jenkins');
var require$$1$1 = require('@backstage/plugin-permission-common');
var alpha$1 = require('@backstage/plugin-catalog-common/alpha');
var require$$3 = require('node-fetch');
var require$$6 = require('@backstage/errors');
var require$$7 = require('@backstage/plugin-permission-node');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$2$1 = require('@backstage/plugin-catalog-node/alpha');

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

var jenkinsInfoProvider_cjs = {};

var backendCommon$1 = require$$0;
var catalogModel$2 = require$$1;

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
    const DEFAULT_JENKINS_NAME = "default";
    const jenkinsConfig = config.getConfig("jenkins");
    const namedInstanceConfig = jenkinsConfig.getOptionalConfigArray("instances")?.map((c) => ({
      name: c.getString("name"),
      baseUrl: c.getString("baseUrl"),
      username: c.getString("username"),
      projectCountLimit: c.getOptionalNumber("projectCountLimit"),
      apiKey: c.getString("apiKey"),
      extraRequestHeaders: c.getOptional("extraRequestHeaders"),
      crumbIssuer: c.getOptionalBoolean("crumbIssuer"),
      allowedBaseUrlOverrideRegex: c.getOptionalString(
        "allowedBaseUrlOverrideRegex"
      )
    })) || [];
    const hasNamedDefault = namedInstanceConfig.some(
      (x) => x.name === DEFAULT_JENKINS_NAME
    );
    const baseUrl = jenkinsConfig.getOptionalString("baseUrl");
    const username = jenkinsConfig.getOptionalString("username");
    const apiKey = jenkinsConfig.getOptionalString("apiKey");
    const crumbIssuer = jenkinsConfig.getOptionalBoolean("crumbIssuer");
    const extraRequestHeaders = jenkinsConfig.getOptional("extraRequestHeaders");
    const allowedBaseUrlOverrideRegex = jenkinsConfig.getOptionalString(
      "allowedBaseUrlOverrideRegex"
    );
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
          crumbIssuer,
          allowedBaseUrlOverrideRegex
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
class DefaultJenkinsInfoProvider {
  constructor(config, catalog, auth, logger) {
    this.config = config;
    this.catalog = catalog;
    this.auth = auth;
    this.logger = logger;
  }
  static OLD_JENKINS_ANNOTATION = "jenkins.io/github-folder";
  static NEW_JENKINS_ANNOTATION = "jenkins.io/job-full-name";
  static JENKINS_OVERRIDE_URL = "jenkins.io/override-base-url";
  static fromConfig(options) {
    const { auth } = backendCommon$1.createLegacyAuthAdapters(options);
    return new DefaultJenkinsInfoProvider(
      JenkinsConfig.fromConfig(options.config),
      options.catalog,
      auth,
      options.logger
    );
  }
  async getInstance(opt) {
    const DEFAULT_LIMITATION_OF_PROJECTS = 50;
    const entity = await this.catalog.getEntityByRef(
      opt.entityRef,
      opt.credentials && await this.auth.getPluginRequestToken({
        onBehalfOf: opt.credentials,
        targetPluginId: "catalog"
      })
    );
    if (!entity) {
      throw new Error(
        `Couldn't find entity with name: ${catalogModel$2.stringifyEntityRef(opt.entityRef)}`
      );
    }
    const jenkinsAndJobName = DefaultJenkinsInfoProvider.getEntityAnnotationValue(entity);
    if (!jenkinsAndJobName) {
      throw new Error(
        `Couldn't find jenkins annotation (${DefaultJenkinsInfoProvider.NEW_JENKINS_ANNOTATION}) on entity with name: ${catalogModel$2.stringifyEntityRef(opt.entityRef)}`
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
    const overrideUrlValue = DefaultJenkinsInfoProvider.getEntityOverrideURL(entity);
    if (instanceConfig.allowedBaseUrlOverrideRegex && overrideUrlValue && DefaultJenkinsInfoProvider.verifyUrlMatchesRegex(
      overrideUrlValue,
      instanceConfig.allowedBaseUrlOverrideRegex,
      this.logger
    )) {
      instanceConfig.baseUrl = overrideUrlValue;
    }
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
      projectCountLimit: instanceConfig.projectCountLimit ?? DEFAULT_LIMITATION_OF_PROJECTS,
      crumbIssuer: instanceConfig.crumbIssuer
    };
  }
  static getEntityAnnotationValue(entity) {
    return entity.metadata.annotations?.[DefaultJenkinsInfoProvider.OLD_JENKINS_ANNOTATION] || entity.metadata.annotations?.[DefaultJenkinsInfoProvider.NEW_JENKINS_ANNOTATION];
  }
  static getEntityOverrideURL(entity) {
    return entity.metadata.annotations?.[DefaultJenkinsInfoProvider.JENKINS_OVERRIDE_URL];
  }
  static verifyUrlMatchesRegex(url, regexString, logger) {
    try {
      const regex = new RegExp(regexString);
      if (regex.test(url)) {
        return true;
      }
    } catch (e) {
      logger.warn(`Invalid regex: "${regexString}" - Error: ${e.message}`);
    }
    return false;
  }
}

jenkinsInfoProvider_cjs.DefaultJenkinsInfoProvider = DefaultJenkinsInfoProvider;
jenkinsInfoProvider_cjs.JenkinsConfig = JenkinsConfig;

var router_cjs = {};

var jenkinsApi_cjs = {};

const jenkinsExecutePermission = require$$1$1.createPermission({
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

var require$$8 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var Jenkins = require$$0$1;
var pluginPermissionCommon$2 = require$$1$1;
var pluginJenkinsCommon$1 = require$$8;
var fetch = require$$3;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Jenkins__default = /*#__PURE__*/_interopDefaultCompat$2(Jenkins);
var fetch__default = /*#__PURE__*/_interopDefaultCompat$2(fetch);

class JenkinsApiImpl {
  constructor(permissionApi) {
    this.permissionApi = permissionApi;
  }
  static lastBuildTreeSpec = `lastBuild[
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
                  ],`;
  static jobTreeSpec = `actions[*],
                   ${JenkinsApiImpl.lastBuildTreeSpec}
                   jobs{0,1},
                   url,
                   name,
                   fullName,
                   displayName,
                   fullDisplayName,
                   inQueue`;
  static jobsTreeSpec = `jobs[
                   ${JenkinsApiImpl.jobTreeSpec}
                 ]`;
  static jobBuildsTreeSpec = `
                   name,
                   description,
                   url,
                   fullName,
                   displayName,
                   fullDisplayName,
                   inQueue,
                   builds[*]`;
  /**
   * Get a list of projects for the given JenkinsInfo.
   * @see ../../../jenkins/src/api/JenkinsApi.ts#getProjects
   */
  async getProjects(jenkinsInfo, branches) {
    const client = await JenkinsApiImpl.getClient(jenkinsInfo);
    const projects = [];
    if (branches) {
      const job = await Promise.any(
        branches.map(
          (branch) => client.job.get({
            name: `${jenkinsInfo.jobFullName}/${encodeURIComponent(branch)}`,
            tree: JenkinsApiImpl.jobTreeSpec.replace(/\s/g, "")
          })
        )
      );
      projects.push(this.augmentProject(job));
    } else {
      const limitedJobsTreeSpec = `${JenkinsApiImpl.jobsTreeSpec}{0,${jenkinsInfo.projectCountLimit}}`;
      const project = await client.job.get({
        name: jenkinsInfo.jobFullName,
        // Filter only be the information we need, instead of loading all fields.
        // Whitespaces are only included for readability here and stripped out
        // before sending to Jenkins
        tree: limitedJobsTreeSpec.replace(/\s/g, "")
      });
      const isStandaloneProject = !project.jobs;
      if (isStandaloneProject) {
        const limitedStandaloneJobTreeSpec = `${JenkinsApiImpl.jobTreeSpec}{0,${jenkinsInfo.projectCountLimit}}`;
        const standaloneProject = await client.job.get({
          name: jenkinsInfo.jobFullName,
          tree: limitedStandaloneJobTreeSpec.replace(/\s/g, "")
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
    const client = await JenkinsApiImpl.getClient(jenkinsInfo);
    const project = await client.job.get({
      name: jobFullName,
      depth: 1
    });
    const build = await client.build.get(jobFullName, buildNumber);
    const jobScmInfo = JenkinsApiImpl.extractScmDetailsFromJob(project);
    return this.augmentBuild(build, jobScmInfo);
  }
  /**
   * Trigger a build of a project
   * @see ../../../jenkins/src/api/JenkinsApi.ts#retry
   */
  async rebuildProject(jenkinsInfo, jobFullName, buildNumber, resourceRef, options) {
    if (this.permissionApi) {
      const response2 = await this.permissionApi.authorize(
        [{ permission: pluginJenkinsCommon$1.jenkinsExecutePermission, resourceRef }],
        { credentials: options.credentials }
      );
      const { result } = response2[0];
      if (result === pluginPermissionCommon$2.AuthorizeResult.DENY) {
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
    const jobScmInfo = JenkinsApiImpl.extractScmDetailsFromJob(project);
    return {
      ...project,
      lastBuild: project.lastBuild ? this.augmentBuild(project.lastBuild, jobScmInfo) : null,
      status
      // actions: undefined,
    };
  }
  augmentBuild(build, jobScmInfo) {
    const source = build.actions.filter(
      (action) => action?._class === "hudson.plugins.git.util.BuildData"
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
      (action) => action?._class === "jenkins.scm.api.metadata.ObjectMetadataAction"
    ).map((action) => {
      return {
        url: action?.objectUrl,
        // https://javadoc.jenkins.io/plugin/scm-api/jenkins/scm/api/metadata/ObjectMetadataAction.html
        // branch name for regular builds, pull request title on pull requests
        displayName: action?.objectDisplayName
      };
    }).pop();
    if (!scmInfo) {
      return void 0;
    }
    const author = project.actions.filter(
      (action) => action?._class === "jenkins.scm.api.metadata.ContributorMetadataAction"
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
      (action) => action?._class === "hudson.tasks.junit.TestResultAction"
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
      jobName = jobFullName.split("/").map((s) => `${encodeURIComponent(s)}`).join("/job/");
    }
    const response = await fetch__default.default(
      `${jenkinsInfo.baseUrl}/job/${jobName}/api/json?tree=${JenkinsApiImpl.jobBuildsTreeSpec.replace(
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
}

jenkinsApi_cjs.JenkinsApiImpl = JenkinsApiImpl;

var backendCommon = require$$0;
var express$1 = require$$1$2;
var Router$1 = require$$2;
var jenkinsApi$1 = jenkinsApi_cjs;
var pluginPermissionCommon$1 = require$$1$1;
var catalogModel$1 = require$$1;
var errors$1 = require$$6;
var pluginPermissionNode = require$$7;
var pluginJenkinsCommon = require$$8;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default$1 = /*#__PURE__*/_interopDefaultCompat$1(express$1);
var Router__default$1 = /*#__PURE__*/_interopDefaultCompat$1(Router$1);

async function createRouter(options) {
  const { jenkinsInfoProvider, permissions, logger } = options;
  let permissionEvaluator;
  if (permissions && "authorizeConditional" in permissions) {
    permissionEvaluator = permissions;
  } else {
    logger.warn(
      "PermissionAuthorizer is deprecated. Please use an instance of PermissionEvaluator instead of PermissionAuthorizer in PluginEnvironment#permissions"
    );
    permissionEvaluator = permissions ? pluginPermissionCommon$1.toPermissionEvaluator(permissions) : void 0;
  }
  const { httpAuth } = backendCommon.createLegacyAuthAdapters(options);
  const jenkinsApi$1$1 = new jenkinsApi$1.JenkinsApiImpl(permissionEvaluator);
  const router = Router__default$1.default();
  router.use(express__default$1.default.json());
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
        const projects = await jenkinsApi$1$1.getProjects(jenkinsInfo, branches);
        response.json({
          projects
        });
      } catch (err) {
        if (err.errors) {
          throw new Error(
            `Unable to fetch projects, for ${jenkinsInfo.jobFullName}: ${errors$1.stringifyError(err.errors)}`
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
      const build = await jenkinsApi$1$1.getBuild(
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
      const build = await jenkinsApi$1$1.getJobBuilds(jenkinsInfo, jobFullName);
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
      const resourceRef = catalogModel$1.stringifyEntityRef({ kind, namespace, name });
      const status = await jenkinsApi$1$1.rebuildProject(
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

router_cjs.createRouter = createRouter;

var JenkinsBuilder_cjs = {};

var express = require$$1$2;
var Router = require$$2;
var jenkinsApi = jenkinsApi_cjs;
var pluginPermissionCommon = require$$1$1;
var catalogModel = require$$1;
var errors = require$$6;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

class JenkinsBuilder$2 {
  constructor(env) {
    this.env = env;
  }
  static createBuilder(env) {
    return new JenkinsBuilder$2(env);
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

JenkinsBuilder_cjs.JenkinsBuilder = JenkinsBuilder$2;

var plugin_cjs = {};

var backendPluginApi = require$$0$2;
var jenkinsInfoProvider$1 = jenkinsInfoProvider_cjs;
var alpha = require$$2$1;
var JenkinsBuilder$1 = JenkinsBuilder_cjs;

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
        const jenkinsInfoProvider$1$1 = jenkinsInfoProvider$1.DefaultJenkinsInfoProvider.fromConfig({
          auth,
          httpAuth,
          config,
          catalog: catalogClient,
          discovery,
          logger
        });
        const builder = JenkinsBuilder$1.JenkinsBuilder.createBuilder({
          /**
           * Logger for logging purposes
           */
          logger,
          /**
           * Info provider to be able to get all necessary information for the APIs
           */
          jenkinsInfoProvider: jenkinsInfoProvider$1$1,
          config,
          permissions,
          discovery,
          auth,
          httpAuth
        });
        const { router } = await builder.build();
        httpRouter.use(router);
      }
    });
  }
});

plugin_cjs.jenkinsPlugin = jenkinsPlugin;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var jenkinsInfoProvider = jenkinsInfoProvider_cjs;
var router = router_cjs;
var JenkinsBuilder = JenkinsBuilder_cjs;
var plugin = plugin_cjs;



index_cjs.DefaultJenkinsInfoProvider = jenkinsInfoProvider.DefaultJenkinsInfoProvider;
index_cjs.JenkinsConfig = jenkinsInfoProvider.JenkinsConfig;
index_cjs.createRouter = router.createRouter;
index_cjs.JenkinsBuilder = JenkinsBuilder.JenkinsBuilder;
var _default = index_cjs.default = plugin.jenkinsPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
