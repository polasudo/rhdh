import { TemplateAction } from '@backstage/plugin-scaffolder-node';
import { DiscoveryApi } from '@backstage/core-plugin-api';
import { AuthService } from '@backstage/backend-plugin-api';
import { JsonObject } from '@backstage/config/index';
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
}): TemplateAction<{
    path: string;
    method: Methods;
    headers?: Headers;
    params?: Params;
    body?: any;
    logRequestPath?: boolean;
    continueOnBadResponse?: boolean;
}, JsonObject>;

export { createHttpBackstageAction };
