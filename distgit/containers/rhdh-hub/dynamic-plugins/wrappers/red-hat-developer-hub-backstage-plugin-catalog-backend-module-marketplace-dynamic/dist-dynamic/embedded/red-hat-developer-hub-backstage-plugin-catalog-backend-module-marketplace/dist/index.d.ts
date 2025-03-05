import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { DiscoveryService, AuthService } from '@backstage/backend-plugin-api';
import { CatalogProcessor, CatalogProcessorEmit, CatalogProcessorCache } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';
import { MarketplacePlugin, MarketplacePackage } from '@red-hat-developer-hub/backstage-plugin-marketplace-common';

/**
 * @public
 */
declare const catalogModuleMarketplace: _backstage_backend_plugin_api.BackendFeature;

/**
 * @public
 */
declare class MarketplacePluginProcessor implements CatalogProcessor {
    private readonly validators;
    getProcessorName(): string;
    validateEntityKind(entity: Entity): Promise<boolean>;
    postProcessEntity(entity: MarketplacePlugin, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity>;
}

/**
 * @public
 */
declare class MarketplaceCollectionProcessor implements CatalogProcessor {
    private readonly validators;
    validateEntityKind(entity: Entity): Promise<boolean>;
    getProcessorName(): string;
    postProcessEntity(entity: Entity, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity>;
}

/**
 * @public
 */
type CachedData = {
    [key: string]: number | string[];
    plugins: any;
    cachedTime: number;
};
/**
 * @public
 */
declare class DynamicPackageInstallStatusProcessor implements CatalogProcessor {
    private discovery;
    private auth;
    private readonly cacheTTLMilliseconds;
    constructor(discovery: DiscoveryService, auth: AuthService);
    getProcessorName(): string;
    getInstalledPlugins(): Promise<any>;
    getCachedPlugins(cache: CatalogProcessorCache, entityRef: string): Promise<CachedData>;
    /**
     * Determines if cached data is expired based on TTL
     *
     * @param cachedData - The cached data for this entity
     * @returns True if data is expired
     */
    private isExpired;
    preProcessEntity(entity: Entity, _location: LocationSpec, _emit: CatalogProcessorEmit, _originLocation: LocationSpec, cache: CatalogProcessorCache): Promise<Entity>;
}

/**
 * @public
 */
declare class LocalPackageInstallStatusProcessor implements CatalogProcessor {
    private workspacesPath;
    private customPaths;
    /**
     *
     * @param paths - pass the workspaces to find the installed packages. Defaults to backstage default workspaces ['packages/app', 'packages/backend']
     */
    constructor(paths?: string[]);
    getProcessorName(): string;
    findWorkspacesPath(startPath?: string): string;
    private isPackageInstalled;
    preProcessEntity(entity: MarketplacePackage): Promise<MarketplacePackage>;
}

/**
 * @public
 */
declare class MarketplacePackageProcessor implements CatalogProcessor {
    private readonly validators;
    getProcessorName(): string;
    validateEntityKind(entity: Entity): Promise<boolean>;
    postProcessEntity(entity: MarketplacePackage, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity>;
}

export { type CachedData, DynamicPackageInstallStatusProcessor, LocalPackageInstallStatusProcessor, MarketplaceCollectionProcessor, MarketplacePackageProcessor, MarketplacePluginProcessor, catalogModuleMarketplace as default };
