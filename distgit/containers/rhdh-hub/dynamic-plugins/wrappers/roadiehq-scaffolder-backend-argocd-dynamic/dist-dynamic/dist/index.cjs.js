'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var require$$0$1 = require('@backstage/plugin-scaffolder-backend');
var require$$0 = require('@backstage/backend-common');
var require$$1 = require('express');
var require$$2 = require('express-promise-router');
var require$$3 = require('cross-fetch');

var index_cjs = {};

var backendCommon = require$$0;
var express = require$$1;
var Router = require$$2;
var fetch = require$$3;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

function timer(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getArgoConfigByInstanceName = ({
  argoConfigs,
  argoInstanceName
}) => {
  const matchedArgoConfig = argoConfigs.find(
    (configs) => configs.name === argoInstanceName
  );
  return matchedArgoConfig;
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const APP_NAMESPACE_QUERY_PARAM = "appNamespace";
class ArgoService {
  constructor(username, password, config, logger) {
    this.username = username;
    this.password = password;
    this.config = config;
    this.logger = logger;
    __publicField(this, "instanceConfigs");
    this.instanceConfigs = this.config.getConfigArray("argocd.appLocatorMethods").filter((element) => element.getString("type") === "config").reduce(
      (acc, argoApp) => acc.concat(argoApp.getConfigArray("instances")),
      []
    ).map((instance) => ({
      name: instance.getString("name"),
      url: instance.getString("url"),
      token: instance.getOptionalString("token"),
      username: instance.getOptionalString("username"),
      password: instance.getOptionalString("password")
    }));
  }
  getArgoInstanceArray() {
    return this.getAppArray().map((instance) => ({
      name: instance.getString("name"),
      url: instance.getString("url"),
      token: instance.getOptionalString("token"),
      username: instance.getOptionalString("username"),
      password: instance.getOptionalString("password")
    }));
  }
  getAppArray() {
    const argoApps = this.config.getConfigArray("argocd.appLocatorMethods").filter((element) => element.getString("type") === "config");
    return argoApps.reduce(
      (acc, argoApp) => acc.concat(argoApp.getConfigArray("instances")),
      []
    );
  }
  async getRevisionData(baseUrl, options, argoToken, revisionID) {
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      }
    };
    let url = `${baseUrl}/api/v1/applications/${options.name}/revisions/${revisionID}/metadata`;
    if (options.namespace) {
      url = `${url}?${APP_NAMESPACE_QUERY_PARAM}=${options.namespace}`;
    }
    const resp = await fetch__default.default(url, requestOptions);
    if (!resp.ok) {
      throw new Error(`Request failed with ${resp.status} Error`);
    }
    const data = await (resp == null ? void 0 : resp.json());
    return data;
  }
  async findArgoApp(options) {
    if (!options.name && !options.selector) {
      throw new Error("name or selector is required");
    }
    const resp = await Promise.all(
      this.instanceConfigs.map(async (argoInstance) => {
        let getArgoAppDataResp;
        let token;
        try {
          token = argoInstance.token || await this.getArgoToken(argoInstance);
        } catch (error) {
          this.logger.error(
            `Error getting token from Argo Instance ${argoInstance.name}: ${error.message}`
          );
          return null;
        }
        try {
          getArgoAppDataResp = await this.getArgoAppData(
            argoInstance.url,
            argoInstance.name,
            token,
            options
          );
        } catch (error) {
          this.logger.error(
            `Error getting Argo App Data from Argo Instance ${argoInstance.name}: ${error.message}`
          );
          return null;
        }
        if (options.selector && !getArgoAppDataResp.items) {
          return null;
        }
        return {
          name: argoInstance.name,
          url: argoInstance.url,
          appName: options.selector ? getArgoAppDataResp.items.map((x) => x.metadata.name) : [options.name]
        };
      })
    ).catch();
    return resp.flatMap((f) => f ? [f] : []);
  }
  async getArgoProject({
    baseUrl,
    argoToken,
    projectName
  }) {
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      }
    };
    const resp = await fetch__default.default(
      `${baseUrl}/api/v1/projects/${projectName}`,
      requestOptions
    );
    const data = await resp.json();
    if (resp.status !== 200) {
      this.logger.error(
        `Failed to get argo project ${projectName}: ${data.message}`
      );
      throw new Error(`Failed to get argo project: ${data.message}`);
    }
    return data;
  }
  async getArgoToken(appConfig) {
    const { url, username, password } = appConfig;
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: username || this.username,
        password: password || this.password
      })
    };
    const resp = await fetch__default.default(`${url}/api/v1/session`, options);
    if (!resp.ok) {
      this.logger.error(`failed to get argo token: ${url}`);
    }
    if (resp.status === 401) {
      throw new Error(`Getting unauthorized for Argo CD instance ${url}`);
    }
    const data = await resp.json();
    return data.token;
  }
  async getArgoAppData(baseUrl, argoInstanceName, argoToken, options) {
    let urlSuffix = "";
    if (options == null ? void 0 : options.name) {
      urlSuffix = `/${options.name}`;
      if (options == null ? void 0 : options.namespace) {
        urlSuffix = `${urlSuffix}?${APP_NAMESPACE_QUERY_PARAM}=${options.namespace}`;
      }
    }
    if (options == null ? void 0 : options.selector) {
      urlSuffix = `?selector=${options.selector}`;
      if (options == null ? void 0 : options.namespace) {
        urlSuffix = `${urlSuffix}&${APP_NAMESPACE_QUERY_PARAM}=${options.namespace}`;
      }
    }
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      }
    };
    const resp = await fetch__default.default(
      `${baseUrl}/api/v1/applications${urlSuffix}`,
      requestOptions
    );
    if (!resp.ok) {
      throw new Error(`Request failed with ${resp.status} Error`);
    }
    const data = await (resp == null ? void 0 : resp.json());
    if (data.items) {
      data.items.forEach((item) => {
        item.metadata.instance = { name: argoInstanceName };
      });
    } else if (data && (options == null ? void 0 : options.name)) {
      data.instance = argoInstanceName;
    }
    return data;
  }
  buildArgoProjectPayload({
    projectName,
    namespace,
    destinationServer,
    resourceVersion,
    sourceRepo
  }) {
    const clusterResourceBlacklist = this.config.getOptional(
      `argocd.projectSettings.clusterResourceBlacklist`
    );
    const clusterResourceWhitelist = this.config.getOptional(
      `argocd.projectSettings.clusterResourceWhitelist`
    );
    const namespaceResourceBlacklist = this.config.getOptional(
      `argocd.projectSettings.namespaceResourceBlacklist`
    );
    const namespaceResourceWhitelist = this.config.getOptional(
      `argocd.projectSettings.namespaceResourceWhitelist`
    );
    const project = {
      metadata: {
        name: projectName,
        resourceVersion
      },
      spec: {
        destinations: [
          {
            name: "local",
            namespace,
            server: destinationServer != null ? destinationServer : "https://kubernetes.default.svc"
          }
        ],
        ...clusterResourceBlacklist && { clusterResourceBlacklist },
        ...clusterResourceWhitelist && { clusterResourceWhitelist },
        ...namespaceResourceBlacklist && { namespaceResourceBlacklist },
        ...namespaceResourceWhitelist && { namespaceResourceWhitelist },
        sourceRepos: Array.isArray(sourceRepo) ? sourceRepo : [sourceRepo]
      }
    };
    return project;
  }
  async createArgoProject({
    baseUrl,
    argoToken,
    projectName,
    namespace,
    sourceRepo,
    destinationServer
  }) {
    const data = {
      project: this.buildArgoProjectPayload({
        projectName,
        namespace,
        sourceRepo,
        destinationServer
      })
    };
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      },
      body: JSON.stringify(data)
    };
    const resp = await fetch__default.default(`${baseUrl}/api/v1/projects`, options);
    const responseData = await resp.json();
    if (resp.status === 403) {
      throw new Error(responseData.message);
    } else if (resp.status === 404) {
      return resp.json();
    } else if (JSON.stringify(responseData).includes(
      "existing project spec is different"
    )) {
      throw new Error("Duplicate project detected. Cannot overwrite existing.");
    }
    return responseData;
  }
  async updateArgoProject({
    baseUrl,
    argoToken,
    projectName,
    namespace,
    sourceRepo,
    resourceVersion,
    destinationServer
  }) {
    const data = {
      project: this.buildArgoProjectPayload({
        projectName,
        namespace,
        sourceRepo,
        resourceVersion,
        destinationServer
      })
    };
    const options = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      },
      body: JSON.stringify(data)
    };
    const resp = await fetch__default.default(
      `${baseUrl}/api/v1/projects/${projectName}`,
      options
    );
    const responseData = await resp.json();
    if (resp.status !== 200) {
      this.logger.error(
        `Error updating argo project ${projectName}: ${responseData.message}`
      );
      throw new Error(`Error updating argo project: ${responseData.message}`);
    }
    return responseData;
  }
  buildArgoApplicationPayload({
    appName,
    projectName,
    namespace,
    sourceRepo,
    sourcePath,
    labelValue,
    resourceVersion,
    destinationServer
  }) {
    return {
      metadata: {
        name: appName,
        labels: { "backstage-name": labelValue },
        finalizers: ["resources-finalizer.argocd.argoproj.io"],
        resourceVersion
      },
      spec: {
        destination: {
          namespace,
          server: destinationServer ? destinationServer : "https://kubernetes.default.svc"
        },
        project: projectName,
        revisionHistoryLimit: 10,
        source: {
          path: sourcePath,
          repoURL: sourceRepo
        },
        syncPolicy: {
          automated: {
            allowEmpty: true,
            prune: true,
            selfHeal: true
          },
          retry: {
            backoff: {
              duration: "5s",
              factor: 2,
              maxDuration: "5m"
            },
            limit: 10
          },
          syncOptions: ["CreateNamespace=false", "FailOnSharedResource=true"]
        }
      }
    };
  }
  async createArgoApplication({
    baseUrl,
    argoToken,
    appName,
    projectName,
    namespace,
    sourceRepo,
    sourcePath,
    labelValue,
    destinationServer
  }) {
    const data = this.buildArgoApplicationPayload({
      appName,
      projectName,
      namespace,
      sourcePath,
      sourceRepo,
      labelValue,
      destinationServer
    });
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      },
      body: JSON.stringify(data)
    };
    const resp = await fetch__default.default(`${baseUrl}/api/v1/applications`, options);
    const respData = await resp.json();
    if (!resp.ok) {
      throw new Error(`Error creating argo app: ${respData.message}`);
    }
    return respData;
  }
  async resyncAppOnAllArgos({
    appSelector
  }) {
    const argoAppResp = await this.findArgoApp({
      selector: appSelector
    });
    if (argoAppResp) {
      const parallelSyncCalls = argoAppResp.map(
        async (argoInstance) => {
          try {
            const token = await this.getArgoToken(argoInstance);
            try {
              const resp = argoInstance.appName.map(
                (argoApp) => {
                  return this.syncArgoApp({
                    argoInstance,
                    argoToken: token,
                    appName: argoApp
                  });
                }
              );
              return await Promise.all(resp);
            } catch (e) {
              return [{ status: "Failure", message: e.message }];
            }
          } catch (e) {
            return [{ status: "Failure", message: e.message }];
          }
        }
      );
      return await Promise.all(parallelSyncCalls);
    }
    return [];
  }
  async syncArgoApp({
    argoInstance,
    argoToken,
    appName
  }) {
    const data = {
      prune: false,
      dryRun: false,
      strategy: {
        hook: {
          force: true
        }
      },
      resources: null
    };
    const options = {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${argoToken}`
      }
    };
    const resp = await fetch__default.default(
      `${argoInstance.url}/api/v1/applications/${appName}/sync`,
      options
    );
    if (resp.ok) {
      return {
        status: "Success",
        message: `Re-synced ${appName} on ${argoInstance.name}`
      };
    }
    return {
      message: `Failed to resync ${appName} on ${argoInstance.name}`,
      status: "Failure"
    };
  }
  async updateArgoApp({
    baseUrl,
    argoToken,
    appName,
    projectName,
    namespace,
    sourceRepo,
    sourcePath,
    labelValue,
    resourceVersion,
    destinationServer
  }) {
    const data = this.buildArgoApplicationPayload({
      appName,
      projectName,
      namespace,
      sourceRepo,
      sourcePath,
      labelValue,
      resourceVersion,
      destinationServer
    });
    const options = {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${argoToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
    const resp = await fetch__default.default(
      `${baseUrl}/api/v1/applications/${appName}`,
      options
    );
    const respData = await resp.json();
    if (resp.status !== 200) {
      this.logger.error(
        `Error updating argo app ${appName}: ${respData.message}`
      );
      throw new Error(`Error updating argo app: ${respData.message}`);
    }
    return respData;
  }
  // @see https://cd.apps.argoproj.io/swagger-ui#operation/ApplicationService_Delete
  async deleteApp({
    baseUrl,
    argoApplicationName,
    argoToken
  }) {
    const options = {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${argoToken}`,
        "Content-Type": "application/json"
      }
    };
    let statusText = "";
    try {
      const response = await fetch__default.default(
        `${baseUrl}/api/v1/applications/${argoApplicationName}?${new URLSearchParams(
          {
            cascade: "true"
          }
        )}`,
        options
      );
      statusText = response.statusText;
      if (response.status === 200) {
        return { ...await response.json(), statusCode: response.status };
      }
      return { ...await response.json(), statusCode: response.status };
    } catch (error) {
      this.logger.error(
        `Error Deleting Argo Application for application ${argoApplicationName} in ${baseUrl} - ${JSON.stringify(
          { statusText, error: error.message }
        )}`
      );
      throw error;
    }
  }
  // @see https://cd.apps.argoproj.io/swagger-ui#operation/ProjectService_Delete
  async deleteProject({
    baseUrl,
    argoProjectName,
    argoToken
  }) {
    const options = {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${argoToken}`,
        "Content-Type": "application/json"
      }
    };
    let statusText = "";
    try {
      const response = await fetch__default.default(
        `${baseUrl}/api/v1/projects/${argoProjectName}`,
        options
      );
      statusText = response.statusText;
      if (response.status === 200) {
        return { ...await response.json(), statusCode: response.status };
      }
      return { ...await response.json(), statusCode: response.status };
    } catch (error) {
      this.logger.error(
        `Error Deleting Argo Project for project  ${argoProjectName} in ${baseUrl} - ${JSON.stringify(
          { statusText, error: error.message }
        )}`
      );
      throw error;
    }
  }
  async deleteAppandProject({
    argoAppName,
    argoInstanceName,
    terminateOperation
  }) {
    let continueToDeleteProject = false;
    let deleteAppDetails;
    let deleteProjectDetails;
    let terminateOperationDetails;
    const matchedArgoInstance = this.instanceConfigs.find(
      (argoInstance) => argoInstance.name === argoInstanceName
    );
    if (matchedArgoInstance === void 0) {
      throw new Error("cannot find an argo instance to match this cluster");
    }
    let token;
    if (!matchedArgoInstance.token) {
      token = await this.getArgoToken(matchedArgoInstance);
    } else {
      token = matchedArgoInstance.token;
    }
    if (terminateOperation) {
      const terminateOperationResp = await this.terminateArgoAppOperation({
        baseUrl: matchedArgoInstance.url,
        argoAppName,
        argoToken: token
      });
      if (terminateOperationResp.statusCode !== 404 && "message" in terminateOperationResp) {
        terminateOperationDetails = {
          status: "failed",
          argoResponse: terminateOperationResp,
          message: `failed to terminate ${argoAppName}'s operation for application`
        };
      } else if (terminateOperationResp.statusCode === 404) {
        terminateOperationDetails = {
          status: "failed",
          argoResponse: terminateOperationResp,
          message: `application ${argoAppName} not found`
        };
      } else if (terminateOperationResp.statusCode === 200) {
        terminateOperationDetails = {
          status: "success",
          argoResponse: terminateOperationResp,
          message: `${argoAppName}'s current operation terminated`
        };
      }
    }
    const deleteAppResp = await this.deleteApp({
      baseUrl: matchedArgoInstance.url,
      argoApplicationName: argoAppName,
      argoToken: token
    });
    if (deleteAppResp.statusCode !== 404 && "message" in deleteAppResp) {
      deleteAppDetails = {
        status: "failed",
        message: `failed to delete application ${argoAppName}`,
        argoResponse: deleteAppResp
      };
    } else if (deleteAppResp.statusCode === 404) {
      continueToDeleteProject = true;
      deleteAppDetails = {
        status: "success",
        message: `application ${argoAppName} does not exist and therefore does not need to be deleted`,
        argoResponse: deleteAppResp
      };
    } else if (deleteAppResp.statusCode === 200) {
      deleteAppDetails = {
        status: "pending",
        message: `application ${argoAppName} pending deletion`,
        argoResponse: deleteAppResp
      };
      const configuredWaitCycles = this.config.getOptionalNumber("argocd.waitCycles") || 1;
      const configuredWaitInterval = this.config.getOptionalNumber("argocd.waitInterval") || 5e3;
      for (let attempts = 0; attempts < configuredWaitCycles; attempts++) {
        const applicationInfo = await this.getArgoApplicationInfo({
          baseUrl: matchedArgoInstance.url,
          argoApplicationName: argoAppName,
          argoToken: token
        });
        deleteAppDetails.argoResponse = applicationInfo;
        if (applicationInfo.statusCode !== 404 && "message" in applicationInfo) {
          deleteAppDetails.status = "failed";
          deleteAppDetails.message = `a request was successfully sent to delete application ${argoAppName}, but when getting your application information we received an error`;
          break;
        } else if (applicationInfo.statusCode === 404) {
          continueToDeleteProject = true;
          deleteAppDetails.status = "success";
          deleteAppDetails.message = `application ${argoAppName} deletion verified (application no longer exists)`;
          break;
        } else if (applicationInfo.statusCode === 200 && "metadata" in applicationInfo) {
          deleteAppDetails.status = "pending";
          deleteAppDetails.message = `application ${argoAppName} still pending deletion with the deletion timestamp of ${applicationInfo.metadata.deletionTimestamp}`;
          if (attempts < configuredWaitCycles - 1)
            await timer(configuredWaitInterval);
        }
      }
    }
    if (continueToDeleteProject) {
      const deleteProjectResponse = await this.deleteProject({
        baseUrl: matchedArgoInstance.url,
        argoProjectName: argoAppName,
        argoToken: token
      });
      if (deleteProjectResponse.statusCode !== 404 && "message" in deleteProjectResponse) {
        deleteProjectDetails = {
          status: "failed",
          message: `failed to delete project ${argoAppName}.`,
          argoResponse: deleteProjectResponse
        };
      } else if (deleteProjectResponse.statusCode === 404) {
        deleteProjectDetails = {
          status: "success",
          message: `project ${argoAppName} does not exist and therefore does not need to be deleted.`,
          argoResponse: deleteProjectResponse
        };
      } else if (deleteProjectResponse.statusCode === 200) {
        deleteProjectDetails = {
          status: "pending",
          message: `project ${argoAppName} is pending deletion.`,
          argoResponse: deleteProjectResponse
        };
      }
    } else {
      deleteProjectDetails = {
        status: "failed",
        message: `project ${argoAppName} deletion skipped due to application still existing and pending deletion, or the application failed to delete.`,
        argoResponse: {}
      };
    }
    return {
      ...terminateOperationDetails ? { terminateOperationDetails } : {},
      deleteAppDetails,
      deleteProjectDetails
    };
  }
  async createArgoResources({
    argoInstance,
    appName,
    projectName,
    namespace,
    sourceRepo,
    sourcePath,
    labelValue,
    logger
  }) {
    logger.info(`Getting app ${appName} on ${argoInstance}`);
    const matchedArgoInstance = this.instanceConfigs.find(
      (argoHost) => argoHost.name === argoInstance
    );
    if (!matchedArgoInstance) {
      throw new Error(`Unable to find Argo instance named '${argoInstance}'`);
    }
    const token = matchedArgoInstance.token || await this.getArgoToken(matchedArgoInstance);
    await this.createArgoProject({
      baseUrl: matchedArgoInstance.url,
      argoToken: token,
      projectName: projectName ? projectName : appName,
      namespace,
      sourceRepo
    });
    await this.createArgoApplication({
      baseUrl: matchedArgoInstance.url,
      argoToken: token,
      appName,
      projectName: projectName ? projectName : appName,
      namespace,
      sourceRepo,
      sourcePath,
      labelValue: labelValue ? labelValue : appName
    });
    return true;
  }
  async updateArgoProjectAndApp({
    instanceConfig,
    argoToken,
    appName,
    projectName,
    namespace,
    sourceRepo,
    sourcePath,
    labelValue,
    destinationServer
  }) {
    var _a, _b, _c, _d, _e, _f;
    const appData = await this.getArgoAppData(
      instanceConfig.url,
      instanceConfig.name,
      argoToken,
      { name: appName }
    );
    if (!((_b = (_a = appData.spec) == null ? void 0 : _a.source) == null ? void 0 : _b.repoURL)) {
      this.logger.error(`No repo URL found for argo app ${projectName}`);
      throw new Error("No repo URL found for argo app");
    }
    if (!((_c = appData.metadata) == null ? void 0 : _c.resourceVersion)) {
      this.logger.error(`No resourceVersion found for argo app ${projectName}`);
      throw new Error("No resourceVersion found for argo app");
    }
    const projData = await this.getArgoProject({
      baseUrl: instanceConfig.url,
      argoToken,
      projectName
    });
    if (!((_d = projData.metadata) == null ? void 0 : _d.resourceVersion)) {
      this.logger.error(
        `No resourceVersion found for argo project ${projectName}`
      );
      throw new Error("No resourceVersion found for argo project");
    }
    if (((_f = (_e = appData.spec) == null ? void 0 : _e.source) == null ? void 0 : _f.repoURL) === sourceRepo) {
      await this.updateArgoProject({
        argoToken,
        baseUrl: instanceConfig.url,
        namespace,
        projectName,
        sourceRepo,
        resourceVersion: projData.metadata.resourceVersion,
        destinationServer
      });
      await this.updateArgoApp({
        appName,
        argoToken,
        baseUrl: instanceConfig.url,
        labelValue,
        namespace,
        projectName,
        sourcePath,
        sourceRepo,
        resourceVersion: appData.metadata.resourceVersion,
        destinationServer
      });
      return true;
    }
    await this.updateArgoProject({
      argoToken,
      baseUrl: instanceConfig.url,
      namespace,
      projectName,
      sourceRepo: [sourceRepo, appData.spec.source.repoURL],
      resourceVersion: projData.metadata.resourceVersion,
      destinationServer
    });
    await this.updateArgoApp({
      appName,
      argoToken,
      baseUrl: instanceConfig.url,
      labelValue,
      namespace,
      projectName,
      sourcePath,
      sourceRepo,
      resourceVersion: appData.metadata.resourceVersion,
      destinationServer
    });
    const updatedProjData = await this.getArgoProject({
      baseUrl: instanceConfig.url,
      argoToken,
      projectName
    });
    await this.updateArgoProject({
      argoToken,
      baseUrl: instanceConfig.url,
      namespace,
      projectName,
      sourceRepo,
      resourceVersion: updatedProjData.metadata.resourceVersion,
      destinationServer
    });
    return true;
  }
  // @see https://cd.apps.argoproj.io/swagger-ui#operation/ApplicationService_List
  async getArgoApplicationInfo(props) {
    var _a;
    const argoApplicationName = props.argoApplicationName;
    let url = "baseUrl" in props ? props.baseUrl : void 0;
    let token = "argoToken" in props ? props.argoToken : void 0;
    const argoInstanceName = "argoInstanceName" in props ? props.argoInstanceName : void 0;
    if (!(url && token)) {
      if (!argoInstanceName)
        throw new Error(
          `argo instance must be defined when baseurl or token are not given.`
        );
      const matchedArgoInstance = getArgoConfigByInstanceName({
        argoConfigs: this.instanceConfigs,
        argoInstanceName
      });
      if (!matchedArgoInstance)
        throw new Error(
          `config does not have argo information for the cluster named '${argoInstanceName}'`
        );
      token = (_a = matchedArgoInstance.token) != null ? _a : await this.getArgoToken(matchedArgoInstance);
      url = matchedArgoInstance.url;
    }
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      method: "GET"
    };
    let statusText = "";
    try {
      const response = await fetch__default.default(
        `${url}/api/v1/applications/${argoApplicationName}`,
        options
      );
      statusText = response.statusText;
      if (response.status === 200) {
        return { ...await response.json(), statusCode: response.status };
      }
      return { ...await response.json(), statusCode: response.status };
    } catch (error) {
      this.logger.error(
        `Error Getting Argo Application Information For Argo Instance Name ${argoInstanceName != null ? argoInstanceName : url} - searching for application ${argoApplicationName} - ${JSON.stringify(
          { statusText, error: error.message }
        )}`
      );
      throw error;
    }
  }
  // @see https://cd.apps.argoproj.io/swagger-ui#operation/ApplicationService_TerminateOperation
  async terminateArgoAppOperation(props) {
    var _a;
    const argoApplicationName = props.argoAppName;
    let url = "baseUrl" in props ? props.baseUrl : void 0;
    let token = "argoToken" in props ? props.argoToken : void 0;
    const argoInstanceName = "argoInstanceName" in props ? props.argoInstanceName : void 0;
    if (!(url && token)) {
      if (!argoInstanceName)
        throw new Error(
          `argo instance must be defined when baseurl or token are not given.`
        );
      const matchedArgoInstance = getArgoConfigByInstanceName({
        argoConfigs: this.instanceConfigs,
        argoInstanceName
      });
      if (!matchedArgoInstance)
        throw new Error(
          `config does not have argo information for the cluster named '${argoInstanceName}'`
        );
      token = (_a = matchedArgoInstance.token) != null ? _a : await this.getArgoToken(matchedArgoInstance);
      url = matchedArgoInstance.url;
    }
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      method: "DELETE"
    };
    this.logger.info(
      `Terminating current operation for ${argoInstanceName != null ? argoInstanceName : url} and ${argoApplicationName}`
    );
    let statusText = "";
    try {
      const response = await fetch__default.default(
        `${url}/api/v1/applications/${argoApplicationName}/operation`,
        options
      );
      statusText = response.statusText;
      if (response.status === 200) {
        return { ...await response.json(), statusCode: response.status };
      }
      return { ...await response.json(), statusCode: response.status };
    } catch (error) {
      this.logger.error(
        `Error Terminating Argo Application Operation for application ${argoApplicationName} in Argo Instance Name ${argoInstanceName != null ? argoInstanceName : url} - ${JSON.stringify({ statusText, error: error.message })}`
      );
      throw error;
    }
  }
}

