'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0 = require('@aws-sdk/credential-providers');
var require$$1 = require('@aws-sdk/signature-v4');
var require$$2 = require('@aws-crypto/sha256-js');
var require$$3 = require('@backstage/integration-aws-node');
var require$$21 = require('@backstage/plugin-permission-common');
var lodash$1 = require('lodash');
var require$$12 = require('luxon');
var require$$5 = require('@azure/identity');
var require$$6 = require('@google-cloud/container');
var require$$7 = require('@kubernetes/client-node');
var require$$8 = require('fs-extra');
var require$$9 = require('@backstage/plugin-permission-node');
var require$$10 = require('express');
var require$$11 = require('express-promise-router');
var require$$13 = require('@backstage/errors');
var require$$14 = require('@backstage/catalog-client');
var require$$15 = require('node:dns');
var require$$16 = require('@backstage/backend-common');
var require$$17 = require('@backstage/catalog-model');
var require$$19 = require('node-fetch');
var require$$20 = require('https');
var require$$22 = require('http-proxy-middleware');

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

var alpha_cjs = {};

var index_cjs$1 = {};

const ANNOTATION_KUBERNETES_API_SERVER = "kubernetes.io/api-server";
const ANNOTATION_KUBERNETES_API_SERVER_CA = "kubernetes.io/api-server-certificate-authority";
const ANNOTATION_KUBERNETES_AUTH_PROVIDER = "kubernetes.io/auth-provider";
const ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER = "kubernetes.io/oidc-token-provider";
const ANNOTATION_KUBERNETES_SKIP_METRICS_LOOKUP = "kubernetes.io/skip-metrics-lookup";
const ANNOTATION_KUBERNETES_SKIP_TLS_VERIFY = "kubernetes.io/skip-tls-verify";
const ANNOTATION_KUBERNETES_DASHBOARD_URL = "kubernetes.io/dashboard-url";
const ANNOTATION_KUBERNETES_DASHBOARD_APP = "kubernetes.io/dashboard-app";
const ANNOTATION_KUBERNETES_DASHBOARD_PARAMETERS = "kubernetes.io/dashboard-parameters";
const ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE = "kubernetes.io/aws-assume-role";
const ANNOTATION_KUBERNETES_AWS_CLUSTER_ID = "kubernetes.io/x-k8s-aws-id";
const ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID = "kubernetes.io/aws-external-id";

const kubernetesProxyPermission = require$$21.createPermission({
  name: "kubernetes.proxy",
  attributes: {}
});
const kubernetesPermissions = [kubernetesProxyPermission];

const groupResponses = (fetchResponse) => {
  return fetchResponse.reduce(
    (prev, next) => {
      switch (next.type) {
        case "deployments":
          prev.deployments.push(...next.resources);
          break;
        case "pods":
          prev.pods.push(...next.resources);
          break;
        case "replicasets":
          prev.replicaSets.push(...next.resources);
          break;
        case "services":
          prev.services.push(...next.resources);
          break;
        case "configmaps":
          prev.configMaps.push(...next.resources);
          break;
        case "horizontalpodautoscalers":
          prev.horizontalPodAutoscalers.push(...next.resources);
          break;
        case "ingresses":
          prev.ingresses.push(...next.resources);
          break;
        case "jobs":
          prev.jobs.push(...next.resources);
          break;
        case "cronjobs":
          prev.cronJobs.push(...next.resources);
          break;
        case "customresources":
          prev.customResources.push(...next.resources);
          break;
        case "statefulsets":
          prev.statefulsets.push(...next.resources);
          break;
        case "daemonsets":
          prev.daemonSets.push(...next.resources);
          break;
      }
      return prev;
    },
    {
      pods: [],
      replicaSets: [],
      deployments: [],
      services: [],
      configMaps: [],
      horizontalPodAutoscalers: [],
      ingresses: [],
      jobs: [],
      cronJobs: [],
      customResources: [],
      statefulsets: [],
      daemonSets: []
    }
  );
};

const detectErrorsInObjects = (objects, errorMappers) => {
  return objects.flatMap((o) => {
    return errorMappers.flatMap((em) => em.detectErrors(o));
  });
};

function isPodReadinessProbeUnready({
  container,
  containerStatus
}) {
  if (containerStatus.ready || containerStatus.state?.running?.startedAt === void 0 || !container.readinessProbe) {
    return false;
  }
  const startDateTime = require$$12.DateTime.fromISO(
    containerStatus.state?.running?.startedAt
  ).plus({
    seconds: container.readinessProbe?.initialDelaySeconds ?? 0
  }).plus({
    seconds: (container.readinessProbe?.periodSeconds ?? 0) * (container.readinessProbe?.failureThreshold ?? 0)
  });
  return startDateTime < require$$12.DateTime.now();
}
const podToContainerSpecsAndStatuses = (pod) => {
  const specs = lodash$1.groupBy(pod.spec?.containers ?? [], (value) => value.name);
  const result = [];
  for (const cs of pod.status?.containerStatuses ?? []) {
    const spec = specs[cs.name];
    if (spec.length > 0) {
      result.push({
        container: spec[0],
        containerStatus: cs
      });
    }
  }
  return result;
};
const readinessProbeProposedFixes = (pod) => {
  const firstUnreadyContainerStatus = pod.status?.containerStatuses?.find(
    (cs) => {
      return cs.ready === false;
    }
  );
  return {
    errorType: "ReadinessProbeFailed",
    rootCauseExplanation: `The container ${firstUnreadyContainerStatus?.name} failed to start properly, but is not crashing`,
    actions: [
      "Ensure that the container starts correctly locally",
      "Check the container's logs looking for error during startup"
    ],
    type: "events",
    podName: pod.metadata?.name ?? ""
  };
};
const restartingPodProposedFixes = (pod) => {
  const lastTerminatedCs = (pod.status?.containerStatuses ?? []).find(
    (cs) => cs.lastState?.terminated !== void 0
  );
  const lastTerminated = lastTerminatedCs?.lastState?.terminated;
  if (!lastTerminated) {
    return void 0;
  }
  switch (lastTerminated?.reason) {
    case "Unknown":
      return {
        // TODO check this one, it's more likely a cluster issue
        errorType: "Unknown",
        rootCauseExplanation: `This container has exited with a non-zero exit code (${lastTerminated.exitCode})`,
        actions: ["Check the crash logs for stacktraces"],
        container: lastTerminatedCs.name,
        type: "logs"
      };
    case "Error":
      return {
        errorType: "Error",
        rootCauseExplanation: `This container has exited with a non-zero exit code (${lastTerminated.exitCode})`,
        actions: ["Check the crash logs for stacktraces"],
        container: lastTerminatedCs.name,
        type: "logs"
      };
    case "OOMKilled":
      return {
        errorType: "OOMKilled",
        rootCauseExplanation: `The container "${lastTerminatedCs.name}" has crashed because it has tried to use more memory that it has been allocated`,
        actions: [
          `Increase the amount of memory assigned to the container`,
          "Ensure the application is memory bounded and is not trying to consume too much memory"
        ],
        docsLink: "https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/#exceed-a-container-s-memory-limit",
        type: "docs"
      };
    default:
      return void 0;
  }
};
const waitingProposedFix = (pod) => {
  const waitingCs = (pod.status?.containerStatuses ?? []).find(
    (cs) => cs.state?.waiting !== void 0
  );
  const waiting = (pod.status?.containerStatuses ?? []).map((cs) => cs.state?.waiting).find((w) => w?.reason !== void 0);
  switch (waiting?.reason) {
    case "InvalidImageName":
      return {
        errorType: "InvalidImageName",
        rootCauseExplanation: "The image in the pod is invalid",
        actions: ["Ensure the image name is correct and valid image name"],
        type: "docs",
        docsLink: "https://docs.docker.com/engine/reference/commandline/tag/#extended-description"
      };
    case "ImagePullBackOff":
      return {
        errorType: "ImagePullBackOff",
        rootCauseExplanation: "The image either could not be found or Kubernetes does not have permission to pull it",
        actions: [
          "Ensure the image name is correct",
          "Ensure Kubernetes has permission to pull this image"
        ],
        type: "docs",
        docsLink: "https://kubernetes.io/docs/concepts/containers/images/#imagepullbackoff"
      };
    case "CrashLoopBackOff":
      return {
        errorType: "CrashLoopBackOff",
        rootCauseExplanation: `The container ${waitingCs?.name} has crashed many times, it will be exponentially restarted until it stops crashing`,
        actions: ["Check the crash logs for stacktraces"],
        type: "logs",
        container: waitingCs?.name ?? "unknown"
      };
    case "CreateContainerConfigError":
      return {
        errorType: "CreateContainerConfigError",
        rootCauseExplanation: "There is missing or mismatching configuration required to start the container",
        actions: [
          "Ensure ConfigMaps references in the Deployment manifest are correct and the keys exist",
          "Ensure Secrets references in the Deployment manifest are correct and the keys exist"
        ],
        type: "docs",
        docsLink: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/"
      };
    default:
      return void 0;
  }
};
const podErrorMappers = [
  {
    detectErrors: (pod) => {
      return podToContainerSpecsAndStatuses(pod).filter(isPodReadinessProbeUnready).map((cs) => ({
        type: "readiness-probe-taking-too-long",
        message: `The container ${cs.container.name} failed to start properly, but is not crashing`,
        severity: 4,
        proposedFix: readinessProbeProposedFixes(pod),
        sourceRef: {
          name: pod.metadata?.name ?? "unknown pod",
          namespace: pod.metadata?.namespace ?? "unknown namespace",
          kind: "Pod",
          apiGroup: "v1"
        },
        occurrenceCount: 1
      }));
    }
  },
  {
    detectErrors: (pod) => {
      return (pod.status?.containerStatuses ?? []).filter((cs) => cs.state?.waiting?.message !== void 0).map((cs) => ({
        type: "container-waiting",
        message: cs.state?.waiting?.message ?? "container waiting",
        severity: 4,
        proposedFix: waitingProposedFix(pod),
        sourceRef: {
          name: pod.metadata?.name ?? "unknown pod",
          namespace: pod.metadata?.namespace ?? "unknown namespace",
          kind: "Pod",
          apiGroup: "v1"
        },
        occurrenceCount: 1
      }));
    }
  },
  {
    detectErrors: (pod) => {
      return (pod.status?.containerStatuses ?? []).filter((cs) => cs.restartCount > 0).map((cs) => ({
        type: "containers-restarting",
        message: `container=${cs.name} restarted ${cs.restartCount} times`,
        severity: 4,
        proposedFix: restartingPodProposedFixes(pod),
        sourceRef: {
          name: pod.metadata?.name ?? "unknown pod",
          namespace: pod.metadata?.namespace ?? "unknown namespace",
          kind: "Pod",
          apiGroup: "v1"
        },
        occurrenceCount: cs.restartCount
      }));
    }
  }
];
const detectErrorsInPods = (pods) => detectErrorsInObjects(pods, podErrorMappers);

