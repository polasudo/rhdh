'use strict';

var pluginAzureDevopsCommon = require('@backstage-community/plugin-azure-devops-common');

function mappedRepoBuild(build) {
  return {
    id: build.id,
    title: [build.definition?.name, build.buildNumber].filter(Boolean).join(" - "),
    link: build._links?.web.href ?? "",
    status: build.status ?? pluginAzureDevopsCommon.BuildStatus.None,
    result: build.result ?? pluginAzureDevopsCommon.BuildResult.None,
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
    status: build.status ?? pluginAzureDevopsCommon.BuildStatus.None,
    result: build.result ?? pluginAzureDevopsCommon.BuildResult.None,
    queueTime: build.queueTime?.toISOString(),
    startTime: build.startTime?.toISOString(),
    finishTime: build.finishTime?.toISOString(),
    source: `${build.sourceBranch} (${build.sourceVersion?.slice(0, 8)})`,
    uniqueName: build.requestedFor?.uniqueName ?? "N/A"
  };
}

exports.mappedBuildRun = mappedBuildRun;
exports.mappedGitTag = mappedGitTag;
exports.mappedPullRequest = mappedPullRequest;
exports.mappedRepoBuild = mappedRepoBuild;
//# sourceMappingURL=mappers.cjs.js.map
