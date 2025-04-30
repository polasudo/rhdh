import { QueryEntitiesInitialRequest, GetEntityFacetsRequest, GetEntityFacetsResponse, CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { JsonObject } from '@backstage/types';
import { AuthService } from '@backstage/backend-plugin-api';

/**
 * @public
 */
declare enum MarketplaceAnnotation {
    CERTIFIED_BY = "extensions.backstage.io/certified-by",
    VERIFIED_BY = "extensions.backstage.io/verified-by",
    SUPPORT_TYPE = "extensions.backstage.io/support-type",
    PRE_INSTALLED = "extensions.backstage.io/pre-installed"
}

/**
 * @public
 */
type MarketplaceAuthor = {
    name: string;
    url?: string;
};

/**
 * @public
 */
interface MarketplaceCollection extends Entity {
    spec?: MarketplaceCollectionSpec;
}
/**
 * @public
 */
interface MarketplaceCollectionSpec extends JsonObject {
    type?: 'curated';
    plugins?: string[];
}
/**
 * @public
 */
declare function isMarketplaceCollection(entity?: Entity): entity is MarketplaceCollection;

/**
 * @public
 */
declare enum MarketplaceKind {
    Plugin = "Plugin",
    Collection = "PluginCollection",
    Package = "Package"
}

/**
 * @public
 */
interface MarketplacePackage extends Entity {
    spec?: MarketplacePackageSpec;
}
/**
 * @public
 */
declare enum MarketplacePackageInstallStatus {
    NotInstalled = "NotInstalled",
    Installed = "Installed",
    UpdateAvailable = "UpdateAvailable"
}
/**
 * @public
 */
interface MarketplacePackageSpec extends JsonObject {
    packageName?: string;
    version?: string;
    dynamicArtifact?: string;
    author?: string;
    support?: string;
    lifecycle?: string;
    role?: string;
    supportedVersions?: string;
    /**
     * @deprecated use role and supportedVersions under spec instead
     */
    backstage?: MarketplacePackageBackstage;
    appConfigExamples?: MarketplacePackageSpecAppConfigExample[];
    owner?: string;
    partOf?: string[];
    installStatus?: MarketplacePackageInstallStatus;
}
/**
 * @public
 */
interface MarketplacePackageSpecAppConfigExample extends JsonObject {
    title: string;
    content: string | JsonObject;
}
/**
 * @public
 */
interface MarketplacePackageBackstage extends JsonObject {
    role?: string;
    supportedVersions?: string;
}
/**
 * @public
 */
declare function isMarketplacePackage(entity?: Entity): entity is MarketplacePackage;

/**
 * @public
 */
interface MarketplacePlugin extends Entity {
    spec?: MarketplacePluginSpec;
}
/**
 * @public
 */
declare enum DocumentationType {
    about = "about",
    usage = "usage",
    installation = "installation",
    configuration = "configuration"
}
/**
 * @public
 */
interface Documentation extends JsonObject {
    type: DocumentationType;
    markdown: string;
    title?: string;
    tabTitle?: string;
}
/**
 * @public
 */
declare enum AssetType {
    icon = "icon",
    image = "image"
}
/**
 * @public
 */
interface Asset extends JsonObject {
    type: AssetType;
    filename: string;
    originUri: string;
    encodedData?: string;
}
/**
 * @public
 */
declare enum MarketplacePluginInstallStatus {
    NotInstalled = "NotInstalled",
    Installed = "Installed",
    PartiallyInstalled = "PartiallyInstalled",
    UpdateAvailable = "UpdateAvailable"
}
/**
 * @public
 */
interface MarketplacePluginSpec extends JsonObject {
    icon?: string;
    /**
     * @deprecated use author instead
     */
    developer?: string;
    author?: string;
    authors?: MarketplaceAuthor[];
    packages?: string[];
    categories?: string[];
    highlights?: string[];
    description?: string;
    installation?: string;
    documentation?: Documentation[];
    assets?: Asset[];
    installStatus?: MarketplacePluginInstallStatus;
}
/**
 * @public
 */
declare function isMarketplacePlugin(entity?: Entity): entity is MarketplacePlugin;

/**
 * @public
 */
type GetEntitiesRequest = QueryEntitiesInitialRequest;
/**
 * @public
 */
interface GetEntitiesResponse<T> {
    items: T[];
    totalItems: number;
    pageInfo: {
        nextCursor?: string;
        prevCursor?: string;
    };
}
/**
 * @public
 */
interface MarketplaceApi {
    getCollections(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplaceCollection>>;
    getCollectionsFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getCollectionByName(namespace: string, name: string): Promise<MarketplaceCollection>;
    getCollectionPlugins(namespace: string, name: string): Promise<MarketplacePlugin[]>;
    getPackages(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplacePackage>>;
    getPackagesFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getPackageByName(namespace: string, name: string): Promise<MarketplacePackage>;
    getPlugins(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplacePlugin>>;
    getPluginFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getPluginByName(namespace: string, name: string): Promise<MarketplacePlugin>;
    getPluginPackages(namespace: string, name: string): Promise<MarketplacePackage[]>;
}

/**
 * @public
 */
type DiscoveryApi = {
    getBaseUrl(pluginId: string): Promise<string>;
};
/**
 * @public
 */
type FetchApi = {
    fetch: typeof fetch;
};
/**
 * @public
 */
type MarketplaceBackendClientOptions = {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
};
/**
 * @public
 */
declare class MarketplaceBackendClient implements MarketplaceApi {
    private readonly discoveryApi;
    private readonly fetchApi;
    constructor(options: MarketplaceBackendClientOptions);
    private get;
    getCollections(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplaceCollection>>;
    getCollectionsFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getCollectionByName(namespace: string, name: string): Promise<MarketplaceCollection>;
    getCollectionPlugins(namespace: string, name: string): Promise<MarketplacePlugin[]>;
    getPackages(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplacePackage>>;
    getPackagesFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getPackageByName(namespace: string, name: string): Promise<MarketplacePackage>;
    getPlugins(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplacePlugin>>;
    getPluginFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getPluginByName(namespace: string, name: string): Promise<MarketplacePlugin>;
    getPluginPackages(namespace: string, name: string): Promise<MarketplacePackage[]>;
}

/**
 * @public
 */
type MarketplaceCatalogClientOptions = {
    auth?: AuthService;
    catalogApi: CatalogApi;
};
/**
 * @public
 */
declare class MarketplaceCatalogClient implements MarketplaceApi {
    private readonly catalog;
    private readonly auth?;
    constructor(options: MarketplaceCatalogClientOptions);
    private getServiceToken;
    getCollections(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplaceCollection>>;
    getCollectionsFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getCollectionByName(namespace: string, name: string): Promise<MarketplaceCollection>;
    getCollectionPlugins(namespace: string, name: string): Promise<MarketplacePlugin[]>;
    getPackages(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplacePackage>>;
    getPackagesFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getPackageByName(namespace: string, name: string): Promise<MarketplacePackage>;
    getPlugins(request: GetEntitiesRequest): Promise<GetEntitiesResponse<MarketplacePlugin>>;
    getPluginFacets(request: GetEntityFacetsRequest): Promise<GetEntityFacetsResponse>;
    getPluginByName(namespace: string, name: string): Promise<MarketplacePlugin>;
    getPluginPackages(namespace: string, name: string): Promise<MarketplacePackage[]>;
}

/**
 * @public
 */
declare const EXTENSIONS_API_VERSION = "extensions.backstage.io/v1alpha1";

/**
 * @public
 */
declare const encodeGetEntitiesRequest: (request: GetEntitiesRequest) => URLSearchParams;
/**
 * @public
 */
declare const encodeGetEntityFacetsRequest: (request: GetEntityFacetsRequest) => URLSearchParams;

/**
 * @public
 */
declare const decodeGetEntitiesRequest: (searchParams: URLSearchParams) => GetEntitiesRequest;
/**
 * @public
 */
declare const decodeGetEntityFacetsRequest: (searchParams: URLSearchParams) => GetEntityFacetsRequest;

export { type Asset, AssetType, type DiscoveryApi, type Documentation, DocumentationType, EXTENSIONS_API_VERSION, type FetchApi, type GetEntitiesRequest, type GetEntitiesResponse, MarketplaceAnnotation, type MarketplaceApi, type MarketplaceAuthor, MarketplaceBackendClient, type MarketplaceBackendClientOptions, MarketplaceCatalogClient, type MarketplaceCatalogClientOptions, type MarketplaceCollection, type MarketplaceCollectionSpec, MarketplaceKind, type MarketplacePackage, type MarketplacePackageBackstage, MarketplacePackageInstallStatus, type MarketplacePackageSpec, type MarketplacePackageSpecAppConfigExample, type MarketplacePlugin, MarketplacePluginInstallStatus, type MarketplacePluginSpec, decodeGetEntitiesRequest, decodeGetEntityFacetsRequest, encodeGetEntitiesRequest, encodeGetEntityFacetsRequest, isMarketplaceCollection, isMarketplacePackage, isMarketplacePlugin };