const deploymentErrorMappers = [
  {
    detectErrors: (deployment) => {
      return (deployment.status?.conditions ?? []).filter((c) => c.status === "False").filter((c) => c.message !== void 0).map((c) => ({
        type: "condition-message-present",
        message: c.message ?? "",
        severity: 6,
        sourceRef: {
          name: deployment.metadata?.name ?? "unknown hpa",
          namespace: deployment.metadata?.namespace ?? "unknown namespace",
          kind: "Deployment",
          apiGroup: "apps/v1"
        },
        occurrenceCount: 1
      }));
    }
  }
];
const detectErrorsInDeployments = (deployments) => detectErrorsInObjects(deployments, deploymentErrorMappers);

const hpaErrorMappers = [
  {
    detectErrors: (hpa) => {
      if ((hpa.spec?.maxReplicas ?? -1) === hpa.status?.currentReplicas) {
        return [
          {
            type: "hpa-max-current-replicas",
            message: `Current number of replicas (${hpa.status?.currentReplicas}) is equal to the configured max number of replicas (${hpa.spec?.maxReplicas ?? -1})`,
            severity: 8,
            sourceRef: {
              name: hpa.metadata?.name ?? "unknown hpa",
              namespace: hpa.metadata?.namespace ?? "unknown namespace",
              kind: "HorizontalPodAutoscaler",
              apiGroup: "autoscaling/v2"
            },
            occurrenceCount: 1
          }
        ];
      }
      return [];
    }
  }
];
const detectErrorsInHpa = (hpas) => detectErrorsInObjects(hpas, hpaErrorMappers);

const detectErrors = (objects) => {
  const errors = /* @__PURE__ */ new Map();
  for (const clusterResponse of objects.items) {
    let clusterErrors = [];
    const groupedResponses = groupResponses(clusterResponse.resources);
    clusterErrors = clusterErrors.concat(
      detectErrorsInPods(groupedResponses.pods)
    );
    clusterErrors = clusterErrors.concat(
      detectErrorsInDeployments(groupedResponses.deployments)
    );
    clusterErrors = clusterErrors.concat(
      detectErrorsInHpa(
        groupedResponses.horizontalPodAutoscalers
      )
    );
    errors.set(clusterResponse.cluster.name, clusterErrors);
  }
  return errors;
};

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	ANNOTATION_KUBERNETES_API_SERVER: ANNOTATION_KUBERNETES_API_SERVER,
	ANNOTATION_KUBERNETES_API_SERVER_CA: ANNOTATION_KUBERNETES_API_SERVER_CA,
	ANNOTATION_KUBERNETES_AUTH_PROVIDER: ANNOTATION_KUBERNETES_AUTH_PROVIDER,
	ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE: ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE,
	ANNOTATION_KUBERNETES_AWS_CLUSTER_ID: ANNOTATION_KUBERNETES_AWS_CLUSTER_ID,
	ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID: ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID,
	ANNOTATION_KUBERNETES_DASHBOARD_APP: ANNOTATION_KUBERNETES_DASHBOARD_APP,
	ANNOTATION_KUBERNETES_DASHBOARD_PARAMETERS: ANNOTATION_KUBERNETES_DASHBOARD_PARAMETERS,
	ANNOTATION_KUBERNETES_DASHBOARD_URL: ANNOTATION_KUBERNETES_DASHBOARD_URL,
	ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER: ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER,
	ANNOTATION_KUBERNETES_SKIP_METRICS_LOOKUP: ANNOTATION_KUBERNETES_SKIP_METRICS_LOOKUP,
	ANNOTATION_KUBERNETES_SKIP_TLS_VERIFY: ANNOTATION_KUBERNETES_SKIP_TLS_VERIFY,
	kubernetesPermissions: kubernetesPermissions,
	kubernetesProxyPermission: kubernetesProxyPermission,
	detectErrors: detectErrors,
	groupResponses: groupResponses
});

var require$$4 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var credentialProviders = require$$0;
var signatureV4 = require$$1;
var sha256Js = require$$2;
var integrationAwsNode = require$$3;
var pluginKubernetesCommon = require$$4;
var identity = require$$5;
var container = require$$6;
var clientNode$1 = require$$7;
var fs = require$$8;
var pluginPermissionNode = require$$9;
var express = require$$10;
var Router = require$$11;
var luxon = require$$12;
var errors = require$$13;
var catalogClient = require$$14;
var dns = require$$15;
var backendCommon = require$$16;
var catalogModel = require$$17;
var lodash = lodash$1;
var fetch$1 = require$$19;
var https$1 = require$$20;
var pluginPermissionCommon = require$$21;
var httpProxyMiddleware = require$$22;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

