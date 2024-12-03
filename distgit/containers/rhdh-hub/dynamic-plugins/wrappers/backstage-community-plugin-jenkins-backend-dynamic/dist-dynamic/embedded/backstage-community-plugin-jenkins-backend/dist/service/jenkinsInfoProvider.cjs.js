'use strict';

var backendCommon = require('@backstage/backend-common');
var catalogModel = require('@backstage/catalog-model');

class JenkinsConfig {
  constructor(instances) {
    this.instances = instances;
  }
  /**
   * Read all Jenkins instance configurations.
   * @param config - Root configuration
   * @returns A JenkinsConfig that contains all configured Jenkins instances.
   */
  static fromConfig(config) {
    const DEFAULT_JENKINS_NAME = "default";
    const jenkinsConfig = config.getConfig("jenkins");
    const namedInstanceConfig = jenkinsConfig.getOptionalConfigArray("instances")?.map((c) => ({
      name: c.getString("name"),
      baseUrl: c.getString("baseUrl"),
      username: c.getString("username"),
      projectCountLimit: c.getOptionalNumber("projectCountLimit"),
      apiKey: c.getString("apiKey"),
      extraRequestHeaders: c.getOptional("extraRequestHeaders"),
      crumbIssuer: c.getOptionalBoolean("crumbIssuer"),
      allowedBaseUrlOverrideRegex: c.getOptionalString(
        "allowedBaseUrlOverrideRegex"
      )
    })) || [];
    const hasNamedDefault = namedInstanceConfig.some(
      (x) => x.name === DEFAULT_JENKINS_NAME
    );
    const baseUrl = jenkinsConfig.getOptionalString("baseUrl");
    const username = jenkinsConfig.getOptionalString("username");
    const apiKey = jenkinsConfig.getOptionalString("apiKey");
    const crumbIssuer = jenkinsConfig.getOptionalBoolean("crumbIssuer");
    const extraRequestHeaders = jenkinsConfig.getOptional("extraRequestHeaders");
    const allowedBaseUrlOverrideRegex = jenkinsConfig.getOptionalString(
      "allowedBaseUrlOverrideRegex"
    );
    if (hasNamedDefault && (baseUrl || username || apiKey)) {
      throw new Error(
        `Found both a named jenkins instance with name ${DEFAULT_JENKINS_NAME} and top level baseUrl, username or apiKey config. Use only one style of config.`
      );
    }
    const unnamedNonePresent = !baseUrl && !username && !apiKey;
    const unnamedAllPresent = baseUrl && username && apiKey;
    if (!(unnamedAllPresent || unnamedNonePresent)) {
      throw new Error(
        `Found partial default jenkins config. All (or none) of baseUrl, username and apiKey must be provided.`
      );
    }
    if (unnamedAllPresent) {
      return new JenkinsConfig([
        ...namedInstanceConfig,
        {
          name: DEFAULT_JENKINS_NAME,
          baseUrl,
          username,
          apiKey,
          extraRequestHeaders,
          crumbIssuer,
          allowedBaseUrlOverrideRegex
        }
      ]);
    }
    return new JenkinsConfig(namedInstanceConfig);
  }
  /**
   * Gets a Jenkins instance configuration by name, or the default one if no
   * name is provided.
   * @param jenkinsName - Optional name of the Jenkins instance.
   * @returns The requested Jenkins instance.
   */
  getInstanceConfig(jenkinsName) {
    const DEFAULT_JENKINS_NAME = "default";
    if (!jenkinsName || jenkinsName === DEFAULT_JENKINS_NAME) {
      const instanceConfig2 = this.instances.find(
        (c) => c.name === DEFAULT_JENKINS_NAME
      );
      if (!instanceConfig2) {
        throw new Error(
          `Couldn't find a default jenkins instance in the config. Either configure an instance with name ${DEFAULT_JENKINS_NAME} or add a prefix to your annotation value.`
        );
      }
      return instanceConfig2;
    }
    const instanceConfig = this.instances.find((c) => c.name === jenkinsName);
    if (!instanceConfig) {
      throw new Error(
        `Couldn't find a jenkins instance in the config with name ${jenkinsName}`
      );
    }
    return instanceConfig;
  }
}
class DefaultJenkinsInfoProvider {
  constructor(config, catalog, auth, logger) {
    this.config = config;
    this.catalog = catalog;
    this.auth = auth;
    this.logger = logger;
  }
  static OLD_JENKINS_ANNOTATION = "jenkins.io/github-folder";
  static NEW_JENKINS_ANNOTATION = "jenkins.io/job-full-name";
  static JENKINS_OVERRIDE_URL = "jenkins.io/override-base-url";
  static fromConfig(options) {
    const { auth } = backendCommon.createLegacyAuthAdapters(options);
    return new DefaultJenkinsInfoProvider(
      JenkinsConfig.fromConfig(options.config),
      options.catalog,
      auth,
      options.logger
    );
  }
  async getInstance(opt) {
    const DEFAULT_LIMITATION_OF_PROJECTS = 50;
    const entity = await this.catalog.getEntityByRef(
      opt.entityRef,
      opt.credentials && await this.auth.getPluginRequestToken({
        onBehalfOf: opt.credentials,
        targetPluginId: "catalog"
      })
    );
    if (!entity) {
      throw new Error(
        `Couldn't find entity with name: ${catalogModel.stringifyEntityRef(opt.entityRef)}`
      );
    }
    const jenkinsAndJobName = DefaultJenkinsInfoProvider.getEntityAnnotationValue(entity);
    if (!jenkinsAndJobName) {
      throw new Error(
        `Couldn't find jenkins annotation (${DefaultJenkinsInfoProvider.NEW_JENKINS_ANNOTATION}) on entity with name: ${catalogModel.stringifyEntityRef(opt.entityRef)}`
      );
    }
    let jobFullName;
    let jenkinsName;
    const splitIndex = jenkinsAndJobName.indexOf(":");
    if (splitIndex === -1) {
      jobFullName = jenkinsAndJobName;
    } else {
      jenkinsName = jenkinsAndJobName.substring(0, splitIndex);
      jobFullName = jenkinsAndJobName.substring(
        splitIndex + 1,
        jenkinsAndJobName.length
      );
    }
    const instanceConfig = this.config.getInstanceConfig(jenkinsName);
    const overrideUrlValue = DefaultJenkinsInfoProvider.getEntityOverrideURL(entity);
    if (instanceConfig.allowedBaseUrlOverrideRegex && overrideUrlValue && DefaultJenkinsInfoProvider.verifyUrlMatchesRegex(
      overrideUrlValue,
      instanceConfig.allowedBaseUrlOverrideRegex,
      this.logger
    )) {
      instanceConfig.baseUrl = overrideUrlValue;
    }
    const creds = Buffer.from(
      `${instanceConfig.username}:${instanceConfig.apiKey}`,
      "binary"
    ).toString("base64");
    return {
      baseUrl: instanceConfig.baseUrl,
      headers: {
        Authorization: `Basic ${creds}`,
        ...instanceConfig.extraRequestHeaders
      },
      jobFullName,
      projectCountLimit: instanceConfig.projectCountLimit ?? DEFAULT_LIMITATION_OF_PROJECTS,
      crumbIssuer: instanceConfig.crumbIssuer
    };
  }
  static getEntityAnnotationValue(entity) {
    return entity.metadata.annotations?.[DefaultJenkinsInfoProvider.OLD_JENKINS_ANNOTATION] || entity.metadata.annotations?.[DefaultJenkinsInfoProvider.NEW_JENKINS_ANNOTATION];
  }
  static getEntityOverrideURL(entity) {
    return entity.metadata.annotations?.[DefaultJenkinsInfoProvider.JENKINS_OVERRIDE_URL];
  }
  static verifyUrlMatchesRegex(url, regexString, logger) {
    try {
      const regex = new RegExp(regexString);
      if (regex.test(url)) {
        return true;
      }
    } catch (e) {
      logger.warn(`Invalid regex: "${regexString}" - Error: ${e.message}`);
    }
    return false;
  }
}

exports.DefaultJenkinsInfoProvider = DefaultJenkinsInfoProvider;
exports.JenkinsConfig = JenkinsConfig;
//# sourceMappingURL=jenkinsInfoProvider.cjs.js.map
