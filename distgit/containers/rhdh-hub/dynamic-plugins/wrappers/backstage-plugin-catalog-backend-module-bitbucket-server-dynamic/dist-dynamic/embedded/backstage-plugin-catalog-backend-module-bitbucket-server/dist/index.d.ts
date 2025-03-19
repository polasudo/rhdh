import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { BitbucketServerIntegrationConfig } from '@backstage/integration';
import { Config } from '@backstage/config';
import { LocationSpec, EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';

/**
 * @public
 */
declare const catalogModuleBitbucketServerEntityProvider: _backstage_backend_plugin_api.BackendFeature;

/** @public */
type BitbucketServerRepository = {
    project: {
        key: string;
    };
    slug: string;
    description: string;
    links: Record<string, {
        href: string;
    }[]>;
    archived: boolean;
};
/** @public */
type BitbucketServerProject = {
    key: string;
};

/**
 * A client for interacting with a Bitbucket Server instance
 *
 * @public
 */
declare class BitbucketServerClient {
    private readonly config;
    static fromConfig(options: {
        config: BitbucketServerIntegrationConfig;
    }): BitbucketServerClient;
    constructor(options: {
        config: BitbucketServerIntegrationConfig;
    });
    listProjects(options: {
        listOptions?: BitbucketServerListOptions;
    }): Promise<BitbucketServerPagedResponse<BitbucketServerProject>>;
    listRepositories(options: {
        projectKey: string;
        listOptions?: BitbucketServerListOptions;
    }): Promise<BitbucketServerPagedResponse<BitbucketServerRepository>>;
    getFile(options: {
        projectKey: string;
        repo: string;
        path: string;
    }): Promise<Response>;
    getRepository(options: {
        projectKey: string;
        repo: string;
    }): Promise<BitbucketServerRepository>;
    resolvePath(options: {
        projectKey: string;
        repo: string;
        path: string;
    }): {
        path: string;
    };
    private pagedRequest;
    private getTypeMapped;
    private get;
    private request;
}
/**
 * @public
 */
type BitbucketServerListOptions = {
    [key: string]: number | undefined;
    limit?: number | undefined;
    start?: number | undefined;
};
/**
 * @public
 */
type BitbucketServerPagedResponse<T> = {
    size: number;
    limit: number;
    start: number;
    isLastPage: boolean;
    values: T[];
    nextPageStart: number;
};

/**
 * A custom callback that reacts to finding a location by yielding entities.
 * Can be used for custom location/repository parsing logic.
 *
 * @public
 */
type BitbucketServerLocationParser = (options: {
    client: BitbucketServerClient;
    location: LocationSpec;
    logger: LoggerService;
}) => AsyncIterable<Entity>;

/**
 * Discovers catalog files located in Bitbucket Server.
 * The provider will search your Bitbucket Server instance and register catalog files matching the configured path
 * as Location entity and via following processing steps add all contained catalog entities.
 * This can be useful as an alternative to static locations or manually adding things to the catalog.
 *
 * @public
 */
declare class BitbucketServerEntityProvider implements EntityProvider {
    private readonly integration;
    private readonly config;
    private readonly parser;
    private readonly logger;
    private readonly scheduleFn;
    private connection?;
    static fromConfig(config: Config, options: {
        logger: LoggerService;
        parser?: BitbucketServerLocationParser;
        schedule?: SchedulerServiceTaskRunner;
        scheduler?: SchedulerService;
    }): BitbucketServerEntityProvider[];
    private constructor();
    private createScheduleFn;
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
    getProviderName(): string;
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
    connect(connection: EntityProviderConnection): Promise<void>;
    refresh(logger: LoggerService): Promise<void>;
    private findEntities;
}

export { BitbucketServerClient, BitbucketServerEntityProvider, type BitbucketServerListOptions, type BitbucketServerLocationParser, type BitbucketServerPagedResponse, type BitbucketServerProject, type BitbucketServerRepository, catalogModuleBitbucketServerEntityProvider as default };