function _interopNamespaceCompat$1(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var container__namespace = /*#__PURE__*/_interopNamespaceCompat$1(container);
var fs__default = /*#__PURE__*/_interopDefaultCompat$1(fs);
var express__default = /*#__PURE__*/_interopDefaultCompat$1(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat$1(Router);
var dns__default = /*#__PURE__*/_interopDefaultCompat$1(dns);
var lodash__default = /*#__PURE__*/_interopDefaultCompat$1(lodash);
var fetch__default$1 = /*#__PURE__*/_interopDefaultCompat$1(fetch$1);
var https__namespace$1 = /*#__PURE__*/_interopNamespaceCompat$1(https$1);

class AksStrategy {
  async getCredential(_, requestAuth) {
    const token = requestAuth.aks;
    return token ? { type: "bearer token", token } : { type: "anonymous" };
  }
  validateCluster() {
    return [];
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class AnonymousStrategy {
  async getCredential() {
    return { type: "anonymous" };
  }
  validateCluster() {
    return [];
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

const defaultRegion = "us-east-1";
class AwsIamStrategy {
  credsManager;
  constructor(opts) {
    this.credsManager = integrationAwsNode.DefaultAwsCredentialsManager.fromConfig(opts.config);
  }
  async getCredential(clusterDetails) {
    return {
      type: "bearer token",
      token: await this.getBearerToken(
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_CLUSTER_ID] ?? clusterDetails.name,
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE],
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID]
      )
    };
  }
  validateCluster() {
    return [];
  }
  async getBearerToken(clusterId, assumeRole, externalId) {
    const region = process.env.AWS_REGION ?? defaultRegion;
    let credentials = (await this.credsManager.getCredentialProvider()).sdkCredentialProvider;
    if (assumeRole) {
      credentials = credentialProviders.fromTemporaryCredentials({
        masterCredentials: credentials,
        clientConfig: {
          region
        },
        params: {
          RoleArn: assumeRole,
          ExternalId: externalId
        }
      });
    }
    const signer = new signatureV4.SignatureV4({
      credentials,
      region,
      service: "sts",
      sha256: sha256Js.Sha256
    });
    const request = await signer.presign(
      {
        headers: {
          host: `sts.${region}.amazonaws.com`,
          "x-k8s-aws-id": clusterId
        },
        hostname: `sts.${region}.amazonaws.com`,
        method: "GET",
        path: "/",
        protocol: "https:",
        query: {
          Action: "GetCallerIdentity",
          Version: "2011-06-15"
        }
      },
      { expiresIn: 0 }
    );
    const query = Object.keys(request?.query ?? {}).map(
      (q) => `${encodeURIComponent(q)}=${encodeURIComponent(
        request.query?.[q]
      )}`
    ).join("&");
    const url = `https://${request.hostname}${request.path}?${query}`;
    return `k8s-aws-v1.${Buffer.from(url).toString("base64url")}`;
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

const aksScope = "6dae42f8-4368-4678-94ff-3960e28e3630/.default";
class AzureIdentityStrategy {
  constructor(logger, tokenCredential = new identity.DefaultAzureCredential()) {
    this.logger = logger;
    this.tokenCredential = tokenCredential;
  }
  accessToken = { token: "", expiresOnTimestamp: 0 };
  newTokenPromise;
  async getCredential() {
    if (!this.tokenRequiresRefresh()) {
      return { type: "bearer token", token: this.accessToken.token };
    }
    if (!this.newTokenPromise) {
      this.newTokenPromise = this.fetchNewToken();
    }
    return this.newTokenPromise ? { type: "bearer token", token: await this.newTokenPromise } : { type: "anonymous" };
  }
  validateCluster() {
    return [];
  }
  async fetchNewToken() {
    try {
      this.logger.info("Fetching new Azure token for AKS");
      const newAccessToken = await this.tokenCredential.getToken(aksScope, {
        requestOptions: { timeout: 1e4 }
        // 10 seconds
      });
      if (!newAccessToken) {
        throw new Error("AccessToken is null");
      }
      this.accessToken = newAccessToken;
    } catch (err) {
      this.logger.error("Unable to fetch Azure token", err);
      if (this.tokenExpired()) {
        throw err;
      }
    }
    this.newTokenPromise = void 0;
    return this.accessToken.token;
  }
  tokenRequiresRefresh() {
    const expiresOn = this.accessToken.expiresOnTimestamp - 15 * 60 * 1e3;
    return Date.now() >= expiresOn;
  }
  tokenExpired() {
    return Date.now() >= this.accessToken.expiresOnTimestamp;
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class GoogleStrategy {
  async getCredential(_, requestAuth) {
    const token = requestAuth.google;
    if (!token) {
      throw new Error(
        "Google token not found under auth.google in request body"
      );
    }
    return { type: "bearer token", token };
  }
  validateCluster() {
    return [];
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class GoogleServiceAccountStrategy {
  async getCredential() {
    const client = new container__namespace.v1.ClusterManagerClient();
    const token = await client.auth.getAccessToken();
    if (!token) {
      throw new Error(
        "Unable to obtain access token for the current Google Application Default Credentials"
      );
    }
    return { type: "bearer token", token };
  }
  validateCluster() {
    return [];
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class DispatchStrategy {
  strategyMap;
  constructor(options) {
    this.strategyMap = options.authStrategyMap;
  }
  getCredential(clusterDetails, auth) {
    const authProvider = clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER];
    if (this.strategyMap[authProvider]) {
      return this.strategyMap[authProvider].getCredential(clusterDetails, auth);
    }
    throw new Error(
      `authProvider "${authProvider}" has no AuthenticationStrategy associated with it`
    );
  }
  validateCluster(authMetadata) {
    const authProvider = authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER];
    const strategy = this.strategyMap[authProvider];
    if (!strategy) {
      return [
        new Error(
          `authProvider "${authProvider}" has no config associated with it`
        )
      ];
    }
    return strategy.validateCluster(authMetadata);
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class ServiceAccountStrategy {
  async getCredential(clusterDetails) {
    const token = clusterDetails.authMetadata.serviceAccountToken;
    if (token) {
      return { type: "bearer token", token };
    }
    const kc = new clientNode$1.KubeConfig();
    kc.loadFromCluster();
    const user = kc.getCurrentUser();
    return {
      type: "bearer token",
      token: fs__default.default.readFileSync(user.authProvider.config.tokenFile).toString()
    };
  }
  validateCluster() {
    return [];
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class OidcStrategy {
  async getCredential(clusterDetails, authConfig) {
    const oidcTokenProvider = clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER];
    if (!oidcTokenProvider || oidcTokenProvider === "") {
      throw new Error(
        `oidc authProvider requires a configured oidcTokenProvider`
      );
    }
    const token = authConfig.oidc?.[oidcTokenProvider];
    if (!token) {
      throw new Error(
        `Auth token not found under oidc.${oidcTokenProvider} in request body`
      );
    }
    return { type: "bearer token", token };
  }
  validateCluster(authMetadata) {
    const oidcTokenProvider = authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER];
    if (!oidcTokenProvider || oidcTokenProvider === "") {
      return [new Error(`Must specify a token provider for 'oidc' strategy`)];
    }
    return [];
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

class ConfigClusterLocator {
  clusterDetails;
  constructor(clusterDetails) {
    this.clusterDetails = clusterDetails;
  }
  static fromConfig(config, authStrategy) {
    const clusterNames = /* @__PURE__ */ new Set();
    return new ConfigClusterLocator(
      config.getConfigArray("clusters").map((c) => {
        const authMetadataBlock = c.getOptional("authMetadata");
        const name = c.getString("name");
        if (clusterNames.has(name)) {
          throw new Error(`Duplicate cluster name '${name}'`);
        }
        clusterNames.add(name);
        const authProvider = authMetadataBlock?.[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER] ?? c.getOptionalString("authProvider");
        if (!authProvider) {
          throw new Error(
            `cluster '${name}' has no auth provider configured; this must be specified via the 'authProvider' or 'authMetadata.${pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER}' parameter`
          );
        }
        const title = c.getOptionalString("title");
        const clusterDetails = {
          name,
          ...title && { title },
          url: c.getString("url"),
          skipTLSVerify: c.getOptionalBoolean("skipTLSVerify") ?? false,
          skipMetricsLookup: c.getOptionalBoolean("skipMetricsLookup") ?? false,
          caData: c.getOptionalString("caData"),
          caFile: c.getOptionalString("caFile"),
          authMetadata: {
            [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]: authProvider,
            ...ConfigClusterLocator.parseAuthMetadata(c),
            ...authMetadataBlock
          }
        };
        const customResources = c.getOptionalConfigArray("customResources");
        if (customResources) {
          clusterDetails.customResources = customResources.map((cr) => {
            return {
              group: cr.getString("group"),
              apiVersion: cr.getString("apiVersion"),
              plural: cr.getString("plural")
            };
          });
        }
        const dashboardUrl = c.getOptionalString("dashboardUrl");
        if (dashboardUrl) {
          clusterDetails.dashboardUrl = dashboardUrl;
        }
        const dashboardApp = c.getOptionalString("dashboardApp");
        if (dashboardApp) {
          clusterDetails.dashboardApp = dashboardApp;
        }
        if (c.has("dashboardParameters")) {
          clusterDetails.dashboardParameters = c.get("dashboardParameters");
        }
        const validationErrors = authStrategy.validateCluster(
          clusterDetails.authMetadata
        );
        if (validationErrors.length !== 0) {
          throw new Error(
            `Invalid cluster '${clusterDetails.name}': ${validationErrors.map((e) => e.message).join(", ")}`
          );
        }
        return clusterDetails;
      })
    );
  }
  static parseAuthMetadata(clusterConfig) {
    const serviceAccountToken = clusterConfig.getOptionalString(
      "serviceAccountToken"
    );
    const assumeRole = clusterConfig.getOptionalString("assumeRole");
    const externalId = clusterConfig.getOptionalString("externalId");
    const oidcTokenProvider = clusterConfig.getOptionalString("oidcTokenProvider");
    return serviceAccountToken || assumeRole || externalId || oidcTokenProvider ? {
      ...serviceAccountToken && { serviceAccountToken },
      ...assumeRole && {
        [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE]: assumeRole
      },
      ...externalId && {
        [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID]: externalId
      },
      ...oidcTokenProvider && {
        [pluginKubernetesCommon.ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER]: oidcTokenProvider
      }
    } : void 0;
  }
  async getClusters() {
    return this.clusterDetails;
  }
}

function runPeriodically(fn, delayMs) {
  let cancel;
  let cancelled = false;
  const cancellationPromise = new Promise((resolve) => {
    cancel = () => {
      resolve();
      cancelled = true;
    };
  });
  const startRefresh = async () => {
    while (!cancelled) {
      try {
        await fn();
      } catch {
      }
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, delayMs)),
        cancellationPromise
      ]);
    }
  };
  startRefresh();
  return cancel;
}

var name = "@backstage/plugin-kubernetes-backend";
var version = "0.18.3";
var description = "A Backstage backend plugin that integrates towards Kubernetes";
var backstage = {
	role: "backend-plugin",
	pluginId: "kubernetes",
	pluginPackages: [
		"@backstage/plugin-kubernetes",
		"@backstage/plugin-kubernetes-backend",
		"@backstage/plugin-kubernetes-common",
		"@backstage/plugin-kubernetes-node",
		"@backstage/plugin-kubernetes-react"
	]
};
var publishConfig = {
	access: "public"
};
var keywords = [
	"backstage",
	"kubernetes"
];
var homepage = "https://backstage.io";
var repository = {
	type: "git",
	url: "https://github.com/backstage/backstage",
	directory: "plugins/kubernetes-backend"
};
var license = "Apache-2.0";
var exports$1 = {
	".": "./src/index.ts",
	"./alpha": "./src/alpha.ts",
	"./package.json": "./package.json"
};
var main = "src/index.ts";
var types = "src/index.ts";
var typesVersions = {
	"*": {
		alpha: [
			"src/alpha.ts"
		],
		"package.json": [
			"package.json"
		]
	}
};
var files = [
	"dist",
	"config.d.ts"
];
var scripts = {
	build: "backstage-cli package build",
	clean: "backstage-cli package clean",
	lint: "backstage-cli package lint",
	prepack: "backstage-cli package prepack",
	postpack: "backstage-cli package postpack",
	start: "backstage-cli package start",
	test: "backstage-cli package test"
};
var dependencies = {
	"@aws-crypto/sha256-js": "^5.0.0",
	"@aws-sdk/credential-providers": "^3.350.0",
	"@aws-sdk/signature-v4": "^3.347.0",
	"@azure/identity": "^4.0.0",
	"@backstage/backend-common": "workspace:^",
	"@backstage/backend-plugin-api": "workspace:^",
	"@backstage/catalog-client": "workspace:^",
	"@backstage/catalog-model": "workspace:^",
	"@backstage/config": "workspace:^",
	"@backstage/errors": "workspace:^",
	"@backstage/integration-aws-node": "workspace:^",
	"@backstage/plugin-auth-node": "workspace:^",
	"@backstage/plugin-catalog-node": "workspace:^",
	"@backstage/plugin-kubernetes-common": "workspace:^",
	"@backstage/plugin-kubernetes-node": "workspace:^",
	"@backstage/plugin-permission-common": "workspace:^",
	"@backstage/plugin-permission-node": "workspace:^",
	"@backstage/types": "workspace:^",
	"@google-cloud/container": "^5.0.0",
	"@jest-mock/express": "^2.0.1",
	"@kubernetes/client-node": "0.20.0",
	"@types/express": "^4.17.6",
	"@types/http-proxy-middleware": "^1.0.0",
	"@types/luxon": "^3.0.0",
	compression: "^1.7.4",
	cors: "^2.8.5",
	express: "^4.17.1",
	"express-promise-router": "^4.1.0",
	"fs-extra": "^11.2.0",
	helmet: "^6.0.0",
	"http-proxy-middleware": "^2.0.6",
	lodash: "^4.17.21",
	luxon: "^3.0.0",
	morgan: "^1.10.0",
	"node-fetch": "^2.6.7",
	"stream-buffers": "^3.0.2",
	winston: "^3.2.1",
	yn: "^4.0.0"
};
var devDependencies = {
	"@backstage/backend-app-api": "workspace:^",
	"@backstage/backend-test-utils": "workspace:^",
	"@backstage/cli": "workspace:^",
	"@backstage/plugin-permission-backend": "workspace:^",
	"@backstage/plugin-permission-backend-module-allow-all-policy": "workspace:^",
	"@types/aws4": "^1.5.1",
	msw: "^1.0.0",
	supertest: "^6.1.3",
	ws: "^8.13.0"
};
var configSchema = "config.d.ts";
var packageinfo = {
	name: name,
	version: version,
	description: description,
	backstage: backstage,
	publishConfig: publishConfig,
	keywords: keywords,
	homepage: homepage,
	repository: repository,
	license: license,
	exports: exports$1,
	main: main,
	types: types,
	typesVersions: typesVersions,
	files: files,
	scripts: scripts,
	dependencies: dependencies,
	devDependencies: devDependencies,
	configSchema: configSchema
};

class GkeClusterLocator {
  constructor(options, client, clusterDetails = void 0, hasClusterDetails = false) {
    this.options = options;
    this.client = client;
    this.clusterDetails = clusterDetails;
    this.hasClusterDetails = hasClusterDetails;
  }
  static fromConfigWithClient(config, client, refreshInterval) {
    const matchingResourceLabels = config.getOptionalConfigArray("matchingResourceLabels")?.map((mrl) => {
      return { key: mrl.getString("key"), value: mrl.getString("value") };
    }) ?? [];
    const storeAuthProviderString = config.getOptionalString("authProvider") === "googleServiceAccount" ? "googleServiceAccount" : "google";
    const options = {
      projectId: config.getString("projectId"),
      authProvider: storeAuthProviderString,
      region: config.getOptionalString("region") ?? "-",
      skipTLSVerify: config.getOptionalBoolean("skipTLSVerify") ?? false,
      skipMetricsLookup: config.getOptionalBoolean("skipMetricsLookup") ?? false,
      exposeDashboard: config.getOptionalBoolean("exposeDashboard") ?? false,
      matchingResourceLabels
    };
    const gkeClusterLocator = new GkeClusterLocator(options, client);
    if (refreshInterval) {
      runPeriodically(
        () => gkeClusterLocator.refreshClusters(),
        refreshInterval.toMillis()
      );
    }
    return gkeClusterLocator;
  }
  // Added an `x-goog-api-client` header to API requests made by the GKE cluster locator to clearly identify API requests from this plugin.
  static fromConfig(config, refreshInterval = void 0) {
    return GkeClusterLocator.fromConfigWithClient(
      config,
      new container__namespace.v1.ClusterManagerClient({
        libName: `backstage/kubernetes-backend.GkeClusterLocator`,
        libVersion: packageinfo.version
      }),
      refreshInterval
    );
  }
  async getClusters() {
    if (!this.hasClusterDetails) {
      await this.refreshClusters();
    }
    return this.clusterDetails ?? [];
  }
  // TODO pass caData into the object
  async refreshClusters() {
    const {
      projectId,
      region,
      authProvider,
      skipTLSVerify,
      skipMetricsLookup,
      exposeDashboard,
      matchingResourceLabels
    } = this.options;
    const request = {
      parent: `projects/${projectId}/locations/${region}`
    };
    try {
      const [response] = await this.client.listClusters(request);
      this.clusterDetails = (response.clusters ?? []).filter((r) => {
        return matchingResourceLabels?.every((mrl) => {
          if (!r.resourceLabels) {
            return false;
          }
          return r.resourceLabels[mrl.key] === mrl.value;
        });
      }).map((r) => ({
        // TODO filter out clusters which don't have name or endpoint
        name: r.name ?? "unknown",
        url: `https://${r.endpoint ?? ""}`,
        authMetadata: { [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]: authProvider },
        skipTLSVerify,
        skipMetricsLookup,
        ...exposeDashboard ? {
          dashboardApp: "gke",
          dashboardParameters: {
            projectId,
            region,
            clusterName: r.name
          }
        } : {}
      }));
      this.hasClusterDetails = true;
    } catch (e) {
      throw new errors.ForwardedError(
        `There was an error retrieving clusters from GKE for projectId=${projectId} region=${region}`,
        e
      );
    }
  }
}

function isObject(obj) {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}
class CatalogClusterLocator {
  catalogClient;
  auth;
  constructor(catalogClient, auth) {
    this.catalogClient = catalogClient;
    this.auth = auth;
  }
  static fromConfig(catalogApi, auth) {
    return new CatalogClusterLocator(catalogApi, auth);
  }
  async getClusters(options) {
    const apiServerKey = `metadata.annotations.${pluginKubernetesCommon.ANNOTATION_KUBERNETES_API_SERVER}`;
    const apiServerCaKey = `metadata.annotations.${pluginKubernetesCommon.ANNOTATION_KUBERNETES_API_SERVER_CA}`;
    const authProviderKey = `metadata.annotations.${pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER}`;
    const filter = {
      kind: "Resource",
      "spec.type": "kubernetes-cluster",
      [apiServerKey]: catalogClient.CATALOG_FILTER_EXISTS,
      [apiServerCaKey]: catalogClient.CATALOG_FILTER_EXISTS,
      [authProviderKey]: catalogClient.CATALOG_FILTER_EXISTS
    };
    const clusters = await this.catalogClient.getEntities(
      {
        filter: [filter]
      },
      options?.credentials ? {
        token: (await this.auth.getPluginRequestToken({
          onBehalfOf: options.credentials,
          targetPluginId: "catalog"
        })).token
      } : void 0
    );
    return clusters.items.map((entity) => {
      const annotations = entity.metadata.annotations;
      const clusterDetails = {
        name: entity.metadata.name,
        title: entity.metadata.title,
        url: annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_API_SERVER],
        authMetadata: annotations,
        caData: annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_API_SERVER_CA],
        skipMetricsLookup: annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_SKIP_METRICS_LOOKUP] === "true",
        skipTLSVerify: annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_SKIP_TLS_VERIFY] === "true",
        dashboardUrl: annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_DASHBOARD_URL],
        dashboardApp: annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_DASHBOARD_APP],
        dashboardParameters: this.getDashboardParameters(annotations)
      };
      return clusterDetails;
    });
  }
  getDashboardParameters(annotations) {
    const dashboardParamsString = annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_DASHBOARD_PARAMETERS];
    if (dashboardParamsString) {
      try {
        const dashboardParams = JSON.parse(dashboardParamsString);
        return isObject(dashboardParams) ? dashboardParams : void 0;
      } catch {
        return void 0;
      }
    }
    return void 0;
  }
}

class LocalKubectlProxyClusterLocator {
  clusterDetails;
  // verbatim: when false, IPv4 addresses are placed before IPv6 addresses, ignoring the order from the DNS resolver
  // By default kubectl proxy listens on 127.0.0.1 instead of [::1]
  lookupPromise = dns__default.default.promises.lookup("localhost", { verbatim: false });
  constructor() {
    this.clusterDetails = [
      {
        name: "local",
        url: "http://localhost:8001",
        authMetadata: {
          [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]: "localKubectlProxy"
        },
        skipMetricsLookup: true
      }
    ];
  }
  async getClusters() {
    const lookupResolution = await this.lookupPromise;
    this.clusterDetails[0].url = `http://${lookupResolution.address}:8001`;
    return this.clusterDetails;
  }
}

class CombinedClustersSupplier {
  constructor(clusterSuppliers, logger) {
    this.clusterSuppliers = clusterSuppliers;
    this.logger = logger;
  }
  async getClusters(options) {
    const clusters = await Promise.all(
      this.clusterSuppliers.map((supplier) => supplier.getClusters(options))
    ).then((res) => {
      return res.flat();
    }).catch((e) => {
      throw e;
    });
    return this.warnDuplicates(clusters);
  }
  warnDuplicates(clusters) {
    const clusterNames = /* @__PURE__ */ new Set();
    const duplicatedNames = /* @__PURE__ */ new Set();
    for (const clusterName of clusters.map((c) => c.name)) {
      if (clusterNames.has(clusterName)) {
        duplicatedNames.add(clusterName);
      } else {
        clusterNames.add(clusterName);
      }
    }
    for (const clusterName of duplicatedNames) {
      this.logger.warn(`Duplicate cluster name '${clusterName}'`);
    }
    return clusters;
  }
}
const getCombinedClusterSupplier = (rootConfig, catalogClient, authStrategy, logger, refreshInterval = void 0, auth) => {
  const clusterSuppliers = rootConfig.getConfigArray("kubernetes.clusterLocatorMethods").map((clusterLocatorMethod) => {
    const type = clusterLocatorMethod.getString("type");
    switch (type) {
      case "catalog":
        return CatalogClusterLocator.fromConfig(catalogClient, auth);
      case "localKubectlProxy":
        return new LocalKubectlProxyClusterLocator();
      case "config":
        return ConfigClusterLocator.fromConfig(
          clusterLocatorMethod,
          authStrategy
        );
      case "gke":
        return GkeClusterLocator.fromConfig(
          clusterLocatorMethod,
          refreshInterval
        );
      default:
        throw new Error(
          `Unsupported kubernetes.clusterLocatorMethods: "${type}"`
        );
    }
  });
  return new CombinedClustersSupplier(clusterSuppliers, logger);
};

const addResourceRoutesToRouter = (router, catalogApi, objectsProvider, auth, httpAuth) => {
  const getEntityByReq = async (req) => {
    const rawEntityRef = req.body.entityRef;
    if (rawEntityRef && typeof rawEntityRef !== "string") {
      throw new errors.InputError(`entity query must be a string`);
    } else if (!rawEntityRef) {
      throw new errors.InputError("entity is a required field");
    }
    let entityRef = void 0;
    try {
      entityRef = catalogModel.parseEntityRef(rawEntityRef);
    } catch (error) {
      throw new errors.InputError(`Invalid entity ref, ${error}`);
    }
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: await httpAuth.credentials(req),
      targetPluginId: "catalog"
    });
    const entity = await catalogApi.getEntityByRef(entityRef, { token });
    if (!entity) {
      throw new errors.InputError(
        `Entity ref missing, ${catalogModel.stringifyEntityRef(entityRef)}`
      );
    }
    return entity;
  };
  router.post("/resources/workloads/query", async (req, res) => {
    const entity = await getEntityByReq(req);
    const response = await objectsProvider.getKubernetesObjectsByEntity(
      {
        entity,
        auth: req.body.auth
      },
      { credentials: await httpAuth.credentials(req) }
    );
    res.json(response);
  });
  router.post("/resources/custom/query", async (req, res) => {
    const entity = await getEntityByReq(req);
    if (!req.body.customResources) {
      throw new errors.InputError("customResources is a required field");
    } else if (!Array.isArray(req.body.customResources)) {
      throw new errors.InputError("customResources must be an array");
    } else if (req.body.customResources.length === 0) {
      throw new errors.InputError("at least 1 customResource is required");
    }
    const response = await objectsProvider.getCustomResourcesByEntity(
      {
        entity,
        customResources: req.body.customResources,
        auth: req.body.auth
      },
      { credentials: await httpAuth.credentials(req) }
    );
    res.json(response);
  });
};

