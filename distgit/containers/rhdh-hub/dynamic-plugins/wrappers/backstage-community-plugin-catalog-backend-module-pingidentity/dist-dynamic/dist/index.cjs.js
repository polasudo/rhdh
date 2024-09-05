'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$2 = require('uuid');
var require$$3 = require('@backstage/catalog-model');
var require$$4 = require('node-fetch');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0;
var alpha = require$$1;
var uuid = require$$2;
var catalogModel = require$$3;
var fetch = require$$4;

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

const readProviderConfig = (id, providerConfigInstance) => {
  const apiPath = providerConfigInstance.getString("apiPath");
  const authPath = providerConfigInstance.getString("authPath");
  const envId = providerConfigInstance.getString("envId");
  const clientId = providerConfigInstance.getOptionalString("clientId");
  const clientSecret = providerConfigInstance.getOptionalString("clientSecret");
  const userQuerySize = providerConfigInstance.getOptionalNumber("userQuerySize");
  const groupQuerySize = providerConfigInstance.getOptionalNumber("groupQuerySize");
  if (clientId && !clientSecret) {
    throw new Error(`clientSecret must be provided when clientId is defined.`);
  }
  if (clientSecret && !clientId) {
    throw new Error(`clientId must be provided when clientSecret is defined.`);
  }
  const schedule = providerConfigInstance.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    providerConfigInstance.getConfig("schedule")
  ) : void 0;
  return {
    id,
    apiPath,
    authPath,
    envId,
    clientId,
    clientSecret,
    schedule,
    userQuerySize,
    groupQuerySize
  };
};
const readProviderConfigs = (config) => {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.pingIdentityOrg"
  );
  if (!providersConfig) {
    return [];
  }
  return providersConfig.keys().map((id) => {
    const providerConfigInstance = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfigInstance);
  });
};

const PING_IDENTITY_ID_ANNOTATION = "pingidentity.org/id";
const PING_IDENTITY_DEFAULT_ENTITY_QUERY_SIZE = 100;

const defaultGroupTransformer = async (entity, _envId) => {
  entity.metadata.name = entity.metadata.name.replace(
    /[^a-zA-Z0-9_\-\.]/g,
    "_"
  );
  return entity;
};
const defaultUserTransformer = async (entity, _envId, _groups) => {
  entity.metadata.name = entity.metadata.name.replace(
    /[^a-zA-Z0-9_\-\.]/g,
    "_"
  );
  return entity;
};

const findGroupMemberships = (userId, groups, groupMembersMap) => {
  const groupMemberships = [];
  groups.forEach((group) => {
    const groupId = group.metadata.annotations ? group.metadata.annotations[PING_IDENTITY_ID_ANNOTATION] : void 0;
    if (groupId && groupMembersMap.has(groupId) && groupMembersMap.get(groupId)?.has(userId)) {
      groupMemberships.push(group.metadata.name);
    }
  });
  return groupMemberships;
};
const getEntityLocation = (config, entityKind, entityId) => {
  return `url:${config.apiPath}/environments/${config.envId}/${entityKind}/${entityId}`;
};
const parsePingIdentityUsers = async (client, groups, groupMembersMap, userQuerySize, userTransformer) => {
  const transformer = userTransformer ?? defaultUserTransformer;
  const pingIdentityUsers = await client.getUsers(
    userQuerySize
  );
  const transformedUsers = await Promise.all(
    pingIdentityUsers.map(async (user) => {
      const userLocation = getEntityLocation(
        client.getConfig(),
        "users",
        user.id
      );
      return await transformer(
        {
          apiVersion: "backstage.io/v1beta1",
          kind: "User",
          metadata: {
            name: user.username,
            annotations: {
              [PING_IDENTITY_ID_ANNOTATION]: user.id,
              [catalogModel.ANNOTATION_LOCATION]: userLocation,
              [catalogModel.ANNOTATION_ORIGIN_LOCATION]: userLocation
            }
          },
          spec: {
            profile: {
              email: user.email,
              ...user.name.given || user.name.family ? {
                displayName: [user.name.given, user.name.family].filter(Boolean).join(" ")
              } : {}
            },
            memberOf: findGroupMemberships(user.id, groups, groupMembersMap)
          }
        },
        user,
        client.getConfig().envId,
        groups
      );
    })
  );
  return transformedUsers.filter((user) => user !== void 0);
};
const parsePingIdentityGroups = async (client, groupMembersMap, parentGroupMap, groupQuerySize, groupTransformer) => {
  const transformer = groupTransformer ?? defaultGroupTransformer;
  const pingIdentityGroups = await client.getGroups(
    groupQuerySize
  );
  const transformedGroups = await Promise.all(
    pingIdentityGroups.map(async (group) => {
      const groupLocation = getEntityLocation(
        client.getConfig(),
        "groups",
        group.id
      );
      groupMembersMap.set(
        group.id,
        new Set(await client.getUsersInGroup(group.id))
      );
      const parentGroupId = await client.getParentGroupId(group.id);
      if (parentGroupId) parentGroupMap.set(group.id, parentGroupId);
      return await transformer(
        {
          apiVersion: "backstage.io/v1beta1",
          kind: "Group",
          metadata: {
            name: group.name,
            annotations: {
              [PING_IDENTITY_ID_ANNOTATION]: group.id,
              [catalogModel.ANNOTATION_LOCATION]: groupLocation,
              [catalogModel.ANNOTATION_ORIGIN_LOCATION]: groupLocation
            },
            description: group.description
          },
          spec: {
            type: "group",
            profile: {
              displayName: group.name
            },
            children: [],
            parent: void 0
            // will be updated later
          }
        },
        group,
        client.getConfig().envId
      );
    })
  );
  return transformedGroups.filter(
    (group) => group !== void 0
  );
};
const readPingIdentity = async (client, options) => {
  const groupMembersMap = /* @__PURE__ */ new Map();
  const parentGroupMap = /* @__PURE__ */ new Map();
  const groups = await parsePingIdentityGroups(
    client,
    groupMembersMap,
    parentGroupMap,
    options?.userQuerySize,
    options?.groupTransformer
  );
  const groupsMap = /* @__PURE__ */ new Map();
  groups.forEach((group) => {
    const groupId = group.metadata.annotations[PING_IDENTITY_ID_ANNOTATION];
    groupsMap.set(groupId, group);
  });
  groups.forEach((group) => {
    const parentGroupId = parentGroupMap.get(
      group.metadata.annotations[PING_IDENTITY_ID_ANNOTATION]
    );
    if (parentGroupId) {
      const parentGroup = groupsMap.get(parentGroupId);
      group.spec.parent = parentGroup?.metadata.name;
    }
  });
  const users = await parsePingIdentityUsers(
    client,
    groups,
    groupMembersMap,
    options?.groupQuerySize,
    options?.userTransformer
  );
  return { users, groups };
};

