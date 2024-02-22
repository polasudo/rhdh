'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/backend-common');
var require$$2$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0 = require('@backstage/integration');
var require$$1 = require('@backstage/plugin-catalog-node');
var require$$2 = require('uuid');
var require$$3 = require('node-fetch');
var require$$4 = require('@backstage/backend-tasks');
require('@backstage/catalog-model');
require('lodash');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var alpha_cjs$1 = {};

var GitlabDiscoveryEntityProviderC1949eb0_cjs = {};

var integration = require$$0;
var pluginCatalogNode = require$$1;
var uuid = require$$2;
var fetch = require$$3;
var backendTasks = require$$4;

function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace$1(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var uuid__namespace = /*#__PURE__*/_interopNamespace$1(uuid);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy$1(fetch);

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitLabClient {
  constructor(options) {
    __publicField$1(this, "config");
    __publicField$1(this, "logger");
    this.config = options.config;
    this.logger = options.logger;
  }
  /**
   * Indicates whether the client is for a SaaS or self managed GitLab instance.
   */
  isSelfManaged() {
    return this.config.host !== "gitlab.com";
  }
  async listProjects(options) {
    if (options == null ? void 0 : options.group) {
      return this.pagedRequest(
        `/groups/${encodeURIComponent(options == null ? void 0 : options.group)}/projects`,
        {
          ...options,
          include_subgroups: true
        }
      );
    }
    return this.pagedRequest(`/projects`, options);
  }
  async listUsers(options) {
    return this.pagedRequest(`/users?`, {
      ...options,
      without_project_bots: true,
      exclude_internal: true
    });
  }
  async listSaaSUsers(groupPath, options) {
    return this.pagedRequest(
      `/groups/${encodeURIComponent(groupPath)}/members/all`,
      {
        ...options,
        show_seat_info: true
      }
    ).then((resp) => {
      resp.items = resp.items.filter((user) => user.is_using_seat);
      return resp;
    });
  }
  async listGroups(options) {
    return this.pagedRequest(`/groups`, options);
  }
  async listDescendantGroups(groupPath) {
    var _a, _b;
    const items = [];
    let hasNextPage = false;
    let endCursor = null;
    do {
      const response = await fetch__default["default"](
        `${this.config.baseUrl}/api/graphql`,
        {
          method: "POST",
          headers: {
            ...integration.getGitLabRequestOptions(this.config).headers,
            ["Content-Type"]: "application/json"
          },
          body: JSON.stringify({
            variables: { group: groupPath, endCursor },
            query: (
              /* GraphQL */
              `
              query listDescendantGroups($group: ID!, $endCursor: String) {
                group(fullPath: $group) {
                  descendantGroups(first: 100, after: $endCursor) {
                    nodes {
                      id
                      name
                      description
                      fullPath
                      parent {
                        id
                      }
                    }
                    pageInfo {
                      endCursor
                      hasNextPage
                    }
                  }
                }
              }
            `
            )
          })
        }
      ).then((r) => r.json());
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }
      if (!((_b = (_a = response.data.group) == null ? void 0 : _a.descendantGroups) == null ? void 0 : _b.nodes)) {
        this.logger.warn(
          `Couldn't get groups under ${groupPath}. The provided token might not have sufficient permissions`
        );
        continue;
      }
      for (const groupItem of response.data.group.descendantGroups.nodes.filter(
        (group) => group == null ? void 0 : group.id
      )) {
        const formattedGroupResponse = {
          id: Number(groupItem.id.replace(/^gid:\/\/gitlab\/Group\//, "")),
          name: groupItem.name,
          description: groupItem.description,
          full_path: groupItem.fullPath,
          parent_id: Number(
            groupItem.parent.id.replace(/^gid:\/\/gitlab\/Group\//, "")
          )
        };
        items.push(formattedGroupResponse);
      }
      ({ hasNextPage, endCursor } = response.data.group.descendantGroups.pageInfo);
    } while (hasNextPage);
    return { items };
  }
  async getGroupMembers(groupPath, relations) {
    var _a, _b;
    const items = [];
    let hasNextPage = false;
    let endCursor = null;
    do {
      const response = await fetch__default["default"](
        `${this.config.baseUrl}/api/graphql`,
        {
          method: "POST",
          headers: {
            ...integration.getGitLabRequestOptions(this.config).headers,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            variables: { group: groupPath, relations, endCursor },
            query: (
              /* GraphQL */
              `
              query getGroupMembers(
                $group: ID!
                $relations: [GroupMemberRelation!]
                $endCursor: String
              ) {
                group(fullPath: $group) {
                  groupMembers(
                    first: 100
                    relations: $relations
                    after: $endCursor
                  ) {
                    nodes {
                      user {
                        id
                        username
                        publicEmail
                        name
                        state
                        webUrl
                        avatarUrl
                      }
                    }
                    pageInfo {
                      endCursor
                      hasNextPage
                    }
                  }
                }
              }
            `
            )
          })
        }
      ).then((r) => r.json());
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }
      if (!((_b = (_a = response.data.group) == null ? void 0 : _a.groupMembers) == null ? void 0 : _b.nodes)) {
        this.logger.warn(
          `Couldn't get members for group ${groupPath}. The provided token might not have sufficient permissions`
        );
        continue;
      }
      for (const userItem of response.data.group.groupMembers.nodes.filter(
        (user) => {
          var _a2;
          return (_a2 = user.user) == null ? void 0 : _a2.id;
        }
      )) {
        const formattedUserResponse = {
          id: Number(userItem.user.id.replace(/^gid:\/\/gitlab\/User\//, "")),
          username: userItem.user.username,
          email: userItem.user.publicEmail,
          name: userItem.user.name,
          state: userItem.user.state,
          web_url: userItem.user.webUrl,
          avatar_url: userItem.user.avatarUrl
        };
        items.push(formattedUserResponse);
      }
      ({ hasNextPage, endCursor } = response.data.group.groupMembers.pageInfo);
    } while (hasNextPage);
    return { items };
  }
  /**
   * General existence check.
   *
   * @param projectPath - The path to the project
   * @param branch - The branch used to search
   * @param filePath - The path to the file
   */
  async hasFile(projectPath, branch, filePath) {
    const endpoint = `/projects/${encodeURIComponent(
      projectPath
    )}/repository/files/${encodeURIComponent(filePath)}`;
    const request = new URL(`${this.config.apiBaseUrl}${endpoint}`);
    request.searchParams.append("ref", branch);
    const response = await fetch__default["default"](request.toString(), {
      headers: integration.getGitLabRequestOptions(this.config).headers,
      method: "HEAD"
    });
    if (!response.ok) {
      if (response.status >= 500) {
        this.logger.debug(
          `Unexpected response when fetching ${request.toString()}. Expected 200 but got ${response.status} - ${response.statusText}`
        );
      }
      return false;
    }
    return true;
  }
  /**
   * Performs a request against a given paginated GitLab endpoint.
   *
   * This method may be used to perform authenticated REST calls against any
   * paginated GitLab endpoint which uses X-NEXT-PAGE headers. The return value
   * can be be used with the {@link paginated} async-generator function to yield
   * each item from the paged request.
   *
   * @see {@link paginated}
   * @param endpoint - The request endpoint, e.g. /projects.
   * @param options - Request queryString options which may also include page variables.
   */
  async pagedRequest(endpoint, options) {
    const request = new URL(`${this.config.apiBaseUrl}${endpoint}`);
    for (const key in options) {
      if (options[key] !== void 0 && options[key] !== "") {
        request.searchParams.append(key, options[key].toString());
      }
    }
    this.logger.debug(`Fetching: ${request.toString()}`);
    const response = await fetch__default["default"](
      request.toString(),
      integration.getGitLabRequestOptions(this.config)
    );
    if (!response.ok) {
      throw new Error(
        `Unexpected response when fetching ${request.toString()}. Expected 200 but got ${response.status} - ${response.statusText}`
      );
    }
    return response.json().then((items) => {
      const nextPage = response.headers.get("x-next-page");
      return {
        items,
        nextPage: nextPage ? Number(nextPage) : null
      };
    });
  }
}
async function* paginated(request, options) {
  let res;
  do {
    res = await request(options);
    options.page = res.nextPage;
    for (const item of res.items) {
      yield item;
    }
  } while (res.nextPage);
}

function readGitlabConfig(id, config) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const group = (_a = config.getOptionalString("group")) != null ? _a : "";
  const host = config.getString("host");
  const branch = config.getOptionalString("branch");
  const fallbackBranch = (_b = config.getOptionalString("fallbackBranch")) != null ? _b : "master";
  const catalogFile = (_c = config.getOptionalString("entityFilename")) != null ? _c : "catalog-info.yaml";
  const projectPattern = new RegExp(
    (_d = config.getOptionalString("projectPattern")) != null ? _d : /[\s\S]*/
  );
  const userPattern = new RegExp(
    (_e = config.getOptionalString("userPattern")) != null ? _e : /[\s\S]*/
  );
  const groupPattern = new RegExp(
    (_f = config.getOptionalString("groupPattern")) != null ? _f : /[\s\S]*/
  );
  const orgEnabled = (_g = config.getOptionalBoolean("orgEnabled")) != null ? _g : false;
  const skipForkedRepos = (_h = config.getOptionalBoolean("skipForkedRepos")) != null ? _h : false;
  const schedule = config.has("schedule") ? backendTasks.readTaskScheduleDefinitionFromConfig(config.getConfig("schedule")) : void 0;
  return {
    id,
    group,
    branch,
    fallbackBranch,
    host,
    catalogFile,
    projectPattern,
    userPattern,
    groupPattern,
    schedule,
    orgEnabled,
    skipForkedRepos
  };
}
function readGitlabConfigs(config) {
  const configs = [];
  const providerConfigs = config.getOptionalConfig("catalog.providers.gitlab");
  if (!providerConfigs) {
    return configs;
  }
  for (const id of providerConfigs.keys()) {
    configs.push(readGitlabConfig(id, providerConfigs.getConfig(id)));
  }
  return configs;
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitlabDiscoveryEntityProvider {
  constructor(options) {
    __publicField(this, "config");
    __publicField(this, "integration");
    __publicField(this, "logger");
    __publicField(this, "scheduleFn");
    __publicField(this, "connection");
    this.config = options.config;
    this.integration = options.integration;
    this.logger = options.logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(options.taskRunner);
  }
  static fromConfig(config, options) {
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    const providerConfigs = readGitlabConfigs(config);
    const integrations = integration.ScmIntegrations.fromConfig(config).gitlab;
    const providers = [];
    providerConfigs.forEach((providerConfig) => {
      var _a;
      const integration = integrations.byHost(providerConfig.host);
      if (!integration) {
        throw new Error(
          `No gitlab integration found that matches host ${providerConfig.host}`
        );
      }
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for GitlabDiscoveryEntityProvider:${providerConfig.id}.`
        );
      }
      const taskRunner = (_a = options.schedule) != null ? _a : options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      providers.push(
        new GitlabDiscoveryEntityProvider({
          ...options,
          config: providerConfig,
          integration,
          taskRunner
        })
      );
    });
    return providers;
  }
  getProviderName() {
    return `GitlabDiscoveryEntityProvider:${this.config.id}`;
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: GitlabDiscoveryEntityProvider.prototype.constructor.name,
            taskId,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.refresh(logger);
          } catch (error) {
            logger.error(
              `${this.getProviderName()} refresh failed, ${error}`,
              error
            );
          }
        }
      });
    };
  }
  async refresh(logger) {
    var _a, _b, _c, _d;
    if (!this.connection) {
      throw new Error(
        `Gitlab discovery connection not initialized for ${this.getProviderName()}`
      );
    }
    const client = new GitLabClient({
      config: this.integration.config,
      logger
    });
    const projects = paginated(
      (options) => client.listProjects(options),
      {
        archived: false,
        group: this.config.group,
        page: 1,
        per_page: 50
      }
    );
    const res = {
      scanned: 0,
      matches: []
    };
    for await (const project of projects) {
      if (!this.config.projectPattern.test((_a = project.path_with_namespace) != null ? _a : "")) {
        continue;
      }
      res.scanned++;
      if (this.config.skipForkedRepos && project.hasOwnProperty("forked_from_project")) {
        continue;
      }
      if (!this.config.branch && this.config.fallbackBranch === "*" && project.default_branch === void 0) {
        continue;
      }
      const project_branch = (_c = (_b = this.config.branch) != null ? _b : project.default_branch) != null ? _c : this.config.fallbackBranch;
      const projectHasFile = await client.hasFile(
        (_d = project.path_with_namespace) != null ? _d : "",
        project_branch,
        this.config.catalogFile
      );
      if (projectHasFile) {
        res.matches.push(project);
      }
    }
    const locations = res.matches.map((p) => this.createLocationSpec(p));
    await this.connection.applyMutation({
      type: "full",
      entities: locations.map((location) => ({
        locationKey: this.getProviderName(),
        entity: pluginCatalogNode.locationSpecToLocationEntity({ location })
      }))
    });
  }
  createLocationSpec(project) {
    var _a, _b;
    const project_branch = (_b = (_a = this.config.branch) != null ? _a : project.default_branch) != null ? _b : this.config.fallbackBranch;
    return {
      type: "url",
      target: `${project.web_url}/-/blob/${project_branch}/${this.config.catalogFile}`,
      presence: "optional"
    };
  }
}

GitlabDiscoveryEntityProviderC1949eb0_cjs.GitLabClient = GitLabClient;
GitlabDiscoveryEntityProviderC1949eb0_cjs.GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider;
GitlabDiscoveryEntityProviderC1949eb0_cjs.paginated = paginated;
GitlabDiscoveryEntityProviderC1949eb0_cjs.readGitlabConfigs = readGitlabConfigs;

(function (exports) {

	Object.defineProperty(exports, '__esModule', { value: true });

	var backendPluginApi = require$$0$1;
	var backendCommon = require$$1$1;
	var alpha = require$$2$1;
	var GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProviderC1949eb0_cjs;








	const catalogModuleGitlabDiscoveryEntityProvider = backendPluginApi.createBackendModule({
	  pluginId: "catalog",
	  moduleId: "gitlab-discovery-entity-provider",
	  register(env) {
	    env.registerInit({
	      deps: {
	        config: backendPluginApi.coreServices.rootConfig,
	        catalog: alpha.catalogProcessingExtensionPoint,
	        logger: backendPluginApi.coreServices.logger,
	        scheduler: backendPluginApi.coreServices.scheduler
	      },
	      async init({ config, catalog, logger, scheduler }) {
	        catalog.addEntityProvider(
	          GitlabDiscoveryEntityProvider.GitlabDiscoveryEntityProvider.fromConfig(config, {
	            logger: backendCommon.loggerToWinstonLogger(logger),
	            scheduler
	          })
	        );
	      }
	    });
	  }
	});

	exports["default"] = catalogModuleGitlabDiscoveryEntityProvider;
	
} (alpha_cjs$1));

var alpha_cjs = /*@__PURE__*/getDefaultExportFromCjs(alpha_cjs$1);

exports["default"] = alpha_cjs;
//# sourceMappingURL=index.cjs.js.map
