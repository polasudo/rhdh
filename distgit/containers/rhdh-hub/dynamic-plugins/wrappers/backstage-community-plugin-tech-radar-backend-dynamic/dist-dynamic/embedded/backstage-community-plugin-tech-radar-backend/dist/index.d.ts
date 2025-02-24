import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, RootConfigService, UrlReaderService } from '@backstage/backend-plugin-api';
import express from 'express';

/**
 * See UrlReader documentation: https://backstage.io/docs/backend-system/core-services/url-reader/
 *
 * @public
 */
interface RouterOptions {
    logger: LoggerService;
    config: RootConfigService;
    reader: UrlReaderService;
}
/**
 * Create the Tech Radar Router, used for reading the Tech Radar data from the provided URL.
 *
 * @public
 *
 * @param options - Router options
 */
declare function createRouter(options: RouterOptions): Promise<express.Router>;

/**
 * techRadarPlugin backend plugin
 *
 * @public
 */
declare const techRadarPlugin: _backstage_backend_plugin_api.BackendFeature;

export { type RouterOptions, createRouter, techRadarPlugin as default };
