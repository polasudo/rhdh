'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/catalog-model');
var require$$1 = require('@backstage/errors');
var require$$2 = require('inclusion');
var require$$3 = require('lodash');
var require$$4 = require('uuid');
var require$$0 = require('@backstage/backend-plugin-api');
var require$$2$1 = require('@backstage/plugin-catalog-node/alpha');

var index_cjs = {};

var KeycloakOrgEntityProvider_cjs = {};

var constants_cjs = {};

const KEYCLOAK_ID_ANNOTATION = "keycloak.org/id";
const KEYCLOAK_REALM_ANNOTATION = "keycloak.org/realm";
const KEYCLOAK_ENTITY_QUERY_SIZE = 100;

constants_cjs.KEYCLOAK_ENTITY_QUERY_SIZE = KEYCLOAK_ENTITY_QUERY_SIZE;
constants_cjs.KEYCLOAK_ID_ANNOTATION = KEYCLOAK_ID_ANNOTATION;
constants_cjs.KEYCLOAK_REALM_ANNOTATION = KEYCLOAK_REALM_ANNOTATION;

var config_cjs = {};

var backendPluginApi$2 = require$$0;
var errors$2 = require$$1;

const readProviderConfig = (id, providerConfigInstance) => {
  const baseUrl = providerConfigInstance.getString("baseUrl");
  const realm = providerConfigInstance.getOptionalString("realm") ?? "master";
  const loginRealm = providerConfigInstance.getOptionalString("loginRealm") ?? "master";
  const username = providerConfigInstance.getOptionalString("username");
  const password = providerConfigInstance.getOptionalString("password");
  const clientId = providerConfigInstance.getOptionalString("clientId");
  const clientSecret = providerConfigInstance.getOptionalString("clientSecret");
  const userQuerySize = providerConfigInstance.getOptionalNumber("userQuerySize");
  const groupQuerySize = providerConfigInstance.getOptionalNumber("groupQuerySize");
  if (clientId && !clientSecret) {
    throw new errors$2.InputError(
      `clientSecret must be provided when clientId is defined.`
    );
  }
  if (clientSecret && !clientId) {
    throw new errors$2.InputError(
      `clientId must be provided when clientSecret is defined.`
    );
  }
  if (username && !password) {
    throw new errors$2.InputError(`password must be provided when username is defined.`);
  }
  if (password && !username) {
    throw new errors$2.InputError(`username must be provided when password is defined.`);
  }
  const schedule = providerConfigInstance.has("schedule") ? backendPluginApi$2.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    providerConfigInstance.getConfig("schedule")
  ) : void 0;
  return {
    id,
    baseUrl,
    loginRealm,
    realm,
    username,
    password,
    clientId,
    clientSecret,
    schedule,
    userQuerySize,
    groupQuerySize
  };
};
const readProviderConfigs = (config) => {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.keycloakOrg"
  );
  if (!providersConfig) {
    return [];
  }
  return providersConfig.keys().map((id) => {
    const providerConfigInstance = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfigInstance);
  });
};

config_cjs.readProviderConfigs = readProviderConfigs;

var read_cjs = {};

var transformers_cjs = {};

const noopGroupTransformer = async (entity, _user, _realm) => entity;
const noopUserTransformer = async (entity, _user, _realm, _groups) => entity;
const sanitizeEmailTransformer = async (entity, _user, _realm, _groups) => {
  entity.metadata.name = entity.metadata.name.replace(/[^a-zA-Z0-9]/g, "-");
  return entity;
};

transformers_cjs.noopGroupTransformer = noopGroupTransformer;
transformers_cjs.noopUserTransformer = noopUserTransformer;
transformers_cjs.sanitizeEmailTransformer = sanitizeEmailTransformer;

var constants$1 = constants_cjs;
var transformers$1 = transformers_cjs;

