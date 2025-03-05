import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { BackstageCredentials, LoggerService, DiscoveryService, AuthService, HttpAuthService } from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { CompoundEntityRef } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import express from 'express';
import { PermissionEvaluator } from '@backstage/plugin-permission-common';

/** @public */
interface JenkinsInfoProvider {
    getInstance(options: {
        /**
         * The entity to get the info about.
         */
        entityRef: CompoundEntityRef;
        /**
         * Specific job(s) to get. This is only passed in when we know the job name(s) we are interested in.
         */
        fullJobNames?: string[];
        credentials?: BackstageCredentials;
        logger?: LoggerService;
    }): Promise<JenkinsInfo>;
}
/** @public */
interface JenkinsInfo {
    baseUrl: string;
    headers?: Record<string, string | string[]>;
    fullJobNames: string[];
    projectCountLimit: number;
    crumbIssuer?: boolean;
}
/** @public */
interface JenkinsInstanceConfig {
    name: string;
    baseUrl: string;
    username: string;
    projectCountLimit?: number;
    apiKey: string;
    crumbIssuer?: boolean;
    /**
     * Extra headers to send to Jenkins instance
     */
    extraRequestHeaders?: Record<string, string>;
    /**
     * Set a list of compatible regex strings for the url
     */
    allowedBaseUrlOverrideRegex?: string;
}
/**
 * Holds multiple Jenkins configurations.
 *
 * @public
 */
declare class JenkinsConfig {
    readonly instances: JenkinsInstanceConfig[];
    constructor(instances: JenkinsInstanceConfig[]);
    /**
     * Read all Jenkins instance configurations.
     * @param config - Root configuration
     * @returns A JenkinsConfig that contains all configured Jenkins instances.
     */
    static fromConfig(config: Config): JenkinsConfig;
    /**
     * Gets a Jenkins instance configuration by name, or the default one if no
     * name is provided.
     * @param jenkinsName - Optional name of the Jenkins instance.
     * @returns The requested Jenkins instance.
     */
    getInstanceConfig(jenkinsName?: string): JenkinsInstanceConfig;
}
/**
 * Use default config and annotations, build using fromConfig static function.
 *
 * This will fallback through various deprecated config and annotation schemes.
 *
 * @public
 */
declare class DefaultJenkinsInfoProvider implements JenkinsInfoProvider {
    private readonly config;
    private readonly catalog;
    private readonly auth;
    private logger;
    static readonly OLD_JENKINS_ANNOTATION = "jenkins.io/github-folder";
    static readonly NEW_JENKINS_ANNOTATION = "jenkins.io/job-full-name";
    static readonly JENKINS_OVERRIDE_URL = "jenkins.io/override-base-url";
    private constructor();
    static fromConfig(options: {
        config: Config;
        catalog: CatalogApi;
        discovery: DiscoveryService;
        auth: AuthService;
        httpAuth?: HttpAuthService;
        logger: LoggerService;
    }): DefaultJenkinsInfoProvider;
    getInstance(opt: {
        entityRef: CompoundEntityRef;
        fullJobNames?: string[];
        credentials?: BackstageCredentials;
    }): Promise<JenkinsInfo>;
    private static getEntityAnnotationValue;
    private static getEntityOverrideURL;
    private static verifyUrlMatchesRegex;
}

/** @public */
type JenkinsBuilderReturn = Promise<{
    router: express.Router;
}>;
/** @public */
interface JenkinsEnvironment {
    permissions: PermissionEvaluator;
    config: Config;
    logger: LoggerService;
    jenkinsInfoProvider: JenkinsInfoProvider;
    discovery: DiscoveryService;
    auth?: AuthService;
    httpAuth: HttpAuthService;
}
/** @public */
declare class JenkinsBuilder {
    protected readonly env: JenkinsEnvironment;
    static createBuilder(env: JenkinsEnvironment): JenkinsBuilder;
    constructor(env: JenkinsEnvironment);
    build(): Promise<{
        router: express.Router;
    }>;
    protected buildRouter(jenkinsInfoProvider: JenkinsInfoProvider, permissionApi: PermissionEvaluator, httpAuth: HttpAuthService): express.Router;
}

/**
 * Jenkins backend plugin
 *
 * @public
 */
declare const jenkinsPlugin: _backstage_backend_plugin_api.BackendFeature;

export { DefaultJenkinsInfoProvider, JenkinsBuilder, type JenkinsBuilderReturn, JenkinsConfig, type JenkinsEnvironment, type JenkinsInfo, type JenkinsInfoProvider, type JenkinsInstanceConfig, jenkinsPlugin as default };
