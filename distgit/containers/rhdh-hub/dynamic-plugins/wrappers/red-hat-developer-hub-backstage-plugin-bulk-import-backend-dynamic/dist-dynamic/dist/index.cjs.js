'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$6 = require('@backstage/backend-plugin-api');
var require$$1$4 = require('@backstage/plugin-catalog-node/alpha');
var require$$0$5 = require('@backstage/backend-defaults/rootHttpRouter');
var require$$1$3 = require('@backstage/plugin-permission-node');
var require$$2 = require('@janus-idp/backstage-plugin-audit-log-node');
var require$$3$1 = require('ajv-formats/dist/formats');
var require$$4 = require('express');
var require$$5 = require('openapi-backend');
var require$$1 = require('@backstage/plugin-permission-common');
var require$$0$2 = require('node-fetch');
var require$$0 = require('@backstage/errors');
var require$$0$1 = require('git-url-parse');
var require$$1$1 = require('js-yaml');
var require$$0$3 = require('@octokit/auth-app');
var require$$1$2 = require('@octokit/rest');
var require$$3 = require('luxon');
var require$$0$4 = require('@backstage/integration');

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

var plugin_cjs = {};

var router_cjs = {};

const bulkImportPermission = require$$1.createPermission({
  name: "bulk.import",
  attributes: {},
  resourceType: "bulk-import"
});

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	bulkImportPermission: bulkImportPermission
});

var require$$6 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var catalogHttpClient_cjs = {};

var auth_cjs = {};

var auditLogUtils_cjs = {};

var errors$2 = require$$0;

const EVENT_PREFIX = "BulkImport";
const UNKNOWN_ENDPOINT_EVENT = `${EVENT_PREFIX}UnknownEndpoint`;
async function auditLogRequestSuccess(auditLogger, openApiOperationId, req, responseStatus) {
  if (!openApiOperationId) {
    auditLogUnknownEndpoint(auditLogger, req);
    return;
  }
  auditLogger.auditLog({
    eventName: operationIdToEventName(openApiOperationId),
    stage: "completion",
    status: "succeeded",
    level: "info",
    request: req,
    response: {
      status: responseStatus
    },
    message: `'${req.method} ${req.path}' endpoint hit by ${await auditLogger.getActorId(req)}`
  });
}
async function auditLogRequestError(auditLogger, openApiOperationId, req, error) {
  if (!openApiOperationId) {
    auditLogUnknownEndpoint(auditLogger, req);
    return;
  }
  auditLogger.auditLog({
    eventName: operationIdToEventName(openApiOperationId),
    stage: "completion",
    status: "failed",
    level: "error",
    request: req,
    response: {
      status: 500,
      body: {
        errors: [
          {
            name: error.name,
            message: error.message || "internal server error"
          }
        ]
      }
    },
    errors: [error],
    message: `Error while requesting the '${req.method} ${req.path}' endpoint (request from ${await auditLogger.getActorId(req)})`
  });
}
async function auditLogUnknownEndpoint(auditLogger, req) {
  const error = new errors$2.NotFoundError(`'${req.method} ${req.path}' not found`);
  auditLogger.auditLog({
    eventName: UNKNOWN_ENDPOINT_EVENT,
    stage: "initiation",
    status: "failed",
    level: "info",
    request: req,
    response: {
      status: 404,
      body: {
        errors: [
          {
            name: error.name,
            message: error.message
          }
        ]
      }
    },
    errors: [error],
    message: `${await auditLogger.getActorId(req)} requested the unknown '${req.method} ${req.path}' endpoint`
  });
}
async function auditLogAuthError(auditLogger, openApiOperationId, req, error) {
  if (!openApiOperationId) {
    auditLogUnknownEndpoint(auditLogger, req);
    return;
  }
  auditLogger.auditLog({
    eventName: operationIdToEventName(openApiOperationId),
    stage: "authorization",
    status: "failed",
    level: "warn",
    request: req,
    response: {
      status: 403,
      body: {
        errors: [
          {
            name: error.name,
            message: error.message
          }
        ]
      }
    },
    errors: [error],
    message: `${await auditLogger.getActorId(
      req
    )} not authorized to request the '${req.method} ${req.path}' endpoint`
  });
}
function operationIdToEventName(openApiOperationId) {
  if (openApiOperationId.length === 0) {
    return EVENT_PREFIX;
  }
  return `${EVENT_PREFIX}${openApiOperationId.charAt(0).toUpperCase()}${openApiOperationId.slice(1)}`;
}

auditLogUtils_cjs.auditLogAuthError = auditLogAuthError;
auditLogUtils_cjs.auditLogRequestError = auditLogRequestError;
auditLogUtils_cjs.auditLogRequestSuccess = auditLogRequestSuccess;
auditLogUtils_cjs.auditLogUnknownEndpoint = auditLogUnknownEndpoint;

var errors$1 = require$$0;
var pluginPermissionCommon = require$$1;
var backstagePluginBulkImportCommon$1 = require$$6;
var auditLogUtils$1 = auditLogUtils_cjs;

async function permissionCheck(auditLogger, openApiOperationId, permissions, httpAuth, req) {
  const decision = (await permissions.authorize(
    [
      {
        permission: backstagePluginBulkImportCommon$1.bulkImportPermission,
        resourceRef: backstagePluginBulkImportCommon$1.bulkImportPermission.resourceType
      }
    ],
    {
      credentials: await httpAuth.credentials(req)
    }
  ))[0];
  if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
    const err = new errors$1.NotAllowedError("Unauthorized");
    auditLogUtils$1.auditLogAuthError(auditLogger, openApiOperationId, req, err);
    throw err;
  }
}
async function getTokenForPlugin(auth, targetPluginId) {
  const resp = await auth.getPluginRequestToken({
    onBehalfOf: await auth.getOwnServiceCredentials(),
    targetPluginId
  });
  return resp.token;
}

auth_cjs.getTokenForPlugin = getTokenForPlugin;
auth_cjs.permissionCheck = permissionCheck;

var loggingUtils_cjs = {};

var errors = require$$0;

function logErrorIfNeeded(logger, logMsg, error) {
  if (errors.isError(error)) {
    logger.error(logMsg, {
      // Default Error properties:
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Additional status code if available:
      status: error.response?.status
    });
  }
}

loggingUtils_cjs.logErrorIfNeeded = logErrorIfNeeded;

var catalogUtils_cjs = {};

var gitUrlParse$5 = require$$0$1;

function _interopDefaultCompat$7 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default$5 = /*#__PURE__*/_interopDefaultCompat$7(gitUrlParse$5);

function getCatalogFilename(config) {
  return config.getOptionalString("catalog.import.entityFilename") ?? "catalog-info.yaml";
}
function getBranchName(config) {
  return config.getOptionalString("catalog.import.pullRequestBranchName") ?? "backstage-integration";
}
function getCatalogUrl(config, repoUrl, defaultBranch = "main") {
  return `${repoUrl}/blob/${defaultBranch}/${getCatalogFilename(config)}`;
}
function filterLocations(res, search) {
  return search ? res.filter((loc) => {
    const split = loc.target.split("/blob/");
    if (split.length < 2) {
      return false;
    }
    const repoUrl = split[0];
    const gitUrl = gitUrlParse__default$5.default(repoUrl);
    return gitUrl.name.toLowerCase().includes(search.toLowerCase());
  }) : res;
}

catalogUtils_cjs.filterLocations = filterLocations;
catalogUtils_cjs.getBranchName = getBranchName;
catalogUtils_cjs.getCatalogFilename = getCatalogFilename;
catalogUtils_cjs.getCatalogUrl = getCatalogUrl;

var fetch = require$$0$2;
var auth$1 = auth_cjs;
var loggingUtils$4 = loggingUtils_cjs;
var catalogUtils$4 = catalogUtils_cjs;

function _interopDefaultCompat$6 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat$6(fetch);

