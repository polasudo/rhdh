'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$2$1 = require('@backstage/plugin-events-node');
var require$$0 = require('@backstage/integration');
var fetch = require('cross-fetch');
var require$$2 = require('@backstage/plugin-catalog-node');
var require$$3 = require('@backstage/backend-tasks');
var require$$4 = require('uuid');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var require$$0__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$0$1);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1$1);
var require$$2__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$2$1);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);
var require$$3__default = /*#__PURE__*/_interopDefaultLegacy(require$$3);
var require$$4__default = /*#__PURE__*/_interopDefaultLegacy(require$$4);

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

var alpha_cjs = {};

var BitbucketCloudEntityProviderCTjViEQW_cjs = {};

class WithPagination {
  constructor(createUrl, fetch) {
    this.createUrl = createUrl;
    this.fetch = fetch;
  }
  getPage(options) {
    const opts = { page: 1, pagelen: 100, ...options };
    const url = this.createUrl(opts);
    return this.fetch(url);
  }
  async *iteratePages(options) {
    const opts = { page: 1, pagelen: 100, ...options };
    let url = this.createUrl(opts);
    let res;
    do {
      res = await this.fetch(url);
      url = res.next ? new URL(res.next) : void 0;
      yield res;
    } while (url);
  }
  async *iterateResults(options) {
    var _a;
    const opts = { page: 1, pagelen: 100, ...options };
    let url = this.createUrl(opts);
    let res;
    do {
      res = await this.fetch(url);
      url = res.next ? new URL(res.next) : void 0;
      for (const item of (_a = res.values) != null ? _a : []) {
        yield item;
      }
    } while (url);
  }
}

class BitbucketCloudClient {
  constructor(config) {
    this.config = config;
  }
  static fromConfig(config) {
    return new BitbucketCloudClient(config);
  }
  searchCode(workspace, query, options) {
    const workspaceEnc = encodeURIComponent(workspace);
    return new WithPagination(
      (paginationOptions) => this.createUrl(`/workspaces/${workspaceEnc}/search/code`, {
        ...paginationOptions,
        ...options,
        search_query: query
      }),
      (url) => this.getTypeMapped(url)
    );
  }
  listRepositoriesByWorkspace(workspace, options) {
    const workspaceEnc = encodeURIComponent(workspace);
    return new WithPagination(
      (paginationOptions) => this.createUrl(`/repositories/${workspaceEnc}`, {
        ...paginationOptions,
        ...options
      }),
      (url) => this.getTypeMapped(url)
    );
  }
  createUrl(endpoint, options) {
    const request = new URL(this.config.apiBaseUrl + endpoint);
    for (const key in options) {
      if (options[key]) {
        request.searchParams.append(key, options[key].toString());
      }
    }
    return request;
  }
  async getTypeMapped(url) {
    return this.get(url).then(
      (response) => response.json()
    );
  }
  async get(url) {
    return this.request(new fetch.Request(url.toString(), { method: "GET" }));
  }
  async request(req) {
    return fetch__default["default"](req, { headers: this.getAuthHeaders() }).then(
      (response) => {
        if (!response.ok) {
          throw new Error(
            `Unexpected response for ${req.method} ${req.url}. Expected 200 but got ${response.status} - ${response.statusText}`
          );
        }
        return response;
      }
    );
  }
  getAuthHeaders() {
    const headers = {};
    if (this.config.username) {
      const buffer = Buffer.from(
        `${this.config.username}:${this.config.appPassword}`,
        "utf8"
      );
      headers.Authorization = `Basic ${buffer.toString("base64")}`;
    }
    return headers;
  }
}

var Models;
((Models2) => {
  Models2.BaseCommitSummaryMarkupEnum = {
    Markdown: "markdown",
    Creole: "creole",
    Plaintext: "plaintext"
  };
  Models2.BranchMergeStrategiesEnum = {
    MergeCommit: "merge_commit",
    Squash: "squash",
    FastForward: "fast_forward"
  };
  Models2.CommitFileAttributesEnum = {
    Link: "link",
    Executable: "executable",
    Subrepository: "subrepository",
    Binary: "binary",
    Lfs: "lfs"
  };
  Models2.ParticipantRoleEnum = {
    Participant: "PARTICIPANT",
    Reviewer: "REVIEWER"
  };
  Models2.ParticipantStateEnum = {
    Approved: "approved",
    ChangesRequested: "changes_requested",
    Null: "null"
  };
  Models2.RepositoryForkPolicyEnum = {
    AllowForks: "allow_forks",
    NoPublicForks: "no_public_forks",
    NoForks: "no_forks"
  };
  Models2.RepositoryScmEnum = {
    Git: "git"
  };
})(Models || (Models = {}));

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	BitbucketCloudClient: BitbucketCloudClient,
	get Models () { return Models; },
	WithPagination: WithPagination
});

