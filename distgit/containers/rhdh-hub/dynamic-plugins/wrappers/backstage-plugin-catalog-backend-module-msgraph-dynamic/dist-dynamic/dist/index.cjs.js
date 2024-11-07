'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$3 = require('@backstage/plugin-catalog-node/alpha');
var require$$0$2 = require('@backstage/catalog-model');
var require$$1$1 = require('lodash');
var require$$2$1 = require('uuid');
var require$$0 = require('@azure/identity');
var require$$1 = require('node-fetch');
var require$$2 = require('qs');
var require$$1$2 = require('p-limit');
require('@backstage/plugin-catalog-node');

var alpha_cjs = {};

var catalogModuleMicrosoftGraphOrgEntityProvider_cjs = {};

var MicrosoftGraphOrgEntityProvider_cjs = {};

var client_cjs = {};

var identity = require$$0;
var fetch = require$$1;
var qs = require$$2;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat$1(fetch);
var qs__default = /*#__PURE__*/_interopDefaultCompat$1(qs);

class MicrosoftGraphClient {
  /**
   * @param baseUrl - baseUrl of Graph API {@link MicrosoftGraphProviderConfig.target}
   * @param tokenCredential - instance of `TokenCredential` that is used to acquire token for Graph API calls
   *
   */
  constructor(baseUrl, tokenCredential) {
    this.baseUrl = baseUrl;
    this.tokenCredential = tokenCredential;
  }
  /**
   * Factory method that instantiate `msal` client and return
   * an instance of `MicrosoftGraphClient`
   *
   * @public
   *
   * @param config - Configuration for Interacting with Graph API
   */
  static create(config) {
    const options = {
      authorityHost: config.authority,
      tenantId: config.tenantId
    };
    const credential = config.clientId && config.clientSecret ? new identity.ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret,
      options
    ) : new identity.DefaultAzureCredential(options);
    return new MicrosoftGraphClient(config.target, credential);
  }
  /**
   * Get a collection of resource from Graph API and
   * return an `AsyncIterable` of that resource
   *
   * @public
   * @param path - Resource in Microsoft Graph
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *requestCollection(path, query, queryMode) {
    const appliedQueryMode = query?.search ? "advanced" : queryMode ?? "basic";
    if (appliedQueryMode === "advanced" && (query?.filter || query?.select)) {
      query.count = true;
    }
    const headers = appliedQueryMode === "advanced" ? {
      // Eventual consistency is required for advanced querying capabilities
      // like "$search" or parts of "$filter".
      // If a new user/group is not found, it'll eventually be imported on a subsequent read
      ConsistencyLevel: "eventual"
    } : {};
    let response = await this.requestApi(path, query, headers);
    for (; ; ) {
      if (response.status !== 200) {
        await this.handleError(path, response);
      }
      const result = await response.json();
      const elements = result.value;
      yield* elements;
      if (!result["@odata.nextLink"]) {
        return;
      }
      response = await this.requestRaw(result["@odata.nextLink"], headers);
    }
  }
  /**
   * Abstract on top of {@link MicrosoftGraphClient.requestRaw}
   *
   * @public
   * @param path - Resource in Microsoft Graph
   * @param query - OData Query {@link ODataQuery}
   * @param headers - optional HTTP headers
   */
  async requestApi(path, query, headers) {
    const queryString = qs__default.default.stringify(
      {
        $search: query?.search,
        $filter: query?.filter,
        $select: query?.select?.join(","),
        $expand: query?.expand,
        $count: query?.count,
        $top: query?.top
      },
      {
        addQueryPrefix: true,
        // Microsoft Graph doesn't like an encoded query string
        encode: false
      }
    );
    return await this.requestRaw(
      `${this.baseUrl}/${path}${queryString}`,
      headers
    );
  }
  /**
   * Makes a HTTP call to Graph API with token
   *
   * @param url - HTTP Endpoint of Graph API
   * @param headers - optional HTTP headers
   */
  async requestRaw(url, headers, retryCount = 2) {
    const urlObj = new URL(url);
    const token = await this.tokenCredential.getToken(
      `${urlObj.protocol}//${urlObj.hostname}/.default`
    );
    if (!token) {
      throw new Error("Failed to obtain token from Azure Identity");
    }
    try {
      return await fetch__default.default(url, {
        headers: {
          ...headers,
          Authorization: `Bearer ${token.token}`
        }
      });
    } catch (e) {
      if (e?.code === "ETIMEDOUT" && retryCount > 0) {
        return this.requestRaw(url, headers, retryCount - 1);
      }
      throw e;
    }
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/profilephoto | profilePhoto}
   * of `User` from Graph API with size limit
   *
   * @param userId - The unique identifier for the `User` resource
   * @param maxSize - Maximum pixel height of the photo
   *
   */
  async getUserPhotoWithSizeLimit(userId, maxSize) {
    return await this.getPhotoWithSizeLimit("users", userId, maxSize);
  }
  async getUserPhoto(userId, sizeId) {
    return await this.getPhoto("users", userId, sizeId);
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/user | User}
   * from Graph API and return as `AsyncIterable`
   *
   * @public
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *getUsers(query, queryMode) {
    yield* this.requestCollection(
      `users`,
      query,
      queryMode
    );
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/profilephoto | profilePhoto}
   * of `Group` from Graph API with size limit
   *
   * @param groupId - The unique identifier for the `Group` resource
   * @param maxSize - Maximum pixel height of the photo
   *
   */
  async getGroupPhotoWithSizeLimit(groupId, maxSize) {
    return await this.getPhotoWithSizeLimit("groups", groupId, maxSize);
  }
  async getGroupPhoto(groupId, sizeId) {
    return await this.getPhoto("groups", groupId, sizeId);
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/group | Group}
   * from Graph API and return as `AsyncIterable`
   *
   * @public
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *getGroups(query, queryMode) {
    yield* this.requestCollection(
      `groups`,
      query,
      queryMode
    );
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/user | User}
   * belonging to a `Group` from Graph API and return as `AsyncIterable`
   * @public
   * @param groupId - The unique identifier for the `Group` resource
   *
   */
  async *getGroupMembers(groupId, query, queryMode) {
    yield* this.requestCollection(
      `groups/${groupId}/members`,
      query,
      queryMode
    );
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/user | User}
   * belonging to a `Group` from Graph API and return as `AsyncIterable`
   * @public
   * @param groupId - The unique identifier for the `Group` resource
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *getGroupUserMembers(groupId, query, queryMode) {
    yield* this.requestCollection(
      `groups/${groupId}/members/microsoft.graph.user/`,
      query,
      queryMode
    );
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/organization | Organization}
   * from Graph API
   * @public
   * @param tenantId - The unique identifier for the `Organization` resource
   *
   */
  async getOrganization(tenantId) {
    const response = await this.requestApi(`organization/${tenantId}`);
    if (response.status !== 200) {
      await this.handleError(`organization/${tenantId}`, response);
    }
    return await response.json();
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/profilephoto | profilePhoto}
   * from Graph API
   *
   * @param entityName - type of parent resource, either `User` or `Group`
   * @param id - The unique identifier for the `entityName` resource
   * @param maxSize - Maximum pixel height of the photo
   *
   */
  async getPhotoWithSizeLimit(entityName, id, maxSize) {
    const response = await this.requestApi(`${entityName}/${id}/photos`);
    if (response.status === 404) {
      return void 0;
    } else if (response.status !== 200) {
      await this.handleError(`${entityName} photos`, response);
    }
    const result = await response.json();
    const photos = result.value;
    let selectedPhoto = void 0;
    for (const p of photos) {
      if (!selectedPhoto || p.height >= selectedPhoto.height && p.height <= maxSize) {
        selectedPhoto = p;
      }
    }
    if (!selectedPhoto) {
      return void 0;
    }
    return await this.getPhoto(entityName, id, selectedPhoto.id);
  }
  async getPhoto(entityName, id, sizeId) {
    const path = sizeId ? `${entityName}/${id}/photos/${sizeId}/$value` : `${entityName}/${id}/photo/$value`;
    const response = await this.requestApi(path);
    if (response.status === 404) {
      return void 0;
    } else if (response.status !== 200) {
      await this.handleError("photo", response);
    }
    return `data:image/jpeg;base64,${Buffer.from(
      await response.arrayBuffer()
    ).toString("base64")}`;
  }
  async handleError(path, response) {
    const result = await response.json();
    const error = result.error;
    throw new Error(
      `Error while reading ${path} from Microsoft Graph: ${error.code} - ${error.message}`
    );
  }
}

