import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { DiscoveryService, AuthService } from '@backstage/backend-plugin-api';
import { CatalogProcessor, CatalogProcessorEmit, CatalogProcessorCache } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';
import { MarketplacePluginEntry } from '@red-hat-developer-hub/backstage-plugin-marketplace-common';

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
    postProcessEntity(entity: Entity, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity>;
}

/**
 * @public
 */
declare class MarketplacePluginListProcessor implements CatalogProcessor {
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
declare class DynamicPluginInstallStatusProcessor implements CatalogProcessor {
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
    preProcessEntity(entity: Entity, _location: LocationSpec, _emit: CatalogProcessorEmit, _originLocation: LocationSpec, cache: CatalogProcessorCache): Promise<MarketplacePluginEntry>;
}

/**
 * @public
 */
declare class LocalPluginInstallStatusProcessor implements CatalogProcessor {
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
    isJSON(str: string): boolean;
    preProcessEntity(entity: MarketplacePluginEntry): Promise<Entity>;
}

export { type CachedData, DynamicPluginInstallStatusProcessor, LocalPluginInstallStatusProcessor, MarketplacePluginListProcessor, MarketplacePluginProcessor, catalogModuleMarketplace as default };
