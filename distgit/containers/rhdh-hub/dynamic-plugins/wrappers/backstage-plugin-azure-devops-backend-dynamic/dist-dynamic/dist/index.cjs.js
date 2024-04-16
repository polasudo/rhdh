'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$10 = require('@backstage/plugin-permission-common');
var alpha = require('@backstage/plugin-catalog-common/alpha');
var require$$1 = require('mime-types');
var require$$2 = require('azure-devops-node-api');
var require$$3 = require('@backstage/integration');
var require$$4 = require('p-limit');
var require$$5 = require('express-promise-router');
var require$$6 = require('@backstage/backend-common');
var require$$7 = require('express');
var require$$8 = require('@backstage/errors');
var require$$9 = require('@backstage/plugin-auth-node');
var require$$11 = require('@backstage/plugin-permission-node');
var require$$12 = require('@backstage/backend-plugin-api');
var require$$13 = require('lodash');

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

var BuildResult = /* @__PURE__ */ ((BuildResult2) => {
  BuildResult2[BuildResult2["None"] = 0] = "None";
  BuildResult2[BuildResult2["Succeeded"] = 2] = "Succeeded";
  BuildResult2[BuildResult2["PartiallySucceeded"] = 4] = "PartiallySucceeded";
  BuildResult2[BuildResult2["Failed"] = 8] = "Failed";
  BuildResult2[BuildResult2["Canceled"] = 32] = "Canceled";
  return BuildResult2;
})(BuildResult || {});
var BuildStatus = /* @__PURE__ */ ((BuildStatus2) => {
  BuildStatus2[BuildStatus2["None"] = 0] = "None";
  BuildStatus2[BuildStatus2["InProgress"] = 1] = "InProgress";
  BuildStatus2[BuildStatus2["Completed"] = 2] = "Completed";
  BuildStatus2[BuildStatus2["Cancelling"] = 4] = "Cancelling";
  BuildStatus2[BuildStatus2["Postponed"] = 8] = "Postponed";
  BuildStatus2[BuildStatus2["NotStarted"] = 32] = "NotStarted";
  BuildStatus2[BuildStatus2["All"] = 47] = "All";
  return BuildStatus2;
})(BuildStatus || {});
var PullRequestStatus = /* @__PURE__ */ ((PullRequestStatus2) => {
  PullRequestStatus2[PullRequestStatus2["NotSet"] = 0] = "NotSet";
  PullRequestStatus2[PullRequestStatus2["Active"] = 1] = "Active";
  PullRequestStatus2[PullRequestStatus2["Abandoned"] = 2] = "Abandoned";
  PullRequestStatus2[PullRequestStatus2["Completed"] = 3] = "Completed";
  PullRequestStatus2[PullRequestStatus2["All"] = 4] = "All";
  return PullRequestStatus2;
})(PullRequestStatus || {});
var PolicyEvaluationStatus = /* @__PURE__ */ ((PolicyEvaluationStatus2) => {
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Queued"] = 0] = "Queued";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Running"] = 1] = "Running";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Approved"] = 2] = "Approved";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Rejected"] = 3] = "Rejected";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["NotApplicable"] = 4] = "NotApplicable";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Broken"] = 5] = "Broken";
  return PolicyEvaluationStatus2;
})(PolicyEvaluationStatus || {});
var PolicyType = /* @__PURE__ */ ((PolicyType2) => {
  PolicyType2["Build"] = "Build";
  PolicyType2["Status"] = "Status";
  PolicyType2["MinimumReviewers"] = "MinimumReviewers";
  PolicyType2["Comments"] = "Comments";
  PolicyType2["RequiredReviewers"] = "RequiredReviewers";
  PolicyType2["MergeStrategy"] = "MergeStrategy";
  return PolicyType2;
})(PolicyType || {});
var PolicyTypeId = /* @__PURE__ */ ((PolicyTypeId2) => {
  PolicyTypeId2["Build"] = "0609b952-1397-4640-95ec-e00a01b2c241";
  PolicyTypeId2["Status"] = "cbdc66da-9728-4af8-aada-9a5a32e4a226";
  PolicyTypeId2["MinimumReviewers"] = "fa4e907d-c16b-4a4c-9dfa-4906e5d171dd";
  PolicyTypeId2["Comments"] = "c6a1889d-b943-4856-b76f-9e46bb6b0df2";
  PolicyTypeId2["RequiredReviewers"] = "fd2167ab-b0be-447a-8ec8-39368250530e";
  PolicyTypeId2["MergeStrategy"] = "fa4e907d-c16b-4a4c-9dfa-4916e5d171ab";
  return PolicyTypeId2;
})(PolicyTypeId || {});
var PullRequestVoteStatus = /* @__PURE__ */ ((PullRequestVoteStatus2) => {
  PullRequestVoteStatus2[PullRequestVoteStatus2["Approved"] = 10] = "Approved";
  PullRequestVoteStatus2[PullRequestVoteStatus2["ApprovedWithSuggestions"] = 5] = "ApprovedWithSuggestions";
  PullRequestVoteStatus2[PullRequestVoteStatus2["NoVote"] = 0] = "NoVote";
  PullRequestVoteStatus2[PullRequestVoteStatus2["WaitingForAuthor"] = -5] = "WaitingForAuthor";
  PullRequestVoteStatus2[PullRequestVoteStatus2["Rejected"] = -10] = "Rejected";
  return PullRequestVoteStatus2;
})(PullRequestVoteStatus || {});

