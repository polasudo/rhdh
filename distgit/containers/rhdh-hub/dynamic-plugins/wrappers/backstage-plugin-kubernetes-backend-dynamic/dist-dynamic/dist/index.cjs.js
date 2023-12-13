'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@aws-sdk/credential-providers');
var require$$1 = require('@aws-sdk/signature-v4');
var require$$2 = require('@aws-crypto/sha256-js');
var require$$3 = require('@backstage/integration-aws-node');
var require$$20 = require('@backstage/plugin-permission-common');
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
var require$$15 = require('@backstage/catalog-model');
var require$$16 = require('@backstage/plugin-auth-node');
var require$$18 = require('node-fetch');
var require$$19 = require('https');
var require$$21 = require('http-proxy-middleware');

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

const ANNOTATION_KUBERNETES_API_SERVER = "kubernetes.io/api-server";
const ANNOTATION_KUBERNETES_API_SERVER_CA = "kubernetes.io/api-server-certificate-authority";
const ANNOTATION_KUBERNETES_AUTH_PROVIDER = "kubernetes.io/auth-provider";
const ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER = "kubernetes.io/oidc-token-provider";
const ANNOTATION_KUBERNETES_SKIP_METRICS_LOOKUP = "kubernetes.io/skip-metrics-lookup";
const ANNOTATION_KUBERNETES_SKIP_TLS_VERIFY = "kubernetes.io/skip-tls-verify";
const ANNOTATION_KUBERNETES_DASHBOARD_URL = "kubernetes.io/dashboard-url";
const ANNOTATION_KUBERNETES_DASHBOARD_APP = "kubernetes.io/dashboard-app";
const ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE = "kubernetes.io/aws-assume-role";
const ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID = "kubernetes.io/aws-external-id";

