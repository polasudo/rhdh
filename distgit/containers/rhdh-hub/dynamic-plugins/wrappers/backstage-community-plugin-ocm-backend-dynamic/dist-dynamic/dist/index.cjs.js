'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$0$3 = require('@backstage/catalog-model');
var require$$1 = require('@backstage/errors');
var require$$0$1 = require('@kubernetes/client-node');
var require$$0$2 = require('semver');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$3 = require('@backstage/plugin-permission-common');
var require$$0$5 = require('@backstage/backend-defaults/rootHttpRouter');
var require$$4 = require('@backstage/plugin-permission-node');
var require$$5 = require('express');
var require$$0$4 = require('@backstage/backend-openapi-utils');

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var index_cjs = {};

var bundle_cjs = {};

const ocmClusterReadPermission = require$$3.createPermission({
  name: "ocm.cluster.read",
  attributes: {
    action: "read"
  }
});
const ocmEntityReadPermission = require$$3.createPermission({
  name: "ocm.entity.read",
  attributes: {
    action: "read"
  }
});
const ocmEntityPermissions = [
  ocmClusterReadPermission,
  ocmEntityReadPermission
];

const ANNOTATION_CLUSTER_ID = "janus-idp.io/ocm-cluster-id";
const ANNOTATION_PROVIDER_ID = "janus-idp.io/ocm-provider-id";

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	ANNOTATION_CLUSTER_ID: ANNOTATION_CLUSTER_ID,
	ANNOTATION_PROVIDER_ID: ANNOTATION_PROVIDER_ID,
	ocmClusterReadPermission: ocmClusterReadPermission,
	ocmEntityPermissions: ocmEntityPermissions,
	ocmEntityReadPermission: ocmEntityReadPermission
});

var require$$6 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var module_cjs = {};

var ManagedClusterProvider_cjs = {};

var constants_cjs = {};

const CONSOLE_CLAIM = "consoleurl.cluster.open-cluster-management.io";
const HUB_CLUSTER_NAME_IN_OCM = "local-cluster";
const ANNOTATION_KUBERNETES_API_SERVER = "kubernetes.io/api-server";

constants_cjs.ANNOTATION_KUBERNETES_API_SERVER = ANNOTATION_KUBERNETES_API_SERVER;
constants_cjs.CONSOLE_CLAIM = CONSOLE_CLAIM;
constants_cjs.HUB_CLUSTER_NAME_IN_OCM = HUB_CLUSTER_NAME_IN_OCM;

var config_cjs = {};

var backendPluginApi$3 = require$$0;

