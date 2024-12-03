'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var mergeWith = require('lodash/mergeWith');
var lodash = require('lodash');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var mergeWith__default = /*#__PURE__*/_interopDefaultCompat(mergeWith);

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
function readVendorConfig(c) {
  if (!c) {
    return void 0;
  }
  return {
    dnAttributeName: c.getOptionalString("dnAttributeName"),
    uuidAttributeName: c.getOptionalString("uuidAttributeName")
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
      }),
      vendor: readVendorConfig(c.getOptionalConfig("vendor"))
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
      schedule,
      vendor: readVendorConfig(c.getOptionalConfig("vendor"))
    };
    return freeze(newConfig);
  });
}
function replaceArraysIfPresent(_into, from) {
  return Array.isArray(from) ? from : void 0;
}

exports.readLdapLegacyConfig = readLdapLegacyConfig;
exports.readProviderConfigs = readProviderConfigs;
//# sourceMappingURL=config.cjs.js.map
