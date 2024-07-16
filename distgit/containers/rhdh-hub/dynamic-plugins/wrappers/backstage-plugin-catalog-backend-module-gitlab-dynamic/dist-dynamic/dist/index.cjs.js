'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$2$1 = require('@backstage/plugin-events-node');
var require$$0 = require('@backstage/integration');
var require$$1 = require('@backstage/plugin-catalog-node');
var require$$2 = require('uuid');
var require$$3 = require('@backstage/backend-tasks');
var require$$4 = require('node-fetch');
var require$$5 = require('path');
require('@backstage/catalog-model');
require('lodash');

var alpha_cjs = {};

var GitlabDiscoveryEntityProviderCjTYReyJ_cjs = {};

var integration = require$$0;
var pluginCatalogNode = require$$1;
var uuid = require$$2;
var backendTasks = require$$3;
var fetch = require$$4;
var path = require$$5;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
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
  n.default = e;
  return Object.freeze(n);
}

var uuid__namespace = /*#__PURE__*/_interopNamespaceCompat(uuid);
var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);
var path__namespace = /*#__PURE__*/_interopNamespaceCompat(path);

function readGitlabConfig(id, config) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
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
  const allowInherited = (_h = config.getOptionalBoolean("allowInherited")) != null ? _h : false;
  const skipForkedRepos = (_i = config.getOptionalBoolean("skipForkedRepos")) != null ? _i : false;
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
    allowInherited,
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
  async getProjectById(projectId, options) {
    const response = await this.nonPagedRequest(
      `/projects/${projectId}`,
      options
    );
    return response;
  }
  async getGroupById(groupId, options) {
    const response = await this.nonPagedRequest(`/groups/${groupId}`, options);
    return response;
  }
  async getUserById(userId, options) {
    const response = await this.nonPagedRequest(`/users/${userId}`, options);
    return response;
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
      const response = await fetch__default.default(
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
                      visibility
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
          visibility: groupItem.visibility,
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
      const response = await fetch__default.default(
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
    const response = await fetch__default.default(request.toString(), {
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
      if (options.hasOwnProperty(key)) {
        const value = options[key];
        if (value !== void 0 && value !== "") {
          request.searchParams.append(key, value.toString());
        }
      }
    }
    this.logger.debug(`Fetching: ${request.toString()}`);
    const response = await fetch__default.default(
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
  async nonPagedRequest(endpoint, options) {
    const request = new URL(`${this.config.apiBaseUrl}${endpoint}`);
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        const value = options[key];
        if (value !== void 0 && value !== "") {
          request.searchParams.append(key, value.toString());
        }
      }
    }
    const response = await fetch__default.default(
      request.toString(),
      integration.getGitLabRequestOptions(this.config)
    );
    if (!response.ok) {
      throw new Error(
        `Unexpected response when fetching ${request.toString()}. Expected 200 but got ${response.status} - ${response.statusText}`
      );
    }
    return response.json();
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

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const TOPIC_REPO_PUSH = "gitlab.push";
class GitlabDiscoveryEntityProvider$1 {
  /**
   * Constructs a GitlabDiscoveryEntityProvider instance.
   *
   * @param options - Configuration options including config, integration, logger, and taskRunner.
   */
  constructor(options) {
    __publicField(this, "config");
    __publicField(this, "integration");
    __publicField(this, "logger");
    __publicField(this, "scheduleFn");
    __publicField(this, "connection");
    __publicField(this, "events");
    __publicField(this, "gitLabClient");
    this.config = options.config;
    this.integration = options.integration;
    this.logger = options.logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(options.taskRunner);
    this.events = options.events;
    this.gitLabClient = new GitLabClient({
      config: this.integration.config,
      logger: this.logger
    });
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
    if (this.events) {
      await this.events.subscribe({
        id: this.getProviderName(),
        topics: [TOPIC_REPO_PUSH],
        onEvent: async (params) => {
          if (params.topic !== TOPIC_REPO_PUSH) {
            return;
          }
          await this.onRepoPush(params.eventPayload);
        }
      });
    }
  }
  /**
   * Creates a scheduled task runner for refreshing the entity provider.
   *
   * @param taskRunner - The task runner instance.
   * @returns The scheduled function.
   */
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: GitlabDiscoveryEntityProvider$1.prototype.constructor.name,
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
  /**
   * Performs a full scan on the GitLab instance searching for locations to be ingested
   *
   * @param logger - The logger instance for logging.
   */
  async refresh(logger) {
    if (!this.connection) {
      throw new Error(
        `Gitlab discovery connection not initialized for ${this.getProviderName()}`
      );
    }
    const projects = paginated(
      (options) => this.gitLabClient.listProjects(options),
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
      if (await this.shouldProcessProject(project, this.gitLabClient)) {
        res.scanned++;
        res.matches.push(project);
      }
    }
    const locations = res.matches.map((p) => this.createLocationSpec(p));
    logger.info(
      `Processed ${locations.length} from scanned ${res.scanned} projects.`
    );
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
  /**
   * Handles the "gitlab.push" event.
   *
   * @param event - The push event payload.
   */
  async onRepoPush(event) {
    var _a, _b;
    if (!this.connection) {
      throw new Error(
        `Gitlab discovery connection not initialized for ${this.getProviderName()}`
      );
    }
    this.logger.info(
      `Received push event for ${event.project.path_with_namespace}`
    );
    const project = await this.gitLabClient.getProjectById(event.project_id);
    if (!project) {
      this.logger.debug(
        `Ignoring push event for ${event.project.path_with_namespace}`
      );
      return;
    }
    if (!await this.shouldProcessProject(project, this.gitLabClient)) {
      this.logger.debug(`Skipping event ${event.project.path_with_namespace}`);
      return;
    }
    const added = this.getFilesMatchingConfig(
      event,
      "added",
      this.config.catalogFile
    );
    const removed = this.getFilesMatchingConfig(
      event,
      "removed",
      this.config.catalogFile
    );
    const modified = this.getFilesMatchingConfig(
      event,
      "modified",
      this.config.catalogFile
    );
    const addedEntities = this.createLocationSpecCommitedFiles(
      event.project,
      added
    );
    const removedEntities = this.createLocationSpecCommitedFiles(
      event.project,
      removed
    );
    if (addedEntities.length > 0 || removedEntities.length > 0) {
      await this.connection.applyMutation({
        type: "delta",
        added: this.toDeferredEntities(
          addedEntities.map((entity) => entity.target)
        ),
        removed: this.toDeferredEntities(
          removedEntities.map((entity) => entity.target)
        )
      });
    }
    if (modified.length > 0) {
      const projectBranch = (_b = (_a = this.config.branch) != null ? _a : event.project.default_branch) != null ? _b : this.config.fallbackBranch;
      await this.connection.refresh({
        keys: [
          ...modified.map(
            (filePath) => `url:${event.project.web_url}/-/tree/${projectBranch}/${filePath}`
          ),
          ...modified.map(
            (filePath) => `url:${event.project.web_url}/-/blob/${projectBranch}/${filePath}`
          )
        ]
      });
    }
    this.logger.info(
      `Processed GitLab push event from ${event.project.web_url}: added ${added.length} - removed ${removed.length} - modified ${modified.length}`
    );
  }
  /**
   * Gets files matching the specified commit action and catalog file name.
   *
   * @param event - The push event payload.
   * @param action - The action type ('added', 'removed', or 'modified').
   * @param catalogFile - The catalog file name.
   * @returns An array of file paths.
   */
  getFilesMatchingConfig(event, action, catalogFile) {
    if (!event.commits) {
      return [];
    }
    const matchingFiles = event.commits.flatMap(
      (element) => element[action].filter(
        (file) => path__namespace.basename(file) === catalogFile
      )
    );
    if (matchingFiles.length === 0) {
      this.logger.debug(
        `No files matching '${catalogFile}' found in the commits.`
      );
    }
    return matchingFiles;
  }
  /**
   * Creates Backstage location specs for committed files.
   *
   * @param project - The GitLab project information.
   * @param addedFiles - The array of added file paths.
   * @returns An array of location specs.
   */
  createLocationSpecCommitedFiles(project, addedFiles) {
    var _a, _b;
    const projectBranch = (_b = (_a = this.config.branch) != null ? _a : project.default_branch) != null ? _b : this.config.fallbackBranch;
    const matchingFiles = addedFiles.filter(
      (file) => path__namespace.basename(file) === this.config.catalogFile
    );
    const locationSpecs = matchingFiles.map((file) => ({
      type: "url",
      target: `${project.web_url}/-/blob/${projectBranch}/${file}`,
      presence: "optional"
    }));
    return locationSpecs;
  }
  /**
   * Converts a target URL to a LocationSpec object.
   *
   * @param {string} target - The target URL to be converted.
   * @returns {LocationSpec} The LocationSpec object representing the URL.
   */
  toLocationSpec(target) {
    return {
      type: "url",
      target,
      presence: "optional"
    };
  }
  toDeferredEntities(targets) {
    return targets.map((target) => {
      const location = this.toLocationSpec(target);
      return pluginCatalogNode.locationSpecToLocationEntity({ location });
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  async shouldProcessProject(project, client) {
    var _a, _b, _c, _d;
    if (!this.config.projectPattern.test((_a = project.path_with_namespace) != null ? _a : "")) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it does not match the project pattern ${this.config.projectPattern}.`
      );
      return false;
    }
    if (this.config.group && !project.path_with_namespace.startsWith(`${this.config.group}/`)) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it does not match the group pattern ${this.config.group}.`
      );
      return false;
    }
    if (this.config.skipForkedRepos && project.hasOwnProperty("forked_from_project")) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it is a forked project.`
      );
      return false;
    }
    const project_branch = (_c = (_b = this.config.branch) != null ? _b : project.default_branch) != null ? _c : this.config.fallbackBranch;
    const hasFile = await client.hasFile(
      (_d = project.path_with_namespace) != null ? _d : "",
      project_branch,
      this.config.catalogFile
    );
    return hasFile;
  }
}

GitlabDiscoveryEntityProviderCjTYReyJ_cjs.GitLabClient = GitLabClient;
GitlabDiscoveryEntityProviderCjTYReyJ_cjs.GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider$1;
GitlabDiscoveryEntityProviderCjTYReyJ_cjs.paginated = paginated;
GitlabDiscoveryEntityProviderCjTYReyJ_cjs.readGitlabConfigs = readGitlabConfigs;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0$1;
var alpha = require$$1$1;
var pluginEventsNode = require$$2$1;
var GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProviderCjTYReyJ_cjs;









const catalogModuleGitlabDiscoveryEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "gitlab-discovery-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        catalog: alpha.catalogProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        events: pluginEventsNode.eventsServiceRef
      },
      async init({ config, catalog, logger, scheduler, events }) {
        const gitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider.GitlabDiscoveryEntityProvider.fromConfig(config, {
          logger,
          events,
          scheduler
        });
        catalog.addEntityProvider(gitlabDiscoveryEntityProvider);
      }
    });
  }
});

var _default = alpha_cjs.default = catalogModuleGitlabDiscoveryEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
