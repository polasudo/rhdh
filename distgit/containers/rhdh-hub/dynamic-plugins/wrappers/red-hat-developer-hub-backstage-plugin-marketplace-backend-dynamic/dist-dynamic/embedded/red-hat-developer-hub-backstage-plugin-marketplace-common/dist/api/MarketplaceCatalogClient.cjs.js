'use strict';

var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var MarketplaceKind = require('../types/MarketplaceKind.cjs.js');
var MarketplacePackage = require('../types/MarketplacePackage.cjs.js');
var MarketplacePlugin = require('../types/MarketplacePlugin.cjs.js');

const enforceKindFilter = (request, kind) => ({
  ...request,
  filter: {
    ...request.filter,
    kind
  }
});
class MarketplaceCatalogClient {
  catalog;
  auth;
  constructor(options) {
    this.auth = options.auth;
    this.catalog = options.catalogApi;
  }
  async getServiceToken() {
    if (!this.auth) {
      return undefined;
    }
    return await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
  }
  async getCollections(request) {
    const token = await this.getServiceToken();
    const result = await this.catalog.queryEntities(
      enforceKindFilter(request, MarketplaceKind.MarketplaceKind.Collection),
      token
    );
    return result;
  }
  async getCollectionsFacets(request) {
    const token = await this.getServiceToken();
    return await this.catalog.getEntityFacets(
      enforceKindFilter(request, MarketplaceKind.MarketplaceKind.Collection),
      token
    );
  }
  async getCollectionByName(namespace, name) {
    const token = await this.getServiceToken();
    const entityRef = catalogModel.stringifyEntityRef({
      kind: MarketplaceKind.MarketplaceKind.Collection,
      namespace,
      name
    });
    const result = await this.catalog.getEntityByRef(entityRef, token);
    if (!result) {
      throw new errors.NotFoundError(`Collection ${namespace}/${name} not found`);
    }
    return result;
  }
  async getCollectionPlugins(namespace, name) {
    const collection = await this.getCollectionByName(namespace, name);
    const relations = collection.relations ?? [];
    const entityRefs = relations.filter(
      (relation) => (relation.type === catalogModel.RELATION_PART_OF || relation.type === catalogModel.RELATION_HAS_PART) && relation.targetRef.startsWith("plugin:")
    ).map((relation) => relation.targetRef);
    const token = await this.getServiceToken();
    const result = await this.catalog.getEntitiesByRefs({ entityRefs }, token);
    return result.items.filter(MarketplacePlugin.isMarketplacePlugin);
  }
  async getPackages(request) {
    const token = await this.getServiceToken();
    const result = await this.catalog.queryEntities(
      enforceKindFilter(request, MarketplaceKind.MarketplaceKind.Package),
      token
    );
    return result;
  }
  async getPackagesFacets(request) {
    const token = await this.getServiceToken();
    return await this.catalog.getEntityFacets(
      enforceKindFilter(request, MarketplaceKind.MarketplaceKind.Package),
      token
    );
  }
  async getPackageByName(namespace, name) {
    const token = await this.getServiceToken();
    const entityRef = catalogModel.stringifyEntityRef({
      kind: MarketplaceKind.MarketplaceKind.Package,
      namespace,
      name
    });
    const result = await this.catalog.getEntityByRef(entityRef, token);
    if (!result) {
      throw new errors.NotFoundError(`Package ${namespace}/${name} not found`);
    }
    return result;
  }
  async getPlugins(request) {
    const token = await this.getServiceToken();
    const result = await this.catalog.queryEntities(
      enforceKindFilter(request, MarketplaceKind.MarketplaceKind.Plugin),
      token
    );
    return result;
  }
  async getPluginFacets(request) {
    const token = await this.getServiceToken();
    return await this.catalog.getEntityFacets(
      enforceKindFilter(request, MarketplaceKind.MarketplaceKind.Plugin),
      token
    );
  }
  async getPluginByName(namespace, name) {
    const token = await this.getServiceToken();
    const entityRef = catalogModel.stringifyEntityRef({
      kind: MarketplaceKind.MarketplaceKind.Plugin,
      namespace,
      name
    });
    const result = await this.catalog.getEntityByRef(entityRef, token);
    if (!result) {
      throw new errors.NotFoundError(`Plugin ${namespace}/${name} not found`);
    }
    return result;
  }
  async getPluginPackages(namespace, name) {
    const plugin = await this.getPluginByName(namespace, name);
    const relations = plugin.relations ?? [];
    const entityRefs = relations.filter(
      (relation) => (relation.type === catalogModel.RELATION_PART_OF || relation.type === catalogModel.RELATION_HAS_PART) && relation.targetRef.startsWith("package:")
    ).map((relation) => relation.targetRef);
    const token = await this.getServiceToken();
    const result = await this.catalog.getEntitiesByRefs({ entityRefs }, token);
    return result.items.filter(MarketplacePackage.isMarketplacePackage);
  }
}

exports.MarketplaceCatalogClient = MarketplaceCatalogClient;
//# sourceMappingURL=MarketplaceCatalogClient.cjs.js.map