var require$$1 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var integration = require$$0__default["default"];
var pluginBitbucketCloudCommon = require$$1;
var pluginCatalogNode = require$$2__default["default"];
var backendTasks = require$$3__default["default"];
var uuid = require$$4__default["default"];

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

const DEFAULT_CATALOG_PATH = "/catalog-info.yaml";
const DEFAULT_PROVIDER_ID = "default";
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.bitbucketCloud"
  );
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("workspace")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  var _a;
  const workspace = config.getString("workspace");
  const catalogPath = (_a = config.getOptionalString("catalogPath")) != null ? _a : DEFAULT_CATALOG_PATH;
  const projectKeyPattern = config.getOptionalString("filters.projectKey");
  const repoSlugPattern = config.getOptionalString("filters.repoSlug");
  const schedule = config.has("schedule") ? backendTasks.readTaskScheduleDefinitionFromConfig(config.getConfig("schedule")) : void 0;
  return {
    id,
    catalogPath,
    workspace,
    filters: {
      projectKey: projectKeyPattern ? compileRegExp(projectKeyPattern) : void 0,
      repoSlug: repoSlugPattern ? compileRegExp(repoSlugPattern) : void 0
    },
    schedule
  };
}
function compileRegExp(pattern) {
  let fullLinePattern = pattern;
  if (!fullLinePattern.startsWith("^")) {
    fullLinePattern = `^${fullLinePattern}`;
  }
  if (!fullLinePattern.endsWith("$")) {
    fullLinePattern = `${fullLinePattern}$`;
  }
  return new RegExp(fullLinePattern);
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const DEFAULT_BRANCH = "master";
const TOPIC_REPO_PUSH = "bitbucketCloud.repo:push";
const ANNOTATION_BITBUCKET_CLOUD_REPO_URL = "bitbucket.org/repo-url";
class BitbucketCloudEntityProvider$1 {
  constructor(config, integration, logger, taskRunner, catalogApi, events, tokenManager) {
    __publicField(this, "client");
    __publicField(this, "config");
    __publicField(this, "logger");
    __publicField(this, "scheduleFn");
    __publicField(this, "catalogApi");
    __publicField(this, "events");
    __publicField(this, "tokenManager");
    __publicField(this, "connection");
    __publicField(this, "eventConfigErrorThrown", false);
    this.client = pluginBitbucketCloudCommon.BitbucketCloudClient.fromConfig(integration.config);
    this.config = config;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
    this.catalogApi = catalogApi;
    this.events = events;
    this.tokenManager = tokenManager;
  }
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const integration$1 = integrations.bitbucketCloud.byHost("bitbucket.org");
    if (!integration$1) {
      throw new Error("No integration for bitbucket.org available");
    }
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    return readProviderConfigs(config).map((providerConfig) => {
      var _a;
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for bitbucketCloud-provider:${providerConfig.id}.`
        );
      }
      const taskRunner = (_a = options.schedule) != null ? _a : options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new BitbucketCloudEntityProvider$1(
        providerConfig,
        integration$1,
        options.logger,
        taskRunner,
        options.catalogApi,
        options.events,
        options.tokenManager
      );
    });
  }
  createScheduleFn(schedule) {
    return async () => {
      const taskId = this.getTaskId();
      return schedule.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: BitbucketCloudEntityProvider$1.prototype.constructor.name,
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
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `bitbucketCloud-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getTaskId} */
  getTaskId() {
    return `${this.getProviderName()}:refresh`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
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
  async refresh(logger) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    logger.info("Discovering catalog files in Bitbucket Cloud repositories");
    const targets = await this.findCatalogFiles();
    const entities = this.toDeferredEntities(targets);
    await this.connection.applyMutation({
      type: "full",
      entities
    });
    logger.info(
      `Committed ${entities.length} Locations for catalog files in Bitbucket Cloud repositories`
    );
  }
  canHandleEvents() {
    if (this.catalogApi && this.tokenManager) {
      return true;
    }
    if (!this.eventConfigErrorThrown) {
      this.eventConfigErrorThrown = true;
      throw new Error(
        `${this.getProviderName()} not well configured to handle repo:push. Missing CatalogApi and/or TokenManager.`
      );
    }
    return false;
  }
  enhanceEvent(event) {
    event.repository.slug = event.repository.full_name.split("/", 2)[1];
  }
  async onRepoPush(event) {
    if (!this.canHandleEvents()) {
      return;
    }
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    this.enhanceEvent(event);
    if (event.repository.workspace.slug !== this.config.workspace) {
      return;
    }
    if (!this.matchesFilters(event.repository)) {
      return;
    }
    const repoSlug = event.repository.slug;
    const repoUrl = event.repository.links.html.href;
    this.logger.info(`handle repo:push event for ${repoUrl}`);
    const targets = await this.findCatalogFiles(repoSlug);
    const { token } = await this.tokenManager.getToken();
    const existing = await this.findExistingLocations(repoUrl, token);
    const added = this.toDeferredEntities(
      targets.filter(
        // All Locations are managed by this provider and only have `target`, never `targets`.
        // All URLs (fileUrl, target) are created using `BitbucketCloudEntityProvider.toUrl`.
        // Hence, we can keep the comparison simple and don't need to handle different
        // casing  or encoding, etc.
        (target) => !existing.find((item) => item.spec.target === target.fileUrl)
      )
    );
    const stillExisting = [];
    const removed = [];
    existing.forEach((item) => {
      if (targets.find((value) => value.fileUrl === item.spec.target)) {
        stillExisting.push(item);
      } else {
        removed.push({
          locationKey: this.getProviderName(),
          entity: item
        });
      }
    });
    const promises = [
      this.connection.refresh({
        keys: stillExisting.map((entity) => `url:${entity.spec.target}`)
      })
    ];
    if (added.length > 0 || removed.length > 0) {
      const connection = this.connection;
      promises.push(
        connection.applyMutation({
          type: "delta",
          added,
          removed
        })
      );
    }
    await Promise.all(promises);
  }
  async findExistingLocations(repoUrl, token) {
    const filter = {};
    filter.kind = "Location";
    filter[`metadata.annotations.${ANNOTATION_BITBUCKET_CLOUD_REPO_URL}`] = repoUrl;
    return this.catalogApi.getEntities({ filter }, { token }).then(
      (result) => result.items
    );
  }
  async findCatalogFiles(repoSlug) {
    const workspace = this.config.workspace;
    const catalogPath = this.config.catalogPath;
    const catalogFilename = catalogPath.substring(
      catalogPath.lastIndexOf("/") + 1
    );
    const fields = [
      // exclude code/content match details
      "-values.content_matches",
      // include/add relevant repository details
      "+values.file.commit.repository.mainbranch.name",
      "+values.file.commit.repository.project.key",
      "+values.file.commit.repository.slug",
      // remove irrelevant links
      "-values.*.links",
      "-values.*.*.links",
      "-values.*.*.*.links",
      // ...except the one we need
      "+values.file.commit.repository.links.html.href"
    ].join(",");
    const optRepoFilter = repoSlug ? ` repo:${repoSlug}` : "";
    const query = `"${catalogFilename}" path:${catalogPath}${optRepoFilter}`;
    const searchResults = this.client.searchCode(workspace, query, { fields }).iterateResults();
    const result = [];
    for await (const searchResult of searchResults) {
      if (searchResult.path_matches.length === 0) {
        continue;
      }
      const repository = searchResult.file.commit.repository;
      if (this.matchesFilters(repository)) {
        result.push({
          fileUrl: BitbucketCloudEntityProvider$1.toUrl(
            repository,
            searchResult.file.path
          ),
          repoUrl: repository.links.html.href
        });
      }
    }
    return result;
  }
  matchesFilters(repository) {
    const filters = this.config.filters;
    return !filters || (!filters.projectKey || filters.projectKey.test(repository.project.key)) && (!filters.repoSlug || filters.repoSlug.test(repository.slug));
  }
  toDeferredEntities(targets) {
    return targets.map((target) => {
      const location = BitbucketCloudEntityProvider$1.toLocationSpec(
        target.fileUrl
      );
      const entity = pluginCatalogNode.locationSpecToLocationEntity({ location });
      entity.metadata.annotations = {
        ...entity.metadata.annotations,
        [ANNOTATION_BITBUCKET_CLOUD_REPO_URL]: target.repoUrl
      };
      return entity;
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  static toUrl(repository, filePath) {
    var _a, _b;
    const repoUrl = repository.links.html.href;
    const branch = (_b = (_a = repository.mainbranch) == null ? void 0 : _a.name) != null ? _b : DEFAULT_BRANCH;
    return `${repoUrl}/src/${branch}/${filePath}`;
  }
  static toLocationSpec(target) {
    return {
      type: "url",
      target,
      presence: "required"
    };
  }
}

BitbucketCloudEntityProviderCTjViEQW_cjs.BitbucketCloudEntityProvider = BitbucketCloudEntityProvider$1;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0__default$1["default"];
var alpha = require$$1__default["default"];
var pluginEventsNode = require$$2__default$1["default"];
var BitbucketCloudEntityProvider = BitbucketCloudEntityProviderCTjViEQW_cjs;






const catalogModuleBitbucketCloudEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "bitbucket-cloud-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        catalogApi: alpha.catalogServiceRef,
        config: backendPluginApi.coreServices.rootConfig,
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        tokenManager: backendPluginApi.coreServices.tokenManager
      },
      async init({
        catalog,
        catalogApi,
        config,
        events,
        logger,
        scheduler,
        tokenManager
      }) {
        const providers = BitbucketCloudEntityProvider.BitbucketCloudEntityProvider.fromConfig(config, {
          catalogApi,
          events,
          logger,
          scheduler,
          tokenManager
        });
        catalog.addEntityProvider(providers);
      }
    });
  }
});

var _default = alpha_cjs.default = catalogModuleBitbucketCloudEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
