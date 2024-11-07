'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('express');
var require$$2 = require('express-promise-router');
var require$$3 = require('@backstage/errors');
var require$$0$1 = require('node-fetch');
var require$$0$2 = require('@backstage/backend-plugin-api');

var index_cjs = {};

var router_cjs = {};

var backendCommon = require$$0;
var express = require$$1;
var Router = require$$2;
var errors = require$$3;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat$1(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat$1(Router);

async function createRouter(options) {
  const { logger, sonarqubeInfoProvider } = options;
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.get("/findings", async (request, response) => {
    const componentKey = request.query.componentKey;
    const instanceKey = request.query.instanceKey;
    if (!componentKey)
      throw new errors.InputError("ComponentKey must be provided as a single string.");
    logger.info(
      instanceKey ? `Retrieving findings for component ${componentKey}  in sonarqube instance name ${instanceKey}` : `Retrieving findings for component ${componentKey} in default sonarqube instance`
    );
    response.json(
      await sonarqubeInfoProvider.getFindings({
        componentKey,
        instanceName: instanceKey
      })
    );
  });
  router.get("/instanceUrl", (request, response) => {
    const instanceKey = request.query.instanceKey;
    logger.info(
      instanceKey ? `Retrieving sonarqube instance URL for key ${instanceKey}` : `Retrieving default sonarqube instance URL as instanceKey is not provided`
    );
    const { baseUrl, externalBaseUrl } = sonarqubeInfoProvider.getBaseUrl({
      instanceName: instanceKey
    });
    response.json({
      instanceUrl: externalBaseUrl || baseUrl
    });
  });
  router.use(backendCommon.errorHandler());
  return router;
}

router_cjs.createRouter = createRouter;

var sonarqubeInfoProvider_cjs = {};

var fetch = require$$0$1;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

class SonarqubeConfig {
  /**
   *
   * @param instances - All information on all sonarqube instance from the config file
   */
  constructor(instances) {
    this.instances = instances;
  }
  /**
   * Read all Sonarqube instance configurations.
   * @param config - Root configuration
   * @returns A SonarqubeConfig that contains all configured Sonarqube instances.
   */
  static fromConfig(config) {
    const DEFAULT_SONARQUBE_NAME = "default";
    const sonarqubeConfig = config.getConfig("sonarqube");
    const namedInstanceConfig = sonarqubeConfig.getOptionalConfigArray("instances")?.map((c) => ({
      name: c.getString("name"),
      baseUrl: c.getString("baseUrl"),
      externalBaseUrl: c.getOptionalString("externalBaseUrl"),
      apiKey: c.getString("apiKey")
    })) || [];
    const hasNamedDefault = namedInstanceConfig.some(
      (x) => x.name === DEFAULT_SONARQUBE_NAME
    );
    const baseUrl = sonarqubeConfig.getOptionalString("baseUrl");
    const externalBaseUrl = sonarqubeConfig.getOptionalString("externalBaseUrl");
    const apiKey = sonarqubeConfig.getOptionalString("apiKey");
    if (hasNamedDefault && (baseUrl || externalBaseUrl || apiKey)) {
      throw new Error(
        `Found both a named sonarqube instance with name ${DEFAULT_SONARQUBE_NAME} and top level baseUrl or apiKey config. Use only one style of config.`
      );
    }
    const unnamedNonePresent = !baseUrl && !apiKey;
    const unnamedAllPresent = baseUrl && apiKey;
    if (!(unnamedAllPresent || unnamedNonePresent)) {
      throw new Error(
        `Found partial default sonarqube config. All (or none) of baseUrl and apiKey must be provided.`
      );
    }
    if (unnamedAllPresent) {
      const unnamedInstanceConfig = [
        { name: DEFAULT_SONARQUBE_NAME, baseUrl, externalBaseUrl, apiKey }
      ];
      return new SonarqubeConfig([
        ...namedInstanceConfig,
        ...unnamedInstanceConfig
      ]);
    }
    return new SonarqubeConfig(namedInstanceConfig);
  }
  /**
   * Gets a Sonarqube instance configuration by name, or the default one if no name is provided.
   * @param sonarqubeName - Optional name of the Sonarqube instance.
   * @returns The requested Sonarqube instance.
   * @throws Error when no default config could be found or the requested name couldn't be found in config.
   */
  getInstanceConfig(options = {}) {
    const { sonarqubeName } = options;
    const DEFAULT_SONARQUBE_NAME = "default";
    if (!sonarqubeName || sonarqubeName === DEFAULT_SONARQUBE_NAME) {
      const instanceConfig2 = this.instances.find(
        (c) => c.name === DEFAULT_SONARQUBE_NAME
      );
      if (!instanceConfig2) {
        throw new Error(
          `Couldn't find a default sonarqube instance in the config. Either configure an instance with name ${DEFAULT_SONARQUBE_NAME} or add a prefix to your annotation value.`
        );
      }
      return instanceConfig2;
    }
    const instanceConfig = this.instances.find((c) => c.name === sonarqubeName);
    if (!instanceConfig) {
      throw new Error(
        `Couldn't find a sonarqube instance in the config with name ${sonarqubeName}`
      );
    }
    return instanceConfig;
  }
}
class DefaultSonarqubeInfoProvider {
  constructor(config) {
    this.config = config;
  }
  /**
   * Generate an instance from a Config instance
   * @param config - Backend configuration
   */
  static fromConfig(config) {
    return new DefaultSonarqubeInfoProvider(SonarqubeConfig.fromConfig(config));
  }
  /**
   * Retrieve all supported metrics from a sonarqube instance.
   *
   * @param instanceUrl - URL of the sonarqube instance
   * @param token - token to access the sonarqube instance
   * @returns The list of supported metrics, if no metrics are supported an empty list is provided in the promise
   */
  // TODO(awanlin) - Add @private back
  static async getSupportedMetrics(instanceUrl, token) {
    const metrics = [];
    let nextPage = 1;
    for (; ; ) {
      const result = await DefaultSonarqubeInfoProvider.callApi(instanceUrl, "api/metrics/search", token, { ps: 500, p: nextPage });
      metrics.push(...result?.metrics?.map((m) => m.key) ?? []);
      if (result && metrics.length < result.total) {
        nextPage++;
        continue;
      }
      return metrics;
    }
  }
  /**
   * Call an API with provided arguments
   * @param url - URL of the API to call
   * @param path - path to call
   * @param authToken - token used as basic auth user without password
   * @param query - parameters to provide to the call
   * @returns A promise on the answer to the API call if the answer status code is 200, undefined otherwise.
   */
  // TODO(awanlin) - Add @private back
  static async callApi(url, path, authToken, query) {
    const encodedAuthToken = Buffer.from(`${authToken}:`).toString("base64");
    const response = await fetch__default.default(
      `${url}/${path}?${new URLSearchParams(query).toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedAuthToken}`
        }
      }
    );
    if (response.status === 200) {
      return await response.json();
    }
    return void 0;
  }
  /**
   * {@inheritDoc SonarqubeInfoProvider.getBaseUrl}
   * @throws Error If configuration can't be retrieved.
   */
  getBaseUrl(options = {}) {
    const instanceConfig = this.config.getInstanceConfig({
      sonarqubeName: options.instanceName
    });
    return {
      baseUrl: instanceConfig.baseUrl,
      externalBaseUrl: instanceConfig.externalBaseUrl
    };
  }
  /**
   * {@inheritDoc SonarqubeInfoProvider.getFindings}
   * @throws Error If configuration can't be retrieved.
   */
  async getFindings(options) {
    const { componentKey, instanceName } = options;
    const { baseUrl, apiKey } = this.config.getInstanceConfig({
      sonarqubeName: instanceName
    });
    const component = await DefaultSonarqubeInfoProvider.callApi(
      baseUrl,
      "api/components/show",
      apiKey,
      {
        component: componentKey
      }
    );
    if (!component || !component.component) {
      return void 0;
    }
    const supportedMetrics = await DefaultSonarqubeInfoProvider.getSupportedMetrics(baseUrl, apiKey);
    const wantedMetrics = [
      "alert_status",
      "bugs",
      "reliability_rating",
      "vulnerabilities",
      "security_rating",
      "security_hotspots_reviewed",
      "security_review_rating",
      "code_smells",
      "sqale_rating",
      "coverage",
      "duplicated_lines_density"
    ];
    const metricsToQuery = wantedMetrics.filter(
      (el) => supportedMetrics.includes(el)
    );
    const measures = await DefaultSonarqubeInfoProvider.callApi(
      baseUrl,
      "api/measures/component",
      apiKey,
      {
        component: componentKey,
        metricKeys: metricsToQuery.join(",")
      }
    );
    if (!measures) {
      return void 0;
    }
    return {
      analysisDate: component.component.analysisDate,
      measures: measures.component?.measures ?? []
    };
  }
}

