import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { DiscoveryService, AuthService, LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import * as _backstage_catalog_model from '@backstage/catalog-model';
import { Entity, UserEntity } from '@backstage/catalog-model';
import { CatalogApi } from '@backstage/catalog-client';
import { GithubCredentialsProvider, ScmIntegrationRegistry, GithubIntegrationConfig } from '@backstage/integration';
import { ScmLocationAnalyzer, AnalyzeOptions, CatalogProcessor, LocationSpec, CatalogProcessorEmit, EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { TokenManager } from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { graphql } from '@octokit/graphql';
import { EventSubscriber, EventsService, EventParams } from '@backstage/plugin-events-node';

/**
 * Registers the `GithubEntityProvider` with the catalog processing extension point.
 *
 * @public
 */
declare const githubCatalogModule: _backstage_backend_plugin_api.BackendFeature;

/** @public */
type GithubLocationAnalyzerOptions = {
    config: Config;
    discovery: DiscoveryService;
    tokenManager?: TokenManager;
    auth?: AuthService;
    githubCredentialsProvider?: GithubCredentialsProvider;
    catalog?: CatalogApi;
};
/** @public */
declare class GithubLocationAnalyzer implements ScmLocationAnalyzer {
    private readonly catalogClient;
    private readonly githubCredentialsProvider;
    private readonly integrations;
    private readonly auth;
    constructor(options: GithubLocationAnalyzerOptions);
    supports(url: string): boolean;
    analyze(options: AnalyzeOptions): Promise<{
        existing: {
            location: {
                type: string;
                target: string;
            };
            isRegistered: boolean;
            entity: _backstage_catalog_model.Entity;
        }[];
    }>;
}

/**
 * Extracts repositories out of a GitHub org.
 *
 * The following will create locations for all projects which have a catalog-info.yaml
 * on the default branch. The first is shorthand for the second.
 *
 *    target: "https://github.com/backstage"
 *    or
 *    target: https://github.com/backstage/*\/blob/-/catalog-info.yaml
 *
 * You may also explicitly specify the source branch:
 *
 *    target: https://github.com/backstage/*\/blob/main/catalog-info.yaml
 *
 * @public
 */
declare class GithubDiscoveryProcessor implements CatalogProcessor {
    private readonly integrations;
    private readonly logger;
    private readonly githubCredentialsProvider;
    static fromConfig(config: Config, options: {
        logger: LoggerService;
        githubCredentialsProvider?: GithubCredentialsProvider;
    }): GithubDiscoveryProcessor;
    constructor(options: {
        integrations: ScmIntegrationRegistry;
        logger: LoggerService;
        githubCredentialsProvider?: GithubCredentialsProvider;
    });
    getProcessorName(): string;
    readLocation(location: LocationSpec, _optional: boolean, emit: CatalogProcessorEmit): Promise<boolean>;
}

/**
 * The configuration parameters for a multi-org GitHub processor.
 * @public
 */
type GithubMultiOrgConfig = Array<{
    /**
     * The name of the GitHub org to process.
     */
    name: string;
    /**
     * The namespace of the group created for this org.
     */
    groupNamespace: string;
    /**
     * The namespace of the users created for this org. If not specified defaults to undefined.
     */
    userNamespace: string | undefined;
}>;

/**
 * Context passed to Transformers
 *
 * @public
 */
interface TransformerContext {
    client: typeof graphql;
    query: string;
    org: string;
}
/**
 * Transformer for GitHub users to an Entity
 *
 * @public
 */
type UserTransformer = (item: GithubUser, ctx: TransformerContext) => Promise<Entity | undefined>;
/**
 * Transformer for GitHub Team to an Entity
 *
 * @public
 */
type TeamTransformer = (item: GithubTeam, ctx: TransformerContext) => Promise<Entity | undefined>;
/**
 * Default transformer for GitHub users to UserEntity
 *
 * @public
 */
declare const defaultUserTransformer: (item: GithubUser, _ctx: TransformerContext) => Promise<UserEntity | undefined>;
/**
 * Default transformer for GitHub Team to GroupEntity
 *
 * @public
 */
declare const defaultOrganizationTeamTransformer: TeamTransformer;

/**
 * Github User
 *
 * @public
 */
type GithubUser = {
    login: string;
    bio?: string;
    avatarUrl?: string;
    email?: string;
    name?: string;
    organizationVerifiedDomainEmails?: string[];
};
/**
 * Github Team
 *
 * @public
 */
type GithubTeam = {
    slug: string;
    combinedSlug: string;
    name?: string;
    description?: string;
    avatarUrl?: string;
    editTeamUrl?: string;
    parentTeam?: GithubTeam;
    members: GithubUser[];
};

/**
 * Extracts teams and users out of a multiple GitHub orgs namespaced per org.
 *
 * Be aware that this processor may not be compatible with future org structures in the catalog.
 *
 * @public
 */
declare class GithubMultiOrgReaderProcessor implements CatalogProcessor {
    private options;
    private readonly integrations;
    private readonly orgs;
    private readonly logger;
    private readonly githubCredentialsProvider;
    static fromConfig(config: Config, options: {
        logger: LoggerService;
        githubCredentialsProvider?: GithubCredentialsProvider;
        userTransformer?: UserTransformer;
        teamTransformer?: TeamTransformer;
    }): GithubMultiOrgReaderProcessor;
    constructor(options: {
        integrations: ScmIntegrationRegistry;
        logger: LoggerService;
        orgs: GithubMultiOrgConfig;
        githubCredentialsProvider?: GithubCredentialsProvider;
        userTransformer?: UserTransformer;
        teamTransformer?: TeamTransformer;
    });
    getProcessorName(): string;
    readLocation(location: LocationSpec, _optional: boolean, emit: CatalogProcessorEmit): Promise<boolean>;
    private getAllOrgs;
}

/**
 * Extracts teams and users out of a GitHub org.
 *
 * @remarks
 *
 * Consider using {@link GithubOrgEntityProvider} instead.
 *
 * @public
 */
declare class GithubOrgReaderProcessor implements CatalogProcessor {
    private readonly integrations;
    private readonly logger;
    private readonly githubCredentialsProvider;
    static fromConfig(config: Config, options: {
        logger: LoggerService;
        githubCredentialsProvider?: GithubCredentialsProvider;
    }): GithubOrgReaderProcessor;
    constructor(options: {
        integrations: ScmIntegrationRegistry;
        logger: LoggerService;
        githubCredentialsProvider?: GithubCredentialsProvider;
    });
    getProcessorName(): string;
    readLocation(location: LocationSpec, _optional: boolean, emit: CatalogProcessorEmit): Promise<boolean>;
    private createClient;
}

/**
 * Discovers catalog files located in [GitHub](https://github.com).
 * The provider will search your GitHub account and register catalog files matching the configured path
 * as Location entity and via following processing steps add all contained catalog entities.
 * This can be useful as an alternative to static locations or manually adding things to the catalog.
 *
 * @public
 */
declare class GithubEntityProvider implements EntityProvider, EventSubscriber {
    private readonly config;
    private readonly events?;
    private readonly logger;
    private readonly integration;
    private readonly scheduleFn;
    private connection?;
    private readonly githubCredentialsProvider;
    static fromConfig(config: Config, options: {
        events?: EventsService;
        logger: LoggerService;
        schedule?: SchedulerServiceTaskRunner;
        scheduler?: SchedulerService;
    }): GithubEntityProvider[];
    private constructor();
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
    getProviderName(): string;
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
    connect(connection: EntityProviderConnection): Promise<void>;
    private createScheduleFn;
    refresh(logger: LoggerService): Promise<void>;
    private createGraphqlClient;
    private findCatalogFiles;
    private matchesFilters;
    private createLocationUrl;
    private static toLocationSpec;
    /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.onEvent} */
    onEvent(params: EventParams): Promise<void>;
    /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.supportsEventTopics} */
    supportsEventTopics(): string[];
    private onPush;
    private onRepoChange;
    /**
     * A repository was archived.
     *
     * Removes all entities associated with the repository.
     *
     * @param event - The repository archived event.
     */
    private onRepoArchived;
    /**
     * A repository was deleted.
     *
     * Removes all entities associated with the repository.
     *
     * @param event - The repository deleted event.
     */
    private onRepoDeleted;
    /**
     * The topics, default branch, description, or homepage of a repository was changed.
     *
     * We are interested in potential topic changes as these can be used as part of the filters.
     *
     * Removes all entities associated with the repository if the repository no longer matches the filters.
     *
     * @param event - The repository edited event.
     */
    private onRepoEdited;
    /**
     * The name of a repository was changed.
     *
     * Removes all entities associated with the repository's old name.
     * Creates new entities for the repository's new name if it still matches the filters.
     *
     * @param event - The repository renamed event.
     */
    private onRepoRenamed;
    /**
     * Ownership of the repository was transferred to a user or organization account.
     * This event is only sent to the account where the ownership is transferred.
     * To receive the `repository.transferred` event, the new owner account must have the GitHub App installed,
     * and the App must be subscribed to "Repository" events.
     *
     * Creates new entities for the repository if it matches the filters.
     *
     * @param event - The repository unarchived event.
     */
    private onRepoTransferred;
    /**
     * A previously archived repository was unarchived.
     *
     * Creates new entities for the repository if it matches the filters.
     *
     * @param event - The repository unarchived event.
     */
    private onRepoUnarchived;
    private removeEntitiesForRepo;
    private addEntitiesForRepo;
    private createRepoFromEvent;
    private createRepoFromGithubResponse;
    private collectDeferredEntitiesFromCommit;
    private collectFilesFromCommit;
    private toDeferredEntities;
    private toDeferredEntitiesFromRepos;
}