const KUBERNETES_PLUGIN_CONFIG = "kubernetes.clusterLocatorMethods";
const OCM_PREFIX = "catalog.providers.ocm";
const KUBERNETES_PLUGIN_KEY = "kubernetesPluginRef";
const OWNER_KEY = "owner";
const isValidUrl = (url) => {
  try {
    new URL(url);
  } catch (error) {
    return false;
  }
  return true;
};
const deferToKubernetesPlugin = (config) => {
  if (config.has(KUBERNETES_PLUGIN_KEY)) {
    return true;
  }
  return false;
};
const getHubClusterFromKubernetesConfig = (id, config, globalConfig) => {
  const name = config.getOptionalString(KUBERNETES_PLUGIN_KEY);
  const _logTemplate = `Hub cluster ${OCM_PREFIX}.${id}.${KUBERNETES_PLUGIN_KEY}=${name}`;
  const hub = globalConfig.getConfigArray(KUBERNETES_PLUGIN_CONFIG).flatMap((method) => method.getOptionalConfigArray("clusters") || []).find((cluster) => cluster.getString("name") === name);
  if (!hub) {
    throw new Error(
      `${_logTemplate} not defined in kubernetes in ${KUBERNETES_PLUGIN_CONFIG}.clusters`
    );
  }
  if (hub.getString("authProvider") !== "serviceAccount") {
    throw new Error(`${_logTemplate} has to authenticate via 'serviceAccount'`);
  }
  return hub;
};
const getHubClusterFromOcmConfig = (id, config) => {
  const requiredValues = ["name", "url"];
  requiredValues.forEach((key) => {
    if (!config.has(key)) {
      throw new Error(
        `Value must be specified in config at '${OCM_PREFIX}.${id}.${key}'`
      );
    }
  });
  return config;
};
const getHubClusterFromConfig = (id, config, globalConfig) => {
  const hub = deferToKubernetesPlugin(config) ? getHubClusterFromKubernetesConfig(id, config, globalConfig) : getHubClusterFromOcmConfig(id, config);
  const url = hub.getString("url");
  if (!isValidUrl(url)) {
    throw new Error(`"${url}" is not a valid url`);
  }
  return {
    id,
    url,
    hubResourceName: hub.getString("name"),
    serviceAccountToken: hub.getOptionalString("serviceAccountToken"),
    skipTLSVerify: hub.getOptionalBoolean("skipTLSVerify") || false,
    caData: hub.getOptionalString("caData"),
    owner: config.getOptionalString(OWNER_KEY) ?? "unknown",
    schedule: config.has("schedule") ? backendPluginApi$3.readSchedulerServiceTaskScheduleDefinitionFromConfig(
      config.getConfig("schedule")
    ) : void 0
  };
};
const readOcmConfigs = (config) => {
  const ocmConfigs = config.getOptionalConfig(OCM_PREFIX);
  if (!ocmConfigs) {
    return [];
  }
  return ocmConfigs.keys().map((id) => getHubClusterFromConfig(id, ocmConfigs.getConfig(id), config));
};

config_cjs.deferToKubernetesPlugin = deferToKubernetesPlugin;
config_cjs.getHubClusterFromConfig = getHubClusterFromConfig;
config_cjs.getHubClusterFromKubernetesConfig = getHubClusterFromKubernetesConfig;
config_cjs.getHubClusterFromOcmConfig = getHubClusterFromOcmConfig;
config_cjs.readOcmConfigs = readOcmConfigs;

var kubernetes_cjs = {};

var clientNode = require$$0$1;

const hubApiClient = (clusterConfig, logger) => {
  const kubeConfig = new clientNode.KubeConfig();
  if (!clusterConfig.serviceAccountToken) {
    logger.info("Using default kubernetes config");
    kubeConfig.loadFromDefault();
    return kubeConfig.makeApiClient(clientNode.CustomObjectsApi);
  }
  logger.info("Loading kubernetes config from config file");
  const user = {
    name: "backstage",
    token: clusterConfig.serviceAccountToken
  };
  const context = {
    name: clusterConfig.hubResourceName,
    user: user.name,
    cluster: clusterConfig.hubResourceName
  };
  kubeConfig.loadFromOptions({
    clusters: [
      {
        server: clusterConfig.url,
        name: clusterConfig.hubResourceName,
        skipTLSVerify: clusterConfig.skipTLSVerify,
        caData: clusterConfig.caData
      }
    ],
    users: [user],
    contexts: [context],
    currentContext: context.name
  });
  return kubeConfig.makeApiClient(clientNode.CustomObjectsApi);
};
const kubeApiResponseHandler = (call) => {
  return call.then((r) => {
    return r.body;
  }).catch((r) => {
    if (!r.body) {
      throw Object.assign(new Error(r.message), {
        // If there is no body, there is no status code, default to 500
        statusCode: 500,
        name: r.message
      });
    } else if (typeof r.body === "string") {
      throw Object.assign(new Error(r.body), {
        statusCode: r.body.code || r.statusCode,
        name: r.body
      });
    }
    throw Object.assign(new Error(r.body.reason), {
      // Name and statusCode are required by the backstage error handler
      statusCode: r.body.code || r.statusCode,
      name: r.body.reason,
      ...r.body
    });
  });
};
const getManagedCluster = (api, name) => {
  return kubeApiResponseHandler(
    api.getClusterCustomObject(
      "cluster.open-cluster-management.io",
      "v1",
      "managedclusters",
      name
    )
  );
};
const listManagedClusters = (api) => {
  return kubeApiResponseHandler(
    api.listClusterCustomObject(
      "cluster.open-cluster-management.io",
      "v1",
      "managedclusters"
    )
  );
};
const getManagedClusterInfo = (api, name) => {
  return kubeApiResponseHandler(
    api.getNamespacedCustomObject(
      "internal.open-cluster-management.io",
      "v1beta1",
      name,
      "managedclusterinfos",
      name
    )
  );
};
const listManagedClusterInfos = (api) => {
  return kubeApiResponseHandler(
    api.listClusterCustomObject(
      "internal.open-cluster-management.io",
      "v1beta1",
      "managedclusterinfos"
    )
  );
};