function createRouter({
  logger,
  config
}) {
  var _a, _b;
  const router = Router__default.default();
  router.use(express__default.default.json());
  const argoUserName = (_a = config.getOptionalString("argocd.username")) != null ? _a : "argocdUsername";
  const argoPassword = (_b = config.getOptionalString("argocd.password")) != null ? _b : "argocdPassword";
  const argoSvc = new ArgoService(argoUserName, argoPassword, config, logger);
  router.get("/allArgoApps/:argoInstanceName", async (request, response) => {
    var _a2;
    const argoInstanceName = request.params.argoInstanceName;
    const matchedArgoInstance = getArgoConfigByInstanceName({
      argoInstanceName,
      argoConfigs: argoSvc.getArgoInstanceArray()
    });
    if (matchedArgoInstance === void 0) {
      return response.status(500).send({
        status: "failed",
        message: "cannot find an argo instance to match this cluster"
      });
    }
    const token = (_a2 = matchedArgoInstance.token) != null ? _a2 : await argoSvc.getArgoToken(matchedArgoInstance);
    if (!token) {
      return response.status(500).send({
        status: "failed",
        message: "could not generate token"
      });
    }
    return response.send(
      await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token
      )
    );
  });
  router.get(
    "/argoInstance/:argoInstance/repo/:repo/source/:source",
    async (request, response) => {
      var _a2;
      const argoInstanceName = request.params.argoInstance;
      const matchedArgoInstance = getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = (_a2 = matchedArgoInstance.token) != null ? _a2 : await argoSvc.getArgoToken(matchedArgoInstance);
      if (!token) {
        return response.status(500).send({
          status: "failed",
          message: "could not generate token"
        });
      }
      const argoData = await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token
      );
      const repoAndSource = argoData.items.map(
        (argoApp) => {
          var _a3, _b2, _c, _d;
          return `${(_b2 = (_a3 = argoApp == null ? void 0 : argoApp.spec) == null ? void 0 : _a3.source) == null ? void 0 : _b2.repoURL}/${(_d = (_c = argoApp == null ? void 0 : argoApp.spec) == null ? void 0 : _c.source) == null ? void 0 : _d.path}`;
        }
      );
      return response.send(
        repoAndSource.includes(
          `${request.params.repo}/${decodeURIComponent(request.params.source)}`
        )
      );
    }
  );
  router.get("/find/name/:argoAppName", async (request, response) => {
    var _a2;
    const argoAppName = request.params.argoAppName;
    const argoAppNamespace = (_a2 = request.query) == null ? void 0 : _a2.appNamespace;
    response.send(
      await argoSvc.findArgoApp({
        name: argoAppName,
        namespace: argoAppNamespace
      })
    );
  });
  router.get(
    "/argoInstance/:argoInstanceName/applications/name/:argoAppName/revisions/:revisionID/metadata",
    async (request, response) => {
      var _a2, _b2;
      const revisionID = request.params.revisionID;
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const argoAppNamespace = (_a2 = request.query) == null ? void 0 : _a2.appNamespace;
      logger.info(`Getting info on ${argoAppName}`);
      logger.info(`Getting app ${argoAppName} on ${argoInstanceName}`);
      const matchedArgoInstance = getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = (_b2 = matchedArgoInstance.token) != null ? _b2 : await argoSvc.getArgoToken(matchedArgoInstance);
      const resp = await argoSvc.getRevisionData(
        matchedArgoInstance.url,
        {
          name: argoAppName,
          namespace: argoAppNamespace
        },
        token,
        revisionID
      );
      return response.send(resp);
    }
  );
  router.get(
    "/argoInstance/:argoInstanceName/applications/name/:argoAppName",
    async (request, response) => {
      var _a2, _b2;
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const argoAppNamespace = (_a2 = request.query) == null ? void 0 : _a2.appNamespace;
      logger.info(`Getting info on ${argoAppName}`);
      logger.info(`Getting app ${argoAppName} on ${argoInstanceName}`);
      const matchedArgoInstance = getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = (_b2 = matchedArgoInstance.token) != null ? _b2 : await argoSvc.getArgoToken(matchedArgoInstance);
      const resp = await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token,
        { name: argoAppName, namespace: argoAppNamespace }
      );
      return response.send(resp);
    }
  );
  router.get("/find/selector/:argoAppSelector", async (request, response) => {
    var _a2;
    const argoAppSelector = request.params.argoAppSelector;
    const argoAppNamespace = (_a2 = request.query) == null ? void 0 : _a2.appNamespace;
    logger.info(`Getting apps for selector ${argoAppSelector}`);
    response.send(
      await argoSvc.findArgoApp({
        selector: argoAppSelector,
        namespace: argoAppNamespace
      })
    );
  });
  router.get(
    "/argoInstance/:argoInstanceName/applications/selector/:argoAppSelector",
    async (request, response) => {
      var _a2, _b2;
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppSelector = request.params.argoAppSelector;
      const argoAppNamespace = (_a2 = request.query) == null ? void 0 : _a2.appNamespace;
      logger.info(
        `Getting apps for selector ${argoAppSelector} on ${argoInstanceName}`
      );
      const matchedArgoInstance = getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = (_b2 = matchedArgoInstance.token) != null ? _b2 : await argoSvc.getArgoToken(matchedArgoInstance);
      const resp = await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token,
        {
          selector: argoAppSelector,
          namespace: argoAppNamespace
        }
      );
      return response.send(resp);
    }
  );
  router.post("/createArgo", async (request, response) => {
    const argoInstanceName = request.body.clusterName;
    const namespace = request.body.namespace;
    const projectName = request.body.projectName;
    const appName = request.body.appName;
    const labelValue = request.body.labelValue;
    const sourceRepo = request.body.sourceRepo;
    const sourcePath = request.body.sourcePath;
    const matchedArgoInstance = getArgoConfigByInstanceName({
      argoInstanceName,
      argoConfigs: argoSvc.getArgoInstanceArray()
    });
    if (matchedArgoInstance === void 0) {
      return response.status(500).send({
        status: "failed",
        message: "cannot find an argo instance to match this cluster"
      });
    }
    let token;
    if (!matchedArgoInstance.token) {
      try {
        token = await argoSvc.getArgoToken(matchedArgoInstance);
      } catch (e) {
        return response.status(e.status || 500).send({
          status: e.status,
          message: e.message
        });
      }
    } else {
      token = matchedArgoInstance.token;
    }
    try {
      await argoSvc.createArgoProject({
        baseUrl: matchedArgoInstance.url,
        argoToken: token,
        projectName,
        namespace,
        sourceRepo
      });
    } catch (e) {
      logger.error(e);
      return response.status(e.status || 500).send({
        status: e.status,
        message: e.message || "Failed to create argo project"
      });
    }
    try {
      await argoSvc.createArgoApplication({
        baseUrl: matchedArgoInstance.url,
        argoToken: token,
        projectName,
        appName,
        namespace,
        sourceRepo,
        sourcePath,
        labelValue
      });
      return response.send({
        argoProjectName: projectName,
        argoAppName: appName,
        kubernetesNamespace: namespace
      });
    } catch (e) {
      return response.status(500).send({
        status: 500,
        message: e.message || "Failed to create argo app"
      });
    }
  });
  router.put("/updateArgo/:argoAppName", async (request, response) => {
    const argoInstanceName = request.body.clusterName;
    const namespace = request.body.namespace;
    const projectName = request.body.projectName;
    const appName = request.body.appName;
    const labelValue = request.body.labelValue;
    const sourceRepo = request.body.sourceRepo;
    const sourcePath = request.body.sourcePath;
    const matchedArgoInstance = getArgoConfigByInstanceName({
      argoInstanceName,
      argoConfigs: argoSvc.getArgoInstanceArray()
    });
    if (matchedArgoInstance === void 0) {
      return response.status(500).send({
        status: "failed",
        message: "cannot find an argo instance to match this cluster"
      });
    }
    let token;
    if (!matchedArgoInstance.token) {
      try {
        token = await argoSvc.getArgoToken(matchedArgoInstance);
      } catch (e) {
        return response.status(e.status || 500).send({
          status: e.status,
          message: e.message
        });
      }
    } else {
      token = matchedArgoInstance.token;
    }
    try {
      await argoSvc.updateArgoProjectAndApp({
        instanceConfig: matchedArgoInstance,
        argoToken: token,
        projectName,
        appName,
        namespace,
        sourceRepo,
        sourcePath,
        labelValue
      });
      return response.send({
        argoProjectName: projectName,
        argoAppName: appName,
        kubernetesNamespace: namespace
      });
    } catch (e) {
      logger.error(e);
      return response.status(e.status || 500).send({
        status: e.status,
        message: e.message || "Failed to create argo project"
      });
    }
  });
  router.post("/sync", async (request, response) => {
    const appSelector = request.body.appSelector;
    try {
      const argoSyncResp = await argoSvc.resyncAppOnAllArgos({ appSelector });
      return response.send(argoSyncResp);
    } catch (e) {
      return response.status(e.status || 500).send({
        status: e.status || 500,
        message: e.message || `Failed to sync your app, ${appSelector}.`
      });
    }
  });
  router.delete(
    "/argoInstance/:argoInstanceName/applications/:argoAppName",
    async (request, response) => {
      var _a2;
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const terminateOperation = (_a2 = Boolean(request.query.terminateOperation)) != null ? _a2 : false;
      logger.info(`Getting info on ${argoInstanceName} and ${argoAppName}`);
      const argoDeleteAppandProjectResp = await argoSvc.deleteAppandProject({
        argoAppName,
        argoInstanceName,
        terminateOperation
      });
      return response.send(argoDeleteAppandProjectResp);
    }
  );
  router.get(
    "/argoInstance/:argoInstanceName/applications/:argoAppName",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoApplicationName = request.params.argoAppName;
      const applicationInformation = await argoSvc.getArgoApplicationInfo({
        argoApplicationName,
        argoInstanceName
      });
      return response.status(applicationInformation.statusCode).send(applicationInformation);
    }
  );
  router.delete(
    "/argoInstance/:argoInstanceName/applications/:argoAppName/operation",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const terminateArgoAppOperationResp = await argoSvc.terminateArgoAppOperation({
        argoAppName,
        argoInstanceName
      });
      return response.status(terminateArgoAppOperationResp.statusCode).send(terminateArgoAppOperationResp);
    }
  );
  router.use(backendCommon.errorHandler());
  return Promise.resolve(router);
}