class CatalogRelationServiceLocator {
  clusterSupplier;
  constructor(clusterSupplier) {
    this.clusterSupplier = clusterSupplier;
  }
  // As this implementation always returns all clusters serviceId is ignored here
  getClustersByEntity(entity, requestContext) {
    if (entity.relations && entity.relations.some(
      (r) => r.type === "dependsOn" && r.targetRef.includes("resource:")
    )) {
      return this.clusterSupplier.getClusters({ credentials: requestContext.credentials }).then((clusters) => {
        return {
          clusters: clusters.filter(
            (c) => this.doesEntityDependOnCluster(entity, c)
          )
        };
      });
    }
    return Promise.resolve({ clusters: [] });
  }
  doesEntityDependOnCluster(entity, cluster) {
    return entity.relations.some(
      (rel) => rel.type === "dependsOn" && rel.targetRef === `resource:${entity.metadata.namespace ?? "default"}/${cluster.name}`
    );
  }
}

class MultiTenantServiceLocator {
  clusterSupplier;
  constructor(clusterSupplier) {
    this.clusterSupplier = clusterSupplier;
  }
  // As this implementation always returns all clusters serviceId is ignored here
  getClustersByEntity(_entity, requestContext) {
    return this.clusterSupplier.getClusters({ credentials: requestContext.credentials }).then((clusters) => ({ clusters }));
  }
}

