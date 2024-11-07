'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$7 = require('@backstage/plugin-permission-common');
var alpha = require('@backstage/plugin-catalog-common/alpha');
var require$$1 = require('mime-types');
var require$$1$1 = require('azure-devops-node-api');
var require$$2 = require('@backstage/integration');
var require$$0$1 = require('p-limit');
var require$$3 = require('express-promise-router');
var require$$4 = require('@backstage/backend-common');
var require$$5 = require('express');
var require$$6 = require('@backstage/errors');
var require$$8 = require('@backstage/plugin-permission-node');
var require$$9 = require('@backstage/backend-defaults/rootHttpRouter');
var require$$0$2 = require('@backstage/backend-plugin-api');

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

var AzureDevOpsApi_cjs = {};

var azureDevopsUtils_cjs = {};

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

const azureDevOpsPullRequestReadPermission = require$$7.createPermission({
  name: "azure.devops.pullrequest.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsPullRequestDashboardReadPermission = require$$7.createPermission({
  name: "azure.devops.pullrequest.dashboard.read",
  attributes: { action: "read" }
});
const azureDevOpsPipelineReadPermission = require$$7.createPermission({
  name: "azure.devops.pipeline.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsGitTagReadPermission = require$$7.createPermission({
  name: "azure.devops.gittag.read",
  attributes: { action: "read" },
  resourceType: alpha.RESOURCE_TYPE_CATALOG_ENTITY
});
const azureDevOpsReadmeReadPermission = require$$7.createPermission({
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
	BuildResult: BuildResult,
	BuildStatus: BuildStatus,
	PolicyEvaluationStatus: PolicyEvaluationStatus,
	PolicyType: PolicyType,
	PolicyTypeId: PolicyTypeId,
	PullRequestStatus: PullRequestStatus,
	PullRequestVoteStatus: PullRequestVoteStatus,
	AZURE_DEVOPS_BUILD_DEFINITION_ANNOTATION: AZURE_DEVOPS_BUILD_DEFINITION_ANNOTATION,
	AZURE_DEVOPS_DEFAULT_TOP: AZURE_DEVOPS_DEFAULT_TOP,
	AZURE_DEVOPS_HOST_ORG_ANNOTATION: AZURE_DEVOPS_HOST_ORG_ANNOTATION,
	AZURE_DEVOPS_PROJECT_ANNOTATION: AZURE_DEVOPS_PROJECT_ANNOTATION,
	AZURE_DEVOPS_README_ANNOTATION: AZURE_DEVOPS_README_ANNOTATION,
	AZURE_DEVOPS_REPO_ANNOTATION: AZURE_DEVOPS_REPO_ANNOTATION,
	azureDevOpsGitTagReadPermission: azureDevOpsGitTagReadPermission,
	azureDevOpsPermissions: azureDevOpsPermissions,
	azureDevOpsPipelineReadPermission: azureDevOpsPipelineReadPermission,
	azureDevOpsPullRequestDashboardReadPermission: azureDevOpsPullRequestDashboardReadPermission,
	azureDevOpsPullRequestReadPermission: azureDevOpsPullRequestReadPermission,
	azureDevOpsReadmeReadPermission: azureDevOpsReadmeReadPermission
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var pluginAzureDevopsCommon$2 = require$$0;
var mime = require$$1;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var mime__default = /*#__PURE__*/_interopDefaultCompat$2(mime);

function convertDashboardPullRequest(pullRequest, baseUrl, policies) {
  return {
    pullRequestId: pullRequest.pullRequestId,
    title: pullRequest.title,
    description: pullRequest.description,
    repository: convertRepository(pullRequest.repository),
    createdBy: convertCreatedBy(pullRequest.createdBy),
    hasAutoComplete: hasAutoComplete(pullRequest),
    policies,
    reviewers: convertReviewers(pullRequest.reviewers),
    creationDate: pullRequest.creationDate?.toISOString(),
    status: pullRequest.status,
    isDraft: pullRequest.isDraft,
    link: getPullRequestLink(baseUrl, pullRequest)
  };
}
function getPullRequestLink(baseUrl, pullRequest) {
  const projectName = pullRequest.repository?.project?.name;
  const repoName = pullRequest.repository?.name;
  const pullRequestId = pullRequest.pullRequestId;
  if (!projectName || !repoName || !pullRequestId) {
    return void 0;
  }
  const encodedProjectName = encodeURIComponent(projectName);
  const encodedRepoName = encodeURIComponent(repoName);
  return `${baseUrl}/${encodedProjectName}/_git/${encodedRepoName}/pullrequest/${pullRequestId}`;
}
function getAvatarUrl(identity) {
  return identity._links?.avatar?.href ?? identity.imageUrl;
}
function getArtifactId(projectId, pullRequestId) {
  return `vstfs:///CodeReview/CodeReviewId/${projectId}/${pullRequestId}`;
}
function convertPolicy(policyEvaluationRecord) {
  const policyConfig = policyEvaluationRecord.configuration;
  const policyStatus = policyEvaluationRecord.status;
  if (!policyConfig) {
    return void 0;
  }
  if (!(policyConfig.isEnabled && !policyConfig.isDeleted && (policyConfig.isBlocking || policyConfig.type?.id === pluginAzureDevopsCommon$2.PolicyType.Status) && // Optional "Status" policies are actually required for automatic completion.
  policyStatus !== pluginAzureDevopsCommon$2.PolicyEvaluationStatus.Approved)) {
    return void 0;
  }
  const policyTypeId = policyConfig.type?.id;
  if (!policyTypeId) {
    return void 0;
  }
  const policyType = {
    [pluginAzureDevopsCommon$2.PolicyTypeId.Build]: pluginAzureDevopsCommon$2.PolicyType.Build,
    [pluginAzureDevopsCommon$2.PolicyTypeId.Status]: pluginAzureDevopsCommon$2.PolicyType.Status,
    [pluginAzureDevopsCommon$2.PolicyTypeId.MinimumReviewers]: pluginAzureDevopsCommon$2.PolicyType.MinimumReviewers,
    [pluginAzureDevopsCommon$2.PolicyTypeId.Comments]: pluginAzureDevopsCommon$2.PolicyType.Comments,
    [pluginAzureDevopsCommon$2.PolicyTypeId.RequiredReviewers]: pluginAzureDevopsCommon$2.PolicyType.RequiredReviewers,
    [pluginAzureDevopsCommon$2.PolicyTypeId.MergeStrategy]: pluginAzureDevopsCommon$2.PolicyType.MergeStrategy
  }[policyTypeId];
  if (!policyType) {
    return void 0;
  }
  const policyConfigSettings = policyConfig.settings;
  let policyText = policyConfig.type?.displayName;
  let policyLink;
  switch (policyType) {
    case pluginAzureDevopsCommon$2.PolicyType.Build: {
      const buildDisplayName = policyConfigSettings.displayName;
      if (buildDisplayName) {
        policyText += `: ${buildDisplayName}`;
      }
      const buildId = policyEvaluationRecord.context?.buildId;
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
      const buildPolicyStatus = {
        [pluginAzureDevopsCommon$2.PolicyEvaluationStatus.Queued]: buildExpired ? "expired" : "queued",
        [pluginAzureDevopsCommon$2.PolicyEvaluationStatus.Rejected]: "failed"
      }[policyStatus] ?? pluginAzureDevopsCommon$2.PolicyEvaluationStatus[policyStatus].toLowerCase();
      policyText += ` (${buildPolicyStatus})`;
      break;
    }
    case pluginAzureDevopsCommon$2.PolicyType.Status: {
      const statusGenre = policyConfigSettings.statusGenre;
      const statusName = policyConfigSettings.statusGenre;
      if (statusName) {
        policyText += `: ${statusGenre}/${statusName}`;
      }
      break;
    }
    case pluginAzureDevopsCommon$2.PolicyType.MinimumReviewers: {
      const minimumApproverCount = policyConfigSettings.minimumApproverCount;
      policyText += ` (${minimumApproverCount})`;
      break;
    }
    case pluginAzureDevopsCommon$2.PolicyType.Comments:
      break;
    case pluginAzureDevopsCommon$2.PolicyType.RequiredReviewers:
      break;
    case pluginAzureDevopsCommon$2.PolicyType.MergeStrategy:
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
  if (!filesPath) return readmeContent;
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
    voteStatus: identityRef.vote ?? 0
  };
}
function convertReviewers(identityRefs) {
  if (!identityRefs) {
    return void 0;
  }
  return identityRefs.map(convertReviewer).filter((reviewer) => Boolean(reviewer));
}
function convertRepository(repository) {
  if (!repository) {
    return void 0;
  }
  return {
    id: repository.id,
    name: repository.name,
    url: repository.url?.replace("_apis/git/repositories", "_git")
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

azureDevopsUtils_cjs.buildEncodedUrl = buildEncodedUrl;
azureDevopsUtils_cjs.convertDashboardPullRequest = convertDashboardPullRequest;
azureDevopsUtils_cjs.convertPolicy = convertPolicy;
azureDevopsUtils_cjs.extractAssets = extractAssets;
azureDevopsUtils_cjs.extractPartsFromAsset = extractPartsFromAsset;
azureDevopsUtils_cjs.getArtifactId = getArtifactId;
azureDevopsUtils_cjs.getAvatarUrl = getAvatarUrl;
azureDevopsUtils_cjs.getPullRequestLink = getPullRequestLink;
azureDevopsUtils_cjs.replaceReadme = replaceReadme;

var mappers_cjs = {};

var pluginAzureDevopsCommon$1 = require$$0;

function mappedRepoBuild(build) {
  return {
    id: build.id,
    title: [build.definition?.name, build.buildNumber].filter(Boolean).join(" - "),
    link: build._links?.web.href ?? "",
    status: build.status ?? pluginAzureDevopsCommon$1.BuildStatus.None,
    result: build.result ?? pluginAzureDevopsCommon$1.BuildResult.None,
    queueTime: build.queueTime?.toISOString(),
    startTime: build.startTime?.toISOString(),
    finishTime: build.finishTime?.toISOString(),
    source: `${build.sourceBranch} (${build.sourceVersion?.slice(0, 8)})`,
    uniqueName: build.requestedFor?.uniqueName ?? "N/A"
  };
}
function mappedGitTag(gitRef, linkBaseUrl, commitBaseUrl) {
  return {
    objectId: gitRef.objectId,
    peeledObjectId: gitRef.peeledObjectId,
    name: gitRef.name?.replace("refs/tags/", ""),
    createdBy: gitRef.creator?.displayName ?? "N/A",
    link: `${linkBaseUrl}${encodeURIComponent(
      gitRef.name?.replace("refs/tags/", "") ?? ""
    )}`,
    commitLink: `${commitBaseUrl}/${encodeURIComponent(
      gitRef.peeledObjectId ?? ""
    )}`
  };
}
function mappedPullRequest(pullRequest, linkBaseUrl) {
  return {
    pullRequestId: pullRequest.pullRequestId,
    repoName: pullRequest.repository?.name,
    title: pullRequest.title,
    uniqueName: pullRequest.createdBy?.uniqueName ?? "N/A",
    createdBy: pullRequest.createdBy?.displayName ?? "N/A",
    creationDate: pullRequest.creationDate?.toISOString(),
    sourceRefName: pullRequest.sourceRefName,
    targetRefName: pullRequest.targetRefName,
    status: pullRequest.status,
    isDraft: pullRequest.isDraft,
    link: `${linkBaseUrl}/${pullRequest.pullRequestId}`
  };
}
function mappedBuildRun(build) {
  return {
    id: build.id,
    title: [build.definition?.name, build.buildNumber].filter(Boolean).join(" - "),
    link: build._links?.web.href ?? "",
    status: build.status ?? pluginAzureDevopsCommon$1.BuildStatus.None,
    result: build.result ?? pluginAzureDevopsCommon$1.BuildResult.None,
    queueTime: build.queueTime?.toISOString(),
    startTime: build.startTime?.toISOString(),
    finishTime: build.finishTime?.toISOString(),
    source: `${build.sourceBranch} (${build.sourceVersion?.slice(0, 8)})`,
    uniqueName: build.requestedFor?.uniqueName ?? "N/A"
  };
}

mappers_cjs.mappedBuildRun = mappedBuildRun;
mappers_cjs.mappedGitTag = mappedGitTag;
mappers_cjs.mappedPullRequest = mappedPullRequest;
mappers_cjs.mappedRepoBuild = mappedRepoBuild;

var azureDevopsUtils = azureDevopsUtils_cjs;
var azureDevopsNodeApi = require$$1$1;
var integration = require$$2;
var mappers = mappers_cjs;

class AzureDevOpsApi$2 {
  logger;
  urlReader;
  config;
  credentialsProvider;
  constructor(logger, urlReader, config, credentialsProvider) {
    this.logger = logger;
    this.urlReader = urlReader;
    this.config = config;
    this.credentialsProvider = credentialsProvider;
  }
  static fromConfig(config, options) {
    const scmIntegrations = integration.ScmIntegrations.fromConfig(config);
    const credentialsProvider = integration.DefaultAzureDevOpsCredentialsProvider.fromIntegrations(scmIntegrations);
    return new AzureDevOpsApi$2(
      options.logger,
      options.urlReader,
      config,
      credentialsProvider
    );
  }
  async getWebApi(host, org) {
    const validHost = host ?? this.config.getOptionalString("azureDevOps.host");
    const validOrg = org ?? this.config.getOptionalString("azureDevOps.organization");
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
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting Repository ${repoName} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    return client.getRepository(repoName, projectName);
  }
  async getBuildList(projectName, repoId, top, host, org) {
    this.logger?.debug(
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
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    if (!gitRepository) {
      throw new Error(
        `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
      );
    }
    const buildList = await this.getBuildList(
      projectName,
      gitRepository.id,
      top,
      host,
      org
    );
    const repoBuilds = buildList.map((build) => {
      return mappers.mappedRepoBuild(build);
    });
    return repoBuilds;
  }
  async getGitTags(projectName, repoName, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting Git Tags for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    if (!gitRepository) {
      throw new Error(
        `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
      );
    }
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
      return mappers.mappedGitTag(tagRef, linkBaseUrl, commitBaseUrl);
    });
    return gitTags;
  }
  async getPullRequests(projectName, repoName, options, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting up to ${options.top} Pull Requests for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    if (!gitRepository) {
      throw new Error(
        `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
      );
    }
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
      return mappers.mappedPullRequest(gitPullRequest, linkBaseUrl);
    });
    return pullRequests;
  }
  async getDashboardPullRequests(projectName, options) {
    this.logger?.debug(
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
        const projectId = gitPullRequest.repository?.project?.id;
        const prId = gitPullRequest.pullRequestId;
        let policies;
        if (projectId && prId) {
          policies = await this.getPullRequestPolicies(
            projectName,
            projectId,
            prId
          );
        }
        return azureDevopsUtils.convertDashboardPullRequest(
          gitPullRequest,
          webApi.serverUrl,
          policies
        );
      })
    );
  }
  async getPullRequestPolicies(projectName, projectId, pullRequestId) {
    this.logger?.debug(
      `Getting pull request policies for pull request id '${pullRequestId}'.`
    );
    const webApi = await this.getWebApi();
    const client = await webApi.getPolicyApi();
    const artifactId = azureDevopsUtils.getArtifactId(projectId, pullRequestId);
    const policyEvaluationRecords = await client.getPolicyEvaluations(projectName, artifactId);
    return policyEvaluationRecords.map(azureDevopsUtils.convertPolicy).filter((policy) => Boolean(policy));
  }
  async getAllTeams(options) {
    this.logger?.debug("Getting all teams.");
    const webApi = await this.getWebApi();
    const client = await webApi.getCoreApi();
    const webApiTeams = await client.getAllTeams(
      void 0,
      options?.limit,
      void 0,
      void 0
    );
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
    const { projectId, teamId } = options;
    this.logger?.debug(`Getting team member ids for team '${teamId}'.`);
    const webApi = await this.getWebApi();
    const client = await webApi.getCoreApi();
    const teamMembers = await client.getTeamMembersWithExtendedProperties(projectId, teamId);
    return teamMembers.map((teamMember) => ({
      id: teamMember.identity?.id,
      displayName: teamMember.identity?.displayName,
      uniqueName: teamMember.identity?.uniqueName
    }));
  }
  async getBuildDefinitions(projectName, definitionName, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting Build Definitions for ${definitionName} in Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getDefinitions(projectName, definitionName);
  }
  async getBuilds(projectName, top, repoId, definitions, host, org) {
    this.logger?.debug(
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
      if (!gitRepository) {
        throw new Error(
          `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
        );
      }
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
    const buildRuns = builds.map(mappers.mappedBuildRun);
    return buildRuns;
  }
  async getReadme(host, org, project, repo, path) {
    const url = azureDevopsUtils.buildEncodedUrl(host, org, project, repo, path);
    const response = await this.urlReader.readUrl(url);
    const buffer = await response.buffer();
    const content = await azureDevopsUtils.replaceReadme(
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

AzureDevOpsApi_cjs.AzureDevOpsApi = AzureDevOpsApi$2;

var router_cjs = {};

var PullRequestsDashboardProvider_cjs = {};

var limiterFactory = require$$0$1;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var limiterFactory__default = /*#__PURE__*/_interopDefaultCompat$1(limiterFactory);

const DEFAULT_TEAMS_LIMIT = 100;
class PullRequestsDashboardProvider$1 {
  constructor(logger, azureDevOpsApi) {
    this.logger = logger;
    this.azureDevOpsApi = azureDevOpsApi;
  }
  teams = /* @__PURE__ */ new Map();
  teamMembers = /* @__PURE__ */ new Map();
  static async create(logger, azureDevOpsApi) {
    const provider = new PullRequestsDashboardProvider$1(logger, azureDevOpsApi);
    return provider;
  }
  async readTeams(limit) {
    this.logger.info("Reading teams.");
    let teams = await this.azureDevOpsApi.getAllTeams({ limit });
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
                const teamMemberId = teamMember.id;
                if (teamMemberId) {
                  arr.push(teamMemberId);
                  const memberOf = [
                    ...this.teamMembers.get(teamMemberId)?.memberOf ?? [],
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
    await this.getAllTeams({ limit: options.teamsLimit });
    return dashboardPullRequests.map((pr) => {
      if (pr.createdBy?.id) {
        const teamIds = this.teamMembers.get(pr.createdBy.id)?.memberOf;
        pr.createdBy.teamIds = teamIds;
        pr.createdBy.teamNames = teamIds?.map(
          (teamId) => this.teams.get(teamId)?.name ?? ""
        );
      }
      return pr;
    });
  }
  async getUserTeamIds(email) {
    await this.getAllTeams({});
    return Array.from(this.teamMembers.values()).find(
      (teamMember) => teamMember.uniqueName === email
    )?.memberOf ?? [];
  }
  async getAllTeams(options) {
    if (!this.teams.size) {
      const maxTeams = options?.limit ?? DEFAULT_TEAMS_LIMIT;
      await this.readTeams(maxTeams);
    }
    return Array.from(this.teams.values());
  }
}

PullRequestsDashboardProvider_cjs.DEFAULT_TEAMS_LIMIT = DEFAULT_TEAMS_LIMIT;
PullRequestsDashboardProvider_cjs.PullRequestsDashboardProvider = PullRequestsDashboardProvider$1;

var pluginAzureDevopsCommon = require$$0;
var AzureDevOpsApi$1 = AzureDevOpsApi_cjs;
var PullRequestsDashboardProvider = PullRequestsDashboardProvider_cjs;
var Router = require$$3;
var backendCommon = require$$4;
var express = require$$5;
var errors = require$$6;
var pluginPermissionCommon = require$$7;
var pluginPermissionNode = require$$8;
var rootHttpRouter = require$$9;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);
var express__default = /*#__PURE__*/_interopDefaultCompat(express);

const DEFAULT_TOP = 10;
async function createRouter(options) {
  const { logger, reader, config, permissions } = options;
  const { httpAuth } = backendCommon.createLegacyAuthAdapters(options);
  if (config.getOptionalString("azureDevOps.token")) {
    logger.warn(
      "The 'azureDevOps.token' has been deprecated, use 'integrations.azure' instead, for more details see: https://backstage.io/docs/integrations/azure/locations"
    );
  }
  const permissionIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: pluginAzureDevopsCommon.azureDevOpsPermissions
  });
  const azureDevOpsApi = options.azureDevOpsApi || AzureDevOpsApi$1.AzureDevOpsApi.fromConfig(config, { logger, urlReader: reader });
  const pullRequestsDashboardProvider = await PullRequestsDashboardProvider.PullRequestsDashboardProvider.create(logger, azureDevOpsApi);
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
    const { projectName, repoId } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
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
    const { projectName, repoName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
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
    const { projectName, repoName } = req.params;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsGitTagReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
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
    const { projectName, repoName } = req.params;
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const teamsLimit = req.query.teamsLimit ? Number(req.query.teamsLimit) : PullRequestsDashboardProvider.DEFAULT_TEAMS_LIMIT;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const status = req.query.status ? Number(req.query.status) : pluginAzureDevopsCommon.PullRequestStatus.Active;
    const pullRequestOptions = {
      top,
      status,
      teamsLimit
    };
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
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
    const teamsLimit = req.query.teamsLimit ? Number(req.query.teamsLimit) : PullRequestsDashboardProvider.DEFAULT_TEAMS_LIMIT;
    const status = req.query.status ? Number(req.query.status) : pluginAzureDevopsCommon.PullRequestStatus.Active;
    const pullRequestOptions = {
      top,
      status,
      teamsLimit
    };
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestDashboardReadPermission
        }
      ],
      { credentials: await httpAuth.credentials(req) }
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
  router.get("/all-teams", async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : void 0;
    const allTeams = await pullRequestsDashboardProvider.getAllTeams({ limit });
    res.status(200).json(allTeams);
  });
  router.get(
    "/build-definitions/:projectName/:definitionName",
    async (req, res) => {
      const { projectName, definitionName } = req.params;
      const host = req.query.host?.toString();
      const org = req.query.org?.toString();
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
    const { projectName } = req.params;
    const repoName = req.query.repoName?.toString();
    const definitionName = req.query.definitionName?.toString();
    const top = req.query.top ? Number(req.query.top) : DEFAULT_TOP;
    const host = req.query.host?.toString();
    const org = req.query.org?.toString();
    const entityRef = req.query.entityRef;
    if (typeof entityRef !== "string") {
      throw new errors.InputError("Invalid entityRef, not a string");
    }
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPipelineReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
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
    const host = req.query.host?.toString() ?? config.getString("azureDevOps.host");
    const org = req.query.org?.toString() ?? config.getString("azureDevOps.organization");
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
    const decision = (await permissions.authorize(
      [
        {
          permission: pluginAzureDevopsCommon.azureDevOpsPullRequestReadPermission,
          resourceRef: entityRef
        }
      ],
      { credentials: await httpAuth.credentials(req) }
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
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config });
  router.use(middleware.error());
  return router;
}

router_cjs.createRouter = createRouter;

var plugin_cjs = {};

var backendPluginApi = require$$0$2;
var router$1 = router_cjs;

const azureDevOpsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "azure-devops",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        reader: backendPluginApi.coreServices.urlReader,
        permissions: backendPluginApi.coreServices.permissions,
        httpRouter: backendPluginApi.coreServices.httpRouter,
        discovery: backendPluginApi.coreServices.discovery,
        httpAuth: backendPluginApi.coreServices.httpAuth
      },
      async init({
        config,
        logger,
        reader,
        permissions,
        httpRouter,
        discovery,
        httpAuth
      }) {
        httpRouter.use(
          await router$1.createRouter({
            config,
            logger,
            reader,
            permissions,
            discovery,
            httpAuth
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

plugin_cjs.azureDevOpsPlugin = azureDevOpsPlugin;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var AzureDevOpsApi = AzureDevOpsApi_cjs;
var router = router_cjs;
var plugin = plugin_cjs;



index_cjs.AzureDevOpsApi = AzureDevOpsApi.AzureDevOpsApi;
index_cjs.createRouter = router.createRouter;
var _default = index_cjs.default = plugin.azureDevOpsPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
