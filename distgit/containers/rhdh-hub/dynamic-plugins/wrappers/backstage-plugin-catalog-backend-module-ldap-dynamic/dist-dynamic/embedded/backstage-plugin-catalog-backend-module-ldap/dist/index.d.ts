import { Config } from '@backstage/config';
import { EntityProvider, EntityProviderConnection, CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { SchedulerServiceTaskScheduleDefinition, LoggerService, SchedulerServiceTaskRunner, SchedulerService } from '@backstage/backend-plugin-api';
import { JsonValue } from '@backstage/types';
import { SearchOptions, SearchEntry, Client } from 'ldapjs';
import { UserEntity, GroupEntity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { UserTransformer as UserTransformer$1, GroupTransformer as GroupTransformer$1 } from '@backstage/plugin-catalog-backend-module-ldap';

/**
 * The configuration parameters for a single LDAP provider.
 *
 * @public
 */
type LdapProviderConfig = {
    id: string;
    target: string;
    tls?: TLSConfig;
    bind?: BindConfig;
    users: UserConfig[];
    groups: GroupConfig[];
    schedule?: SchedulerServiceTaskScheduleDefinition;
    vendor?: VendorConfig;
};
/**
 * TLS settings
 *
 * @public
 */
type TLSConfig = {
    rejectUnauthorized?: boolean;
    keys?: string;
    certs?: string;
};
/**
 * The settings to use for the a command.
 *
 * @public
 */
type BindConfig = {
    dn: string;
    secret: string;
};
/**
 * The settings that govern the reading and interpretation of users.
 *
 * @public
 */
type UserConfig = {
    dn: string;
    options: SearchOptions;
    set?: {
        [path: string]: JsonValue;
    };
    map: {
        rdn: string;
        name: string;
        description?: string;
        displayName: string;
        email: string;
        picture?: string;
        memberOf: string;
    };
};
/**
 * The settings that govern the reading and interpretation of groups.
 *
 * @public
 */
type GroupConfig = {
    dn: string;
    options: SearchOptions;
    set?: {
        [path: string]: JsonValue;
    };
    map: {
        rdn: string;
        name: string;
        description: string;
        type: string;
        displayName: string;
        email?: string;
        picture?: string;
        memberOf: string;
        members: string;
    };
};
/**
 * Configuration for LDAP vendor-specific attributes.
 *
 * Allows custom attribute names for distinguished names (DN) and
 * universally unique identifiers (UUID) in LDAP directories.
 *
 * @public
 */
type VendorConfig = {
    /**
     * Attribute name for the distinguished name (DN) of an entry,
     */
    dnAttributeName?: string;
    /**
     * Attribute name for the unique identifier (UUID) of an entry,
     */
    uuidAttributeName?: string;
};
/**
 * Parses configuration.
 *
 * @param config - The root of the LDAP config hierarchy
 *
 * @public
 * @deprecated This exists for backwards compatibility only and will be removed in the future.
 */
declare function readLdapLegacyConfig(config: Config): LdapProviderConfig[];
/**
 * Parses all configured providers.
 *
 * @param config - The root of the LDAP config hierarchy
 *
 * @public
 */
declare function readProviderConfigs(config: Config): LdapProviderConfig[];

/**
 * An LDAP Vendor handles unique nuances between different vendors.
 *
 * @public
 */
type LdapVendor = {
    /**
     * The attribute name that holds the distinguished name (DN) for an entry.
     */
    dnAttributeName: string;
    /**
     * The attribute name that holds a universal unique identifier for an entry.
     */
    uuidAttributeName: string;
    /**
     * Decode ldap entry values for a given attribute name to their string representation.
     *
     * @param entry - The ldap entry
     * @param name - The attribute to decode
     */
    decodeStringAttribute: (entry: SearchEntry, name: string) => string[];
};

/**
 * Basic wrapper for the `ldapjs` library.
 *
 * Helps out with promisifying calls, paging, binding etc.
 *
 * @public
 */
declare class LdapClient {
    private readonly client;
    private readonly logger;
    private vendor;
    static create(logger: LoggerService, target: string, bind?: BindConfig, tls?: TLSConfig): Promise<LdapClient>;
    constructor(client: Client, logger: LoggerService);
    /**
     * Performs an LDAP search operation.
     *
     * @param dn - The fully qualified base DN to search within
     * @param options - The search options
     */
    search(dn: string, options: SearchOptions): Promise<SearchEntry[]>;
    /**
     * Performs an LDAP search operation, calls a function on each entry to limit memory usage
     *
     * @param dn - The fully qualified base DN to search within
     * @param options - The search options
     * @param f - The callback to call on each search entry
     */
    searchStreaming(dn: string, options: SearchOptions, f: (entry: SearchEntry) => Promise<void> | void): Promise<void>;
    /**
     * Get the Server Vendor.
     * Currently only detects Microsoft Active Directory Servers.
     *
     * @see https://ldapwiki.com/wiki/Determine%20LDAP%20Server%20Vendor
     */
    getVendor(): Promise<LdapVendor>;
    /**
     * Get the Root DSE.
     *
     * @see https://ldapwiki.com/wiki/RootDSE
     */
    getRootDSE(): Promise<SearchEntry | undefined>;
}

/**
 * Maps a single-valued attribute to a consumer.
 *
 * This helper can be useful when implementing a user or group transformer.
 *
 * @param entry - The LDAP source entry
 * @param vendor - The LDAP vendor
 * @param attributeName - The source attribute to map. If the attribute is
 *        undefined the mapping will be silently ignored.
 * @param setter - The function to be called with the decoded attribute from the
 *        source entry
 *
 * @public
 */
declare function mapStringAttr(entry: SearchEntry, vendor: LdapVendor, attributeName: string | undefined, setter: (value: string) => void): void;

/**
 * The name of an entity annotation, that references the RDN of the LDAP object
 * it was ingested from.
 *
 * The RDN is the name of the leftmost attribute that identifies the item; for
 * example, for an item with the fully qualified DN
 * uid=john,ou=people,ou=spotify,dc=spotify,dc=net the generated entity would
 * have this annotation, with the value "john".
 *
 * @public
 */
declare const LDAP_RDN_ANNOTATION = "backstage.io/ldap-rdn";
/**
 * The name of an entity annotation, that references the DN of the LDAP object
 * it was ingested from.
 *
 * The DN is the fully qualified name that identifies the item; for example,
 * for an item with the DN uid=john,ou=people,ou=spotify,dc=spotify,dc=net the
 * generated entity would have this annotation, with that full string as its
 * value.
 *
 * @public
 */
declare const LDAP_DN_ANNOTATION = "backstage.io/ldap-dn";
/**
 * The name of an entity annotation, that references the UUID of the LDAP
 * object it was ingested from.
 *
 * The UUID is the globally unique ID that identifies the item; for example,
 * for an item with the UUID 76ef928a-b251-1037-9840-d78227f36a7e, the
 * generated entity would have this annotation, with that full string as its
 * value.
 *
 * @public
 */
declare const LDAP_UUID_ANNOTATION = "backstage.io/ldap-uuid";

/**
 * Customize the ingested User entity
 *
 * @param vendor - The LDAP vendor that can be used to find and decode vendor
 *        specific attributes
 * @param config - The User specific config used by the default transformer.
 * @param user - The found LDAP entry in its source format. This is the entry
 *        that you want to transform
 * @returns A `UserEntity` or `undefined` if you want to ignore the found user
 *          for being ingested by the catalog
 *
 * @public
 */
type UserTransformer = (vendor: LdapVendor, config: UserConfig, user: SearchEntry) => Promise<UserEntity | undefined>;
/**
 * Customize the ingested Group entity
 *
 * @param vendor - The LDAP vendor that can be used to find and decode vendor
 *        specific attributes
 * @param config - The Group specific config used by the default transformer.
 * @param group - The found LDAP entry in its source format. This is the entry
 *        that you want to transform
 * @returns A `GroupEntity` or `undefined` if you want to ignore the found group
 *          for being ingested by the catalog
 *
 * @public
 */
type GroupTransformer = (vendor: LdapVendor, config: GroupConfig, group: SearchEntry) => Promise<GroupEntity | undefined>;

/**
 * The default implementation of the transformation from an LDAP entry to a
 * User entity.
 *
 * @public
 */
declare function defaultUserTransformer(vendor: LdapVendor, config: UserConfig, entry: SearchEntry): Promise<UserEntity | undefined>;
/**
 * The default implementation of the transformation from an LDAP entry to a
 * Group entity.
 *
 * @public
 */
declare function defaultGroupTransformer(vendor: LdapVendor, config: GroupConfig, entry: SearchEntry): Promise<GroupEntity | undefined>;
/**
 * Reads users and groups out of an LDAP provider.
 *
 * @param client - The LDAP client
 * @param userConfig - The user data configuration
 * @param groupConfig - The group data configuration
 * @param options - Additional options
 *
 * @public
 */
declare function readLdapOrg(client: LdapClient, userConfig: UserConfig[], groupConfig: GroupConfig[], vendorConfig: VendorConfig | undefined, options: {
    groupTransformer?: GroupTransformer;
    userTransformer?: UserTransformer;
    logger: LoggerService;
}): Promise<{
    users: UserEntity[];
    groups: GroupEntity[];
}>;

/**
 * Options for {@link LdapOrgEntityProvider}.
 *
 * @public
 */
type LdapOrgEntityProviderOptions = LdapOrgEntityProviderLegacyOptions | {
    /**
     * The logger to use.
     */
    logger: LoggerService;
    /**
     * The refresh schedule to use.
     *
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
     * Scheduler used to schedule refreshes based on
     * the schedule config.
     */
    scheduler?: SchedulerService;
    /**
     * The function that transforms a user entry in msgraph to an entity.
     * Optionally, you can pass separate transformers per provider ID.
     */
    userTransformer?: UserTransformer | Record<string, UserTransformer>;
    /**
     * The function that transforms a group entry in msgraph to an entity.
     * Optionally, you can pass separate transformers per provider ID.
     */
    groupTransformer?: GroupTransformer | Record<string, GroupTransformer>;
};
/**
 * Options for {@link LdapOrgEntityProvider}.
 *
 * @public
 * @deprecated This interface exists for backwards compatibility only and will be removed in the future.
 */
interface LdapOrgEntityProviderLegacyOptions {
    /**
     * A unique, stable identifier for this provider.
     *
     * @example "production"
     */
    id: string;
    /**
     * The target that this provider should consume.
     *
     * Should exactly match the "target" field of one of the "ldap.providers"
     * configuration entries.
     *
     * @example "ldaps://ds-read.example.net"
     */
    target: string;
    /**
     * The logger to use.
     */
    logger: LoggerService;
    /**
     * The refresh schedule to use.
     *
     * @remarks
     *
     * If you pass in 'manual', you are responsible for calling the `read` method
     * manually at some interval.
     *
     * But more commonly you will pass in the result of
     * {@link @backstage/backend-plugin-api#SchedulerService.createScheduledTaskRunner}
     * to enable automatic scheduling of tasks.
     */
    schedule: 'manual' | SchedulerServiceTaskRunner;
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
 * Reads user and group entries out of an LDAP service, and provides them as
 * User and Group entities for the catalog.
 *
 * @remarks
 *
 * Add an instance of this class to your catalog builder, and then periodically
 * call the {@link LdapOrgEntityProvider.read} method.
 *
 * @public
 */
declare class LdapOrgEntityProvider implements EntityProvider {
    private options;
    private connection?;
    private scheduleFn?;
    static fromConfig(configRoot: Config, options: LdapOrgEntityProviderOptions): LdapOrgEntityProvider[];
    static fromLegacyConfig(configRoot: Config, options: LdapOrgEntityProviderLegacyOptions): LdapOrgEntityProvider;
    constructor(options: {
        id: string;
        provider: LdapProviderConfig;
        logger: LoggerService;
        userTransformer?: UserTransformer;
        groupTransformer?: GroupTransformer;
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
    private schedule;
}

/**
 * Extracts teams and users out of an LDAP server.
 *
 * @public
 */
declare class LdapOrgReaderProcessor implements CatalogProcessor {
    private readonly providers;
    private readonly logger;
    private readonly groupTransformer?;
    private readonly userTransformer?;
    static fromConfig(configRoot: Config, options: {
        logger: LoggerService;
        groupTransformer?: GroupTransformer;
        userTransformer?: UserTransformer;
    }): LdapOrgReaderProcessor;
    constructor(options: {
        providers: LdapProviderConfig[];
        logger: LoggerService;
        groupTransformer?: GroupTransformer;
        userTransformer?: UserTransformer;
    });
    getProcessorName(): string;
    readLocation(location: LocationSpec, _optional: boolean, emit: CatalogProcessorEmit): Promise<boolean>;
}

/**
 * Interface for {@link LdapOrgEntityProviderTransformsExtensionPoint}.
 *
 * @public
 */
interface LdapOrgEntityProviderTransformsExtensionPoint {
    /**
     * Set the function that transforms a user entry in LDAP to an entity.
     * Optionally, you can pass separate transformers per provider ID.
     */
    setUserTransformer(transformer: UserTransformer$1 | Record<string, UserTransformer$1>): void;
    /**
     * Set the function that transforms a group entry in LDAP to an entity.
     * Optionally, you can pass separate transformers per provider ID.
     */
    setGroupTransformer(transformer: GroupTransformer$1 | Record<string, GroupTransformer$1>): void;
}
/**
 * Extension point used to customize the transforms used by the module.
 *
 * @public
 */
declare const ldapOrgEntityProviderTransformsExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<LdapOrgEntityProviderTransformsExtensionPoint>;
/**
 * Registers the LdapOrgEntityProvider with the catalog processing extension point.
 *
 * @public
 */
declare const catalogModuleLdapOrgEntityProvider: _backstage_backend_plugin_api.BackendFeature;

export { type BindConfig, type GroupConfig, type GroupTransformer, LDAP_DN_ANNOTATION, LDAP_RDN_ANNOTATION, LDAP_UUID_ANNOTATION, LdapClient, LdapOrgEntityProvider, type LdapOrgEntityProviderLegacyOptions, type LdapOrgEntityProviderOptions, type LdapOrgEntityProviderTransformsExtensionPoint, LdapOrgReaderProcessor, type LdapProviderConfig, type LdapVendor, type TLSConfig, type UserConfig, type UserTransformer, type VendorConfig, catalogModuleLdapOrgEntityProvider as default, defaultGroupTransformer, defaultUserTransformer, ldapOrgEntityProviderTransformsExtensionPoint, mapStringAttr, readLdapLegacyConfig, readLdapOrg, readProviderConfigs };
