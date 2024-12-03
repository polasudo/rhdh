import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { CustomObjectsApi } from '@kubernetes/client-node';

declare const bundle: _backstage_backend_plugin_api.BackendFeature;

/**
 * Provides OpenShift cluster resource entities from Open Cluster Management.
 */
declare class ManagedClusterProvider implements EntityProvider {
    protected readonly client: CustomObjectsApi;
    protected readonly hubResourceName: string;
    protected readonly id: string;
    protected readonly owner: string;
    protected readonly logger: LoggerService;
    private readonly scheduleFn;
    protected connection?: EntityProviderConnection;
    protected constructor(client: CustomObjectsApi, hubResourceName: string, id: string, deps: {
        logger: LoggerService;
    }, owner: string, taskRunner: SchedulerServiceTaskRunner);
    static fromConfig(deps: {
        config: Config;
        logger: LoggerService;
    }, options: {
        schedule: SchedulerServiceTaskRunner;
    } | {
        scheduler: SchedulerService;
    }): ManagedClusterProvider[];
    connect(connection: EntityProviderConnection): Promise<void>;
    private createScheduleFn;
    getProviderName(): string;
    run(): Promise<void>;
}

declare const catalogModuleOCMEntityProvider: _backstage_backend_plugin_api.BackendFeature;

declare const ocmPlugin: _backstage_backend_plugin_api.BackendFeature;

export { ManagedClusterProvider, catalogModuleOCMEntityProvider, bundle as default, ocmPlugin };