/**
 * Options for {@link GithubMultiOrgEntityProvider}.
 *
 * @public
 */
interface GithubMultiOrgEntityProviderOptions {
    /**
     * A unique, stable identifier for this provider.
     *
     * @example "production"
     */
    id: string;
    /**
     * The target that this provider should consume.
     *
     * @example "https://mycompany.github.com"
     */
    githubUrl: string;
    /**
     * The list of the GitHub orgs to consume. By default, it will consume all accessible
     * orgs on the given GitHub instance (support for GitHub App integration only).
     */
    orgs?: string[];
    /**
     * Passing the optional EventsService enables event-based delta updates.
     */
    events?: EventsService;
    /**
     * The refresh schedule to use.
     *
     * @defaultValue "manual"
     * @remarks
     *
     * If you pass in 'manual', you are responsible for calling the `read` method
     * manually at some interval.
     *
     * But more commonly you will pass in the result of
     * {@link @backstage/backend-plugin-api#SchedulerService.createScheduledTaskRunner}
     * to enable automatic scheduling of tasks.
     */
    schedule?: 'manual' | SchedulerServiceTaskRunner;
    /**
     * The logger to use.
     */
    logger: LoggerService;
    /**
     * Optionally supply a custom credentials provider, replacing the default one.
     */
    githubCredentialsProvider?: GithubCredentialsProvider;
    /**
     * Use the default namespace for groups. By default, groups will be namespaced according to their GitHub org.
     *
     * @remarks
     *
     * If set to true, groups with the same name across different orgs will be considered the same group.
     */
    alwaysUseDefaultNamespace?: boolean;
    /**
     * Optionally include a user transformer for transforming from GitHub users to User Entities
     */
    userTransformer?: UserTransformer;
    /**
     * Optionally include a team transformer for transforming from GitHub teams to Group Entities.
     * By default, groups will be namespaced according to their GitHub org.
     */
    teamTransformer?: TeamTransformer;
}
/**
 * Ingests org data (users and groups) from GitHub.
 *
 * @public
 */
