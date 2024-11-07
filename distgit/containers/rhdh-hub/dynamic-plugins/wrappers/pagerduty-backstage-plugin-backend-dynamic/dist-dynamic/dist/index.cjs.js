'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('node-fetch');
var require$$3 = require('luxon');
var require$$4 = require('express');
var require$$5 = require('express-promise-router');
var require$$6 = require('@backstage/backend-plugin-api');
var require$$7 = require('uuid');
var require$$8 = require('@backstage/catalog-client');

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

var index_cjs = {};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class HttpError extends Error {
  constructor(message, status) {
    super(message);
    __publicField(this, "status");
    this.status = status;
  }
}

const PAGERDUTY_INTEGRATION_KEY = "pagerduty.com/integration-key";
const PAGERDUTY_SERVICE_ID = "pagerduty.com/service-id";

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	HttpError: HttpError,
	PAGERDUTY_INTEGRATION_KEY: PAGERDUTY_INTEGRATION_KEY,
	PAGERDUTY_SERVICE_ID: PAGERDUTY_SERVICE_ID
});

var require$$2 = /*@__PURE__*/getAugmentedNamespace(index_esm);

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendCommon = require$$0;
var fetch$1 = require$$1;
var backstagePluginCommon = require$$2;
var luxon = require$$3;
var express = require$$4;
var Router = require$$5;
var backendPluginApi = require$$6;
var uuid = require$$7;
var catalogClient = require$$8;

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

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch$1);
var express__namespace = /*#__PURE__*/_interopNamespaceCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

