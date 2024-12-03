import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';

type JobTemplates = any[];

declare function listJobTemplates(baseUrl: string, access_token: string): Promise<JobTemplates>;
declare function listWorkflowJobTemplates(baseUrl: string, access_token: string): Promise<JobTemplates>;

declare const catalogModuleAapResourceEntityProvider: _backstage_backend_plugin_api.BackendFeature;

declare class AapResourceEntityProvider implements EntityProvider {
    private readonly env;
    private readonly baseUrl;
    private readonly authorization;
    private readonly owner;
    private readonly system;
    private readonly logger;
    private readonly scheduleFn;
    private connection?;
    static fromConfig(deps: {
        config: Config;
        logger: LoggerService;
    }, options: {
        schedule: SchedulerServiceTaskRunner;
    } | {
        scheduler: SchedulerService;
    }): AapResourceEntityProvider[];
    private constructor();
    createScheduleFn(taskRunner: SchedulerServiceTaskRunner): () => Promise<void>;
    getProviderName(): string;
    connect(connection: EntityProviderConnection): Promise<void>;
    run(): Promise<void>;
    private buildApiEntityFromJobTemplate;
}

export { AapResourceEntityProvider, catalogModuleAapResourceEntityProvider as default, listJobTemplates, listWorkflowJobTemplates };
