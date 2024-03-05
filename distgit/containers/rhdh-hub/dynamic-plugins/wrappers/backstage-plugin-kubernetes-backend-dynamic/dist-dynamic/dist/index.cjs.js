'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$2 = require('@backstage/backend-common');
var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$2$1 = require('@backstage/plugin-catalog-node/alpha');
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
var require$$16 = require('@backstage/catalog-model');
var require$$17 = require('@backstage/plugin-auth-node');
var require$$19 = require('node-fetch');
var require$$20 = require('https');
var require$$22 = require('http-proxy-middleware');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

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

var alpha_cjs$1 = {};

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
      statefulsets: []
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (containerStatus.ready || ((_b = (_a = containerStatus.state) == null ? void 0 : _a.running) == null ? void 0 : _b.startedAt) === void 0 || !container.readinessProbe) {
    return false;
  }
  const startDateTime = require$$12.DateTime.fromISO(
    (_d = (_c = containerStatus.state) == null ? void 0 : _c.running) == null ? void 0 : _d.startedAt
  ).plus({
    seconds: (_f = (_e = container.readinessProbe) == null ? void 0 : _e.initialDelaySeconds) != null ? _f : 0
  }).plus({
    seconds: ((_h = (_g = container.readinessProbe) == null ? void 0 : _g.periodSeconds) != null ? _h : 0) * ((_j = (_i = container.readinessProbe) == null ? void 0 : _i.failureThreshold) != null ? _j : 0)
  });
  return startDateTime < require$$12.DateTime.now();
}
const podToContainerSpecsAndStatuses = (pod) => {
  var _a, _b, _c, _d;
  const specs = lodash$1.groupBy((_b = (_a = pod.spec) == null ? void 0 : _a.containers) != null ? _b : [], (value) => value.name);
  const result = [];
  for (const cs of (_d = (_c = pod.status) == null ? void 0 : _c.containerStatuses) != null ? _d : []) {
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
  var _a, _b, _c, _d;
  const firstUnreadyContainerStatus = (_b = (_a = pod.status) == null ? void 0 : _a.containerStatuses) == null ? void 0 : _b.find(
    (cs) => {
      return cs.ready === false;
    }
  );
  return {
    errorType: "ReadinessProbeFailed",
    rootCauseExplanation: `The container ${firstUnreadyContainerStatus == null ? void 0 : firstUnreadyContainerStatus.name} failed to start properly, but is not crashing`,
    actions: [
      "Ensure that the container starts correctly locally",
      "Check the container's logs looking for error during startup"
    ],
    type: "events",
    podName: (_d = (_c = pod.metadata) == null ? void 0 : _c.name) != null ? _d : ""
  };
};
const restartingPodProposedFixes = (pod) => {
  var _a, _b, _c;
  const lastTerminatedCs = ((_b = (_a = pod.status) == null ? void 0 : _a.containerStatuses) != null ? _b : []).find(
    (cs) => {
      var _a2;
      return ((_a2 = cs.lastState) == null ? void 0 : _a2.terminated) !== void 0;
    }
  );
  const lastTerminated = (_c = lastTerminatedCs == null ? void 0 : lastTerminatedCs.lastState) == null ? void 0 : _c.terminated;
  if (!lastTerminated) {
    return void 0;
  }
  switch (lastTerminated == null ? void 0 : lastTerminated.reason) {
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
  var _a, _b, _c, _d, _e;
  const waitingCs = ((_b = (_a = pod.status) == null ? void 0 : _a.containerStatuses) != null ? _b : []).find(
    (cs) => {
      var _a2;
      return ((_a2 = cs.state) == null ? void 0 : _a2.waiting) !== void 0;
    }
  );
  const waiting = ((_d = (_c = pod.status) == null ? void 0 : _c.containerStatuses) != null ? _d : []).map((cs) => {
    var _a2;
    return (_a2 = cs.state) == null ? void 0 : _a2.waiting;
  }).find((w) => (w == null ? void 0 : w.reason) !== void 0);
  switch (waiting == null ? void 0 : waiting.reason) {
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
        rootCauseExplanation: `The container ${waitingCs == null ? void 0 : waitingCs.name} has crashed many times, it will be exponentially restarted until it stops crashing`,
        actions: ["Check the crash logs for stacktraces"],
        type: "logs",
        container: (_e = waitingCs == null ? void 0 : waitingCs.name) != null ? _e : "unknown"
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
      return podToContainerSpecsAndStatuses(pod).filter(isPodReadinessProbeUnready).map((cs) => {
        var _a, _b, _c, _d;
        return {
          type: "readiness-probe-taking-too-long",
          message: `The container ${cs.container.name} failed to start properly, but is not crashing`,
          severity: 4,
          proposedFix: readinessProbeProposedFixes(pod),
          sourceRef: {
            name: (_b = (_a = pod.metadata) == null ? void 0 : _a.name) != null ? _b : "unknown pod",
            namespace: (_d = (_c = pod.metadata) == null ? void 0 : _c.namespace) != null ? _d : "unknown namespace",
            kind: "Pod",
            apiGroup: "v1"
          },
          occurrenceCount: 1
        };
      });
    }
  },
  {
    detectErrors: (pod) => {
      var _a, _b;
      return ((_b = (_a = pod.status) == null ? void 0 : _a.containerStatuses) != null ? _b : []).filter((cs) => {
        var _a2, _b2;
        return ((_b2 = (_a2 = cs.state) == null ? void 0 : _a2.waiting) == null ? void 0 : _b2.message) !== void 0;
      }).map((cs) => {
        var _a2, _b2, _c, _d, _e, _f, _g;
        return {
          type: "container-waiting",
          message: (_c = (_b2 = (_a2 = cs.state) == null ? void 0 : _a2.waiting) == null ? void 0 : _b2.message) != null ? _c : "container waiting",
          severity: 4,
          proposedFix: waitingProposedFix(pod),
          sourceRef: {
            name: (_e = (_d = pod.metadata) == null ? void 0 : _d.name) != null ? _e : "unknown pod",
            namespace: (_g = (_f = pod.metadata) == null ? void 0 : _f.namespace) != null ? _g : "unknown namespace",
            kind: "Pod",
            apiGroup: "v1"
          },
          occurrenceCount: 1
        };
      });
    }
  },
  {
    detectErrors: (pod) => {
      var _a, _b;
      return ((_b = (_a = pod.status) == null ? void 0 : _a.containerStatuses) != null ? _b : []).filter((cs) => cs.restartCount > 0).map((cs) => {
        var _a2, _b2, _c, _d;
        return {
          type: "containers-restarting",
          message: `container=${cs.name} restarted ${cs.restartCount} times`,
          severity: 4,
          proposedFix: restartingPodProposedFixes(pod),
          sourceRef: {
            name: (_b2 = (_a2 = pod.metadata) == null ? void 0 : _a2.name) != null ? _b2 : "unknown pod",
            namespace: (_d = (_c = pod.metadata) == null ? void 0 : _c.namespace) != null ? _d : "unknown namespace",
            kind: "Pod",
            apiGroup: "v1"
          },
          occurrenceCount: cs.restartCount
        };
      });
    }
  }
];
const detectErrorsInPods = (pods) => detectErrorsInObjects(pods, podErrorMappers);

const deploymentErrorMappers = [
  {
    detectErrors: (deployment) => {
      var _a, _b;
      return ((_b = (_a = deployment.status) == null ? void 0 : _a.conditions) != null ? _b : []).filter((c) => c.status === "False").filter((c) => c.message !== void 0).map((c) => {
        var _a2, _b2, _c, _d, _e;
        return {
          type: "condition-message-present",
          message: (_a2 = c.message) != null ? _a2 : "",
          severity: 6,
          sourceRef: {
            name: (_c = (_b2 = deployment.metadata) == null ? void 0 : _b2.name) != null ? _c : "unknown hpa",
            namespace: (_e = (_d = deployment.metadata) == null ? void 0 : _d.namespace) != null ? _e : "unknown namespace",
            kind: "Deployment",
            apiGroup: "apps/v1"
          },
          occurrenceCount: 1
        };
      });
    }
  }
];
const detectErrorsInDeployments = (deployments) => detectErrorsInObjects(deployments, deploymentErrorMappers);

const hpaErrorMappers = [
  {
    detectErrors: (hpa) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (((_b = (_a = hpa.spec) == null ? void 0 : _a.maxReplicas) != null ? _b : -1) === ((_c = hpa.status) == null ? void 0 : _c.currentReplicas)) {
        return [
          {
            type: "hpa-max-current-replicas",
            message: `Current number of replicas (${(_d = hpa.status) == null ? void 0 : _d.currentReplicas}) is equal to the configured max number of replicas (${(_f = (_e = hpa.spec) == null ? void 0 : _e.maxReplicas) != null ? _f : -1})`,
            severity: 8,
            sourceRef: {
              name: (_h = (_g = hpa.metadata) == null ? void 0 : _g.name) != null ? _h : "unknown hpa",
              namespace: (_j = (_i = hpa.metadata) == null ? void 0 : _i.namespace) != null ? _j : "unknown namespace",
              kind: "HorizontalPodAutoscaler",
              apiGroup: "autoscaling/v1"
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
	detectErrors: detectErrors,
	groupResponses: groupResponses,
	kubernetesPermissions: kubernetesPermissions,
	kubernetesProxyPermission: kubernetesProxyPermission
});

var require$$4 = /*@__PURE__*/getAugmentedNamespace(index_esm);

Object.defineProperty(index_cjs$1, '__esModule', { value: true });

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
var catalogModel = require$$16;
var pluginAuthNode = require$$17;
var lodash = lodash$1;
var fetch$1 = require$$19;
var https$1 = require$$20;
var pluginPermissionCommon = require$$21;
var httpProxyMiddleware = require$$22;

function _interopDefaultLegacy$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace$2(e) {
  if (e && e.__esModule) return e;
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
  n["default"] = e;
  return Object.freeze(n);
}

var container__namespace = /*#__PURE__*/_interopNamespace$2(container);
var fs__default = /*#__PURE__*/_interopDefaultLegacy$2(fs);
var express__default = /*#__PURE__*/_interopDefaultLegacy$2(express);
var Router__default = /*#__PURE__*/_interopDefaultLegacy$2(Router);
var dns__default = /*#__PURE__*/_interopDefaultLegacy$2(dns);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy$2(lodash);
var fetch__default$1 = /*#__PURE__*/_interopDefaultLegacy$2(fetch$1);
var https__namespace$1 = /*#__PURE__*/_interopNamespace$2(https$1);

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

var __defProp$b = Object.defineProperty;
var __defNormalProp$b = (obj, key, value) => key in obj ? __defProp$b(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$b = (obj, key, value) => {
  __defNormalProp$b(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const defaultRegion = "us-east-1";
class AwsIamStrategy {
  constructor(opts) {
    __publicField$b(this, "credsManager");
    this.credsManager = integrationAwsNode.DefaultAwsCredentialsManager.fromConfig(opts.config);
  }
  async getCredential(clusterDetails) {
    var _a;
    return {
      type: "bearer token",
      token: await this.getBearerToken(
        (_a = clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_CLUSTER_ID]) != null ? _a : clusterDetails.name,
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE],
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID]
      )
    };
  }
  validateCluster() {
    return [];
  }
  async getBearerToken(clusterId, assumeRole, externalId) {
    var _a, _b;
    const region = (_a = process.env.AWS_REGION) != null ? _a : defaultRegion;
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
    const query = Object.keys((_b = request == null ? void 0 : request.query) != null ? _b : {}).map(
      (q) => {
        var _a2;
        return `${encodeURIComponent(q)}=${encodeURIComponent(
          (_a2 = request.query) == null ? void 0 : _a2[q]
        )}`;
      }
    ).join("&");
    const url = `https://${request.hostname}${request.path}?${query}`;
    return `k8s-aws-v1.${Buffer.from(url).toString("base64url")}`;
  }
  presentAuthMetadata(_authMetadata) {
    return {};
  }
}

var __defProp$a = Object.defineProperty;
var __defNormalProp$a = (obj, key, value) => key in obj ? __defProp$a(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$a = (obj, key, value) => {
  __defNormalProp$a(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const aksScope = "6dae42f8-4368-4678-94ff-3960e28e3630/.default";
class AzureIdentityStrategy {
  constructor(logger, tokenCredential = new identity.DefaultAzureCredential()) {
    this.logger = logger;
    this.tokenCredential = tokenCredential;
    __publicField$a(this, "accessToken", { token: "", expiresOnTimestamp: 0 });
    __publicField$a(this, "newTokenPromise");
  }
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

var __defProp$9 = Object.defineProperty;
var __defNormalProp$9 = (obj, key, value) => key in obj ? __defProp$9(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$9 = (obj, key, value) => {
  __defNormalProp$9(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class DispatchStrategy {
  constructor(options) {
    __publicField$9(this, "strategyMap");
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
      token: fs__default["default"].readFileSync(user.authProvider.config.tokenFile).toString()
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
    var _a;
    const oidcTokenProvider = clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER];
    if (!oidcTokenProvider || oidcTokenProvider === "") {
      throw new Error(
        `oidc authProvider requires a configured oidcTokenProvider`
      );
    }
    const token = (_a = authConfig.oidc) == null ? void 0 : _a[oidcTokenProvider];
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

var __defProp$8 = Object.defineProperty;
var __defNormalProp$8 = (obj, key, value) => key in obj ? __defProp$8(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$8 = (obj, key, value) => {
  __defNormalProp$8(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class ConfigClusterLocator {
  constructor(clusterDetails) {
    __publicField$8(this, "clusterDetails");
    this.clusterDetails = clusterDetails;
  }
  static fromConfig(config, authStrategy) {
    const clusterNames = /* @__PURE__ */ new Set();
    return new ConfigClusterLocator(
      config.getConfigArray("clusters").map((c) => {
        var _a, _b, _c;
        const authMetadataBlock = c.getOptional("authMetadata");
        const name = c.getString("name");
        if (clusterNames.has(name)) {
          throw new Error(`Duplicate cluster name '${name}'`);
        }
        clusterNames.add(name);
        const authProvider = (_a = authMetadataBlock == null ? void 0 : authMetadataBlock[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]) != null ? _a : c.getOptionalString("authProvider");
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
          skipTLSVerify: (_b = c.getOptionalBoolean("skipTLSVerify")) != null ? _b : false,
          skipMetricsLookup: (_c = c.getOptionalBoolean("skipMetricsLookup")) != null ? _c : false,
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
var description = "A Backstage backend plugin that integrates towards Kubernetes";
var version = "0.15.3";
var main = "src/index.ts";
var types = "src/index.ts";
var license = "Apache-2.0";
var publishConfig = {
	access: "public"
};
var exports$1 = {
	".": "./src/index.ts",
	"./alpha": "./src/alpha.ts",
	"./package.json": "./package.json"
};
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
var backstage = {
	role: "backend-plugin"
};
var homepage = "https://backstage.io";
var repository = {
	type: "git",
	url: "https://github.com/backstage/backstage",
	directory: "plugins/kubernetes-backend"
};
var keywords = [
	"backstage",
	"kubernetes"
];
var configSchema = "config.d.ts";
var scripts = {
	start: "backstage-cli package start",
	build: "backstage-cli package build",
	lint: "backstage-cli package lint",
	test: "backstage-cli package test",
	prepack: "backstage-cli package prepack",
	postpack: "backstage-cli package postpack",
	clean: "backstage-cli package clean"
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
	"@types/http-proxy-middleware": "^0.19.3",
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
var files = [
	"dist",
	"config.d.ts"
];
var packageinfo = {
	name: name,
	description: description,
	version: version,
	main: main,
	types: types,
	license: license,
	publishConfig: publishConfig,
	exports: exports$1,
	typesVersions: typesVersions,
	backstage: backstage,
	homepage: homepage,
	repository: repository,
	keywords: keywords,
	configSchema: configSchema,
	scripts: scripts,
	dependencies: dependencies,
	devDependencies: devDependencies,
	files: files
};

class GkeClusterLocator {
  constructor(options, client, clusterDetails = void 0, hasClusterDetails = false) {
    this.options = options;
    this.client = client;
    this.clusterDetails = clusterDetails;
    this.hasClusterDetails = hasClusterDetails;
  }
  static fromConfigWithClient(config, client, refreshInterval) {
    var _a, _b, _c, _d, _e, _f;
    const matchingResourceLabels = (_b = (_a = config.getOptionalConfigArray("matchingResourceLabels")) == null ? void 0 : _a.map((mrl) => {
      return { key: mrl.getString("key"), value: mrl.getString("value") };
    })) != null ? _b : [];
    const storeAuthProviderString = config.getOptionalString("authProvider") === "googleServiceAccount" ? "googleServiceAccount" : "google";
    const options = {
      projectId: config.getString("projectId"),
      authProvider: storeAuthProviderString,
      region: (_c = config.getOptionalString("region")) != null ? _c : "-",
      skipTLSVerify: (_d = config.getOptionalBoolean("skipTLSVerify")) != null ? _d : false,
      skipMetricsLookup: (_e = config.getOptionalBoolean("skipMetricsLookup")) != null ? _e : false,
      exposeDashboard: (_f = config.getOptionalBoolean("exposeDashboard")) != null ? _f : false,
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
    var _a;
    if (!this.hasClusterDetails) {
      await this.refreshClusters();
    }
    return (_a = this.clusterDetails) != null ? _a : [];
  }
  // TODO pass caData into the object
  async refreshClusters() {
    var _a;
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
      this.clusterDetails = ((_a = response.clusters) != null ? _a : []).filter((r) => {
        return matchingResourceLabels == null ? void 0 : matchingResourceLabels.every((mrl) => {
          if (!r.resourceLabels) {
            return false;
          }
          return r.resourceLabels[mrl.key] === mrl.value;
        });
      }).map((r) => {
        var _a2, _b;
        return {
          // TODO filter out clusters which don't have name or endpoint
          name: (_a2 = r.name) != null ? _a2 : "unknown",
          url: `https://${(_b = r.endpoint) != null ? _b : ""}`,
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
        };
      });
      this.hasClusterDetails = true;
    } catch (e) {
      throw new errors.ForwardedError(
        `There was an error retrieving clusters from GKE for projectId=${projectId} region=${region}`,
        e
      );
    }
  }
}

var __defProp$7 = Object.defineProperty;
var __defNormalProp$7 = (obj, key, value) => key in obj ? __defProp$7(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$7 = (obj, key, value) => {
  __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
function isObject(obj) {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}
class CatalogClusterLocator {
  constructor(catalogClient) {
    __publicField$7(this, "catalogClient");
    this.catalogClient = catalogClient;
  }
  static fromConfig(catalogApi) {
    return new CatalogClusterLocator(catalogApi);
  }
  async getClusters() {
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
    const clusters = await this.catalogClient.getEntities({
      filter: [filter]
    });
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

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => {
  __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class LocalKubectlProxyClusterLocator {
  constructor() {
    __publicField$6(this, "clusterDetails");
    // verbatim: when false, IPv4 addresses are placed before IPv6 addresses, ignoring the order from the DNS resolver
    // By default kubectl proxy listens on 127.0.0.1 instead of [::1]
    __publicField$6(this, "lookupPromise", dns__default["default"].promises.lookup("localhost", { verbatim: false }));
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
  async getClusters() {
    const clusters = await Promise.all(
      this.clusterSuppliers.map((supplier) => supplier.getClusters())
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
const getCombinedClusterSupplier = (rootConfig, catalogClient, authStrategy, logger, refreshInterval = void 0) => {
  const clusterSuppliers = rootConfig.getConfigArray("kubernetes.clusterLocatorMethods").map((clusterLocatorMethod) => {
    const type = clusterLocatorMethod.getString("type");
    switch (type) {
      case "catalog":
        return CatalogClusterLocator.fromConfig(catalogClient);
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

const addResourceRoutesToRouter = (router, catalogApi, objectsProvider) => {
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
    const token = pluginAuthNode.getBearerTokenFromAuthorizationHeader(
      req.headers.authorization
    );
    if (!token) {
      throw new errors.AuthenticationError("No Backstage token");
    }
    const entity = await catalogApi.getEntityByRef(entityRef, {
      token
    });
    if (!entity) {
      throw new errors.InputError(
        `Entity ref missing, ${catalogModel.stringifyEntityRef(entityRef)}`
      );
    }
    return entity;
  };
  router.post("/resources/workloads/query", async (req, res) => {
    const entity = await getEntityByReq(req);
    const response = await objectsProvider.getKubernetesObjectsByEntity({
      entity,
      auth: req.body.auth
    });
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
    const response = await objectsProvider.getCustomResourcesByEntity({
      entity,
      customResources: req.body.customResources,
      auth: req.body.auth
    });
    res.json(response);
  });
};

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => {
  __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class MultiTenantServiceLocator {
  constructor(clusterSupplier) {
    __publicField$5(this, "clusterSupplier");
    this.clusterSupplier = clusterSupplier;
  }
  // As this implementation always returns all clusters serviceId is ignored here
  getClustersByEntity(_entity, _requestContext) {
    return this.clusterSupplier.getClusters().then((clusters) => ({ clusters }));
  }
}

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => {
  __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class SingleTenantServiceLocator {
  constructor(clusterSupplier) {
    __publicField$4(this, "clusterSupplier");
    this.clusterSupplier = clusterSupplier;
  }
  // As this implementation always returns all clusters serviceId is ignored here
  getClustersByEntity(_entity, _requestContext) {
    return this.clusterSupplier.getClusters().then((clusters) => {
      var _a, _b;
      if ((_b = (_a = _entity.metadata) == null ? void 0 : _a.annotations) == null ? void 0 : _b["backstage.io/kubernetes-cluster"]) {
        return {
          clusters: clusters.filter(
            (c) => {
              var _a2, _b2;
              return c.name === ((_b2 = (_a2 = _entity.metadata) == null ? void 0 : _a2.annotations) == null ? void 0 : _b2["backstage.io/kubernetes-cluster"]);
            }
          )
        };
      }
      return { clusters };
    });
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => {
  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
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
    apiVersion: "v1",
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
  constructor({
    logger,
    fetcher,
    serviceLocator,
    customResources,
    objectTypesToFetch = DEFAULT_OBJECTS,
    authStrategy
  }) {
    __publicField$3(this, "logger");
    __publicField$3(this, "fetcher");
    __publicField$3(this, "serviceLocator");
    __publicField$3(this, "customResources");
    __publicField$3(this, "objectTypesToFetch");
    __publicField$3(this, "authStrategy");
    this.logger = logger;
    this.fetcher = fetcher;
    this.serviceLocator = serviceLocator;
    this.customResources = customResources;
    this.objectTypesToFetch = new Set(objectTypesToFetch);
    this.authStrategy = authStrategy;
  }
  async getCustomResourcesByEntity({
    entity,
    auth,
    customResources
  }) {
    return this.fanOutRequests(
      entity,
      auth,
      /* @__PURE__ */ new Set(),
      customResources
    );
  }
  async getKubernetesObjectsByEntity({
    entity,
    auth
  }) {
    return this.fanOutRequests(entity, auth, this.objectTypesToFetch);
  }
  async fanOutRequests(entity, auth, objectTypesToFetch, customResources) {
    var _a, _b, _c, _d, _e, _f, _g;
    const entityName = ((_b = (_a = entity.metadata) == null ? void 0 : _a.annotations) == null ? void 0 : _b["backstage.io/kubernetes-id"]) || ((_c = entity.metadata) == null ? void 0 : _c.name);
    const { clusters } = await this.serviceLocator.getClustersByEntity(entity, {
      objectTypesToFetch,
      customResources: customResources != null ? customResources : []
    });
    this.logger.info(
      `entity.metadata.name=${entityName} clusterDetails=[${clusters.map((c) => c.name).join(", ")}]`
    );
    const labelSelector = ((_e = (_d = entity.metadata) == null ? void 0 : _d.annotations) == null ? void 0 : _e["backstage.io/kubernetes-label-selector"]) || `backstage.io/kubernetes-id=${entityName}`;
    const namespace = (_g = (_f = entity.metadata) == null ? void 0 : _f.annotations) == null ? void 0 : _g["backstage.io/kubernetes-namespace"];
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
        (item) => item.errors !== void 0 && item.errors.length >= 1 || item.resources !== void 0 && item.resources.length >= 1 && item.resources.some((fr) => {
          var _a;
          return ((_a = fr.resources) == null ? void 0 : _a.length) >= 1;
        })
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
      result.responses.filter(isPodFetchResponse).flatMap((r) => r.resources).map((p) => {
        var _a;
        return (_a = p.metadata) == null ? void 0 : _a.namespace;
      }).filter(isString)
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

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const isError = (fr) => fr.hasOwnProperty("errorType");
function fetchResultsToResponseWrapper(results) {
  var _a, _b;
  const groupBy = lodash__default["default"].groupBy(results, (value) => {
    return isError(value) ? "errors" : "responses";
  });
  return {
    errors: (_a = groupBy.errors) != null ? _a : [],
    responses: (_b = groupBy.responses) != null ? _b : []
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
  constructor({ logger }) {
    __publicField$2(this, "logger");
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
    return fetch__default$1["default"](url, requestInit);
  }
  isServiceAccountAuthentication(authProvider, clusterDetails) {
    return authProvider === "serviceAccount" && !clusterDetails.authMetadata.serviceAccountToken && fs__default["default"].pathExistsSync(clientNode$1.Config.SERVICEACCOUNT_CA_PATH);
  }
  isCredentialMissing(authProvider, credential) {
    return authProvider !== "localKubectlProxy" && credential.type === "anonymous";
  }
  fetchArgs(clusterDetails, credential) {
    var _a;
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
        ca: (_a = clientNode$1.bufferFromFileOrString(
          clusterDetails.caFile,
          clusterDetails.caData
        )) != null ? _a : void 0,
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
        ca: fs__default["default"].readFileSync(cluster.caFile)
      });
    }
    return [url, requestInit];
  }
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const HEADER_KUBERNETES_CLUSTER = "Backstage-Kubernetes-Cluster";
const HEADER_KUBERNETES_AUTH = "Backstage-Kubernetes-Authorization";
class KubernetesProxy {
  constructor(options) {
    __publicField$1(this, "middlewareForClusterName", /* @__PURE__ */ new Map());
    __publicField$1(this, "logger");
    __publicField$1(this, "clusterSupplier");
    __publicField$1(this, "authStrategy");
    this.logger = options.logger;
    this.clusterSupplier = options.clusterSupplier;
    this.authStrategy = options.authStrategy;
  }
  createRequestHandler(options) {
    const { permissionApi } = options;
    return async (req, res, next) => {
      var _a, _b;
      const authorizeResponse = await permissionApi.authorize(
        [{ permission: pluginKubernetesCommon.kubernetesProxyPermission }],
        {
          token: pluginAuthNode.getBearerTokenFromAuthorizationHeader(
            req.header("authorization")
          )
        }
      );
      const auth = authorizeResponse[0];
      if (auth.result === pluginPermissionCommon.AuthorizeResult.DENY) {
        res.status(403).json({ error: new errors.NotAllowedError("Unauthorized") });
        return;
      }
      const middleware = await this.getMiddleware(req);
      if (((_a = req.header("connection")) == null ? void 0 : _a.toLowerCase()) === "upgrade" && ((_b = req.header("upgrade")) == null ? void 0 : _b.toLowerCase()) === "websocket") {
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
        logProvider: () => logger,
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
          var _a;
          const cluster = await this.getClusterForRequest(req);
          const url = new URL(cluster.url);
          const target = {
            protocol: url.protocol,
            host: url.hostname,
            port: url.port,
            ca: (_a = clientNode$1.bufferFromFileOrString(
              cluster.caFile,
              cluster.caData
            )) == null ? void 0 : _a.toString()
          };
          const authHeader = req.header(HEADER_KUBERNETES_AUTH);
          if (authHeader) {
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
          logger.error(wrappedError);
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
    const clusters = await this.clusterSupplier.getClusters();
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

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class KubernetesBuilder {
  constructor(env) {
    this.env = env;
    __publicField(this, "clusterSupplier");
    __publicField(this, "defaultClusterRefreshInterval", luxon.Duration.fromObject({
      minutes: 60
    }));
    __publicField(this, "objectsProvider");
    __publicField(this, "fetcher");
    __publicField(this, "serviceLocator");
    __publicField(this, "proxy");
    __publicField(this, "authStrategyMap");
  }
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
        router: Router__default["default"]()
      };
    }
    const customResources = this.buildCustomResources();
    const fetcher = this.getFetcher();
    const clusterSupplier = this.getClusterSupplier();
    const authStrategyMap = this.getAuthStrategyMap();
    const proxy = this.getProxy(logger, clusterSupplier);
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
      permissions
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
    var _a;
    const customResources = ((_a = this.env.config.getOptionalConfigArray("kubernetes.customResources")) != null ? _a : []).map(
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
    this.clusterSupplier = getCombinedClusterSupplier(
      config,
      this.env.catalogApi,
      new DispatchStrategy({ authStrategyMap: this.getAuthStrategyMap() }),
      this.env.logger,
      refreshInterval
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
  buildHttpServiceLocator(_clusterSupplier) {
    throw new Error("not implemented");
  }
  buildProxy(logger, clusterSupplier) {
    const authStrategyMap = this.getAuthStrategyMap();
    const authStrategy = new DispatchStrategy({
      authStrategyMap
    });
    this.proxy = new KubernetesProxy({
      logger,
      clusterSupplier,
      authStrategy
    });
    return this.proxy;
  }
  buildRouter(objectsProvider, clusterSupplier, catalogApi, proxy, permissionApi) {
    const logger = this.env.logger;
    const router = Router__default["default"]();
    router.use("/proxy", proxy.createRequestHandler({ permissionApi }));
    router.use(express__default["default"].json());
    router.use(
      pluginPermissionNode.createPermissionIntegrationRouter({
        permissions: pluginKubernetesCommon.kubernetesPermissions
      })
    );
    router.post("/services/:serviceId", async (req, res) => {
      const serviceId = req.params.serviceId;
      const requestBody = req.body;
      try {
        const response = await objectsProvider.getKubernetesObjectsByEntity({
          entity: requestBody.entity,
          auth: requestBody.auth || {}
        });
        res.json(response);
      } catch (e) {
        logger.error(
          `action=retrieveObjectsByServiceId service=${serviceId}, error=${e}`
        );
        res.status(500).json({ error: e.message });
      }
    });
    router.get("/clusters", async (_, res) => {
      const clusterDetails = await this.fetchClusterDetails(clusterSupplier);
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
    addResourceRoutesToRouter(router, catalogApi, objectsProvider);
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
  async fetchClusterDetails(clusterSupplier) {
    const clusterDetails = await clusterSupplier.getClusters();
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
    var _a;
    return (_a = this.fetcher) != null ? _a : this.buildFetcher();
  }
  getClusterSupplier() {
    var _a;
    return (_a = this.clusterSupplier) != null ? _a : this.buildClusterSupplier(this.defaultClusterRefreshInterval);
  }
  getServiceLocator() {
    var _a;
    return (_a = this.serviceLocator) != null ? _a : this.buildServiceLocator(
      this.getServiceLocatorMethod(),
      this.getClusterSupplier()
    );
  }
  getObjectsProvider(options) {
    var _a;
    return (_a = this.objectsProvider) != null ? _a : this.buildObjectsProvider(options);
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
      objectTypesToFetch = objectTypesToFetch != null ? objectTypesToFetch : DEFAULT_OBJECTS;
      for (const obj of objectTypesToFetch) {
        if (apiVersionOverrides.has(obj.objectType)) {
          obj.apiVersion = apiVersionOverrides.getString(obj.objectType);
        }
      }
    }
    return objectTypesToFetch;
  }
  getProxy(logger, clusterSupplier) {
    var _a;
    return (_a = this.proxy) != null ? _a : this.buildProxy(logger, clusterSupplier);
  }
  getAuthStrategyMap() {
    var _a;
    return (_a = this.authStrategyMap) != null ? _a : this.buildAuthStrategyMap();
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

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0$1;
var https = require$$20;
var clientNode = require$$7;
var fetch = require$$19;

function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace$1(e) {
  if (e && e.__esModule) return e;
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
  n["default"] = e;
  return Object.freeze(n);
}

var https__namespace = /*#__PURE__*/_interopNamespace$1(https);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy$1(fetch);

const kubernetesObjectsProviderExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "kubernetes.objects-provider"
});
const kubernetesClusterSupplierExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "kubernetes.cluster-supplier"
});
const kubernetesAuthStrategyExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "kubernetes.auth-strategy"
});
const kubernetesFetcherExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "kubernetes.fetcher"
});
const kubernetesServiceLocatorExtensionPoint = backendPluginApi.createExtensionPoint({
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
    var _a, _b;
    const url = new URL(clusterDetails.url);
    const apiGroup = (_b = (_a = pinnipedParams.tokenCredentialRequest) == null ? void 0 : _a.apiGroup) != null ? _b : "login.concierge.pinniped.dev/v1alpha1";
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
      response = await fetch__default["default"](url, requestInit);
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
    var _a, _b, _c;
    const body = {
      apiVersion: (_b = (_a = pinnipedParams.tokenCredentialRequest) == null ? void 0 : _a.apiGroup) != null ? _b : "login.concierge.pinniped.dev/v1alpha1",
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
        ca: (_c = clientNode.bufferFromFileOrString(
          clusterDetails.caFile,
          clusterDetails.caData
        )) != null ? _c : void 0,
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

(function (exports) {

	Object.defineProperty(exports, '__esModule', { value: true });

	var backendCommon = require$$0$2;
	var backendPluginApi = require$$0$1;
	var alpha = require$$2$1;
	var pluginKubernetesBackend = index_cjs$1;
	var pluginKubernetesNode = index_cjs;

	var __defProp = Object.defineProperty;
	var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField = (obj, key, value) => {
	  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class ObjectsProvider {
	  constructor() {
	    __publicField(this, "objectsProvider");
	  }
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
	  constructor() {
	    __publicField(this, "clusterSupplier");
	  }
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
	  constructor() {
	    __publicField(this, "fetcher");
	  }
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
	  constructor() {
	    __publicField(this, "serviceLocator");
	  }
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
	  constructor() {
	    __publicField(this, "authStrategies");
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
	        catalogApi: alpha.catalogServiceRef,
	        permissions: backendPluginApi.coreServices.permissions
	      },
	      async init({ http, logger, config, catalogApi, permissions }) {
	        const winstonLogger = backendCommon.loggerToWinstonLogger(logger);
	        const builder = pluginKubernetesBackend.KubernetesBuilder.createBuilder({
	          logger: winstonLogger,
	          config,
	          catalogApi,
	          permissions
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

	exports["default"] = kubernetesPlugin;
	
} (alpha_cjs$1));

var alpha_cjs = /*@__PURE__*/getDefaultExportFromCjs(alpha_cjs$1);

exports["default"] = alpha_cjs;
//# sourceMappingURL=index.cjs.js.map
