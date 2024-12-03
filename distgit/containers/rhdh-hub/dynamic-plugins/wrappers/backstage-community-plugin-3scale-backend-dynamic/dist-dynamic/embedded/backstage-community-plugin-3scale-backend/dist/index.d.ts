import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';

interface Services {
    services: ServiceElement[];
}
interface ServiceElement {
    service: ServiceService;
}
interface ServiceService {
    id: number;
    name: string;
    state: string;
    system_name: string;
    backend_version: string;
    deployment_option: string;
    support_email: string;
    description: string;
    intentions_required: boolean;
    buyers_manage_apps: boolean;
    buyers_manage_keys: boolean;
    referrer_filters_required: boolean;
    custom_keys_enabled: boolean;
    buyer_key_regenerate_enabled: boolean;
    mandatory_app_key: boolean;
    buyer_can_select_plan: boolean;
    buyer_plan_change_permission: string;
    created_at: Date;
    updated_at: Date;
    links: Link[];
}
interface Link {
    rel: string;
    href: string;
}
interface APIDocs {
    api_docs: APIDocElement[];
}
interface APIDocElement {
    api_doc: APIDoc;
}
interface APIDoc {
    id: number;
    system_name: string;
    name: string;
    published: boolean;
    skip_swagger_validations: boolean;
    body: string;
    created_at: Date;
    updated_at: Date;
    description?: string;
    service_id?: number;
}
interface Proxy {
    proxy: ProxyElement;
}
interface ProxyElement {
    service_id: number;
    endpoint: string;
    api_backend: string;
    credentials_location: string;
    auth_app_key: string;
    auth_app_id: string;
    auth_user_key: string;
    error_auth_failed: string;
    error_auth_missing: string;
    error_status_auth_failed: number;
    error_headers_auth_failed: string;
    error_status_auth_missing: number;
    error_headers_auth_missing: string;
    error_no_match: string;
    error_status_no_match: number;
    error_headers_no_match: string;
    error_limits_exceeded: string;
    error_status_limits_exceeded: number;
    error_headers_limits_exceeded: string;
    secret_token: string;
    sandbox_endpoint: string;
    api_test_path: string;
    policies_config: PoliciesConfig[];
    created_at: Date;
    updated_at: Date;
    deployment_option: string;
    lock_version: number;
    links: Link[];
}
interface PoliciesConfig {
    name: string;
    version: string;
    configuration: Configuration;
    enabled: boolean;
}
interface Configuration {
    commands?: Command[];
}
interface Command {
    op: string;
    regex: string;
    replace: string;
}

declare function listServices(baseUrl: string, access_token: string, page: number, size: number): Promise<Services>;
declare function listApiDocs(baseUrl: string, access_token: string): Promise<APIDocs>;
declare function getProxyConfig(baseUrl: string, access_token: string, service_id: number): Promise<Proxy>;

declare const catalogModule3ScaleEntityProvider: _backstage_backend_plugin_api.BackendFeature;

declare class ThreeScaleApiEntityProvider implements EntityProvider {
    private static SERVICES_FETCH_SIZE;
    private readonly env;
    private readonly baseUrl;
    private readonly accessToken;
    private readonly logger;
    private readonly scheduleFn;
    private readonly openApiMerger;
    private connection?;
    static fromConfig(deps: {
        config: Config;
        logger: LoggerService;
    }, options: {
        schedule: SchedulerServiceTaskRunner;
        scheduler: SchedulerService;
    }): ThreeScaleApiEntityProvider[];
    private constructor();
    private createScheduleFn;
    getProviderName(): string;
    connect(connection: EntityProviderConnection): Promise<void>;
    run(): Promise<void>;
    private buildApiEntityFromService;
}

export { ThreeScaleApiEntityProvider, catalogModule3ScaleEntityProvider as default, getProxyConfig, listApiDocs, listServices };