class CatalogHttpClient {
  logger;
  config;
  discovery;
  auth;
  catalogApi;
  constructor(deps) {
    this.logger = deps.logger;
    this.config = deps.config;
    this.discovery = deps.discovery;
    this.auth = deps.auth;
    this.catalogApi = deps.catalogApi;
  }
  // Wrapper for https://backstage.io/docs/features/software-catalog/software-catalog-api/#post-analyze-location
  async analyzeLocation(repoUrl) {
    this.logger.debug(`Forwarding request to analyze location: ${repoUrl}`);
    const response = await fetch__default.default(
      `${await this.discovery.getBaseUrl("catalog")}/analyze-location`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth$1.getTokenForPlugin(
            this.auth,
            "catalog"
          )}`
        },
        method: "POST",
        body: JSON.stringify({
          location: {
            type: "github",
            target: repoUrl
          }
        })
      }
    );
    return (await response.json()).generateEntities ?? [];
  }
  async listCatalogUrlLocations(search, pageNumber, pageSize) {
    const byId = await this.listCatalogUrlLocationsById(
      search,
      pageNumber,
      pageSize
    );
    const result = /* @__PURE__ */ new Set();
    for (const l of byId.locations) {
      result.add(l.target);
    }
    return {
      targetUrls: Array.from(result.values()),
      totalCount: byId.totalCount
    };
  }
  async listCatalogUrlLocationsById(search, pageNumber, pageSize) {
    const result = await Promise.all([
      this.listCatalogUrlLocationsFromConfig(search),
      this.listCatalogUrlLocationsByIdFromLocationsEndpoint(search),
      this.listCatalogUrlLocationEntitiesById(search, pageNumber, pageSize)
    ]);
    const locations = result.flatMap((u) => u.locations);
    const totalCount = result.map((l) => l.totalCount ?? 0).reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    return {
      locations,
      totalCount
    };
  }
  async listCatalogUrlLocationsByIdFromLocationsEndpoint(search) {
    const url = `${await this.discovery.getBaseUrl("catalog")}/locations`;
    const response = await fetch__default.default(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await auth$1.getTokenForPlugin(
          this.auth,
          "catalog"
        )}`
      },
      method: "GET"
    });
    const locations = await response.json();
    if (!Array.isArray(locations)) {
      return { locations: [] };
    }
    const res = locations.filter(
      (location) => location.data?.target && location.data?.type === "url"
    ).map((location) => {
      return {
        id: location.data?.id,
        target: location.data.target
      };
    });
    const filtered = catalogUtils$4.filterLocations(res, search);
    return { locations: filtered, totalCount: filtered.length };
  }
  listCatalogUrlLocationsFromConfig(search) {
    const locationConfigs = this.config.getOptionalConfigArray("catalog.locations") ?? [];
    const res = locationConfigs.filter(
      (location) => location.getOptionalString("target") && location.getOptionalString("type") === "url"
    ).map((location) => {
      const target = location.getString("target");
      return {
        id: `app-config-location--${target}`,
        target
      };
    });
    const filtered = catalogUtils$4.filterLocations(res, search);
    return { locations: filtered, totalCount: filtered.length };
  }
  async listCatalogUrlLocationEntitiesById(search, _pageNumber, _pageSize) {
    const result = await this.catalogApi.getEntities(
      {
        filter: {
          kind: "Location"
        },
        // There is no query parameter to find entities with target URLs containing a string.
        // The existing filter does an exact matching. That's why we are retrieving this hard-coded high number of Locations.
        limit: 9999,
        offset: 0,
        order: { field: "metadata.name", order: "desc" }
      },
      {
        token: await auth$1.getTokenForPlugin(this.auth, "catalog")
      }
    );
    const locations = result?.items ?? [];
    const res = locations.filter(
      (location) => location.spec?.target && location.spec?.type === "url"
    ).map((location) => {
      return {
        id: location.metadata.uid,
        target: location.spec.target
      };
    });
    const filtered = catalogUtils$4.filterLocations(res, search);
    return { locations: filtered, totalCount: filtered.length };
  }
  /**
   * verifyLocationExistence checks for the existence of the Location target.
   * Under the hood, it attempts to read the target URL and will return false if the target could not be found
   * and even if there is already a Location row in the database.
   * @param repoCatalogUrl
   */
  async verifyLocationExistence(repoCatalogUrl) {
    try {
      const result = await this.catalogApi.addLocation(
        {
          type: "url",
          target: repoCatalogUrl,
          dryRun: true
        },
        {
          token: await auth$1.getTokenForPlugin(this.auth, "catalog")
        }
      );
      return result.exists;
    } catch (error) {
      if (error.message?.includes("NotFoundError")) {
        return false;
      }
      throw error;
    }
  }
  async hasEntityInCatalog(entityName) {
    return this.catalogApi.queryEntities(
      {
        filter: {
          "metadata.name": entityName
        },
        limit: 1
      },
      {
        token: await auth$1.getTokenForPlugin(this.auth, "catalog")
      }
    ).then((resp) => resp.items?.length > 0);
  }
  async possiblyCreateLocation(repoCatalogUrl) {
    try {
      await this.catalogApi.addLocation(
        {
          type: "url",
          target: repoCatalogUrl
        },
        {
          token: await auth$1.getTokenForPlugin(this.auth, "catalog")
        }
      );
    } catch (error) {
      if (!error.message?.includes("ConflictError")) {
        throw error;
      }
    }
  }
  async deleteCatalogLocationById(locationId) {
    try {
      const url = `${await this.discovery.getBaseUrl(
        "catalog"
      )}/locations/${locationId}`;
      await fetch__default.default(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${await auth$1.getTokenForPlugin(
            this.auth,
            "catalog"
          )}`
        },
        method: "DELETE"
      });
    } catch (error) {
      loggingUtils$4.logErrorIfNeeded(
        this.logger,
        `Could not delete location ${locationId}`,
        error
      );
    }
  }
  async deleteCatalogLocationEntityById(locationUid) {
    await this.catalogApi.removeEntityByUid(locationUid, {
      token: await auth$1.getTokenForPlugin(this.auth, "catalog")
    });
  }
  async findLocationEntitiesByRepoUrl(repoUrl, defaultBranch) {
    return this.findLocationEntitiesByTargetUrl(
      catalogUtils$4.getCatalogUrl(this.config, repoUrl, defaultBranch)
    );
  }
  async findLocationEntitiesByTargetUrl(targetUrl, limit) {
    return this.catalogApi.queryEntities(
      {
        filter: [
          { kind: "Location", "spec.type": "url", "spec.target": targetUrl }
        ],
        fields: ["metadata.namespace", "metadata.name", "metadata.uid"],
        limit
      },
      {
        token: await auth$1.getTokenForPlugin(this.auth, "catalog")
      }
    ).then((resp) => resp.items);
  }
  async refreshLocationByRepoUrl(repoUrl, defaultBranch) {
    const promises = [];
    this.findLocationEntitiesByRepoUrl(repoUrl, defaultBranch).then(
      (entities) => {
        const nbEntities = entities.length;
        if (nbEntities === 0) {
          this.logger.debug(`No Location Entity found for repo: ${repoUrl}`);
          return;
        }
        this.logger.debug(
          `Refreshing ${nbEntities} Location(s) for repo: ${repoUrl}`
        );
        entities.forEach(
          (ent) => promises.push(
            this.refreshEntity(
              "location",
              ent.metadata.name,
              ent.metadata.namespace
            )
          )
        );
      }
    );
    await Promise.all(promises);
  }
  async refreshEntity(kind, name, namespace = "default") {
    const entityRef = `${kind}:${namespace}/${name}`;
    this.logger.debug(`Refreshing entityRef: ${entityRef}`);
    await this.catalogApi.refreshEntity(entityRef, {
      token: await auth$1.getTokenForPlugin(this.auth, "catalog")
    });
  }
}

catalogHttpClient_cjs.CatalogHttpClient = CatalogHttpClient;

var catalogInfoGenerator_cjs = {};

var gitUrlParse$4 = require$$0$1;
var jsYaml = require$$1$1;



var loggingUtils$3 = loggingUtils_cjs;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default$4 = /*#__PURE__*/_interopDefaultCompat$5(gitUrlParse$4);
var jsYaml__default = /*#__PURE__*/_interopDefaultCompat$5(jsYaml);

class CatalogInfoGenerator {
  logger;
  catalogHttpClient;
  constructor(logger, catalogHttpClient) {
    this.logger = logger;
    this.catalogHttpClient = catalogHttpClient;
  }
  async generateDefaultCatalogInfoContent(repoUrl, analyzeLocation = true) {
    const gitUrl = gitUrlParse__default$4.default(repoUrl);
    const defaultCatalogInfo = `---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${gitUrl.name}
  annotations:
    github.com/project-slug: ${gitUrl.organization}/${gitUrl.name}
spec:
  type: other
  lifecycle: unknown
  owner: ${gitUrl.organization}
---`;
    if (!analyzeLocation) {
      return defaultCatalogInfo;
    }
    let generatedEntities = [];
    try {
      generatedEntities = await this.catalogHttpClient.analyzeLocation(repoUrl);
    } catch (error) {
      loggingUtils$3.logErrorIfNeeded(
        this.logger,
        `Could not analyze location ${repoUrl}`,
        error
      );
    }
    if (generatedEntities.length === 0) {
      return defaultCatalogInfo;
    }
    return generatedEntities.map(
      (generatedEntity) => `---
${jsYaml__default.default.dump(generatedEntity.entity)}`
    ).join("\n");
  }
}

catalogInfoGenerator_cjs.CatalogInfoGenerator = CatalogInfoGenerator;

var openapidocument_cjs = {};

const OPENAPI = `
{
  "openapi": "3.1.0",
  "info": {
    "version": "1.0",
    "title": "Bulk Import Backend",
    "description": "The Bulk Import Backend APIs allow users to bulk import repositories into the Backstage catalog from remote sources such as Git."
  },
  "servers": [
    {
      "url": "{protocol}://{host}:{port}/{basePath}",
      "variables": {
        "protocol": {
          "enum": [
            "http",
            "https"
          ],
          "default": "http"
        },
        "host": {
          "default": "localhost"
        },
        "port": {
          "default": "7007"
        },
        "basePath": {
          "default": "api/bulk-import"
        }
      }
    }
  ],
  "paths": {
    "/ping": {
      "get": {
        "operationId": "ping",
        "summary": "Check the health of the Bulk Import backend router",
        "tags": [
          "Management"
        ],
        "responses": {
          "200": {
            "description": "The backend router for the Bulk Import backend is up and running",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "enum": [
                        "ok"
                      ]
                    }
                  }
                },
                "example": {
                  "status": "ok"
                }
              }
            }
          }
        }
      }
    },
    "/organizations": {
      "get": {
        "operationId": "findAllOrganizations",
        "summary": "Fetch Organizations accessible by Backstage Github Integrations",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Organization"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/pagePerIntegrationQueryParam"
          },
          {
            "$ref": "#/components/parameters/sizePerIntegrationQueryParam"
          },
          {
            "$ref": "#/components/parameters/searchQueryParam"
          }
        ],
        "responses": {
          "200": {
            "description": "Organization list was fetched successfully with no errors",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/OrganizationList"
                },
                "examples": {
                  "multipleRepos": {
                    "$ref": "#/components/examples/multipleOrgs"
                  }
                }
              }
            }
          },
          "500": {
            "description": "Generic error when there are errors and no Organization is returned",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/OrganizationList"
                },
                "examples": {
                  "repositoryListErrors": {
                    "$ref": "#/components/examples/orgListErrors"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/organizations/{organizationName}/repositories": {
      "get": {
        "operationId": "findRepositoriesByOrganization",
        "summary": "Fetch Repositories in the specified GitHub organization, provided it is accessible by any of the configured GitHub Integrations.",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Organization"
        ],
        "parameters": [
          {
            "in": "path",
            "name": "organizationName",
            "description": "Organization name",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "checkImportStatus",
            "description": "whether to return import status. Note that this might incur a performance penalty because the import status is computed for each repository.",
            "schema": {
              "type": "boolean",
              "default": "false"
            }
          },
          {
            "$ref": "#/components/parameters/pagePerIntegrationQueryParam"
          },
          {
            "$ref": "#/components/parameters/sizePerIntegrationQueryParam"
          },
          {
            "$ref": "#/components/parameters/searchQueryParam"
          }
        ],
        "responses": {
          "200": {
            "description": "Org Repository list was fetched successfully with no errors",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RepositoryList"
                },
                "examples": {
                  "multipleRepos": {
                    "$ref": "#/components/examples/multipleRepos"
                  }
                }
              }
            }
          },
          "500": {
            "description": "Generic error when there are errors and no Org Repository is returned",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RepositoryList"
                },
                "examples": {
                  "repositoryListErrors": {
                    "$ref": "#/components/examples/repositoryListErrors"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/repositories": {
      "get": {
        "operationId": "findAllRepositories",
        "summary": "Fetch Organization Repositories accessible by Backstage Github Integrations",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Repository"
        ],
        "parameters": [
          {
            "in": "query",
            "name": "checkImportStatus",
            "description": "whether to return import status. Note that this might incur a performance penalty because the import status is computed for each repository.",
            "schema": {
              "type": "boolean",
              "default": "false"
            }
          },
          {
            "$ref": "#/components/parameters/pagePerIntegrationQueryParam"
          },
          {
            "$ref": "#/components/parameters/sizePerIntegrationQueryParam"
          },
          {
            "$ref": "#/components/parameters/searchQueryParam"
          }
        ],
        "responses": {
          "200": {
            "description": "Repository list was fetched successfully with no errors",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RepositoryList"
                },
                "examples": {
                  "multipleRepos": {
                    "$ref": "#/components/examples/multipleRepos"
                  }
                }
              }
            }
          },
          "500": {
            "description": "Generic error when there are errors and no repository is returned",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RepositoryList"
                },
                "examples": {
                  "repositoryListErrors": {
                    "$ref": "#/components/examples/repositoryListErrors"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/imports": {
      "get": {
        "operationId": "findAllImports",
        "summary": "Fetch Import Jobs",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Import"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/apiVersionHeaderParam"
          },
          {
            "$ref": "#/components/parameters/pagePerIntegrationQueryParamDeprecated"
          },
          {
            "$ref": "#/components/parameters/sizePerIntegrationQueryParamDeprecated"
          },
          {
            "$ref": "#/components/parameters/pageQueryParam"
          },
          {
            "$ref": "#/components/parameters/sizeQueryParam"
          },
          {
            "$ref": "#/components/parameters/searchQueryParam"
          }
        ],
        "responses": {
          "200": {
            "description": "Import Job list was fetched successfully with no errors",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Import"
                      }
                    },
                    {
                      "$ref": "#/components/schemas/ImportJobListV2"
                    }
                  ]
                },
                "examples": {
                  "twoImports": {
                    "$ref": "#/components/examples/twoImports"
                  },
                  "multipleImportJobsV2": {
                    "$ref": "#/components/examples/multipleImportJobsV2"
                  }
                }
              }
            }
          },
          "500": {
            "description": "Generic error when there are errors and no Import Job is returned",
            "content": {
              "application/json": {
                "schema": {
                  "oneOf": [
                    {
                      "type": "string",
                      "description": "Generic error"
                    },
                    {
                      "$ref": "#/components/schemas/ImportJobListV2"
                    }
                  ]
                },
                "examples": {
                  "repositoryListErrors": {
                    "$ref": "#/components/examples/importJobListErrors"
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createImportJobs",
        "summary": "Submit Import Jobs",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Import"
        ],
        "parameters": [
          {
            "in": "query",
            "name": "dryRun",
            "description": "whether to perform a dry-run to check if entity name collisions would occur in the catalog",
            "schema": {
              "type": "boolean",
              "default": "false"
            }
          }
        ],
        "requestBody": {
          "description": "List of Import jobs to create",
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/ImportRequest"
                }
              },
              "examples": {
                "multipleImportRequests": {
                  "$ref": "#/components/examples/multipleImportRequests"
                }
              }
            }
          }
        },
        "responses": {
          "202": {
            "description": "Import Jobs request was submitted successfully to the API. Check the status in each item of the response body list to see their individual status.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Import"
                  }
                },
                "examples": {
                  "twoImports": {
                    "$ref": "#/components/examples/twoImportJobs"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/import/by-repo": {
      "get": {
        "operationId": "findImportStatusByRepo",
        "summary": "Get Import Status by repository",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Import"
        ],
        "parameters": [
          {
            "in": "query",
            "name": "repo",
            "description": "the full URL to the repo",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "defaultBranch",
            "description": "the name of the default branch",
            "schema": {
              "type": "string",
              "default": "main"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Import Job status was determined successfully with no errors",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Import"
                },
                "examples": {
                  "singleImportStatusForRepo": {
                    "$ref": "#/components/examples/singleImportStatusForRepo"
                  }
                }
              }
            }
          },
          "500": {
            "description": "Generic error"
          }
        }
      },
      "delete": {
        "operationId": "deleteImportByRepo",
        "summary": "Delete Import by repository",
        "security": [
          {
            "BearerAuth": []
          }
        ],
        "tags": [
          "Import"
        ],
        "parameters": [
          {
            "in": "query",
            "name": "repo",
            "description": "the full URL to the repo",
            "schema": {
              "type": "string"
            }
          },
          {
            "in": "query",
            "name": "defaultBranch",
            "description": "the name of the default branch",
            "schema": {
              "type": "string",
              "default": "main"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "Import Job was successfully delete with no errors"
          },
          "500": {
            "description": "Generic error"
          }
        }
      }
    }
  },
  "components": {
    "parameters": {
      "apiVersionHeaderParam": {
        "in": "header",
        "name": "api-version",
        "description": "API version.\\n\\n## Changelog\\n\\n### v1 (default)\\nInitial version\\n#### Deprecations\\n* GET /imports\\n  * Deprecation of 'pagePerIntegration' and 'sizePerIntegration' query parameters and introduction of new 'page' and 'size' parameters\\n    * 'page' takes precedence over 'pagePerIntegration' if both are passed\\n    * 'size' takes precedence over 'sizePerIntegration' if both are passed\\n\\n### v2\\n#### Breaking changes\\n* GET /imports\\n  * Query parameters:\\n    * 'pagePerIntegration' is ignored in favor of 'page'\\n    * 'sizePerIntegration' is ignored in favor of 'size'\\n  * Response structure changed to include pagination info: instead of returning a simple list of Imports, the response is now an object containing the following fields:\\n    * 'imports': the list of Imports\\n    * 'page': the page requested\\n    * 'size': the requested number of Imports requested per page\\n    * 'totalCount': the total count of Imports\\n",
        "schema": {
          "type": "string",
          "enum": [
            "v1",
            "v2"
          ],
          "default": "v1"
        }
      },
      "pagePerIntegrationQueryParam": {
        "in": "query",
        "name": "pagePerIntegration",
        "description": "the page number for each Integration",
        "schema": {
          "type": "integer",
          "default": 1
        }
      },
      "sizePerIntegrationQueryParam": {
        "in": "query",
        "name": "sizePerIntegration",
        "description": "the number of items per Integration to return per page",
        "schema": {
          "type": "integer",
          "default": 20
        }
      },
      "pagePerIntegrationQueryParamDeprecated": {
        "in": "query",
        "name": "pagePerIntegration",
        "description": "the page number for each Integration. **Deprecated**. Use the 'page' query parameter instead.",
        "deprecated": true,
        "schema": {
          "type": "integer",
          "default": 1
        }
      },
      "sizePerIntegrationQueryParamDeprecated": {
        "in": "query",
        "name": "sizePerIntegration",
        "description": "the number of items per Integration to return per page. **Deprecated**. Use the 'size' query parameter instead.",
        "deprecated": true,
        "schema": {
          "type": "integer",
          "default": 20
        }
      },
      "searchQueryParam": {
        "in": "query",
        "name": "search",
        "description": "returns only the items that match the search string",
        "schema": {
          "type": "string"
        }
      },
      "pageQueryParam": {
        "in": "query",
        "name": "page",
        "description": "the requested page number",
        "schema": {
          "type": "integer",
          "default": 1
        }
      },
      "sizeQueryParam": {
        "in": "query",
        "name": "size",
        "description": "the number of items to return per page",
        "schema": {
          "type": "integer",
          "default": 20
        }
      }
    },
    "schemas": {
      "OrganizationList": {
        "title": "Organization List",
        "type": "object",
        "properties": {
          "organizations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Organization"
            }
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "totalCount": {
            "type": "integer"
          },
          "pagePerIntegration": {
            "type": "integer"
          },
          "sizePerIntegration": {
            "type": "integer"
          }
        }
      },
      "Organization": {
        "title": "Organization",
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "unique identifier"
          },
          "name": {
            "type": "string",
            "description": "organization name"
          },
          "description": {
            "type": "string",
            "description": "organization description"
          },
          "url": {
            "type": "string",
            "description": "organization URL"
          },
          "totalRepoCount": {
            "type": "number",
            "description": "total number of repositories in this Organization"
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      },
      "RepositoryList": {
        "title": "Repository List",
        "type": "object",
        "properties": {
          "repositories": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Repository"
            }
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "totalCount": {
            "type": "integer"
          },
          "pagePerIntegration": {
            "type": "integer"
          },
          "sizePerIntegration": {
            "type": "integer"
          }
        }
      },
      "Repository": {
        "title": "Repository",
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "unique identifier"
          },
          "name": {
            "type": "string",
            "description": "repository name"
          },
          "url": {
            "type": "string",
            "description": "repository URL"
          },
          "organization": {
            "type": "string",
            "description": "organization which the repository is part of"
          },
          "importStatus": {
            "$ref": "#/components/schemas/ImportStatus"
          },
          "defaultBranch": {
            "type": "string",
            "description": "default branch"
          },
          "lastUpdate": {
            "type": "string",
            "format": "date-time"
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      },
      "ApprovalTool": {
        "type": "string",
        "enum": [
          "GIT",
          "SERVICENOW"
        ]
      },
      "ImportStatus": {
        "type": "string",
        "nullable": true,
        "description": "Import Job status",
        "enum": [
          "ADDED",
          "WAIT_PR_APPROVAL",
          "PR_ERROR",
          null
        ]
      },
      "ImportJobListV2": {
        "title": "Import Job List",
        "type": "object",
        "properties": {
          "imports": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Import"
            }
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "totalCount": {
            "type": "integer"
          },
          "page": {
            "type": "integer"
          },
          "size": {
            "type": "integer"
          }
        }
      },
      "Import": {
        "title": "Import Job",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "status": {
            "$ref": "#/components/schemas/ImportStatus"
          },
          "catalogEntityName": {
            "type": "string",
            "description": "Specified entity name in the catalog. Filled only in response for dry-run import requests."
          },
          "lastUpdate": {
            "type": "string",
            "format": "date-time"
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "approvalTool": {
            "$ref": "#/components/schemas/ApprovalTool"
          },
          "repository": {
            "$ref": "#/components/schemas/Repository"
          },
          "github": {
            "type": "object",
            "description": "GitHub details. Applicable if approvalTool is git.",
            "properties": {
              "pullRequest": {
                "type": "object",
                "properties": {
                  "url": {
                    "type": "string",
                    "description": "URL of the Pull Request"
                  },
                  "number": {
                    "type": "number",
                    "description": "Pull Request number"
                  },
                  "title": {
                    "type": "string",
                    "description": "title of the Pull Request"
                  },
                  "body": {
                    "type": "string",
                    "description": "body of the Pull Request"
                  },
                  "catalogInfoContent": {
                    "type": "string",
                    "description": "content of the catalog-info.yaml as fetched from the Pull Request."
                  }
                }
              }
            }
          }
        }
      },
      "ImportRequest": {
        "title": "Import Job request",
        "type": "object",
        "required": [
          "repository"
        ],
        "properties": {
          "approvalTool": {
            "$ref": "#/components/schemas/ApprovalTool"
          },
          "catalogEntityName": {
            "type": "string",
            "description": "Expected Entity name in the catalog. Relevant only if the 'dryRun' query parameter is set to 'true'."
          },
          "codeOwnersFileAsEntityOwner": {
            "type": "boolean",
            "description": "Whether the CODEOWNERS file will be used as entity owner. Only relevant for dry-run requests. If set to 'false', the corresponding dry-run check will be skipped."
          },
          "repository": {
            "type": "object",
            "required": [
              "url"
            ],
            "properties": {
              "name": {
                "type": "string",
                "description": "repository name"
              },
              "url": {
                "type": "string",
                "description": "repository URL"
              },
              "organization": {
                "type": "string",
                "description": "organization which the repository is part of"
              },
              "defaultBranch": {
                "type": "string",
                "description": "default branch"
              }
            }
          },
          "catalogInfoContent": {
            "type": "string",
            "description": "content of the catalog-info.yaml to include in the import Pull Request."
          },
          "github": {
            "type": "object",
            "description": "GitHub details. Applicable if approvalTool is git.",
            "properties": {
              "pullRequest": {
                "type": "object",
                "description": "Pull Request details. Applicable if approvalTool is git.",
                "properties": {
                  "title": {
                    "type": "string",
                    "description": "title of the Pull Request"
                  },
                  "body": {
                    "type": "string",
                    "description": "body of the Pull Request"
                  }
                }
              }
            }
          }
        }
      }
    },
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Backstage Permissions Framework JWT"
      }
    },
    "examples": {
      "multipleOrgs": {
        "summary": "Multiple organizations",
        "value": {
          "errors": [],
          "organizations": [
            {
              "id": "unique-org-id-1",
              "name": "pet-org",
              "url": "https://github.com/pet-org",
              "description": "A great Pet Org",
              "totalRepoCount": 10
            },
            {
              "id": "unique-org-id-2",
              "name": "org-zero",
              "url": "https://ghe.example.com/org-zero",
              "totalRepoCount": 0
            },
            {
              "id": "unique-id-2",
              "name": "org-one",
              "url": "https://ghe.example.com/org-one",
              "description": "Org One description",
              "totalRepoCount": 1234
            }
          ]
        }
      },
      "orgListErrors": {
        "summary": "Errors when listing organizations",
        "value": {
          "errors": [
            "Github App with ID 2 failed spectacularly"
          ],
          "organizations": []
        }
      },
      "multipleRepos": {
        "summary": "Multiple repositories",
        "value": {
          "errors": [],
          "repositories": [
            {
              "id": "unique-id-1",
              "name": "pet-app",
              "url": "https://github.com/my-org/pet-app",
              "organization": "my-org",
              "importStatus": "WAIT_PR_APPROVAL",
              "defaultBranch": "main"
            },
            {
              "id": "unique-id-2",
              "name": "project-zero",
              "url": "https://ghe.example.com/my-other-org/project-zero",
              "organization": "my-other-org",
              "importStatus": "PR_REJECTED",
              "defaultBranch": "dev"
            },
            {
              "id": "unique-id-2",
              "name": "project-one",
              "defaultBranch": "trunk",
              "url": "https://ghe.example.com/my-other-org-2/project-one",
              "organization": "my-other-org-2"
            }
          ]
        }
      },
      "repositoryListErrors": {
        "summary": "Errors when listing repositories",
        "value": {
          "errors": [
            "Github App with ID 2 failed spectacularly"
          ],
          "repositories": []
        }
      },
      "twoImports": {
        "summary": "Two import job requests (V1)",
        "value": [
          {
            "id": "bulk-import-id-1",
            "status": "WAIT_PR_APPROVAL",
            "errors": [],
            "approvalTool": "GIT",
            "repository": {
              "name": "pet-app",
              "url": "https://github.com/my-org/pet-app",
              "organization": "my-org"
            },
            "github": {
              "pullRequest": {
                "url": "https://github.com/my-org/pet-app/pull/1",
                "number": 1
              }
            }
          },
          {
            "id": "bulk-import-id-2",
            "status": "PR_REJECTED",
            "errors": [],
            "approvalTool": "GIT",
            "repository": {
              "name": "pet-app-test",
              "url": "https://github.com/my-org/pet-app-test",
              "organization": "my-org"
            },
            "github": {
              "pullRequest": {
                "url": "https://github.com/my-org/pet-app-test/pull/10",
                "number": 10
              }
            }
          }
        ]
      },
      "multipleImportJobsV2": {
        "summary": "Two import job requests (V2)",
        "value": {
          "errors": [],
          "page": 1,
          "size": 2,
          "totalCount": 10,
          "imports": [
            {
              "id": "bulk-import-id-1",
              "status": "WAIT_PR_APPROVAL",
              "errors": [],
              "approvalTool": "GIT",
              "repository": {
                "name": "pet-app",
                "url": "https://github.com/my-org/pet-app",
                "organization": "my-org"
              },
              "github": {
                "pullRequest": {
                  "url": "https://github.com/my-org/pet-app/pull/1",
                  "number": 1
                }
              }
            },
            {
              "id": "bulk-import-id-2",
              "status": "PR_REJECTED",
              "errors": [],
              "approvalTool": "GIT",
              "repository": {
                "name": "pet-app-test",
                "url": "https://github.com/my-org/pet-app-test",
                "organization": "my-org"
              },
              "github": {
                "pullRequest": {
                  "url": "https://github.com/my-org/pet-app-test/pull/10",
                  "number": 10
                }
              }
            }
          ]
        }
      },
      "importJobListErrors": {
        "summary": "Errors when listing import jobs",
        "value": {
          "errors": [
            "Github App with ID xyz-123 failed spectacularly"
          ],
          "imports": []
        }
      },
      "twoImportJobs": {
        "summary": "Two import jobs",
        "value": [
          {
            "id": "bulk-import-id-1",
            "status": "WAIT_PR_APPROVAL",
            "errors": [],
            "approvalTool": "GIT",
            "repository": {
              "name": "pet-app",
              "url": "https://github.com/my-org/pet-app",
              "organization": "my-org"
            },
            "github": {
              "pullRequest": {
                "url": "https://github.com/my-org/pet-app/pull/1",
                "number": 1
              }
            }
          },
          {
            "id": "bulk-import-id-2",
            "status": "PR_REJECTED",
            "errors": [],
            "approvalTool": "GIT",
            "repository": {
              "name": "pet-app-test",
              "url": "https://github.com/my-org/pet-app-test",
              "organization": "my-org"
            },
            "github": {
              "pullRequest": {
                "url": "https://github.com/my-org/pet-app-test/pull/10",
                "number": 10
              }
            }
          }
        ]
      },
      "singleImportStatusForRepo": {
        "summary": "Single import job status for given repo",
        "value": {
          "id": "bulk-import-id-1",
          "status": "WAIT_PR_APPROVAL",
          "errors": [],
          "approvalTool": "GIT",
          "repository": {
            "name": "pet-app",
            "url": "https://github.com/my-org/pet-app",
            "organization": "my-org"
          },
          "github": {
            "pullRequest": {
              "url": "https://github.com/my-org/pet-app/pull/1",
              "number": 1
            }
          }
        }
      },
      "multipleImportRequests": {
        "summary": "Multiple import requests",
        "value": [
          {
            "approvalTool": "GIT",
            "repository": {
              "name": "pet-app",
              "url": "https://github.com/my-org/pet-app",
              "organization": "my-org",
              "defaultBranch": "main"
            },
            "github": {
              "pullRequest": {
                "title": "Add default catalog-info.yaml to import to Red Hat Developer Hub"
              }
            }
          },
          {
            "approvalTool": "GIT",
            "repository": {
              "name": "project-zero",
              "url": "https://ghe.example.com/my-other-org/project-zero",
              "organization": "my-other-org",
              "defaultBranch": "dev"
            },
            "github": {
              "pullRequest": {
                "title": "Add custom catalog-info.yaml to import to Red Hat Developer Hub",
                "body": "This pull request adds a **Backstage entity metadata file** to this repository so that the component can be added to the Red Hat Developer Hub software catalog.\\n\\nAfter this pull request is merged, the component will become available.\\n\\nFor more information, read an [overview of the Backstage software catalog](https://backstage.io/docs/features/software-catalog/)."
              }
            },
            "catalogInfoContent": "apiVersion: backstage.io/v1alpha1\\nkind: Component\\nmetadata:\\n  name: project-zero\\n  annotations:\\n    github.com/project-slug: my-other-org/project-zero\\n    acme.com/custom-annotation: my-value\\nspec:\\n  type: other\\n  lifecycle: unknown\\n  owner: my-other-org"
          }
        ]
      }
    }
  }
}`;
const openApiDocument = JSON.parse(OPENAPI);

openapidocument_cjs.openApiDocument = openApiDocument;

var githubApiService_cjs = {};

var handlers_cjs = {};

const DefaultPageNumber = 1;
const DefaultPageSize = 20;

handlers_cjs.DefaultPageNumber = DefaultPageNumber;
handlers_cjs.DefaultPageSize = DefaultPageSize;

var GithubAppManager_cjs = {};

var authApp = require$$0$3;
var rest = require$$1$2;
var gitUrlParse$3 = require$$0$1;
var luxon = require$$3;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default$3 = /*#__PURE__*/_interopDefaultCompat$4(gitUrlParse$3);

class Cache {
  tokenCache = /* @__PURE__ */ new Map();
  isExpired(date) {
    return luxon.DateTime.local() > date;
  }
  async getOrCreateToken(key, supplier) {
    let existingInstallationData = this.tokenCache.get(key);
    if (!existingInstallationData || this.isExpired(existingInstallationData.expiresAt)) {
      existingInstallationData = await supplier();
      existingInstallationData.expiresAt = existingInstallationData.expiresAt.minus({ minutes: 10 });
      this.tokenCache.set(key, existingInstallationData);
    }
    return {
      accessToken: existingInstallationData.token,
      installationAccountLogin: existingInstallationData.installationAccountLogin
    };
  }
}
const HEADERS = {
  Accept: "application/vnd.github.machine-man-preview+json"
};
class GithubAppManager$1 {
  appClient;
  baseUrl;
  baseAuthConfig;
  cache = new Cache();
  allowedInstallationOwners;
  // undefined allows all installations
  constructor(config, baseUrl) {
    this.allowedInstallationOwners = config.allowedInstallationOwners;
    this.baseUrl = baseUrl;
    this.baseAuthConfig = {
      appId: config.appId,
      privateKey: config.privateKey.replace(/\\n/gm, "\n")
    };
    this.appClient = new rest.Octokit({
      baseUrl,
      headers: HEADERS,
      authStrategy: authApp.createAppAuth,
      auth: this.baseAuthConfig
    });
  }
  getAppId() {
    return this.baseAuthConfig.appId;
  }
  async getInstallationCredentials(host) {
    const creds = [];
    const installationData = await this.getInstallationData();
    let installationDataFiltered = [];
    if (this.allowedInstallationOwners) {
      for (const installation of installationData) {
        if (installation.accountLogin && !this.allowedInstallationOwners.includes(installation.accountLogin)) {
          continue;
        }
        installationDataFiltered.push(installation);
      }
    } else {
      installationDataFiltered = installationData;
    }
    if (installationDataFiltered.length === 0) {
      return Array.of({ accessToken: void 0 });
    }
    for (const installation of installationDataFiltered) {
      const installationId = installation.installationId;
      if (installation.suspended) {
        throw new Error(
          `The GitHub application for ${installationId} is suspended`
        );
      }
      const cred = await this.cache.getOrCreateToken(
        `${host}-${installationId}`,
        async () => {
          const result = await this.appClient.apps.createInstallationAccessToken({
            installation_id: installationId,
            headers: HEADERS
          });
          if (!result) {
            return {
              token: "",
              expiresAt: luxon.DateTime.now().plus({ minutes: 1 }),
              repositories: [],
              installationAccountLogin: installation.accountLogin
            };
          }
          let repositoryNames;
          if (result.data.repository_selection === "selected") {
            const installationClient = new rest.Octokit({
              baseUrl: this.baseUrl,
              auth: result.data.token
            });
            const repos = await installationClient.paginate(
              installationClient.apps.listReposAccessibleToInstallation
            );
            const repositories = repos.repositories ?? repos;
            repositoryNames = repositories.map((repository) => repository.name);
          }
          return {
            token: result.data.token,
            expiresAt: luxon.DateTime.fromISO(result.data.expires_at),
            repositories: repositoryNames,
            installationAccountLogin: installation.accountLogin
          };
        }
      );
      creds.push(cred);
    }
    return creds;
  }
  getInstallations() {
    return this.appClient.paginate(this.appClient.apps.listInstallations);
  }
  async getInstallationData() {
    const allInstallations = await this.getInstallations();
    return allInstallations.map((installation) => {
      return {
        installationId: installation.id,
        accountLogin: installation.account?.login,
        suspended: Boolean(installation.suspended_by)
      };
    });
  }
}
class GithubAppsCredentialManager {
  apps;
  constructor(config) {
    this.apps = config.apps?.map((ac) => new GithubAppManager$1(ac, config.apiBaseUrl)) ?? [];
  }
  async getAllInstallations() {
    if (!this.apps.length) {
      return [];
    }
    const installs = await Promise.all(
      this.apps.map((app) => app.getInstallations())
    );
    return installs.flat();
  }
  async getAppToken(host) {
    if (this.apps.length === 0) {
      return void 0;
    }
    const results = await Promise.all(
      this.apps.map(
        (app) => app.getInstallationCredentials(host).then(
          (credentials) => ({ credentials, error: void 0 }),
          (error) => ({ credentials: void 0, error })
        )
      )
    );
    const result = results.find(
      (resultItem) => resultItem.credentials && resultItem.credentials.length !== 0 && resultItem.credentials[0]?.accessToken
    );
    if (result?.credentials) {
      return result.credentials[0].accessToken;
    }
    const errors = results.map((r) => r.error);
    const notNotFoundError = errors.find((err) => err?.name !== "NotFoundError");
    if (notNotFoundError) {
      throw notNotFoundError;
    }
    return void 0;
  }
  /**
   * Returns an array of app access tokens.
   *
   * Some values in the array might not contain a token and will have an error field instead. This will need to be resolved on the user side
   */
  async getAllAppTokens(host) {
    if (this.apps.length === 0) return [];
    const appCredentials = await Promise.all(
      this.apps.map(
        (app) => app.getInstallationCredentials(host).then(
          (credentials2) => ({
            appId: app.getAppId(),
            credentials: credentials2,
            error: void 0
          }),
          (error) => ({ appId: app.getAppId(), credentials: void 0, error })
        )
      )
    );
    const credentials = [];
    for (const cred of appCredentials) {
      if (cred.credentials) {
        for (const credElement of cred.credentials) {
          credentials.push({
            appId: cred.appId,
            accessToken: credElement.accessToken,
            installationAccountLogin: credElement.installationAccountLogin
          });
        }
      } else {
        credentials.push({
          appId: cred.appId,
          error: cred.error
        });
      }
    }
    return credentials;
  }
}
class CustomSingleInstanceGithubCredentialsProvider {
  constructor(githubAppsCredentialManager, token) {
    this.githubAppsCredentialManager = githubAppsCredentialManager;
    this.token = token;
  }
  static create = (config) => {
    return new CustomSingleInstanceGithubCredentialsProvider(
      new GithubAppsCredentialManager(config),
      config.token
    );
  };
  /**
   * Returns {@link GithubCredentials} for a given URL.
   *
   * @remarks
   *
   * Consecutive calls to this method with the same URL will return cached
   * credentials.
   *
   * The shortest lifetime for a token returned is 10 minutes.
   *
   * @example
   * ```ts
   * const { token, headers } = await getCredentials({
   *   url: 'github.com/backstage/foobar'
   * })
   * ```
   *
   * @param opts - The organization or repository URL
   * @returns A promise of {@link GithubCredentials}.
   */
  async getCredentials(opts) {
    const parsed = gitUrlParse__default$3.default(opts.url);
    const owner = parsed.owner || parsed.name;
    let type = "app";
    let token = await this.githubAppsCredentialManager.getAppToken(owner);
    if (!token) {
      type = "token";
      token = this.token;
    }
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : void 0,
      token,
      type
    };
  }
  /**
   * Returns {@link ExtendedGithubCredentials[]} for a given URL.
   *
   * @remarks
   *
   * Consecutive calls to this method with the same URL will return cached
   * credentials.
   *
   * The shortest lifetime for a token returned is 10 minutes.
   *
   * Errors may be included in the returned array if the app credentials could not be fetched
   * These need to be dealt with by the user.
   *
   * @example
   * ```ts
   * const credentialList = await getCredentials({
   *   url: 'github.com/backstage/foobar'
   * })
   * for (const credential of credentialList){
   *   if (credential.type === 'app'){
   *     // Deal with the error if it exists
   *     if (credentials.error){
   *       console.error(`Error generating credential for ${credential.appId}: ${credential.error}`)
   *     }
   *     else {
   *       // Do something with the token
   *     }
   *   }
   *   else{
   *     // Do something with the token
   *   }
   *
   * }
   * ```
   *
   * @param opts - The organization or repository URL
   * @returns A promise of {@link ExtendedGithubCredentials[]}.
   */
  async getAllCredentials(opts) {
    const appCredentials = await this.githubAppsCredentialManager.getAllAppTokens(opts.host);
    const credentials = [];
    if (this.token) {
      credentials.push({
        headers: { Authorization: `Bearer ${this.token}` },
        token: this.token,
        type: "token"
      });
    }
    for (const app of appCredentials) {
      if ("accessToken" in app) {
        credentials.push({
          headers: { Authorization: `Bearer ${app.accessToken}` },
          token: app.accessToken,
          type: "app",
          appId: app.appId,
          accountLogin: app.installationAccountLogin
        });
      } else {
        credentials.push({
          type: "app",
          error: app.error,
          appId: app.appId
        });
      }
    }
    return credentials;
  }
}
class CustomGithubCredentialsProvider {
  constructor(providers) {
    this.providers = providers;
  }
  static fromIntegrations(integrations) {
    const credentialsProviders = /* @__PURE__ */ new Map();
    integrations.github.list().forEach((integration) => {
      const credentialsProvider = CustomSingleInstanceGithubCredentialsProvider.create(
        integration.config
      );
      credentialsProviders.set(integration.config.host, credentialsProvider);
    });
    return new CustomGithubCredentialsProvider(credentialsProviders);
  }
  /**
   * Returns {@link GithubCredentials} for a given URL.
   *
   * @remarks
   *
   * Consecutive calls to this method with the same URL will return cached
   * credentials.
   *
   * The shortest lifetime for a token returned is 10 minutes.
   *
   * @example
   * ```ts
   * const { token, headers } = await getCredentials({
   *   url: 'https://github.com/backstage/foobar'
   * })
   *
   * const { token, headers } = await getCredentials({
   *   url: 'https://github.com/backstage'
   * })
   * ```
   *
   * @param opts - The organization or repository URL
   * @returns A promise of {@link GithubCredentials}.
   */
  async getCredentials(opts) {
    const parsed = new URL(opts.url);
    const provider = this.providers.get(parsed.host);
    if (!provider) {
      throw new Error(
        `There is no GitHub integration that matches ${opts.url}. Please add a configuration for an integration.`
      );
    }
    return provider.getCredentials(opts);
  }
  async getAllCredentials(opts) {
    const provider = this.providers.get(opts.host);
    if (!provider) {
      throw new Error(
        `There is no GitHub integration that matches ${opts.host}. Please add a configuration for an integration.`
      );
    }
    return provider.getAllCredentials(opts);
  }
  async getAllAppInstallations(config) {
    return new GithubAppsCredentialManager(config).getAllInstallations();
  }
  async getAppInstallationsForOrg(config, org) {
    const all = await this.getAllAppInstallations(config);
    return all.filter((install) => install.account?.login === org);
  }
}

GithubAppManager_cjs.CustomGithubCredentialsProvider = CustomGithubCredentialsProvider;
GithubAppManager_cjs.CustomSingleInstanceGithubCredentialsProvider = CustomSingleInstanceGithubCredentialsProvider;
GithubAppManager_cjs.GithubAppsCredentialManager = GithubAppsCredentialManager;

var types_cjs = {};

function isGithubAppCredential(credential) {
  return "appId" in credential && credential.type === "app";
}

types_cjs.isGithubAppCredential = isGithubAppCredential;

var ghUtils_cjs = {};

var utils_cjs = {};

var repoUtils_cjs = {};

var orgUtils_cjs = {};

var pagination_cjs = {};

function paginateArray(array, page, size) {
  if (page <= 0) {
    throw new Error(`page must be >0. Got page=${page}`);
  }
  if (size < 0) {
    throw new Error(`size must be >=0. Got size=${size}`);
  }
  const startIndex = (page - 1) * size;
  const endIndex = startIndex + size;
  return {
    result: array?.slice(startIndex, endIndex) ?? [],
    totalCount: array?.length ?? 0
  };
}

pagination_cjs.paginateArray = paginateArray;

var hasRequiredOrgUtils_cjs;

function requireOrgUtils_cjs () {
	if (hasRequiredOrgUtils_cjs) return orgUtils_cjs;
	hasRequiredOrgUtils_cjs = 1;




	var loggingUtils = loggingUtils_cjs;
	var pagination = pagination_cjs;
	var handlers = handlers_cjs;
	var utils = requireUtils_cjs();

	async function getAllAppOrgs(githubCredentialsProvider, ghConfig, credentialAccountLogin) {
	  const result = /* @__PURE__ */ new Map();
	  const resp = await githubCredentialsProvider.getAllAppInstallations(ghConfig);
	  for (const installation of resp ?? []) {
	    if (!(installation.account && installation.target_type?.toLowerCase() === "organization")) {
	      continue;
	    }
	    const acc = installation.account;
	    if (credentialAccountLogin !== acc.login) {
	      continue;
	    }
	    result.set(acc.url, {
	      id: acc.id,
	      description: acc.description ?? void 0,
	      name: acc.login,
	      url: acc.html_url,
	      html_url: acc.html_url,
	      repos_url: acc.repos_url,
	      events_url: acc.events_url
	    });
	  }
	  return result;
	}
	async function addGithubAppOrgs(deps, octokit, ghConfig, params) {
	  const credentialAccountLogin = params.credentialAccountLogin;
	  const search = params.search;
	  const orgs = params.orgs;
	  const errors = params.errors;
	  let totalCount = 0;
	  try {
	    const resp = await getAllAppOrgs(
	      deps.githubCredentialsProvider,
	      ghConfig,
	      credentialAccountLogin
	    );
	    for (const [orgUrl, ghOrg] of resp) {
	      if (search && !ghOrg.name.toLowerCase().includes(search.toLowerCase())) {
	        continue;
	      }
	      const orgData = await octokit.request(
	        orgUrl.replace("/users/", "/orgs/")
	      );
	      orgs.set(ghOrg.name, {
	        ...ghOrg,
	        public_repos: orgData?.data?.public_repos,
	        total_private_repos: orgData?.data?.total_private_repos,
	        owned_private_repos: orgData?.data?.owned_private_repos
	      });
	      totalCount++;
	    }
	  } catch (err) {
	    loggingUtils.logErrorIfNeeded(
	      deps.logger,
	      `Fetching organizations with access token for github app`,
	      err
	    );
	    errors.set(-1, err.message);
	  }
	  return { totalCount };
	}
	async function addGithubTokenOrgs(deps, octokit, credential, params) {
	  const search = params.search;
	  const orgs = params.orgs;
	  const errors = params.errors;
	  const pageNumber = params.pageNumber ?? handlers.DefaultPageNumber;
	  const pageSize = params.pageSize ?? handlers.DefaultPageSize;
	  let totalCount;
	  try {
	    let matchingOrgs;
	    if (search) {
	      const resp = await octokit.paginate(
	        octokit.rest.orgs.listForAuthenticatedUser,
	        {
	          sort: "full_name",
	          direction: "asc"
	        }
	      );
	      const allMatchingOrgs = resp?.filter(
	        (org) => org.login.toLowerCase().includes(search.toLowerCase())
	      ) ?? [];
	      const matchingOrgsPage = pagination.paginateArray(
	        allMatchingOrgs,
	        pageNumber,
	        pageSize
	      );
	      matchingOrgs = matchingOrgsPage.result;
	      totalCount = matchingOrgsPage.totalCount;
	    } else {
	      const resp = await octokit.rest.orgs.listForAuthenticatedUser({
	        page: pageNumber,
	        per_page: pageSize,
	        sort: "full_name",
	        direction: "asc"
	      });
	      matchingOrgs = resp?.data ?? [];
	      totalCount = await utils.computeTotalCountFromGitHubToken(
	        deps,
	        async (lastPageNumber) => octokit.orgs.listForAuthenticatedUser({
	          page: lastPageNumber,
	          per_page: 100
	        }).then((lastPageResp) => lastPageResp.data.length),
	        "orgs.listForAuthenticatedUser",
	        resp?.data?.length,
	        resp?.headers?.link
	      );
	    }
	    for (const org of matchingOrgs) {
	      const orgData = await octokit.request(org.url);
	      const ghOrg = {
	        id: org.id,
	        name: org.login,
	        description: org.description ?? void 0,
	        url: orgData?.data?.html_url ?? org.url,
	        repos_url: org.repos_url,
	        hooks_url: org.hooks_url,
	        issues_url: org.issues_url,
	        members_url: org.members_url,
	        public_members_url: org.public_members_url,
	        avatar_url: org.avatar_url,
	        public_repos: orgData?.data?.public_repos,
	        total_private_repos: orgData?.data?.total_private_repos,
	        owned_private_repos: orgData?.data?.owned_private_repos
	      };
	      orgs.set(org.login, ghOrg);
	    }
	  } catch (err) {
	    utils.handleError(
	      { logger: deps.logger },
	      "Fetching orgs with token from token",
	      credential,
	      errors,
	      err
	    );
	  }
	  return { totalCount };
	}

	orgUtils_cjs.addGithubAppOrgs = addGithubAppOrgs;
	orgUtils_cjs.addGithubTokenOrgs = addGithubTokenOrgs;
	orgUtils_cjs.getAllAppOrgs = getAllAppOrgs;
	
	return orgUtils_cjs;
}

var hasRequiredRepoUtils_cjs;

function requireRepoUtils_cjs () {
	if (hasRequiredRepoUtils_cjs) return repoUtils_cjs;
	hasRequiredRepoUtils_cjs = 1;

	var gitUrlParse = require$$0$1;
	var catalogUtils = catalogUtils_cjs;



	var loggingUtils = loggingUtils_cjs;
	var handlers = handlers_cjs;
	var orgUtils = requireOrgUtils_cjs();
	var utils = requireUtils_cjs();

	function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

	var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

	async function validateAndBuildRepoData(githubCredentialsProvider, integrations, config, input) {
	  const ghConfig = integrations.github.byUrl(input.repoUrl)?.config;
	  if (!ghConfig) {
	    throw new Error(`Could not find GH integration from ${input.repoUrl}`);
	  }
	  const gitUrl = gitUrlParse__default.default(input.repoUrl);
	  const owner = gitUrl.organization;
	  const repo = gitUrl.name;
	  const credentials = await githubCredentialsProvider.getAllCredentials({
	    host: ghConfig.host
	  });
	  if (credentials.length === 0) {
	    throw new Error(`No credentials for GH integration`);
	  }
	  const branchName = catalogUtils.getBranchName(config);
	  return { ghConfig, owner, repo, credentials, branchName };
	}
	async function searchRepos(octokit, ghSearchQuery, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
	  const repoSearchResp = await octokit.rest.search.repos({
	    q: ghSearchQuery,
	    order: "asc",
	    page: pageNumber,
	    per_page: pageSize
	  });
	  return {
	    totalCount: repoSearchResp?.data?.total_count,
	    repositories: repoSearchResp?.data?.items?.map((repo) => {
	      return {
	        name: repo.name,
	        full_name: repo.full_name,
	        url: repo.url,
	        html_url: repo.html_url,
	        default_branch: repo.default_branch,
	        updated_at: repo.updated_at
	      };
	    }) ?? []
	  };
	}
	async function addGithubAppRepositories(deps, octokit, credential, ghConfig, repositories, errors, reqParams) {
	  const search = reqParams?.search;
	  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
	  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
	  let totalCount;
	  try {
	    if (search) {
	      const allOrgsMap = await orgUtils.getAllAppOrgs(
	        deps.githubCredentialsProvider,
	        ghConfig,
	        credential.accountLogin
	      );
	      const orgSearch = [];
	      for (const [_orgUrl, ghOrg] of allOrgsMap) {
	        orgSearch.push(`org:${ghOrg.name}`);
	      }
	      const query = `${search} in:name ${orgSearch.join(" ")}`;
	      const searchResp = await searchRepos(
	        octokit,
	        query,
	        pageNumber,
	        pageSize
	      );
	      totalCount = searchResp.totalCount;
	      searchResp.repositories.forEach(
	        (repo) => repositories.set(repo.full_name, repo)
	      );
	    } else {
	      const resp = await octokit.apps.listReposAccessibleToInstallation({
	        page: pageNumber,
	        per_page: pageSize
	      });
	      const repos = resp?.data?.repositories ?? resp?.data;
	      repos?.forEach((repo) => {
	        repositories.set(repo.full_name, {
	          name: repo.name,
	          full_name: repo.full_name,
	          url: repo.url,
	          html_url: repo.html_url,
	          default_branch: repo.default_branch,
	          updated_at: repo.updated_at
	        });
	      });
	      totalCount = resp?.data?.total_count;
	    }
	  } catch (err) {
	    loggingUtils.logErrorIfNeeded(
	      deps.logger,
	      `Fetching repositories with access token for github app ${credential.appId}`,
	      err
	    );
	    const credentialError = utils.createCredentialError(credential, err);
	    if (credentialError) {
	      errors.set(credential.appId, credentialError);
	    }
	  }
	  return { totalCount };
	}
	async function addGithubTokenRepositories(deps, octokit, credential, repositories, errors, reqParams) {
	  const search = reqParams?.search;
	  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
	  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
	  let totalCount;
	  try {
	    if (search) {
	      const username = (await octokit.rest.users.getAuthenticated())?.data?.login;
	      let query = `${search} in:name user:${username}`;
	      const allOrgsResp = await octokit.paginate(
	        octokit.rest.orgs.listForAuthenticatedUser,
	        {
	          sort: "full_name",
	          direction: "asc"
	        }
	      );
	      const orgSearch = [];
	      allOrgsResp?.forEach((org) => orgSearch.push(`org:${org.login}`));
	      if (orgSearch.length > 0) {
	        query += ` ${orgSearch.join(" ")}`;
	      }
	      const searchResp = await searchRepos(
	        octokit,
	        query,
	        pageNumber,
	        pageSize
	      );
	      totalCount = searchResp.totalCount;
	      searchResp.repositories.forEach(
	        (repo) => repositories.set(repo.full_name, repo)
	      );
	    } else {
	      const resp = await octokit.rest.repos.listForAuthenticatedUser({
	        page: pageNumber,
	        per_page: pageSize,
	        sort: "full_name",
	        direction: "asc"
	      });
	      resp?.data?.forEach((repo) => {
	        repositories.set(repo.full_name, {
	          name: repo.name,
	          full_name: repo.full_name,
	          url: repo.url,
	          html_url: repo.html_url,
	          default_branch: repo.default_branch,
	          updated_at: repo.updated_at
	        });
	      });
	      totalCount = await utils.computeTotalCountFromGitHubToken(
	        deps,
	        async (lastPageNumber) => octokit.repos.listForAuthenticatedUser({
	          page: lastPageNumber,
	          per_page: 100
	        }).then((lastPageResp) => lastPageResp.data.length),
	        "repos.listForAuthenticatedUser",
	        resp?.data?.length,
	        resp?.headers?.link
	      );
	    }
	  } catch (err) {
	    utils.handleError(
	      deps,
	      "Fetching repositories with token from token",
	      credential,
	      errors,
	      err
	    );
	  }
	  return { totalCount };
	}
	async function addGithubTokenOrgRepositories(deps, octokit, credential, org, repositories, errors, reqParams) {
	  const search = reqParams?.search;
	  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
	  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
	  let totalCount;
	  try {
	    if (search) {
	      const query = `${search} in:name org:${org}`;
	      const searchResp = await searchRepos(
	        octokit,
	        query,
	        pageNumber,
	        pageSize
	      );
	      totalCount = searchResp.totalCount;
	      searchResp.repositories.forEach(
	        (repo) => repositories.set(repo.full_name, repo)
	      );
	    } else {
	      const resp = await octokit.rest.repos.listForOrg({
	        org,
	        page: pageNumber,
	        per_page: pageSize,
	        sort: "full_name",
	        direction: "asc"
	      });
	      resp?.data?.forEach((repo) => {
	        const githubRepo = {
	          name: repo.name,
	          full_name: repo.full_name,
	          url: repo.url,
	          html_url: repo.html_url,
	          default_branch: repo.default_branch ?? "main",
	          updated_at: repo.updated_at
	        };
	        repositories.set(githubRepo.full_name, githubRepo);
	      });
	      totalCount = await utils.computeTotalCountFromGitHubToken(
	        deps,
	        async (lastPageNumber) => octokit.repos.listForOrg({
	          org,
	          page: lastPageNumber,
	          per_page: 100
	        }).then((lastPageResp) => lastPageResp.data.length),
	        "repos.listForOrg",
	        resp?.data?.length,
	        resp?.headers?.link
	      );
	    }
	  } catch (err) {
	    utils.handleError(
	      deps,
	      "Fetching org repositories with token from token",
	      credential,
	      errors,
	      err
	    );
	  }
	  return { totalCount };
	}
	async function fileExistsInDefaultBranch(logger, octo, owner, repo, fileName, defaultBranch = "main") {
	  try {
	    await octo.rest.repos.getContent({
	      owner,
	      repo,
	      path: fileName,
	      ref: defaultBranch
	    });
	    return true;
	  } catch (error) {
	    if (error.status === 404) {
	      return false;
	    }
	    logger.debug(
	      `Unable to determine if a file named ${fileName} already exists in repo ${repo}: ${error}`
	    );
	    return void 0;
	  }
	}
	async function createOrUpdateFileInBranch(octo, owner, repo, branchName, fileName, fileContent) {
	  try {
	    const { data: existingFile } = await octo.rest.repos.getContent({
	      owner,
	      repo,
	      path: fileName,
	      ref: branchName
	    });
	    if (Array.isArray(existingFile) || !("sha" in existingFile)) {
	      throw new Error(
	        `The content at path ${fileName} is not a file or the response from GitHub does not contain the 'sha' property.`
	      );
	    }
	    await octo.rest.repos.createOrUpdateFileContents({
	      owner,
	      repo,
	      path: fileName,
	      message: `Add ${fileName} config file`,
	      content: btoa(fileContent),
	      sha: existingFile.sha,
	      branch: branchName
	    });
	  } catch (error) {
	    if (error.status === 404) {
	      await octo.rest.repos.createOrUpdateFileContents({
	        owner,
	        repo,
	        path: fileName,
	        message: `Add ${fileName} config file`,
	        content: btoa(fileContent),
	        branch: branchName
	      });
	    } else {
	      throw error;
	    }
	  }
	}

	repoUtils_cjs.addGithubAppRepositories = addGithubAppRepositories;
	repoUtils_cjs.addGithubTokenOrgRepositories = addGithubTokenOrgRepositories;
	repoUtils_cjs.addGithubTokenRepositories = addGithubTokenRepositories;
	repoUtils_cjs.createOrUpdateFileInBranch = createOrUpdateFileInBranch;
	repoUtils_cjs.fileExistsInDefaultBranch = fileExistsInDefaultBranch;
	repoUtils_cjs.searchRepos = searchRepos;
	repoUtils_cjs.validateAndBuildRepoData = validateAndBuildRepoData;
	
	return repoUtils_cjs;
}

var hasRequiredUtils_cjs;

function requireUtils_cjs () {
	if (hasRequiredUtils_cjs) return utils_cjs;
	hasRequiredUtils_cjs = 1;

	var gitUrlParse = require$$0$1;



	var loggingUtils = loggingUtils_cjs;
	var types = types_cjs;
	var ghUtils = requireGhUtils_cjs();
	var repoUtils = requireRepoUtils_cjs();

	function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

	var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

	function createCredentialError(credential, err) {
	  if (err) {
	    if (types.isGithubAppCredential(credential)) {
	      return {
	        appId: credential.appId,
	        type: "app",
	        error: {
	          name: err.name,
	          message: err.message
	        }
	      };
	    }
	    return {
	      type: "token",
	      error: {
	        name: err.name,
	        message: err.message
	      }
	    };
	  }
	  if ("error" in credential) {
	    return {
	      appId: credential.appId,
	      type: "app",
	      error: {
	        name: credential.error.name,
	        message: credential.error.message
	      }
	    };
	  }
	  return void 0;
	}
	function verifyAndGetIntegrations(deps, integrations) {
	  const ghConfigs = integrations.github.list().map((ghInt) => ghInt.config);
	  if (ghConfigs.length === 0) {
	    deps.logger.debug(
	      "No GitHub Integration in config => returning an empty list of repositories."
	    );
	    throw new Error(
	      "Looks like there is no GitHub Integration in config. Please add a configuration entry under 'integrations.github"
	    );
	  }
	  return ghConfigs;
	}
	async function getCredentialsFromIntegrations(githubCredentialsProvider, ghConfigs) {
	  const credentialsByConfig = /* @__PURE__ */ new Map();
	  for (const ghConfig of ghConfigs) {
	    const creds = await getCredentialsForConfig(
	      githubCredentialsProvider,
	      ghConfig
	    );
	    credentialsByConfig.set(ghConfig, creds);
	  }
	  return credentialsByConfig;
	}
	async function getCredentialsForConfig(githubCredentialsProvider, ghConfig) {
	  return await githubCredentialsProvider.getAllCredentials({
	    host: ghConfig.host
	  });
	}
	function handleError(deps, desc, credential, errors, err) {
	  loggingUtils.logErrorIfNeeded(deps.logger, `${desc} failed`, err);
	  const credentialError = createCredentialError(credential, err);
	  if (credentialError) {
	    errors.set(-1, credentialError);
	  }
	}
	async function computeTotalCountFromGitHubToken(deps, lastPageDataLengthProviderFn, ghApiName, pageSize, linkHeader) {
	  if (!linkHeader) {
	    deps.logger.debug(
	      `No link header found in response from ${ghApiName} GH endpoint => returning current page size`
	    );
	    return pageSize;
	  }
	  const lastPageLink = linkHeader.split(",").find((s) => s.includes('rel="last"'));
	  if (!lastPageLink) {
	    deps.logger.debug(
	      `No rel='last' link found in response headers from ${ghApiName} GH endpoint => returning current page size`
	    );
	    return pageSize;
	  }
	  const match = lastPageLink.match(/page=(\d+)/);
	  if (!match || match.length < 2) {
	    deps.logger.debug(
	      `Unable to extract page number from rel='last' link found in response headers from ${ghApiName} GH endpoint => returning current page size`
	    );
	    return pageSize;
	  }
	  const lastPageNumber = parseInt(match[1], 10);
	  const lastPageDataLength = await lastPageDataLengthProviderFn(lastPageNumber);
	  return pageSize ? (lastPageNumber - 1) * pageSize + lastPageDataLength : void 0;
	}
	async function executeFunctionOnFirstSuccessfulIntegration(deps, integrations, params) {
	  const validatedRepo = await repoUtils.validateAndBuildRepoData(
	    deps.githubCredentialsProvider,
	    integrations,
	    deps.config,
	    params
	  );
	  for (const credential of validatedRepo.credentials) {
	    const octo = ghUtils.buildOcto(
	      {
	        logger: deps.logger,
	        cache: deps.cache
	      },
	      { credential, owner: validatedRepo.owner },
	      validatedRepo.ghConfig.apiBaseUrl
	    );
	    if (!octo) {
	      continue;
	    }
	    const res = await params.fn(validatedRepo, octo);
	    if (!res.successful) {
	      continue;
	    }
	    return res.result;
	  }
	  return void 0;
	}
	async function fetchFromAllIntegrations(deps, integrations, params) {
	  const ghConfigs = verifyAndGetIntegrations(deps, integrations);
	  const credentialsByConfig = await getCredentialsFromIntegrations(
	    deps.githubCredentialsProvider,
	    ghConfigs
	  );
	  const errors = /* @__PURE__ */ new Map();
	  const data = [];
	  const dataErrs = [];
	  let stopFetchingData = false;
	  for (const [ghConfig, credentials] of credentialsByConfig) {
	    if (stopFetchingData) {
	      break;
	    }
	    deps.logger.debug(
	      `Got ${credentials.length} credential(s) for ${ghConfig.host}`
	    );
	    for (const credential of credentials) {
	      const octokit = ghUtils.buildOcto(
	        deps,
	        { credential, errors },
	        ghConfig.apiBaseUrl
	      );
	      if (!octokit) {
	        continue;
	      }
	      const res = await params.dataFetcher(octokit, credential, ghConfig);
	      res.errors?.forEach((err) => dataErrs.push(err));
	      if (res.result) {
	        data.push(res.result);
	      }
	      stopFetchingData = res.stopFetchingData;
	    }
	  }
	  const aggregatedErrors = /* @__PURE__ */ new Map();
	  errors.forEach((err, num) => aggregatedErrors.set(num, err));
	  dataErrs.forEach((err, idx) => aggregatedErrors.set(idx, err));
	  return { data, errors: aggregatedErrors };
	}
	function computeTotalCount(data, countList, pageSize) {
	  let totalCount = countList.reduce(
	    (accumulator, currentValue) => accumulator + currentValue,
	    0
	  );
	  if (totalCount < pageSize) {
	    totalCount = data.length;
	  }
	  return totalCount;
	}
	function extractLocationOwnerMap(locationUrls) {
	  const locationGitOwnerMap = /* @__PURE__ */ new Map();
	  for (const locationUrl of locationUrls) {
	    const split = locationUrl.split("/blob/");
	    if (split.length < 2) {
	      continue;
	    }
	    locationGitOwnerMap.set(locationUrl, gitUrlParse__default.default(split[0]).owner);
	  }
	  return locationGitOwnerMap;
	}

	utils_cjs.computeTotalCount = computeTotalCount;
	utils_cjs.computeTotalCountFromGitHubToken = computeTotalCountFromGitHubToken;
	utils_cjs.createCredentialError = createCredentialError;
	utils_cjs.executeFunctionOnFirstSuccessfulIntegration = executeFunctionOnFirstSuccessfulIntegration;
	utils_cjs.extractLocationOwnerMap = extractLocationOwnerMap;
	utils_cjs.fetchFromAllIntegrations = fetchFromAllIntegrations;
	utils_cjs.getCredentialsForConfig = getCredentialsForConfig;
	utils_cjs.getCredentialsFromIntegrations = getCredentialsFromIntegrations;
	utils_cjs.handleError = handleError;
	utils_cjs.verifyAndGetIntegrations = verifyAndGetIntegrations;
	
	return utils_cjs;
}

var hasRequiredGhUtils_cjs;

function requireGhUtils_cjs () {
	if (hasRequiredGhUtils_cjs) return ghUtils_cjs;
	hasRequiredGhUtils_cjs = 1;

	var rest = require$$1$2;
	var types = types_cjs;
	var utils = requireUtils_cjs();

	const GITHUB_DEFAULT_API_ENDPOINT = "https://api.github.com";
	const RESPONSE_CACHE_TTL_MILLIS = 60 * 60 * 1e3;
	function buildOcto(deps, input, apiBaseUrl = GITHUB_DEFAULT_API_ENDPOINT) {
	  if ("error" in input.credential) {
	    if (input.credential.error?.name !== "NotFoundError") {
	      deps.logger.error(
	        `Obtaining the Access Token Github App with appId: ${input.credential.appId} failed with ${input.credential.error}`
	      );
	      const credentialError = utils.createCredentialError(input.credential);
	      if (credentialError) {
	        deps.logger.debug(`${input.credential.appId}: ${credentialError}`);
	        if (input.errors) {
	          input.errors.set(input.credential.appId, credentialError);
	        }
	      }
	    }
	    return void 0;
	  }
	  if (types.isGithubAppCredential(input.credential) && input.owner && input.credential.accountLogin !== input.owner) {
	    return void 0;
	  }
	  const octokit = new rest.Octokit({
	    baseUrl: apiBaseUrl,
	    auth: input.credential.token
	  });
	  registerHooks(deps, octokit);
	  return octokit;
	}
	function registerHooks(deps, octokit) {
	  const extractCacheKey = (options) => `${options.method}--${tryReplacingPlaceholdersInUrl(options)}`;
	  octokit.hook.before("request", async (options) => {
	    if (!options.headers) {
	      options.headers = {
	        accept: "application/json",
	        "user-agent": "rhdh/bulk-import"
	      };
	    }
	    const cacheKey = extractCacheKey(options);
	    const existingEtag = await deps.cache.get(cacheKey)?.then((val) => val?.etag);
	    if (existingEtag) {
	      options.headers["If-None-Match"] = existingEtag;
	    } else {
	      deps.logger.debug(`cache miss for key "${cacheKey}"`);
	    }
	  });
	  octokit.hook.after("request", async (response, options) => {
	    deps.logger.debug(
	      `[GH API] ${options.method} ${tryReplacingPlaceholdersInUrl(options)}: ${response.status}`
	    );
	    const cacheKey = extractCacheKey(options);
	    await deps.cache.set(
	      cacheKey,
	      {
	        etag: response.headers.etag,
	        ...response
	      },
	      { ttl: RESPONSE_CACHE_TTL_MILLIS }
	    );
	  });
	  octokit.hook.error("request", async (error, options) => {
	    deps.logger.debug(
	      `[GH API] ${options.method} ${tryReplacingPlaceholdersInUrl(options)}: ${error.status}`
	    );
	    if (error.status !== 304) {
	      throw error;
	    }
	    return await deps.cache.get(extractCacheKey(options));
	  });
	}
	function tryReplacingPlaceholdersInUrl(options) {
	  let result = "";
	  let startIdx = 0;
	  const url = options.url;
	  if (!url) {
	    return void 0;
	  }
	  while (startIdx < url.length) {
	    const openBraceIdx = url.indexOf("{", startIdx);
	    if (openBraceIdx === -1) {
	      result += url.slice(startIdx);
	      break;
	    }
	    result += url.slice(startIdx, openBraceIdx);
	    const closeBraceIdx = url.indexOf("}", openBraceIdx);
	    if (closeBraceIdx === -1) {
	      result += url.slice(openBraceIdx);
	      break;
	    }
	    const key = url.slice(openBraceIdx + 1, closeBraceIdx);
	    result += options[key] ?? `{${key}}`;
	    startIdx = closeBraceIdx + 1;
	  }
	  return result;
	}

	ghUtils_cjs.buildOcto = buildOcto;
	
	return ghUtils_cjs;
}

var prUtils_cjs = {};

var catalogUtils$3 = catalogUtils_cjs;



var loggingUtils$2 = loggingUtils_cjs;

async function findOpenPRForBranch(logger, config, octo, owner, repo, branchName, withCatalogInfoContent = false) {
  try {
    const response = await octo.rest.pulls.list({
      owner,
      repo,
      state: "open"
    });
    for (const pull of response.data) {
      if (pull.head.ref === branchName) {
        return {
          prNum: pull.number,
          prUrl: pull.html_url,
          prTitle: pull.title,
          prBody: pull.body ?? void 0,
          prCatalogInfoContent: withCatalogInfoContent ? await getCatalogInfoContentFromPR(
            logger,
            config,
            octo,
            owner,
            repo,
            pull.number,
            pull.head.sha
          ) : void 0,
          lastUpdate: pull.updated_at
        };
      }
    }
  } catch (error) {
    loggingUtils$2.logErrorIfNeeded(logger, "Error fetching pull requests", error);
  }
  return {};
}
async function getCatalogInfoContentFromPR(logger, config, octo, owner, repo, prNumber, prHeadSha) {
  try {
    const filePath = catalogUtils$3.getCatalogFilename(config);
    const fileContentResponse = await octo.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: prHeadSha
    });
    if (!fileContentResponse.data) {
      return void 0;
    }
    if (!("content" in fileContentResponse.data)) {
      return void 0;
    }
    return Buffer.from(fileContentResponse.data.content, "base64").toString(
      "utf-8"
    );
  } catch (error) {
    loggingUtils$2.logErrorIfNeeded(
      logger,
      `Error fetching catalog-info content from PR ${prNumber}`,
      error
    );
    return void 0;
  }
}
async function closePRWithComment(octo, owner, repo, prNum, comment) {
  await octo.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNum,
    body: comment
  });
  await octo.rest.pulls.update({
    owner,
    repo,
    pull_number: prNum,
    state: "closed"
  });
}

prUtils_cjs.closePRWithComment = closePRWithComment;
prUtils_cjs.findOpenPRForBranch = findOpenPRForBranch;

var integration = require$$0$4;
var gitUrlParse$2 = require$$0$1;
var catalogUtils$2 = catalogUtils_cjs;



var loggingUtils$1 = loggingUtils_cjs;
var handlers$3 = handlers_cjs;
var GithubAppManager = GithubAppManager_cjs;
var types = types_cjs;
var ghUtils = requireGhUtils_cjs();
var orgUtils = requireOrgUtils_cjs();
var prUtils = prUtils_cjs;
var repoUtils = requireRepoUtils_cjs();
var utils = requireUtils_cjs();

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default$2 = /*#__PURE__*/_interopDefaultCompat$3(gitUrlParse$2);

class GithubApiService {
  logger;
  integrations;
  githubCredentialsProvider;
  config;
  // Cache for storing ETags (used for efficient caching of unchanged data returned by GitHub)
  cache;
  constructor(logger, config, cacheService) {
    this.logger = logger;
    this.config = config;
    this.integrations = integration.ScmIntegrations.fromConfig(config);
    this.githubCredentialsProvider = GithubAppManager.CustomGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.cache = cacheService;
  }
  async getRepositoryFromIntegrations(repoUrl) {
    const gitUrl = gitUrlParse__default$2.default(repoUrl);
    const ghConfig = this.integrations.github.byUrl(repoUrl)?.config;
    if (!ghConfig) {
      throw new Error(
        `No GitHub integration config found for repo ${repoUrl}. Please add a configuration entry under 'integrations.github`
      );
    }
    const credentials = await utils.getCredentialsForConfig(
      this.githubCredentialsProvider,
      ghConfig
    );
    const errors = /* @__PURE__ */ new Map();
    let repository = void 0;
    for (const credential of credentials) {
      const octokit = ghUtils.buildOcto(
        {
          logger: this.logger,
          cache: this.cache
        },
        { credential, errors, owner: gitUrl.owner },
        ghConfig.apiBaseUrl
      );
      if (!octokit) {
        continue;
      }
      const resp = await octokit.rest.repos.get({
        owner: gitUrl.owner,
        repo: gitUrl.name
      });
      const repo = resp?.data;
      if (!repo) {
        continue;
      }
      repository = {
        name: repo.name,
        full_name: repo.full_name,
        url: repo.url,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at
      };
      break;
    }
    return {
      repository,
      errors: Array.from(errors.values())
    };
  }
  async getOrganizationsFromIntegrations(search, pageNumber = handlers$3.DefaultPageNumber, pageSize = handlers$3.DefaultPageSize) {
    const orgs = /* @__PURE__ */ new Map();
    const result = await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          const dataFetchErrors = /* @__PURE__ */ new Map();
          const resp = types.isGithubAppCredential(credential) ? await orgUtils.addGithubAppOrgs(
            {
              logger: this.logger,
              githubCredentialsProvider: this.githubCredentialsProvider
            },
            octokit,
            ghConfig,
            {
              credentialAccountLogin: credential.accountLogin,
              search,
              orgs,
              errors: dataFetchErrors
            }
          ) : await orgUtils.addGithubTokenOrgs(
            {
              logger: this.logger
            },
            octokit,
            credential,
            {
              search,
              orgs,
              pageNumber,
              pageSize,
              errors: dataFetchErrors
            }
          );
          this.logger.debug(
            `Got ${resp.totalCount} org(s) for ${ghConfig.host}`
          );
          return {
            result: resp.totalCount ?? 0,
            errors: Array.from(dataFetchErrors.values())
          };
        }
      }
    );
    const orgList = Array.from(orgs.values());
    const totalCount = utils.computeTotalCount(orgList, result.data, pageSize);
    return {
      organizations: orgList,
      errors: Array.from(result.errors?.values() ?? []),
      totalCount
    };
  }
  async getOrgRepositoriesFromIntegrations(orgName, search, pageNumber = handlers$3.DefaultPageNumber, pageSize = handlers$3.DefaultPageSize) {
    const repositories = /* @__PURE__ */ new Map();
    const result = await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          const dataFetchErrors = /* @__PURE__ */ new Map();
          let resp;
          if (types.isGithubAppCredential(credential)) {
            if (credential.accountLogin !== orgName) {
              return {};
            }
            resp = await repoUtils.addGithubAppRepositories(
              {
                logger: this.logger,
                githubCredentialsProvider: this.githubCredentialsProvider
              },
              octokit,
              credential,
              ghConfig,
              repositories,
              dataFetchErrors,
              {
                search,
                pageNumber,
                pageSize
              }
            );
          } else {
            resp = await repoUtils.addGithubTokenOrgRepositories(
              {
                logger: this.logger
              },
              octokit,
              credential,
              orgName,
              repositories,
              dataFetchErrors,
              {
                search,
                pageNumber,
                pageSize
              }
            );
          }
          this.logger.debug(
            `Got ${resp.totalCount} org repo(s) for ${ghConfig.host}`
          );
          return {
            stopFetchingData: true,
            result: resp.totalCount ?? 0,
            errors: Array.from(dataFetchErrors.values())
          };
        }
      }
    );
    const repoList = Array.from(repositories.values());
    const totalCount = utils.computeTotalCount(repoList, result.data, pageSize);
    return {
      repositories: repoList,
      errors: Array.from(result.errors?.values() ?? []),
      totalCount
    };
  }
  /**
   * Returns GithubRepositoryResponse containing:
   *   - a list of unique repositories the github integrations have access to
   *   - a list of errors encountered by each app and/or token (if any exist)
   */
  async getRepositoriesFromIntegrations(search, pageNumber = handlers$3.DefaultPageNumber, pageSize = handlers$3.DefaultPageSize) {
    const repositories = /* @__PURE__ */ new Map();
    const result = await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          const dataFetchErrors = /* @__PURE__ */ new Map();
          const resp = types.isGithubAppCredential(credential) ? await repoUtils.addGithubAppRepositories(
            {
              logger: this.logger,
              githubCredentialsProvider: this.githubCredentialsProvider
            },
            octokit,
            credential,
            ghConfig,
            repositories,
            dataFetchErrors,
            {
              search,
              pageNumber,
              pageSize
            }
          ) : await repoUtils.addGithubTokenRepositories(
            {
              logger: this.logger
            },
            octokit,
            credential,
            repositories,
            dataFetchErrors,
            {
              search,
              pageNumber,
              pageSize
            }
          );
          this.logger.debug(
            `Got ${resp.totalCount} repo(s) for ${ghConfig.host}`
          );
          return {
            result: resp.totalCount ?? 0,
            errors: Array.from(dataFetchErrors.values())
          };
        }
      }
    );
    const repoList = Array.from(repositories.values());
    const totalCount = utils.computeTotalCount(repoList, result.data, pageSize);
    return {
      repositories: repoList,
      errors: Array.from(result.errors?.values() ?? []),
      totalCount
    };
  }
  async filterLocationsAccessibleFromIntegrations(locationUrls) {
    const locationGitOwnerMap = utils.extractLocationOwnerMap(locationUrls);
    const allAccessibleAppOrgs = /* @__PURE__ */ new Set();
    const allAccessibleTokenOrgs = /* @__PURE__ */ new Set();
    const allAccessibleUsernames = /* @__PURE__ */ new Set();
    await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          if (types.isGithubAppCredential(credential)) {
            const appOrgMap = await orgUtils.getAllAppOrgs(
              this.githubCredentialsProvider,
              ghConfig,
              credential.accountLogin
            );
            for (const [_, ghOrg] of appOrgMap) {
              allAccessibleAppOrgs.add(ghOrg.name);
            }
          } else {
            const username = (await octokit.rest.users.getAuthenticated())?.data?.login;
            if (username) {
              allAccessibleUsernames.add(username);
            }
            (await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser))?.map((org) => org.login)?.forEach((orgName) => allAccessibleTokenOrgs.add(orgName));
          }
          return {};
        }
      }
    );
    return locationUrls.filter((loc) => {
      if (!locationGitOwnerMap.has(loc)) {
        return false;
      }
      const owner = locationGitOwnerMap.get(loc);
      return allAccessibleAppOrgs.has(owner) || allAccessibleTokenOrgs.has(owner) || allAccessibleUsernames.has(owner);
    });
  }
  async findImportOpenPr(logger, input) {
    const ghConfig = this.integrations.github.byUrl(input.repoUrl)?.config;
    if (!ghConfig) {
      throw new Error(`Could not find GH integration from ${input.repoUrl}`);
    }
    const gitUrl = gitUrlParse__default$2.default(input.repoUrl);
    const owner = gitUrl.organization;
    const repo = gitUrl.name;
    const credentials = await this.githubCredentialsProvider.getAllCredentials({
      host: ghConfig.host
    });
    if (credentials.length === 0) {
      throw new Error(`No credentials for GH integration`);
    }
    const branchName = catalogUtils$2.getBranchName(this.config);
    for (const credential of credentials) {
      const octo = ghUtils.buildOcto(
        {
          logger: this.logger,
          cache: this.cache
        },
        { credential, owner },
        ghConfig.apiBaseUrl
      );
      if (!octo) {
        continue;
      }
      try {
        return await prUtils.findOpenPRForBranch(
          logger,
          this.config,
          octo,
          owner,
          repo,
          branchName,
          input.includeCatalogInfoContent
        );
      } catch (error) {
        loggingUtils$1.logErrorIfNeeded(this.logger, "Error fetching pull requests", error);
      }
    }
    return {};
  }
  async submitPrToRepo(logger, input) {
    const fileName = catalogUtils$2.getCatalogFilename(this.config);
    const errors = [];
    const result = await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo, branchName } = validatedRepo;
          try {
            const catalogInfoFileExists = await repoUtils.fileExistsInDefaultBranch(
              logger,
              octo,
              owner,
              repo,
              fileName,
              input.defaultBranch
            );
            if (catalogInfoFileExists) {
              return {
                successful: true,
                result: {
                  hasChanges: false
                }
              };
            }
            const existingPrForBranch = await prUtils.findOpenPRForBranch(
              logger,
              this.config,
              octo,
              owner,
              repo,
              branchName
            );
            const repoData = await octo.rest.repos.get({
              owner,
              repo
            });
            const parentRef = await octo.rest.git.getRef({
              owner,
              repo,
              ref: `heads/${repoData.data.default_branch}`
            });
            if (existingPrForBranch.prNum) {
              await repoUtils.createOrUpdateFileInBranch(
                octo,
                owner,
                repo,
                branchName,
                fileName,
                input.catalogInfoContent
              );
              const pullRequestResponse2 = await octo.rest.pulls.update({
                owner,
                repo,
                pull_number: existingPrForBranch.prNum,
                title: input.prTitle,
                body: input.prBody,
                head: branchName,
                base: repoData.data.default_branch
              });
              return {
                successful: true,
                result: {
                  prNumber: existingPrForBranch.prNum,
                  prUrl: pullRequestResponse2.data.html_url,
                  lastUpdate: pullRequestResponse2.data.updated_at
                }
              };
            }
            let branchExists = false;
            try {
              await octo.rest.git.getRef({
                owner,
                repo,
                ref: `heads/${branchName}`
              });
              branchExists = true;
            } catch (error) {
              if (error.status === 404) {
                await octo.rest.git.createRef({
                  owner,
                  repo,
                  ref: `refs/heads/${branchName}`,
                  sha: parentRef.data.object.sha
                });
              } else {
                throw error;
              }
            }
            if (branchExists) {
              try {
                await octo.repos.merge({
                  owner,
                  repo,
                  base: branchName,
                  head: repoData.data.default_branch
                });
              } catch (error) {
                loggingUtils$1.logErrorIfNeeded(
                  this.logger,
                  `Could not merge default branch ${repoData.data.default_branch} into import branch ${branchName}`,
                  error
                );
              }
            }
            await repoUtils.createOrUpdateFileInBranch(
              octo,
              owner,
              repo,
              branchName,
              fileName,
              input.catalogInfoContent
            );
            const pullRequestResponse = await octo.rest.pulls.create({
              owner,
              repo,
              title: input.prTitle,
              body: input.prBody,
              head: branchName,
              base: repoData.data.default_branch
            });
            return {
              successful: true,
              result: {
                prNumber: pullRequestResponse.data.number,
                prUrl: pullRequestResponse.data.html_url,
                lastUpdate: pullRequestResponse.data.updated_at,
                hasChanges: true
              }
            };
          } catch (e) {
            loggingUtils$1.logErrorIfNeeded(
              this.logger,
              `Couldn't create PR in ${input.repoUrl}`,
              e
            );
            errors.push(e.message);
            return { successful: false };
          }
        }
      }
    );
    if (result) {
      return result;
    }
    logger.warn(
      `Tried all possible GitHub credentials, but could not create PR in ${input.repoUrl}. Please try again later...`
    );
    return {
      errors
    };
  }
  async hasFileInRepo(input) {
    const fileExists = await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo } = validatedRepo;
          const exists = await repoUtils.fileExistsInDefaultBranch(
            this.logger,
            octo,
            owner,
            repo,
            input.fileName,
            input.defaultBranch
          );
          if (exists === void 0) {
            return { successful: false };
          }
          return { successful: true, result: exists };
        }
      }
    );
    if (fileExists === void 0) {
      throw new Error(
        `Could not determine if repo at ${input.repoUrl} already has a file named ${input.fileName} in its default branch (${input.defaultBranch})`
      );
    }
    return fileExists;
  }
  async closeImportPR(logger, input) {
    await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo, branchName } = validatedRepo;
          try {
            const existingPrForBranch = await prUtils.findOpenPRForBranch(
              logger,
              this.config,
              octo,
              owner,
              repo,
              branchName
            );
            if (existingPrForBranch.prNum) {
              await prUtils.closePRWithComment(
                octo,
                owner,
                repo,
                existingPrForBranch.prNum,
                input.comment
              );
            }
            return { successful: true };
          } catch (e) {
            loggingUtils$1.logErrorIfNeeded(
              this.logger,
              `Couldn't close PR in ${input.repoUrl}`,
              e
            );
            return { successful: false };
          }
        }
      }
    );
  }
  async deleteImportBranch(input) {
    await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo, branchName } = validatedRepo;
          try {
            await octo.git.deleteRef({
              owner,
              repo,
              ref: `heads/${branchName}`
            });
            return { successful: true };
          } catch (e) {
            loggingUtils$1.logErrorIfNeeded(
              this.logger,
              `Couldn't close import PR and/or delete import branch in ${input.repoUrl}`,
              e
            );
            return { successful: false };
          }
        }
      }
    );
  }
  async isRepoEmpty(input) {
    return await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo } = validatedRepo;
          const resp = await octo.rest.repos.listContributors({
            owner,
            repo,
            page: 1,
            per_page: 1
          });
          const status = resp.status;
          return { successful: true, result: status === 204 };
        }
      }
    );
  }
}