class SingleTenantServiceLocator {
  clusterSupplier;
  constructor(clusterSupplier) {
    this.clusterSupplier = clusterSupplier;
  }
  // As this implementation always returns all clusters serviceId is ignored here
  getClustersByEntity(_entity, requestContext) {
    return this.clusterSupplier.getClusters({ credentials: requestContext.credentials }).then((clusters) => {
      if (_entity.metadata?.annotations?.["backstage.io/kubernetes-cluster"]) {
        return {
          clusters: clusters.filter(
            (c) => c.name === _entity.metadata?.annotations?.["backstage.io/kubernetes-cluster"]
          )
        };
      }
      return { clusters };
    });
  }
}

const DEFAULT_OBJECTS = [
  {
    group: "",
    apiVersion: "v1",
    plural: "pods",
    objectType: "pods"
  },
  {
    group: "",
    apiVersion: "v1",
    plural: "services",
    objectType: "services"
  },
  {
    group: "",
    apiVersion: "v1",
    plural: "configmaps",
    objectType: "configmaps"
  },
  {
    group: "",
    apiVersion: "v1",
    plural: "limitranges",
    objectType: "limitranges"
  },
  {
    group: "",
    apiVersion: "v1",
    plural: "resourcequotas",
    objectType: "resourcequotas"
  },
  {
    group: "apps",
    apiVersion: "v1",
    plural: "deployments",
    objectType: "deployments"
  },
  {
    group: "apps",
    apiVersion: "v1",
    plural: "replicasets",
    objectType: "replicasets"
  },
  {
    group: "autoscaling",
    apiVersion: "v2",
    plural: "horizontalpodautoscalers",
    objectType: "horizontalpodautoscalers"
  },
  {
    group: "batch",
    apiVersion: "v1",
    plural: "jobs",
    objectType: "jobs"
  },
  {
    group: "batch",
    apiVersion: "v1",
    plural: "cronjobs",
    objectType: "cronjobs"
  },
  {
    group: "networking.k8s.io",
    apiVersion: "v1",
    plural: "ingresses",
    objectType: "ingresses"
  },
  {
    group: "apps",
    apiVersion: "v1",
    plural: "statefulsets",
    objectType: "statefulsets"
  },
  {
    group: "apps",
    apiVersion: "v1",
    plural: "daemonsets",
    objectType: "daemonsets"
  }
];
const isPodFetchResponse = (fr) => fr.type === "pods";
const isString = (str) => str !== void 0;
const numberOrBigIntToNumberOrString = (value) => {
  return typeof value === "bigint" ? value.toString() : value;
};
const toClientSafeResource = (current) => {
  return {
    currentUsage: numberOrBigIntToNumberOrString(current.CurrentUsage),
    requestTotal: numberOrBigIntToNumberOrString(current.RequestTotal),
    limitTotal: numberOrBigIntToNumberOrString(current.LimitTotal)
  };
};
const toClientSafeContainer = (container) => {
  return {
    container: container.Container,
    cpuUsage: toClientSafeResource(container.CPUUsage),
    memoryUsage: toClientSafeResource(container.MemoryUsage)
  };
};
const toClientSafePodMetrics = (podMetrics) => {
  return podMetrics.map((r) => r.resources).flat().map((pd) => {
    return {
      pod: pd.Pod,
      memory: toClientSafeResource(pd.Memory),
      cpu: toClientSafeResource(pd.CPU),
      containers: pd.Containers.map(toClientSafeContainer)
    };
  });
};
class KubernetesFanOutHandler {
  logger;
  fetcher;
  serviceLocator;
  customResources;
  objectTypesToFetch;
  authStrategy;
  constructor({
    logger,
    fetcher,
    serviceLocator,
    customResources,
    objectTypesToFetch = DEFAULT_OBJECTS,
    authStrategy
  }) {
    this.logger = logger;
    this.fetcher = fetcher;
    this.serviceLocator = serviceLocator;
    this.customResources = customResources;
    this.objectTypesToFetch = new Set(objectTypesToFetch);
    this.authStrategy = authStrategy;
  }
  async getCustomResourcesByEntity({ entity, auth, customResources }, options) {
    return this.fanOutRequests(
      entity,
      auth,
      { credentials: options.credentials },
      /* @__PURE__ */ new Set(),
      customResources
    );
  }
  async getKubernetesObjectsByEntity({ entity, auth }, options) {
    return this.fanOutRequests(
      entity,
      auth,
      {
        credentials: options.credentials
      },
      this.objectTypesToFetch
    );
  }
  async fanOutRequests(entity, auth, options, objectTypesToFetch, customResources) {
    const entityName = entity.metadata?.annotations?.["backstage.io/kubernetes-id"] || entity.metadata?.name;
    const { clusters } = await this.serviceLocator.getClustersByEntity(entity, {
      objectTypesToFetch,
      customResources: customResources ?? [],
      credentials: options.credentials
    });
    this.logger.info(
      `entity.metadata.name=${entityName} clusterDetails=[${clusters.map((c) => c.name).join(", ")}]`
    );
    const labelSelector = entity.metadata?.annotations?.["backstage.io/kubernetes-label-selector"] || `backstage.io/kubernetes-id=${entityName}`;
    const namespace = entity.metadata?.annotations?.["backstage.io/kubernetes-namespace"];
    return Promise.all(
      clusters.map(async (clusterDetails) => {
        const credential = await this.authStrategy.getCredential(
          clusterDetails,
          auth
        );
        return this.fetcher.fetchObjectsForService({
          serviceId: entityName,
          clusterDetails,
          credential,
          objectTypesToFetch,
          labelSelector,
          customResources: (customResources || clusterDetails.customResources || this.customResources).map((c) => ({
            ...c,
            objectType: "customresources"
          })),
          namespace
        }).then(
          (result) => this.getMetricsForPods(
            clusterDetails,
            credential,
            labelSelector,
            result
          )
        ).catch(
          (e) => e.name === "FetchError" ? Promise.resolve([
            {
              errors: [
                { errorType: "FETCH_ERROR", message: e.message }
              ],
              responses: []
            },
            []
          ]) : Promise.reject(e)
        ).then((r) => this.toClusterObjects(clusterDetails, r));
      })
    ).then(this.toObjectsByEntityResponse);
  }
  toObjectsByEntityResponse(clusterObjects) {
    return {
      items: clusterObjects.filter(
        (item) => item.errors !== void 0 && item.errors.length >= 1 || item.resources !== void 0 && item.resources.length >= 1 && item.resources.some((fr) => fr.resources?.length >= 1)
      )
    };
  }
  toClusterObjects(clusterDetails, [result, metrics]) {
    const objects = {
      cluster: {
        name: clusterDetails.name,
        ...clusterDetails.title && { title: clusterDetails.title }
      },
      podMetrics: toClientSafePodMetrics(metrics),
      resources: result.responses,
      errors: result.errors
    };
    if (clusterDetails.dashboardUrl) {
      objects.cluster.dashboardUrl = clusterDetails.dashboardUrl;
    }
    if (clusterDetails.dashboardApp) {
      objects.cluster.dashboardApp = clusterDetails.dashboardApp;
    }
    if (clusterDetails.dashboardParameters) {
      objects.cluster.dashboardParameters = clusterDetails.dashboardParameters;
    }
    return objects;
  }
  async getMetricsForPods(clusterDetails, credential, labelSelector, result) {
    if (clusterDetails.skipMetricsLookup) {
      return [result, []];
    }
    const namespaces = new Set(
      result.responses.filter(isPodFetchResponse).flatMap((r) => r.resources).map((p) => p.metadata?.namespace).filter(isString)
    );
    if (namespaces.size === 0) {
      return [result, []];
    }
    const podMetrics = await this.fetcher.fetchPodMetricsByNamespaces(
      clusterDetails,
      credential,
      namespaces,
      labelSelector
    );
    result.errors.push(...podMetrics.errors);
    return [result, podMetrics.responses];
  }
}