class PingIdentityClient {
  constructor(config) {
    this.config = config;
  }
  tokenCredential = null;
  /**
   * Gets the Ping Identity provider configs
   *
   * @returns the Ping Identity provider configs
   */
  getConfig() {
    return this.config;
  }
  /**
   * Gets a list of all users fetched from Ping Identity API
   *
   * @param querySize - the number of users to query at a time
   *
   * @returns a list of all users fetched from Ping Identity API
   */
  async getUsers(querySize = PING_IDENTITY_DEFAULT_ENTITY_QUERY_SIZE) {
    const allUsers = [];
    let nextUrl = `users?limit=${querySize}`;
    while (nextUrl) {
      const url = nextUrl.startsWith("http") ? nextUrl : `${this.config.apiPath}/environments/${this.config.envId}/${nextUrl}`;
      const response = await this.requestApi(url, true);
      const data = await response.json();
      allUsers.push(...data._embedded.users);
      nextUrl = data._links?.next?.href || void 0;
    }
    return allUsers;
  }
  /**
   * Gets a list of all groups fetched from Ping Identity API
   *
   * @param querySize - the number of groups to query at a time
   *
   * @returns a list of all groups fetched from Ping Identity API
   */
  async getGroups(querySize = PING_IDENTITY_DEFAULT_ENTITY_QUERY_SIZE) {
    const allGroups = [];
    let nextUrl = `groups?limit=${querySize}`;
    while (nextUrl) {
      const url = nextUrl.startsWith("http") ? nextUrl : `${this.config.apiPath}/environments/${this.config.envId}/${nextUrl}`;
      const response = await this.requestApi(url, true);
      const data = await response.json();
      allGroups.push(...data._embedded.groups);
      nextUrl = data._links?.next?.href || void 0;
    }
    return allGroups;
  }
  /**
   * Gets the parent group ID of a given group, returns undefined if there is no parent group
   *
   * @param groupId the group ID of a given group
   *
   * @returns the parent group ID of a given group, undefined if there is no parent group
   */
  async getParentGroupId(groupId) {
    const response = await this.requestApi(`groups/${groupId}/memberOfGroups`);
    const data = await response.json();
    return data.size > 0 ? data._embedded.groupMemberships[0].id : void 0;
  }
  /**
   * Gets all user IDs of users in a given group
   *
   * @param groupId the group ID of a given group
   *
   * @returns all user IDs of users in a given group
   */
  async getUsersInGroup(groupId) {
    const response = await this.requestApi(
      `users?filter=memberOfGroups[id%20eq%20%22${groupId}%22]`
    );
    const data = await response.json();
    return data.count > 0 ? data._embedded.users.map((users) => users.id) : [];
  }
  /**
   * Makes a Ping Identity API request to the configured environment
   *
   * @param query the query to be made
   * @param isFullUrl Optional - true if the given query is the full request url
   * @returns the response to the given API call
   */
  async requestApi(query, isFullUrl) {
    const url = isFullUrl ? query : `${this.config.apiPath}/environments/${this.config.envId}/${query}`;
    let accessToken = await this.getAccessToken();
    let response = await this.makeRequest(url, accessToken);
    if (response.status === 401) {
      accessToken = await this.fetchAccessToken();
      response = await this.makeRequest(url, accessToken);
    }
    if (!response.ok) {
      throw new Error(`Error fetching: ${response.statusText}`);
    }
    return response;
  }
  async fetchAccessToken() {
    const url = `${this.config.authPath}/${this.config.envId}/as/token`;
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");
    const response = await fetch__default.default(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials"
      })
    });
    if (!response.ok) {
      throw new Error(`Error getting access token: ${response.statusText}`);
    }
    const data = await response.json();
    this.tokenCredential = data.access_token;
    return data.access_token;
  }
  async getAccessToken() {
    if (!this.tokenCredential) {
      return this.fetchAccessToken();
    }
    return this.tokenCredential;
  }
  async makeRequest(url, accessToken) {
    return await fetch__default.default(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }
}

