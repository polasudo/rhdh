'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0 = require('@backstage/errors');
var require$$1 = require('@backstage/integration');
var require$$2 = require('uuid');
var require$$3 = require('node-fetch');
var require$$4 = require('@backstage/backend-tasks');
var require$$5 = require('@backstage/plugin-catalog-node');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var require$$0__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$0$1);
var require$$1__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$1$1);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);
var require$$3__default = /*#__PURE__*/_interopDefaultLegacy(require$$3);
var require$$4__default = /*#__PURE__*/_interopDefaultLegacy(require$$4);
var require$$5__default = /*#__PURE__*/_interopDefaultLegacy(require$$5);

var alpha_cjs = {};

var BitbucketServerEntityProviderF_8B4ZVW_cjs = {};

var errors = require$$0__default["default"];
var integration = require$$1__default["default"];
var uuid = require$$2__default["default"];
var fetch = require$$3__default["default"];
var backendTasks = require$$4__default["default"];
var pluginCatalogNode = require$$5__default["default"];

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

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class BitbucketServerClient {
  constructor(options) {
    __publicField$1(this, "config");
    this.config = options.config;
  }
  static fromConfig(options) {
    return new BitbucketServerClient(options);
  }
  async listProjects(options) {
    return this.pagedRequest(
      `${this.config.apiBaseUrl}/projects`,
      options.listOptions
    );
  }
  async listRepositories(options) {
    return this.pagedRequest(
      `${this.config.apiBaseUrl}/projects/${encodeURIComponent(
        options.projectKey
      )}/repos`,
      options.listOptions
    );
  }
  async getFile(options) {
    const base = new URL(this.config.apiBaseUrl);
    return fetch__default.default(
      `${base.protocol}//${base.host}/projects/${options.projectKey}/repos/${options.repo}/raw/${options.path}`,
      integration.getBitbucketServerRequestOptions(this.config)
    );
  }
  async getRepository(options) {
    const request = `${this.config.apiBaseUrl}/projects/${options.projectKey}/repos/${options.repo}`;
    const response = await fetch__default.default(
      request,
      integration.getBitbucketServerRequestOptions(this.config)
    );
    return response.json();
  }
  resolvePath(options) {
    const base = new URL(this.config.apiBaseUrl || "");
    return {
      path: `${base.protocol}//${base.host}/projects/${options.projectKey}/repos/${options.repo}${options.path}`
    };
  }
  async pagedRequest(endpoint, options) {
    const request = new URL(endpoint);
    for (const key in options) {
      if (options[key]) {
        request.searchParams.append(key, options[key].toString());
      }
    }
    return this.getTypeMapped(request);
  }
  async getTypeMapped(url) {
    return this.get(url).then((response) => {
      return response.json();
    });
  }
  async get(url) {
    return this.request(new fetch.Request(url.toString(), { method: "GET" }));
  }
  async request(req) {
    return fetch__default.default(req, integration.getBitbucketServerRequestOptions(this.config)).then(
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
}
async function* paginated(request, options) {
  const opts = options || { start: 0 };
  let res;
  do {
    res = await request(opts);
    opts.start = res.nextPageStart;
    for (const item of res.values) {
      yield item;
    }
  } while (!res.isLastPage);
}

const DEFAULT_CATALOG_PATH = "/catalog-info.yaml";
const DEFAULT_PROVIDER_ID = "default";
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.bitbucketServer"
  );
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("host")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  var _a;
  const host = config.getString("host");
  const catalogPath = (_a = config.getOptionalString("catalogPath")) != null ? _a : DEFAULT_CATALOG_PATH;
  const projectKeyPattern = config.getOptionalString("filters.projectKey");
  const repoSlugPattern = config.getOptionalString("filters.repoSlug");
  const schedule = config.has("schedule") ? backendTasks.readTaskScheduleDefinitionFromConfig(config.getConfig("schedule")) : void 0;
  return {
    id,
    host,
    catalogPath,
    filters: {
      projectKey: projectKeyPattern ? new RegExp(projectKeyPattern) : void 0,
      repoSlug: repoSlugPattern ? new RegExp(repoSlugPattern) : void 0
    },
    schedule
  };
}