client_cjs.MicrosoftGraphClient = MicrosoftGraphClient;

var config_cjs = {};

var backendPluginApi$1 = require$$0$1;
var lodash$1 = require$$1$1;

const DEFAULT_PROVIDER_ID = "default";
const DEFAULT_TARGET = "https://graph.microsoft.com/v1.0";
function readMicrosoftGraphConfig(config) {
  const providers = [];
  const providerConfigs = config.getOptionalConfigArray("providers") ?? [];
  for (const providerConfig of providerConfigs) {
    const target = lodash$1.trimEnd(
      providerConfig.getOptionalString("target") ?? DEFAULT_TARGET,
      "/"
    );
    const authority = providerConfig.getOptionalString("authority");
    const tenantId = providerConfig.getString("tenantId");
    const clientId = providerConfig.getOptionalString("clientId");
    const clientSecret = providerConfig.getOptionalString("clientSecret");
    const userExpand = providerConfig.getOptionalString("userExpand");
    const userFilter = providerConfig.getOptionalString("userFilter");
    const userSelect = providerConfig.getOptionalStringArray("userSelect");
    const userGroupMemberFilter = providerConfig.getOptionalString(
      "userGroupMemberFilter"
    );
    const userGroupMemberSearch = providerConfig.getOptionalString(
      "userGroupMemberSearch"
    );
    const groupExpand = providerConfig.getOptionalString("groupExpand");
    const groupFilter = providerConfig.getOptionalString("groupFilter");
    const groupSearch = providerConfig.getOptionalString("groupSearch");
    if (userFilter && userGroupMemberFilter) {
      throw new Error(
        `userFilter and userGroupMemberFilter are mutually exclusive, only one can be specified.`
      );
    }
    if (userFilter && userGroupMemberSearch) {
      throw new Error(
        `userGroupMemberSearch cannot be specified when userFilter is defined.`
      );
    }
    const groupSelect = providerConfig.getOptionalStringArray("groupSelect");
    const queryMode = providerConfig.getOptionalString("queryMode");
    if (queryMode !== void 0 && queryMode !== "basic" && queryMode !== "advanced") {
      throw new Error(`queryMode must be one of: basic, advanced`);
    }
    if (clientId && !clientSecret) {
      throw new Error(
        `clientSecret must be provided when clientId is defined.`
      );
    }
    if (clientSecret && !clientId) {
      throw new Error(
        `clientId must be provided when clientSecret is defined.`
      );
    }
    providers.push({
      id: target,
      target,
      authority,
      tenantId,
      clientId,
      clientSecret,
      userExpand,
      userFilter,
      userSelect,
      userGroupMemberFilter,
      userGroupMemberSearch,
      groupExpand,
      groupFilter,
      groupSearch,
      groupSelect,
      queryMode
    });
  }
  return providers;
}
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig(
    "catalog.providers.microsoftGraphOrg"
  );
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("clientId")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  const target = lodash$1.trimEnd(
    config.getOptionalString("target") ?? DEFAULT_TARGET,
    "/"
  );
  const authority = config.getOptionalString("authority");
  const tenantId = config.getString("tenantId");
  const clientId = config.getOptionalString("clientId");
  const clientSecret = config.getOptionalString("clientSecret");
  const userExpand = config.getOptionalString("user.expand");
  const userFilter = config.getOptionalString("user.filter");
  const userSelect = config.getOptionalStringArray("user.select");
  const loadUserPhotos = config.getOptionalBoolean("user.loadPhotos");
  const groupExpand = config.getOptionalString("group.expand");
  const groupFilter = config.getOptionalString("group.filter");
  const groupSearch = config.getOptionalString("group.search");
  const groupSelect = config.getOptionalStringArray("group.select");
  const groupIncludeSubGroups = config.getOptionalBoolean(
    "group.includeSubGroups"
  );
  const queryMode = config.getOptionalString("queryMode");
  if (queryMode !== void 0 && queryMode !== "basic" && queryMode !== "advanced") {
    throw new Error(`queryMode must be one of: basic, advanced`);
  }
  const userGroupMemberFilter = config.getOptionalString(
    "userGroupMember.filter"
  );
  const userGroupMemberSearch = config.getOptionalString(
    "userGroupMember.search"
  );
  if (userFilter && userGroupMemberFilter) {
    throw new Error(
      `userFilter and userGroupMemberFilter are mutually exclusive, only one can be specified.`
    );
  }
  if (userFilter && userGroupMemberSearch) {
    throw new Error(
      `userGroupMemberSearch cannot be specified when userFilter is defined.`
    );
  }
  if (clientId && !clientSecret) {
    throw new Error(`clientSecret must be provided when clientId is defined.`);
  }
  if (clientSecret && !clientId) {
    throw new Error(`clientId must be provided when clientSecret is defined.`);
  }
  const schedule = config.has("schedule") ? backendPluginApi$1.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
  return {
    id,
    target,
    authority,
    clientId,
    clientSecret,
    tenantId,
    userExpand,
    userFilter,
    userSelect,
    loadUserPhotos,
    groupExpand,
    groupFilter,
    groupSearch,
    groupSelect,
    groupIncludeSubGroups,
    queryMode,
    userGroupMemberFilter,
    userGroupMemberSearch,
    schedule
  };
}

