'use strict';

var fetch = require('node-fetch');
var auth = require('../helpers/auth.cjs.js');
var loggingUtils = require('../helpers/loggingUtils.cjs.js');
var catalogUtils = require('./catalogUtils.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

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
          Authorization: `Bearer ${await auth.getTokenForPlugin(
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
    const result = /* @__PURE__ */ new Map();
    for (const l of byId.locations) {
      if (!result.has(l.target)) {
        result.set(l.target, l);
      }
    }
    return {
      uniqueCatalogUrlLocations: result,
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
        Authorization: `Bearer ${await auth.getTokenForPlugin(
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
        target: location.data.target,
        source: "location"
      };
    });
    const filtered = catalogUtils.filterLocations(res, search);
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
        target,
        source: "config"
      };
    });
    const filtered = catalogUtils.filterLocations(res, search);
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
        token: await auth.getTokenForPlugin(this.auth, "catalog")
      }
    );
    const locations = result?.items ?? [];
    const res = locations.filter(
      (location) => location.spec?.target && location.spec?.type === "url"
    ).map((location) => {
      return {
        id: location.metadata.uid,
        target: location.spec.target,
        source: "integration"
      };
    });
    const filtered = catalogUtils.filterLocations(res, search);
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
          token: await auth.getTokenForPlugin(this.auth, "catalog")
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
        token: await auth.getTokenForPlugin(this.auth, "catalog")
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
          token: await auth.getTokenForPlugin(this.auth, "catalog")
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
          Authorization: `Bearer ${await auth.getTokenForPlugin(
            this.auth,
            "catalog"
          )}`
        },
        method: "DELETE"
      });
    } catch (error) {
      loggingUtils.logErrorIfNeeded(
        this.logger,
        `Could not delete location ${locationId}`,
        error
      );
    }
  }
  async deleteCatalogLocationEntityById(locationUid) {
    await this.catalogApi.removeEntityByUid(locationUid, {
      token: await auth.getTokenForPlugin(this.auth, "catalog")
    });
  }
  async findLocationEntitiesByRepoUrl(repoUrl, defaultBranch) {
    return this.findLocationEntitiesByTargetUrl(
      catalogUtils.getCatalogUrl(this.config, repoUrl, defaultBranch)
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
        token: await auth.getTokenForPlugin(this.auth, "catalog")
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
      token: await auth.getTokenForPlugin(this.auth, "catalog")
    });
  }
}

exports.CatalogHttpClient = CatalogHttpClient;
//# sourceMappingURL=catalogHttpClient.cjs.js.map