declare class GithubMultiOrgEntityProvider implements EntityProvider {
    private readonly options;
    private connection?;
    private scheduleFn?;
    static fromConfig(config: Config, options: GithubMultiOrgEntityProviderOptions): GithubMultiOrgEntityProvider;
    constructor(options: {
        events?: EventsService;
        id: string;
        gitHubConfig: GithubIntegrationConfig;
        githubCredentialsProvider: GithubCredentialsProvider;
        githubUrl: string;
        logger: LoggerService;
        orgs?: string[];
        userTransformer?: UserTransformer;
        teamTransformer?: TeamTransformer;
        alwaysUseDefaultNamespace?: boolean;
    });
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
    getProviderName(): string;
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
    connect(connection: EntityProviderConnection): Promise<void>;
    /**
     * Runs one single complete ingestion. This is only necessary if you use
     * manual scheduling.
     */
    read(options?: {
        logger?: LoggerService;
    }): Promise<void>;
    private onEvent;
    private onInstallationChange;
    private onMemberChangeInOrganization;
    private onTeamChangeInOrganization;
    private onTeamEditedInOrganization;
    private onMembershipChangedInTeam;
    private schedule;
    private defaultMultiOrgTeamTransformer;
    private getAllOrgs;
    private createAddEntitiesOperation;
    private createRemoveEntitiesOperation;
}

