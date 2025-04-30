import express from 'express';
import { Config } from '@backstage/config';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * Provide information about sonarqube instances and projects contained within
 * @public
 */
interface SonarqubeInfoProvider {
    /**
     * Get the sonarqube URL in configuration from a provided instanceName.
     *
     * If instanceName is omitted, default sonarqube instance is queried in config
     *
     * @param instanceName - Name of the sonarqube instance to get the info from
     * @returns the url of the instance
     */
    getBaseUrl(options?: {
        instanceName?: string;
    }): {
        baseUrl: string;
        externalBaseUrl?: string;
    };
    /**
     * Query the sonarqube instance corresponding to the instanceName to get all
     * measures for the component of key componentKey.
     *
     * If instanceName is omitted, default sonarqube instance is queried in config
     *
     * @param componentKey - component key of the project we want to get measure from.
     * @param instanceName - name of the instance (in config) where the project is hosted.
     * @returns All measures with the analysis date. Will return undefined if we
     * can't provide the full response
     */
    getFindings(options: {
        componentKey: string;
        instanceName?: string;
    }): Promise<SonarqubeFindings | undefined>;
}
/**
 * Information retrieved for a specific project in Sonarqube
 * @public
 */
interface SonarqubeFindings {
    /**
     * Last date of the analysis that have generated this finding
     */
    analysisDate: string;
    /**
     * All measures pertaining to the findings
     */
    measures: SonarqubeMeasure[];
}
/**
 * A specific measure on a project in Sonarqube
 * @public
 */
interface SonarqubeMeasure {
    /**
     * Name of the measure
     */
    metric: string;
    /**
     * Value of the measure
     */
    value: string;
}
/**
 * Information about a Sonarqube instance.
 * @public
 */
interface SonarqubeInstanceConfig {
    /**
     * Name of the instance. An instance name in configuration and catalog should match.
     */
    name: string;
    /**
     * Base url to access the instance
     */
    baseUrl: string;
    /**
     * External url to access the instance from the frontend
     */
    externalBaseUrl?: string;
    /**
     * Access token to access the sonarqube instance as generated in user profile.
     */
    apiKey: string;
}
/**
 * Holds multiple Sonarqube configurations.
 * @public
 */
declare class SonarqubeConfig {
    readonly instances: SonarqubeInstanceConfig[];
    /**
     *
     * @param instances - All information on all sonarqube instance from the config file
     */
    constructor(instances: SonarqubeInstanceConfig[]);
    /**
     * Read all Sonarqube instance configurations.
     * @param config - Root configuration
     * @returns A SonarqubeConfig that contains all configured Sonarqube instances.
     */
    static fromConfig(config: Config): SonarqubeConfig;
    /**
     * Gets a Sonarqube instance configuration by name, or the default one if no name is provided.
     * @param sonarqubeName - Optional name of the Sonarqube instance.
     * @returns The requested Sonarqube instance.
     * @throws Error when no default config could be found or the requested name couldn't be found in config.
     */
    getInstanceConfig(options?: {
        sonarqubeName?: string;
    }): SonarqubeInstanceConfig;
}
/**
 * @public
 *
 * Use default config and annotations, build using fromConfig static function.
 */
declare class DefaultSonarqubeInfoProvider implements SonarqubeInfoProvider {
    private readonly config;
    private readonly logger;
    private constructor();
    /**
     * Generate an instance from a Config instance
     * @param config - Backend configuration
     */
    static fromConfig(config: Config, logger: LoggerService): DefaultSonarqubeInfoProvider;
    /**
     * Retrieve all supported metrics from a sonarqube instance.
     *
     * @param instanceUrl - URL of the sonarqube instance
     * @param token - token to access the sonarqube instance
     * @returns The list of supported metrics, if no metrics are supported an empty list is provided in the promise
     */
    private getSupportedMetrics;
    /**
     * Call an API with provided arguments
     * @param url - URL of the API to call
     * @param path - path to call
     * @param authToken - token used as basic auth user without password
     * @param query - parameters to provide to the call
     * @returns A promise on the answer to the API call if the answer status code is 200, undefined otherwise.
     */
    private callApi;
    /**
     * {@inheritDoc SonarqubeInfoProvider.getBaseUrl}
     * @throws Error If configuration can't be retrieved.
     */
    getBaseUrl(options?: {
        instanceName?: string;
    }): {
        baseUrl: string;
        externalBaseUrl?: string;
    };
    /**
     * {@inheritDoc SonarqubeInfoProvider.getFindings}
     * @throws Error If configuration can't be retrieved.
     */
    getFindings(options: {
        componentKey: string;
        instanceName?: string;
    }): Promise<SonarqubeFindings | undefined>;
}

/**
 * @deprecated Please migrate to the new backend system as this will be removed in the future.
 *
 * Dependencies needed by the router
 * @public
 */
interface RouterOptions {
    /**
     * Logger for logging purposes
     */
    logger: LoggerService;
    /**
     * Info provider to be able to get all necessary information for the APIs
     */
    sonarqubeInfoProvider: SonarqubeInfoProvider;
}
/**
 * @deprecated Please migrate to the new backend system as this will be removed in the future.
 *
 * @public
 *
 * Constructs a sonarqube router.
 *
 * Expose endpoint to get information on or for a sonarqube instance.
 *
 * @param options - Dependencies of the router
 */
declare function createRouter(options: RouterOptions): Promise<express.Router>;

/**
 * Sonarqube backend plugin
 *
 * @public
 */
declare const sonarqubePlugin: _backstage_backend_plugin_api.BackendFeature;

export { DefaultSonarqubeInfoProvider, type RouterOptions, SonarqubeConfig, type SonarqubeFindings, type SonarqubeInfoProvider, type SonarqubeInstanceConfig, type SonarqubeMeasure, createRouter, sonarqubePlugin as default };