index_cjs.ArgoService = ArgoService;
index_cjs.createRouter = createRouter;

var pluginScaffolderBackend = require$$0$1;
var backstagePluginArgoCdBackend = index_cjs;

const createArgoCdResources = (config, logger) => {
  return pluginScaffolderBackend.createTemplateAction({
    id: "argocd:create-resources",
    schema: {
      input: {
        required: ["appName", "argoInstance", "namespace", "repoUrl", "path"],
        type: "object",
        properties: {
          projectName: {
            type: "string",
            title: "Project Name",
            description: "The name of the project as it will show up in Argo CD. By default we use the application name."
          },
          appName: {
            type: "string",
            title: "Application Name",
            description: "The name of the app as it will show up in Argo CD"
          },
          argoInstance: {
            type: "string",
            title: "Argo CD Instance",
            description: "The name of the Argo CD Instance to deploy to"
          },
          namespace: {
            type: "string",
            title: "Namespace",
            description: "The namespace Argo CD will target for resource deployment"
          },
          repoUrl: {
            type: "string",
            title: "Repository URL",
            description: "The Repo URL that will be programmed into the Argo CD project and application"
          },
          path: {
            type: "string",
            title: "path",
            description: "The path of the resources Argo CD will watch in the repository mentioned"
          },
          labelValue: {
            type: "string",
            title: "Label Value",
            description: "The label Backstage will use to find applications in Argo CD"
          }
        }
      }
    },
    async handler(ctx) {
      var _a, _b;
      const argoUserName = (_a = config.getOptionalString("argocd.username")) != null ? _a : "argocdUsername";
      const argoPassword = (_b = config.getOptionalString("argocd.password")) != null ? _b : "argocdPassword";
      const argoSvc = new backstagePluginArgoCdBackend.ArgoService(
        argoUserName,
        argoPassword,
        config,
        logger
      );
      await argoSvc.createArgoResources({
        argoInstance: ctx.input.argoInstance,
        appName: ctx.input.appName,
        projectName: ctx.input.projectName ? ctx.input.projectName : ctx.input.appName,
        namespace: ctx.input.namespace,
        sourceRepo: ctx.input.repoUrl,
        sourcePath: ctx.input.path,
        labelValue: ctx.input.labelValue ? ctx.input.labelValue : ctx.input.appName,
        logger
      });
    }
  });
};

var createArgoCdResources_1 = createArgoCdResources;

const scaffolderBackendModuleArgocd = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-module-argocd",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ scaffolder, config, logger }) {
        scaffolder.addActions(
          createArgoCdResources_1(config, require$$0.loggerToWinstonLogger(logger))
        );
      }
    });
  }
});

exports["default"] = scaffolderBackendModuleArgocd;
//# sourceMappingURL=index.cjs.js.map