sonarqubeInfoProvider_cjs.DefaultSonarqubeInfoProvider = DefaultSonarqubeInfoProvider;
sonarqubeInfoProvider_cjs.SonarqubeConfig = SonarqubeConfig;

var plugin_cjs = {};

var backendPluginApi = require$$0$2;
var sonarqubeInfoProvider$1 = sonarqubeInfoProvider_cjs;
var router$1 = router_cjs;

const sonarqubePlugin = backendPluginApi.createBackendPlugin({
  pluginId: "sonarqube",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        httpRouter: backendPluginApi.coreServices.httpRouter
      },
      async init({ logger, config, httpRouter }) {
        httpRouter.use(
          await router$1.createRouter({
            /**
             * Logger for logging purposes
             */
            logger,
            /**
             * Info provider to be able to get all necessary information for the APIs
             */
            sonarqubeInfoProvider: sonarqubeInfoProvider$1.DefaultSonarqubeInfoProvider.fromConfig(config)
          })
        );
      }
    });
  }
});

plugin_cjs.sonarqubePlugin = sonarqubePlugin;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var router = router_cjs;
var sonarqubeInfoProvider = sonarqubeInfoProvider_cjs;
var plugin = plugin_cjs;



index_cjs.createRouter = router.createRouter;
index_cjs.DefaultSonarqubeInfoProvider = sonarqubeInfoProvider.DefaultSonarqubeInfoProvider;
index_cjs.SonarqubeConfig = sonarqubeInfoProvider.SonarqubeConfig;
var _default = index_cjs.default = plugin.sonarqubePlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