githubApiService_cjs.GithubApiService = GithubApiService;

var bulkImports_cjs = {};

var gitUrlParse$1 = require$$0$1;
var catalogUtils$1 = catalogUtils_cjs;



var loggingUtils = loggingUtils_cjs;
var pagination = pagination_cjs;
var handlers$2 = handlers_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default$1 = /*#__PURE__*/_interopDefaultCompat$2(gitUrlParse$1);

function sortImports(imports) {
  imports.sort((a, b) => {
    if (a.repository?.name === void 0 && b.repository?.name === void 0) {
      return 0;
    }
    if (a.repository?.name === void 0) {
      return -1;
    }
    if (b.repository?.name === void 0) {
      return 1;
    }
    return a.repository.name.localeCompare(b.repository.name);
  });
}
async function findAllImports(deps, requestHeaders, queryParams) {
  const apiVersion = requestHeaders?.apiVersion ?? "v1";
  const search = queryParams?.search;
  const pageNumber = queryParams?.pageNumber ?? handlers$2.DefaultPageNumber;
  const pageSize = queryParams?.pageSize ?? handlers$2.DefaultPageSize;
  deps.logger.debug(
    `Getting all bulk import jobs (apiVersion=${apiVersion}, search=${search}, page=${pageNumber}, size=${pageSize})..`
  );
  const catalogFilename = catalogUtils$1.getCatalogFilename(deps.config);
  const allLocations = (await deps.catalogHttpClient.listCatalogUrlLocations(
    search,
    pageNumber,
    pageSize
  )).targetUrls;
  const defaultBranchByRepoUrl = await resolveReposDefaultBranches(
    deps.logger,
    deps.githubApiService,
    allLocations,
    catalogFilename
  );
  const importCandidates = findImportCandidates(
    allLocations,
    defaultBranchByRepoUrl,
    catalogFilename
  );
  const importsReachableFromGHIntegrations = await deps.githubApiService.filterLocationsAccessibleFromIntegrations(
    importCandidates
  );
  const importStatusPromises = [];
  for (const loc of importsReachableFromGHIntegrations) {
    const repoUrl = repoUrlFromLocation(loc);
    if (!repoUrl) {
      continue;
    }
    importStatusPromises.push(
      findImportStatusByRepo(
        deps,
        repoUrl,
        defaultBranchByRepoUrl.get(repoUrl),
        false
      )
    );
  }
  const result = await Promise.all(importStatusPromises);
  const imports = result.filter((res) => res.responseBody).map((res) => res.responseBody);
  sortImports(imports);
  const paginated = pagination.paginateArray(imports, pageNumber, pageSize);
  if (apiVersion === "v1") {
    return {
      statusCode: 200,
      responseBody: paginated.result
    };
  }
  return {
    statusCode: 200,
    responseBody: {
      imports: paginated.result,
      totalCount: paginated.totalCount,
      page: pageNumber,
      size: pageSize
    }
  };
}
async function resolveReposDefaultBranches(logger, githubApiService, allLocations, catalogFilename) {
  const defaultBranchByRepoUrlPromises = [];
  for (const loc of allLocations) {
    if (!loc.endsWith(catalogFilename)) {
      logger.debug(
        `Ignored location ${loc} because it does not point to a file named ${catalogFilename}`
      );
      continue;
    }
    const repoUrl = repoUrlFromLocation(loc);
    if (!repoUrl) {
      continue;
    }
    defaultBranchByRepoUrlPromises.push(
      githubApiService.getRepositoryFromIntegrations(repoUrl).then((resp) => {
        return { repoUrl, defaultBranch: resp?.repository?.default_branch };
      }).catch((err) => {
        loggingUtils.logErrorIfNeeded(
          logger,
          `Ignored repo ${repoUrl} due to an error while fetching details from GitHub`,
          err
        );
        return {
          repoUrl,
          defaultBranch: void 0
        };
      })
    );
  }
  const defaultBranchesResponses = await Promise.all(
    defaultBranchByRepoUrlPromises
  );
  return new Map(
    defaultBranchesResponses.flat().filter((r) => r.defaultBranch).map((r) => [r.repoUrl, r.defaultBranch])
  );
}
function repoUrlFromLocation(loc) {
  const split = loc.split("/blob/");
  if (split.length < 2) {
    return void 0;
  }
  return split[0];
}
function findImportCandidates(allLocations, defaultBranchByRepoUrl, catalogFilename) {
  const filteredLocations = [];
  for (const loc of allLocations) {
    const repoUrl = repoUrlFromLocation(loc);
    if (!repoUrl) {
      continue;
    }
    const defaultBranch = defaultBranchByRepoUrl.get(repoUrl);
    if (!defaultBranch) {
      continue;
    }
    if (loc !== `${repoUrl}/blob/${defaultBranch}/${catalogFilename}`) {
      continue;
    }
    filteredLocations.push(loc);
  }
  return filteredLocations;
}
async function createPR(githubApiService, logger, req, gitUrl, catalogInfoGenerator, config) {
  const appTitle = config.getOptionalString("app.title") ?? "Red Hat Developer Hub";
  const appBaseUrl = config.getString("app.baseUrl");
  const catalogFileName = catalogUtils$1.getCatalogFilename(config);
  return await githubApiService.submitPrToRepo(logger, {
    repoUrl: req.repository.url,
    gitUrl,
    defaultBranch: req.repository.defaultBranch,
    catalogInfoContent: req.catalogInfoContent ?? await catalogInfoGenerator.generateDefaultCatalogInfoContent(
      req.repository.url
    ),
    prTitle: req.github?.pullRequest?.title ?? `Add ${catalogFileName}`,
    prBody: req.github?.pullRequest?.body ?? `
This pull request adds a **Backstage entity metadata file** to this repository so that the component can be added to a Backstage application.

After this pull request is merged, the component will become available in the [${appTitle} software catalog](${appBaseUrl}).

For more information, read an [overview of the Backstage software catalog](https://backstage.io/docs/features/software-catalog/).
`
  });
}
async function handleAddedReposFromCreateImportJobs(deps, importRequests) {
  const result = [];
  for (const req of importRequests) {
    const repoCatalogUrl = catalogUtils$1.getCatalogUrl(
      deps.config,
      req.repository.url,
      req.repository.defaultBranch
    );
    const hasLocation = await deps.catalogHttpClient.verifyLocationExistence(
      repoCatalogUrl
    );
    if (!hasLocation) {
      continue;
    }
    const hasCatalogInfoFileInRepo = await deps.githubApiService.hasFileInRepo({
      repoUrl: req.repository.url,
      defaultBranch: req.repository.defaultBranch,
      fileName: catalogUtils$1.getCatalogFilename(deps.config)
    });
    if (!hasCatalogInfoFileInRepo) {
      continue;
    }
    const ghRepo = await deps.githubApiService.getRepositoryFromIntegrations(
      req.repository.url
    );
    await deps.catalogHttpClient.refreshLocationByRepoUrl(
      req.repository.url,
      req.repository.defaultBranch
    );
    const gitUrl = gitUrlParse__default$1.default(req.repository.url);
    result.push({
      status: "ADDED",
      lastUpdate: ghRepo?.repository?.updated_at ?? void 0,
      repository: {
        url: req.repository.url,
        name: gitUrl.name,
        organization: gitUrl.organization
      }
    });
  }
  return result;
}
async function handlePrCreationRequest(deps, req, gitUrl) {
  const repoCatalogUrl = catalogUtils$1.getCatalogUrl(
    deps.config,
    req.repository.url,
    req.repository.defaultBranch
  );
  const prToRepo = await createPR(
    deps.githubApiService,
    deps.logger,
    req,
    gitUrl,
    deps.catalogInfoGenerator,
    deps.config
  );
  if (prToRepo.errors && prToRepo.errors.length > 0) {
    return {
      errors: prToRepo.errors,
      status: "PR_ERROR",
      repository: req.repository
    };
  }
  if (prToRepo.prUrl) {
    deps.logger.debug(`Created new PR from request: ${prToRepo.prUrl}`);
  }
  await deps.catalogHttpClient.possiblyCreateLocation(repoCatalogUrl);
  if (prToRepo.hasChanges === false) {
    deps.logger.debug(
      `No bulk import PR created on ${req.repository.url} since its default branch (${req.repository.defaultBranch}) already contains a catalog-info file`
    );
    await deps.catalogHttpClient.refreshLocationByRepoUrl(
      req.repository.url,
      req.repository.defaultBranch
    );
    return {
      status: "ADDED",
      lastUpdate: prToRepo.lastUpdate,
      repository: {
        url: req.repository.url,
        name: gitUrl.name,
        organization: gitUrl.organization
      }
    };
  }
  return {
    errors: prToRepo.errors,
    status: "WAIT_PR_APPROVAL",
    lastUpdate: prToRepo.lastUpdate,
    repository: {
      url: req.repository.url,
      name: gitUrl.name,
      organization: gitUrl.organization
    },
    github: {
      pullRequest: {
        url: prToRepo.prUrl,
        number: prToRepo.prNumber
      }
    }
  };
}
async function createImportJobs(deps, reqParams) {
  const dryRun = reqParams.dryRun ?? false;
  const importRequests = reqParams.importRequests;
  deps.logger.debug(
    `Handling request to import ${importRequests?.length} repo(s) (dryRun=${dryRun})..`
  );
  if (importRequests.length === 0) {
    deps.logger.debug("Missing import requests from request body");
    return {
      statusCode: 400,
      responseBody: []
    };
  }
  if (dryRun) {
    return {
      statusCode: 202,
      responseBody: await dryRunCreateImportJobs(deps, importRequests)
    };
  }
  const result = [];
  const addedRepos = await handleAddedReposFromCreateImportJobs(
    deps,
    importRequests
  );
  result.push(...addedRepos);
  const addedReposMap = new Map(
    addedRepos.map((res) => [res.repository?.url, res])
  );
  const remainingRequests = importRequests.filter(
    (req) => !addedReposMap.has(req.repository.url)
  );
  for (const req of remainingRequests) {
    const gitUrl = gitUrlParse__default$1.default(req.repository.url);
    try {
      result.push(await handlePrCreationRequest(deps, req, gitUrl));
    } catch (error) {
      result.push({
        errors: [error.message],
        status: "PR_ERROR",
        repository: {
          url: req.repository.url,
          name: gitUrl.name,
          organization: gitUrl.organization
        }
      });
    }
  }
  sortImports(result);
  return {
    statusCode: 202,
    responseBody: result
  };
}
async function dryRunCreateImportJobs(deps, importRequests) {
  const result = [];
  for (const req of importRequests) {
    const gitUrl = gitUrlParse__default$1.default(req.repository.url);
    const dryRunChecks = await performDryRunChecks(deps, req);
    if (dryRunChecks.errors?.length > 0) {
      deps.logger.warn(
        `Errors while performing dry-run checks: ${dryRunChecks.errors}`
      );
    }
    result.push({
      errors: dryRunChecks.dryRunStatuses,
      catalogEntityName: req.catalogEntityName,
      repository: {
        url: req.repository.url,
        name: gitUrl.name,
        organization: gitUrl.organization
      }
    });
  }
  return result;
}
async function performDryRunChecks(deps, req) {
  const checkCatalog = async (catalogEntityName) => {
    const hasEntity = await deps.catalogHttpClient.hasEntityInCatalog(
      catalogEntityName
    );
    if (hasEntity) {
      return { dryRunStatuses: ["CATALOG_ENTITY_CONFLICT"] };
    }
    return {};
  };
  const checkEmptyRepo = async () => {
    const empty = await deps.githubApiService.isRepoEmpty({
      repoUrl: req.repository.url
    });
    if (empty) {
      return {
        dryRunStatuses: ["REPO_EMPTY"]
      };
    }
    return {};
  };
  const checkCatalogInfoPresenceInRepo = async () => {
    const exists = await deps.githubApiService.hasFileInRepo({
      repoUrl: req.repository.url,
      defaultBranch: req.repository.defaultBranch,
      fileName: catalogUtils$1.getCatalogFilename(deps.config)
    });
    if (exists) {
      return {
        dryRunStatuses: ["CATALOG_INFO_FILE_EXISTS_IN_REPO"]
      };
    }
    return {};
  };
  const checkCodeOwnersFileInRepo = async () => {
    const exists = await deps.githubApiService.hasFileInRepo({
      repoUrl: req.repository.url,
      defaultBranch: req.repository.defaultBranch,
      fileName: ".github/CODEOWNERS"
    });
    if (!exists) {
      return {
        dryRunStatuses: ["CODEOWNERS_FILE_NOT_FOUND_IN_REPO"]
      };
    }
    return {};
  };
  const dryRunStatuses = [];
  const errors = [];
  const allChecksFn = [checkEmptyRepo(), checkCatalogInfoPresenceInRepo()];
  if (req.catalogEntityName?.trim()) {
    allChecksFn.push(checkCatalog(req.catalogEntityName));
  }
  if (req.codeOwnersFileAsEntityOwner) {
    allChecksFn.push(checkCodeOwnersFileInRepo());
  }
  const allChecks = await Promise.all(allChecksFn);
  allChecks.flat().forEach((res) => {
    if (res.dryRunStatuses) {
      dryRunStatuses.push(...res.dryRunStatuses);
    }
    if (res.errors) {
      errors.push(...res.errors);
    }
  });
  dryRunStatuses.sort((a, b) => a.localeCompare(b));
  return {
    dryRunStatuses,
    errors
  };
}
async function findImportStatusByRepo(deps, repoUrl, defaultBranch, includeCatalogInfoContent) {
  deps.logger.debug(`Getting bulk import job status for ${repoUrl}..`);
  const gitUrl = gitUrlParse__default$1.default(repoUrl);
  const errors = [];
  const result = {
    id: repoUrl,
    repository: {
      url: repoUrl,
      name: gitUrl.name,
      organization: gitUrl.organization,
      id: `${gitUrl.organization}/${gitUrl.name}`,
      defaultBranch
    },
    approvalTool: "GIT",
    status: null
  };
  try {
    const openImportPr = await deps.githubApiService.findImportOpenPr(
      deps.logger,
      {
        repoUrl,
        includeCatalogInfoContent
      }
    );
    if (!openImportPr.prUrl) {
      const catalogLocations = (await deps.catalogHttpClient.listCatalogUrlLocations()).targetUrls;
      const catalogUrl = catalogUtils$1.getCatalogUrl(deps.config, repoUrl, defaultBranch);
      let exists = false;
      for (const loc of catalogLocations) {
        if (loc === catalogUrl) {
          exists = true;
          break;
        }
      }
      if (exists && await deps.githubApiService.hasFileInRepo({
        repoUrl,
        defaultBranch,
        fileName: catalogUtils$1.getCatalogFilename(deps.config)
      })) {
        result.status = "ADDED";
        await deps.catalogHttpClient.refreshLocationByRepoUrl(
          repoUrl,
          defaultBranch
        );
      }
      const ghRepo = await deps.githubApiService.getRepositoryFromIntegrations(
        repoUrl
      );
      result.lastUpdate = ghRepo.repository?.updated_at ?? void 0;
      return {
        statusCode: 200,
        responseBody: result
      };
    }
    result.status = "WAIT_PR_APPROVAL";
    result.github = {
      pullRequest: {
        number: openImportPr.prNum,
        url: openImportPr.prUrl,
        title: openImportPr.prTitle,
        body: openImportPr.prBody,
        catalogInfoContent: openImportPr.prCatalogInfoContent
      }
    };
    result.lastUpdate = openImportPr.lastUpdate;
  } catch (error) {
    errors.push(error.message);
    result.errors = errors;
    if (error.message?.includes("Not Found")) {
      return {
        statusCode: 404,
        responseBody: result
      };
    }
    result.status = "PR_ERROR";
  }
  return {
    statusCode: 200,
    responseBody: result
  };
}
async function deleteImportByRepo(deps, repoUrl, defaultBranch) {
  deps.logger.debug(`Deleting bulk import job status for ${repoUrl}..`);
  const openImportPr = await deps.githubApiService.findImportOpenPr(
    deps.logger,
    {
      repoUrl
    }
  );
  const gitUrl = gitUrlParse__default$1.default(repoUrl);
  if (openImportPr.prUrl) {
    const appTitle = deps.config.getOptionalString("app.title") ?? "Red Hat Developer Hub";
    const appBaseUrl = deps.config.getString("app.baseUrl");
    await deps.githubApiService.closeImportPR(deps.logger, {
      repoUrl,
      gitUrl,
      comment: `Closing PR upon request for bulk import deletion. This request was created from [${appTitle}](${appBaseUrl}).`
    });
  }
  await deps.githubApiService.deleteImportBranch({
    repoUrl,
    gitUrl
  });
  const catalogUrl = catalogUtils$1.getCatalogUrl(deps.config, repoUrl, defaultBranch);
  const findLocationFrom = (list) => {
    for (const loc of list) {
      if (loc.target === catalogUrl) {
        return loc.id;
      }
    }
    return void 0;
  };
  const locationId = findLocationFrom(
    (await deps.catalogHttpClient.listCatalogUrlLocationsByIdFromLocationsEndpoint()).locations
  );
  if (locationId) {
    await deps.catalogHttpClient.deleteCatalogLocationById(locationId);
  }
  return {
    statusCode: 204,
    responseBody: void 0
  };
}