const isError = (fr) => fr.hasOwnProperty("errorType");
function fetchResultsToResponseWrapper(results) {
  const groupBy = lodash__default.default.groupBy(results, (value) => {
    return isError(value) ? "errors" : "responses";
  });
  return {
    errors: groupBy.errors ?? [],
    responses: groupBy.responses ?? []
  };
}
const statusCodeToErrorType = (statusCode) => {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED_ERROR";
    case 404:
      return "NOT_FOUND";
    case 500:
      return "SYSTEM_ERROR";
    default:
      return "UNKNOWN_ERROR";
  }
};
class KubernetesClientBasedFetcher {
  logger;
  constructor({ logger }) {
    this.logger = logger;
  }
  fetchObjectsForService(params) {
    const fetchResults = Array.from(params.objectTypesToFetch).concat(params.customResources).map(
      ({ objectType, group, apiVersion, plural }) => this.fetchResource(
        params.clusterDetails,
        params.credential,
        group,
        apiVersion,
        plural,
        params.namespace,
        params.labelSelector
      ).then(
        (r) => r.ok ? r.json().then(
          ({ kind, items }) => ({
            type: objectType,
            resources: objectType === "customresources" ? items.map((item) => ({
              ...item,
              kind: kind.replace(/(List)$/, "")
            })) : items
          })
        ) : this.handleUnsuccessfulResponse(params.clusterDetails.name, r)
      )
    );
    return Promise.all(fetchResults).then(fetchResultsToResponseWrapper);
  }
  fetchPodMetricsByNamespaces(clusterDetails, credential, namespaces, labelSelector) {
    const fetchResults = Array.from(namespaces).map(async (ns) => {
      const [podMetrics, podList] = await Promise.all([
        this.fetchResource(
          clusterDetails,
          credential,
          "metrics.k8s.io",
          "v1beta1",
          "pods",
          ns,
          labelSelector
        ),
        this.fetchResource(
          clusterDetails,
          credential,
          "",
          "v1",
          "pods",
          ns,
          labelSelector
        )
      ]);
      if (podMetrics.ok && podList.ok) {
        return clientNode$1.topPods(
          {
            listPodForAllNamespaces: () => podList.json().then((b) => ({ body: b }))
          },
          {
            getPodMetrics: () => podMetrics.json()
          }
        ).then(
          (resources) => ({
            type: "podstatus",
            resources
          })
        );
      } else if (podMetrics.ok) {
        return this.handleUnsuccessfulResponse(clusterDetails.name, podList);
      }
      return this.handleUnsuccessfulResponse(clusterDetails.name, podMetrics);
    });
    return Promise.all(fetchResults).then(fetchResultsToResponseWrapper);
  }
  async handleUnsuccessfulResponse(clusterName, res) {
    const resourcePath = new URL(res.url).pathname;
    this.logger.warn(
      `Received ${res.status} status when fetching "${resourcePath}" from cluster "${clusterName}"; body=[${await res.text()}]`
    );
    return {
      errorType: statusCodeToErrorType(res.status),
      statusCode: res.status,
      resourcePath
    };
  }
  fetchResource(clusterDetails, credential, group, apiVersion, plural, namespace, labelSelector) {
    const encode = (s) => encodeURIComponent(s);
    let resourcePath = group ? `/apis/${encode(group)}/${encode(apiVersion)}` : `/api/${encode(apiVersion)}`;
    if (namespace) {
      resourcePath += `/namespaces/${encode(namespace)}`;
    }
    resourcePath += `/${encode(plural)}`;
    let url;
    let requestInit;
    const authProvider = clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER];
    if (this.isServiceAccountAuthentication(authProvider, clusterDetails)) {
      [url, requestInit] = this.fetchArgsInCluster(credential);
    } else if (!this.isCredentialMissing(authProvider, credential)) {
      [url, requestInit] = this.fetchArgs(clusterDetails, credential);
    } else {
      return Promise.reject(
        new Error(
          `no bearer token or client cert for cluster '${clusterDetails.name}' and not running in Kubernetes`
        )
      );
    }
    if (url.pathname === "/") {
      url.pathname = resourcePath;
    } else {
      url.pathname += resourcePath;
    }
    if (labelSelector) {
      url.search = `labelSelector=${encode(labelSelector)}`;
    }
    return fetch__default$1.default(url, requestInit);
  }
  isServiceAccountAuthentication(authProvider, clusterDetails) {
    return authProvider === "serviceAccount" && !clusterDetails.authMetadata.serviceAccountToken && fs__default.default.pathExistsSync(clientNode$1.Config.SERVICEACCOUNT_CA_PATH);
  }
  isCredentialMissing(authProvider, credential) {
    return authProvider !== "localKubectlProxy" && credential.type === "anonymous";
  }
  fetchArgs(clusterDetails, credential) {
    const requestInit = {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...credential.type === "bearer token" && {
          Authorization: `Bearer ${credential.token}`
        }
      }
    };
    const url = new URL(clusterDetails.url);
    if (url.protocol === "https:") {
      requestInit.agent = new https__namespace$1.Agent({
        ca: clientNode$1.bufferFromFileOrString(
          clusterDetails.caFile,
          clusterDetails.caData
        ) ?? void 0,
        rejectUnauthorized: !clusterDetails.skipTLSVerify,
        ...credential.type === "x509 client certificate" && {
          cert: credential.cert,
          key: credential.key
        }
      });
    }
    return [url, requestInit];
  }
  fetchArgsInCluster(credential) {
    const requestInit = {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...credential.type === "bearer token" && {
          Authorization: `Bearer ${credential.token}`
        }
      }
    };
    const kc = new clientNode$1.KubeConfig();
    kc.loadFromCluster();
    const cluster = kc.getCurrentCluster();
    const url = new URL(cluster.server);
    if (url.protocol === "https:") {
      requestInit.agent = new https__namespace$1.Agent({
        ca: fs__default.default.readFileSync(cluster.caFile)
      });
    }
    return [url, requestInit];
  }
}

const HEADER_KUBERNETES_CLUSTER = "Backstage-Kubernetes-Cluster";
const HEADER_KUBERNETES_AUTH = "Backstage-Kubernetes-Authorization";
class KubernetesProxy {
  middlewareForClusterName = /* @__PURE__ */ new Map();
  logger;
  clusterSupplier;
  authStrategy;
  httpAuth;
  constructor(options) {
    this.logger = options.logger;
    this.clusterSupplier = options.clusterSupplier;
    this.authStrategy = options.authStrategy;
    const legacy = backendCommon.createLegacyAuthAdapters({
      discovery: options.discovery,
      httpAuth: options.httpAuth
    });
    this.httpAuth = legacy.httpAuth;
  }
  createRequestHandler(options) {
    const { permissionApi } = options;
    return async (req, res, next) => {
      const authorizeResponse = await permissionApi.authorize(
        [{ permission: pluginKubernetesCommon.kubernetesProxyPermission }],
        {
          credentials: await this.httpAuth.credentials(req)
        }
      );
      const auth = authorizeResponse[0];
      if (auth.result === pluginPermissionCommon.AuthorizeResult.DENY) {
        res.status(403).json({ error: new errors.NotAllowedError("Unauthorized") });
        return;
      }
      const middleware = await this.getMiddleware(req);
      if (req.header("connection")?.toLowerCase() === "upgrade" && req.header("upgrade")?.toLowerCase() === "websocket") {
        middleware.upgrade(req, req.socket, void 0);
      } else {
        middleware(req, res, next);
      }
    };
  }
  // We create one middleware per remote cluster and hold on to them, because
  // the secure property isn't possible to decide on a per-request basis with a
  // single middleware instance - and we don't expect it to change over time.
  async getMiddleware(originalReq) {
    const originalCluster = await this.getClusterForRequest(originalReq);
    let middleware = this.middlewareForClusterName.get(originalCluster.name);
    if (!middleware) {
      const logger = this.logger.child({ cluster: originalCluster.name });
      middleware = httpProxyMiddleware.createProxyMiddleware({
        // TODO: Add 'log' to LoggerService
        logProvider: () => backendCommon.loggerToWinstonLogger(logger),
        ws: true,
        secure: !originalCluster.skipTLSVerify,
        changeOrigin: true,
        pathRewrite: async (path, req) => {
          const cluster = await this.getClusterForRequest(req);
          const url = new URL(cluster.url);
          return path.replace(
            new RegExp(`^${originalReq.baseUrl}`),
            url.pathname || ""
          );
        },
        router: async (req) => {
          const cluster = await this.getClusterForRequest(req);
          const url = new URL(cluster.url);
          const target = {
            protocol: url.protocol,
            host: url.hostname,
            port: url.port,
            ca: clientNode$1.bufferFromFileOrString(
              cluster.caFile,
              cluster.caData
            )?.toString()
          };
          const authHeader = req.headers[HEADER_KUBERNETES_AUTH.toLocaleLowerCase("en-US")];
          if (typeof authHeader === "string") {
            req.headers.authorization = authHeader;
          } else {
            const authObj = KubernetesProxy.authHeadersToKubernetesRequestAuth(
              req.headers
            );
            const credential = await this.getClusterForRequest(req).then((cd) => {
              return this.authStrategy.getCredential(cd, authObj);
            });
            if (credential.type === "bearer token") {
              req.headers.authorization = `Bearer ${credential.token}`;
            } else if (credential.type === "x509 client certificate") {
              target.key = credential.key;
              target.cert = credential.cert;
            }
          }
          return target;
        },
        onError: (error, req, res) => {
          const wrappedError = new errors.ForwardedError(
            `Cluster '${originalCluster.name}' request error`,
            error
          );
          logger.error("Kubernetes proxy error", wrappedError);
          const body = {
            error: errors.serializeError(wrappedError, {
              includeStack: process.env.NODE_ENV === "development"
            }),
            request: { method: req.method, url: req.originalUrl },
            response: { statusCode: 500 }
          };
          res.status(500).json(body);
        }
      });
      this.middlewareForClusterName.set(originalCluster.name, middleware);
    }
    return middleware;
  }
  async getClusterForRequest(req) {
    const clusterName = req.headers[HEADER_KUBERNETES_CLUSTER.toLowerCase()];
    const clusters = await this.clusterSupplier.getClusters({
      credentials: await this.httpAuth.credentials(req)
    });
    if (!clusters || clusters.length <= 0) {
      throw new errors.NotFoundError(`No Clusters configured`);
    }
    const hasClusterNameHeader = typeof clusterName === "string" && clusterName.length > 0;
    let cluster;
    if (hasClusterNameHeader) {
      cluster = clusters.find((c) => c.name === clusterName);
    } else if (clusters.length === 1) {
      cluster = clusters.at(0);
    }
    if (!cluster) {
      throw new errors.NotFoundError(`Cluster '${clusterName}' not found`);
    }
    const authProvider = cluster.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER];
    if (authProvider === "serviceAccount" && fs__default.default.pathExistsSync(clientNode$1.Config.SERVICEACCOUNT_CA_PATH) && !cluster.authMetadata.serviceAccountToken) {
      const kc = new clientNode$1.KubeConfig();
      kc.loadFromCluster();
      const clusterFromKubeConfig = kc.getCurrentCluster();
      const url = new URL(clusterFromKubeConfig.server);
      cluster.url = clusterFromKubeConfig.server;
      if (url.protocol === "https:") {
        cluster.caFile = clusterFromKubeConfig.caFile;
      }
    }
    return cluster;
  }
  static authHeadersToKubernetesRequestAuth(originalHeaders) {
    return Object.keys(originalHeaders).filter((header) => header.startsWith("backstage-kubernetes-authorization")).map(
      (header) => KubernetesProxy.headerToDictionary(header, originalHeaders)
    ).filter((headerAsDic) => Object.keys(headerAsDic).length !== 0).reduce(KubernetesProxy.combineHeaders, {});
  }
  static headerToDictionary(header, originalHeaders) {
    const obj = {};
    const headerSplitted = header.split("-");
    if (headerSplitted.length >= 4) {
      const framework = headerSplitted[3].toLowerCase();
      if (headerSplitted.length >= 5) {
        const provider = headerSplitted.slice(4).join("-").toLowerCase();
        obj[framework] = { [provider]: originalHeaders[header] };
      } else {
        obj[framework] = originalHeaders[header];
      }
    }
    return obj;
  }
  static combineHeaders(authObj, header) {
    const framework = Object.keys(header)[0];
    if (authObj[framework]) {
      authObj[framework] = {
        ...authObj[framework],
        ...header[framework]
      };
    } else {
      authObj[framework] = header[framework];
    }
    return authObj;
  }
}