kubernetes_cjs.getManagedCluster = getManagedCluster;
kubernetes_cjs.getManagedClusterInfo = getManagedClusterInfo;
kubernetes_cjs.hubApiClient = hubApiClient;
kubernetes_cjs.listManagedClusterInfos = listManagedClusterInfos;
kubernetes_cjs.listManagedClusters = listManagedClusters;

var parser_cjs = {};

var semver = require$$0$2;
var constants$1 = constants_cjs;

const convertCpus = (cpus) => {
  if (!cpus) {
    return void 0;
  }
  if (cpus.endsWith("m")) {
    return parseInt(cpus.slice(0, cpus.length - 1), 10) / 1e3;
  }
  return parseInt(cpus, 10);
};
const parseResources = (resources) => ({
  cpuCores: convertCpus(resources?.cpu),
  memorySize: resources?.memory,
  numberOfPods: parseInt(resources?.pods, 10) || void 0
});
const getClaim = (cluster, claimName) => cluster.status?.clusterClaims?.find((value) => value.name === claimName)?.value ?? "";
const parseClusterStatus = (mc) => {
  const available = mc.status?.conditions.find(
    (value) => value.type === "ManagedClusterConditionAvailable"
  );
  return {
    available: available?.status.toLowerCase() === "true",
    reason: available?.message
  };
};
const parseManagedCluster = (mc) => ({
  status: parseClusterStatus(mc),
  consoleUrl: getClaim(mc, constants$1.CONSOLE_CLAIM),
  kubernetesVersion: getClaim(mc, "kubeversion.open-cluster-management.io"),
  oauthUrl: getClaim(mc, "oauthredirecturis.openshift.io"),
  openshiftId: mc.metadata.labels?.clusterID ?? getClaim(mc, "id.openshift.io"),
  openshiftVersion: mc.metadata.labels?.openshiftVersion ?? getClaim(mc, "version.openshift.io"),
  platform: getClaim(mc, "platform.open-cluster-management.io"),
  region: getClaim(mc, "region.open-cluster-management.io"),
  allocatableResources: parseResources(mc.status?.allocatable || {}),
  availableResources: parseResources(mc.status?.capacity || {})
});
const parseUpdateInfo = (clusterInfo) => {
  const { availableUpdates, versionAvailableUpdates } = clusterInfo.status?.distributionInfo.ocp || {};
  if (!availableUpdates || availableUpdates?.length === 0 || !versionAvailableUpdates || versionAvailableUpdates?.length === 0) {
    return {
      update: {
        available: false
      }
    };
  }
  const version = semver.maxSatisfying(availableUpdates, "*");
  return {
    update: {
      available: true,
      version,
      url: versionAvailableUpdates[availableUpdates.indexOf(version)]?.url
    }
  };
};
const parseNodeStatus = (clusterInfo) => clusterInfo.status?.nodeList?.map((node) => {
  if (node.conditions.length !== 1) {
    throw new Error("Found more node conditions then one");
  }
  const condition = node.conditions[0];
  return {
    status: condition.status,
    type: condition.type
  };
}) || [];
const translateResourceToOCM = (clusterName, hubResourceName) => clusterName === hubResourceName ? constants$1.HUB_CLUSTER_NAME_IN_OCM : clusterName;
const translateOCMToResource = (clusterName, hubResourceName) => clusterName === constants$1.HUB_CLUSTER_NAME_IN_OCM ? hubResourceName : clusterName;