const AZURE_DEVOPS_BUILD_DEFINITION_ANNOTATION = "dev.azure.com/build-definition";
const AZURE_DEVOPS_HOST_ORG_ANNOTATION = "dev.azure.com/host-org";
const AZURE_DEVOPS_PROJECT_ANNOTATION = "dev.azure.com/project";
const AZURE_DEVOPS_README_ANNOTATION = "dev.azure.com/readme-path";
const AZURE_DEVOPS_REPO_ANNOTATION = "dev.azure.com/project-repo";
const AZURE_DEVOPS_DEFAULT_TOP = 10;

const azureDevOpsPullRequestReadPermission = require$$10.createPermission({
  name: "azure.devops.pullrequest.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPullRequestDashboardReadPermission = require$$10.createPermission({
  name: "azure.devops.pullrequest.dashboard.read",
  attributes: { action: "read" }
});
const azureDevOpsPipelineReadPermission = require$$10.createPermission({
  name: "azure.devops.pipeline.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsGitTagReadPermission = require$$10.createPermission({
  name: "azure.devops.gittag.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsReadmeReadPermission = require$$10.createPermission({
  name: "azure.devops.readme.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPermissions = [
  azureDevOpsPullRequestReadPermission,
  azureDevOpsPipelineReadPermission,
  azureDevOpsGitTagReadPermission,
  azureDevOpsReadmeReadPermission,
  azureDevOpsPullRequestDashboardReadPermission
];

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	AZURE_DEVOPS_BUILD_DEFINITION_ANNOTATION: AZURE_DEVOPS_BUILD_DEFINITION_ANNOTATION,
	AZURE_DEVOPS_DEFAULT_TOP: AZURE_DEVOPS_DEFAULT_TOP,
	AZURE_DEVOPS_HOST_ORG_ANNOTATION: AZURE_DEVOPS_HOST_ORG_ANNOTATION,
	AZURE_DEVOPS_PROJECT_ANNOTATION: AZURE_DEVOPS_PROJECT_ANNOTATION,
	AZURE_DEVOPS_README_ANNOTATION: AZURE_DEVOPS_README_ANNOTATION,
	AZURE_DEVOPS_REPO_ANNOTATION: AZURE_DEVOPS_REPO_ANNOTATION,
	BuildResult: BuildResult,
	BuildStatus: BuildStatus,
	PolicyEvaluationStatus: PolicyEvaluationStatus,
	PolicyType: PolicyType,
	PolicyTypeId: PolicyTypeId,
	PullRequestStatus: PullRequestStatus,
	PullRequestVoteStatus: PullRequestVoteStatus,
	azureDevOpsGitTagReadPermission: azureDevOpsGitTagReadPermission,
	azureDevOpsPermissions: azureDevOpsPermissions,
	azureDevOpsPipelineReadPermission: azureDevOpsPipelineReadPermission,
	azureDevOpsPullRequestDashboardReadPermission: azureDevOpsPullRequestDashboardReadPermission,
	azureDevOpsPullRequestReadPermission: azureDevOpsPullRequestReadPermission,
	azureDevOpsReadmeReadPermission: azureDevOpsReadmeReadPermission
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(index_esm);

Object.defineProperty(index_cjs, '__esModule', { value: true });

var pluginAzureDevopsCommon = require$$0;
var mime = require$$1;
var azureDevopsNodeApi = require$$2;
var integration = require$$3;
var limiterFactory = require$$4;
var Router = require$$5;
var backendCommon = require$$6;
var express = require$$7;
var errors = require$$8;
var pluginAuthNode = require$$9;
var pluginPermissionCommon = require$$10;
var pluginPermissionNode = require$$11;
var backendPluginApi = require$$12;
var lodash = require$$13;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var mime__default = /*#__PURE__*/_interopDefaultCompat(mime);
var limiterFactory__default = /*#__PURE__*/_interopDefaultCompat(limiterFactory);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var express__default = /*#__PURE__*/_interopDefaultCompat(express);

function convertDashboardPullRequest(pullRequest, baseUrl, policies) {
  var _a;
  return {
    pullRequestId: pullRequest.pullRequestId,
    title: pullRequest.title,
    description: pullRequest.description,
    repository: convertRepository(pullRequest.repository),
    createdBy: convertCreatedBy(pullRequest.createdBy),
    hasAutoComplete: hasAutoComplete(pullRequest),
    policies,
    reviewers: convertReviewers(pullRequest.reviewers),
    creationDate: (_a = pullRequest.creationDate) == null ? void 0 : _a.toISOString(),
    status: pullRequest.status,
    isDraft: pullRequest.isDraft,
    link: getPullRequestLink(baseUrl, pullRequest)
  };
}
function getPullRequestLink(baseUrl, pullRequest) {
  var _a, _b, _c;
  const projectName = (_b = (_a = pullRequest.repository) == null ? void 0 : _a.project) == null ? void 0 : _b.name;
  const repoName = (_c = pullRequest.repository) == null ? void 0 : _c.name;
  const pullRequestId = pullRequest.pullRequestId;
  if (!projectName || !repoName || !pullRequestId) {
    return void 0;
  }
  const encodedProjectName = encodeURIComponent(projectName);
  const encodedRepoName = encodeURIComponent(repoName);
  return `${baseUrl}/${encodedProjectName}/_git/${encodedRepoName}/pullrequest/${pullRequestId}`;
}
function getAvatarUrl(identity) {
  var _a, _b, _c;
  return (_c = (_b = (_a = identity._links) == null ? void 0 : _a.avatar) == null ? void 0 : _b.href) != null ? _c : identity.imageUrl;
}
function getArtifactId(projectId, pullRequestId) {
  return `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequestId}`;
}
function convertPolicy(policyEvaluationRecord) {
  var _a, _b, _c, _d, _e;
  const policyConfig = policyEvaluationRecord.configuration;
  const policyStatus = policyEvaluationRecord.status;
  if (!policyConfig) {
    return void 0;
  }
  if (!(policyConfig.isEnabled && !policyConfig.isDeleted && (policyConfig.isBlocking || ((_a = policyConfig.type) == null ? void 0 : _a.id) === pluginAzureDevopsCommon.PolicyType.Status) && // Optional "Status" policies are actually required for automatic completion.
  policyStatus !== pluginAzureDevopsCommon.PolicyEvaluationStatus.Approved)) {
    return void 0;
  }
  const policyTypeId = (_b = policyConfig.type) == null ? void 0 : _b.id;
  if (!policyTypeId) {
    return void 0;
  }
  const policyType = {
    [pluginAzureDevopsCommon.PolicyTypeId.Build]: pluginAzureDevopsCommon.PolicyType.Build,
    [pluginAzureDevopsCommon.PolicyTypeId.Status]: pluginAzureDevopsCommon.PolicyType.Status,
    [pluginAzureDevopsCommon.PolicyTypeId.MinimumReviewers]: pluginAzureDevopsCommon.PolicyType.MinimumReviewers,
    [pluginAzureDevopsCommon.PolicyTypeId.Comments]: pluginAzureDevopsCommon.PolicyType.Comments,
    [pluginAzureDevopsCommon.PolicyTypeId.RequiredReviewers]: pluginAzureDevopsCommon.PolicyType.RequiredReviewers,
    [pluginAzureDevopsCommon.PolicyTypeId.MergeStrategy]: pluginAzureDevopsCommon.PolicyType.MergeStrategy
  }[policyTypeId];
  if (!policyType) {
    return void 0;
  }
  const policyConfigSettings = policyConfig.settings;
  let policyText = (_c = policyConfig.type) == null ? void 0 : _c.displayName;
  let policyLink;
  switch (policyType) {
    case pluginAzureDevopsCommon.PolicyType.Build: {
      const buildDisplayName = policyConfigSettings.displayName;
      if (buildDisplayName) {
        policyText += `: ${buildDisplayName}`;
      }
      const buildId = (_d = policyEvaluationRecord.context) == null ? void 0 : _d.buildId;
      const policyConfigUrl = policyConfig.url;
      if (buildId && policyConfigUrl) {
        policyLink = policyConfigUrl.replace(
          `_apis/policy/configurations/${policyConfig.id}`,
          `_build/results?buildId=${buildId}`
        );
      }
      if (!policyStatus) {
        break;
      }
      const buildExpired = Boolean(policyConfigSettings.isExpired);
      const buildPolicyStatus = (_e = {
        [pluginAzureDevopsCommon.PolicyEvaluationStatus.Queued]: buildExpired ? "expired" : "queued",
        [pluginAzureDevopsCommon.PolicyEvaluationStatus.Rejected]: "failed"
      }[policyStatus]) != null ? _e : pluginAzureDevopsCommon.PolicyEvaluationStatus[policyStatus].toLowerCase();
      policyText += ` (${buildPolicyStatus})`;
      break;
    }
    case pluginAzureDevopsCommon.PolicyType.Status: {
      const statusGenre = policyConfigSettings.statusGenre;
      const statusName = policyConfigSettings.statusGenre;
      if (statusName) {
        policyText += `: ${statusGenre}/${statusName}`;
      }
      break;
    }
    case pluginAzureDevopsCommon.PolicyType.MinimumReviewers: {
      const minimumApproverCount = policyConfigSettings.minimumApproverCount;
      policyText += ` (${minimumApproverCount})`;
      break;
    }
    case pluginAzureDevopsCommon.PolicyType.Comments:
      break;
    case pluginAzureDevopsCommon.PolicyType.RequiredReviewers:
      break;
    case pluginAzureDevopsCommon.PolicyType.MergeStrategy:
    default:
      return void 0;
  }
  return {
    id: policyConfig.id,
    type: policyType,
    status: policyStatus,
    text: policyText,
    link: policyLink
  };
}
async function replaceReadme(urlReader, host, org, project, repo, readmeContent) {
  const filesPath = extractAssets(readmeContent);
  if (!filesPath)
    return readmeContent;
  return await filesPath.reduce(
    async (promise, filePath) => promise.then(async (content) => {
      const { label, path, ext } = extractPartsFromAsset(filePath);
      const data = mime__default.default.lookup(ext);
      const url = buildEncodedUrl(host, org, project, repo, path + ext);
      const response = await urlReader.readUrl(url);
      const buffer = await response.buffer();
      const file = buffer.toString("base64");
      return content.replace(
        filePath,
        `[${label}](data:${data};base64,${file})`
      );
    }),
    Promise.resolve(readmeContent)
  );
}
function buildEncodedUrl(host, org, project, repo, path) {
  const encodedOrg = encodeURIComponent(org);
  const encodedProject = encodeURIComponent(project);
  const encodedRepo = encodeURIComponent(repo);
  const encodedPath = encodeURIComponent(path);
  return `https://${host}/${encodedOrg}/${encodedProject}/_git/${encodedRepo}?path=${encodedPath}`;
}
function convertReviewer(identityRef) {
  var _a;
  if (!identityRef) {
    return void 0;
  }
  return {
    id: identityRef.id,
    displayName: identityRef.displayName,
    uniqueName: identityRef.uniqueName,
    imageUrl: getAvatarUrl(identityRef),
    isRequired: identityRef.isRequired,
    isContainer: identityRef.isContainer,
    voteStatus: (_a = identityRef.vote) != null ? _a : 0
  };
}
function convertReviewers(identityRefs) {
  if (!identityRefs) {
    return void 0;
  }
  return identityRefs.map(convertReviewer).filter((reviewer) => Boolean(reviewer));
}
function convertRepository(repository) {
  var _a;
  if (!repository) {
    return void 0;
  }
  return {
    id: repository.id,
    name: repository.name,
    url: (_a = repository.url) == null ? void 0 : _a.replace("_apis/git/repositories", "_git")
  };
}
function convertCreatedBy(identityRef) {
  if (!identityRef) {
    return void 0;
  }
  return {
    id: identityRef.id,
    displayName: identityRef.displayName,
    uniqueName: identityRef.uniqueName,
    imageUrl: getAvatarUrl(identityRef)
  };
}
function hasAutoComplete(pullRequest) {
  return pullRequest.isDraft !== true && !!pullRequest.completionOptions;
}
function extractAssets(content) {
  const regExp = /\[([^\[\]]*)\]\((?!https?:\/\/)(.*?)(\.png|\.jpg|\.jpeg|\.gif|\.webp)(.*)\)/gim;
  return content.match(regExp);
}
function extractPartsFromAsset(content) {
  const regExp = /\[(.*?)\]\((?!https?:\/\/)(.*?)(\.png|\.jpg|\.jpeg|\.gif|\.webp)(.*)\)/i;
  const [_, label, path, ext] = regExp.exec(content) || [];
  return {
    ext,
    label,
    path: path.startsWith("./") ? path.substring(1, path.length) : path
  };
}
function parseAzureDevOpsUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  let host = url.host;
  let org;
  let project;
  let repo;
  const parts = url.pathname.split("/").map((part) => decodeURIComponent(part));
  if (parts[2] === "_git") {
    org = parts[1];
    project = repo = parts[3];
  } else if (parts[3] === "_git") {
    org = parts[1];
    project = parts[2];
    repo = parts[4];
  } else if (parts[4] === "_git") {
    host = `${host}/${parts[1]}`;
    org = parts[2];
    project = parts[3];
    repo = parts[5];
  }
  return { host, org, project, repo };
}