const parseGroup = async (keycloakGroup, realm, groupTransformer) => {
  const transformer = groupTransformer ?? transformers$1.noopGroupTransformer;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "Group",
    metadata: {
      name: keycloakGroup.name,
      annotations: {
        [constants$1.KEYCLOAK_ID_ANNOTATION]: keycloakGroup.id,
        [constants$1.KEYCLOAK_REALM_ANNOTATION]: realm
      }
    },
    spec: {
      type: "group",
      profile: {
        displayName: keycloakGroup.name
      },
      // children, parent and members are updated again after all group and user transformers applied.
      children: keycloakGroup.subGroups?.map((g) => g.name) ?? [],
      parent: keycloakGroup.parent,
      members: keycloakGroup.members
    }
  };
  return await transformer(entity, keycloakGroup, realm);
};
const parseUser = async (user, realm, keycloakGroups, userTransformer) => {
  const transformer = userTransformer ?? transformers$1.noopUserTransformer;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "User",
    metadata: {
      name: user.username,
      annotations: {
        [constants$1.KEYCLOAK_ID_ANNOTATION]: user.id,
        [constants$1.KEYCLOAK_REALM_ANNOTATION]: realm
      }
    },
    spec: {
      profile: {
        email: user.email,
        ...user.firstName || user.lastName ? {
          displayName: [user.firstName, user.lastName].filter(Boolean).join(" ")
        } : {}
      },
      memberOf: keycloakGroups.filter((g) => g.members?.includes(user.username)).map((g) => g.entity.metadata.name)
    }
  };
  return await transformer(entity, user, realm, keycloakGroups);
};
async function getEntities(entities, config, logger, entityQuerySize = constants$1.KEYCLOAK_ENTITY_QUERY_SIZE) {
  const rawEntityCount = await entities.count({ realm: config.realm });
  const entityCount = typeof rawEntityCount === "number" ? rawEntityCount : rawEntityCount.count;
  const pageCount = Math.ceil(entityCount / entityQuerySize);
  const entityPromises = Array.from(
    { length: pageCount },
    (_, i) => entities.find({
      realm: config.realm,
      max: entityQuerySize,
      first: i * entityQuerySize
    }).catch(
      (err) => logger.warn("Failed to retieve Keycloak entities.", err)
    )
  );
  const entityResults = (await Promise.all(entityPromises)).flat();
  return entityResults;
}
async function getAllGroupMembers(groups, groupId, config, options) {
  const querySize = options?.userQuerySize || 100;
  let allMembers = [];
  let page = 0;
  let totalMembers = 0;
  do {
    const members = await groups.listMembers({
      id: groupId,
      max: querySize,
      realm: config.realm,
      first: page * querySize
    });
    if (members.length > 0) {
      allMembers = allMembers.concat(members.map((m) => m.username));
      totalMembers = members.length;
    } else {
      totalMembers = 0;
    }
    page++;
  } while (totalMembers > 0);
  return allMembers;
}
async function processGroupsRecursively(topLevelGroups, entities, realm) {
  const allGroups = [];
  for (const group of topLevelGroups) {
    allGroups.push(group);
    if (group.subGroupCount > 0) {
      const subgroups = await entities.listSubGroups({
        parentId: group.id,
        first: 0,
        max: group.subGroupCount,
        briefRepresentation: true,
        realm
      });
      const subGroupResults = await processGroupsRecursively(
        subgroups,
        entities,
        realm
      );
      allGroups.push(...subGroupResults);
    }
  }
  return allGroups;
}
function* traverseGroups(group) {
  yield group;
  for (const g of group.subGroups ?? []) {
    g.parent = group.name;
    yield* traverseGroups(g);
  }
}
const readKeycloakRealm = async (client, config, logger, options) => {
  const kUsers = await getEntities(
    client.users,
    config,
    logger,
    options?.userQuerySize
  );
  const topLevelKGroups = await getEntities(
    client.groups,
    config,
    logger,
    options?.groupQuerySize
  );
  let serverVersion;
  try {
    const serverInfo = await client.serverInfo.find();
    serverVersion = parseInt(
      serverInfo.systemInfo?.version?.slice(0, 2) || "",
      10
    );
  } catch (error) {
    throw new Error(`Failed to retrieve Keycloak server information: ${error}`);
  }
  const isVersion23orHigher = serverVersion >= 23;
  let rawKGroups = [];
  if (isVersion23orHigher) {
    rawKGroups = await processGroupsRecursively(
      topLevelKGroups,
      client.groups,
      config.realm
    );
  } else {
    rawKGroups = topLevelKGroups.reduce(
      (acc, g) => acc.concat(...traverseGroups(g)),
      []
    );
  }
  const kGroups = await Promise.all(
    rawKGroups.map(async (g) => {
      g.members = await getAllGroupMembers(
        client.groups,
        g.id,
        config,
        options
      );
      if (isVersion23orHigher) {
        if (g.subGroupCount > 0) {
          g.subGroups = await client.groups.listSubGroups({
            parentId: g.id,
            first: 0,
            max: g.subGroupCount,
            briefRepresentation: false,
            realm: config.realm
          });
        }
        if (g.parentId) {
          const groupParent = await client.groups.findOne({
            id: g.parentId,
            realm: config.realm
          });
          g.parent = groupParent?.name;
        }
      }
      return g;
    })
  );
  const parsedGroups = await kGroups.reduce(async (promise, g) => {
    const partial = await promise;
    const entity = await parseGroup(g, config.realm, options?.groupTransformer);
    if (entity) {
      const group = {
        ...g,
        entity
      };
      partial.push(group);
    }
    return partial;
  }, Promise.resolve([]));
  const parsedUsers = await kUsers.reduce(async (promise, u) => {
    const partial = await promise;
    const entity = await parseUser(
      u,
      config.realm,
      parsedGroups,
      options?.userTransformer
    );
    if (entity) {
      const user = { ...u, entity };
      partial.push(user);
    }
    return partial;
  }, Promise.resolve([]));
  const groups = parsedGroups.map((g) => {
    const entity = g.entity;
    entity.spec.members = g.entity.spec.members?.flatMap((m) => {
      const name = parsedUsers.find((p) => p.username === m)?.entity.metadata.name;
      return name ? [name] : [];
    }) ?? [];
    entity.spec.children = g.entity.spec.children?.flatMap((c) => {
      const child = parsedGroups.find((p) => p.name === c)?.entity.metadata.name;
      return child ? [child] : [];
    }) ?? [];
    entity.spec.parent = parsedGroups.find(
      (p) => p.name === entity.spec.parent
    )?.entity.metadata.name;
    return entity;
  });
  return { users: parsedUsers.map((u) => u.entity), groups };
};

