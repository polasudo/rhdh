'use strict';

var catalogUtils = require('../../catalog/catalogUtils.cjs.js');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var loggingUtils = require('../../helpers/loggingUtils.cjs.js');

async function findOpenPRForBranch(logger, config, octo, owner, repo, branchName, withCatalogInfoContent = false) {
  try {
    const response = await octo.rest.pulls.list({
      owner,
      repo,
      state: "open"
    });
    for (const pull of response.data) {
      if (pull.head.ref === branchName) {
        return {
          prNum: pull.number,
          prUrl: pull.html_url,
          prTitle: pull.title,
          prBody: pull.body ?? void 0,
          prCatalogInfoContent: withCatalogInfoContent ? await getCatalogInfoContentFromPR(
            logger,
            config,
            octo,
            owner,
            repo,
            pull.number,
            pull.head.sha
          ) : void 0,
          lastUpdate: pull.updated_at
        };
      }
    }
  } catch (error) {
    loggingUtils.logErrorIfNeeded(logger, "Error fetching pull requests", error);
  }
  return {};
}
async function getCatalogInfoContentFromPR(logger, config, octo, owner, repo, prNumber, prHeadSha) {
  try {
    const filePath = catalogUtils.getCatalogFilename(config);
    const fileContentResponse = await octo.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: prHeadSha
    });
    if (!fileContentResponse.data) {
      return void 0;
    }
    if (!("content" in fileContentResponse.data)) {
      return void 0;
    }
    return Buffer.from(fileContentResponse.data.content, "base64").toString(
      "utf-8"
    );
  } catch (error) {
    loggingUtils.logErrorIfNeeded(
      logger,
      `Error fetching catalog-info content from PR ${prNumber}`,
      error
    );
    return void 0;
  }
}
async function closePRWithComment(octo, owner, repo, prNum, comment) {
  await octo.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNum,
    body: comment
  });
  await octo.rest.pulls.update({
    owner,
    repo,
    pull_number: prNum,
    state: "closed"
  });
}

exports.closePRWithComment = closePRWithComment;
exports.findOpenPRForBranch = findOpenPRForBranch;
//# sourceMappingURL=prUtils.cjs.js.map
