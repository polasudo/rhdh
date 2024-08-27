'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/catalog-model');
var require$$1 = require('lodash');
var require$$2 = require('uuid');
var require$$3 = require('@backstage/errors');
var require$$4 = require('fs/promises');
var require$$5 = require('ldapjs');
var require$$6 = require('tls');
var require$$7 = require('@backstage/backend-plugin-api');
var require$$8 = require('lodash/mergeWith');
var require$$9 = require('lodash/set');
var require$$10 = require('lodash/cloneDeep');
var require$$11 = require('@backstage/plugin-catalog-node');
var require$$12 = require('@backstage/plugin-catalog-node/alpha');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var catalogModel = require$$0;
var lodash = require$$1;
var uuid = require$$2;
var errors = require$$3;
var promises = require$$4;
var ldap = require$$5;
var tlsLib = require$$6;
var backendPluginApi = require$$7;
var mergeWith = require$$8;
var lodashSet = require$$9;
var cloneDeep = require$$10;
var pluginCatalogNode = require$$11;
var alpha = require$$12;

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
var ldap__default = /*#__PURE__*/_interopDefaultCompat(ldap);
var tlsLib__default = /*#__PURE__*/_interopDefaultCompat(tlsLib);
var mergeWith__default = /*#__PURE__*/_interopDefaultCompat(mergeWith);
var lodashSet__default = /*#__PURE__*/_interopDefaultCompat(lodashSet);
var cloneDeep__default = /*#__PURE__*/_interopDefaultCompat(cloneDeep);

function errorString(error) {
  return `${error.code} ${error.name}: ${error.message}`;
}
function mapStringAttr(entry, vendor, attributeName, setter) {
  if (attributeName) {
    const values = vendor.decodeStringAttribute(entry, attributeName);
    if (values && values.length === 1) {
      setter(values[0]);
    }
  }
}
function createOptions(inputOptions) {
  const result = lodash.cloneDeep(inputOptions);
  if (result.paged === true) {
    result.paged = { pagePause: true };
  } else if (typeof result.paged === "object") {
    result.paged.pagePause = true;
  }
  return result;
}

