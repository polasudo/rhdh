'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('express');
var require$$2 = require('express-promise-router');
var require$$3 = require('node-fetch');
var require$$5 = require('luxon');
var require$$6 = require('@backstage/backend-plugin-api');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

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

var index_cjs$1 = {};

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

var require$$4 = /*@__PURE__*/getAugmentedNamespace(index_esm);

(function (exports) {

	Object.defineProperty(exports, '__esModule', { value: true });

	var backendCommon = require$$0;
	var express = require$$1;
	var Router = require$$2;
	var fetch$1 = require$$3;
	var backstagePluginCommon = require$$4;
	var luxon = require$$5;
	var backendPluginApi = require$$6;

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var express__default = /*#__PURE__*/_interopDefaultLegacy(express);
	var Router__default = /*#__PURE__*/_interopDefaultLegacy(Router);
	var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch$1);

	let authPersistence;
	async function getAuthToken() {
	  if (authPersistence.authToken !== "" && authPersistence.authToken.includes("Bearer") && authPersistence.authTokenExpiryDate > Date.now() || authPersistence.authToken !== "" && authPersistence.authToken.includes("Token")) {
	    return authPersistence.authToken;
	  }
	  await loadAuthConfig(authPersistence.config, authPersistence.logger);
	  return authPersistence.authToken;
	}
	async function loadAuthConfig(config, logger) {
	  var _a;
	  try {
	    authPersistence = {
	      config,
	      logger,
	      authToken: "",
	      authTokenExpiryDate: Date.now()
	    };
	    if (!config.getOptionalString("pagerDuty.apiToken")) {
	      logger.warn("No PagerDuty API token found in config file. Trying OAuth token instead...");
	      if (!config.getOptional("pagerDuty.oauth")) {
	        logger.error("No PagerDuty OAuth configuration found in config file.");
	      } else if (!config.getOptionalString("pagerDuty.oauth.clientId") || !config.getOptionalString("pagerDuty.oauth.clientSecret") || !config.getOptionalString("pagerDuty.oauth.subDomain")) {
	        logger.error("Missing required PagerDuty OAuth parameters in config file. 'clientId', 'clientSecret', and 'subDomain' are required. 'region' is optional.");
	      } else {
	        authPersistence.authToken = await getOAuthToken(
	          config.getString("pagerDuty.oauth.clientId"),
	          config.getString("pagerDuty.oauth.clientSecret"),
	          config.getString("pagerDuty.oauth.subDomain"),
	          (_a = config.getOptionalString("pagerDuty.oauth.region")) != null ? _a : "us"
	        );
	        logger.info("PagerDuty OAuth configuration loaded successfully.");
	      }
	    } else {
	      authPersistence.authToken = `Token token=${config.getString("pagerDuty.apiToken")}`;
	      logger.info("PagerDuty API token loaded successfully.");
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
	  authPersistence.authTokenExpiryDate = Date.now() + authResponse.expires_in * 1e3;
	  return `Bearer ${authResponse.access_token}`;
	}

	let apiBaseUrl = "https://api.pagerduty.com";
	function setAPIBaseUrl(url) {
	  apiBaseUrl = url;
	}
	async function getEscalationPolicies(offset, limit) {
	  var _a;
	  let response;
	  const params = `total=true&sort_by=name&offset=${offset}&limit=${limit}`;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/escalation_policies`;
	  try {
	    response = await fetch__default["default"](`${baseUrl}?${params}`, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve escalation policies: ${error}`);
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
	    return [(_a = result.more) != null ? _a : false, result.escalation_policies];
	  } catch (error) {
	    throw new backstagePluginCommon.HttpError(`Failed to parse escalation policy information: ${error}`, 500);
	  }
	}
	async function getAllEscalationPolicies(offset = 0) {
	  const limit = 50;
	  try {
	    const res = await getEscalationPolicies(offset, limit);
	    const results = res[1];
	    if (res[0]) {
	      return results.concat(await getAllEscalationPolicies(offset + limit));
	    }
	    return results;
	  } catch (error) {
	    if (error instanceof backstagePluginCommon.HttpError) {
	      throw error;
	    } else {
	      throw new backstagePluginCommon.HttpError(`${error}`, 500);
	    }
	  }
	}
	async function getOncallUsers(escalationPolicy) {
	  let response;
	  const params = `time_zone=UTC&include[]=users&escalation_policy_ids[]=${escalationPolicy}`;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/oncalls`;
	  try {
	    response = await fetch__default["default"](`${baseUrl}?${params}`, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve oncalls: ${error}`);
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
	async function getServiceById(serviceId) {
	  let response;
	  const params = `time_zone=UTC&include[]=integrations&include[]=escalation_policies`;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/services`;
	  try {
	    response = await fetch__default["default"](`${baseUrl}/${serviceId}?${params}`, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve service: ${error}`);
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
	async function getServiceByIntegrationKey(integrationKey) {
	  let response;
	  const params = `query=${integrationKey}&time_zone=UTC&include[]=integrations&include[]=escalation_policies`;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/services`;
	  try {
	    response = await fetch__default["default"](`${baseUrl}?${params}`, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve service: ${error}`);
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
	async function getChangeEvents(serviceId) {
	  let response;
	  const params = `limit=5&time_zone=UTC&sort_by=timestamp`;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/services`;
	  try {
	    response = await fetch__default["default"](`${baseUrl}/${serviceId}/change_events?${params}`, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve change events for service: ${error}`);
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
	async function getIncidents(serviceId) {
	  let response;
	  const params = `time_zone=UTC&sort_by=created_at&statuses[]=triggered&statuses[]=acknowledged&service_ids[]=${serviceId}`;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/incidents`;
	  try {
	    response = await fetch__default["default"](`${baseUrl}?${params}`, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve incidents for service: ${error}`);
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
	async function getServiceStandards(serviceId) {
	  let response;
	  const options = {
	    method: "GET",
	    headers: {
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    }
	  };
	  const baseUrl = `${apiBaseUrl}/standards/scores/technical_services/${serviceId}`;
	  try {
	    response = await fetch__default["default"](baseUrl, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve service standards for service: ${error}`);
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
	async function getServiceMetrics(serviceId) {
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
	      Authorization: await getAuthToken(),
	      "Accept": "application/vnd.pagerduty+json;version=2",
	      "Content-Type": "application/json"
	    },
	    body
	  };
	  const baseUrl = `${apiBaseUrl}/analytics/metrics/incidents/services`;
	  try {
	    response = await fetch__default["default"](baseUrl, options);
	  } catch (error) {
	    throw new Error(`Failed to retrieve service metrics for service: ${error}`);
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

	async function createRouter(options) {
	  const { logger, config } = options;
	  await loadAuthConfig(config, logger);
	  const baseUrl = config.getOptionalString("pagerDuty.apiBaseUrl") !== void 0 ? config.getString("pagerDuty.apiBaseUrl") : "https://api.pagerduty.com";
	  setAPIBaseUrl(baseUrl);
	  const router = Router__default["default"]();
	  router.use(express__default["default"].json());
	  router.get("/escalation_policies", async (_, response) => {
	    try {
	      const escalationPolicyList = await getAllEscalationPolicies();
	      const escalationPolicyDropDownOptions = escalationPolicyList.map((policy) => {
	        return {
	          label: policy.name,
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
	      if (escalationPolicyId === "") {
	        response.status(400).json("Bad Request: 'escalation_policy_ids[]' is required");
	      }
	      const oncallUsers = await getOncallUsers(escalationPolicyId);
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
	      if (serviceId === "") {
	        response.status(400).json("Bad Request: ':serviceId' must be provided as part of the path or 'integration_key' as a query parameter");
	      }
	      const service = await getServiceById(serviceId);
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
	      if (integrationKey === "") {
	        response.status(400).json("Bad Request: 'integration_key' parameter is required");
	      }
	      const service = await getServiceByIntegrationKey(integrationKey);
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
	  router.get("/services/:serviceId/change-events", async (request, response) => {
	    try {
	      const serviceId = request.params.serviceId || "";
	      const changeEvents = await getChangeEvents(serviceId);
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
	      const incidents = await getIncidents(serviceId);
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
	      const serviceStandards = await getServiceStandards(serviceId);
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
	      const metrics = await getServiceMetrics(serviceId);
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

	const pagerDutyPlugin = backendPluginApi.createBackendPlugin({
	  pluginId: "pagerduty",
	  register(env) {
	    env.registerInit({
	      deps: {
	        logger: backendPluginApi.coreServices.logger,
	        config: backendPluginApi.coreServices.rootConfig,
	        httpRouter: backendPluginApi.coreServices.httpRouter
	      },
	      async init({ config, logger, httpRouter }) {
	        httpRouter.use(
	          await createRouter({
	            config,
	            logger
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

	exports.createRouter = createRouter;
	exports["default"] = pagerDutyPlugin;
	
} (index_cjs$1));

var index_cjs = /*@__PURE__*/getDefaultExportFromCjs(index_cjs$1);

exports["default"] = index_cjs;
//# sourceMappingURL=index.cjs.js.map