config_cjs.readMicrosoftGraphConfig = readMicrosoftGraphConfig;
config_cjs.readProviderConfig = readProviderConfig;
config_cjs.readProviderConfigs = readProviderConfigs;

var constants_cjs = {};

const MICROSOFT_EMAIL_ANNOTATION = "microsoft.com/email";
const MICROSOFT_GRAPH_TENANT_ID_ANNOTATION = "graph.microsoft.com/tenant-id";
const MICROSOFT_GRAPH_GROUP_ID_ANNOTATION = "graph.microsoft.com/group-id";
const MICROSOFT_GRAPH_USER_ID_ANNOTATION = "graph.microsoft.com/user-id";

constants_cjs.MICROSOFT_EMAIL_ANNOTATION = MICROSOFT_EMAIL_ANNOTATION;
constants_cjs.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION = MICROSOFT_GRAPH_GROUP_ID_ANNOTATION;
constants_cjs.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION = MICROSOFT_GRAPH_TENANT_ID_ANNOTATION;
constants_cjs.MICROSOFT_GRAPH_USER_ID_ANNOTATION = MICROSOFT_GRAPH_USER_ID_ANNOTATION;

var read_cjs = {};

var org_cjs = {};

function buildOrgHierarchy(groups) {
  const groupsByName = new Map(groups.map((g) => [g.metadata.name, g]));
  for (const group of groups) {
    const selfName = group.metadata.name;
    const parentName = group.spec.parent;
    if (parentName) {
      const parent = groupsByName.get(parentName);
      if (parent && !parent.spec.children.includes(selfName)) {
        parent.spec.children.push(selfName);
      }
    }
  }
  for (const group of groups) {
    const selfName = group.metadata.name;
    for (const childName of group.spec.children) {
      const child = groupsByName.get(childName);
      if (child && !child.spec.parent) {
        child.spec.parent = selfName;
      }
    }
  }
}
function buildMemberOf(groups, users) {
  const groupsByName = new Map(groups.map((g) => [g.metadata.name, g]));
  users.forEach((user) => {
    const transitiveMemberOf = /* @__PURE__ */ new Set();
    const todo = [
      ...user.spec.memberOf ?? [],
      ...groups.filter((g) => g.spec.members?.includes(user.metadata.name)).map((g) => g.metadata.name)
    ];
    for (; ; ) {
      const current = todo.pop();
      if (!current) {
        break;
      }
      if (!transitiveMemberOf.has(current)) {
        transitiveMemberOf.add(current);
        const group = groupsByName.get(current);
        if (group?.spec.parent) {
          todo.push(group.spec.parent);
        }
      }
    }
    user.spec.memberOf = [...transitiveMemberOf];
  });
}