read_cjs.getEntities = getEntities;
read_cjs.parseGroup = parseGroup;
read_cjs.parseUser = parseUser;
read_cjs.processGroupsRecursively = processGroupsRecursively;
read_cjs.readKeycloakRealm = readKeycloakRealm;
read_cjs.traverseGroups = traverseGroups;

var catalogModel = require$$0$1;
var errors$1 = require$$1;
var inclusion = require$$2;
var lodash = require$$3;
var uuid = require$$4;
var constants = constants_cjs;
var config = config_cjs;
var read = read_cjs;

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

var inclusion__default = /*#__PURE__*/_interopDefaultCompat(inclusion);
var uuid__namespace = /*#__PURE__*/_interopNamespaceCompat(uuid);

const withLocations = (baseUrl, realm, entity) => {
  const kind = entity.kind === "Group" ? "groups" : "users";
  const location = `url:${baseUrl}/admin/realms/${realm}/${kind}/${entity.metadata.annotations?.[constants.KEYCLOAK_ID_ANNOTATION]}`;
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
};
class KeycloakOrgEntityProvider$2 {
  constructor(options) {
    this.options = options;
    this.schedule(options.taskRunner);
  }
  connection;
  scheduleFn;
  static fromConfig(deps, options) {
    const { config: config$1, logger } = deps;
    return config.readProviderConfigs(config$1).map((providerConfig) => {
      let taskRunner;
      if ("scheduler" in options && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if ("schedule" in options) {
        taskRunner = options.schedule;
      } else {
        throw new errors$1.InputError(
          `No schedule provided via config for KeycloakOrgEntityProvider:${providerConfig.id}.`
        );
      }
      const provider = new KeycloakOrgEntityProvider$2({
        id: providerConfig.id,
        provider: providerConfig,
        logger,
        taskRunner,
        userTransformer: options.userTransformer,
        groupTransformer: options.groupTransformer
      });
      return provider;
    });
  }
  getProviderName() {
    return `KeycloakOrgEntityProvider:${this.options.id}`;
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
      throw new errors$1.NotFoundError("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const provider = this.options.provider;
    const { markReadComplete } = trackProgress(logger);
    const KeyCloakAdminClientModule = await inclusion__default.default(
      "@keycloak/keycloak-admin-client"
    );
    const KeyCloakAdminClient = KeyCloakAdminClientModule.default;
    const kcAdminClient = new KeyCloakAdminClient({
      baseUrl: provider.baseUrl,
      realmName: provider.loginRealm
    });
    let credentials;
    if (provider.username && provider.password) {
      credentials = {
        grantType: "password",
        clientId: provider.clientId ?? "admin-cli",
        username: provider.username,
        password: provider.password
      };
    } else if (provider.clientId && provider.clientSecret) {
      credentials = {
        grantType: "client_credentials",
        clientId: provider.clientId,
        clientSecret: provider.clientSecret
      };
    } else {
      throw new errors$1.InputError(
        `username and password or clientId and clientSecret must be provided.`
      );
    }
    await kcAdminClient.auth(credentials);
    const { users, groups } = await read.readKeycloakRealm(
      kcAdminClient,
      provider,
      logger,
      {
        userQuerySize: provider.userQuerySize,
        groupQuerySize: provider.groupQuerySize,
        userTransformer: this.options.userTransformer,
        groupTransformer: this.options.groupTransformer
      }
    );
    const { markCommitComplete } = markReadComplete({ users, groups });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `keycloak-org-provider:${this.options.id}`,
        entity: withLocations(provider.baseUrl, provider.realm, entity)
      }))
    });
    markCommitComplete();
  }
  schedule(taskRunner) {
    this.scheduleFn = async () => {
      const id = `${this.getProviderName()}:refresh`;
      await taskRunner.run({
        id,
        fn: async () => {
          const logger = this.options.logger.child({
            class: KeycloakOrgEntityProvider$2.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.read({ logger });
          } catch (error) {
            if (errors$1.isError(error)) {
              logger.error("Error while syncing Keycloak users and groups", {
                // Default Error properties:
                name: error.name,
                cause: error.cause,
                message: error.message,
                stack: error.stack,
                // Additional status code if available:
                status: error.response?.status
              });
            }
          }
        }
      });
    };
  }
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading Keycloak users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} Keycloak users and ${read.groups.length} Keycloak groups`;
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

KeycloakOrgEntityProvider_cjs.KeycloakOrgEntityProvider = KeycloakOrgEntityProvider$2;
KeycloakOrgEntityProvider_cjs.withLocations = withLocations;

var extensions_cjs = {};

var backendPluginApi$1 = require$$0;

const keycloakTransformerExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "keycloak.transformer"
});

extensions_cjs.keycloakTransformerExtensionPoint = keycloakTransformerExtensionPoint;

var catalogModuleKeycloakEntityProvider_cjs = {};

var backendPluginApi = require$$0;
var errors = require$$1;
var alpha = require$$2$1;
var extensions$1 = extensions_cjs;
var KeycloakOrgEntityProvider$1 = KeycloakOrgEntityProvider_cjs;

const catalogModuleKeycloakEntityProvider$1 = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "catalog-backend-module-keycloak",
  register(env) {
    let userTransformer;
    let groupTransformer;
    env.registerExtensionPoint(extensions$1.keycloakTransformerExtensionPoint, {
      setUserTransformer(transformer) {
        if (userTransformer) {
          throw new errors.InputError("User transformer may only be set once");
        }
        userTransformer = transformer;
      },
      setGroupTransformer(transformer) {
        if (groupTransformer) {
          throw new errors.InputError("Group transformer may only be set once");
        }
        groupTransformer = transformer;
      }
    });
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          KeycloakOrgEntityProvider$1.KeycloakOrgEntityProvider.fromConfig(
            { config, logger },
            {
              scheduler,
              schedule: scheduler.createScheduledTaskRunner({
                frequency: { minutes: 30 },
                timeout: { minutes: 3 }
              }),
              userTransformer,
              groupTransformer
            }
          )
        );
      }
    });
  }
});

catalogModuleKeycloakEntityProvider_cjs.catalogModuleKeycloakEntityProvider = catalogModuleKeycloakEntityProvider$1;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var KeycloakOrgEntityProvider = KeycloakOrgEntityProvider_cjs;
var transformers = transformers_cjs;
var extensions = extensions_cjs;
var catalogModuleKeycloakEntityProvider = catalogModuleKeycloakEntityProvider_cjs;



index_cjs.KeycloakOrgEntityProvider = KeycloakOrgEntityProvider.KeycloakOrgEntityProvider;
index_cjs.noopGroupTransformer = transformers.noopGroupTransformer;
index_cjs.noopUserTransformer = transformers.noopUserTransformer;
index_cjs.sanitizeEmailTransformer = transformers.sanitizeEmailTransformer;
index_cjs.keycloakTransformerExtensionPoint = extensions.keycloakTransformerExtensionPoint;
var _default = index_cjs.default = catalogModuleKeycloakEntityProvider.catalogModuleKeycloakEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