class KubernetesBuilder {
  constructor(env) {
    this.env = env;
  }
  clusterSupplier;
  defaultClusterRefreshInterval = luxon.Duration.fromObject({
    minutes: 60
  });
  objectsProvider;
  fetcher;
  serviceLocator;
  proxy;
  authStrategyMap;
  static createBuilder(env) {
    return new KubernetesBuilder(env);
  }
  async build() {
    const logger = this.env.logger;
    const config = this.env.config;
    const permissions = this.env.permissions;
    logger.info("Initializing Kubernetes backend");
    if (!config.has("kubernetes")) {
      if (process.env.NODE_ENV !== "development") {
        throw new Error("Kubernetes configuration is missing");
      }
      logger.warn(
        "Failed to initialize kubernetes backend: kubernetes config is missing"
      );
      return {
        router: Router__default.default()
      };
    }
    const { auth, httpAuth } = backendCommon.createLegacyAuthAdapters({
      auth: this.env.auth,
      httpAuth: this.env.httpAuth,
      discovery: this.env.discovery
    });
    const customResources = this.buildCustomResources();
    const fetcher = this.getFetcher();
    const clusterSupplier = this.getClusterSupplier();
    const authStrategyMap = this.getAuthStrategyMap();
    const proxy = this.getProxy(
      logger,
      clusterSupplier,
      this.env.discovery,
      httpAuth
    );
    const serviceLocator = this.getServiceLocator();
    const objectsProvider = this.getObjectsProvider({
      logger,
      fetcher,
      config,
      serviceLocator,
      customResources,
      objectTypesToFetch: this.getObjectTypesToFetch()
    });
    const router = this.buildRouter(
      objectsProvider,
      clusterSupplier,
      this.env.catalogApi,
      proxy,
      permissions,
      auth,
      httpAuth
    );
    return {
      clusterSupplier,
      customResources,
      fetcher,
      proxy,
      objectsProvider,
      router,
      serviceLocator,
      authStrategyMap
    };
  }
  setClusterSupplier(clusterSupplier) {
    this.clusterSupplier = clusterSupplier;
    return this;
  }
  setDefaultClusterRefreshInterval(refreshInterval) {
    this.defaultClusterRefreshInterval = refreshInterval;
    return this;
  }
  setObjectsProvider(objectsProvider) {
    this.objectsProvider = objectsProvider;
    return this;
  }
  setFetcher(fetcher) {
    this.fetcher = fetcher;
    return this;
  }
  setServiceLocator(serviceLocator) {
    this.serviceLocator = serviceLocator;
    return this;
  }
  setProxy(proxy) {
    this.proxy = proxy;
    return this;
  }
  setAuthStrategyMap(authStrategyMap) {
    this.authStrategyMap = authStrategyMap;
  }
  addAuthStrategy(key, strategy) {
    if (key.includes("-")) {
      throw new Error("Strategy name can not include dashes");
    }
    this.getAuthStrategyMap()[key] = strategy;
    return this;
  }
  buildCustomResources() {
    const customResources = (this.env.config.getOptionalConfigArray("kubernetes.customResources") ?? []).map(
      (c) => ({
        group: c.getString("group"),
        apiVersion: c.getString("apiVersion"),
        plural: c.getString("plural"),
        objectType: "customresources"
      })
    );
    this.env.logger.info(
      `action=LoadingCustomResources numOfCustomResources=${customResources.length}`
    );
    return customResources;
  }
  buildClusterSupplier(refreshInterval) {
    const config = this.env.config;
    const { auth } = backendCommon.createLegacyAuthAdapters(this.env);
    this.clusterSupplier = getCombinedClusterSupplier(
      config,
      this.env.catalogApi,
      new DispatchStrategy({ authStrategyMap: this.getAuthStrategyMap() }),
      this.env.logger,
      refreshInterval,
      auth
    );
    return this.clusterSupplier;
  }
  buildObjectsProvider(options) {
    const authStrategyMap = this.getAuthStrategyMap();
    this.objectsProvider = new KubernetesFanOutHandler({
      ...options,
      authStrategy: new DispatchStrategy({
        authStrategyMap
      })
    });
    return this.objectsProvider;
  }
  buildFetcher() {
    this.fetcher = new KubernetesClientBasedFetcher({
      logger: this.env.logger
    });
    return this.fetcher;
  }
  buildServiceLocator(method, clusterSupplier) {
    switch (method) {
      case "multiTenant":
        this.serviceLocator = this.buildMultiTenantServiceLocator(clusterSupplier);
        break;
      case "singleTenant":
        this.serviceLocator = this.buildSingleTenantServiceLocator(clusterSupplier);
        break;
      case "catalogRelation":
        this.serviceLocator = this.buildCatalogRelationServiceLocator(clusterSupplier);
        break;
      case "http":
        this.serviceLocator = this.buildHttpServiceLocator(clusterSupplier);
        break;
      default:
        throw new Error(
          `Unsupported kubernetes.serviceLocatorMethod "${method}"`
        );
    }
    return this.serviceLocator;
  }
  buildMultiTenantServiceLocator(clusterSupplier) {
    return new MultiTenantServiceLocator(clusterSupplier);
  }
  buildSingleTenantServiceLocator(clusterSupplier) {
    return new SingleTenantServiceLocator(clusterSupplier);
  }
  buildCatalogRelationServiceLocator(clusterSupplier) {
    return new CatalogRelationServiceLocator(clusterSupplier);
  }
  buildHttpServiceLocator(_clusterSupplier) {
    throw new Error("not implemented");
  }
  buildProxy(logger, clusterSupplier, discovery, httpAuth) {
    const authStrategyMap = this.getAuthStrategyMap();
    const authStrategy = new DispatchStrategy({
      authStrategyMap
    });
    this.proxy = new KubernetesProxy({
      logger,
      clusterSupplier,
      authStrategy,
      discovery,
      httpAuth
    });
    return this.proxy;
  }
  buildRouter(objectsProvider, clusterSupplier, catalogApi, proxy, permissionApi, authService, httpAuth) {
    const logger = this.env.logger;
    const router = Router__default.default();
    router.use("/proxy", proxy.createRequestHandler({ permissionApi }));
    router.use(express__default.default.json());
    router.use(
      pluginPermissionNode.createPermissionIntegrationRouter({
        permissions: pluginKubernetesCommon.kubernetesPermissions
      })
    );
    router.post("/services/:serviceId", async (req, res) => {
      const serviceId = req.params.serviceId;
      const requestBody = req.body;
      try {
        const response = await objectsProvider.getKubernetesObjectsByEntity(
          {
            entity: requestBody.entity,
            auth: requestBody.auth || {}
          },
          { credentials: await httpAuth.credentials(req) }
        );
        res.json(response);
      } catch (e) {
        logger.error(
          `action=retrieveObjectsByServiceId service=${serviceId}, error=${e}`
        );
        res.status(500).json({ error: e.message });
      }
    });
    router.get("/clusters", async (req, res) => {
      const credentials = await httpAuth.credentials(req);
      const clusterDetails = await this.fetchClusterDetails(clusterSupplier, {
        credentials
      });
      res.json({
        items: clusterDetails.map((cd) => {
          const oidcTokenProvider = cd.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER];
          const authProvider = cd.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER];
          const strategy = this.getAuthStrategyMap()[authProvider];
          let auth = {};
          if (strategy) {
            auth = strategy.presentAuthMetadata(cd.authMetadata);
          }
          return {
            name: cd.name,
            title: cd.title,
            dashboardUrl: cd.dashboardUrl,
            authProvider,
            ...oidcTokenProvider && { oidcTokenProvider },
            ...auth && Object.keys(auth).length !== 0 && { auth }
          };
        })
      });
    });
    addResourceRoutesToRouter(
      router,
      catalogApi,
      objectsProvider,
      authService,
      httpAuth
    );
    return router;
  }
  buildAuthStrategyMap() {
    this.authStrategyMap = {
      aks: new AksStrategy(),
      aws: new AwsIamStrategy({ config: this.env.config }),
      azure: new AzureIdentityStrategy(this.env.logger),
      google: new GoogleStrategy(),
      googleServiceAccount: new GoogleServiceAccountStrategy(),
      localKubectlProxy: new AnonymousStrategy(),
      oidc: new OidcStrategy(),
      serviceAccount: new ServiceAccountStrategy()
    };
    return this.authStrategyMap;
  }
  async fetchClusterDetails(clusterSupplier, options) {
    const clusterDetails = await clusterSupplier.getClusters(options);
    this.env.logger.info(
      `action=loadClusterDetails numOfClustersLoaded=${clusterDetails.length}`
    );
    return clusterDetails;
  }
  getServiceLocatorMethod() {
    return this.env.config.getString(
      "kubernetes.serviceLocatorMethod.type"
    );
  }
  getFetcher() {
    return this.fetcher ?? this.buildFetcher();
  }
  getClusterSupplier() {
    return this.clusterSupplier ?? this.buildClusterSupplier(this.defaultClusterRefreshInterval);
  }
  getServiceLocator() {
    return this.serviceLocator ?? this.buildServiceLocator(
      this.getServiceLocatorMethod(),
      this.getClusterSupplier()
    );
  }
  getObjectsProvider(options) {
    return this.objectsProvider ?? this.buildObjectsProvider(options);
  }
  getObjectTypesToFetch() {
    const objectTypesToFetchStrings = this.env.config.getOptionalStringArray(
      "kubernetes.objectTypes"
    );
    const apiVersionOverrides = this.env.config.getOptionalConfig(
      "kubernetes.apiVersionOverrides"
    );
    let objectTypesToFetch;
    if (objectTypesToFetchStrings) {
      objectTypesToFetch = DEFAULT_OBJECTS.filter(
        (obj) => objectTypesToFetchStrings.includes(obj.objectType)
      );
    }
    if (apiVersionOverrides) {
      objectTypesToFetch = objectTypesToFetch ?? DEFAULT_OBJECTS;
      for (const obj of objectTypesToFetch) {
        if (apiVersionOverrides.has(obj.objectType)) {
          obj.apiVersion = apiVersionOverrides.getString(obj.objectType);
        }
      }
    }
    return objectTypesToFetch;
  }
  getProxy(logger, clusterSupplier, discovery, httpAuth) {
    return this.proxy ?? this.buildProxy(logger, clusterSupplier, discovery, httpAuth);
  }
  getAuthStrategyMap() {
    return this.authStrategyMap ?? this.buildAuthStrategyMap();
  }
}