parser_cjs.getClaim = getClaim;
parser_cjs.parseClusterStatus = parseClusterStatus;
parser_cjs.parseManagedCluster = parseManagedCluster;
parser_cjs.parseNodeStatus = parseNodeStatus;
parser_cjs.parseResources = parseResources;
parser_cjs.parseUpdateInfo = parseUpdateInfo;
parser_cjs.translateOCMToResource = translateOCMToResource;
parser_cjs.translateResourceToOCM = translateResourceToOCM;

var catalogModel = require$$0$3;
var errors$1 = require$$1;
var pluginOcmCommon$1 = require$$6;
var constants = constants_cjs;
var config$1 = config_cjs;
var kubernetes$1 = kubernetes_cjs;
var parser$1 = parser_cjs;

class ManagedClusterProvider$2 {
  client;
  hubResourceName;
  id;
  owner;
  logger;
  scheduleFn;
  connection;
  constructor(client, hubResourceName, id, deps, owner, taskRunner) {
    this.client = client;
    this.hubResourceName = hubResourceName;
    this.id = id;
    this.logger = deps.logger;
    this.owner = owner;
    this.scheduleFn = this.createScheduleFn(taskRunner);
  }
  static fromConfig(deps, options) {
    const { config: config$1$1, logger } = deps;
    return config$1.readOcmConfigs(config$1$1).map((providerConfig) => {
      const client = kubernetes$1.hubApiClient(providerConfig, logger);
      let taskRunner;
      if ("scheduler" in options && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if ("schedule" in options) {
        taskRunner = options.schedule;
      } else {
        throw new errors$1.InputError(
          `No schedule provided via config for OCMProvider:${providerConfig.id}.`
        );
      }
      return new ManagedClusterProvider$2(
        client,
        providerConfig.hubResourceName,
        providerConfig.id,
        deps,
        providerConfig.owner,
        taskRunner
      );
    });
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  createScheduleFn(taskRunner) {
    return async () => {
      return taskRunner.run({
        id: `run_ocm_refresh_${this.getProviderName()}`,
        fn: async () => {
          try {
            await this.run();
          } catch (error) {
            this.logger.error(
              "Error while syncing cluster resources from Open Cluster Management",
              {
                // Default Error properties:
                name: error.name,
                message: error.message,
                stack: error.stack,
                // Additional status code if available:
                status: error.response?.status
              }
            );
          }
        }
      });
    };
  }
  getProviderName() {
    return `ocm-managed-cluster:${this.id}`;
  }
  async run() {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    this.logger.info(
      `Providing OpenShift cluster resources from Open Cluster Management`
    );
    const hubConsole = parser$1.getClaim(
      await kubernetes$1.getManagedCluster(this.client, constants.HUB_CLUSTER_NAME_IN_OCM),
      constants.CONSOLE_CLAIM
    );
    const resources = (await kubernetes$1.listManagedClusters(this.client)).items.map((i) => {
      const normalizedName = parser$1.translateOCMToResource(
        i.metadata.name,
        this.hubResourceName
      );
      return {
        kind: "Resource",
        apiVersion: "backstage.io/v1beta1",
        metadata: {
          name: normalizedName,
          annotations: {
            /**
             * Can also be pulled from ManagedClusterInfo on .spec.masterEndpoint (details in discussion: https://github.com/janus-idp/backstage-plugins/pull/94#discussion_r1093228858)
             */
            [constants.ANNOTATION_KUBERNETES_API_SERVER]: i.spec?.managedClusterClientConfigs?.[0]?.url,
            [pluginOcmCommon$1.ANNOTATION_CLUSTER_ID]: i.metadata?.labels?.clusterID,
            [catalogModel.ANNOTATION_LOCATION]: this.getProviderName(),
            [catalogModel.ANNOTATION_ORIGIN_LOCATION]: this.getProviderName(),
            [pluginOcmCommon$1.ANNOTATION_PROVIDER_ID]: this.id
          },
          links: [
            {
              url: parser$1.getClaim(i, constants.CONSOLE_CLAIM),
              title: "OpenShift Console",
              icon: "dashboard"
            },
            {
              url: `${hubConsole}/multicloud/infrastructure/clusters/details/${i.metadata.name}/`,
              title: "OCM Console"
            },
            {
              url: `https://console.redhat.com/openshift/details/s/${i.metadata.labels.clusterID}`,
              title: "OpenShift Cluster Manager"
            }
          ]
        },
        spec: {
          owner: this.owner,
          type: "kubernetes-cluster"
        }
      };
    });
    await this.connection.applyMutation({
      type: "full",
      entities: resources.map((entity) => ({
        entity,
        locationKey: this.getProviderName()
      }))
    });
  }
}

ManagedClusterProvider_cjs.ManagedClusterProvider = ManagedClusterProvider$2;

var backendPluginApi$2 = require$$0;
var alpha = require$$1$1;
var ManagedClusterProvider$1 = ManagedClusterProvider_cjs;

const catalogModuleOCMEntityProvider = backendPluginApi$2.createBackendModule({
  moduleId: "catalog-backend-module-ocm",
  pluginId: "catalog",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi$2.coreServices.rootConfig,
        logger: backendPluginApi$2.coreServices.logger,
        scheduler: backendPluginApi$2.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          ManagedClusterProvider$1.ManagedClusterProvider.fromConfig(
            { config, logger },
            {
              schedule: scheduler.createScheduledTaskRunner({
                frequency: { hours: 1 },
                timeout: { minutes: 15 },
                initialDelay: { seconds: 15 }
              }),
              scheduler
            }
          )
        );
      }
    });
  }
});