/**
 * Options for {@link GithubOrgEntityProvider}.
 *
 * @public
 */
interface GithubOrgEntityProviderOptions {
    /**
     * A unique, stable identifier for this provider.
     *
     * @example "production"
     */
    id: string;
    /**
     * The target that this provider should consume.
     *
     * @example "https://github.com/backstage"
     */
    orgUrl: string;
    /**
     * Passing the optional EventsService enables event-based delta updates.
     */
    events?: EventsService;
    /**
     * The refresh schedule to use.
     *
     * @defaultValue "manual"
     * @remarks
     *
     * If you pass in 'manual', you are responsible for calling the `read` method
     * manually at some interval.
     *
     * But more commonly you will pass in the result of
     * {@link @backstage/backend-plugin-api#SchedulerService.createScheduledTaskRunner}
     * to enable automatic scheduling of tasks.
     */
    schedule?: 'manual' | SchedulerServiceTaskRunner;
    /**
     * The logger to use.
     */
    logger: LoggerService;
    /**
     * Optionally supply a custom credentials provider, replacing the default one.
     */
    githubCredentialsProvider?: GithubCredentialsProvider;
    /**
     * Optionally include a user transformer for transforming from GitHub users to User Entities
     */
    userTransformer?: UserTransformer;
    /**
     * Optionally include a team transformer for transforming from GitHub teams to Group Entities
     */
    teamTransformer?: TeamTransformer;
}
/**
 * Ingests org data (users and groups) from GitHub.
 *
 * @public
 */
declare class GithubOrgEntityProvider implements EntityProvider {
    private options;
    private readonly credentialsProvider;
    private connection?;
    private scheduleFn?;
    static fromConfig(config: Config, options: GithubOrgEntityProviderOptions): GithubOrgEntityProvider;
    constructor(options: {
        events?: EventsService;
        id: string;
        orgUrl: string;
        gitHubConfig: GithubIntegrationConfig;
        logger: LoggerService;
        githubCredentialsProvider?: GithubCredentialsProvider;
        userTransformer?: UserTransformer;
        teamTransformer?: TeamTransformer;
    });
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
    getProviderName(): string;
    /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
    connect(connection: EntityProviderConnection): Promise<void>;
    /**
     * Runs one single complete ingestion. This is only necessary if you use
     * manual scheduling.
     */
    read(options?: {
        logger?: LoggerService;
    }): Promise<void>;
    private onEvent;
    private onTeamEditedInOrganization;
    private onMembershipChangedInOrganization;
    private onTeamChangeInOrganization;
    private onMemberChangeInOrganization;
    private schedule;
}

/**
 * @public
 * @deprecated Use {@link GithubOrgEntityProvider} instead.
 */
declare class GitHubOrgEntityProvider extends GithubOrgEntityProvider {
    static fromConfig(config: Config, options: GitHubOrgEntityProviderOptions): GitHubOrgEntityProvider;
}
/**
 * @public
 * @deprecated Use {@link GithubOrgEntityProviderOptions} instead.
 */
type GitHubOrgEntityProviderOptions = GithubOrgEntityProviderOptions;
/**
 * @public
 * @deprecated Use {@link GithubEntityProvider} instead.
 */
declare class GitHubEntityProvider implements EntityProvider {
    private readonly delegate;
    static fromConfig(config: Config, options: {
        logger: LoggerService;
        schedule?: SchedulerServiceTaskRunner;
        scheduler?: SchedulerService;
    }): GitHubEntityProvider[];
    private constructor();
    connect(connection: EntityProviderConnection): Promise<void>;
    getProviderName(): string;
    refresh(logger: LoggerService): Promise<void>;
}

export { GitHubEntityProvider, GitHubOrgEntityProvider, type GitHubOrgEntityProviderOptions, GithubDiscoveryProcessor, GithubEntityProvider, GithubLocationAnalyzer, type GithubLocationAnalyzerOptions, type GithubMultiOrgConfig, GithubMultiOrgEntityProvider, type GithubMultiOrgEntityProviderOptions, GithubMultiOrgReaderProcessor, GithubOrgEntityProvider, type GithubOrgEntityProviderOptions, GithubOrgReaderProcessor, type GithubTeam, type GithubUser, type TeamTransformer, type TransformerContext, type UserTransformer, githubCatalogModule as default, defaultOrganizationTeamTransformer, defaultUserTransformer };
