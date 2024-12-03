import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { AuthService, LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { Events } from '@backstage/plugin-bitbucket-cloud-common';
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { EventsService } from '@backstage/plugin-events-node';

/**
 * @public
 */
declare const catalogModuleBitbucketCloudEntityProvider: _backstage_backend_plugin_api.BackendFeature;

/**
 * Discovers catalog files located in [Bitbucket Cloud](https://bitbucket.org).
 * The provider will search your Bitbucket Cloud account and register catalog files matching the configured path
 * as Location entity and via following processing steps add all contained catalog entities.
 * This can be useful as an alternative to static locations or manually adding things to the catalog.
 *
 * @public
 */
declare class BitbucketCloudEntityProvider implements EntityProvider {
    private readonly auth;
    private readonly catalogApi;
    private readonly client;
    private readonly config;
    private readonly events;
    private readonly logger;
    private readonly scheduleFn;
    private connection?;
    static fromConfig(config: Config, options: {
        auth: AuthService;
        catalogApi: CatalogApi;
        events: EventsService;
        logger: LoggerService;
        schedule?: SchedulerServiceTaskRunner;
        scheduler?: SchedulerService;
    }): BitbucketCloudEntityProvider[];
    private constructor();
    private createScheduleFn;
    /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
    getProviderName(): string;
    /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getTaskId} */
    getTaskId(): string;
    /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
    connect(connection: EntityProviderConnection): Promise<void>;
    refresh(logger: LoggerService): Promise<void>;
    private enhanceEvent;
    onRepoPush(event: Events.RepoPushEvent): Promise<void>;
    private findExistingLocations;
    private findCatalogFiles;
    private matchesFilters;
    private toDeferredEntities;
    private static toUrl;
    private static toLocationSpec;
}

export { BitbucketCloudEntityProvider, catalogModuleBitbucketCloudEntityProvider as default };