org_cjs.buildMemberOf = buildMemberOf;
org_cjs.buildOrgHierarchy = buildOrgHierarchy;

var defaultTransformers_cjs = {};

var helper_cjs = {};

function normalizeEntityName(name) {
  let cleaned = name.trim().toLocaleLowerCase().replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  while (cleaned.endsWith("_")) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }
  while (cleaned.includes("__")) {
    cleaned = cleaned.replace("__", "_");
  }
  return cleaned;
}

helper_cjs.normalizeEntityName = normalizeEntityName;

var constants$2 = constants_cjs;
var helper = helper_cjs;

async function defaultOrganizationTransformer(organization) {
  if (!organization.id || !organization.displayName) {
    return void 0;
  }
  const name = helper.normalizeEntityName(organization.displayName);
  return {
    apiVersion: "backstage.io/v1alpha1",
    kind: "Group",
    metadata: {
      name,
      description: organization.displayName,
      annotations: {
        [constants$2.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION]: organization.id
      }
    },
    spec: {
      type: "root",
      profile: {
        displayName: organization.displayName
      },
      children: []
    }
  };
}
function extractGroupName(group) {
  if (group.securityEnabled) {
    return group.displayName;
  }
  return group.mailNickname || group.displayName;
}
async function defaultGroupTransformer(group, groupPhoto) {
  if (!group.id || !group.displayName) {
    return void 0;
  }
  const name = helper.normalizeEntityName(extractGroupName(group));
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "Group",
    metadata: {
      name,
      annotations: {
        [constants$2.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION]: group.id
      }
    },
    spec: {
      type: "team",
      profile: {},
      children: []
    }
  };
  if (group.description) {
    entity.metadata.description = group.description;
  }
  if (group.displayName) {
    entity.spec.profile.displayName = group.displayName;
  }
  if (group.mail) {
    entity.spec.profile.email = group.mail;
  }
  if (groupPhoto) {
    entity.spec.profile.picture = groupPhoto;
  }
  return entity;
}
async function defaultUserTransformer(user, userPhoto) {
  if (!user.id || !user.displayName) {
    return void 0;
  }
  const name = user.mail ? helper.normalizeEntityName(user.mail) : helper.normalizeEntityName(user.userPrincipalName);
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "User",
    metadata: {
      name,
      annotations: {
        [constants$2.MICROSOFT_GRAPH_USER_ID_ANNOTATION]: user.id
      }
    },
    spec: {
      profile: {
        displayName: user.displayName
        // TODO: Additional fields?
        // jobTitle: user.jobTitle || undefined,
        // officeLocation: user.officeLocation || undefined,
        // mobilePhone: user.mobilePhone || undefined,
      },
      memberOf: []
    }
  };
  if (user.mail) {
    entity.metadata.annotations[constants$2.MICROSOFT_EMAIL_ANNOTATION] = user.mail;
    entity.spec.profile.email = user.mail;
  }
  if (userPhoto) {
    entity.spec.profile.picture = userPhoto;
  }
  return entity;
}

