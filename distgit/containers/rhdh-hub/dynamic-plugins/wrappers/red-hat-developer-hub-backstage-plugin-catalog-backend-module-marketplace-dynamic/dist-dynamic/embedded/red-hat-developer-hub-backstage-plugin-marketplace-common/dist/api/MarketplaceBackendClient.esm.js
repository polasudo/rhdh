import { encodeGetEntitiesRequest, encodeGetEntityFacetsRequest } from '../utils/encodeQueryParams.esm.js';

class MarketplaceBackendClient {
  discoveryApi;
  fetchApi;
  constructor(options) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }
  async get(path, searchParams) {
    const baseUrl = await this.discoveryApi.getBaseUrl("marketplace");
    const query = searchParams ? searchParams.toString() : "";
    const url = `${baseUrl}${path}${query ? "?" : ""}${query}`;
    const response = await this.fetchApi.fetch(url);
    if (!response.ok) {
      throw new Error(
        `Unexpected status code: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }
  getCollections(request) {
    return this.get("/collections", encodeGetEntitiesRequest(request));
  }
  getCollectionsFacets(request) {
    return this.get(
      "/collections/facets",
      encodeGetEntityFacetsRequest(request)
    );
  }
  getCollectionByName(namespace, name) {
    return this.get(
      `/collection/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`
    );
  }
  getCollectionPlugins(namespace, name) {
    return this.get(
      `/collection/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/plugins`
    );
  }
  async getPackages(request) {
    return this.get("/packages", encodeGetEntitiesRequest(request));
  }
  getPackagesFacets(request) {
    return this.get("/packages/facets", encodeGetEntityFacetsRequest(request));
  }
  getPackageByName(namespace, name) {
    return this.get(
      `/package/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`
    );
  }
  async getPlugins(request) {
    return this.get("/plugins", encodeGetEntitiesRequest(request));
  }
  getPluginFacets(request) {
    return this.get("/plugins/facets", encodeGetEntityFacetsRequest(request));
  }
  async getPluginByName(namespace, name) {
    return this.get(
      `/plugin/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`
    );
  }
  getPluginPackages(namespace, name) {
    return this.get(
      `/plugin/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/packages`
    );
  }
}

export { MarketplaceBackendClient };
//# sourceMappingURL=MarketplaceBackendClient.esm.js.map