async function createRouter(options) {
  const { router } = await KubernetesBuilder.createBuilder(options).setClusterSupplier(options.clusterSupplier).build();
  return router;
}

index_cjs$1.AksStrategy = AksStrategy;
index_cjs$1.AnonymousStrategy = AnonymousStrategy;
index_cjs$1.AwsIamStrategy = AwsIamStrategy;
index_cjs$1.AzureIdentityStrategy = AzureIdentityStrategy;
index_cjs$1.DEFAULT_OBJECTS = DEFAULT_OBJECTS;
index_cjs$1.DispatchStrategy = DispatchStrategy;
index_cjs$1.GoogleServiceAccountStrategy = GoogleServiceAccountStrategy;
index_cjs$1.GoogleStrategy = GoogleStrategy;
index_cjs$1.HEADER_KUBERNETES_AUTH = HEADER_KUBERNETES_AUTH;
index_cjs$1.HEADER_KUBERNETES_CLUSTER = HEADER_KUBERNETES_CLUSTER;
index_cjs$1.KubernetesBuilder = KubernetesBuilder;
index_cjs$1.KubernetesProxy = KubernetesProxy;
index_cjs$1.OidcStrategy = OidcStrategy;
index_cjs$1.ServiceAccountStrategy = ServiceAccountStrategy;
index_cjs$1.createRouter = createRouter;

var index_cjs = {};

var backendPluginApi$1 = require$$0$1;
var https = require$$20;
var clientNode = require$$7;
var fetch = require$$19;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var https__namespace = /*#__PURE__*/_interopNamespaceCompat(https);
var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

const kubernetesObjectsProviderExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "kubernetes.objects-provider"
});
const kubernetesClusterSupplierExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "kubernetes.cluster-supplier"
});
const kubernetesAuthStrategyExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "kubernetes.auth-strategy"
});
const kubernetesFetcherExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "kubernetes.fetcher"
});
const kubernetesServiceLocatorExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "kubernetes.service-locator"
});

class PinnipedHelper {
  constructor(logger) {
    this.logger = logger;
  }
  async tokenCredentialRequest(clusterDetails, pinnipedParams) {
    this.logger.debug("Pinniped: Requesting client Certs to Concierge");
    return await this.exchangeClusterTokentoClientCerts(
      clusterDetails,
      pinnipedParams
    );
  }
  async exchangeClusterTokentoClientCerts(clusterDetails, pinnipedParams) {
    const url = new URL(clusterDetails.url);
    const apiGroup = pinnipedParams.tokenCredentialRequest?.apiGroup ?? "login.concierge.pinniped.dev/v1alpha1";
    url.pathname = `/apis/${apiGroup}/tokencredentialrequests`;
    const requestInit = this.buildRequestForPinniped(
      url,
      clusterDetails,
      pinnipedParams
    );
    this.logger.info(
      "Fetching client certs for mTLS authentication on Pinniped"
    );
    let response;
    try {
      response = await fetch__default.default(url, requestInit);
    } catch (error) {
      this.logger.error("Pinniped request error", error);
      throw error;
    }
    const data = await response.json();
    if (data.status.credential) {
      const result = {
        key: data.status.credential.clientKeyData,
        cert: data.status.credential.clientCertificateData,
        expirationTimestamp: data.status.credential.expirationTimestamp
      };
      return Promise.resolve(result);
    }
    this.logger.error("Unable to fetch client certs,", data.status);
    return Promise.reject(data.status.message);
  }
  buildRequestForPinniped(url, clusterDetails, pinnipedParams) {
    const body = {
      apiVersion: pinnipedParams.tokenCredentialRequest?.apiGroup ?? "login.concierge.pinniped.dev/v1alpha1",
      kind: "TokenCredentialRequest",
      spec: {
        authenticator: pinnipedParams.authenticator,
        token: pinnipedParams.clusterScopedIdToken
      }
    };
    const requestInit = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    };
    if (url.protocol === "https:") {
      requestInit.agent = new https__namespace.Agent({
        ca: clientNode.bufferFromFileOrString(
          clusterDetails.caFile,
          clusterDetails.caData
        ) ?? void 0,
        rejectUnauthorized: !clusterDetails.skipTLSVerify
      });
    }
    return requestInit;
  }
}

index_cjs.PinnipedHelper = PinnipedHelper;
index_cjs.kubernetesAuthStrategyExtensionPoint = kubernetesAuthStrategyExtensionPoint;
index_cjs.kubernetesClusterSupplierExtensionPoint = kubernetesClusterSupplierExtensionPoint;
index_cjs.kubernetesFetcherExtensionPoint = kubernetesFetcherExtensionPoint;
index_cjs.kubernetesObjectsProviderExtensionPoint = kubernetesObjectsProviderExtensionPoint;
index_cjs.kubernetesServiceLocatorExtensionPoint = kubernetesServiceLocatorExtensionPoint;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0$1;
var alpha = require$$1$1;
var pluginKubernetesBackend = index_cjs$1;
var pluginKubernetesNode = index_cjs;

class ObjectsProvider {
  objectsProvider;
  getObjectsProvider() {
    return this.objectsProvider;
  }
  addObjectsProvider(provider) {
    if (this.objectsProvider) {
      throw new Error(
        "Multiple Kubernetes objects provider is not supported at this time"
      );
    }
    this.objectsProvider = provider;
  }
}
class ClusterSuplier {
  clusterSupplier;
  getClusterSupplier() {
    return this.clusterSupplier;
  }
  addClusterSupplier(clusterSupplier) {
    if (this.clusterSupplier) {
      throw new Error(
        "Multiple Kubernetes Cluster Suppliers is not supported at this time"
      );
    }
    this.clusterSupplier = clusterSupplier;
  }
}
class Fetcher {
  fetcher;
  getFetcher() {
    return this.fetcher;
  }
  addFetcher(fetcher) {
    if (this.fetcher) {
      throw new Error(
        "Multiple Kubernetes Fetchers is not supported at this time"
      );
    }
    this.fetcher = fetcher;
  }
}
class ServiceLocator {
  serviceLocator;
  getServiceLocator() {
    return this.serviceLocator;
  }
  addServiceLocator(serviceLocator) {
    if (this.serviceLocator) {
      throw new Error(
        "Multiple Kubernetes Service Locators is not supported at this time"
      );
    }
    this.serviceLocator = serviceLocator;
  }
}
class AuthStrategy {
  authStrategies;
  constructor() {
    this.authStrategies = new Array();
  }
  static addAuthStrategiesFromArray(authStrategies, builder) {
    authStrategies.forEach((st) => builder.addAuthStrategy(st.key, st.strategy));
  }
  getAuthenticationStrategies() {
    return this.authStrategies;
  }
  addAuthStrategy(key, authStrategy) {
    this.authStrategies.push({ key, strategy: authStrategy });
  }
}
const kubernetesPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "kubernetes",
  register(env) {
    const extPointObjectsProvider = new ObjectsProvider();
    const extPointClusterSuplier = new ClusterSuplier();
    const extPointAuthStrategy = new AuthStrategy();
    const extPointFetcher = new Fetcher();
    const extPointServiceLocator = new ServiceLocator();
    env.registerExtensionPoint(
      pluginKubernetesNode.kubernetesObjectsProviderExtensionPoint,
      extPointObjectsProvider
    );
    env.registerExtensionPoint(
      pluginKubernetesNode.kubernetesClusterSupplierExtensionPoint,
      extPointClusterSuplier
    );
    env.registerExtensionPoint(
      pluginKubernetesNode.kubernetesAuthStrategyExtensionPoint,
      extPointAuthStrategy
    );
    env.registerExtensionPoint(
      pluginKubernetesNode.kubernetesFetcherExtensionPoint,
      extPointFetcher
    );
    env.registerExtensionPoint(
      pluginKubernetesNode.kubernetesServiceLocatorExtensionPoint,
      extPointServiceLocator
    );
    env.registerInit({
      deps: {
        http: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        discovery: backendPluginApi.coreServices.discovery,
        catalogApi: alpha.catalogServiceRef,
        permissions: backendPluginApi.coreServices.permissions,
        auth: backendPluginApi.coreServices.auth,
        httpAuth: backendPluginApi.coreServices.httpAuth
      },
      async init({
        http,
        logger,
        config,
        discovery,
        catalogApi,
        permissions,
        auth,
        httpAuth
      }) {
        const builder = pluginKubernetesBackend.KubernetesBuilder.createBuilder({
          logger,
          config,
          catalogApi,
          permissions,
          discovery,
          auth,
          httpAuth
        }).setObjectsProvider(extPointObjectsProvider.getObjectsProvider()).setClusterSupplier(extPointClusterSuplier.getClusterSupplier()).setFetcher(extPointFetcher.getFetcher()).setServiceLocator(extPointServiceLocator.getServiceLocator());
        AuthStrategy.addAuthStrategiesFromArray(
          extPointAuthStrategy.getAuthenticationStrategies(),
          builder
        );
        const { router } = await builder.build();
        http.use(router);
      }
    });
  }
});

var _default = alpha_cjs.default = kubernetesPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