bulkImports_cjs.createImportJobs = createImportJobs;
bulkImports_cjs.deleteImportByRepo = deleteImportByRepo;
bulkImports_cjs.findAllImports = findAllImports;
bulkImports_cjs.findImportStatusByRepo = findImportStatusByRepo;

var organizations_cjs = {};

var handlers$1 = handlers_cjs;

async function findAllOrganizations(logger, githubApiService, search, pageNumber = handlers$1.DefaultPageNumber, pageSize = handlers$1.DefaultPageSize) {
  logger.debug(
    `Getting all organizations (search,page,size)=('${search ?? ""}',${pageNumber},${pageSize})..`
  );
  const allOrgsAccessible = await githubApiService.getOrganizationsFromIntegrations(
    search,
    pageNumber,
    pageSize
  );
  const errorList = [];
  for (const err of allOrgsAccessible.errors ?? []) {
    if (err.error?.message) {
      errorList.push(err.error.message);
    }
  }
  if (allOrgsAccessible.organizations?.length === 0 && errorList.length > 0) {
    return {
      statusCode: 500,
      responseBody: {
        errors: errorList
      }
    };
  }
  const orgMap = extractOrgMap(allOrgsAccessible);
  const organizations = sortOrgs(orgMap);
  return {
    statusCode: 200,
    responseBody: {
      errors: errorList,
      organizations,
      totalCount: allOrgsAccessible.totalCount,
      pagePerIntegration: pageNumber,
      sizePerIntegration: pageSize
    }
  };
}
function extractOrgMap(allOrgsAccessible) {
  const orgMap = /* @__PURE__ */ new Map();
  for (const org of allOrgsAccessible.organizations ?? []) {
    let totalRepoCount;
    if (org.public_repos !== void 0 || org.total_private_repos !== void 0 || org.owned_private_repos !== void 0) {
      totalRepoCount = (org.public_repos ?? 0) + (org.owned_private_repos ?? org.total_private_repos ?? 0);
    }
    orgMap.set(org.name, {
      id: `${org.id}`,
      name: org.name,
      description: org.description,
      url: org.url,
      totalRepoCount,
      errors: []
    });
  }
  return orgMap;
}
function sortOrgs(orgMap) {
  const organizations = Array.from(orgMap.values());
  organizations.sort((a, b) => {
    if (a.name === void 0 && b.name === void 0) {
      return 0;
    }
    if (a.name === void 0) {
      return -1;
    }
    if (b.name === void 0) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return organizations;
}

organizations_cjs.findAllOrganizations = findAllOrganizations;

var ping_cjs = {};

async function ping$1(logger) {
  logger.debug("PONG!");
  return {
    statusCode: 200,
    responseBody: { status: "ok" }
  };
}

ping_cjs.ping = ping$1;

var repositories_cjs = {};

var importStatus_cjs = {};

var catalogUtils = catalogUtils_cjs;

async function getImportStatusFromLocations(deps, repoUrl, catalogUrlLocations, defaultBranch) {
  return getImportStatusWithCheckerFn(
    deps,
    repoUrl,
    async (catalogUrl) => {
      for (const loc of catalogUrlLocations) {
        if (catalogUrl === loc) {
          return true;
        }
      }
      return false;
    },
    defaultBranch
  );
}
async function getImportStatusWithCheckerFn(deps, repoUrl, catalogExistenceCheckFn, defaultBranch) {
  const openImportPr = await deps.githubApiService.findImportOpenPr(
    deps.logger,
    {
      repoUrl
    }
  );
  if (!openImportPr.prUrl) {
    const existsInCatalog = await catalogExistenceCheckFn(
      catalogUtils.getCatalogUrl(deps.config, repoUrl, defaultBranch)
    );
    const existsInRepo = await deps.githubApiService.hasFileInRepo({
      repoUrl,
      defaultBranch,
      fileName: catalogUtils.getCatalogFilename(deps.config)
    });
    if (existsInCatalog && existsInRepo) {
      await deps.catalogHttpClient.refreshLocationByRepoUrl(
        repoUrl,
        defaultBranch
      );
      return { status: "ADDED" };
    }
    return null;
  }
  return { status: "WAIT_PR_APPROVAL", lastUpdate: openImportPr.lastUpdate };
}

importStatus_cjs.getImportStatusFromLocations = getImportStatusFromLocations;

var gitUrlParse = require$$0$1;
var handlers = handlers_cjs;



var importStatus = importStatus_cjs;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat$1(gitUrlParse);

async function findAllRepositories(deps, reqParams) {
  const search = reqParams?.search;
  const checkStatus = reqParams?.checkStatus ?? false;
  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
  deps.logger.debug(
    `Getting all repositories - (search,page,size)=('${search ?? ""}',${pageNumber},${pageSize})..`
  );
  return deps.githubApiService.getRepositoriesFromIntegrations(search, pageNumber, pageSize).then((response) => formatResponse(deps, response, checkStatus));
}
async function findRepositoriesByOrganization(deps, orgName, search, checkStatus = false, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
  deps.logger.debug(
    `Getting all repositories for org "${orgName}" - (search,page,size)=(${search},${pageNumber},${pageSize})..`
  );
  return deps.githubApiService.getOrgRepositoriesFromIntegrations(orgName, search, pageNumber, pageSize).then((response) => formatResponse(deps, response, checkStatus));
}
function sortRepos(repoList) {
  repoList.sort((a, b) => {
    if (a.name === void 0 && b.name === void 0) {
      return 0;
    }
    if (a.name === void 0) {
      return -1;
    }
    if (b.name === void 0) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}
async function formatResponse(deps, allReposAccessible, checkStatus) {
  const errorList = allReposAccessible.errors?.map((err) => err.error?.message)?.filter((msg) => msg) ?? [];
  if (allReposAccessible.repositories?.length === 0 && errorList.length > 0) {
    return {
      statusCode: 500,
      responseBody: {
        errors: errorList
      }
    };
  }
  let catalogLocations = [];
  if (checkStatus) {
    catalogLocations = (await deps.catalogHttpClient.listCatalogUrlLocations()).targetUrls;
  }
  const repoList = [];
  for (const repo of allReposAccessible.repositories) {
    const gitUrl = gitUrlParse__default.default(repo.html_url);
    const errors = [];
    let importStatus$1;
    if (checkStatus) {
      importStatus$1 = await importStatus.getImportStatusFromLocations(
        deps,
        repo.html_url,
        catalogLocations,
        repo.default_branch
      ).catch((error) => {
        errors.push(error.message);
        return void 0;
      });
    }
    const repoUpdatedAt = repo.updated_at ?? void 0;
    repoList.push({
      id: `${gitUrl.organization}/${repo.name}`,
      name: repo.name,
      organization: gitUrl.organization,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      importStatus: importStatus$1?.status,
      lastUpdate: importStatus$1?.lastUpdate ?? repoUpdatedAt,
      errors
    });
  }
  sortRepos(repoList);
  return {
    statusCode: 200,
    responseBody: {
      errors: errorList,
      repositories: repoList,
      totalCount: allReposAccessible.totalCount
    }
  };
}

repositories_cjs.findAllRepositories = findAllRepositories;
repositories_cjs.findRepositoriesByOrganization = findRepositoriesByOrganization;

var rootHttpRouter = require$$0$5;
var pluginPermissionNode = require$$1$3;
var backstagePluginAuditLogNode = require$$2;
var formats = require$$3$1;
var express = require$$4;
var openapiBackend = require$$5;
var backstagePluginBulkImportCommon = require$$6;
var catalogHttpClient = catalogHttpClient_cjs;
var catalogInfoGenerator = catalogInfoGenerator_cjs;
var openapidocument = openapidocument_cjs;




var githubApiService = githubApiService_cjs;
var auth = auth_cjs;

var auditLogUtils = auditLogUtils_cjs;
var bulkImports = bulkImports_cjs;
var organizations = organizations_cjs;
var ping = ping_cjs;
var repositories = repositories_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);

async function createRouter(options) {
  const {
    logger,
    httpAuth,
    auth: auth$1,
    permissions,
    config,
    cache,
    discovery,
    catalogApi
  } = options;
  const auditLogger = new backstagePluginAuditLogNode.DefaultAuditLogger({
    logger,
    authService: auth$1,
    httpAuthService: httpAuth
  });
  const githubApiService$1 = new githubApiService.GithubApiService(logger, config, cache);
  const catalogHttpClient$1 = new catalogHttpClient.CatalogHttpClient({
    logger,
    config,
    discovery,
    auth: auth$1,
    catalogApi
  });
  const catalogInfoGenerator$1 = new catalogInfoGenerator.CatalogInfoGenerator(
    logger,
    catalogHttpClient$1
  );
  const api = new openapiBackend.OpenAPIBackend({
    ajvOpts: {
      verbose: true,
      formats: formats.fullFormats
      // open issue: https://github.com/openapistack/openapi-backend/issues/280
    },
    validate: true,
    definition: openapidocument.openApiDocument,
    handlers: {
      validationFail: async (c, _req, res) => res.status(400).json({ err: c.validation.errors }),
      notFound: async (_c, req, res) => res.status(404).json({ err: `'${req.method} ${req.path}' not found` }),
      notImplemented: async (_c, req, res) => res.status(500).json({ err: `'${req.method} ${req.path}' not implemented` })
    }
  });
  await api.init();
  api.register("ping", async (_c, _req, res) => {
    const result = await ping.ping(logger);
    return res.status(result.statusCode).json(result.responseBody);
  });
  api.register(
    "findAllOrganizations",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.pagePerIntegration = stringToNumber(q.pagePerIntegration);
      q.sizePerIntegration = stringToNumber(q.sizePerIntegration);
      const response = await organizations.findAllOrganizations(
        logger,
        githubApiService$1,
        q.search,
        q.pagePerIntegration,
        q.sizePerIntegration
      );
      return res.status(response.statusCode).json({
        errors: response.responseBody?.errors,
        organizations: response.responseBody?.organizations,
        totalCount: response.responseBody?.totalCount,
        pagePerIntegration: response.responseBody?.pagePerIntegration,
        sizePerIntegration: response.responseBody?.sizePerIntegration
      });
    }
  );
  api.register(
    "findAllRepositories",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.pagePerIntegration = stringToNumber(q.pagePerIntegration);
      q.sizePerIntegration = stringToNumber(q.sizePerIntegration);
      q.checkImportStatus = stringToBoolean(q.checkImportStatus);
      const response = await repositories.findAllRepositories(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        {
          search: q.search,
          checkStatus: q.checkImportStatus,
          pageNumber: q.pagePerIntegration,
          pageSize: q.sizePerIntegration
        }
      );
      const repos = response.responseBody?.repositories;
      return res.status(response.statusCode).json({
        errors: response.responseBody?.errors,
        repositories: repos,
        totalCount: response.responseBody?.totalCount,
        pagePerIntegration: q.pagePerIntegration,
        sizePerIntegration: q.sizePerIntegration
      });
    }
  );
  api.register(
    "findRepositoriesByOrganization",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.pagePerIntegration = stringToNumber(q.pagePerIntegration);
      q.sizePerIntegration = stringToNumber(q.sizePerIntegration);
      q.checkImportStatus = stringToBoolean(q.checkImportStatus);
      const response = await repositories.findRepositoriesByOrganization(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        c.request.params.organizationName?.toString(),
        q.search,
        q.checkImportStatus,
        q.pagePerIntegration,
        q.sizePerIntegration
      );
      const repos = response.responseBody?.repositories;
      return res.status(response.statusCode).json({
        errors: response.responseBody?.errors,
        repositories: repos,
        totalCount: response.responseBody?.totalCount,
        pagePerIntegration: q.pagePerIntegration,
        sizePerIntegration: q.sizePerIntegration
      });
    }
  );
  api.register(
    "findAllImports",
    async (c, _req, res) => {
      const h = {
        ...c.request.headers
      };
      const apiVersion = h["api-version"];
      const q = {
        ...c.request.query
      };
      let page;
      let size;
      if (apiVersion === void 0 || apiVersion === "v1") {
        page = stringToNumber(q.page || q.pagePerIntegration);
        size = stringToNumber(q.size || q.sizePerIntegration);
      } else {
        page = stringToNumber(q.page);
        size = stringToNumber(q.size);
      }
      const response = await bulkImports.findAllImports(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        {
          apiVersion
        },
        {
          search: q.search,
          pageNumber: page,
          pageSize: size
        }
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    "createImportJobs",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      q.dryRun = stringToBoolean(q.dryRun);
      const response = await bulkImports.createImportJobs(
        {
          logger,
          config,
          auth: auth$1,
          catalogApi,
          githubApiService: githubApiService$1,
          catalogInfoGenerator: catalogInfoGenerator$1,
          catalogHttpClient: catalogHttpClient$1
        },
        {
          importRequests: c.request.requestBody,
          dryRun: q.dryRun
        }
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    "findImportStatusByRepo",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      if (!q.repo?.trim()) {
        throw new Error("missing or blank parameter");
      }
      const response = await bulkImports.findImportStatusByRepo(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        q.repo,
        q.defaultBranch,
        true
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  api.register(
    "deleteImportByRepo",
    async (c, _req, res) => {
      const q = {
        ...c.request.query
      };
      if (!q.repo?.trim()) {
        throw new Error('missing or blank "repo" parameter');
      }
      const response = await bulkImports.deleteImportByRepo(
        {
          logger,
          config,
          githubApiService: githubApiService$1,
          catalogHttpClient: catalogHttpClient$1
        },
        q.repo,
        q.defaultBranch
      );
      return res.status(response.statusCode).json(response.responseBody);
    }
  );
  const router = express.Router();
  router.use(express__default.default.json());
  const permissionIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: [backstagePluginBulkImportCommon.bulkImportPermission]
  });
  router.use(permissionIntegrationRouter);
  router.use(async (req, _res, next) => {
    if (req.path !== "/ping") {
      await auth.permissionCheck(
        auditLogger,
        api.matchOperation(req)?.operationId,
        permissions,
        httpAuth,
        req
      ).catch(next);
    }
    next();
  });
  router.use(async (req, res, next) => {
    const reqCast = req;
    const operationId = api.matchOperation(reqCast)?.operationId;
    try {
      const response = await api.handleRequest(reqCast, req, res);
      auditLogUtils.auditLogRequestSuccess(
        auditLogger,
        operationId,
        req,
        response.statusCode
      );
      next();
    } catch (err) {
      auditLogUtils.auditLogRequestError(auditLogger, operationId, req, err);
      next(err);
    }
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config });
  router.use(middleware.error());
  return router;
}
function stringToNumber(s) {
  return s ? Number.parseInt(s.toString(), 10) : void 0;
}
function stringToBoolean(s) {
  if (!s) {
    return void 0;
  }
  return s.toString() === "true";
}

router_cjs.createRouter = createRouter;

var backendPluginApi = require$$0$6;
var alpha = require$$1$4;
var router$1 = router_cjs;

const bulkImportPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "bulk-import",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        http: backendPluginApi.coreServices.httpRouter,
        cache: backendPluginApi.coreServices.cache,
        discovery: backendPluginApi.coreServices.discovery,
        permissions: backendPluginApi.coreServices.permissions,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        auth: backendPluginApi.coreServices.auth,
        catalogApi: alpha.catalogServiceRef
      },
      async init({
        config,
        logger,
        http,
        cache,
        discovery,
        permissions,
        httpAuth,
        auth,
        catalogApi
      }) {
        const router$1$1 = await router$1.createRouter({
          config,
          cache,
          discovery,
          permissions,
          logger,
          httpAuth,
          auth,
          catalogApi
        });
        http.use(router$1$1);
        http.addAuthPolicy({
          path: "/ping",
          allow: "unauthenticated"
        });
      }
    });
  }
});

plugin_cjs.bulkImportPlugin = bulkImportPlugin;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var plugin = plugin_cjs;
var router = router_cjs;



var _default = index_cjs.default = plugin.bulkImportPlugin;
index_cjs.createRouter = router.createRouter;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