const defaultBitbucketServerLocationParser = async function* defaultBitbucketServerLocationParser2(options) {
  yield pluginCatalogNode.locationSpecToLocationEntity({ location: options.location });
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class BitbucketServerEntityProvider$1 {
  constructor(config, integration, logger, taskRunner, parser) {
    __publicField(this, "integration");
    __publicField(this, "config");
    __publicField(this, "parser");
    __publicField(this, "logger");
    __publicField(this, "scheduleFn");
    __publicField(this, "connection");
    this.integration = integration;
    this.config = config;
    this.parser = parser || defaultBitbucketServerLocationParser;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
  }
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    return readProviderConfigs(config).map((providerConfig) => {
      var _a;
      const integration = integrations.bitbucketServer.byHost(
        providerConfig.host
      );
      if (!integration) {
        throw new errors.InputError(
          `No BitbucketServer integration found that matches host ${providerConfig.host}`
        );
      }
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for bitbucketServer-provider:${providerConfig.id}.`
        );
      }
      const taskRunner = (_a = options.schedule) != null ? _a : options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new BitbucketServerEntityProvider$1(
        providerConfig,
        integration,
        options.logger,
        taskRunner,
        options.parser
      );
    });
  }
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: BitbucketServerEntityProvider$1.prototype.constructor.name,
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
    return `bitbucketServer-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  async refresh(logger) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    logger.info("Discovering catalog files in Bitbucket Server repositories");
    const entities = await this.findEntities();
    await this.connection.applyMutation({
      type: "full",
      entities: entities.map((entity) => ({
        locationKey: this.getProviderName(),
        entity
      }))
    });
    logger.info(
      `Committed ${entities.length} entities for Bitbucket Server repositories`
    );
  }
  async findEntities() {
    var _a, _b, _c, _d;
    const client = BitbucketServerClient.fromConfig({
      config: this.integration.config
    });
    const projects = paginated(
      (options) => client.listProjects({ listOptions: options })
    );
    const result = [];
    for await (const project of projects) {
      if (((_b = (_a = this.config) == null ? void 0 : _a.filters) == null ? void 0 : _b.projectKey) && !this.config.filters.projectKey.test(project.key)) {
        continue;
      }
      const repositories = paginated(
        (options) => client.listRepositories({
          projectKey: project.key,
          listOptions: options
        })
      );
      for await (const repository of repositories) {
        if (((_d = (_c = this.config) == null ? void 0 : _c.filters) == null ? void 0 : _d.repoSlug) && !this.config.filters.repoSlug.test(repository.slug)) {
          continue;
        }
        for await (const entity of this.parser({
          client,
          logger: this.logger,
          location: {
            type: "url",
            target: `${repository.links.self[0].href}${this.config.catalogPath}`,
            presence: "optional"
          }
        })) {
          result.push(entity);
        }
      }
    }
    return result;
  }
}

BitbucketServerEntityProviderF_8B4ZVW_cjs.BitbucketServerClient = BitbucketServerClient;
BitbucketServerEntityProviderF_8B4ZVW_cjs.BitbucketServerEntityProvider = BitbucketServerEntityProvider$1;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0__default$1["default"];
var alpha = require$$1__default$1["default"];
var BitbucketServerEntityProvider = BitbucketServerEntityProviderF_8B4ZVW_cjs;







const catalogModuleBitbucketServerEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "bitbucket-server-entity-provider",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        const providers = BitbucketServerEntityProvider.BitbucketServerEntityProvider.fromConfig(config, {
          logger,
          scheduler
        });
        catalog.addEntityProvider(providers);
      }
    });
  }
});

var _default = alpha_cjs.default = catalogModuleBitbucketServerEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
