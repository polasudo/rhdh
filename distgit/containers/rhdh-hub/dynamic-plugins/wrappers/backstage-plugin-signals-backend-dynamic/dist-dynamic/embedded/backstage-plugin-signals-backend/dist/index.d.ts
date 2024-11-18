import express from 'express';
import { Config } from '@backstage/config';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, DiscoveryService, LifecycleService, AuthService, UserInfoService } from '@backstage/backend-plugin-api';
import { IdentityApi } from '@backstage/plugin-auth-node';
import { EventsService } from '@backstage/plugin-events-node';

/**
 * @public
 * @deprecated Please migrate to the new backend system as this will be removed in the future.
 */
interface RouterOptions {
    logger: LoggerService;
    events: EventsService;
    identity?: IdentityApi;
    discovery: DiscoveryService;
    config: Config;
    lifecycle?: LifecycleService;
    auth?: AuthService;
    userInfo?: UserInfoService;
}
/**
 * @public
 * @deprecated Please migrate to the new backend system as this will be removed in the future.
 */
declare function createRouter(options: RouterOptions): Promise<express.Router>;

/**
 * Signals backend plugin
 *
 * @public
 */
declare const signalsPlugin: _backstage_backend_plugin_api.BackendFeature;

export { type RouterOptions, createRouter, signalsPlugin as default };