module_cjs.catalogModuleOCMEntityProvider = catalogModuleOCMEntityProvider;

var router_cjs = {};

var openapi_generated_cjs = {};

var backendOpenapiUtils = require$$0$4;

const spec = {
  openapi: "3.0.0",
  info: {
    title: "OCM Plugin API",
    version: "latest",
    description: "The Open Cluster Management (OCM) plugin integrates your Backstage instance with OCM."
  },
  servers: [
    {
      url: "{protocol}://{host}:{port}/{basePath}",
      variables: {
        protocol: {
          enum: ["http", "https"],
          default: "http"
        },
        host: {
          default: "localhost"
        },
        port: {
          default: "7007"
        },
        basePath: {
          default: "api/ocm"
        }
      }
    }
  ],
  paths: {
    "/status/{providerId}/{clusterName}": {
      get: {
        summary: "Get the status of a specific cluster",
        description: "Retrieve the status of a specific cluster on a given hub.",
        parameters: [
          {
            name: "providerId",
            in: "path",
            required: true,
            description: "The ID of the OCM provider",
            schema: {
              type: "string"
            }
          },
          {
            name: "clusterName",
            in: "path",
            required: true,
            description: "The name of the cluster",
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          "200": {
            description: "Cluster status retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Cluster"
                }
              }
            }
          },
          "403": {
            description: "Unauthorized"
          },
          "404": {
            description: "Hub not found"
          }
        },
        security: [
          {},
          {
            JWT: []
          }
        ]
      }
    },
    "/status": {
      get: {
        summary: "Get the status of all clusters",
        description: "Retrieve the status of all clusters across all hubs.",
        responses: {
          "200": {
            description: "Clusters status retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/ClusterOverview"
                  }
                }
              }
            }
          },
          "403": {
            description: "Unauthorized"
          }
        },
        security: [
          {},
          {
            JWT: []
          }
        ]
      }
    }
  },
  components: {
    schemas: {
      ClusterStatus: {
        type: "object",
        properties: {
          available: {
            type: "boolean",
            description: "Indicates if the cluster is available"
          },
          reason: {
            type: "string",
            description: "Optional reason why the cluster is not available or as problems"
          }
        },
        required: ["available"]
      },
      ClusterUpdate: {
        type: "object",
        properties: {
          available: {
            type: "boolean",
            description: "Indicates if an update is available"
          },
          version: {
            type: "string",
            description: "Version of the available update"
          },
          url: {
            type: "string",
            description: "URL for the update"
          }
        }
      },
      ClusterNodesStatus: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Status of the node"
          },
          type: {
            type: "string",
            description: "Type of the node"
          }
        }
      },
      ClusterDetails: {
        type: "object",
        properties: {
          consoleUrl: {
            type: "string",
            description: "URL for the cluster console"
          },
          kubernetesVersion: {
            type: "string",
            description: "Version of Kubernetes"
          },
          oauthUrl: {
            type: "string",
            description: "OAuth URL for the cluster"
          },
          openshiftId: {
            type: "string",
            description: "ID of the OpenShift cluster"
          },
          openshiftVersion: {
            type: "string",
            description: "Version of OpenShift running in the cluster"
          },
          platform: {
            type: "string",
            description: "Platform of the cluster"
          },
          region: {
            type: "string",
            description: "Region where the cluster is located"
          },
          allocatableResources: {
            type: "object",
            description: "Resources that are allocatable in the cluster",
            properties: {
              cpuCores: {
                type: "number",
                description: "Number of CPU cores allocatable"
              },
              memorySize: {
                type: "string",
                description: "Size of allocatable memory"
              },
              numberOfPods: {
                type: "number",
                description: "Number of allocatable pods"
              }
            }
          },
          availableResources: {
            type: "object",
            description: "Resources that are available in the cluster",
            properties: {
              cpuCores: {
                type: "number",
                description: "Number of CPU cores available"
              },
              memorySize: {
                type: "string",
                description: "Size of available memory"
              },
              numberOfPods: {
                type: "number",
                description: "Number of available pods"
              }
            }
          },
          update: {
            $ref: "#/components/schemas/ClusterUpdate"
          },
          status: {
            $ref: "#/components/schemas/ClusterStatus"
          }
        }
      },
      Cluster: {
        allOf: [
          {
            $ref: "#/components/schemas/ClusterBase"
          },
          {
            $ref: "#/components/schemas/ClusterDetails"
          }
        ]
      },
      ClusterBase: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the cluster"
          }
        }
      },
      ClusterOverview: {
        allOf: [
          {
            $ref: "#/components/schemas/ClusterBase"
          },
          {
            type: "object",
            properties: {
              status: {
                $ref: "#/components/schemas/ClusterStatus"
              },
              update: {
                $ref: "#/components/schemas/ClusterUpdate"
              },
              platform: {
                type: "string",
                description: "Platform of the cluster"
              },
              openshiftVersion: {
                type: "string",
                description: "Version of OpenShift running in the cluster"
              },
              nodes: {
                type: "array",
                items: {
                  $ref: "#/components/schemas/ClusterNodesStatus"
                }
              }
            }
          }
        ]
      }
    },
    securitySchemes: {
      JWT: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Backstage Permissions Framework JWT"
      }
    }
  }
};
const createOpenApiRouter = async (options) => backendOpenapiUtils.createValidatedOpenApiRouter(spec, options);

