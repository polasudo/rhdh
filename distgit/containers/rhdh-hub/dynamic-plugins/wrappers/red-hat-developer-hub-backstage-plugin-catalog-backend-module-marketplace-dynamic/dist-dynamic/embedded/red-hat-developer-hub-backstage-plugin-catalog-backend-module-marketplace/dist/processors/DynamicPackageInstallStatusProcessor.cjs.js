'use strict';

var catalogModel = require('@backstage/catalog-model');
var types = require('@backstage/types');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');

class DynamicPackageInstallStatusProcessor {
  discovery;
  auth;
  cacheTTLMilliseconds = types.durationToMilliseconds({
    minutes: 1
  });
  constructor(discovery, auth) {
    this.discovery = discovery;
    this.auth = auth;
  }
  // Return processor name
  getProcessorName() {
    return "DynamicPackageInstallStatusProcessor";
  }
  async getInstalledPlugins() {
    const scalprumUrl = await this.discovery.getBaseUrl("scalprum");
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
    const response = await fetch(`${scalprumUrl}/plugins`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      console.log(
        `Unexpected status code: ${response.status} ${response.statusText}`
      );
      return [];
    }
    return await response.json();
  }
  async getCachedPlugins(cache, entityRef) {
    let cachedData = await cache.get(entityRef);
    if (!cachedData || this.isExpired(cachedData)) {
      const plugins = await this.getInstalledPlugins();
      cachedData = { plugins, cachedTime: Date.now() };
      await cache.set(entityRef, cachedData);
    }
    return cachedData;
  }
  /**
   * Determines if cached data is expired based on TTL
   *
   * @param cachedData - The cached data for this entity
   * @returns True if data is expired
   */
  isExpired(cachedData) {
    const elapsed = Date.now() - cachedData.cachedTime;
    return elapsed > this.cacheTTLMilliseconds;
  }
  async preProcessEntity(entity, _location, _emit, _originLocation, cache) {
    if (backstagePluginMarketplaceCommon.isMarketplacePackage(entity)) {
      if (entity.spec?.packageName && !entity.spec?.installStatus) {
        const packageName = entity.spec.packageName;
        const entityRef = catalogModel.stringifyEntityRef(entity);
        const data = await this.getCachedPlugins(cache, entityRef);
        const installedPackageNames = Object.keys(data?.plugins);
        if (installedPackageNames.includes(packageName)) {
          return {
            ...entity,
            spec: {
              ...entity.spec,
              installStatus: backstagePluginMarketplaceCommon.MarketplacePackageInstallStatus.Installed
            }
          };
        }
      }
    }
    return entity;
  }
}

exports.DynamicPackageInstallStatusProcessor = DynamicPackageInstallStatusProcessor;
//# sourceMappingURL=DynamicPackageInstallStatusProcessor.cjs.js.map
