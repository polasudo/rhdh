import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';

/**
 * @public
 */
declare const catalogModule3ScaleEntityProvider: _backstage_backend_plugin_api.BackendFeature;

/**
 * @public
 */
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

export { ThreeScaleApiEntityProvider, catalogModule3ScaleEntityProvider as default };
