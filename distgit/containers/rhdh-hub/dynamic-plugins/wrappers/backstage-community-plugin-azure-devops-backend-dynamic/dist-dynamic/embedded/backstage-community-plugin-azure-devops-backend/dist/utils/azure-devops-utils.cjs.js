'use strict';

var pluginAzureDevopsCommon = require('@backstage-community/plugin-azure-devops-common');
var mime = require('mime-types');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var mime__default = /*#__PURE__*/_interopDefaultCompat(mime);

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
  if (!(policyConfig.isEnabled && !policyConfig.isDeleted && (policyConfig.isBlocking || policyConfig.type?.id === pluginAzureDevopsCommon.PolicyType.Status) && // Optional "Status" policies are actually required for automatic completion.
  policyStatus !== pluginAzureDevopsCommon.PolicyEvaluationStatus.Approved)) {
    return void 0;
  }
  const policyTypeId = policyConfig.type?.id;
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
  let policyText = policyConfig.type?.displayName;
  let policyLink;
  switch (policyType) {
    case pluginAzureDevopsCommon.PolicyType.Build: {
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
        [pluginAzureDevopsCommon.PolicyEvaluationStatus.Queued]: buildExpired ? "expired" : "queued",
        [pluginAzureDevopsCommon.PolicyEvaluationStatus.Rejected]: "failed"
      }[policyStatus] ?? pluginAzureDevopsCommon.PolicyEvaluationStatus[policyStatus].toLowerCase();
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

exports.buildEncodedUrl = buildEncodedUrl;
exports.convertDashboardPullRequest = convertDashboardPullRequest;
exports.convertPolicy = convertPolicy;
exports.extractAssets = extractAssets;
exports.extractPartsFromAsset = extractPartsFromAsset;
exports.getArtifactId = getArtifactId;
exports.getAvatarUrl = getAvatarUrl;
exports.getPullRequestLink = getPullRequestLink;
exports.replaceReadme = replaceReadme;
//# sourceMappingURL=azure-devops-utils.cjs.js.map