let authPersistence;
let isLegacyConfig$1 = false;
async function getAuthToken(accountId) {
  if (!authPersistence?.accountTokens) {
    await loadAuthConfig(authPersistence.config, authPersistence.logger);
  }
  if (isLegacyConfig$1) {
    if (authPersistence.accountTokens.default.authToken !== "" && authPersistence.accountTokens.default.authToken.includes("Bearer") && authPersistence.accountTokens.default.authTokenExpiryDate > Date.now() || authPersistence.accountTokens.default.authToken !== "" && authPersistence.accountTokens.default.authToken.includes("Token")) {
      return authPersistence.accountTokens.default.authToken;
    }
  } else {
    if (accountId && accountId !== "") {
      if (authPersistence.accountTokens[accountId].authToken !== "" && authPersistence.accountTokens[accountId].authToken.includes("Bearer") && authPersistence.accountTokens[accountId].authTokenExpiryDate > Date.now() || authPersistence.accountTokens[accountId].authToken !== "" && authPersistence.accountTokens[accountId].authToken.includes("Token")) {
        return authPersistence.accountTokens[accountId].authToken;
      }
    } else {
      const defaultFallback = authPersistence.defaultAccount ?? "";
      if (authPersistence.accountTokens[defaultFallback].authToken !== "" && authPersistence.accountTokens[defaultFallback].authToken.includes("Bearer") && authPersistence.accountTokens[defaultFallback].authTokenExpiryDate > Date.now() || authPersistence.accountTokens[defaultFallback].authToken !== "" && authPersistence.accountTokens[defaultFallback].authToken.includes("Token")) {
        return authPersistence.accountTokens[defaultFallback].authToken;
      }
    }
  }
  return "";
}
async function loadAuthConfig(config, logger) {
  try {
    const defaultAccountId = "default";
    authPersistence = {
      config,
      logger,
      accountTokens: {}
    };
    if (!config.getOptional("pagerDuty.accounts")) {
      isLegacyConfig$1 = true;
      logger.warn("No PagerDuty accounts configuration found in config file. Reverting to legacy configuration.");
      if (!config.getOptionalString("pagerDuty.apiToken")) {
        logger.warn("No PagerDuty API token found in config file. Trying OAuth token instead...");
        if (!config.getOptional("pagerDuty.oauth")) {
          logger.error("No PagerDuty OAuth configuration found in config file.");
        } else if (!config.getOptionalString("pagerDuty.oauth.clientId") || !config.getOptionalString("pagerDuty.oauth.clientSecret") || !config.getOptionalString("pagerDuty.oauth.subDomain")) {
          logger.error("Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.");
        } else {
          const tokenInfo = await getOAuthToken(
            config.getString("pagerDuty.oauth.clientId"),
            config.getString("pagerDuty.oauth.clientSecret"),
            config.getString("pagerDuty.oauth.subDomain"),
            config.getOptionalString("pagerDuty.oauth.region") ?? "us"
          );
          authPersistence.accountTokens[defaultAccountId] = tokenInfo;
          logger.info("PagerDuty OAuth configuration loaded successfully.");
        }
      } else {
        authPersistence.accountTokens[defaultAccountId] = {
          authToken: `Token token=${config.getString("pagerDuty.apiToken")}`,
          authTokenExpiryDate: Date.now() + 36e5 * 24 * 365 * 2
          // 2 years
        };
        logger.info("PagerDuty API token loaded successfully.");
      }
    } else {
      logger.info("New PagerDuty accounts configuration found in config file.");
      isLegacyConfig$1 = false;
      const accounts = config.getOptional("pagerDuty.accounts");
      if (accounts && accounts?.length === 1) {
        logger.info("Only one account found in config file. Setting it as default.");
        authPersistence.defaultAccount = accounts[0].id;
      }
      accounts?.forEach(async (account) => {
        const maskedAccountId = maskString(account.id);
        if (account.isDefault && !authPersistence.defaultAccount) {
          logger.info(`Default account found in config file. Setting it as default.`);
          authPersistence.defaultAccount = account.id;
        }
        if (!account.apiToken) {
          logger.warn("No PagerDuty API token found in config file. Trying OAuth token instead...");
          if (!account.oauth) {
            logger.error("No PagerDuty OAuth configuration found in config file.");
          } else if (!account.oauth.clientId || !account.oauth.clientSecret || !account.oauth.subDomain) {
            logger.error("Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.");
          } else {
            const tokenInfo = await getOAuthToken(
              account.oauth.clientId,
              account.oauth.clientSecret,
              account.oauth.subDomain,
              account.oauth.region ?? "us"
            );
            authPersistence.accountTokens[account.id] = tokenInfo;
            logger.info(`PagerDuty OAuth configuration loaded successfully for account ${maskedAccountId}.`);
          }
        } else {
          authPersistence.accountTokens[account.id] = {
            authToken: `Token token=${account.apiToken}`,
            authTokenExpiryDate: Date.now() + 36e5 * 24 * 365 * 2
            // 2 years
          };
          logger.info(`PagerDuty API token loaded successfully for account ${maskedAccountId}.`);
        }
      });
      if (!authPersistence.defaultAccount) {
        logger.error("No default account found in config file. One account must be marked as default.");
      }
    }
  } catch (error) {
    logger.error(`Unable to retrieve valid PagerDuty AUTH configuration from config file: ${error}`);
  }
}
async function getOAuthToken(clientId, clientSecret, subDomain, region) {
  if (!clientId || !clientSecret || !subDomain) {
    throw new Error("Missing required PagerDuty OAuth parameters.");
  }
  const scopes = `
        abilities.read 
        analytics.read
        change_events.read 
        escalation_policies.read 
        incidents.read 
        oncalls.read 
        schedules.read 
        services.read 
        services.write 
        standards.read
        teams.read 
        users.read 
        vendors.read
    `;
  const urlencoded = new URLSearchParams();
  urlencoded.append("grant_type", "client_credentials");
  urlencoded.append("client_id", clientId);
  urlencoded.append("client_secret", clientSecret);
  urlencoded.append("scope", `as_account-${region}.${subDomain} ${scopes}`);
  let response;
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: urlencoded
  };
  const baseUrl = "https://identity.pagerduty.com/oauth/token";
  try {
    response = await fetch(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve oauth token: ${error}`);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to retrieve valid token. Bad Request - Invalid arguments provided.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to retrieve valid token. Forbidden - Invalid credentials provided.", 401);
  }
  const authResponse = await response.json();
  const result = {
    authToken: `Bearer ${authResponse.access_token}`,
    authTokenExpiryDate: Date.now() + authResponse.expires_in * 1e3
  };
  return result;
}
function maskString(str) {
  return str[0] + "*".repeat(str.length - 2) + str.slice(-1);
}

const EndpointConfig = {};
let fallbackEndpointConfig;
let isLegacyConfig = false;
function setFallbackEndpointConfig(account) {
  fallbackEndpointConfig = {
    eventsBaseUrl: account.eventsBaseUrl ?? "https://events.pagerduty.com/v2",
    apiBaseUrl: account.apiBaseUrl ?? "https://api.pagerduty.com"
  };
}
function insertEndpointConfig(account) {
  EndpointConfig[account.id] = {
    eventsBaseUrl: account.eventsBaseUrl ?? "https://events.pagerduty.com/v2",
    apiBaseUrl: account.apiBaseUrl ?? "https://api.pagerduty.com"
  };
}
function loadPagerDutyEndpointsFromConfig(config, logger) {
  if (config.getOptional("pagerDuty.accounts")) {
    logger.debug(`New accounts configuration detected. Loading PagerDuty endpoints from config.`);
    isLegacyConfig = false;
    const accounts = config.getOptional("pagerDuty.accounts");
    if (accounts?.length === 1) {
      logger.debug(`Single account configuration detected. Loading PagerDuty endpoints from config to 'default'.`);
      EndpointConfig.default = {
        eventsBaseUrl: accounts[0].eventsBaseUrl !== void 0 ? accounts[0].eventsBaseUrl : "https://events.pagerduty.com/v2",
        apiBaseUrl: accounts[0].apiBaseUrl !== void 0 ? accounts[0].apiBaseUrl : "https://api.pagerduty.com"
      };
    } else {
      logger.debug(`Multiple account configuration detected. Loading PagerDuty endpoints from config.`);
      accounts?.forEach((account) => {
        if (account.isDefault) {
          setFallbackEndpointConfig(account);
        }
        insertEndpointConfig(account);
      });
    }
  } else {
    logger.debug(`Loading legacy PagerDuty endpoints from config.`);
    isLegacyConfig = true;
    EndpointConfig.default = {
      eventsBaseUrl: config.getOptionalString("pagerDuty.eventsBaseUrl") !== void 0 ? config.getString("pagerDuty.eventsBaseUrl") : "https://events.pagerduty.com/v2",
      apiBaseUrl: config.getOptionalString("pagerDuty.apiBaseUrl") !== void 0 ? config.getString("pagerDuty.apiBaseUrl") : "https://api.pagerduty.com"
    };
  }
}
function getApiBaseUrl(account) {
  if (isLegacyConfig === true) {
    return EndpointConfig.default.apiBaseUrl;
  }
  if (account) {
    return EndpointConfig[account].apiBaseUrl;
  }
  return fallbackEndpointConfig.apiBaseUrl;
}
async function addServiceRelationsToService(serviceRelations, account) {
  let response;
  const options = {
    method: "POST",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      relationships: serviceRelations
    })
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/associate`;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service dependencies: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to add service dependencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to add service dependencies. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to add service dependencies. Caller did not supply credentials or did not provide the correct credentials. If you are using an API key, it may be invalid or your Authorization header may be malformed.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to add service dependencies. Caller is not authorized to view the requested resource. While your authentication is valid, the authenticated user or token does not have permission to perform this action.", 403);
    case 404:
      throw new backstagePluginCommon.HttpError("Failed to add service dependencies. The requested resource was not found.", 404);
  }
  let result;
  try {
    result = await response.json();
    return result.relationships;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service dependency information: ${error}`, 500);
  }
}
async function removeServiceRelationsFromService(serviceRelations, account) {
  let response;
  const options = {
    method: "POST",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      relationships: serviceRelations
    })
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/disassociate`;
  try {
    response = await fetchWithRetries(`${baseUrl}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service dependencies: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to remove service dependencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to remove service dependencies. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to remove service dependencies. Caller did not supply credentials or did not provide the correct credentials. If you are using an API key, it may be invalid or your Authorization header may be malformed.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to remove service dependencies. Caller is not authorized to view the requested resource. While your authentication is valid, the authenticated user or token does not have permission to perform this action.", 403);
    case 404:
      throw new backstagePluginCommon.HttpError("Failed to remove service dependencies. The requested resource was not found.", 404);
  }
  let result;
  try {
    result = await response.json();
    return result.relationships;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service dependency information: ${error}`, 500);
  }
}
async function getServiceRelationshipsById(serviceId, account) {
  let response;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/service_dependencies/technical_services/${serviceId}`;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service dependencies: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to list service dependencies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to list service dependencies. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to list service dependencies. Caller did not supply credentials or did not provide the correct credentials. If you are using an API key, it may be invalid or your Authorization header may be malformed.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to list service dependencies. Caller is not authorized to view the requested resource. While your authentication is valid, the authenticated user or token does not have permission to perform this action.", 403);
    case 404:
      throw new backstagePluginCommon.HttpError("Failed to list service dependencies. The requested resource was not found.", 404);
  }
  let result;
  try {
    result = await response.json();
    return result.relationships;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service dependency information: ${error}`, 500);
  }
}
async function getEscalationPolicies(offset, limit, account) {
  let response;
  const params = `total=true&sort_by=name&offset=${offset}&limit=${limit}`;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/escalation_policies`;
  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve escalation policies: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to list escalation policies. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to list escalation policies. Caller provided invalid arguments.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to list escalation policies. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to list escalation policies. Caller is not authorized to view the requested resource.", 403);
    case 429:
      throw new backstagePluginCommon.HttpError("Failed to list escalation policies. Rate limit exceeded.", 429);
  }
  let result;
  try {
    result = await response.json();
    return [result.more ?? false, result.escalation_policies];
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse escalation policy information: ${error}`, 500);
  }
}
async function getAllEscalationPolicies() {
  const limit = 50;
  let offset = 0;
  let moreResults = false;
  let results = [];
  await Promise.all(
    Object.keys(EndpointConfig).map(async (account) => {
      try {
        offset = 0;
        do {
          const res = await getEscalationPolicies(offset, limit, account);
          res[1].forEach((policy) => {
            policy.account = account;
          });
          results = results.concat(res[1]);
          if (res[0] === true) {
            moreResults = true;
            offset += limit;
          } else {
            moreResults = false;
          }
        } while (moreResults === true);
      } catch (error) {
        if (error instanceof backstagePluginCommon.HttpError) {
          throw error;
        } else {
          throw new backstagePluginCommon.HttpError(`${error}`, 500);
        }
      }
    })
  );
  return results;
}
async function getOncallUsers(escalationPolicy, account) {
  let response;
  const params = `time_zone=UTC&include[]=users&escalation_policy_ids[]=${escalationPolicy}`;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/oncalls`;
  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve oncalls: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to list oncalls. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to list oncalls. Caller provided invalid arguments.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to list oncalls. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to list oncalls. Caller is not authorized to view the requested resource.", 403);
    case 429:
      throw new backstagePluginCommon.HttpError("Failed to list oncalls. Rate limit exceeded.", 429);
  }
  let result;
  let usersItem;
  try {
    result = await response.json();
    if (result.oncalls.length !== 0) {
      const oncallsSorted = [...result.oncalls].sort((a, b) => {
        return a.escalation_level - b.escalation_level;
      });
      const oncallsFiltered = oncallsSorted.filter((oncall) => {
        return oncall.escalation_level === oncallsSorted[0].escalation_level;
      });
      usersItem = [...oncallsFiltered].sort((a, b) => a.user.name > b.user.name ? 1 : -1).map((oncall) => oncall.user);
      const uniqueUsers = /* @__PURE__ */ new Map();
      usersItem.forEach((user) => {
        uniqueUsers.set(user.id, user);
      });
      usersItem.length = 0;
      uniqueUsers.forEach((user) => {
        usersItem.push(user);
      });
      return usersItem;
    }
    return [];
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse oncall information: ${error}`, 500);
  }
}
async function getServiceById(serviceId, account) {
  let response;
  const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies`;
  const token = await getAuthToken(account);
  const options = {
    method: "GET",
    headers: {
      Authorization: token,
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;
  try {
    response = await fetchWithRetries(`${baseUrl}/${serviceId}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to get service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to get service. Caller provided invalid arguments.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to get service. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to get service. Caller is not authorized to view the requested resource.", 403);
    case 404:
      throw new backstagePluginCommon.HttpError("Failed to get service. The requested resource was not found.", 404);
  }
  let result;
  try {
    result = await response.json();
    return result.service;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service information: ${error}`, 500);
  }
}
async function getServiceByIntegrationKey(integrationKey, account) {
  let response;
  const params = `query=${integrationKey}&time_zone=UTC&include[]=integrations&include[]=escalation_policies`;
  const token = await getAuthToken(account);
  const options = {
    method: "GET",
    headers: {
      Authorization: token,
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;
  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to get service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to get service. Caller provided invalid arguments.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to get service. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to get service. Caller is not authorized to view the requested resource.", 403);
    case 404:
      throw new backstagePluginCommon.HttpError("Failed to get service. The requested resource was not found.", 404);
  }
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service information: ${error}`, 500);
  }
  if (result.services.length === 0) {
    throw new backstagePluginCommon.HttpError(`Failed to get service. The requested resource was not found.`, 404);
  }
  return result.services[0];
}
async function getAllServices() {
  const allServices = [];
  await Promise.all(
    Object.entries(EndpointConfig).map(async ([account, _]) => {
      let response;
      const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies&include[]=teams&total=true`;
      const token = await getAuthToken(account);
      const options = {
        method: "GET",
        headers: {
          Authorization: token,
          "Accept": "application/vnd.pagerduty+json;version=2",
          "Content-Type": "application/json"
        }
      };
      const apiBaseUrl = getApiBaseUrl(account);
      const baseUrl = `${apiBaseUrl}/services`;
      let offset = 0;
      const limit = 50;
      let result;
      try {
        do {
          const paginatedUrl = `${baseUrl}?${params}&offset=${offset}&limit=${limit}`;
          response = await fetchWithRetries(paginatedUrl, options);
          if (response.status >= 500) {
            throw new backstagePluginCommon.HttpError(`Failed to get services. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
          }
          switch (response.status) {
            case 400:
              throw new backstagePluginCommon.HttpError("Failed to get services. Caller provided invalid arguments.", 400);
            case 401:
              throw new backstagePluginCommon.HttpError("Failed to get services. Caller did not supply credentials or did not provide the correct credentials.", 401);
            case 403:
              throw new backstagePluginCommon.HttpError("Failed to get services. Caller is not authorized to view the requested resource.", 403);
            default:
              break;
          }
          result = await response.json();
          result.services.forEach((service) => {
            service.account = account;
          });
          allServices.push(...result.services);
          offset += limit;
        } while (offset < result.total);
      } catch (error) {
        throw error;
      }
    })
  );
  return allServices;
}
async function getChangeEvents(serviceId, account) {
  let response;
  const params = `limit=5&time_zone=UTC&sort_by=timestamp`;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;
  try {
    response = await fetchWithRetries(`${baseUrl}/${serviceId}/change_events?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve change events for service: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to get change events for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to get change events for service. Caller provided invalid arguments.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to get change events for service. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to get change events for service. Caller is not authorized to view the requested resource.", 403);
    case 404:
      throw new backstagePluginCommon.HttpError("Failed to get change events for service. The requested resource was not found.", 404);
  }
  let result;
  try {
    result = await response.json();
    return result.change_events;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse change events information: ${error}`, 500);
  }
}
async function getIncidents(serviceId, account) {
  let response;
  const params = `time_zone=UTC&sort_by=created_at&statuses[]=triggered&statuses[]=acknowledged&service_ids[]=${serviceId}`;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/incidents`;
  try {
    response = await fetchWithRetries(`${baseUrl}?${params}`, options);
  } catch (error) {
    throw new Error(`Failed to retrieve incidents for service: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to get incidents for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to get incidents for service. Caller provided invalid arguments.", 400);
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to get incidents for service. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 402:
      throw new backstagePluginCommon.HttpError("Failed to get incidents for service. Account does not have the abilities to perform the action. Please review the response for the required abilities.", 402);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to get incidents for service. Caller is not authorized to view the requested resource.", 403);
    case 429:
      throw new backstagePluginCommon.HttpError("Failed to get incidents for service. Too many requests have been made, the rate limit has been reached.", 429);
  }
  let result;
  try {
    result = await response.json();
    return result.incidents;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse incidents information: ${error}`, 500);
  }
}
async function getServiceStandards(serviceId, account) {
  let response;
  const options = {
    method: "GET",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/standards/scores/technical_services/${serviceId}`;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service standards for service: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to get service standards for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 401:
      throw new backstagePluginCommon.HttpError("Failed to get service standards for service. Caller did not supply credentials or did not provide the correct credentials.", 401);
    case 403:
      throw new backstagePluginCommon.HttpError("Failed to get service standards for service. Caller is not authorized to view the requested resource.", 403);
    case 429:
      throw new backstagePluginCommon.HttpError("Failed to get service standards for service. Too many requests have been made, the rate limit has been reached.", 429);
  }
  try {
    const result = await response.json();
    return result;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service standards information: ${error}`, 500);
  }
}
async function getServiceMetrics(serviceId, account) {
  let response;
  const endDate = luxon.DateTime.now();
  const startDate = endDate.minus({ days: 30 });
  const body = JSON.stringify({
    filters: {
      created_at_start: startDate.toISO(),
      created_at_end: endDate.toISO(),
      service_ids: [
        serviceId
      ]
    }
  });
  const options = {
    method: "POST",
    headers: {
      Authorization: await getAuthToken(account),
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    },
    body
  };
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/analytics/metrics/incidents/services`;
  try {
    response = await fetchWithRetries(baseUrl, options);
  } catch (error) {
    throw new Error(`Failed to retrieve service metrics for service: ${error}`);
  }
  if (response.status >= 500) {
    throw new backstagePluginCommon.HttpError(`Failed to get service metrics for service. PagerDuty API returned a server error. Retrying with the same arguments will not work.`, response.status);
  }
  switch (response.status) {
    case 400:
      throw new backstagePluginCommon.HttpError("Failed to get service metrics for service. Caller provided invalid arguments. Please review the response for error details. Retrying with the same arguments will not work.", 400);
    case 429:
      throw new backstagePluginCommon.HttpError("Failed to get service metrics for service. Too many requests have been made, the rate limit has been reached.", 429);
  }
  try {
    const result = await response.json();
    return result.data;
  } catch (error) {
    throw new backstagePluginCommon.HttpError(`Failed to parse service metrics information: ${error}`, 500);
  }
}
async function createServiceIntegration({ serviceId, vendorId, account }) {
  let response;
  const apiBaseUrl = getApiBaseUrl(account);
  const baseUrl = `${apiBaseUrl}/services`;
  const token = await getAuthToken(account);
  const options = {
    method: "POST",
    body: JSON.stringify({
      integration: {
        name: "Backstage",
        service: {
          id: serviceId,
          type: "service_reference"
        },
        vendor: {
          id: vendorId,
          type: "vendor_reference"
        }
      }
    }),
    headers: {
      Authorization: token,
      "Accept": "application/vnd.pagerduty+json;version=2",
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetchWithRetries(`${baseUrl}/${serviceId}/integrations`, options);
  } catch (error) {
    throw new Error(`Failed to create service integration: ${error}`);
  }
  if (response.status >= 500) {
    throw new Error(`Failed to create service integration. PagerDuty API returned a server error. Retrying with the same arguments will not work.`);
  }
  switch (response.status) {
    case 400:
      throw new Error(`Failed to create service integration. Caller provided invalid arguments.`);
    case 401:
      throw new Error(`Failed to create service integration. Caller did not supply credentials or did not provide the correct credentials.`);
    case 403:
      throw new Error(`Failed to create service integration. Caller is not authorized to view the requested resource.`);
    case 429:
      throw new Error(`Failed to create service integration. Rate limit exceeded.`);
  }
  let result;
  try {
    result = await response.json();
    return result.integration.integration_key ?? "";
  } catch (error) {
    throw new Error(`Failed to parse service information: ${error}`);
  }
}
async function fetchWithRetries(url, options) {
  let response;
  let error = new Error();
  const maxRetries = 5;
  const delay = 1e3;
  let factor = 2;
  for (let i = 0; i < maxRetries; i++) {
    try {
      response = await fetch__default.default(url, options);
      return response;
    } catch (e) {
      error = e;
    }
    const timeout = delay * factor;
    await new Promise((resolve) => setTimeout(resolve, timeout));
    factor *= 2;
  }
  throw new Error(`Failed to fetch data after ${maxRetries} retries. Last error: ${error}`);
}

async function createComponentEntitiesReferenceDict({ items: componentEntities }) {
  const componentEntitiesDict = {};
  await Promise.all(componentEntities.map(async (entity) => {
    const serviceId = entity.metadata.annotations?.["pagerduty.com/service-id"];
    const integrationKey = entity.metadata.annotations?.["pagerduty.com/integration-key"];
    const account = entity.metadata.annotations?.["pagerduty.com/account"];
    if (serviceId !== void 0 && serviceId !== "") {
      componentEntitiesDict[serviceId] = {
        ref: `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase(),
        name: entity.metadata.name
      };
    } else if (integrationKey !== void 0 && integrationKey !== "") {
      const service = await getServiceByIntegrationKey(integrationKey, account).catch(() => void 0);
      if (service !== void 0) {
        componentEntitiesDict[service.id] = {
          ref: `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase(),
          name: entity.metadata.name
        };
      }
    }
  }));
  return componentEntitiesDict;
}
async function buildEntityMappingsResponse(entityMappings, componentEntitiesDict, componentEntities, pagerDutyServices) {
  const result = {
    mappings: []
  };
  pagerDutyServices.forEach((service) => {
    const entityRef = componentEntitiesDict[service.id]?.ref;
    const entityName = componentEntitiesDict[service.id]?.name;
    const entityMapping = entityMappings.find((mapping) => mapping.serviceId === service.id);
    if (entityMapping) {
      if (entityRef === void 0) {
        if (entityMapping.entityRef === "" || entityMapping.entityRef === void 0) {
          result.mappings.push({
            entityRef: "",
            entityName: "",
            integrationKey: entityMapping.integrationKey,
            serviceId: entityMapping.serviceId,
            status: "NotMapped",
            serviceName: service.name,
            team: service.teams?.[0]?.name ?? "",
            escalationPolicy: service.escalation_policy !== void 0 ? service.escalation_policy.name : "",
            serviceUrl: service.html_url,
            account: service.account
          });
        } else {
          const entityRefName = componentEntities.items.find((entity) => `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase() === entityMapping.entityRef)?.metadata.name ?? "";
          result.mappings.push({
            entityRef: entityMapping.entityRef,
            entityName: entityRefName,
            serviceId: entityMapping.serviceId,
            integrationKey: entityMapping.integrationKey,
            status: "OutOfSync",
            serviceName: service.name,
            team: service.teams?.[0]?.name ?? "",
            escalationPolicy: service.escalation_policy !== void 0 ? service.escalation_policy.name : "",
            serviceUrl: service.html_url,
            account: service.account
          });
        }
      } else if (entityRef !== entityMapping.entityRef) {
        const entityRefName = componentEntities.items.find((entity) => `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`.toLowerCase() === entityMapping.entityRef)?.metadata.name ?? "";
        result.mappings.push({
          entityRef: entityMapping.entityRef !== "" ? entityMapping.entityRef : "",
          entityName: entityMapping.entityRef !== "" ? entityRefName : "",
          serviceId: entityMapping.serviceId,
          integrationKey: entityMapping.integrationKey,
          status: "OutOfSync",
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? "",
          escalationPolicy: service.escalation_policy !== void 0 ? service.escalation_policy.name : "",
          serviceUrl: service.html_url,
          account: service.account
        });
      } else if (entityRef === entityMapping.entityRef) {
        result.mappings.push({
          entityRef: entityMapping.entityRef !== "" ? entityMapping.entityRef : "",
          entityName: entityMapping.entityRef !== "" ? entityName : "",
          serviceId: entityMapping.serviceId,
          integrationKey: entityMapping.integrationKey,
          status: "InSync",
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? "",
          escalationPolicy: service.escalation_policy !== void 0 ? service.escalation_policy.name : "",
          serviceUrl: service.html_url,
          account: service.account
        });
      }
    } else {
      const backstageVendorId = "PRO19CT";
      const backstageIntegrationKey = service.integrations?.find((integration) => integration.vendor?.id === backstageVendorId)?.integration_key ?? "";
      if (entityRef !== void 0) {
        result.mappings.push({
          entityRef,
          entityName,
          serviceId: service.id,
          integrationKey: backstageIntegrationKey,
          status: "InSync",
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? "",
          escalationPolicy: service.escalation_policy !== void 0 ? service.escalation_policy.name : "",
          serviceUrl: service.html_url,
          account: service.account
        });
      } else {
        result.mappings.push({
          entityRef: "",
          entityName: "",
          serviceId: service.id,
          integrationKey: backstageIntegrationKey,
          status: "NotMapped",
          serviceName: service.name,
          team: service.teams?.[0]?.name ?? "",
          escalationPolicy: service.escalation_policy !== void 0 ? service.escalation_policy.name : "",
          serviceUrl: service.html_url,
          account: service.account
        });
      }
    }
  });
  const sortedResult = result.mappings.sort((a, b) => {
    if (a.serviceName < b.serviceName) {
      return -1;
    } else if (a.serviceName > b.serviceName) {
      return 1;
    }
    return 0;
  });
  result.mappings = sortedResult;
  return result;
}
async function createRouter(options) {
  const { logger, config, store, catalogApi } = options;
  let { auth } = options;
  if (!auth) {
    auth = backendCommon.createLegacyAuthAdapters(options).auth;
  }
  await loadAuthConfig(config, logger);
  loadPagerDutyEndpointsFromConfig(config, logger);
  const router = Router__default.default();
  router.use(express__namespace.json());
  router.delete("/dependencies/service/:serviceId", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      if (serviceId === "") {
        response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path");
        return;
      }
      const dependencies = Object.keys(request.body).length === 0 ? [] : request.body;
      if (!dependencies || dependencies.length === 0) {
        response.status(400).json("Bad Request: 'dependencies' must be provided as part of the request body");
        return;
      }
      const serviceRelations = [];
      dependencies.forEach(async (dependency) => {
        serviceRelations.push({
          supporting_service: {
            id: dependency,
            type: "service"
          },
          dependent_service: {
            id: serviceId,
            type: "service"
          }
        });
      });
      await removeServiceRelationsFromService(serviceRelations, account);
      response.sendStatus(200);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        logger.error(`Error occurred while processing request: ${error.message}`);
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.post("/dependencies/service/:serviceId", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      if (serviceId === "") {
        response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path");
        return;
      }
      const dependencies = Object.keys(request.body).length === 0 ? [] : request.body;
      if (!dependencies || dependencies.length === 0) {
        response.status(400).json("Bad Request: 'dependencies' must be provided as part of the request body");
        return;
      }
      const serviceRelations = [];
      dependencies.forEach(async (dependency) => {
        serviceRelations.push({
          supporting_service: {
            id: dependency,
            type: "service"
          },
          dependent_service: {
            id: serviceId,
            type: "service"
          }
        });
      });
      await addServiceRelationsToService(serviceRelations, account);
      response.sendStatus(200);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        logger.error(`Error occurred while processing request: ${error.message}`);
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/dependencies/service/:serviceId", async (request, response) => {
    try {
      const serviceId = request.params.serviceId;
      const account = request.query.account || "";
      if (serviceId) {
        const serviceRelationships = await getServiceRelationshipsById(serviceId, account);
        if (serviceRelationships) {
          response.json({
            relationships: serviceRelationships
          });
        }
      } else {
        response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path");
      }
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/catalog/entity/:type/:namespace/:name", async (request, response) => {
    const type = request.params.type;
    const namespace = request.params.namespace;
    const name = request.params.name;
    try {
      if (type && namespace && name) {
        const entityRef = `${type}:${namespace}/${name}`.toLowerCase();
        const foundEntity = await catalogApi?.getEntityByRef(entityRef);
        if (foundEntity) {
          response.json(foundEntity.metadata.annotations?.["pagerduty.com/service-id"]);
        } else {
          response.status(404);
        }
      } else {
        response.status(400).json("Bad Request: ':entityRef' must be provided as part of the path");
      }
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.post("/settings", async (request, response) => {
    try {
      const settings = request.body;
      await Promise.all(settings.map(async (setting) => {
        if (setting.id === void 0 || setting.value === void 0) {
          response.status(400).json("Bad Request: 'id' and 'value' are required");
          return;
        }
        if (!isValidSetting(setting.value)) {
          response.status(400).json("Bad Request: 'value' is invalid. Valid options are 'backstage', 'pagerduty', 'both' or 'disabled'");
          return;
        }
        await store.updateSetting(setting);
      }));
      response.sendStatus(200);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        logger.error(`Error occurred while processing request: ${error.message}`);
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/settings/:settingId", async (request, response) => {
    try {
      const settingId = request.params.settingId;
      const setting = await store.findSetting(settingId);
      if (!setting) {
        response.status(404).json({});
        return;
      }
      response.json(setting);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  function isValidSetting(value) {
    if (value === "backstage" || value === "pagerduty" || value === "both" || value === "disabled") {
      return true;
    }
    return false;
  }
  router.post("/mapping/entity", async (request, response) => {
    try {
      const entity = request.body;
      if (!entity.serviceId) {
        response.status(400).json("Bad Request: 'serviceId' must be provided as part of the request body");
        return;
      }
      const entityMappings = await store.getAllEntityMappings();
      const oldMapping = entityMappings.find((mapping) => mapping.serviceId === entity.serviceId);
      if (entity.entityRef !== "" && (entity.integrationKey === "" || entity.integrationKey === void 0)) {
        const backstageVendorId = "PRO19CT";
        const service = await getServiceById(entity.serviceId, entity.account);
        const backstageIntegration = service.integrations?.find((integration) => integration.vendor?.id === backstageVendorId);
        if (!backstageIntegration) {
          const integrationKey = await createServiceIntegration({
            serviceId: entity.serviceId,
            vendorId: backstageVendorId,
            account: entity.account
          });
          entity.integrationKey = integrationKey;
        } else {
          entity.integrationKey = backstageIntegration.integration_key;
        }
      }
      const entityMappingId = await store.insertEntityMapping(entity);
      if (entity.entityRef !== "") {
        await catalogApi?.refreshEntity(entity.entityRef);
      }
      if (oldMapping && oldMapping.entityRef !== "") {
        await catalogApi?.refreshEntity(oldMapping.entityRef);
      }
      response.json({
        id: entityMappingId,
        entityRef: entity.entityRef,
        integrationKey: entity.integrationKey,
        serviceId: entity.serviceId,
        status: entity.status,
        account: entity.account
      });
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        logger.error(`Error occurred while processing request: ${error.message}`);
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/mapping/entity", async (_, response) => {
    try {
      const entityMappings = await store.getAllEntityMappings();
      const componentEntities = await catalogApi.getEntities({
        filter: {
          kind: "Component"
        }
      });
      const componentEntitiesDict = await createComponentEntitiesReferenceDict(componentEntities);
      const pagerDutyServices = await getAllServices();
      const result = await buildEntityMappingsResponse(entityMappings, componentEntitiesDict, componentEntities, pagerDutyServices);
      response.json(result);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/mapping/entity/:type/:namespace/:name", async (request, response) => {
    try {
      const entityType = request.params.type || "";
      const entityNamespace = request.params.namespace || "";
      const entityName = request.params.name || "";
      if (entityType === "" || entityNamespace === "" || entityName === "") {
        response.status(400).json("Required params not specified.");
        return;
      }
      const entityRef = `${entityType}:${entityNamespace}/${entityName}`.toLowerCase();
      const entityMapping = await store.findEntityMappingByEntityRef(entityRef);
      if (!entityMapping) {
        response.status(404).json(`Mapping for entityRef ${entityRef} not found.`);
        return;
      }
      response.json({
        mapping: entityMapping
      });
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/mapping/entity/service/:serviceId", async (request, response) => {
    try {
      const serviceId = request.params.serviceId ?? "";
      if (serviceId === "") {
        response.status(400).json("Required params not specified.");
        return;
      }
      const entityMapping = await store.findEntityMappingByServiceId(serviceId);
      if (!entityMapping) {
        response.status(404).json(`Mapping for serviceId ${serviceId} not found.`);
        return;
      }
      response.json({
        mapping: entityMapping
      });
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/escalation_policies", async (_, response) => {
    try {
      let escalationPolicyList = await getAllEscalationPolicies();
      escalationPolicyList = escalationPolicyList.sort((a, b) => {
        if (a.account === b.account) {
          return a.name.localeCompare(b.name);
        }
        return a.account.localeCompare(b.account);
      });
      const escalationPolicyDropDownOptions = escalationPolicyList.map((policy) => {
        let policyLabel = policy.name;
        if (policy.account && policy.account !== "default") {
          policyLabel = `(${policy.account}) ${policy.name}`;
        }
        return {
          label: policyLabel,
          value: policy.id
        };
      });
      response.json(escalationPolicyDropDownOptions);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/oncall-users", async (request, response) => {
    try {
      const escalationPolicyId = request.query.escalation_policy_ids || "";
      const account = request.query.account || "";
      if (escalationPolicyId === "") {
        response.status(400).json("Bad Request: 'escalation_policy_ids[]' is required");
        return;
      }
      const oncallUsers = await getOncallUsers(escalationPolicyId, account);
      const onCallUsersResponse = {
        users: oncallUsers
      };
      response.json(onCallUsersResponse);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/services/:serviceId", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      if (serviceId === "") {
        response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path or 'integration_key' as a query parameter");
        return;
      }
      const service = await getServiceById(serviceId, account);
      const serviceResponse = {
        service
      };
      response.json(serviceResponse);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/services", async (request, response) => {
    try {
      const integrationKey = request.query.integration_key || "";
      const account = request.query.account || "";
      if (integrationKey !== "") {
        const service = await getServiceByIntegrationKey(integrationKey, account);
        const serviceResponse = {
          service
        };
        response.json(serviceResponse);
      } else {
        const services = await getAllServices();
        const servicesResponse = {
          services
        };
        response.json(servicesResponse);
      }
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.post("/services/:serviceId/integration/:vendorId", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const vendorId = request.params.vendorId || "";
      const account = request.query.account || "";
      if (serviceId === "" || vendorId === "") {
        response.status(400).json("Bad Request: ':serviceId' and ':vendorId' must be provided as part of the path");
        return;
      }
      const integrationKey = await createServiceIntegration({
        serviceId,
        vendorId,
        account
      });
      response.json(integrationKey);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        logger.error(`Error occurred while processing request: ${error.message}`);
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/services/:serviceId/change-events", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      const changeEvents = await getChangeEvents(serviceId, account);
      const changeEventsResponse = {
        change_events: changeEvents
      };
      response.json(changeEventsResponse);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/services/:serviceId/incidents", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      const incidents = await getIncidents(serviceId, account);
      const incidentsResponse = {
        incidents
      };
      response.json(incidentsResponse);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/services/:serviceId/standards", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      const serviceStandards = await getServiceStandards(serviceId, account);
      const serviceStandardsResponse = {
        standards: serviceStandards
      };
      response.json(serviceStandardsResponse);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/services/:serviceId/metrics", async (request, response) => {
    try {
      const serviceId = request.params.serviceId || "";
      const account = request.query.account || "";
      const metrics = await getServiceMetrics(serviceId, account);
      const metricsResponse = {
        metrics
      };
      response.json(metricsResponse);
    } catch (error) {
      if (error instanceof backstagePluginCommon.HttpError) {
        response.status(error.status).json({
          errors: [
            `${error.message}`
          ]
        });
      }
    }
  });
  router.get("/health", async (_, response) => {
    response.status(200).json({ status: "ok" });
  });
  router.use(backendCommon.errorHandler());
  return router;
}

class PagerDutyBackendDatabase {
  constructor(db) {
    this.db = db;
  }
  static async create(knex, options) {
    if (options?.skipMigrations) {
      const migrationsDir = backendPluginApi.resolvePackagePath("@pagerduty/backstage-plugin-backend", "migrations");
      await knex.migrate.latest({
        directory: migrationsDir
      });
    }
    return new PagerDutyBackendDatabase(knex);
  }
  async insertEntityMapping(entity) {
    const entityMappingId = uuid.v4();
    const [result] = await this.db("pagerduty_entity_mapping").insert({
      id: entityMappingId,
      entityRef: entity.entityRef,
      serviceId: entity.serviceId,
      integrationKey: entity.integrationKey,
      account: entity.account,
      processedDate: /* @__PURE__ */ new Date()
    }).onConflict(["serviceId"]).merge(["entityRef", "integrationKey", "account", "processedDate"]).returning("id");
    return result.id;
  }
  async getAllEntityMappings() {
    const rawEntities = await this.db("pagerduty_entity_mapping");
    if (!rawEntities) {
      return [];
    }
    return rawEntities;
  }
  async findEntityMappingByEntityRef(entityRef) {
    const rawEntity = await this.db("pagerduty_entity_mapping").where("entityRef", entityRef).first();
    return rawEntity;
  }
  async findEntityMappingByServiceId(serviceId) {
    const rawEntity = await this.db("pagerduty_entity_mapping").where("serviceId", serviceId).first();
    return rawEntity;
  }
  async updateSetting(setting) {
    const [result] = await this.db("pagerduty_settings").insert({
      id: setting.id,
      value: setting.value
    }).onConflict(["id"]).merge(["value"]).returning("id");
    return result.id;
  }
  async findSetting(settingId) {
    const rawEntity = await this.db("pagerduty_settings").where("id", settingId).first();
    return rawEntity;
  }
  async getAllSettings() {
    const rawEntities = await this.db("pagerduty_settings");
    if (!rawEntities) {
      return [];
    }
    return rawEntities;
  }
}

class CatalogFetchApi {
  constructor(logger, auth) {
    this.logger = logger;
    this.auth = auth;
  }
  async fetch(input, init) {
    const request = new Request(input, init);
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
    request.headers.set("Authorization", `Bearer ${token}`);
    this.logger.debug(`Added token to outgoing request to ${request.url}`);
    return fetch(request);
  }
}
const pagerDutyPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "pagerduty",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        database: backendPluginApi.coreServices.database,
        discovery: backendPluginApi.coreServices.discovery,
        auth: backendPluginApi.coreServices.auth
      },
      async init({ config, logger, httpRouter, database, discovery, auth }) {
        const pagerDutyBackendStore = await PagerDutyBackendDatabase.create(
          await database.getClient(),
          { skipMigrations: true }
        );
        httpRouter.use(
          await createRouter({
            config,
            logger,
            store: pagerDutyBackendStore,
            discovery,
            auth,
            catalogApi: new catalogClient.CatalogClient({
              discoveryApi: discovery,
              fetchApi: new CatalogFetchApi(logger, auth)
            })
          })
        );
        httpRouter.addAuthPolicy({
          path: "/",
          allow: "unauthenticated"
        });
      }
    });
  }
});

index_cjs.buildEntityMappingsResponse = buildEntityMappingsResponse;
index_cjs.createComponentEntitiesReferenceDict = createComponentEntitiesReferenceDict;
index_cjs.createRouter = createRouter;
var _default = index_cjs.default = pagerDutyPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