defaultTransformers_cjs.defaultGroupTransformer = defaultGroupTransformer;
defaultTransformers_cjs.defaultOrganizationTransformer = defaultOrganizationTransformer;
defaultTransformers_cjs.defaultUserTransformer = defaultUserTransformer;

var catalogModel$1 = require$$0$2;
var limiterFactory = require$$1$2;
var constants$1 = constants_cjs;
var org = org_cjs;
var defaultTransformers = defaultTransformers_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var limiterFactory__default = /*#__PURE__*/_interopDefaultCompat(limiterFactory);

const PAGE_SIZE = 999;
async function readMicrosoftGraphUsers(client, options) {
  const users = client.getUsers(
    {
      filter: options.userFilter,
      expand: options.userExpand,
      select: options.userSelect,
      top: PAGE_SIZE
    },
    options.queryMode
  );
  return {
    users: await transformUsers(
      client,
      users,
      options.logger,
      options.loadUserPhotos,
      options.transformer
    )
  };
}
async function readMicrosoftGraphUsersInGroups(client, options) {
  const limiter = limiterFactory__default.default(10);
  const userGroupMemberPromises = [];
  const userGroupMembers = /* @__PURE__ */ new Map();
  for await (const group of client.getGroups(
    {
      expand: options.groupExpand,
      filter: options.userGroupMemberFilter,
      search: options.userGroupMemberSearch,
      select: ["id", "displayName"],
      top: PAGE_SIZE
    },
    options.queryMode
  )) {
    userGroupMemberPromises.push(
      limiter(async () => {
        let groupMemberCount = 0;
        for await (const user of client.getGroupUserMembers(
          group.id,
          {
            expand: options.userExpand,
            filter: options.userFilter,
            select: options.userSelect,
            top: PAGE_SIZE
          },
          options.queryMode
        )) {
          userGroupMembers.set(user.id, user);
          groupMemberCount++;
        }
        options.logger.debug("Read users from group", {
          groupId: group.id,
          groupName: group.displayName,
          memberCount: groupMemberCount
        });
      })
    );
  }
  await Promise.all(userGroupMemberPromises);
  options.logger.info("Read users from group membership", {
    groupCount: userGroupMemberPromises.length,
    userCount: userGroupMembers.size
  });
  return {
    users: await transformUsers(
      client,
      userGroupMembers.values(),
      options.logger,
      options.loadUserPhotos,
      options.transformer
    )
  };
}
async function readMicrosoftGraphOrganization(client, tenantId, options) {
  const organization = await client.getOrganization(tenantId);
  const transformer = options?.transformer ?? defaultTransformers.defaultOrganizationTransformer;
  const rootGroup = await transformer(organization);
  return { rootGroup };
}
async function readMicrosoftGraphGroups(client, tenantId, options) {
  const groups = [];
  const groupMember = /* @__PURE__ */ new Map();
  const groupMemberOf = /* @__PURE__ */ new Map();
  const limiter = limiterFactory__default.default(10);
  const { rootGroup } = await readMicrosoftGraphOrganization(client, tenantId, {
    transformer: options?.organizationTransformer
  });
  if (rootGroup) {
    groupMember.set(rootGroup.metadata.name, /* @__PURE__ */ new Set());
    groups.push(rootGroup);
  }
  const transformer = options?.groupTransformer ?? defaultTransformers.defaultGroupTransformer;
  const promises = [];
  for await (const group of client.getGroups(
    {
      expand: options?.groupExpand,
      filter: options?.groupFilter,
      search: options?.groupSearch,
      select: options?.groupSelect,
      top: PAGE_SIZE
    },
    options?.queryMode
  )) {
    promises.push(
      limiter(async () => {
        const entity = await transformer(
          group
          /* , groupPhoto*/
        );
        if (!entity) {
          return;
        }
        for await (const member of client.getGroupMembers(group.id, {
          top: PAGE_SIZE
        })) {
          if (!member.id) {
            continue;
          }
          if (member["@odata.type"] === "#microsoft.graph.user") {
            ensureItem(groupMemberOf, member.id, group.id);
          }
          if (member["@odata.type"] === "#microsoft.graph.group") {
            ensureItem(groupMember, group.id, member.id);
            if (options?.groupIncludeSubGroups) {
              const groupMemberEntity = await transformer(member);
              if (groupMemberEntity) {
                groups.push(groupMemberEntity);
                for await (const subMember of client.getGroupMembers(
                  member.id,
                  { top: PAGE_SIZE }
                )) {
                  if (!subMember.id) {
                    continue;
                  }
                  if (subMember["@odata.type"] === "#microsoft.graph.user") {
                    ensureItem(groupMemberOf, subMember.id, member.id);
                  }
                  if (subMember["@odata.type"] === "#microsoft.graph.group") {
                    ensureItem(groupMember, member.id, subMember.id);
                  }
                }
              }
            }
          }
        }
        groups.push(entity);
      })
    );
  }
  await Promise.all(promises);
  return {
    groups,
    rootGroup,
    groupMember,
    groupMemberOf
  };
}
function resolveRelations(rootGroup, groups, users, groupMember, groupMemberOf) {
  const groupMap = /* @__PURE__ */ new Map();
  for (const group of groups) {
    if (group.metadata.annotations[constants$1.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION]) {
      groupMap.set(
        group.metadata.annotations[constants$1.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION],
        group
      );
    }
    if (group.metadata.annotations[constants$1.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION]) {
      groupMap.set(
        group.metadata.annotations[constants$1.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION],
        group
      );
    }
  }
  const parentGroups = /* @__PURE__ */ new Map();
  groupMember.forEach(
    (members, groupId) => members.forEach((m) => ensureItem(parentGroups, m, groupId))
  );
  if (rootGroup) {
    const tenantId = rootGroup.metadata.annotations[constants$1.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION];
    groups.forEach((group) => {
      const groupId = group.metadata.annotations[constants$1.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION];
      if (!groupId) {
        return;
      }
      if (retrieveItems(parentGroups, groupId).size === 0) {
        ensureItem(parentGroups, groupId, tenantId);
        ensureItem(groupMember, tenantId, groupId);
      }
    });
  }
  groups.forEach((group) => {
    const id = group.metadata.annotations[constants$1.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION] ?? group.metadata.annotations[constants$1.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION];
    retrieveItems(groupMember, id).forEach((m) => {
      const childGroup = groupMap.get(m);
      if (childGroup) {
        group.spec.children.push(catalogModel$1.stringifyEntityRef(childGroup));
      }
    });
    retrieveItems(parentGroups, id).forEach((p) => {
      const parentGroup = groupMap.get(p);
      if (parentGroup) {
        group.spec.parent = catalogModel$1.stringifyEntityRef(parentGroup);
      }
    });
  });
  org.buildOrgHierarchy(groups);
  users.forEach((user) => {
    const id = user.metadata.annotations[constants$1.MICROSOFT_GRAPH_USER_ID_ANNOTATION];
    retrieveItems(groupMemberOf, id).forEach((p) => {
      const parentGroup = groupMap.get(p);
      if (parentGroup) {
        if (!user.spec.memberOf) {
          user.spec.memberOf = [];
        }
        user.spec.memberOf.push(catalogModel$1.stringifyEntityRef(parentGroup));
      }
    });
  });
  org.buildMemberOf(groups, users);
}
async function readMicrosoftGraphOrg(client, tenantId, options) {
  let users = [];
  if (options.userGroupMemberFilter || options.userGroupMemberSearch) {
    const { users: usersInGroups } = await readMicrosoftGraphUsersInGroups(
      client,
      {
        queryMode: options.queryMode,
        userExpand: options.userExpand,
        userFilter: options.userFilter,
        userSelect: options.userSelect,
        userGroupMemberFilter: options.userGroupMemberFilter,
        userGroupMemberSearch: options.userGroupMemberSearch,
        loadUserPhotos: options.loadUserPhotos,
        transformer: options.userTransformer,
        logger: options.logger
      }
    );
    users = usersInGroups;
  } else {
    const { users: usersWithFilter } = await readMicrosoftGraphUsers(client, {
      queryMode: options.queryMode,
      userExpand: options.userExpand,
      userFilter: options.userFilter,
      userSelect: options.userSelect,
      loadUserPhotos: options.loadUserPhotos,
      transformer: options.userTransformer,
      logger: options.logger
    });
    users = usersWithFilter;
  }
  const { groups, rootGroup, groupMember, groupMemberOf } = await readMicrosoftGraphGroups(client, tenantId, {
    queryMode: options.queryMode,
    groupExpand: options.groupExpand,
    groupFilter: options.groupFilter,
    groupSearch: options.groupSearch,
    groupSelect: options.groupSelect,
    groupIncludeSubGroups: options.groupIncludeSubGroups,
    groupTransformer: options.groupTransformer,
    organizationTransformer: options.organizationTransformer
  });
  resolveRelations(rootGroup, groups, users, groupMember, groupMemberOf);
  users.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  groups.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  return { users, groups };
}
async function transformUsers(client, users, logger, loadUserPhotos = true, transformer) {
  const limiter = limiterFactory__default.default(10);
  const resolvedTransformer = transformer ?? defaultTransformers.defaultUserTransformer;
  const promises = [];
  const entities = [];
  for await (const user of users) {
    promises.push(
      limiter(async () => {
        let userPhoto;
        try {
          if (loadUserPhotos) {
            userPhoto = await client.getUserPhotoWithSizeLimit(
              user.id,
              // We are limiting the photo size, as users with full resolution photos
              // can make the Backstage API slow
              120
            );
          }
        } catch (e) {
          logger.warn(`Unable to load user photo for`, {
            user: user.id,
            error: e
          });
        }
        const entity = await resolvedTransformer(user, userPhoto);
        if (entity) {
          entities.push(entity);
        }
      })
    );
  }
  await Promise.all(promises);
  logger.debug("Finished transforming users", {
    microsoftUserCount: promises.length,
    backstageUserCount: entities.length
  });
  return entities;
}
function ensureItem(target, key, value) {
  let set = target.get(key);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    target.set(key, set);
  }
  set.add(value);
}
function retrieveItems(target, key) {
  return target.get(key) ?? /* @__PURE__ */ new Set();
}

