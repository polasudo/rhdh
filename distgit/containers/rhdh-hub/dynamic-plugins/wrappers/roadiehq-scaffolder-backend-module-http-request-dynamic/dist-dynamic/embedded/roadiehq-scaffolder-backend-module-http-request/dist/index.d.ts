import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types from '@backstage/types';
import { DiscoveryApi } from '@backstage/core-plugin-api';
import { AuthService } from '@backstage/backend-plugin-api';
export { default } from './new-backend.js';

type Headers = {
    [key: string]: string;
};
type Params = {
    [key: string]: string;
};
type Methods = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'UPDATE' | 'DELETE' | 'PUT' | 'PATCH';

declare function createHttpBackstageAction(options: {
    discovery: DiscoveryApi;
    auth?: AuthService;
}): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    method: Methods;
    headers?: Headers;
    params?: Params;
    body?: any;
    logRequestPath?: boolean;
    continueOnBadResponse?: boolean;
}, _backstage_types.JsonObject>;

export { createHttpBackstageAction };
