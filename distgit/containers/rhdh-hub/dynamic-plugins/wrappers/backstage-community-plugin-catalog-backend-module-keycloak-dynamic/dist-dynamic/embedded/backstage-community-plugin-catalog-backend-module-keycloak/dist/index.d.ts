import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { SchedulerServiceTaskScheduleDefinition, SchedulerServiceTaskRunner, SchedulerService, LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { GroupEntity, UserEntity } from '@backstage/catalog-model';
import GroupRepresentation from '@keycloak/keycloak-admin-client/lib/defs/groupRepresentation';
import UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation';

/**
 * @public
 */
interface GroupRepresentationWithParent extends GroupRepresentation {
    parentId?: string;
    parent?: string;
    members?: string[];
}
/**
 * @public
 */
interface GroupRepresentationWithParentAndEntity extends GroupRepresentationWithParent {
    entity: GroupEntity;
}
/**
 * @public
 */
interface UserRepresentationWithEntity extends UserRepresentation {
    entity: UserEntity;
}
/**
 * Customize the ingested User entity.
 *
 * @public
 *
 * @param entity - The output of the default parser.
 * @param user - The Keycloak user representation.
 * @param realm - The realm name.
 * @param groups - Data about available groups, which can be used to create additional relationships.
 *
 * @returns A promise resolving to a modified `UserEntity` object to be ingested into the catalog,
 * or `undefined` to reject the entity.
 */
type UserTransformer = (entity: UserEntity, user: UserRepresentation, realm: string, groups: GroupRepresentationWithParentAndEntity[]) => Promise<UserEntity | undefined>;
/**
 * Customize the ingested Group entity.
 *
 * @public
 *
 * @param entity - The output of the default parser.
 * @param group - The Keycloak group representation.
 * @param realm - The realm name.
 *
 * @returns A promise resolving to a modified `GroupEntity` object to be ingested into the catalog,
 * or `undefined` to reject the entity.
 */
type GroupTransformer = (entity: GroupEntity, group: GroupRepresentation, realm: string) => Promise<GroupEntity | undefined>;

/**
 * The configuration parameters for a single Keycloak provider.
 *
 * @public
 */
type KeycloakProviderConfig = {
    /**
     * Identifier of the provider which will be used i.e. at the location key for ingested entities.
     */
    id: string;
    /**
     * The Keycloak base URL
     */
    baseUrl: string;
    /**
     * The username to use for authenticating requests
     * If specified, password must also be specified
     */
    username?: string;
    /**
     * The password to use for authenticating requests
     * If specified, username must also be specified
     */
    password?: string;
    /**
     * The clientId to use for authenticating requests
     * If specified, clientSecret must also be specified
     */
    clientId?: string;
    /**
     * The clientSecret to use for authenticating requests
     * If specified, clientId must also be specified
     */
    clientSecret?: string;
    /**
     * name of the Keycloak realm
     */
    realm: string;
    /**
     * name of the Keycloak login realm
     */
    loginRealm?: string;
    /**
     * Schedule configuration for refresh tasks.
     */
    schedule?: SchedulerServiceTaskScheduleDefinition;
    /**
     * The number of users to query at a time.
     * @defaultValue 100
     * @remarks
     * This is a performance optimization to avoid querying too many users at once.
     * @see https://www.keycloak.org/docs-api/11.0/rest-api/index.html#_users_resource
     */
    userQuerySize?: number;
    /**
     * The number of groups to query at a time.
     * @defaultValue 100
     * @remarks
     * This is a performance optimization to avoid querying too many groups at once.
     * @see https://www.keycloak.org/docs-api/11.0/rest-api/index.html#_groups_resource
     */
    groupQuerySize?: number;
};

/**
 * Options for {@link KeycloakOrgEntityProvider}.
 *
 * @public
 */
interface KeycloakOrgEntityProviderOptions {
    /**
     * A unique, stable identifier for this provider.
     *
     * @example "production"
     */
    id: string;
    /**
     * The refresh schedule to use.
     * @remarks
     *
     * You can pass in the result of
     * {@link @backstage/backend-plugin-api#SchedulerService.createScheduledTaskRunner}
     * to enable automatic scheduling of tasks.
     */
    schedule?: SchedulerServiceTaskRunner;
    /**
     * Scheduler used to schedule refreshes based on
     * the schedule config.
     */
    scheduler?: SchedulerService;
    /**
     * The logger to use.
     */
    logger: LoggerService;
    /**
     * The function that transforms a user entry in LDAP to an entity.
     */
    userTransformer?: UserTransformer;
    /**
     * The function that transforms a group entry in LDAP to an entity.
     */
    groupTransformer?: GroupTransformer;
}
/**
 * Ingests org data (users and groups) from GitHub.
 *
 * @public
 */
declare class KeycloakOrgEntityProvider implements EntityProvider {
    private options;
    private connection?;
    private scheduleFn?;
    static fromConfig(deps: {
        config: Config;
        logger: LoggerService;
    }, options: ({
        schedule: SchedulerServiceTaskRunner;
    } | {
        scheduler: SchedulerService;
    }) & {
        userTransformer?: UserTransformer;
        groupTransformer?: GroupTransformer;
    }): KeycloakOrgEntityProvider[];
    constructor(options: {
        id: string;
        provider: KeycloakProviderConfig;
        logger: LoggerService;
        taskRunner: SchedulerServiceTaskRunner;
        userTransformer?: UserTransformer;
        groupTransformer?: GroupTransformer;
    });
    getProviderName(): string;
    connect(connection: EntityProviderConnection): Promise<void>;
    /**
     * Runs one complete ingestion loop. Call this method regularly at some
     * appropriate cadence.
     */
    read(options?: {
        logger?: LoggerService;
    }): Promise<void>;
    schedule(taskRunner: SchedulerServiceTaskRunner): void;
}

/**
 * @public
 */
declare const noopGroupTransformer: GroupTransformer;
/**
 * @public
 */
declare const noopUserTransformer: UserTransformer;
/**
 * @public
 * User transformer that sanitizes .metadata.name from email address to a valid name
 */
declare const sanitizeEmailTransformer: UserTransformer;

/**
 * An extension point that exposes the ability to implement user and group transformer functions for keycloak.
 *
 * @public
 */
declare const keycloakTransformerExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<KeycloakTransformerExtensionPoint>;
/**
 * The interface for {@link keycloakTransformerExtensionPoint}.
 *
 * @public
 */
type KeycloakTransformerExtensionPoint = {
    setUserTransformer(userTransformer: UserTransformer): void;
    setGroupTransformer(groupTransformer: GroupTransformer): void;
};

/**
 * Registers the `KeycloakEntityProvider` with the catalog processing extension point.
 *
 * @public
 */
declare const catalogModuleKeycloakEntityProvider: _backstage_backend_plugin_api.BackendFeature;

export { type GroupRepresentationWithParent, type GroupRepresentationWithParentAndEntity, type GroupTransformer, KeycloakOrgEntityProvider, type KeycloakOrgEntityProviderOptions, type KeycloakProviderConfig, type KeycloakTransformerExtensionPoint, type UserRepresentationWithEntity, type UserTransformer, catalogModuleKeycloakEntityProvider as default, keycloakTransformerExtensionPoint, noopGroupTransformer, noopUserTransformer, sanitizeEmailTransformer };