read_cjs.readMicrosoftGraphGroups = readMicrosoftGraphGroups;
read_cjs.readMicrosoftGraphOrg = readMicrosoftGraphOrg;
read_cjs.readMicrosoftGraphOrganization = readMicrosoftGraphOrganization;
read_cjs.readMicrosoftGraphUsers = readMicrosoftGraphUsers;
read_cjs.readMicrosoftGraphUsersInGroups = readMicrosoftGraphUsersInGroups;
read_cjs.resolveRelations = resolveRelations;

var catalogModel = require$$0$2;
var lodash = require$$1$1;
var uuid = require$$2$1;
var client = client_cjs;
var config = config_cjs;
var constants = constants_cjs;
var read = read_cjs;

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

class MicrosoftGraphOrgEntityProvider$1 {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(configRoot, options) {
    if ("id" in options) {
      return [
        MicrosoftGraphOrgEntityProvider$1.fromLegacyConfig(configRoot, options)
      ];
    }
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    function getTransformer(id, transformers) {
      if (["undefined", "function"].includes(typeof transformers)) {
        return transformers;
      }
      return transformers[id];
    }
    return config.readProviderConfigs(configRoot).map((providerConfig) => {
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for MicrosoftGraphOrgEntityProvider:${providerConfig.id}.`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      const provider = new MicrosoftGraphOrgEntityProvider$1({
        id: providerConfig.id,
        provider: providerConfig,
        logger: options.logger,
        userTransformer: getTransformer(
          providerConfig.id,
          options.userTransformer
        ),
        groupTransformer: getTransformer(
          providerConfig.id,
          options.groupTransformer
        ),
        organizationTransformer: getTransformer(
          providerConfig.id,
          options.organizationTransformer
        ),
        providerConfigTransformer: getTransformer(
          providerConfig.id,
          options.providerConfigTransformer
        )
      });
      if (taskRunner !== "manual") {
        provider.schedule(taskRunner);
      }
      return provider;
    });
  }
  /**
   * @deprecated Exists for backwards compatibility only and will be removed in the future.
   */
  static fromLegacyConfig(configRoot, options) {
    options.logger.warn(
      'Deprecated msgraph config "catalog.processors.microsoftGraphOrg" used. Use "catalog.providers.microsoftGraphOrg" instead. More info at https://github.com/backstage/backstage/blob/master/plugins/catalog-backend-module-msgraph/CHANGELOG.md#040-next1'
    );
    const config$1 = configRoot.getOptionalConfig(
      "catalog.processors.microsoftGraphOrg"
    );
    const providers = config$1 ? config.readMicrosoftGraphConfig(config$1) : [];
    const provider = providers.find((p) => options.target.startsWith(p.target));
    if (!provider) {
      throw new Error(
        `There is no Microsoft Graph Org provider that matches "${options.target}". Please add a configuration entry for it under "catalog.processors.microsoftGraphOrg.providers".`
      );
    }
    const logger = options.logger.child({
      target: options.target
    });
    const result = new MicrosoftGraphOrgEntityProvider$1({
      id: options.id,
      userTransformer: options.userTransformer,
      groupTransformer: options.groupTransformer,
      organizationTransformer: options.organizationTransformer,
      providerConfigTransformer: options.providerConfigTransformer,
      logger,
      provider
    });
    if (options.schedule !== "manual") {
      result.schedule(options.schedule);
    }
    return result;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `MicrosoftGraphOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
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
    const provider = this.options.providerConfigTransformer ? await this.options.providerConfigTransformer(this.options.provider) : this.options.provider;
    const { markReadComplete } = trackProgress(logger);
    const client$1 = client.MicrosoftGraphClient.create(this.options.provider);
    const { users, groups } = await read.readMicrosoftGraphOrg(
      client$1,
      provider.tenantId,
      {
        userExpand: provider.userExpand,
        userFilter: provider.userFilter,
        userSelect: provider.userSelect,
        loadUserPhotos: provider.loadUserPhotos,
        userGroupMemberFilter: provider.userGroupMemberFilter,
        userGroupMemberSearch: provider.userGroupMemberSearch,
        groupExpand: provider.groupExpand,
        groupFilter: provider.groupFilter,
        groupSearch: provider.groupSearch,
        groupSelect: provider.groupSelect,
        groupIncludeSubGroups: provider.groupIncludeSubGroups,
        queryMode: provider.queryMode,
        groupTransformer: this.options.groupTransformer,
        userTransformer: this.options.userTransformer,
        organizationTransformer: this.options.organizationTransformer,
        logger
      }
    );
    const { markCommitComplete } = markReadComplete({ users, groups });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `msgraph-org-provider:${this.options.id}`,
        entity: withLocations(this.options.id, entity)
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
            class: MicrosoftGraphOrgEntityProvider$1.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.read({ logger });
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
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading msgraph users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} msgraph users and ${read.groups.length} msgraph groups`;
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
function withLocations(providerId, entity) {
  const uid = entity.metadata.annotations?.[constants.MICROSOFT_GRAPH_USER_ID_ANNOTATION] || entity.metadata.annotations?.[constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION] || entity.metadata.annotations?.[constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION] || entity.metadata.name;
  const location = `msgraph:${providerId}/${encodeURIComponent(uid)}`;
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

MicrosoftGraphOrgEntityProvider_cjs.MicrosoftGraphOrgEntityProvider = MicrosoftGraphOrgEntityProvider$1;
MicrosoftGraphOrgEntityProvider_cjs.withLocations = withLocations;

var backendPluginApi = require$$0$1;
var alpha = require$$1$3;
var MicrosoftGraphOrgEntityProvider = MicrosoftGraphOrgEntityProvider_cjs;








const microsoftGraphOrgEntityProviderTransformExtensionPoint = backendPluginApi.createExtensionPoint(
  {
    id: "catalog.microsoftGraphOrgEntityProvider.transforms"
  }
);
const catalogModuleMicrosoftGraphOrgEntityProvider$1 = backendPluginApi.createBackendModule(
  {
    pluginId: "catalog",
    moduleId: "microsoftGraphOrgEntityProvider",
    register(env) {
      let userTransformer;
      let groupTransformer;
      let organizationTransformer;
      let providerConfigTransformer;
      env.registerExtensionPoint(
        microsoftGraphOrgEntityProviderTransformExtensionPoint,
        {
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
          },
          setOrganizationTransformer(transformer) {
            if (organizationTransformer) {
              throw new Error("Organization transformer may only be set once");
            }
            organizationTransformer = transformer;
          },
          setProviderConfigTransformer(transformer) {
            if (providerConfigTransformer) {
              throw new Error("Provider transformer may only be set once");
            }
            providerConfigTransformer = transformer;
          }
        }
      );
      env.registerInit({
        deps: {
          catalog: alpha.catalogProcessingExtensionPoint,
          config: backendPluginApi.coreServices.rootConfig,
          logger: backendPluginApi.coreServices.logger,
          scheduler: backendPluginApi.coreServices.scheduler
        },
        async init({ catalog, config, logger, scheduler }) {
          catalog.addEntityProvider(
            MicrosoftGraphOrgEntityProvider.MicrosoftGraphOrgEntityProvider.fromConfig(config, {
              logger,
              scheduler,
              userTransformer,
              groupTransformer,
              organizationTransformer,
              providerConfigTransformer
            })
          );
        }
      });
    }
  }
);

catalogModuleMicrosoftGraphOrgEntityProvider_cjs.catalogModuleMicrosoftGraphOrgEntityProvider = catalogModuleMicrosoftGraphOrgEntityProvider$1;
catalogModuleMicrosoftGraphOrgEntityProvider_cjs.microsoftGraphOrgEntityProviderTransformExtensionPoint = microsoftGraphOrgEntityProviderTransformExtensionPoint;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var catalogModuleMicrosoftGraphOrgEntityProvider = catalogModuleMicrosoftGraphOrgEntityProvider_cjs;

const _feature = catalogModuleMicrosoftGraphOrgEntityProvider.catalogModuleMicrosoftGraphOrgEntityProvider;

var _default = alpha_cjs.default = _feature;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