const DefaultLdapVendor = {
  dnAttributeName: "entryDN",
  uuidAttributeName: "entryUUID",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
const ActiveDirectoryVendor = {
  dnAttributeName: "distinguishedName",
  uuidAttributeName: "objectGUID",
  decodeStringAttribute: (entry, name) => {
    const decoder = (value) => {
      if (name === ActiveDirectoryVendor.uuidAttributeName) {
        return formatGUID(value);
      }
      return value.toString();
    };
    return decode(entry, name, decoder);
  }
};
const FreeIpaVendor = {
  dnAttributeName: "dn",
  uuidAttributeName: "ipaUniqueID",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
const AEDirVendor = {
  dnAttributeName: "dn",
  uuidAttributeName: "entryUUID",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
function decode(entry, attributeName, decoder) {
  const values = entry.raw[attributeName];
  if (Array.isArray(values)) {
    return values.map((v) => {
      return decoder(v);
    });
  } else if (values) {
    return [decoder(values)];
  }
  return [];
}
function formatGUID(objectGUID) {
  let data;
  if (typeof objectGUID === "string") {
    data = Buffer.from(objectGUID, "binary");
  } else {
    data = objectGUID;
  }
  let template = "{3}{2}{1}{0}-{5}{4}-{7}{6}-{8}{9}-{10}{11}{12}{13}{14}{15}";
  for (let i = 0; i < data.length; i++) {
    let dataStr = data[i].toString(16);
    dataStr = data[i] >= 16 ? dataStr : `0${dataStr}`;
    template = template.replace(`{${i}}`, dataStr);
  }
  return template;
}

class LdapClient {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  vendor;
  static async create(logger, target, bind, tls) {
    let secureContext;
    if (tls && tls.certs && tls.keys) {
      const cert = await promises.readFile(tls.certs, "utf-8");
      const key = await promises.readFile(tls.keys, "utf-8");
      secureContext = tlsLib__default.default.createSecureContext({
        cert,
        key
      });
    }
    const client = ldap__default.default.createClient({
      url: target,
      tlsOptions: {
        secureContext,
        rejectUnauthorized: tls?.rejectUnauthorized
      }
    });
    client.on("error", (err) => {
      logger.warn(`LDAP client threw an error, ${errorString(err)}`);
    });
    if (!bind) {
      return new LdapClient(client, logger);
    }
    return new Promise((resolve, reject) => {
      const { dn, secret } = bind;
      client.bind(dn, secret, (err) => {
        if (err) {
          reject(`LDAP bind failed for ${dn}, ${errorString(err)}`);
        } else {
          resolve(new LdapClient(client, logger));
        }
      });
    });
  }
  /**
   * Performs an LDAP search operation.
   *
   * @param dn - The fully qualified base DN to search within
   * @param options - The search options
   */
  async search(dn, options) {
    try {
      const output = [];
      const logInterval = setInterval(() => {
        this.logger.debug(`Read ${output.length} LDAP entries so far...`);
      }, 5e3);
      const search = new Promise((resolve, reject) => {
        this.client.search(dn, lodash.cloneDeep(options), (err, res) => {
          if (err) {
            reject(new Error(errorString(err)));
            return;
          }
          res.on("searchReference", () => {
            this.logger.warn("Received unsupported search referral");
          });
          res.on("searchEntry", (entry) => {
            output.push(entry);
          });
          res.on("error", (e) => {
            reject(new Error(errorString(e)));
          });
          res.on("page", (_result, cb) => {
            if (cb) {
              cb();
            }
          });
          res.on("end", (r) => {
            if (!r) {
              reject(new Error("Null response"));
            } else if (r.status !== 0) {
              reject(new Error(`Got status ${r.status}: ${r.errorMessage}`));
            } else {
              resolve(output);
            }
          });
        });
      });
      return await search.finally(() => {
        clearInterval(logInterval);
      });
    } catch (e) {
      throw new errors.ForwardedError(`LDAP search at DN "${dn}" failed`, e);
    }
  }
  /**
   * Performs an LDAP search operation, calls a function on each entry to limit memory usage
   *
   * @param dn - The fully qualified base DN to search within
   * @param options - The search options
   * @param f - The callback to call on each search entry
   */
  async searchStreaming(dn, options, f) {
    try {
      return await new Promise((resolve, reject) => {
        this.client.search(dn, createOptions(options), (err, res) => {
          if (err) {
            reject(new Error(errorString(err)));
          }
          let awaitList = [];
          let transformError = false;
          const transformReject = (e) => {
            transformError = true;
            reject(
              new Error(
                `Transform function threw an exception, ${errors.stringifyError(e)}`
              )
            );
          };
          res.on("searchReference", () => {
            this.logger.warn("Received unsupported search referral");
          });
          res.on("searchEntry", (entry) => {
            if (!transformError) awaitList.push(f(entry));
          });
          res.on("page", (_, cb) => {
            Promise.all(awaitList).then(() => {
              awaitList = [];
              if (cb) cb();
            }).catch(transformReject);
          });
          res.on("error", (e) => {
            reject(new Error(errorString(e)));
          });
          res.on("end", (r) => {
            if (!r) {
              throw new Error("Null response");
            } else if (r.status !== 0) {
              throw new Error(`Got status ${r.status}: ${r.errorMessage}`);
            } else {
              Promise.all(awaitList).then(() => resolve()).catch(transformReject);
            }
          });
        });
      });
    } catch (e) {
      throw new errors.ForwardedError(`LDAP search at DN "${dn}" failed`, e);
    }
  }
  /**
   * Get the Server Vendor.
   * Currently only detects Microsoft Active Directory Servers.
   *
   * @see https://ldapwiki.com/wiki/Determine%20LDAP%20Server%20Vendor
   */
  async getVendor() {
    if (this.vendor) {
      return this.vendor;
    }
    this.vendor = this.getRootDSE().then((root) => {
      if (root && root.raw?.forestFunctionality) {
        return ActiveDirectoryVendor;
      } else if (root && root.raw?.ipaDomainLevel) {
        return FreeIpaVendor;
      } else if (root && "aeRoot" in root.raw) {
        return AEDirVendor;
      }
      return DefaultLdapVendor;
    }).catch((err) => {
      this.vendor = void 0;
      throw err;
    });
    return this.vendor;
  }
  /**
   * Get the Root DSE.
   *
   * @see https://ldapwiki.com/wiki/RootDSE
   */
  async getRootDSE() {
    const result = await this.search("", {
      scope: "base",
      filter: "(objectclass=*)"
    });
    if (result && result.length === 1) {
      return result[0];
    }
    return void 0;
  }
}

const defaultUserConfig = {
  options: {
    scope: "one",
    attributes: ["*", "+"]
  },
  map: {
    rdn: "uid",
    name: "uid",
    displayName: "cn",
    email: "mail",
    memberOf: "memberOf"
  }
};
const defaultGroupConfig = {
  options: {
    scope: "one",
    attributes: ["*", "+"]
  },
  map: {
    rdn: "cn",
    name: "cn",
    description: "description",
    displayName: "cn",
    type: "groupType",
    memberOf: "memberOf",
    members: "member"
  }
};
function freeze(data) {
  return JSON.parse(JSON.stringify(data), (_key, value) => {
    if (typeof value === "object" && value !== null) {
      Object.freeze(value);
    }
    return value;
  });
}
function readTlsConfig(c) {
  if (!c) {
    return void 0;
  }
  return {
    rejectUnauthorized: c.getOptionalBoolean("rejectUnauthorized"),
    keys: c.getOptionalString("keys"),
    certs: c.getOptionalString("certs")
  };
}
function readBindConfig(c) {
  if (!c) {
    return void 0;
  }
  return {
    dn: c.getString("dn"),
    secret: c.getString("secret")
  };
}
function readOptionsConfig(c) {
  if (!c) {
    return {};
  }
  const paged = readOptionsPagedConfig(c);
  return {
    scope: c.getOptionalString("scope"),
    filter: formatFilter(c.getOptionalString("filter")),
    attributes: c.getOptionalStringArray("attributes"),
    sizeLimit: c.getOptionalNumber("sizeLimit"),
    timeLimit: c.getOptionalNumber("timeLimit"),
    derefAliases: c.getOptionalNumber("derefAliases"),
    typesOnly: c.getOptionalBoolean("typesOnly"),
    ...paged !== void 0 ? { paged } : void 0
  };
}
function readOptionsPagedConfig(c) {
  const pagedConfig = c.getOptional("paged");
  if (pagedConfig === void 0) {
    return void 0;
  }
  if (pagedConfig === true || pagedConfig === false) {
    return pagedConfig;
  }
  const pageSize = c.getOptionalNumber("paged.pageSize");
  const pagePause = c.getOptionalBoolean("paged.pagePause");
  return {
    ...pageSize !== void 0 ? { pageSize } : void 0,
    ...pagePause !== void 0 ? { pagePause } : void 0
  };
}
function readSetConfig(c) {
  if (!c) {
    return void 0;
  }
  return c.get();
}
function readUserMapConfig(c) {
  if (!c) {
    return {};
  }
  return {
    rdn: c.getOptionalString("rdn"),
    name: c.getOptionalString("name"),
    description: c.getOptionalString("description"),
    displayName: c.getOptionalString("displayName"),
    email: c.getOptionalString("email"),
    picture: c.getOptionalString("picture"),
    memberOf: c.getOptionalString("memberOf")
  };
}
function readGroupMapConfig(c) {
  if (!c) {
    return {};
  }
  return {
    rdn: c.getOptionalString("rdn"),
    name: c.getOptionalString("name"),
    description: c.getOptionalString("description"),
    type: c.getOptionalString("type"),
    displayName: c.getOptionalString("displayName"),
    email: c.getOptionalString("email"),
    picture: c.getOptionalString("picture"),
    memberOf: c.getOptionalString("memberOf"),
    members: c.getOptionalString("members")
  };
}
function readUserConfig(c) {
  if (!c) {
    return [];
  }
  if (Array.isArray(c)) {
    return c.map((it) => readSingleUserConfig(it));
  }
  return [readSingleUserConfig(c)];
}
function readSingleUserConfig(c) {
  return {
    dn: c.getString("dn"),
    options: readOptionsConfig(c.getOptionalConfig("options")),
    set: readSetConfig(c.getOptionalConfig("set")),
    map: readUserMapConfig(c.getOptionalConfig("map"))
  };
}
function readGroupConfig(c) {
  if (!c) {
    return [];
  }
  if (Array.isArray(c)) {
    return c.map((it) => readSingleGroupConfig(it));
  }
  return [readSingleGroupConfig(c)];
}
function readSingleGroupConfig(c) {
  return {
    dn: c.getString("dn"),
    options: readOptionsConfig(c.getOptionalConfig("options")),
    set: readSetConfig(c.getOptionalConfig("set")),
    map: readGroupMapConfig(c.getOptionalConfig("map"))
  };
}
function formatFilter(filter) {
  return filter?.replace(/\s*(\(|\))/g, "$1")?.trim();
}
function readLdapLegacyConfig(config) {
  const providerConfigs = config.getOptionalConfigArray("providers") ?? [];
  return providerConfigs.map((c) => {
    const newConfig = {
      target: lodash.trimEnd(c.getString("target"), "/"),
      tls: readTlsConfig(c.getOptionalConfig("tls")),
      bind: readBindConfig(c.getOptionalConfig("bind")),
      users: readUserConfig(c.getConfig("users")).map((it) => {
        return mergeWith__default.default({}, defaultUserConfig, it, replaceArraysIfPresent);
      }),
      groups: readGroupConfig(c.getConfig("groups")).map((it) => {
        return mergeWith__default.default({}, defaultGroupConfig, it, replaceArraysIfPresent);
      })
    };
    return freeze(newConfig);
  });
}
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig("catalog.providers.ldapOrg");
  if (!providersConfig) {
    return [];
  }
  return providersConfig.keys().map((id) => {
    const c = providersConfig.getConfig(id);
    const schedule = c.has("schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
      c.getConfig("schedule")
    ) : void 0;
    const isUserList = Array.isArray(c.getOptional("users"));
    const isGroupList = Array.isArray(c.getOptional("groups"));
    const newConfig = {
      id,
      target: lodash.trimEnd(c.getString("target"), "/"),
      tls: readTlsConfig(c.getOptionalConfig("tls")),
      bind: readBindConfig(c.getOptionalConfig("bind")),
      users: readUserConfig(
        isUserList ? c.getOptionalConfigArray("users") : c.getOptionalConfig("users")
      ).map((it) => {
        return mergeWith__default.default({}, defaultUserConfig, it, replaceArraysIfPresent);
      }),
      groups: readGroupConfig(
        isGroupList ? c.getOptionalConfigArray("groups") : c.getOptionalConfig("groups")
      ).map((it) => {
        return mergeWith__default.default({}, defaultGroupConfig, it, replaceArraysIfPresent);
      }),
      schedule
    };
    return freeze(newConfig);
  });
}
function replaceArraysIfPresent(_into, from) {
  return Array.isArray(from) ? from : void 0;
}

const LDAP_RDN_ANNOTATION = "backstage.io/ldap-rdn";
const LDAP_DN_ANNOTATION = "backstage.io/ldap-dn";
const LDAP_UUID_ANNOTATION = "backstage.io/ldap-uuid";

function buildOrgHierarchy(groups) {
  const groupsByRef = new Map(groups.map((g) => [catalogModel.stringifyEntityRef(g), g]));
  for (const group of groups) {
    const selfRef = catalogModel.stringifyEntityRef(group);
    const parentRef = group.spec.parent;
    if (parentRef) {
      const parent = groupsByRef.get(parentRef);
      if (parent && !parent.spec.children.includes(selfRef)) {
        parent.spec.children.push(selfRef);
      }
    }
  }
  for (const group of groups) {
    const selfRef = catalogModel.stringifyEntityRef(group);
    for (const childRef of group.spec.children) {
      const child = groupsByRef.get(childRef);
      if (child && !child.spec.parent) {
        child.spec.parent = selfRef;
      }
    }
  }
}

async function defaultUserTransformer(vendor, config, entry) {
  const { set, map } = config;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "User",
    metadata: {
      name: "",
      annotations: {}
    },
    spec: {
      profile: {},
      memberOf: []
    }
  };
  if (set) {
    for (const [path, value] of Object.entries(set)) {
      lodashSet__default.default(entity, path, cloneDeep__default.default(value));
    }
  }
  mapStringAttr(entry, vendor, map.name, (v) => {
    entity.metadata.name = v;
  });
  mapStringAttr(entry, vendor, map.description, (v) => {
    entity.metadata.description = v;
  });
  mapStringAttr(entry, vendor, map.rdn, (v) => {
    entity.metadata.annotations[LDAP_RDN_ANNOTATION] = v;
  });
  mapStringAttr(entry, vendor, vendor.uuidAttributeName, (v) => {
    entity.metadata.annotations[LDAP_UUID_ANNOTATION] = v;
  });
  mapStringAttr(entry, vendor, vendor.dnAttributeName, (v) => {
    entity.metadata.annotations[LDAP_DN_ANNOTATION] = v;
  });
  mapStringAttr(entry, vendor, map.displayName, (v) => {
    entity.spec.profile.displayName = v;
  });
  mapStringAttr(entry, vendor, map.email, (v) => {
    entity.spec.profile.email = v;
  });
  mapStringAttr(entry, vendor, map.picture, (v) => {
    entity.spec.profile.picture = v;
  });
  return entity;
}
async function readLdapUsers(client, config, opts) {
  if (config.length === 0) {
    return { users: [], userMemberOf: /* @__PURE__ */ new Map() };
  }
  const entities = [];
  const userMemberOf = /* @__PURE__ */ new Map();
  const vendor = await client.getVendor();
  const transformer = opts?.transformer ?? defaultUserTransformer;
  for (const cfg of config) {
    const { dn, options, map } = cfg;
    await client.searchStreaming(dn, options, async (user) => {
      const entity = await transformer(vendor, cfg, user);
      if (!entity) {
        return;
      }
      mapReferencesAttr(user, vendor, map.memberOf, (myDn, vs) => {
        ensureItems(userMemberOf, myDn, vs);
      });
      entities.push(entity);
    });
  }
  return { users: entities, userMemberOf };
}
async function defaultGroupTransformer(vendor, config, entry) {
  const { set, map } = config;
  const entity = {
    apiVersion: "backstage.io/v1beta1",
    kind: "Group",
    metadata: {
      name: "",
      annotations: {}
    },
    spec: {
      type: "unknown",
      profile: {},
      children: []
    }
  };
  if (set) {
    for (const [path, value] of Object.entries(set)) {
      lodashSet__default.default(entity, path, cloneDeep__default.default(value));
    }
  }
  mapStringAttr(entry, vendor, map.name, (v) => {
    entity.metadata.name = v;
  });
  mapStringAttr(entry, vendor, map.description, (v) => {
    entity.metadata.description = v;
  });
  mapStringAttr(entry, vendor, map.rdn, (v) => {
    entity.metadata.annotations[LDAP_RDN_ANNOTATION] = v;
  });
  mapStringAttr(entry, vendor, vendor.uuidAttributeName, (v) => {
    entity.metadata.annotations[LDAP_UUID_ANNOTATION] = v;
  });
  mapStringAttr(entry, vendor, vendor.dnAttributeName, (v) => {
    entity.metadata.annotations[LDAP_DN_ANNOTATION] = v;
  });
  mapStringAttr(entry, vendor, map.type, (v) => {
    entity.spec.type = v;
  });
  mapStringAttr(entry, vendor, map.displayName, (v) => {
    entity.spec.profile.displayName = v;
  });
  mapStringAttr(entry, vendor, map.email, (v) => {
    entity.spec.profile.email = v;
  });
  mapStringAttr(entry, vendor, map.picture, (v) => {
    entity.spec.profile.picture = v;
  });
  return entity;
}
async function readLdapGroups(client, config, opts) {
  if (config.length === 0) {
    return { groups: [], groupMemberOf: /* @__PURE__ */ new Map(), groupMember: /* @__PURE__ */ new Map() };
  }
  const groups = [];
  const groupMemberOf = /* @__PURE__ */ new Map();
  const groupMember = /* @__PURE__ */ new Map();
  const vendor = await client.getVendor();
  const transformer = opts?.transformer ?? defaultGroupTransformer;
  for (const cfg of config) {
    const { dn, map, options } = cfg;
    await client.searchStreaming(dn, options, async (entry) => {
      if (!entry) {
        return;
      }
      const entity = await transformer(vendor, cfg, entry);
      if (!entity) {
        return;
      }
      mapReferencesAttr(entry, vendor, map.memberOf, (myDn, vs) => {
        ensureItems(groupMemberOf, myDn, vs);
      });
      mapReferencesAttr(entry, vendor, map.members, (myDn, vs) => {
        ensureItems(groupMember, myDn, vs);
      });
      groups.push(entity);
    });
  }
  return {
    groups,
    groupMemberOf,
    groupMember
  };
}
async function readLdapOrg(client, userConfig, groupConfig, options) {
  const { users, userMemberOf } = await readLdapUsers(client, userConfig, {
    transformer: options?.userTransformer
  });
  const { groups, groupMemberOf, groupMember } = await readLdapGroups(
    client,
    groupConfig,
    { transformer: options?.groupTransformer }
  );
  resolveRelations(groups, users, userMemberOf, groupMemberOf, groupMember);
  users.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  groups.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  return { users, groups };
}
function mapReferencesAttr(entry, vendor, attributeName, setter) {
  if (attributeName) {
    const values = vendor.decodeStringAttribute(entry, attributeName);
    const dn = vendor.decodeStringAttribute(entry, vendor.dnAttributeName);
    if (values && dn && dn.length === 1) {
      setter(dn[0], values);
    }
  }
}
function ensureItems(target, key, values) {
  if (key) {
    let set = target.get(key);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      target.set(key, set);
    }
    for (const value of values) {
      if (value) {
        set.add(value);
      }
    }
  }
}
function resolveRelations(groups, users, userMemberOf, groupMemberOf, groupMember) {
  const userMap = /* @__PURE__ */ new Map();
  const groupMap = /* @__PURE__ */ new Map();
  for (const user of users) {
    userMap.set(catalogModel.stringifyEntityRef(user), user);
    userMap.set(user.metadata.annotations[LDAP_DN_ANNOTATION], user);
    userMap.set(user.metadata.annotations[LDAP_RDN_ANNOTATION], user);
    userMap.set(user.metadata.annotations[LDAP_UUID_ANNOTATION], user);
  }
  for (const group of groups) {
    groupMap.set(catalogModel.stringifyEntityRef(group), group);
    groupMap.set(group.metadata.annotations[LDAP_DN_ANNOTATION], group);
    groupMap.set(group.metadata.annotations[LDAP_RDN_ANNOTATION], group);
    groupMap.set(group.metadata.annotations[LDAP_UUID_ANNOTATION], group);
  }
  userMap.delete("");
  groupMap.delete("");
  userMap.delete(void 0);
  groupMap.delete(void 0);
  const newUserMemberOf = /* @__PURE__ */ new Map();
  const newGroupParents = /* @__PURE__ */ new Map();
  const newGroupChildren = /* @__PURE__ */ new Map();
  for (const [userN, groupsN] of userMemberOf.entries()) {
    const user = userMap.get(userN);
    if (user) {
      for (const groupN of groupsN) {
        const group = groupMap.get(groupN);
        if (group) {
          ensureItems(newUserMemberOf, catalogModel.stringifyEntityRef(user), [
            catalogModel.stringifyEntityRef(group)
          ]);
        }
      }
    }
  }
  for (const [groupN, parentsN] of groupMemberOf.entries()) {
    const group = groupMap.get(groupN);
    if (group) {
      for (const parentN of parentsN) {
        const parentGroup = groupMap.get(parentN);
        if (parentGroup) {
          ensureItems(newGroupParents, catalogModel.stringifyEntityRef(group), [
            catalogModel.stringifyEntityRef(parentGroup)
          ]);
          ensureItems(newGroupChildren, catalogModel.stringifyEntityRef(parentGroup), [
            catalogModel.stringifyEntityRef(group)
          ]);
        }
      }
    }
  }
  for (const [groupN, membersN] of groupMember.entries()) {
    const group = groupMap.get(groupN);
    if (group) {
      for (const memberN of membersN) {
        const memberUser = userMap.get(memberN);
        if (memberUser) {
          ensureItems(newUserMemberOf, catalogModel.stringifyEntityRef(memberUser), [
            catalogModel.stringifyEntityRef(group)
          ]);
        } else {
          const memberGroup = groupMap.get(memberN);
          if (memberGroup) {
            ensureItems(newGroupChildren, catalogModel.stringifyEntityRef(group), [
              catalogModel.stringifyEntityRef(memberGroup)
            ]);
            ensureItems(newGroupParents, catalogModel.stringifyEntityRef(memberGroup), [
              catalogModel.stringifyEntityRef(group)
            ]);
          }
        }
      }
    }
  }
  for (const [userN, groupsN] of newUserMemberOf.entries()) {
    const user = userMap.get(userN);
    if (user) {
      user.spec.memberOf = Array.from(groupsN).sort();
    }
  }
  for (const [groupN, parentsN] of newGroupParents.entries()) {
    if (parentsN.size === 1) {
      const group = groupMap.get(groupN);
      if (group) {
        group.spec.parent = parentsN.values().next().value;
      }
    }
  }
  for (const [groupN, childrenN] of newGroupChildren.entries()) {
    const group = groupMap.get(groupN);
    if (group) {
      group.spec.children = Array.from(childrenN).sort();
    }
  }
  buildOrgHierarchy(groups);
}