const kubernetesProxyPermission = require$$20.createPermission({
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
	ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID: ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID,
	ANNOTATION_KUBERNETES_DASHBOARD_APP: ANNOTATION_KUBERNETES_DASHBOARD_APP,
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

Object.defineProperty(index_cjs, '__esModule', { value: true });

var credentialProviders = require$$0;
var signatureV4 = require$$1;
var sha256Js = require$$2;
var integrationAwsNode = require$$3;
var pluginKubernetesCommon = require$$4;
var identity = require$$5;
var container = require$$6;
var clientNode = require$$7;
var fs = require$$8;
var pluginPermissionNode = require$$9;
var express = require$$10;
var Router = require$$11;
var luxon = require$$12;
var errors = require$$13;
var catalogClient = require$$14;
var catalogModel = require$$15;
var pluginAuthNode = require$$16;
var lodash = lodash$1;
var fetch = require$$18;
var https = require$$19;
var pluginPermissionCommon = require$$20;
var httpProxyMiddleware = require$$21;

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

var container__namespace = /*#__PURE__*/_interopNamespace$1(container);
var fs__default = /*#__PURE__*/_interopDefaultLegacy$1(fs);
var express__default = /*#__PURE__*/_interopDefaultLegacy$1(express);
var Router__default = /*#__PURE__*/_interopDefaultLegacy$1(Router);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy$1(lodash);
var fetch__default = /*#__PURE__*/_interopDefaultLegacy$1(fetch);
var https__namespace = /*#__PURE__*/_interopNamespace$1(https);

class AksStrategy {
  async getCredential(_, requestAuth) {
    const token = requestAuth.aks;
    return token ? { type: "bearer token", token } : { type: "anonymous" };
  }
  validateCluster() {
    return [];
  }
}

class AnonymousStrategy {
  async getCredential() {
    return { type: "anonymous" };
  }
  validateCluster() {
    return [];
  }
}

var __defProp$a = Object.defineProperty;
var __defNormalProp$a = (obj, key, value) => key in obj ? __defProp$a(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$a = (obj, key, value) => {
  __defNormalProp$a(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const defaultRegion = "us-east-1";
class AwsIamStrategy {
  constructor(opts) {
    __publicField$a(this, "credsManager");
    this.credsManager = integrationAwsNode.DefaultAwsCredentialsManager.fromConfig(opts.config);
  }
  async getCredential(clusterDetails) {
    return {
      type: "bearer token",
      token: await this.getBearerToken(
        clusterDetails.name,
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_ASSUME_ROLE],
        clusterDetails.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AWS_EXTERNAL_ID]
      )
    };
  }
  validateCluster() {
    return [];
  }
  async getBearerToken(clusterName, assumeRole, externalId) {
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
          "x-k8s-aws-id": clusterName
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
}

var __defProp$9 = Object.defineProperty;
var __defNormalProp$9 = (obj, key, value) => key in obj ? __defProp$9(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$9 = (obj, key, value) => {
  __defNormalProp$9(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const aksScope = "6dae42f8-4368-4678-94ff-3960e28e3630/.default";
class AzureIdentityStrategy {
  constructor(logger, tokenCredential = new identity.DefaultAzureCredential()) {
    this.logger = logger;
    this.tokenCredential = tokenCredential;
    __publicField$9(this, "accessToken", { token: "", expiresOnTimestamp: 0 });
    __publicField$9(this, "newTokenPromise");
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
}

var __defProp$8 = Object.defineProperty;
var __defNormalProp$8 = (obj, key, value) => key in obj ? __defProp$8(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$8 = (obj, key, value) => {
  __defNormalProp$8(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class DispatchStrategy {
  constructor(options) {
    __publicField$8(this, "strategyMap");
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
}

class ServiceAccountStrategy {
  async getCredential(clusterDetails) {
    const token = clusterDetails.authMetadata.serviceAccountToken;
    if (token) {
      return { type: "bearer token", token };
    }
    const kc = new clientNode.KubeConfig();
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
}

var __defProp$7 = Object.defineProperty;
var __defNormalProp$7 = (obj, key, value) => key in obj ? __defProp$7(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$7 = (obj, key, value) => {
  __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class ConfigClusterLocator {
  constructor(clusterDetails) {
    __publicField$7(this, "clusterDetails");
    this.clusterDetails = clusterDetails;
  }
  static fromConfig(config, authStrategy) {
    return new ConfigClusterLocator(
      config.getConfigArray("clusters").map((c) => {
        var _a, _b;
        const authProvider = c.getString("authProvider");
        const clusterDetails = {
          name: c.getString("name"),
          url: c.getString("url"),
          skipTLSVerify: (_a = c.getOptionalBoolean("skipTLSVerify")) != null ? _a : false,
          skipMetricsLookup: (_b = c.getOptionalBoolean("skipMetricsLookup")) != null ? _b : false,
          caData: c.getOptionalString("caData"),
          caFile: c.getOptionalString("caFile"),
          authMetadata: {
            [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]: authProvider,
            ...ConfigClusterLocator.parseAuthMetadata(c)
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
    const options = {
      projectId: config.getString("projectId"),
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
  static fromConfig(config, refreshInterval = void 0) {
    return GkeClusterLocator.fromConfigWithClient(
      config,
      new container__namespace.v1.ClusterManagerClient(),
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
          authMetadata: { [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]: "google" },
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

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => {
  __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class CatalogClusterLocator {
  constructor(catalogClient) {
    __publicField$6(this, "catalogClient");
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
      const clusterDetails = {
        name: entity.metadata.name,
        url: entity.metadata.annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_API_SERVER],
        authMetadata: entity.metadata.annotations,
        caData: entity.metadata.annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_API_SERVER_CA],
        skipMetricsLookup: entity.metadata.annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_SKIP_METRICS_LOOKUP] === "true",
        skipTLSVerify: entity.metadata.annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_SKIP_TLS_VERIFY] === "true",
        dashboardUrl: entity.metadata.annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_DASHBOARD_URL],
        dashboardApp: entity.metadata.annotations[pluginKubernetesCommon.ANNOTATION_KUBERNETES_DASHBOARD_APP]
      };
      return clusterDetails;
    });
  }
}

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => {
  __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class LocalKubectlProxyClusterLocator {
  constructor() {
    __publicField$5(this, "clusterDetails");
    this.clusterDetails = [
      {
        name: "local",
        url: "http:/localhost:8001",
        authMetadata: {
          [pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER]: "localKubectlProxy"
        },
        skipMetricsLookup: true
      }
    ];
  }
  async getClusters() {
    return this.clusterDetails;
  }
}

class CombinedClustersSupplier {
  constructor(clusterSuppliers) {
    this.clusterSuppliers = clusterSuppliers;
  }
  async getClusters() {
    return await Promise.all(
      this.clusterSuppliers.map((supplier) => supplier.getClusters())
    ).then((res) => {
      return res.flat();
    }).catch((e) => {
      throw e;
    });
  }
}
const getCombinedClusterSupplier = (rootConfig, catalogClient, authStrategy, refreshInterval = void 0) => {
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
  return new CombinedClustersSupplier(clusterSuppliers);
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

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => {
  __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class MultiTenantServiceLocator {
  constructor(clusterSupplier) {
    __publicField$4(this, "clusterSupplier");
    this.clusterSupplier = clusterSupplier;
  }
  // As this implementation always returns all clusters serviceId is ignored here
  getClustersByEntity(_entity, _requestContext) {
    return this.clusterSupplier.getClusters().then((clusters) => ({ clusters }));
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
        name: clusterDetails.name
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
        return clientNode.topPods(
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
    if (authProvider === "serviceAccount" && !clusterDetails.authMetadata.serviceAccountToken && fs__default["default"].pathExistsSync(clientNode.Config.SERVICEACCOUNT_CA_PATH)) {
      [url, requestInit] = this.fetchArgsInCluster(credential);
    } else if (credential.type === "bearer token" || authProvider === "localKubectlProxy") {
      [url, requestInit] = this.fetchArgs(clusterDetails, credential);
    } else {
      return Promise.reject(
        new Error(
          `no bearer token for cluster '${clusterDetails.name}' and not running in Kubernetes`
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
    return fetch__default["default"](url, requestInit);
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
      requestInit.agent = new https__namespace.Agent({
        ca: (_a = clientNode.bufferFromFileOrString(
          clusterDetails.caFile,
          clusterDetails.caData
        )) != null ? _a : void 0,
        rejectUnauthorized: !clusterDetails.skipTLSVerify
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
    const kc = new clientNode.KubeConfig();
    kc.loadFromCluster();
    const cluster = kc.getCurrentCluster();
    const url = new URL(cluster.server);
    if (url.protocol === "https:") {
      requestInit.agent = new https__namespace.Agent({
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
        }
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
          return {
            protocol: url.protocol,
            host: url.hostname,
            port: url.port,
            ca: (_a = clientNode.bufferFromFileOrString(
              cluster.caFile,
              cluster.caData
            )) == null ? void 0 : _a.toString()
          };
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
      case "http":
        this.serviceLocator = this.buildHttpServiceLocator(clusterSupplier);
        break;
      default:
        throw new Error(
          `Unsupported kubernetes.clusterLocatorMethod "${method}"`
        );
    }
    return this.serviceLocator;
  }
  buildMultiTenantServiceLocator(clusterSupplier) {
    return new MultiTenantServiceLocator(clusterSupplier);
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
          return {
            name: cd.name,
            dashboardUrl: cd.dashboardUrl,
            authProvider: cd.authMetadata[pluginKubernetesCommon.ANNOTATION_KUBERNETES_AUTH_PROVIDER],
            ...oidcTokenProvider && { oidcTokenProvider }
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

index_cjs.AksStrategy = AksStrategy;
index_cjs.AnonymousStrategy = AnonymousStrategy;
index_cjs.AwsIamStrategy = AwsIamStrategy;
index_cjs.AzureIdentityStrategy = AzureIdentityStrategy;
index_cjs.DEFAULT_OBJECTS = DEFAULT_OBJECTS;
index_cjs.DispatchStrategy = DispatchStrategy;
index_cjs.GoogleServiceAccountStrategy = GoogleServiceAccountStrategy;
index_cjs.GoogleStrategy = GoogleStrategy;
index_cjs.HEADER_KUBERNETES_AUTH = HEADER_KUBERNETES_AUTH;
index_cjs.HEADER_KUBERNETES_CLUSTER = HEADER_KUBERNETES_CLUSTER;
var KubernetesBuilder_1 = index_cjs.KubernetesBuilder = KubernetesBuilder;
index_cjs.KubernetesProxy = KubernetesProxy;
index_cjs.OidcStrategy = OidcStrategy;
index_cjs.ServiceAccountStrategy = ServiceAccountStrategy;
index_cjs.createRouter = createRouter;

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "kubernetes",
    async createPlugin(env) {
      const catalogApi = new require$$14.CatalogClient({ discoveryApi: env.discovery });
      const { router } = await KubernetesBuilder_1.createBuilder({
        logger: env.logger,
        config: env.config,
        permissions: env.permissions,
        catalogApi
      }).build();
      return router;
    }
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
