import { stringifyEntityRef, RELATION_PART_OF, RELATION_HAS_PART } from '@backstage/catalog-model';
import { NotFoundError } from '@backstage/errors';
import { MarketplaceKind } from '../types/MarketplaceKind.esm.js';
import { isMarketplacePackage } from '../types/MarketplacePackage.esm.js';
import { isMarketplacePlugin } from '../types/MarketplacePlugin.esm.js';

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
      enforceKindFilter(request, MarketplaceKind.Collection),
      token
    );
    return result;
  }
  async getCollectionsFacets(request) {
    const token = await this.getServiceToken();
    return await this.catalog.getEntityFacets(
      enforceKindFilter(request, MarketplaceKind.Collection),
      token
    );
  }
  async getCollectionByName(namespace, name) {
    const token = await this.getServiceToken();
    const entityRef = stringifyEntityRef({
      kind: MarketplaceKind.Collection,
      namespace,
      name
    });
    const result = await this.catalog.getEntityByRef(entityRef, token);
    if (!result) {
      throw new NotFoundError(`Collection ${namespace}/${name} not found`);
    }
    return result;
  }
  async getCollectionPlugins(namespace, name) {
    const collection = await this.getCollectionByName(namespace, name);
    const relations = collection.relations ?? [];
    const entityRefs = relations.filter(
      (relation) => (relation.type === RELATION_PART_OF || relation.type === RELATION_HAS_PART) && relation.targetRef.startsWith("plugin:")
    ).map((relation) => relation.targetRef);
    const token = await this.getServiceToken();
    const result = await this.catalog.getEntitiesByRefs({ entityRefs }, token);
    return result.items.filter(isMarketplacePlugin);
  }
  async getPackages(request) {
    const token = await this.getServiceToken();
    const result = await this.catalog.queryEntities(
      enforceKindFilter(request, MarketplaceKind.Package),
      token
    );
    return result;
  }
  async getPackagesFacets(request) {
    const token = await this.getServiceToken();
    return await this.catalog.getEntityFacets(
      enforceKindFilter(request, MarketplaceKind.Package),
      token
    );
  }
  async getPackageByName(namespace, name) {
    const token = await this.getServiceToken();
    const entityRef = stringifyEntityRef({
      kind: MarketplaceKind.Package,
      namespace,
      name
    });
    const result = await this.catalog.getEntityByRef(entityRef, token);
    if (!result) {
      throw new NotFoundError(`Package ${namespace}/${name} not found`);
    }
    return result;
  }
  async getPlugins(request) {
    const token = await this.getServiceToken();
    const result = await this.catalog.queryEntities(
      enforceKindFilter(request, MarketplaceKind.Plugin),
      token
    );
    return result;
  }
  async getPluginFacets(request) {
    const token = await this.getServiceToken();
    return await this.catalog.getEntityFacets(
      enforceKindFilter(request, MarketplaceKind.Plugin),
      token
    );
  }
  async getPluginByName(namespace, name) {
    const token = await this.getServiceToken();
    const entityRef = stringifyEntityRef({
      kind: MarketplaceKind.Plugin,
      namespace,
      name
    });
    const result = await this.catalog.getEntityByRef(entityRef, token);
    if (!result) {
      throw new NotFoundError(`Plugin ${namespace}/${name} not found`);
    }
    return result;
  }
  async getPluginPackages(namespace, name) {
    const plugin = await this.getPluginByName(namespace, name);
    const relations = plugin.relations ?? [];
    const entityRefs = relations.filter(
      (relation) => (relation.type === RELATION_PART_OF || relation.type === RELATION_HAS_PART) && relation.targetRef.startsWith("package:")
    ).map((relation) => relation.targetRef);
    const token = await this.getServiceToken();
    const result = await this.catalog.getEntitiesByRefs({ entityRefs }, token);
    return result.items.filter(isMarketplacePackage);
  }
}

export { MarketplaceCatalogClient };
//# sourceMappingURL=MarketplaceCatalogClient.esm.js.map