class LdapOrgEntityProvider {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(configRoot, options) {
    if ("id" in options) {
      return [LdapOrgEntityProvider.fromLegacyConfig(configRoot, options)];
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
    return readProviderConfigs(configRoot).map((providerConfig) => {
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for LdapOrgEntityProvider:${providerConfig.id}.`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      const provider = new LdapOrgEntityProvider({
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
        )
      });
      if (taskRunner !== "manual") {
        provider.schedule(taskRunner);
      }
      return provider;
    });
  }
  static fromLegacyConfig(configRoot, options) {
    const config = configRoot.getOptionalConfig("ldap") || configRoot.getOptionalConfig("catalog.processors.ldapOrg");
    const providers = config ? readLdapLegacyConfig(config) : [];
    const provider = providers.find((p) => options.target === p.target);
    if (!provider) {
      throw new TypeError(
        `There is no LDAP configuration that matches "${options.target}". Please add a configuration entry for it under "ldap.providers".`
      );
    }
    const logger = options.logger.child({
      target: options.target
    });
    const result = new LdapOrgEntityProvider({
      id: options.id,
      provider,
      userTransformer: options.userTransformer,
      groupTransformer: options.groupTransformer,
      logger
    });
    if (options.schedule !== "manual") {
      result.schedule(options.schedule);
    }
    return result;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `LdapOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn?.();
  }
  /**
   * Runs one single complete ingestion. This is only necessary if you use
   * manual scheduling.
   */
  async read(options) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const { markReadComplete } = trackProgress(logger);
    const client = await LdapClient.create(
      this.options.logger,
      this.options.provider.target,
      this.options.provider.bind,
      this.options.provider.tls
    );
    const { users, groups } = await readLdapOrg(
      client,
      this.options.provider.users,
      this.options.provider.groups,
      {
        groupTransformer: this.options.groupTransformer,
        userTransformer: this.options.userTransformer,
        logger
      }
    );
    const { markCommitComplete } = markReadComplete({ users, groups });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `ldap-org-provider:${this.options.id}`,
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
            class: LdapOrgEntityProvider.prototype.constructor.name,
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
  logger.info("Reading LDAP users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} LDAP users and ${read.groups.length} LDAP groups`;
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
  const dn = entity.metadata.annotations?.[LDAP_DN_ANNOTATION] || entity.metadata.name;
  const location = `ldap://${providerId}/${encodeURIComponent(dn)}`;
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

class LdapOrgReaderProcessor {
  providers;
  logger;
  groupTransformer;
  userTransformer;
  static fromConfig(configRoot, options) {
    const config = configRoot.getOptionalConfig("ldap") || configRoot.getOptionalConfig("catalog.processors.ldapOrg");
    return new LdapOrgReaderProcessor({
      ...options,
      providers: config ? readLdapLegacyConfig(config) : []
    });
  }
  constructor(options) {
    this.providers = options.providers;
    this.logger = options.logger;
    this.groupTransformer = options.groupTransformer;
    this.userTransformer = options.userTransformer;
  }
  getProcessorName() {
    return "LdapOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "ldap-org") {
      return false;
    }
    const provider = this.providers.find((p) => location.target === p.target);
    if (!provider) {
      throw new Error(
        `There is no LDAP configuration that matches "${location.target}". Please add a configuration entry for it under "ldap.providers".`
      );
    }
    const startTimestamp = Date.now();
    this.logger.info("Reading LDAP users and groups");
    const client = await LdapClient.create(
      this.logger,
      provider.target,
      provider.bind,
      provider.tls
    );
    const { users, groups } = await readLdapOrg(
      client,
      provider.users,
      provider.groups,
      {
        groupTransformer: this.groupTransformer,
        userTransformer: this.userTransformer,
        logger: this.logger
      }
    );
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${users.length} LDAP users and ${groups.length} LDAP groups in ${duration} seconds`
    );
    for (const group of groups) {
      emit(pluginCatalogNode.processingResult.entity(location, group));
    }
    for (const user of users) {
      emit(pluginCatalogNode.processingResult.entity(location, user));
    }
    return true;
  }
}

const ldapOrgEntityProviderTransformsExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "catalog.ldapOrgEntityProvider.transforms"
});
const catalogModuleLdapOrgEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "ldapOrgEntityProvider",
  register(env) {
    let userTransformer;
    let groupTransformer;
    env.registerExtensionPoint(ldapOrgEntityProviderTransformsExtensionPoint, {
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
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          LdapOrgEntityProvider.fromConfig(config, {
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

index_cjs.LDAP_DN_ANNOTATION = LDAP_DN_ANNOTATION;
index_cjs.LDAP_RDN_ANNOTATION = LDAP_RDN_ANNOTATION;
index_cjs.LDAP_UUID_ANNOTATION = LDAP_UUID_ANNOTATION;
index_cjs.LdapClient = LdapClient;
index_cjs.LdapOrgEntityProvider = LdapOrgEntityProvider;
index_cjs.LdapOrgReaderProcessor = LdapOrgReaderProcessor;
var _default = index_cjs.default = catalogModuleLdapOrgEntityProvider;
index_cjs.defaultGroupTransformer = defaultGroupTransformer;
index_cjs.defaultUserTransformer = defaultUserTransformer;
index_cjs.ldapOrgEntityProviderTransformsExtensionPoint = ldapOrgEntityProviderTransformsExtensionPoint;
index_cjs.mapStringAttr = mapStringAttr;
index_cjs.readLdapLegacyConfig = readLdapLegacyConfig;
index_cjs.readLdapOrg = readLdapOrg;
index_cjs.readProviderConfigs = readProviderConfigs;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
