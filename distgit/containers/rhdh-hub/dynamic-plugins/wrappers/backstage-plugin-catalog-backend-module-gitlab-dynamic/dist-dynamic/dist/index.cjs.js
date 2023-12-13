'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-common');
var require$$0 = require('@backstage/integration');
var require$$1 = require('@backstage/plugin-catalog-node');
var require$$2 = require('uuid');
var require$$3 = require('node-fetch');
var require$$4 = require('@backstage/backend-tasks');
var require$$6 = require('@backstage/catalog-model');
var require$$7 = require('lodash');

var index_cjs = {};

var GitlabDiscoveryEntityProvider2a906f66_cjs = {};

var integration$1 = require$$0;
var pluginCatalogNode$1 = require$$1;
var uuid$1 = require$$2;
var fetch = require$$3;
var backendTasks = require$$4;

function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace$2(e) {
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

var uuid__namespace$1 = /*#__PURE__*/_interopNamespace$2(uuid$1);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy$1(fetch);

var __defProp$1$1 = Object.defineProperty;
var __defNormalProp$1$1 = (obj, key, value) => key in obj ? __defProp$1$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1$1 = (obj, key, value) => {
  __defNormalProp$1$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitLabClient {
  constructor(options) {
    __publicField$1$1(this, "config");
    __publicField$1$1(this, "logger");
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
      `/groups/${encodeURIComponent(groupPath)}/members`,
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
            ...integration$1.getGitLabRequestOptions(this.config).headers,
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
            ...integration$1.getGitLabRequestOptions(this.config).headers,
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
      headers: integration$1.getGitLabRequestOptions(this.config).headers,
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
      integration$1.getGitLabRequestOptions(this.config)
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

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitlabDiscoveryEntityProvider$1 {
  constructor(options) {
    __publicField$2(this, "config");
    __publicField$2(this, "integration");
    __publicField$2(this, "logger");
    __publicField$2(this, "scheduleFn");
    __publicField$2(this, "connection");
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
    const integrations = integration$1.ScmIntegrations.fromConfig(config).gitlab;
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
        new GitlabDiscoveryEntityProvider$1({
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
            class: GitlabDiscoveryEntityProvider$1.prototype.constructor.name,
            taskId,
            taskInstanceId: uuid__namespace$1.v4()
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
        entity: pluginCatalogNode$1.locationSpecToLocationEntity({ location })
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

GitlabDiscoveryEntityProvider2a906f66_cjs.GitLabClient = GitLabClient;
GitlabDiscoveryEntityProvider2a906f66_cjs.GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider$1;
GitlabDiscoveryEntityProvider2a906f66_cjs.paginated = paginated;
GitlabDiscoveryEntityProvider2a906f66_cjs.readGitlabConfigs = readGitlabConfigs;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendCommon = require$$0$1;
var integration = require$$0;
var pluginCatalogNode = require$$1;
var GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider2a906f66_cjs;

var uuid = require$$2;
var catalogModel = require$$6;
var lodash = require$$7;


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

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitLabDiscoveryProcessor {
  constructor(options) {
    __publicField$1(this, "integrations");
    __publicField$1(this, "logger");
    __publicField$1(this, "cache");
    __publicField$1(this, "skipReposWithoutExactFileMatch");
    __publicField$1(this, "skipForkedRepos");
    this.integrations = options.integrations;
    this.cache = options.pluginCache.getClient();
    this.logger = options.logger;
    this.skipReposWithoutExactFileMatch = options.skipReposWithoutExactFileMatch || false;
    this.skipForkedRepos = options.skipForkedRepos || false;
  }
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const pluginCache = backendCommon.CacheManager.fromConfig(config).forPlugin("gitlab-discovery");
    return new GitLabDiscoveryProcessor({
      ...options,
      integrations,
      pluginCache
    });
  }
  getProcessorName() {
    return "GitLabDiscoveryProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "gitlab-discovery") {
      return false;
    }
    const startTime = /* @__PURE__ */ new Date();
    const { group, host, branch, catalogPath } = parseUrl(location.target);
    const integration = this.integrations.gitlab.byUrl(`https://${host}`);
    if (!integration) {
      throw new Error(
        `There is no GitLab integration that matches ${host}. Please add a configuration entry for it under integrations.gitlab`
      );
    }
    const client = new GitlabDiscoveryEntityProvider.GitLabClient({
      config: integration.config,
      logger: this.logger
    });
    this.logger.debug(`Reading GitLab projects from ${location.target}`);
    const lastActivity = await this.cache.get(this.getCacheKey());
    const opts = {
      archived: false,
      group,
      page: 1,
      // We check for the existence of lastActivity and only set it if it's present to ensure
      // that the options doesn't include the key so that the API doesn't receive an empty query parameter.
      ...lastActivity && { last_activity_after: lastActivity }
    };
    const projects = GitlabDiscoveryEntityProvider.paginated((options) => client.listProjects(options), opts);
    const res = {
      scanned: 0,
      matches: []
    };
    for await (const project of projects) {
      res.scanned++;
      if (branch === "*" && project.default_branch === void 0) {
        continue;
      }
      if (this.skipReposWithoutExactFileMatch) {
        const project_branch = branch === "*" ? project.default_branch : branch;
        const projectHasFile = await client.hasFile(
          project.path_with_namespace,
          project_branch,
          catalogPath
        );
        if (!projectHasFile) {
          continue;
        }
      }
      if (this.skipForkedRepos && project.hasOwnProperty("forked_from_project")) {
        continue;
      }
      res.matches.push(project);
    }
    for (const project of res.matches) {
      const project_branch = branch === "*" ? project.default_branch : branch;
      emit(
        pluginCatalogNode.processingResult.location({
          type: "url",
          // The format expected by the GitLabUrlReader:
          // https://gitlab.com/groupA/teams/teamA/subgroupA/repoA/-/blob/branch/filepath
          //
          // This unfortunately will trigger another API call in `getGitLabFileFetchUrl` to get the project ID.
          // The alternative is using the `buildRawUrl` function, which does not support subgroups, so providing a raw
          // URL here won't work either.
          target: `${project.web_url}/-/blob/${project_branch}/${catalogPath}`,
          presence: "optional"
        })
      );
    }
    await this.cache.set(this.getCacheKey(), startTime.toISOString());
    const duration = ((Date.now() - startTime.getTime()) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${res.scanned} GitLab repositories in ${duration} seconds`
    );
    return true;
  }
  getCacheKey() {
    return `processors/${this.getProcessorName()}/last-activity`;
  }
}
function parseUrl(urlString) {
  const url = new URL(urlString);
  const path = url.pathname.slice(1).split("/");
  const blobIndex = path.findIndex((p) => p === "blob");
  if (blobIndex !== -1 && path.length > blobIndex + 2) {
    const group = blobIndex > 0 ? path.slice(0, blobIndex).join("/") : void 0;
    return {
      group,
      host: url.host,
      branch: decodeURIComponent(path[blobIndex + 1]),
      catalogPath: decodeURIComponent(path.slice(blobIndex + 2).join("/"))
    };
  }
  throw new Error(`Failed to parse ${urlString}`);
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GitlabOrgDiscoveryEntityProvider {
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
    const providerConfigs = GitlabDiscoveryEntityProvider.readGitlabConfigs(config);
    const integrations = integration.ScmIntegrations.fromConfig(config).gitlab;
    const providers = [];
    providerConfigs.forEach((providerConfig) => {
      var _a;
      const integration = integrations.byHost(providerConfig.host);
      if (!providerConfig.orgEnabled) {
        return;
      }
      if (!integration) {
        throw new Error(
          `No gitlab integration found that matches host ${providerConfig.host}`
        );
      }
      if (!providerConfig.group && providerConfig.host === "gitlab.com") {
        throw new Error(
          `Missing 'group' value for GitlabOrgDiscoveryEntityProvider:${providerConfig.id}.`
        );
      }
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for GitlabOrgDiscoveryEntityProvider:${providerConfig.id}.`
        );
      }
      const taskRunner = (_a = options.schedule) != null ? _a : options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      providers.push(
        new GitlabOrgDiscoveryEntityProvider({
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
    return `GitlabOrgDiscoveryEntityProvider:${this.config.id}`;
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
            class: GitlabOrgDiscoveryEntityProvider.prototype.constructor.name,
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
    const client = new GitlabDiscoveryEntityProvider.GitLabClient({
      config: this.integration.config,
      logger
    });
    let groups;
    let users;
    if (client.isSelfManaged()) {
      groups = GitlabDiscoveryEntityProvider.paginated((options) => client.listGroups(options), {
        page: 1,
        per_page: 100
      });
      users = GitlabDiscoveryEntityProvider.paginated((options) => client.listUsers(options), {
        page: 1,
        per_page: 100,
        active: true
      });
    } else {
      groups = (await client.listDescendantGroups(this.config.group)).items;
      const rootGroup = this.config.group.split("/")[0];
      users = GitlabDiscoveryEntityProvider.paginated(
        (options) => client.listSaaSUsers(rootGroup, options),
        {
          page: 1,
          per_page: 100
        }
      );
    }
    const idMappedUser = {};
    const res = {
      scanned: 0,
      matches: []
    };
    const groupRes = {
      scanned: 0,
      matches: []
    };
    for await (const user of users) {
      if (!this.config.userPattern.test((_b = (_a = user.email) != null ? _a : user.username) != null ? _b : "")) {
        continue;
      }
      res.scanned++;
      if (user.state !== "active") {
        continue;
      }
      idMappedUser[user.id] = user;
      res.matches.push(user);
    }
    for await (const group of groups) {
      if (!this.config.groupPattern.test((_c = group.full_path) != null ? _c : "")) {
        continue;
      }
      if (this.config.group && !group.full_path.startsWith(`${this.config.group}/`)) {
        continue;
      }
      groupRes.scanned++;
      groupRes.matches.push(group);
      const groupUsers = await client.getGroupMembers(group.full_path, [
        "DIRECT"
      ]);
      for (const groupUser of groupUsers.items) {
        const user = idMappedUser[groupUser.id];
        if (user) {
          user.groups = ((_d = user.groups) != null ? _d : []).concat(group);
        }
      }
    }
    const groupsWithUsers = groupRes.matches.filter((group) => {
      return res.matches.filter((x) => {
        var _a2;
        return !!((_a2 = x.groups) == null ? void 0 : _a2.find((y) => y.id === group.id));
      }).length > 0;
    });
    const userEntities = res.matches.map(
      (p) => this.createUserEntity(p, this.integration.config.host)
    );
    const groupEntities = this.createGroupEntities(
      groupsWithUsers,
      this.integration.config.host
    );
    await this.connection.applyMutation({
      type: "full",
      entities: [...userEntities, ...groupEntities].map((entity) => ({
        locationKey: this.getProviderName(),
        entity: this.withLocations(
          this.integration.config.host,
          this.integration.config.baseUrl,
          entity
        )
      }))
    });
  }
  createGroupEntities(groupResult, host) {
    const idMapped = {};
    const entities = [];
    for (const group of groupResult) {
      idMapped[group.id] = group;
    }
    for (const group of groupResult) {
      const entity = this.createGroupEntity(group, host);
      if (group.parent_id && idMapped.hasOwnProperty(group.parent_id)) {
        entity.spec.parent = this.groupName(
          idMapped[group.parent_id].full_path
        );
      }
      entities.push(entity);
    }
    return entities;
  }
  withLocations(host, baseUrl, entity) {
    var _a;
    const location = entity.kind === "Group" ? `url:${baseUrl}/${(_a = entity.metadata.annotations) == null ? void 0 : _a[`${host}/team-path`]}` : `url:${baseUrl}/${entity.metadata.name}`;
    return lodash.merge(
      {
        metadata: {
          annotations: {
            [catalogModel.ANNOTATION_LOCATION]: location,
            [catalogModel.ANNOTATION_ORIGIN_LOCATION]: location
          }
        }
      },
      entity
    );
  }
  createUserEntity(user, host) {
    var _a;
    const annotations = {};
    annotations[`${host}/user-login`] = user.web_url;
    if ((_a = user == null ? void 0 : user.group_saml_identity) == null ? void 0 : _a.extern_uid) {
      annotations[`${host}/saml-external-uid`] = user.group_saml_identity.extern_uid;
    }
    const entity = {
      apiVersion: "backstage.io/v1alpha1",
      kind: "User",
      metadata: {
        name: user.username,
        annotations
      },
      spec: {
        profile: {
          displayName: user.name || void 0,
          picture: user.avatar_url || void 0
        },
        memberOf: []
      }
    };
    if (user.email) {
      if (!entity.spec) {
        entity.spec = {};
      }
      if (!entity.spec.profile) {
        entity.spec.profile = {};
      }
      entity.spec.profile.email = user.email;
    }
    if (user.groups) {
      for (const group of user.groups) {
        if (!entity.spec.memberOf) {
          entity.spec.memberOf = [];
        }
        entity.spec.memberOf.push(this.groupName(group.full_path));
      }
    }
    return entity;
  }
  groupName(full_path) {
    if (this.config.group && full_path.startsWith(`${this.config.group}/`)) {
      return full_path.replace(`${this.config.group}/`, "").replaceAll("/", "-");
    }
    return full_path.replaceAll("/", "-");
  }
  createGroupEntity(group, host) {
    const annotations = {};
    annotations[`${host}/team-path`] = group.full_path;
    const entity = {
      apiVersion: "backstage.io/v1alpha1",
      kind: "Group",
      metadata: {
        name: this.groupName(group.full_path),
        annotations
      },
      spec: {
        type: "team",
        children: [],
        profile: {
          displayName: group.name
        }
      }
    };
    if (group.description) {
      entity.metadata.description = group.description;
    }
    return entity;
  }
}

var GitlabDiscoveryEntityProvider_1 = index_cjs.GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider.GitlabDiscoveryEntityProvider;
index_cjs.GitLabDiscoveryProcessor = GitLabDiscoveryProcessor;
index_cjs.GitlabOrgDiscoveryEntityProvider = GitlabOrgDiscoveryEntityProvider;

const dynamicPluginInstaller = {
  kind: "legacy",
  async catalog(builder, env) {
    builder.addEntityProvider(
      ...GitlabDiscoveryEntityProvider_1.fromConfig(env.config, {
        logger: env.logger,
        scheduler: env.scheduler
      })
    );
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