openapi_generated_cjs.createOpenApiRouter = createOpenApiRouter;
openapi_generated_cjs.spec = spec;

var rootHttpRouter = require$$0$5;
var backendPluginApi$1 = require$$0;
var errors = require$$1;
var pluginPermissionCommon = require$$3;
var pluginPermissionNode = require$$4;
var express = require$$5;
var pluginOcmCommon = require$$6;
var config = config_cjs;
var kubernetes = kubernetes_cjs;
var parser = parser_cjs;
var openapi_generated = openapi_generated_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);

async function createRouter(deps) {
  const { config: config$1, logger, httpAuth, permissions } = deps;
  const router = await openapi_generated.createOpenApiRouter();
  const permissionsIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: pluginOcmCommon.ocmEntityPermissions
  });
  router.use(express__default.default.json());
  router.use(permissionsIntegrationRouter);
  const clients = Object.fromEntries(
    config.readOcmConfigs(config$1).map((provider) => [
      provider.id,
      {
        client: kubernetes.hubApiClient(provider, logger),
        hubResourceName: provider.hubResourceName
      }
    ])
  );
  const authorize = async (request, permission) => {
    const decision = (await permissions.authorize([{ permission }], {
      credentials: await httpAuth.credentials(request)
    }))[0];
    return decision;
  };
  router.get("/status/:providerId/:clusterName", async (request, response) => {
    const decision = await authorize(request, pluginOcmCommon.ocmEntityReadPermission);
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const { clusterName, providerId } = request.params;
    logger.debug(
      `Incoming status request for ${clusterName} cluster on ${providerId} hub`
    );
    if (!clients.hasOwnProperty(providerId)) {
      throw Object.assign(new Error("Hub not found"), {
        statusCode: 404,
        name: "HubNotFound"
      });
    }
    const normalizedClusterName = parser.translateResourceToOCM(
      clusterName,
      clients[providerId].hubResourceName
    );
    const mc = await kubernetes.getManagedCluster(
      clients[providerId].client,
      normalizedClusterName
    );
    const mci = await kubernetes.getManagedClusterInfo(
      clients[providerId].client,
      normalizedClusterName
    );
    response.send({
      name: clusterName,
      ...parser.parseManagedCluster(mc),
      ...parser.parseUpdateInfo(mci)
    });
  });
  router.get("/status", async (request, response) => {
    const decision = await authorize(request, pluginOcmCommon.ocmClusterReadPermission);
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    logger.debug(`Incoming status request for all clusters`);
    const allClusters = await Promise.all(
      Object.values(clients).map(async (c) => {
        const mcs = await kubernetes.listManagedClusters(c.client);
        const mcis = await kubernetes.listManagedClusterInfos(c.client);
        return mcs.items.map((mc) => {
          const mci = mcis.items.find(
            (info) => info.metadata?.name === mc.metadata.name
          ) || {};
          return {
            name: parser.translateOCMToResource(mc.metadata.name, c.hubResourceName),
            status: parser.parseClusterStatus(mc),
            platform: parser.getClaim(mc, "platform.open-cluster-management.io"),
            openshiftVersion: mc.metadata.labels?.openshiftVersion ?? parser.getClaim(mc, "version.openshift.io"),
            nodes: parser.parseNodeStatus(mci),
            ...parser.parseUpdateInfo(mci)
          };
        });
      })
    );
    return response.send(allClusters.flat());
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config: config$1 });
  router.use(middleware.error());
  return router;
}
const ocmPlugin = backendPluginApi$1.createBackendPlugin({
  pluginId: "ocm",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi$1.coreServices.logger,
        config: backendPluginApi$1.coreServices.rootConfig,
        http: backendPluginApi$1.coreServices.httpRouter,
        httpAuth: backendPluginApi$1.coreServices.httpAuth,
        permissions: backendPluginApi$1.coreServices.permissions
      },
      async init({ config, logger, http, httpAuth, permissions }) {
        http.use(await createRouter({ config, logger, httpAuth, permissions }));
      }
    });
  }
});

router_cjs.ocmPlugin = ocmPlugin;

var backendPluginApi = require$$0;





var module$1$1 = module_cjs;
var router$1 = router_cjs;

const bundle$1 = backendPluginApi.createBackendFeatureLoader({
  async loader() {
    return [module$1$1.catalogModuleOCMEntityProvider, router$1.ocmPlugin];
  }
});

bundle_cjs.bundle = bundle$1;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var bundle = bundle_cjs;
var ManagedClusterProvider = ManagedClusterProvider_cjs;
var module$1 = module_cjs;
var router = router_cjs;



var _default = index_cjs.default = bundle.bundle;
index_cjs.ManagedClusterProvider = ManagedClusterProvider.ManagedClusterProvider;
index_cjs.catalogModuleOCMEntityProvider = module$1.catalogModuleOCMEntityProvider;
index_cjs.ocmPlugin = router.ocmPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