class PingIdentityEntityProvider {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(configRoot, options) {
    return readProviderConfigs(configRoot).map((providerConfig) => {
      let taskRunner;
      if (options.scheduler && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if (options.schedule) {
        taskRunner = options.schedule;
      } else {
        throw new Error(
          `No schedule provided neither via code nor config for PingIdentityEntityProvider:${providerConfig.id}.`
        );
      }
      const provider = new PingIdentityEntityProvider({
        id: providerConfig.id,
        provider: providerConfig,
        logger: options.logger,
        userTransformer: options.userTransformer,
        groupTransformer: options.groupTransformer
      });
      if (taskRunner !== "manual") {
        provider.schedule(taskRunner);
      }
      return provider;
    });
  }
  getProviderName() {
    return `PingIdentityEntityProvider:${this.options.id}`;
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn?.();
  }
  /**
   * Runs one complete ingestion loop. Call this method regularly at some
   * appropriate cadence.
   */
  async read(options) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const provider = this.options.provider;
    const { markReadComplete } = trackProgress(logger);
    const client = new PingIdentityClient(provider);
    const { users, groups } = await readPingIdentity(client, {
      userQuerySize: this.options.provider.userQuerySize,
      groupQuerySize: this.options.provider.groupQuerySize,
      userTransformer: this.options.userTransformer,
      groupTransformer: this.options.groupTransformer
    });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `pingidentity-org-provider:${this.options.id}`,
        entity
      }))
    });
    const { markCommitComplete } = markReadComplete({ users, groups });
    markCommitComplete();
  }
  schedule(taskRunner) {
    this.scheduleFn = async () => {
      const id = `${this.getProviderName()}:refresh`;
      await taskRunner.run({
        id,
        fn: async () => {
          const logger = this.options.logger.child({
            class: PingIdentityEntityProvider.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.read({ logger });
          } catch (error) {
            logger.error("Error while syncing PingIdentity users and groups", {
              // Default Error properties:
              name: error.name,
              message: error.message,
              stack: error.stack,
              // Additional status code if available:
              status: error.response?.status
            });
          }
        }
      });
    };
  }
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading PingIdentity users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} PingIdentity users and ${read.groups.length} PingIdentity groups`;
    const readDuration = ((Date.now() - timestamp) / 1e3).toFixed(1);
    timestamp = Date.now();
    logger.info(`Read ${summary} in ${readDuration} seconds. Committing...`);
    return { markCommitComplete };
  }
  function markCommitComplete() {
    const commitDuration = ((Date.now() - timestamp) / 1e3).toFixed(1);
    logger.info(`Committed ${summary} in ${commitDuration} seconds.`);
  }
  return { markReadComplete };
}

const pingIdentityTransformerExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "pingIdentity.transformer"
});

const catalogModulePingIdentityEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "pingidentity",
  register(reg) {
    let userTransformer;
    let groupTransformer;
    reg.registerExtensionPoint(pingIdentityTransformerExtensionPoint, {
      setUserTransformer(transformer) {
        if (userTransformer) {
          throw new Error("User transformer may only be set once");
        }
        userTransformer = transformer;
      },
      setGroupTransformer(transformer) {
        if (groupTransformer) {
          throw new Error("Group transformer may only be set once");
        }
        groupTransformer = transformer;
      }
    });
    reg.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          PingIdentityEntityProvider.fromConfig(config, {
            logger,
            scheduler,
            userTransformer,
            groupTransformer
          })
        );
      }
    });
  }
});

var _default = index_cjs.default = catalogModulePingIdentityEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