function mappedRepoBuild(build) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  return {
    id: build.id,
    title: [(_a = build.definition) == null ? void 0 : _a.name, build.buildNumber].filter(Boolean).join(" - "),
    link: (_c = (_b = build._links) == null ? void 0 : _b.web.href) != null ? _c : "",
    status: (_d = build.status) != null ? _d : pluginAzureDevopsCommon.BuildStatus.None,
    result: (_e = build.result) != null ? _e : pluginAzureDevopsCommon.BuildResult.None,
    queueTime: (_f = build.queueTime) == null ? void 0 : _f.toISOString(),
    startTime: (_g = build.startTime) == null ? void 0 : _g.toISOString(),
    finishTime: (_h = build.finishTime) == null ? void 0 : _h.toISOString(),
    source: `${build.sourceBranch} (${(_i = build.sourceVersion) == null ? void 0 : _i.slice(0, 8)})`,
    uniqueName: (_k = (_j = build.requestedFor) == null ? void 0 : _j.uniqueName) != null ? _k : "N/A"
  };
}
function mappedGitTag(gitRef, linkBaseUrl, commitBaseUrl) {
  var _a, _b, _c, _d, _e, _f;
  return {
    objectId: gitRef.objectId,
    peeledObjectId: gitRef.peeledObjectId,
    name: (_a = gitRef.name) == null ? void 0 : _a.replace("refs/tags/", ""),
    createdBy: (_c = (_b = gitRef.creator) == null ? void 0 : _b.displayName) != null ? _c : "N/A",
    link: `${linkBaseUrl}${encodeURIComponent(
      (_e = (_d = gitRef.name) == null ? void 0 : _d.replace("refs/tags/", "")) != null ? _e : ""
    )}`,
    commitLink: `${commitBaseUrl}/${encodeURIComponent(
      (_f = gitRef.peeledObjectId) != null ? _f : ""
    )}`
  };
}
function mappedPullRequest(pullRequest, linkBaseUrl) {
  var _a, _b, _c, _d, _e, _f;
  return {
    pullRequestId: pullRequest.pullRequestId,
    repoName: (_a = pullRequest.repository) == null ? void 0 : _a.name,
    title: pullRequest.title,
    uniqueName: (_c = (_b = pullRequest.createdBy) == null ? void 0 : _b.uniqueName) != null ? _c : "N/A",
    createdBy: (_e = (_d = pullRequest.createdBy) == null ? void 0 : _d.displayName) != null ? _e : "N/A",
    creationDate: (_f = pullRequest.creationDate) == null ? void 0 : _f.toISOString(),
    sourceRefName: pullRequest.sourceRefName,
    targetRefName: pullRequest.targetRefName,
    status: pullRequest.status,
    isDraft: pullRequest.isDraft,
    link: `${linkBaseUrl}/${pullRequest.pullRequestId}`
  };
}
function mappedBuildRun(build) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  return {
    id: build.id,
    title: [(_a = build.definition) == null ? void 0 : _a.name, build.buildNumber].filter(Boolean).join(" - "),
    link: (_c = (_b = build._links) == null ? void 0 : _b.web.href) != null ? _c : "",
    status: (_d = build.status) != null ? _d : pluginAzureDevopsCommon.BuildStatus.None,
    result: (_e = build.result) != null ? _e : pluginAzureDevopsCommon.BuildResult.None,
    queueTime: (_f = build.queueTime) == null ? void 0 : _f.toISOString(),
    startTime: (_g = build.startTime) == null ? void 0 : _g.toISOString(),
    finishTime: (_h = build.finishTime) == null ? void 0 : _h.toISOString(),
    source: `${build.sourceBranch} (${(_i = build.sourceVersion) == null ? void 0 : _i.slice(0, 8)})`,
    uniqueName: (_k = (_j = build.requestedFor) == null ? void 0 : _j.uniqueName) != null ? _k : "N/A"
  };
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class AzureDevOpsApi {
  constructor(logger, urlReader, config, credentialsProvider) {
    __publicField$1(this, "logger");
    __publicField$1(this, "urlReader");
    __publicField$1(this, "config");
    __publicField$1(this, "credentialsProvider");
    this.logger = logger;
    this.urlReader = urlReader;
    this.config = config;
    this.credentialsProvider = credentialsProvider;
  }
  static fromConfig(config, options) {
    const scmIntegrations = integration.ScmIntegrations.fromConfig(config);
    const credentialsProvider = integration.DefaultAzureDevOpsCredentialsProvider.fromIntegrations(scmIntegrations);
    return new AzureDevOpsApi(
      options.logger,
      options.urlReader,
      config,
      credentialsProvider
    );
  }
  async getWebApi(host, org) {
    const validHost = host != null ? host : this.config.getOptionalString("azureDevOps.host");
    const validOrg = org != null ? org : this.config.getOptionalString("azureDevOps.organization");
    if (!validHost || !validOrg) {
      throw new Error(
        "No 'host' or 'org' provided in annotations or configuration, unable to retrieve needed credentials"
      );
    }
    const url = `https://${validHost}/${encodeURIComponent(validOrg)}`;
    const credentials = await this.credentialsProvider.getCredentials({
      url
    });
    let authHandler;
    if (!credentials) {
      const token = this.config.getOptionalString("azureDevOps.token");
      if (!token) {
        throw new Error(
          "No 'azureDevOps.token' provided in configuration and credentials were not found in 'integrations.azure', unable to proceed"
        );
      }
      this.logger.warn(
        "Using the token from 'azureDevOps.token' has been deprecated, use 'integrations.azure' instead, for more details see: https://backstage.io/docs/integrations/azure/locations"
      );
      authHandler = azureDevopsNodeApi.getPersonalAccessTokenHandler(token);
    } else {
      authHandler = azureDevopsNodeApi.getHandlerFromToken(credentials.token);
    }
    const webApi = new azureDevopsNodeApi.WebApi(url, authHandler);
    return webApi;
  }
  async getProjects(host, org) {
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getCoreApi();
    const projectList = await client.getProjects();
    const projects = projectList.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description
    }));
    return projects.sort(
      (a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0
    );
  }
  async getGitRepository(projectName, repoName, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting Repository ${repoName} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    return client.getRepository(repoName, projectName);
  }
  async getBuildList(projectName, repoId, top, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository Id ${repoId} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getBuilds(
      projectName,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      top,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      repoId,
      "TfsGit"
    );
  }
  async getRepoBuilds(projectName, repoName, top, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    const buildList = await this.getBuildList(
      projectName,
      gitRepository.id,
      top,
      host,
      org
    );
    const repoBuilds = buildList.map((build) => {
      return mappedRepoBuild(build);
    });
    return repoBuilds;
  }
  async getGitTags(projectName, repoName, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting Git Tags for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    const tagRefs = await client.getRefs(
      gitRepository.id,
      projectName,
      "tags",
      false,
      false,
      false,
      false,
      true
    );
    const linkBaseUrl = `${webApi.serverUrl}/${encodeURIComponent(
      projectName
    )}/_git/${encodeURIComponent(repoName)}?version=GT`;
    const commitBaseUrl = `${webApi.serverUrl}/${encodeURIComponent(
      projectName
    )}/_git/${encodeURIComponent(repoName)}/commit`;
    const gitTags = tagRefs.map((tagRef) => {
      return mappedGitTag(tagRef, linkBaseUrl, commitBaseUrl);
    });
    return gitTags;
  }
  async getPullRequests(projectName, repoName, options, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting up to ${options.top} Pull Requests for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    const searchCriteria = {
      status: options.status
    };
    const gitPullRequests = await client.getPullRequests(
      gitRepository.id,
      searchCriteria,
      projectName,
      void 0,
      void 0,
      options.top
    );
    const linkBaseUrl = `${webApi.serverUrl}/${encodeURIComponent(
      projectName
    )}/_git/${encodeURIComponent(repoName)}/pullrequest`;
    const pullRequests = gitPullRequests.map((gitPullRequest) => {
      return mappedPullRequest(gitPullRequest, linkBaseUrl);
    });
    return pullRequests;
  }
  async getDashboardPullRequests(projectName, options) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Getting dashboard pull requests for project '${projectName}'.`
    );
    const webApi = await this.getWebApi();
    const client = await webApi.getGitApi();
    const searchCriteria = {
      status: options.status
    };
    const gitPullRequests = await client.getPullRequestsByProject(
      projectName,
      searchCriteria,
      void 0,
      void 0,
      options.top
    );
    return Promise.all(
      gitPullRequests.map(async (gitPullRequest) => {
        var _a2, _b;
        const projectId = (_b = (_a2 = gitPullRequest.repository) == null ? void 0 : _a2.project) == null ? void 0 : _b.id;
        const prId = gitPullRequest.pullRequestId;
        let policies;
        if (projectId && prId) {
          policies = await this.getPullRequestPolicies(
            projectName,
            projectId,
            prId
          );
        }
        return convertDashboardPullRequest(
          gitPullRequest,
          webApi.serverUrl,
          policies
        );
      })
    );
  }
  async getPullRequestPolicies(projectName, projectId, pullRequestId) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Getting pull request policies for pull request id '${pullRequestId}'.`
    );
    const webApi = await this.getWebApi();
    const client = await webApi.getPolicyApi();
    const artifactId = getArtifactId(projectId, pullRequestId);
    const policyEvaluationRecords = await client.getPolicyEvaluations(projectName, artifactId);
    return policyEvaluationRecords.map(convertPolicy).filter((policy) => Boolean(policy));
  }
  async getAllTeams() {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug("Getting all teams.");
    const webApi = await this.getWebApi();
    const client = await webApi.getCoreApi();
    const webApiTeams = await client.getAllTeams();
    const teams = webApiTeams.map((team) => ({
      id: team.id,
      name: team.name,
      projectId: team.projectId,
      projectName: team.projectName
    }));
    return teams.sort(
      (a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0
    );
  }
  async getTeamMembers(options) {
    var _a;
    const { projectId, teamId } = options;
    (_a = this.logger) == null ? void 0 : _a.debug(`Getting team member ids for team '${teamId}'.`);
    const webApi = await this.getWebApi();
    const client = await webApi.getCoreApi();
    const teamMembers = await client.getTeamMembersWithExtendedProperties(projectId, teamId);
    return teamMembers.map((teamMember) => {
      var _a2, _b, _c;
      return {
        id: (_a2 = teamMember.identity) == null ? void 0 : _a2.id,
        displayName: (_b = teamMember.identity) == null ? void 0 : _b.displayName,
        uniqueName: (_c = teamMember.identity) == null ? void 0 : _c.uniqueName
      };
    });
  }
  async getBuildDefinitions(projectName, definitionName, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting Build Definitions for ${definitionName} in Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getDefinitions(projectName, definitionName);
  }
  async getBuilds(projectName, top, repoId, definitions, host, org) {
    var _a;
    (_a = this.logger) == null ? void 0 : _a.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository Id ${repoId} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getBuilds(
      projectName,
      definitions,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      top,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      repoId,
      repoId ? "TfsGit" : void 0
    );
  }
  async getBuildRuns(projectName, top, repoName, definitionName, host, org) {
    let repoId;
    let definitions;
    if (repoName) {
      const gitRepository = await this.getGitRepository(
        projectName,
        repoName,
        host,
        org
      );
      repoId = gitRepository.id;
    }
    if (definitionName) {
      const buildDefinitions = await this.getBuildDefinitions(
        projectName,
        definitionName,
        host,
        org
      );
      definitions = buildDefinitions.map((bd) => bd.id).filter((bd) => Boolean(bd));
    }
    const builds = await this.getBuilds(
      projectName,
      top,
      repoId,
      definitions,
      host,
      org
    );
    const buildRuns = builds.map(mappedBuildRun);
    return buildRuns;
  }
  async getReadme(host, org, project, repo, path) {
    const url = buildEncodedUrl(host, org, project, repo, path);
    const response = await this.urlReader.readUrl(url);
    const buffer = await response.buffer();
    const content = await replaceReadme(
      this.urlReader,
      host,
      org,
      project,
      repo,
      buffer.toString()
    );
    return { url, content };
  }
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class PullRequestsDashboardProvider {
  constructor(logger, azureDevOpsApi) {
    this.logger = logger;
    this.azureDevOpsApi = azureDevOpsApi;
    __publicField(this, "teams", /* @__PURE__ */ new Map());
    __publicField(this, "teamMembers", /* @__PURE__ */ new Map());
  }
  static async create(logger, azureDevOpsApi) {
    const provider = new PullRequestsDashboardProvider(logger, azureDevOpsApi);
    return provider;
  }
  async readTeams() {
    this.logger.info("Reading teams.");
    let teams = await this.azureDevOpsApi.getAllTeams();
    teams = teams.filter(
      (team) => team.name && team.projectName ? team.name !== `${team.projectName} Team` : true
    );
    this.teams = /* @__PURE__ */ new Map();
    this.teamMembers = /* @__PURE__ */ new Map();
    const limiter = limiterFactory__default.default(5);
    await Promise.all(
      teams.map(
        (team) => limiter(async () => {
          const teamId = team.id;
          const projectId = team.projectId;
          if (teamId) {
            let teamMembers;
            if (projectId) {
              teamMembers = await this.azureDevOpsApi.getTeamMembers({
                projectId,
                teamId
              });
            }
            if (teamMembers) {
              team.members = teamMembers.reduce((arr, teamMember) => {
                var _a, _b;
                const teamMemberId = teamMember.id;
                if (teamMemberId) {
                  arr.push(teamMemberId);
                  const memberOf = [
                    ...(_b = (_a = this.teamMembers.get(teamMemberId)) == null ? void 0 : _a.memberOf) != null ? _b : [],
                    teamId
                  ];
                  this.teamMembers.set(teamMemberId, {
                    ...teamMember,
                    memberOf
                  });
                }
                return arr;
              }, []);
              this.teams.set(teamId, team);
            }
          }
        })
      )
    );
  }
  async getDashboardPullRequests(projectName, options) {
    const dashboardPullRequests = await this.azureDevOpsApi.getDashboardPullRequests(projectName, options);
    await this.getAllTeams();
    return dashboardPullRequests.map((pr) => {
      var _a, _b;
      if ((_a = pr.createdBy) == null ? void 0 : _a.id) {
        const teamIds = (_b = this.teamMembers.get(pr.createdBy.id)) == null ? void 0 : _b.memberOf;
        pr.createdBy.teamIds = teamIds;
        pr.createdBy.teamNames = teamIds == null ? void 0 : teamIds.map(
          (teamId) => {
            var _a2, _b2;
            return (_b2 = (_a2 = this.teams.get(teamId)) == null ? void 0 : _a2.name) != null ? _b2 : "";
          }
        );
      }
      return pr;
    });
  }
  async getUserTeamIds(email) {
    var _a, _b;
    await this.getAllTeams();
    return (_b = (_a = Array.from(this.teamMembers.values()).find(
      (teamMember) => teamMember.uniqueName === email
    )) == null ? void 0 : _a.memberOf) != null ? _b : [];
  }
  async getAllTeams() {
    if (!this.teams.size) {
      await this.readTeams();
    }
    return Array.from(this.teams.values());
  }
}

const DEFAULT_TOP = 10;
async function createRouter(options) {
  const { logger, reader, config, permissions } = options;
  if (config.getString("azureDevOps.token")) {
    logger.warn(
      "The 'azureDevOps.token' has been deprecated, use 'integrations.azure' instead, for more details see: https://backstage.io/docs/integrations/azure/locations"
    );
  }
  const permissionIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: pluginAzureDevopsCommon.azureDevOpsPermissions
  });
  const azureDevOpsApi = options.azureDevOpsApi || AzureDevOpsApi.fromConfig(config, { logger, urlReader: reader });
  const pullRequestsDashboardProvider = await PullRequestsDashboardProvider.create(logger, azureDevOpsApi);
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.use(permissionIntegrationRouter);
  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  router.get("/projects", async (_req, res) => {
    const projects = await azureDevOpsApi.getProjects();
    res.status(200).json(projects);
  });
  router.get("/repository/:projectName/:repoName", async (req, res) => {
    const { projectName, repoName } = req.params;
    const gitRepository = await azureDevOpsApi.getGitRepository(
      projectName,
      repoName
    );
    res.status(200).json(gitRepository);
  });
  router.get("/builds/:projectName/:repoId", async (req, res) => {
    var _a, _b;
    const { projectName, repoId } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = (_a = req.query.host) == null ? void 0 : _a.toString();
    const org = (_b = req.query.org) == null ? void 0 : _b.toString();
    const buildList = await azureDevOpsApi.getBuildList(
      projectName,
      repoId,
      top,
      host,
      org
    );
    res.status(200).json(buildList);
  });
  router.get("/repo-builds/:projectName/:repoName", async (req, res) => {
    var _a, _b;
    const { projectName, repoName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = (_a = req.query.host) == null ? void 0 : _a.toString();
    const org = (_b = req.query.org) == null ? void 0 : _b.toString();
    const gitRepository = await azureDevOpsApi.getRepoBuilds(
      projectName,
      repoName,
      top,
      host,
      org
    );
    res.status(200).json(gitRepository);
  });
  router.get("/git-tags/:projectName/:repoName", async (req, res) => {
    var _a, _b;
    const { projectName, repoName } = req.params;
    const host = (_a = req.query.host) == null ? void 0 : _a.toString();
    const org = (_b = req.query.org) == null ? void 0 : _b.toString();
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const token = pluginAuthNode.getBearerTokenFromAuthorizationHeader(
      req.header("authorization")
    );
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsGitTagReadPermission,
          resourceRef: entityRef
        }
      ],
      {
        token
      }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const gitTags = await azureDevOpsApi.getGitTags(
      projectName,
      repoName,
      host,
      org
    );
    res.status(200).json(gitTags);
  });
  router.get("/pull-requests/:projectName/:repoName", async (req, res) => {
    var _a, _b;
    const { projectName, repoName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = (_a = req.query.host) == null ? void 0 : _a.toString();
    const org = (_b = req.query.org) == null ? void 0 : _b.toString();
    const status = req.query.status ? Number(req.query.status) : pluginAzureDevopsCommon.PullRequestStatus.Active;
    const pullRequestOptions = {
      top,
      status
    };
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const token = pluginAuthNode.getBearerTokenFromAuthorizationHeader(
      req.header("authorization")
    );
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestReadPermission,
          resourceRef: entityRef
        }
      ],
      {
        token
      }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const gitPullRequest = await azureDevOpsApi.getPullRequests(
      projectName,
      repoName,
      pullRequestOptions,
      host,
      org
    );
    res.status(200).json(gitPullRequest);
  });
  router.get("/dashboard-pull-requests/:projectName", async (req, res) => {
    const { projectName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const status = req.query.status ? Number(req.query.status) : pluginAzureDevopsCommon.PullRequestStatus.Active;
    const pullRequestOptions = {
      top,
      status
    };
    const token = pluginAuthNode.getBearerTokenFromAuthorizationHeader(
      req.header("authorization")
    );
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestDashboardReadPermission
        }
      ],
      {
        token
      }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const pullRequests = await pullRequestsDashboardProvider.getDashboardPullRequests(
      projectName,
      pullRequestOptions
    );
    res.status(200).json(pullRequests);
  });
  router.get("/all-teams", async (_req, res) => {
    const allTeams = await pullRequestsDashboardProvider.getAllTeams();
    res.status(200).json(allTeams);
  });
  router.get(
    "/build-definitions/:projectName/:definitionName",
    async (req, res) => {
      var _a, _b;
      const { projectName, definitionName } = req.params;
      const host = (_a = req.query.host) == null ? void 0 : _a.toString();
      const org = (_b = req.query.org) == null ? void 0 : _b.toString();
      const buildDefinitionList = await azureDevOpsApi.getBuildDefinitions(
        projectName,
        definitionName,
        host,
        org
      );
      res.status(200).json(buildDefinitionList);
    }
  );
  router.get("/builds/:projectName", async (req, res) => {
    var _a, _b, _c, _d;
    const { projectName } = req.params;
    const repoName = (_a = req.query.repoName) == null ? void 0 : _a.toString();
    const definitionName = (_b = req.query.definitionName) == null ? void 0 : _b.toString();
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = (_c = req.query.host) == null ? void 0 : _c.toString();
    const org = (_d = req.query.org) == null ? void 0 : _d.toString();
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const token = pluginAuthNode.getBearerTokenFromAuthorizationHeader(
      req.header("authorization")
    );
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPipelineReadPermission,
          resourceRef: entityRef
        }
      ],
      {
        token
      }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const builds = await azureDevOpsApi.getBuildRuns(
      projectName,
      top,
      repoName,
      definitionName,
      host,
      org
    );
    res.status(200).json(builds);
  });
  router.get("/users/:userId/team-ids", async (req, res) => {
    const { userId } = req.params;
    const teamIds = await pullRequestsDashboardProvider.getUserTeamIds(userId);
    res.status(200).json(teamIds);
  });
  router.get("/readme/:projectName/:repoName", async (req, res) => {
    var _a, _b, _c, _d;
    const host = (_b = (_a = req.query.host) == null ? void 0 : _a.toString()) != null ? _b : config.getString("azureDevOps.host");
    const org = (_d = (_c = req.query.org) == null ? void 0 : _c.toString()) != null ? _d : config.getString("azureDevOps.organization");
    let path = req.query.path;
    if (path === void 0) {
      path = "README.md";
    }
    if (typeof path !== "string") {
      throw new errors.InputError("Invalid path param");
    }
    if (path === "") {
      throw new errors.InputError("If present, the path param should not be empty");
    }
    const { projectName, repoName } = req.params;
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const token = pluginAuthNode.getBearerTokenFromAuthorizationHeader(
      req.header("authorization")
    );
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestReadPermission,
          resourceRef: entityRef
        }
      ],
      {
        token
      }
    ))[0];
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const readme = await azureDevOpsApi.getReadme(
      host,
      org,
      projectName,
      repoName,
      path
    );
    res.status(200).json(readme);
  });
  router.use(backendCommon.errorHandler());
  return router;
}

const azureDevOpsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "azure-devops",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        reader: backendPluginApi.coreServices.urlReader,
        permissions: backendPluginApi.coreServices.permissions,
        httpRouter: backendPluginApi.coreServices.httpRouter
      },
      async init({ config, logger, reader, permissions, httpRouter }) {
        httpRouter.use(
          await createRouter({
            config,
            logger: backendCommon.loggerToWinstonLogger(logger),
            reader,
            permissions
          })
        );
        httpRouter.addAuthPolicy({
          path: "/health",
          allow: "unauthenticated"
        });
      }
    });
  }
});

class AzureDevOpsAnnotatorProcessor {
  constructor(opts) {
    this.opts = opts;
  }
  getProcessorName() {
    return "AzureDevOpsAnnotatorProcessor";
  }
  static fromConfig(config, options) {
    return new AzureDevOpsAnnotatorProcessor({
      scmIntegrationRegistry: integration.ScmIntegrations.fromConfig(config),
      kinds: options == null ? void 0 : options.kinds
    });
  }
  async preProcessEntity(entity, location) {
    var _a, _b, _c;
    const applicableKinds = ((_a = this.opts.kinds) != null ? _a : ["Component"]).map(
      (k) => k.toLocaleLowerCase("en-US")
    );
    if (!applicableKinds.includes(entity.kind.toLocaleLowerCase("en-US")) || location.type !== "url") {
      return entity;
    }
    const scmIntegration = this.opts.scmIntegrationRegistry.byUrl(
      location.target
    );
    if (!scmIntegration) {
      return entity;
    }
    if (scmIntegration.type !== "azure") {
      return entity;
    }
    const { host, org, project, repo } = parseAzureDevOpsUrl(location.target);
    if (!org || !project || !repo) {
      return entity;
    }
    const hostOrgAnnotation = pluginAzureDevopsCommon.AZURE_DEVOPS_HOST_ORG_ANNOTATION;
    let hostOrgValue = (_b = entity.metadata.annotations) == null ? void 0 : _b[hostOrgAnnotation];
    if (!hostOrgValue) {
      hostOrgValue = `${host}/${org}`;
    }
    const projectRepoAnnotation = pluginAzureDevopsCommon.AZURE_DEVOPS_REPO_ANNOTATION;
    let projectRepoValue = (_c = entity.metadata.annotations) == null ? void 0 : _c[projectRepoAnnotation];
    if (!projectRepoValue) {
      projectRepoValue = `${project}/${repo}`;
    }
    const result = lodash.merge(
      {
        metadata: {
          annotations: lodash.pickBy(
            {
              [hostOrgAnnotation]: hostOrgValue
            },
            lodash.identity
          )
        }
      },
      entity
    );
    return lodash.merge(
      {
        metadata: {
          annotations: lodash.pickBy(
            {
              [projectRepoAnnotation]: projectRepoValue
            },
            lodash.identity
          )
        }
      },
      result
    );
  }
}

index_cjs.AzureDevOpsAnnotatorProcessor = AzureDevOpsAnnotatorProcessor;
index_cjs.AzureDevOpsApi = AzureDevOpsApi;
index_cjs.createRouter = createRouter;
var _default = index_cjs.default = azureDevOpsPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
