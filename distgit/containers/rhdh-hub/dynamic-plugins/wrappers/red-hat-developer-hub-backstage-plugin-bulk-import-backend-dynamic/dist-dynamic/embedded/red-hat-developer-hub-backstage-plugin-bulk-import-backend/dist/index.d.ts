import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, CacheService, DiscoveryService, HttpAuthService, AuthService } from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { PermissionEvaluator } from '@backstage/plugin-permission-common';
import express from 'express';

/**
 * The bulk-import backend plugin.
 * @public
 */
declare const bulkImportPlugin: _backstage_backend_plugin_api.BackendFeature;

/**
 * Router Options
 * @public
 */
interface RouterOptions {
    logger: LoggerService;
    permissions: PermissionEvaluator;
    config: Config;
    cache: CacheService;
    discovery: DiscoveryService;
    httpAuth: HttpAuthService;
    auth: AuthService;
    catalogApi: CatalogApi;
}
/**
 * Router
 * @public
 */
declare function createRouter(options: RouterOptions): Promise<express.Router>;

export { type RouterOptions, createRouter, bulkImportPlugin as default };
