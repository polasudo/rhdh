'use strict';

class MarketplaceCatalogService {
  logger;
  catalog;
  auth;
  constructor(options) {
    this.logger = options.logger;
    this.auth = options.auth;
    this.catalog = options.catalogApi;
  }
  async getPlugins() {
    this.logger.info("getPlugins");
    const token = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
    const result = await this.catalog.getEntities(
      {
        filter: {
          kind: "plugin"
        }
      },
      token
    );
    return result.items;
  }
  async getPluginList() {
    this.logger.info("getPluginList");
    const token = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
    const result = await this.catalog.getEntities(
      {
        filter: {
          kind: "pluginList"
        }
      },
      token
    );
    return result.items;
  }
}

exports.MarketplaceCatalogService = MarketplaceCatalogService;
//# sourceMappingURL=MarketplaceCatalogService.cjs.js.map
