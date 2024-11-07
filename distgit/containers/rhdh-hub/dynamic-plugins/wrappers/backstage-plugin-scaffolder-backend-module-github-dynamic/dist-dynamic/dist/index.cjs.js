'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/errors');
var require$$1$1 = require('@backstage/plugin-scaffolder-node');
var require$$2 = require('octokit');
var require$$1 = require('@backstage/integration');
var require$$4 = require('libsodium-wrappers');
var require$$0$1 = require('yaml');
var require$$1$2 = require('@octokit/webhooks');
var require$$0$2 = require('path');
var require$$4$1 = require('octokit-plugin-create-pull-request');
var require$$7 = require('@backstage/backend-plugin-api');
var require$$1$3 = require('@backstage/plugin-scaffolder-node/alpha');
var require$$18 = require('@backstage/catalog-client');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var index_cjs$1 = {};

var githubActionsDispatch_cjs = {};

var helpers_cjs = {};

var gitHelpers_cjs = {};

var errors$c = require$$0;

const enableBranchProtectionOnDefaultRepoBranch = async ({
  repoName,
  client,
  owner,
  logger,
  requireCodeOwnerReviews,
  bypassPullRequestAllowances,
  requiredApprovingReviewCount,
  restrictions,
  requiredStatusCheckContexts = [],
  requireBranchesToBeUpToDate = true,
  requiredConversationResolution = false,
  requireLastPushApproval = false,
  defaultBranch = "master",
  enforceAdmins = true,
  dismissStaleReviews = false,
  requiredCommitSigning = false
}) => {
  const tryOnce = async () => {
    try {
      await client.rest.repos.updateBranchProtection({
        mediaType: {
          /**
           * 👇 we need this preview because allowing a custom
           * reviewer count on branch protection is a preview
           * feature
           *
           * More here: https://docs.github.com/en/rest/overview/api-previews#require-multiple-approving-reviews
           */
          previews: ["luke-cage-preview"]
        },
        owner,
        repo: repoName,
        branch: defaultBranch,
        required_status_checks: {
          strict: requireBranchesToBeUpToDate,
          contexts: requiredStatusCheckContexts
        },
        restrictions: restrictions ?? null,
        enforce_admins: enforceAdmins,
        required_pull_request_reviews: {
          required_approving_review_count: requiredApprovingReviewCount,
          require_code_owner_reviews: requireCodeOwnerReviews,
          bypass_pull_request_allowances: bypassPullRequestAllowances,
          dismiss_stale_reviews: dismissStaleReviews,
          require_last_push_approval: requireLastPushApproval
        },
        required_conversation_resolution: requiredConversationResolution
      });
      if (requiredCommitSigning) {
        await client.rest.repos.createCommitSignatureProtection({
          owner,
          repo: repoName,
          branch: defaultBranch
        });
      }
    } catch (e) {
      errors$c.assertError(e);
      if (e.message.includes(
        "Upgrade to GitHub Pro or make this repository public to enable this feature"
      )) {
        logger.warn(
          "Branch protection was not enabled as it requires GitHub Pro for private repositories"
        );
      } else {
        throw e;
      }
    }
  };
  try {
    await tryOnce();
  } catch (e) {
    if (!e.message.includes("Branch not found")) {
      throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    await tryOnce();
  }
};
function entityRefToName(name) {
  return name.replace(/^.*[:/]/g, "");
}

gitHelpers_cjs.enableBranchProtectionOnDefaultRepoBranch = enableBranchProtectionOnDefaultRepoBranch;
gitHelpers_cjs.entityRefToName = entityRefToName;

var errors$b = require$$0;
var integration = require$$1;
var pluginScaffolderNode$b = require$$1$1;
var Sodium$2 = require$$4;
var gitHelpers$1 = gitHelpers_cjs;

function _interopDefaultCompat$f (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Sodium__default$2 = /*#__PURE__*/_interopDefaultCompat$f(Sodium$2);

const DEFAULT_TIMEOUT_MS = 6e4;
async function getOctokitOptions(options) {
  const { integrations, credentialsProvider, repoUrl, token } = options;
  const { owner, repo, host } = pluginScaffolderNode$b.parseRepoUrl(repoUrl, integrations);
  const requestOptions = {
    // set timeout to 60 seconds
    timeout: DEFAULT_TIMEOUT_MS
  };
  if (!owner) {
    throw new errors$b.InputError(`No owner provided for repo ${repoUrl}`);
  }
  const integrationConfig = integrations.github.byHost(host)?.config;
  if (!integrationConfig) {
    throw new errors$b.InputError(`No integration for host ${host}`);
  }
  if (token) {
    return {
      auth: token,
      baseUrl: integrationConfig.apiBaseUrl,
      previews: ["nebula-preview"],
      request: requestOptions
    };
  }
  const githubCredentialsProvider = credentialsProvider ?? integration.DefaultGithubCredentialsProvider.fromIntegrations(integrations);
  const { token: credentialProviderToken } = await githubCredentialsProvider.getCredentials({
    url: `https://${host}/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}`
  });
  if (!credentialProviderToken) {
    throw new errors$b.InputError(
      `No token available for host: ${host}, with owner ${owner}, and repo ${repo}`
    );
  }
  return {
    auth: credentialProviderToken,
    baseUrl: integrationConfig.apiBaseUrl,
    previews: ["nebula-preview"]
  };
}
async function createGithubRepoWithCollaboratorsAndTopics(client, repo, owner, repoVisibility, description, homepage, deleteBranchOnMerge, allowMergeCommit, allowSquashMerge, squashMergeCommitTitle, squashMergeCommitMessage, allowRebaseMerge, allowAutoMerge, access, collaborators, hasProjects, hasWiki, hasIssues, topics, repoVariables, secrets, oidcCustomization, customProperties, logger) {
  const user = await client.rest.users.getByUsername({
    username: owner
  });
  if (access?.startsWith(`${owner}/`)) {
    await validateAccessTeam(client, access);
  }
  const repoCreationPromise = user.data.type === "Organization" ? client.rest.repos.createInOrg({
    name: repo,
    org: owner,
    private: repoVisibility === "private",
    // @ts-ignore https://github.com/octokit/types.ts/issues/522
    visibility: repoVisibility,
    description,
    delete_branch_on_merge: deleteBranchOnMerge,
    allow_merge_commit: allowMergeCommit,
    allow_squash_merge: allowSquashMerge,
    squash_merge_commit_title: squashMergeCommitTitle,
    squash_merge_commit_message: squashMergeCommitMessage,
    allow_rebase_merge: allowRebaseMerge,
    allow_auto_merge: allowAutoMerge,
    homepage,
    has_projects: hasProjects,
    has_wiki: hasWiki,
    has_issues: hasIssues,
    // Custom properties only available on org repos
    custom_properties: customProperties
  }) : client.rest.repos.createForAuthenticatedUser({
    name: repo,
    private: repoVisibility === "private",
    description,
    delete_branch_on_merge: deleteBranchOnMerge,
    allow_merge_commit: allowMergeCommit,
    allow_squash_merge: allowSquashMerge,
    squash_merge_commit_title: squashMergeCommitTitle,
    squash_merge_commit_message: squashMergeCommitMessage,
    allow_rebase_merge: allowRebaseMerge,
    allow_auto_merge: allowAutoMerge,
    homepage,
    has_projects: hasProjects,
    has_wiki: hasWiki,
    has_issues: hasIssues
  });
  let newRepo;
  try {
    newRepo = (await repoCreationPromise).data;
  } catch (e) {
    errors$b.assertError(e);
    if (e.message === "Resource not accessible by integration") {
      logger.warn(
        `The GitHub app or token provided may not have the required permissions to create the ${user.data.type} repository ${owner}/${repo}.`
      );
    }
    throw new Error(
      `Failed to create the ${user.data.type} repository ${owner}/${repo}, ${e.message}`
    );
  }
  if (access?.startsWith(`${owner}/`)) {
    const [, team] = access.split("/");
    await client.rest.teams.addOrUpdateRepoPermissionsInOrg({
      org: owner,
      team_slug: team,
      owner,
      repo,
      permission: "admin"
    });
  } else if (access && access !== owner) {
    await client.rest.repos.addCollaborator({
      owner,
      repo,
      username: access,
      permission: "admin"
    });
  }
  if (collaborators) {
    for (const collaborator of collaborators) {
      try {
        if ("user" in collaborator) {
          await client.rest.repos.addCollaborator({
            owner,
            repo,
            username: gitHelpers$1.entityRefToName(collaborator.user),
            permission: collaborator.access
          });
        } else if ("team" in collaborator) {
          await client.rest.teams.addOrUpdateRepoPermissionsInOrg({
            org: owner,
            team_slug: gitHelpers$1.entityRefToName(collaborator.team),
            owner,
            repo,
            permission: collaborator.access
          });
        }
      } catch (e) {
        errors$b.assertError(e);
        const name = extractCollaboratorName(collaborator);
        logger.warn(
          `Skipping ${collaborator.access} access for ${name}, ${e.message}`
        );
      }
    }
  }
  if (topics) {
    try {
      await client.rest.repos.replaceAllTopics({
        owner,
        repo,
        names: topics.map((t) => t.toLowerCase())
      });
    } catch (e) {
      errors$b.assertError(e);
      logger.warn(`Skipping topics ${topics.join(" ")}, ${e.message}`);
    }
  }
  for (const [key, value] of Object.entries(repoVariables ?? {})) {
    await client.rest.actions.createRepoVariable({
      owner,
      repo,
      name: key,
      value
    });
  }
  if (secrets) {
    const publicKeyResponse = await client.rest.actions.getRepoPublicKey({
      owner,
      repo
    });
    await Sodium__default$2.default.ready;
    const binaryKey = Sodium__default$2.default.from_base64(
      publicKeyResponse.data.key,
      Sodium__default$2.default.base64_variants.ORIGINAL
    );
    for (const [key, value] of Object.entries(secrets)) {
      const binarySecret = Sodium__default$2.default.from_string(value);
      const encryptedBinarySecret = Sodium__default$2.default.crypto_box_seal(
        binarySecret,
        binaryKey
      );
      const encryptedBase64Secret = Sodium__default$2.default.to_base64(
        encryptedBinarySecret,
        Sodium__default$2.default.base64_variants.ORIGINAL
      );
      await client.rest.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: key,
        encrypted_value: encryptedBase64Secret,
        key_id: publicKeyResponse.data.key_id
      });
    }
  }
  if (oidcCustomization) {
    await client.request(
      "PUT /repos/{owner}/{repo}/actions/oidc/customization/sub",
      {
        owner,
        repo,
        use_default: oidcCustomization.useDefault,
        include_claim_keys: oidcCustomization.includeClaimKeys
      }
    );
  }
  return newRepo;
}
async function initRepoPushAndProtect(remoteUrl, password, workspacePath, sourcePath, defaultBranch, protectDefaultBranch, protectEnforceAdmins, owner, client, repo, requireCodeOwnerReviews, bypassPullRequestAllowances, requiredApprovingReviewCount, restrictions, requiredStatusCheckContexts, requireBranchesToBeUpToDate, requiredConversationResolution, requireLastPushApproval, config, logger, gitCommitMessage, gitAuthorName, gitAuthorEmail, dismissStaleReviews, requiredCommitSigning) {
  const gitAuthorInfo = {
    name: gitAuthorName ? gitAuthorName : config.getOptionalString("scaffolder.defaultAuthor.name"),
    email: gitAuthorEmail ? gitAuthorEmail : config.getOptionalString("scaffolder.defaultAuthor.email")
  };
  const commitMessage = getGitCommitMessage(gitCommitMessage, config) || "initial commit";
  const commitResult = await pluginScaffolderNode$b.initRepoAndPush({
    dir: pluginScaffolderNode$b.getRepoSourceDirectory(workspacePath, sourcePath),
    remoteUrl,
    defaultBranch,
    auth: {
      username: "x-access-token",
      password
    },
    logger,
    commitMessage,
    gitAuthorInfo
  });
  if (protectDefaultBranch) {
    try {
      await gitHelpers$1.enableBranchProtectionOnDefaultRepoBranch({
        owner,
        client,
        repoName: repo,
        logger,
        defaultBranch,
        bypassPullRequestAllowances,
        requiredApprovingReviewCount,
        restrictions,
        requireCodeOwnerReviews,
        requiredStatusCheckContexts,
        requireBranchesToBeUpToDate,
        requiredConversationResolution,
        requireLastPushApproval,
        enforceAdmins: protectEnforceAdmins,
        dismissStaleReviews,
        requiredCommitSigning
      });
    } catch (e) {
      errors$b.assertError(e);
      logger.warn(
        `Skipping: default branch protection on '${repo}', ${e.message}`
      );
    }
  }
  return { commitHash: commitResult.commitHash };
}
function extractCollaboratorName(collaborator) {
  if ("username" in collaborator) return collaborator.username;
  if ("user" in collaborator) return collaborator.user;
  return collaborator.team;
}
async function validateAccessTeam(client, access) {
  const [org, team_slug] = access.split("/");
  try {
    await client.rest.teams.getByName({
      org,
      team_slug
    });
  } catch (e) {
    if (e.response.data.message === "Not Found") {
      const message = `Received 'Not Found' from the API; one of org:
        ${org} or team: ${team_slug} was not found within GitHub.`;
      throw new errors$b.NotFoundError(message);
    }
  }
}
function getGitCommitMessage(gitCommitMessage, config) {
  return gitCommitMessage ? gitCommitMessage : config.getOptionalString("scaffolder.defaultCommitMessage");
}

helpers_cjs.createGithubRepoWithCollaboratorsAndTopics = createGithubRepoWithCollaboratorsAndTopics;
helpers_cjs.getGitCommitMessage = getGitCommitMessage;
helpers_cjs.getOctokitOptions = getOctokitOptions;
helpers_cjs.initRepoPushAndProtect = initRepoPushAndProtect;

var githubActionsDispatch_examples_cjs = {};

var yaml$b = require$$0$1;

function _interopDefaultCompat$e (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$b = /*#__PURE__*/_interopDefaultCompat$e(yaml$b);

const examples$b = [
  {
    description: "GitHub Action Workflow Without Inputs.",
    example: yaml__default$b.default.stringify({
      steps: [
        {
          action: "github:actions:dispatch",
          name: "Dispatch Github Action Workflow",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            workflowId: "WORKFLOW_ID",
            branchOrTagName: "main"
          }
        }
      ]
    })
  },
  {
    description: "GitHub Action Workflow With Inputs",
    example: yaml__default$b.default.stringify({
      steps: [
        {
          action: "github:actions:dispatch",
          name: "Dispatch Github Action Workflow with inputs",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            workflowId: "WORKFLOW_ID",
            branchOrTagName: "main",
            workflowInputs: {
              input1: "value1",
              input2: "value2"
            }
          }
        }
      ]
    })
  },
  {
    description: "GitHub Action Workflow With Custom Token",
    example: yaml__default$b.default.stringify({
      steps: [
        {
          action: "github:actions:dispatch",
          name: "Dispatch GitHub Action Workflow (custom token)",
          input: {
            repoUrl: "github.com?repo=reponame&owner=owner",
            workflowId: "WORKFLOW_ID",
            branchOrTagName: "release-1.0",
            token: "${{ secrets.MY_CUSTOM_TOKEN }}"
          }
        }
      ]
    })
  }
];

githubActionsDispatch_examples_cjs.examples = examples$b;

var errors$a = require$$0;
var pluginScaffolderNode$a = require$$1$1;
var octokit$a = require$$2;
var helpers$a = helpers_cjs;
var githubActionsDispatch_examples = githubActionsDispatch_examples_cjs;

function createGithubActionsDispatchAction(options) {
  const { integrations, githubCredentialsProvider } = options;
  return pluginScaffolderNode$a.createTemplateAction({
    id: "github:actions:dispatch",
    description: "Dispatches a GitHub Action workflow for a given branch or tag",
    examples: githubActionsDispatch_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "workflowId", "branchOrTagName"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
            type: "string"
          },
          workflowId: {
            title: "Workflow ID",
            description: "The GitHub Action Workflow filename",
            type: "string"
          },
          branchOrTagName: {
            title: "Branch or Tag name",
            description: "The git branch or tag name used to dispatch the workflow",
            type: "string"
          },
          workflowInputs: {
            title: "Workflow Inputs",
            description: "Inputs keys and values to send to GitHub Action configured on the workflow file. The maximum number of properties is 10. ",
            type: "object"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The GITHUB_TOKEN to use for authorization to GitHub"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        workflowId,
        branchOrTagName,
        workflowInputs,
        token: providedToken
      } = ctx.input;
      ctx.logger.info(
        `Dispatching workflow ${workflowId} for repo ${repoUrl} on ${branchOrTagName}`
      );
      const { owner, repo } = pluginScaffolderNode$a.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$a.InputError("Invalid repository owner provided in repoUrl");
      }
      const client = new octokit$a.Octokit(
        await helpers$a.getOctokitOptions({
          integrations,
          repoUrl,
          credentialsProvider: githubCredentialsProvider,
          token: providedToken
        })
      );
      await client.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: workflowId,
        ref: branchOrTagName,
        inputs: workflowInputs
      });
      ctx.logger.info(`Workflow ${workflowId} dispatched successfully`);
    }
  });
}

githubActionsDispatch_cjs.createGithubActionsDispatchAction = createGithubActionsDispatchAction;

var githubIssuesLabel_cjs = {};

var githubIssuesLabel_examples_cjs = {};

var yaml$a = require$$0$1;

function _interopDefaultCompat$d (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$a = /*#__PURE__*/_interopDefaultCompat$d(yaml$a);

const examples$a = [
  {
    description: "Add labels to pull request or issue",
    example: yaml__default$a.default.stringify({
      steps: [
        {
          action: "github:issues:label",
          name: "Add labels to pull request or issue",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            number: "1",
            labels: ["bug"]
          }
        }
      ]
    })
  },
  {
    description: "Add labels to pull request or issue with specific token",
    example: yaml__default$a.default.stringify({
      steps: [
        {
          action: "github:issues:label",
          name: "Add labels to pull request or issue with token",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            number: "1",
            labels: ["bug", "documentation"],
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  }
];

githubIssuesLabel_examples_cjs.examples = examples$a;

var pluginScaffolderNode$9 = require$$1$1;
var errors$9 = require$$0;
var octokit$9 = require$$2;
var helpers$9 = helpers_cjs;
var githubIssuesLabel_examples = githubIssuesLabel_examples_cjs;

function createGithubIssuesLabelAction(options) {
  const { integrations, githubCredentialsProvider } = options;
  return pluginScaffolderNode$9.createTemplateAction({
    id: "github:issues:label",
    description: "Adds labels to a pull request or issue on GitHub.",
    examples: githubIssuesLabel_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "number", "labels"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the repository name and 'owner' is an organization or username`,
            type: "string"
          },
          number: {
            title: "Pull Request or issue number",
            description: "The pull request or issue number to add labels to",
            type: "number"
          },
          labels: {
            title: "Labels",
            description: "The labels to add to the pull request or issue",
            type: "array",
            items: {
              type: "string"
            }
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The GITHUB_TOKEN to use for authorization to GitHub"
          }
        }
      }
    },
    async handler(ctx) {
      const { repoUrl, number, labels, token: providedToken } = ctx.input;
      const { owner, repo } = pluginScaffolderNode$9.parseRepoUrl(repoUrl, integrations);
      ctx.logger.info(`Adding labels to ${number} issue on repo ${repo}`);
      if (!owner) {
        throw new errors$9.InputError("Invalid repository owner provided in repoUrl");
      }
      const client = new octokit$9.Octokit(
        await helpers$9.getOctokitOptions({
          integrations,
          credentialsProvider: githubCredentialsProvider,
          repoUrl,
          token: providedToken
        })
      );
      try {
        await client.rest.issues.addLabels({
          owner,
          repo,
          issue_number: number,
          labels
        });
      } catch (e) {
        errors$9.assertError(e);
        ctx.logger.warn(
          `Failed: adding labels to issue: '${number}' on repo: '${repo}', ${e.message}`
        );
      }
    }
  });
}

githubIssuesLabel_cjs.createGithubIssuesLabelAction = createGithubIssuesLabelAction;

var githubRepoCreate_cjs = {};

var inputProperties_cjs = {};

const repoUrl = {
  title: "Repository Location",
  description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
  type: "string"
};
const description = {
  title: "Repository Description",
  type: "string"
};
const homepage = {
  title: "Repository Homepage",
  type: "string"
};
const access = {
  title: "Repository Access",
  description: `Sets an admin collaborator on the repository. Can either be a user reference different from 'owner' in 'repoUrl' or team reference, eg. 'org/team-name'`,
  type: "string"
};
const requireCodeOwnerReviews = {
  title: "Require CODEOWNER Reviews?",
  description: "Require an approved review in PR including files with a designated Code Owner",
  type: "boolean"
};
const dismissStaleReviews = {
  title: "Dismiss Stale Reviews",
  description: "New reviewable commits pushed to a matching branch will dismiss pull request review approvals.",
  type: "boolean"
};
const requiredStatusCheckContexts = {
  title: "Required Status Check Contexts",
  description: "The list of status checks to require in order to merge into this branch",
  type: "array",
  items: {
    type: "string"
  }
};
const requireBranchesToBeUpToDate = {
  title: "Require Branches To Be Up To Date?",
  description: `Require branches to be up to date before merging. The default value is 'true'`,
  type: "boolean"
};
const requiredConversationResolution = {
  title: "Required Conversation Resolution",
  description: "Requires all conversations on code to be resolved before a pull request can be merged into this branch",
  type: "boolean"
};
const requireLastPushApproval = {
  title: "Require last push approval",
  type: "boolean",
  description: `Whether the most recent push to a PR must be approved by someone other than the person who pushed it. The default value is 'false'`
};
const repoVisibility = {
  title: "Repository Visibility",
  type: "string",
  enum: ["private", "public", "internal"]
};
const deleteBranchOnMerge = {
  title: "Delete Branch On Merge",
  type: "boolean",
  description: `Delete the branch after merging the PR. The default value is 'false'`
};
const gitAuthorName = {
  title: "Default Author Name",
  type: "string",
  description: `Sets the default author name for the commit. The default value is 'Scaffolder'`
};
const gitAuthorEmail = {
  title: "Default Author Email",
  type: "string",
  description: `Sets the default author email for the commit.`
};
const allowMergeCommit = {
  title: "Allow Merge Commits",
  type: "boolean",
  description: `Allow merge commits. The default value is 'true'`
};
const allowSquashMerge = {
  title: "Allow Squash Merges",
  type: "boolean",
  description: `Allow squash merges. The default value is 'true'`
};
const squashMergeCommitTitle = {
  title: "Default squash merge commit title",
  enum: ["PR_TITLE", "COMMIT_OR_PR_TITLE"],
  description: `Sets the default value for a squash merge commit title. The default value is 'COMMIT_OR_PR_TITLE'`
};
const squashMergeCommitMessage = {
  title: "Default squash merge commit message",
  enum: ["PR_BODY", "COMMIT_MESSAGES", "BLANK"],
  description: `Sets the default value for a squash merge commit message. The default value is 'COMMIT_MESSAGES'`
};
const allowRebaseMerge = {
  title: "Allow Rebase Merges",
  type: "boolean",
  description: `Allow rebase merges. The default value is 'true'`
};
const allowAutoMerge = {
  title: "Allow Auto Merges",
  type: "boolean",
  description: `Allow individual PRs to merge automatically when all merge requirements are met. The default value is 'false'`
};
const collaborators = {
  title: "Collaborators",
  description: "Provide additional users or teams with permissions",
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["access"],
    properties: {
      access: {
        type: "string",
        description: "The type of access for the user"
      },
      user: {
        type: "string",
        description: "The name of the user that will be added as a collaborator"
      },
      team: {
        type: "string",
        description: "The name of the team that will be added as a collaborator"
      }
    },
    oneOf: [{ required: ["user"] }, { required: ["team"] }]
  }
};
const hasProjects = {
  title: "Enable projects",
  type: "boolean",
  description: `Enable projects for the repository. The default value is 'true' unless the organization has disabled repository projects`
};
const hasWiki = {
  title: "Enable the wiki",
  type: "boolean",
  description: `Enable the wiki for the repository. The default value is 'true'`
};
const hasIssues = {
  title: "Enable issues",
  type: "boolean",
  description: `Enable issues for the repository. The default value is 'true'`
};
const token = {
  title: "Authentication Token",
  type: "string",
  description: "The token to use for authorization to GitHub"
};
const topics = {
  title: "Topics",
  type: "array",
  items: {
    type: "string"
  }
};
const defaultBranch = {
  title: "Default Branch",
  type: "string",
  description: `Sets the default branch on the repository. The default value is 'master'`
};
const protectDefaultBranch = {
  title: "Protect Default Branch",
  type: "boolean",
  description: `Protect the default branch after creating the repository. The default value is 'true'`
};
const protectEnforceAdmins = {
  title: "Enforce Admins On Protected Branches",
  type: "boolean",
  description: `Enforce admins to adhere to default branch protection. The default value is 'true'`
};
const bypassPullRequestAllowances = {
  title: "Bypass pull request requirements",
  description: "Allow specific users, teams, or apps to bypass pull request requirements.",
  type: "object",
  additionalProperties: false,
  properties: {
    apps: {
      type: "array",
      items: {
        type: "string"
      }
    },
    users: {
      type: "array",
      items: {
        type: "string"
      }
    },
    teams: {
      type: "array",
      items: {
        type: "string"
      }
    }
  }
};
const gitCommitMessage = {
  title: "Git Commit Message",
  type: "string",
  description: `Sets the commit message on the repository. The default value is 'initial commit'`
};
const sourcePath = {
  title: "Source Path",
  description: "Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository.",
  type: "string"
};
const requiredApprovingReviewCount = {
  title: "Required approving review count",
  type: "number",
  description: `Specify the number of reviewers required to approve pull requests. Use a number between 1 and 6 or 0 to not require reviewers. Defaults to 1.`
};
const restrictions = {
  title: "Restrict who can push to the protected branch",
  description: "Restrict who can push to the protected branch. User, app, and team restrictions are only available for organization-owned repositories.",
  type: "object",
  additionalProperties: false,
  properties: {
    apps: {
      type: "array",
      items: {
        type: "string"
      }
    },
    users: {
      type: "array",
      items: {
        type: "string"
      }
    },
    teams: {
      type: "array",
      items: {
        type: "string"
      }
    }
  }
};
const requiredCommitSigning = {
  title: "Require commit signing",
  type: "boolean",
  description: `Require commit signing so that you must sign commits on this branch.`
};
const repoVariables = {
  title: "Repository Variables",
  description: `Variables attached to the repository`,
  type: "object"
};
const secrets = {
  title: "Repository Secrets",
  description: `Secrets attached to the repository`,
  type: "object"
};
const oidcCustomization = {
  title: "Repository OIDC customization template",
  description: `OIDC customization template attached to the repository.`,
  type: "object",
  additionalProperties: false,
  properties: {
    useDefault: {
      title: "Use Default",
      type: "boolean",
      description: `Whether to use the default OIDC template or not.`
    },
    includeClaimKeys: {
      title: "Include claim keys",
      type: "array",
      items: {
        type: "string"
      },
      description: `Array of unique strings. Each claim key can only contain alphanumeric characters and underscores.`
    }
  }
};
const customProperties = {
  title: "Custom Repository Properties",
  description: "Custom properties to be added to the repository (note, this only works for organization repositories)",
  type: "object"
};

inputProperties_cjs.access = access;
inputProperties_cjs.allowAutoMerge = allowAutoMerge;
inputProperties_cjs.allowMergeCommit = allowMergeCommit;
inputProperties_cjs.allowRebaseMerge = allowRebaseMerge;
inputProperties_cjs.allowSquashMerge = allowSquashMerge;
inputProperties_cjs.bypassPullRequestAllowances = bypassPullRequestAllowances;
inputProperties_cjs.collaborators = collaborators;
inputProperties_cjs.customProperties = customProperties;
inputProperties_cjs.defaultBranch = defaultBranch;
inputProperties_cjs.deleteBranchOnMerge = deleteBranchOnMerge;
inputProperties_cjs.description = description;
inputProperties_cjs.dismissStaleReviews = dismissStaleReviews;
inputProperties_cjs.gitAuthorEmail = gitAuthorEmail;
inputProperties_cjs.gitAuthorName = gitAuthorName;
inputProperties_cjs.gitCommitMessage = gitCommitMessage;
inputProperties_cjs.hasIssues = hasIssues;
inputProperties_cjs.hasProjects = hasProjects;
inputProperties_cjs.hasWiki = hasWiki;
inputProperties_cjs.homepage = homepage;
inputProperties_cjs.oidcCustomization = oidcCustomization;
inputProperties_cjs.protectDefaultBranch = protectDefaultBranch;
inputProperties_cjs.protectEnforceAdmins = protectEnforceAdmins;
inputProperties_cjs.repoUrl = repoUrl;
inputProperties_cjs.repoVariables = repoVariables;
inputProperties_cjs.repoVisibility = repoVisibility;
inputProperties_cjs.requireBranchesToBeUpToDate = requireBranchesToBeUpToDate;
inputProperties_cjs.requireCodeOwnerReviews = requireCodeOwnerReviews;
inputProperties_cjs.requireLastPushApproval = requireLastPushApproval;
inputProperties_cjs.requiredApprovingReviewCount = requiredApprovingReviewCount;
inputProperties_cjs.requiredCommitSigning = requiredCommitSigning;
inputProperties_cjs.requiredConversationResolution = requiredConversationResolution;
inputProperties_cjs.requiredStatusCheckContexts = requiredStatusCheckContexts;
inputProperties_cjs.restrictions = restrictions;
inputProperties_cjs.secrets = secrets;
inputProperties_cjs.sourcePath = sourcePath;
inputProperties_cjs.squashMergeCommitMessage = squashMergeCommitMessage;
inputProperties_cjs.squashMergeCommitTitle = squashMergeCommitTitle;
inputProperties_cjs.token = token;
inputProperties_cjs.topics = topics;

var outputProperties_cjs = {};

const remoteUrl = {
  title: "A URL to the repository with the provider",
  type: "string"
};
const repoContentsUrl = {
  title: "A URL to the root of the repository",
  type: "string"
};
const commitHash = {
  title: "The git commit hash of the initial commit",
  type: "string"
};

outputProperties_cjs.commitHash = commitHash;
outputProperties_cjs.remoteUrl = remoteUrl;
outputProperties_cjs.repoContentsUrl = repoContentsUrl;

var githubRepoCreate_examples_cjs = {};

var yaml$9 = require$$0$1;

function _interopDefaultCompat$c (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$9 = /*#__PURE__*/_interopDefaultCompat$c(yaml$9);

const examples$9 = [
  {
    description: "Creates a GitHub repository with default configuration.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner"
          }
        }
      ]
    })
  },
  {
    description: "Add a description.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with a description",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            description: "My new repository"
          }
        }
      ]
    })
  },
  {
    description: "Disable wiki and issues.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository without wiki and issues",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            hasIssues: false,
            hasWiki: false
          }
        }
      ]
    })
  },
  {
    description: "Set repository homepage.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with homepage",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            homepage: "https://example.com"
          }
        }
      ]
    })
  },
  {
    description: "Create a private repository.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new private GitHub repository",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "private"
          }
        }
      ]
    })
  },
  {
    description: "Enable required code owner reviews.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with required code owner reviews",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requireCodeOwnerReviews: true
          }
        }
      ]
    })
  },
  {
    description: "Set required approving review count to 2.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with required approving review count",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredApprovingReviewCount: 2
          }
        }
      ]
    })
  },
  {
    description: "Allow squash merge only.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository allowing only squash merge",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowMergeCommit: false,
            allowSquashMerge: true,
            allowRebaseMerge: false
          }
        }
      ]
    })
  },
  {
    description: "Set squash merge commit title to pull request title.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with squash merge commit title set to pull request title",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            squashMergeCommitTitle: "pull_request_title"
          }
        }
      ]
    })
  },
  {
    description: "Set squash merge commit message to blank.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with squash merge commit message set to blank",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            squashMergeCommitMessage: "blank"
          }
        }
      ]
    })
  },
  {
    description: "Allow auto-merge.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository allowing auto-merge",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowAutoMerge: true
          }
        }
      ]
    })
  },
  {
    description: "Set collaborators with push access.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with collaborators having push access",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            collaborators: [
              { username: "user1", permission: "push" },
              { username: "user2", permission: "push" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Add topics to repository.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with topics",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            topics: ["devops", "kubernetes", "ci-cd"]
          }
        }
      ]
    })
  },
  {
    description: "Add secret variables to repository.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with secret variables",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            secrets: [
              { name: "SECRET_KEY", value: "supersecretkey" },
              { name: "API_TOKEN", value: "tokenvalue" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Enable branch protection requiring status checks.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch protection requiring status checks",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredStatusCheckContexts: ["ci/circleci: build"]
          }
        }
      ]
    })
  },
  {
    description: "Require branches to be up-to-date before merging.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository requiring branches to be up-to-date before merging",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requireBranchesToBeUpToDate: true
          }
        }
      ]
    })
  },
  {
    description: "Require conversation resolution before merging.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository requiring conversation resolution before merging",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredConversationResolution: true
          }
        }
      ]
    })
  },
  {
    description: "Delete branch on merge.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch deletion on merge",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            deleteBranchOnMerge: true
          }
        }
      ]
    })
  },
  {
    description: "Customize OIDC token.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with OIDC token customization",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            oidcCustomization: {
              sub: "repo:owner/repo",
              aud: "https://github.com"
            }
          }
        }
      ]
    })
  },
  {
    description: "Require commit signing.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository requiring commit signing",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredCommitSigning: true
          }
        }
      ]
    })
  },
  {
    description: "Set multiple properties including description, homepage, and visibility.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with multiple properties",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            description: "A repository for project XYZ",
            homepage: "https://project-xyz.com",
            repoVisibility: "internal"
          }
        }
      ]
    })
  },
  {
    description: "Configure branch protection with multiple settings.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch protection settings",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredStatusCheckContexts: [
              "ci/circleci: build",
              "ci/circleci: test"
            ],
            requireBranchesToBeUpToDate: true,
            requiredConversationResolution: true,
            requiredApprovingReviewCount: 2
          }
        }
      ]
    })
  },
  {
    description: "Set repository access to private and add collaborators with admin access.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new private GitHub repository with collaborators",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "private",
            collaborators: [
              { username: "admin1", permission: "admin" },
              { username: "admin2", permission: "admin" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Enable GitHub Projects for the repository.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with GitHub Projects enabled",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            hasProjects: true
          }
        }
      ]
    })
  },
  {
    description: "Disable merge commits and allow only rebase and squash merges.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository allowing only rebase and squash merges",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowMergeCommit: false,
            allowRebaseMerge: true,
            allowSquashMerge: true
          }
        }
      ]
    })
  },
  {
    description: "Set repository access to internal with no projects and issues.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new internal GitHub repository without projects and issues",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "internal",
            hasProjects: false,
            hasIssues: false
          }
        }
      ]
    })
  },
  {
    description: "Create repository with OIDC customization for specific audience.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with OIDC customization for specific audience",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            oidcCustomization: {
              sub: "repo:owner/repo",
              aud: "https://specific-audience.com"
            }
          }
        }
      ]
    })
  },
  {
    description: "Require all branches to be up-to-date before merging.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository requiring all branches to be up-to-date",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requireBranchesToBeUpToDate: true
          }
        }
      ]
    })
  },
  {
    description: "Set description and topics for the repository.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with description and topics",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            description: "Repository for project ABC",
            topics: ["python", "machine-learning", "data-science"]
          }
        }
      ]
    })
  },
  {
    description: "Set repository visibility to public and enable commit signing.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new public GitHub repository with commit signing required",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "public",
            requiredCommitSigning: true
          }
        }
      ]
    })
  },
  {
    description: "Create a repository with collaborators and default branch protection.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with collaborators and branch protection",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            collaborators: [
              { username: "contributor1", permission: "write" },
              { username: "contributor2", permission: "write" }
            ],
            requiredStatusCheckContexts: ["ci/travis: build"]
          }
        }
      ]
    })
  },
  {
    description: "Add multiple secret variables.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with multiple secret variables",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            secrets: [
              { name: "SECRET_KEY_1", value: "value1" },
              { name: "SECRET_KEY_2", value: "value2" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Require a minimum of 2 approving reviews for merging.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with 2 required approving reviews",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredApprovingReviewCount: 2
          }
        }
      ]
    })
  },
  {
    description: "Enable branch protection with conversation resolution required.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch protection and conversation resolution required",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredConversationResolution: true
          }
        }
      ]
    })
  },
  {
    description: "Set repository visibility to internal with description and homepage.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new internal GitHub repository with description and homepage",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "internal",
            description: "Internal repository for team collaboration",
            homepage: "https://internal.example.com"
          }
        }
      ]
    })
  },
  {
    description: "Disable auto-merge.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with auto-merge disabled",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowAutoMerge: false
          }
        }
      ]
    })
  },
  {
    description: "Set repository topics and enable GitHub Projects.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with topics and GitHub Projects enabled",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            topics: ["opensource", "nodejs", "api"],
            hasProjects: true
          }
        }
      ]
    })
  },
  {
    description: "Create a private repository with collaborators having admin and write access.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new private GitHub repository with multiple collaborators",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "private",
            collaborators: [
              { username: "admin1", permission: "admin" },
              { username: "writer1", permission: "write" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Disable branch deletion on merge.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch deletion on merge disabled",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            deleteBranchOnMerge: false
          }
        }
      ]
    })
  },
  {
    description: "Set repository visibility to internal and enable commit signing.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new internal GitHub repository with commit signing required",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "internal",
            requiredCommitSigning: true
          }
        }
      ]
    })
  },
  {
    description: "Create repository with description, homepage, and required status checks.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with description, homepage, and status checks",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            description: "Repository for web application project",
            homepage: "https://webapp.example.com",
            requiredStatusCheckContexts: [
              "ci/travis: build",
              "ci/travis: lint"
            ]
          }
        }
      ]
    })
  },
  {
    description: "Enable squash merges only and set commit message to pull request description.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository allowing only squash merges with commit message set to pull request description",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowMergeCommit: false,
            allowSquashMerge: true,
            allowRebaseMerge: false,
            squashMergeCommitMessage: "pull_request_description"
          }
        }
      ]
    })
  },
  {
    description: "Enable rebase merges only and require commit signing.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository allowing only rebase merges with commit signing required",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowMergeCommit: false,
            allowRebaseMerge: true,
            allowSquashMerge: false,
            requiredCommitSigning: true
          }
        }
      ]
    })
  },
  {
    description: "Create repository with OIDC customization for multiple audiences.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with OIDC customization for multiple audiences",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            oidcCustomization: {
              sub: "repo:owner/repo",
              aud: ["https://audience1.com", "https://audience2.com"]
            }
          }
        }
      ]
    })
  },
  {
    description: "Enable branch protection with required approving reviews and status checks.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch protection requiring approving reviews and status checks",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredApprovingReviewCount: 2,
            requiredStatusCheckContexts: [
              "ci/circleci: build",
              "ci/circleci: test"
            ]
          }
        }
      ]
    })
  },
  {
    description: "Create a public repository with topics and secret variables.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new public GitHub repository with topics and secret variables",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "public",
            topics: ["javascript", "react", "frontend"],
            secrets: [
              { name: "API_KEY", value: "apikeyvalue" },
              { name: "DB_PASSWORD", value: "dbpasswordvalue" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Set repository description and disable issues and wiki.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with description, and disable issues and wiki",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            description: "Repository for backend service",
            hasIssues: false,
            hasWiki: false
          }
        }
      ]
    })
  },
  {
    description: "Enable required conversation resolution and commit signing.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with required conversation resolution and commit signing",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredConversationResolution: true,
            requiredCommitSigning: true
          }
        }
      ]
    })
  },
  {
    description: "Set repository visibility to private and require branches to be up-to-date.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new private GitHub repository requiring branches to be up-to-date",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "private",
            requireBranchesToBeUpToDate: true
          }
        }
      ]
    })
  },
  {
    description: "Create a repository with default settings and add multiple topics.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with default settings and topics",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            topics: ["devops", "ci-cd", "automation"]
          }
        }
      ]
    })
  },
  {
    description: "Disable merge commits, enable auto-merge, and require commit signing.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository disabling merge commits, enabling auto-merge, and requiring commit signing",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            allowMergeCommit: false,
            allowAutoMerge: true,
            requiredCommitSigning: true
          }
        }
      ]
    })
  },
  {
    description: "Create a repository with homepage, collaborators, and topics.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with homepage, collaborators, and topics",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            homepage: "https://example.com",
            collaborators: [
              { username: "user1", permission: "push" },
              { username: "user2", permission: "admin" }
            ],
            topics: ["opensource", "contribution"]
          }
        }
      ]
    })
  },
  {
    description: "Create a repository with branch protection and description.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch protection and description",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredStatusCheckContexts: ["ci/travis: build"],
            requiredApprovingReviewCount: 1,
            description: "Repository for microservice development"
          }
        }
      ]
    })
  },
  {
    description: "Create a repository with OIDC customization and topics.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with OIDC customization and topics",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            oidcCustomization: {
              sub: "repo:owner/repo",
              aud: "https://api.example.com"
            },
            topics: ["api", "security"]
          }
        }
      ]
    })
  },
  {
    description: "Enable required code owner reviews and branch deletion on merge.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with required code owner reviews and branch deletion on merge",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requireCodeOwnerReviews: true,
            deleteBranchOnMerge: true
          }
        }
      ]
    })
  },
  {
    description: "Create a repository with multiple secret variables and collaborators.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with multiple secret variables and collaborators",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            secrets: [
              { name: "API_SECRET", value: "secretvalue" },
              { name: "DB_USER", value: "dbuser" }
            ],
            collaborators: [
              { username: "dev1", permission: "write" },
              { username: "dev2", permission: "push" }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Enable branch protection requiring status checks and conversation resolution.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          action: "github:repo:create",
          name: "Create a new GitHub repository with branch protection requiring status checks and conversation resolution",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requiredStatusCheckContexts: ["ci/build"],
            requiredConversationResolution: true
          }
        }
      ]
    })
  }
];

githubRepoCreate_examples_cjs.examples = examples$9;

var errors$8 = require$$0;
var octokit$8 = require$$2;
var pluginScaffolderNode$8 = require$$1$1;
var helpers$8 = helpers_cjs;
var inputProperties$3 = inputProperties_cjs;
var outputProperties$2 = outputProperties_cjs;
var githubRepoCreate_examples = githubRepoCreate_examples_cjs;

function createGithubRepoCreateAction(options) {
  const { integrations, githubCredentialsProvider } = options;
  return pluginScaffolderNode$8.createTemplateAction({
    id: "github:repo:create",
    description: "Creates a GitHub repository.",
    examples: githubRepoCreate_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl"],
        properties: {
          repoUrl: inputProperties$3.repoUrl,
          description: inputProperties$3.description,
          homepage: inputProperties$3.homepage,
          access: inputProperties$3.access,
          requireCodeOwnerReviews: inputProperties$3.requireCodeOwnerReviews,
          bypassPullRequestAllowances: inputProperties$3.bypassPullRequestAllowances,
          requiredApprovingReviewCount: inputProperties$3.requiredApprovingReviewCount,
          restrictions: inputProperties$3.restrictions,
          requiredStatusCheckContexts: inputProperties$3.requiredStatusCheckContexts,
          requireBranchesToBeUpToDate: inputProperties$3.requireBranchesToBeUpToDate,
          requiredConversationResolution: inputProperties$3.requiredConversationResolution,
          repoVisibility: inputProperties$3.repoVisibility,
          deleteBranchOnMerge: inputProperties$3.deleteBranchOnMerge,
          allowMergeCommit: inputProperties$3.allowMergeCommit,
          allowSquashMerge: inputProperties$3.allowSquashMerge,
          squashMergeCommitTitle: inputProperties$3.squashMergeCommitTitle,
          squashMergeCommitMessage: inputProperties$3.squashMergeCommitMessage,
          allowRebaseMerge: inputProperties$3.allowRebaseMerge,
          allowAutoMerge: inputProperties$3.allowAutoMerge,
          collaborators: inputProperties$3.collaborators,
          hasProjects: inputProperties$3.hasProjects,
          hasWiki: inputProperties$3.hasWiki,
          hasIssues: inputProperties$3.hasIssues,
          token: inputProperties$3.token,
          topics: inputProperties$3.topics,
          repoVariables: inputProperties$3.repoVariables,
          secrets: inputProperties$3.secrets,
          oidcCustomization: inputProperties$3.oidcCustomization,
          requiredCommitSigning: inputProperties$3.requiredCommitSigning,
          customProperties: inputProperties$3.customProperties
        }
      },
      output: {
        type: "object",
        properties: {
          remoteUrl: outputProperties$2.remoteUrl,
          repoContentsUrl: outputProperties$2.repoContentsUrl
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        description,
        homepage,
        access,
        repoVisibility = "private",
        deleteBranchOnMerge = false,
        allowMergeCommit = true,
        allowSquashMerge = true,
        squashMergeCommitTitle = "COMMIT_OR_PR_TITLE",
        squashMergeCommitMessage = "COMMIT_MESSAGES",
        allowRebaseMerge = true,
        allowAutoMerge = false,
        collaborators,
        hasProjects = void 0,
        hasWiki = void 0,
        hasIssues = void 0,
        topics,
        repoVariables,
        secrets,
        oidcCustomization,
        customProperties,
        token: providedToken
      } = ctx.input;
      const octokitOptions = await helpers$8.getOctokitOptions({
        integrations,
        credentialsProvider: githubCredentialsProvider,
        token: providedToken,
        repoUrl
      });
      const client = new octokit$8.Octokit(octokitOptions);
      const { owner, repo } = pluginScaffolderNode$8.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$8.InputError("Invalid repository owner provided in repoUrl");
      }
      const newRepo = await helpers$8.createGithubRepoWithCollaboratorsAndTopics(
        client,
        repo,
        owner,
        repoVisibility,
        description,
        homepage,
        deleteBranchOnMerge,
        allowMergeCommit,
        allowSquashMerge,
        squashMergeCommitTitle,
        squashMergeCommitMessage,
        allowRebaseMerge,
        allowAutoMerge,
        access,
        collaborators,
        hasProjects,
        hasWiki,
        hasIssues,
        topics,
        repoVariables,
        secrets,
        oidcCustomization,
        customProperties,
        ctx.logger
      );
      ctx.output("remoteUrl", newRepo.clone_url);
    }
  });
}

githubRepoCreate_cjs.createGithubRepoCreateAction = createGithubRepoCreateAction;

var githubRepoPush_cjs = {};

var githubRepoPush_examples_cjs = {};

var yaml$8 = require$$0$1;

function _interopDefaultCompat$b (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$8 = /*#__PURE__*/_interopDefaultCompat$b(yaml$8);

const examples$8 = [
  {
    description: "Setup repo with no modifications to branch protection rules",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          action: "github:repo:push",
          name: "Create test repo with testuser as owner.",
          input: {
            repoUrl: "github.com?repo=test&owner=testuser"
          }
        }
      ]
    })
  },
  {
    description: "Setup repo with required codeowners check",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          action: "github:repo:push",
          name: "Require codeowner branch protection rule",
          input: {
            repoUrl: "github.com?repo=reponame&owner=owner",
            requireCodeOwnerReviews: true
          }
        }
      ]
    })
  },
  {
    description: "Change the default required number of approvals",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          action: "github:repo:push",
          name: "Require two approvals before merging",
          input: {
            repoUrl: "github.com?repo=reponame&owner=owner",
            requiredApprovingReviewCount: 2
          }
        }
      ]
    })
  }
];

githubRepoPush_examples_cjs.examples = examples$8;

var errors$7 = require$$0;
var octokit$7 = require$$2;
var pluginScaffolderNode$7 = require$$1$1;
var helpers$7 = helpers_cjs;
var inputProperties$2 = inputProperties_cjs;
var outputProperties$1 = outputProperties_cjs;
var githubRepoPush_examples = githubRepoPush_examples_cjs;

function createGithubRepoPushAction(options) {
  const { integrations, config, githubCredentialsProvider } = options;
  return pluginScaffolderNode$7.createTemplateAction({
    id: "github:repo:push",
    description: "Initializes a git repository of contents in workspace and publishes it to GitHub.",
    examples: githubRepoPush_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl"],
        properties: {
          repoUrl: inputProperties$2.repoUrl,
          requireCodeOwnerReviews: inputProperties$2.requireCodeOwnerReviews,
          dismissStaleReviews: inputProperties$2.dismissStaleReviews,
          requiredStatusCheckContexts: inputProperties$2.requiredStatusCheckContexts,
          bypassPullRequestAllowances: inputProperties$2.bypassPullRequestAllowances,
          requiredApprovingReviewCount: inputProperties$2.requiredApprovingReviewCount,
          restrictions: inputProperties$2.restrictions,
          requireBranchesToBeUpToDate: inputProperties$2.requireBranchesToBeUpToDate,
          requiredConversationResolution: inputProperties$2.requiredConversationResolution,
          requireLastPushApproval: inputProperties$2.requireLastPushApproval,
          defaultBranch: inputProperties$2.defaultBranch,
          protectDefaultBranch: inputProperties$2.protectDefaultBranch,
          protectEnforceAdmins: inputProperties$2.protectEnforceAdmins,
          gitCommitMessage: inputProperties$2.gitCommitMessage,
          gitAuthorName: inputProperties$2.gitAuthorName,
          gitAuthorEmail: inputProperties$2.gitAuthorEmail,
          sourcePath: inputProperties$2.sourcePath,
          token: inputProperties$2.token,
          requiredCommitSigning: inputProperties$2.requiredCommitSigning
        }
      },
      output: {
        type: "object",
        properties: {
          remoteUrl: outputProperties$1.remoteUrl,
          repoContentsUrl: outputProperties$1.repoContentsUrl,
          commitHash: outputProperties$1.commitHash
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        defaultBranch = "master",
        protectDefaultBranch = true,
        protectEnforceAdmins = true,
        gitCommitMessage = "initial commit",
        gitAuthorName,
        gitAuthorEmail,
        requireCodeOwnerReviews = false,
        dismissStaleReviews = false,
        bypassPullRequestAllowances,
        requiredApprovingReviewCount = 1,
        restrictions,
        requiredStatusCheckContexts = [],
        requireBranchesToBeUpToDate = true,
        requiredConversationResolution = false,
        requireLastPushApproval = false,
        token: providedToken,
        requiredCommitSigning = false
      } = ctx.input;
      const { owner, repo } = pluginScaffolderNode$7.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$7.InputError("Invalid repository owner provided in repoUrl");
      }
      const octokitOptions = await helpers$7.getOctokitOptions({
        integrations,
        credentialsProvider: githubCredentialsProvider,
        token: providedToken,
        repoUrl
      });
      const client = new octokit$7.Octokit(octokitOptions);
      const targetRepo = await client.rest.repos.get({ owner, repo });
      const remoteUrl = targetRepo.data.clone_url;
      const repoContentsUrl = `${targetRepo.data.html_url}/blob/${defaultBranch}`;
      const { commitHash } = await helpers$7.initRepoPushAndProtect(
        remoteUrl,
        octokitOptions.auth,
        ctx.workspacePath,
        ctx.input.sourcePath,
        defaultBranch,
        protectDefaultBranch,
        protectEnforceAdmins,
        owner,
        client,
        repo,
        requireCodeOwnerReviews,
        bypassPullRequestAllowances,
        requiredApprovingReviewCount,
        restrictions,
        requiredStatusCheckContexts,
        requireBranchesToBeUpToDate,
        requiredConversationResolution,
        requireLastPushApproval,
        config,
        ctx.logger,
        gitCommitMessage,
        gitAuthorName,
        gitAuthorEmail,
        dismissStaleReviews,
        requiredCommitSigning
      );
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
      ctx.output("commitHash", commitHash);
    }
  });
}

githubRepoPush_cjs.createGithubRepoPushAction = createGithubRepoPushAction;

var githubWebhook_cjs = {};

var githubWebhook_examples_cjs = {};

var yaml$7 = require$$0$1;

function _interopDefaultCompat$a (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$7 = /*#__PURE__*/_interopDefaultCompat$a(yaml$7);

const examples$7 = [
  {
    description: "Create a GitHub webhook for a repository",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          action: "github:webhook",
          name: "Create GitHub Webhook",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            webhookUrl: "https://example.com/my-webhook",
            webhookSecret: "mysecret",
            events: ["push"],
            active: true,
            contentType: "json",
            insecureSsl: false,
            token: "my-github-token"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub webhook with minimal configuration",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          action: "github:webhook",
          name: "Create GitHub Webhook",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            webhookUrl: "https://example.com/my-webhook"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub webhook with custom events",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          action: "github:webhook",
          name: "Create GitHub Webhook",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            webhookUrl: "https://example.com/my-webhook",
            events: ["push", "pull_request"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub webhook with JSON content type",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          action: "github:webhook",
          name: "Create GitHub Webhook",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            webhookUrl: "https://example.com/my-webhook",
            contentType: "json"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub webhook with insecure SSL",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          action: "github:webhook",
          name: "Create GitHub Webhook",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            webhookUrl: "https://example.com/my-webhook",
            insecureSsl: true
          }
        }
      ]
    })
  },
  {
    description: "Create an inactive GitHub webhook",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          action: "github:webhook",
          name: "Create GitHub Webhook",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            webhookUrl: "https://example.com/my-webhook",
            active: false
          }
        }
      ]
    })
  }
];

githubWebhook_examples_cjs.examples = examples$7;

var pluginScaffolderNode$6 = require$$1$1;
var webhooks = require$$1$2;
var errors$6 = require$$0;
var octokit$6 = require$$2;
var helpers$6 = helpers_cjs;
var githubWebhook_examples = githubWebhook_examples_cjs;

function createGithubWebhookAction(options) {
  const { integrations, defaultWebhookSecret, githubCredentialsProvider } = options;
  const eventNames = webhooks.emitterEventNames.filter((event) => !event.includes("."));
  return pluginScaffolderNode$6.createTemplateAction({
    id: "github:webhook",
    description: "Creates webhook for a repository on GitHub.",
    examples: githubWebhook_examples.examples,
    supportsDryRun: true,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "webhookUrl"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
            type: "string"
          },
          webhookUrl: {
            title: "Webhook URL",
            description: "The URL to which the payloads will be delivered",
            type: "string"
          },
          webhookSecret: {
            title: "Webhook Secret",
            description: "Webhook secret value. The default can be provided internally in action creation",
            type: "string"
          },
          events: {
            title: "Triggering Events",
            description: "Determines what events the hook is triggered for. Default: push",
            type: "array",
            oneOf: [
              {
                items: {
                  type: "string",
                  enum: eventNames
                }
              },
              {
                items: {
                  type: "string",
                  const: "*"
                }
              }
            ]
          },
          active: {
            title: "Active",
            type: "boolean",
            description: `Determines if notifications are sent when the webhook is triggered. Default: true`
          },
          contentType: {
            title: "Content Type",
            type: "string",
            enum: ["form", "json"],
            description: `The media type used to serialize the payloads. The default is 'form'`
          },
          insecureSsl: {
            title: "Insecure SSL",
            type: "boolean",
            description: `Determines whether the SSL certificate of the host for url will be verified when delivering payloads. Default 'false'`
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The GITHUB_TOKEN to use for authorization to GitHub"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        webhookUrl,
        webhookSecret = defaultWebhookSecret,
        events = ["push"],
        active = true,
        contentType = "form",
        insecureSsl = false,
        token: providedToken
      } = ctx.input;
      ctx.logger.info(`Creating webhook ${webhookUrl} for repo ${repoUrl}`);
      const { owner, repo } = pluginScaffolderNode$6.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$6.InputError("Invalid repository owner provided in repoUrl");
      }
      const client = new octokit$6.Octokit(
        await helpers$6.getOctokitOptions({
          integrations,
          credentialsProvider: githubCredentialsProvider,
          repoUrl,
          token: providedToken
        })
      );
      if (ctx.isDryRun) {
        ctx.logger.info(`Dry run complete`);
        return;
      }
      try {
        const insecure_ssl = insecureSsl ? "1" : "0";
        await client.rest.repos.createWebhook({
          owner,
          repo,
          config: {
            url: webhookUrl,
            content_type: contentType,
            secret: webhookSecret,
            insecure_ssl
          },
          events,
          active
        });
        ctx.logger.info(`Webhook '${webhookUrl}' created successfully`);
      } catch (e) {
        errors$6.assertError(e);
        ctx.logger.warn(
          `Failed: create webhook '${webhookUrl}' on repo: '${repo}', ${e.message}`
        );
      }
    }
  });
}

githubWebhook_cjs.createGithubWebhookAction = createGithubWebhookAction;

var githubDeployKey_cjs = {};

var githubDeployKey_examples_cjs = {};

var yaml$6 = require$$0$1;

function _interopDefaultCompat$9 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$6 = /*#__PURE__*/_interopDefaultCompat$9(yaml$6);

const examples$6 = [
  {
    description: "Example 1: Create and store a Deploy Key",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          action: "github:deployKey:create",
          name: "Create and store a Deploy Key",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            publicKey: "pubkey",
            privateKey: "privkey",
            deployKeyName: "Push Tags"
          }
        }
      ]
    })
  }
];

githubDeployKey_examples_cjs.examples = examples$6;

var errors$5 = require$$0;
var pluginScaffolderNode$5 = require$$1$1;
var helpers$5 = helpers_cjs;
var octokit$5 = require$$2;
var Sodium$1 = require$$4;
var githubDeployKey_examples = githubDeployKey_examples_cjs;

function _interopDefaultCompat$8 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Sodium__default$1 = /*#__PURE__*/_interopDefaultCompat$8(Sodium$1);

function createGithubDeployKeyAction(options) {
  const { integrations } = options;
  return pluginScaffolderNode$5.createTemplateAction({
    id: "github:deployKey:create",
    description: "Creates and stores Deploy Keys",
    examples: githubDeployKey_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "publicKey", "privateKey", "deployKeyName"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
            type: "string"
          },
          publicKey: {
            title: "SSH Public Key",
            description: `Generated from ssh-keygen.  Begins with 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519', 'sk-ecdsa-sha2-nistp256@openssh.com', or 'sk-ssh-ed25519@openssh.com'.`,
            type: "string"
          },
          privateKey: {
            title: "SSH Private Key",
            description: `SSH Private Key generated from ssh-keygen`,
            type: "string"
          },
          deployKeyName: {
            title: "Deploy Key Name",
            description: `Name of the Deploy Key`,
            type: "string"
          },
          privateKeySecretName: {
            title: "Private Key GitHub Secret Name",
            description: `Name of the GitHub Secret to store the private key related to the Deploy Key.  Defaults to: 'KEY_NAME_PRIVATE_KEY' where 'KEY_NAME' is the name of the Deploy Key`,
            type: "string"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to GitHub"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          privateKeySecretName: {
            title: "The GitHub Action Repo Secret Name for the Private Key",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        publicKey,
        privateKey,
        deployKeyName,
        privateKeySecretName = `${deployKeyName.split(" ").join("_").toLocaleUpperCase("en-US")}_PRIVATE_KEY`,
        token: providedToken
      } = ctx.input;
      const octokitOptions = await helpers$5.getOctokitOptions({
        integrations,
        token: providedToken,
        repoUrl
      });
      const { owner, repo } = pluginScaffolderNode$5.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$5.InputError(`No owner provided for repo ${repoUrl}`);
      }
      const client = new octokit$5.Octokit(octokitOptions);
      await client.rest.repos.createDeployKey({
        owner,
        repo,
        title: deployKeyName,
        key: publicKey
      });
      const publicKeyResponse = await client.rest.actions.getRepoPublicKey({
        owner,
        repo
      });
      await Sodium__default$1.default.ready;
      const binaryKey = Sodium__default$1.default.from_base64(
        publicKeyResponse.data.key,
        Sodium__default$1.default.base64_variants.ORIGINAL
      );
      const binarySecret = Sodium__default$1.default.from_string(privateKey);
      const encryptedBinarySecret = Sodium__default$1.default.crypto_box_seal(
        binarySecret,
        binaryKey
      );
      const encryptedBase64Secret = Sodium__default$1.default.to_base64(
        encryptedBinarySecret,
        Sodium__default$1.default.base64_variants.ORIGINAL
      );
      await client.rest.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: privateKeySecretName,
        encrypted_value: encryptedBase64Secret,
        key_id: publicKeyResponse.data.key_id
      });
      ctx.output("privateKeySecretName", privateKeySecretName);
    }
  });
}

githubDeployKey_cjs.createGithubDeployKeyAction = createGithubDeployKeyAction;

var githubEnvironment_cjs = {};

var gitHubEnvironment_examples_cjs = {};

var yaml$5 = require$$0$1;

function _interopDefaultCompat$7 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$5 = /*#__PURE__*/_interopDefaultCompat$7(yaml$5);

const examples$5 = [
  {
    description: "Create a GitHub Environment (No Policies, No Variables, No Secrets)",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Protected Branch Policy",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: {
              protected_branches: true,
              custom_branch_policies: false
            }
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Custom Branch Policies",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: {
              protected_branches: false,
              custom_branch_policies: true
            },
            customBranchPolicyNames: ["main", "*.*.*"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Environment Variables and Secrets",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            environmentVariables: {
              key1: "val1",
              key2: "val2"
            },
            secrets: {
              secret1: "supersecret1",
              secret2: "supersecret2"
            }
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Custom Tag Policies",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            customTagPolicyNames: ["release/*/*", "v*.*.*"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Both Branch and Tag Policies",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: {
              protected_branches: false,
              custom_branch_policies: true
            },
            customBranchPolicyNames: ["feature/*", "hotfix/*"],
            customTagPolicyNames: ["release/*", "v*"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Full Configuration",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: {
              protected_branches: false,
              custom_branch_policies: true
            },
            customBranchPolicyNames: ["dev/*", "test/*"],
            customTagPolicyNames: ["v1.*", "v2.*"],
            environmentVariables: {
              API_KEY: "123456789",
              NODE_ENV: "production"
            },
            secrets: {
              DATABASE_URL: "supersecretdatabaseurl",
              API_SECRET: "supersecretapisecret"
            },
            token: "ghp_abcdef1234567890"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Only Token Authentication",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            token: "ghp_abcdef1234567890"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with No Deployment Policies",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: null
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Custom Branch and Tag Policies",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: {
              protected_branches: false,
              custom_branch_policies: true
            },
            customBranchPolicyNames: ["release/*", "hotfix/*"],
            customTagPolicyNames: ["v*", "release-*"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Environment Variables Only",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            environmentVariables: {
              VAR1: "value1",
              VAR2: "value2"
            }
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Deployment Secrets Only",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            secrets: {
              SECRET1: "secretvalue1",
              SECRET2: "secretvalue2"
            }
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Deployment Branch Policy and Token",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            deploymentBranchPolicy: {
              protected_branches: true,
              custom_branch_policies: false
            },
            token: "ghp_abcdef1234567890"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Environment Variables, Secrets, and Token",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            environmentVariables: {
              VAR1: "value1",
              VAR2: "value2"
            },
            secrets: {
              SECRET1: "secretvalue1",
              SECRET2: "secretvalue2"
            },
            token: "ghp_abcdef1234567890"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Wait Timer",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            waitTimer: 1e3
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Prevent Self Review",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            preventSelfReview: true
          }
        }
      ]
    })
  },
  {
    description: "Create a GitHub Environment with Reviewers",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          action: "github:environment:create",
          name: "Create Environment",
          input: {
            repoUrl: "github.com?repo=repository&owner=owner",
            name: "envname",
            reviewers: ["group:default/team-a", "user:default/johndoe"]
          }
        }
      ]
    })
  }
];

gitHubEnvironment_examples_cjs.examples = examples$5;

var errors$4 = require$$0;
var pluginScaffolderNode$4 = require$$1$1;
var helpers$4 = helpers_cjs;
var octokit$4 = require$$2;
var Sodium = require$$4;
var gitHubEnvironment_examples = gitHubEnvironment_examples_cjs;

function _interopDefaultCompat$6 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Sodium__default = /*#__PURE__*/_interopDefaultCompat$6(Sodium);

function createGithubEnvironmentAction(options) {
  const { integrations, catalogClient } = options;
  return pluginScaffolderNode$4.createTemplateAction({
    id: "github:environment:create",
    description: "Creates Deployment Environments",
    examples: gitHubEnvironment_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "name"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
            type: "string"
          },
          name: {
            title: "Environment Name",
            description: `Name of the deployment environment to create`,
            type: "string"
          },
          deploymentBranchPolicy: {
            title: "Deployment Branch Policy",
            description: `The type of deployment branch policy for this environment. To allow all branches to deploy, set to null.`,
            type: "object",
            required: ["protected_branches", "custom_branch_policies"],
            properties: {
              protected_branches: {
                title: "Protected Branches",
                description: `Whether only branches with branch protection rules can deploy to this environment. If protected_branches is true, custom_branch_policies must be false; if protected_branches is false, custom_branch_policies must be true.`,
                type: "boolean"
              },
              custom_branch_policies: {
                title: "Custom Branch Policies",
                description: `Whether only branches that match the specified name patterns can deploy to this environment. If custom_branch_policies is true, protected_branches must be false; if custom_branch_policies is false, protected_branches must be true.`,
                type: "boolean"
              }
            }
          },
          customBranchPolicyNames: {
            title: "Custom Branch Policy Name",
            description: `The name pattern that branches must match in order to deploy to the environment.

            Wildcard characters will not match /. For example, to match branches that begin with release/ and contain an additional single slash, use release/*/*. For more information about pattern matching syntax, see the Ruby File.fnmatch documentation.`,
            type: "array",
            items: {
              type: "string"
            }
          },
          customTagPolicyNames: {
            title: "Custom Tag Policy Name",
            description: `The name pattern that tags must match in order to deploy to the environment.

            Wildcard characters will not match /. For example, to match tags that begin with release/ and contain an additional single slash, use release/*/*. For more information about pattern matching syntax, see the Ruby File.fnmatch documentation.`,
            type: "array",
            items: {
              type: "string"
            }
          },
          environmentVariables: {
            title: "Environment Variables",
            description: `Environment variables attached to the deployment environment`,
            type: "object"
          },
          secrets: {
            title: "Deployment Secrets",
            description: `Secrets attached to the deployment environment`,
            type: "object"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to GitHub"
          },
          waitTimer: {
            title: "Wait Timer",
            type: "integer",
            description: "The time to wait before creating or updating the environment (in milliseconds)"
          },
          preventSelfReview: {
            title: "Prevent Self Review",
            type: "boolean",
            description: "Whether to prevent self-review for this environment"
          },
          reviewers: {
            title: "Reviewers",
            type: "array",
            description: "Reviewers for this environment",
            items: {
              type: "string"
            }
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        name,
        deploymentBranchPolicy,
        customBranchPolicyNames,
        customTagPolicyNames,
        environmentVariables,
        secrets,
        token: providedToken,
        waitTimer,
        preventSelfReview,
        reviewers
      } = ctx.input;
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const octokitOptions = await helpers$4.getOctokitOptions({
        integrations,
        token: providedToken,
        repoUrl
      });
      const { owner, repo } = pluginScaffolderNode$4.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$4.InputError(`No owner provided for repo ${repoUrl}`);
      }
      const client = new octokit$4.Octokit(octokitOptions);
      const repository = await client.rest.repos.get({
        owner,
        repo
      });
      const githubReviewers = [];
      if (reviewers) {
        let reviewersEntityRefs = [];
        const catalogResponse = await catalogClient?.getEntitiesByRefs({
          entityRefs: reviewers
        });
        if (catalogResponse?.items?.length) {
          reviewersEntityRefs = catalogResponse.items;
        }
        for (const reviewerEntityRef of reviewersEntityRefs) {
          if (reviewerEntityRef?.kind === "User") {
            try {
              const user = await client.rest.users.getByUsername({
                username: reviewerEntityRef.metadata.name
              });
              githubReviewers.push({
                type: "User",
                id: user.data.id
              });
            } catch (error) {
              ctx.logger.error("User not found:", error);
            }
          } else if (reviewerEntityRef?.kind === "Group") {
            try {
              const team = await client.rest.teams.getByName({
                org: owner,
                team_slug: reviewerEntityRef.metadata.name
              });
              githubReviewers.push({
                type: "Team",
                id: team.data.id
              });
            } catch (error) {
              ctx.logger.error("Team not found:", error);
            }
          }
        }
      }
      await client.rest.repos.createOrUpdateEnvironment({
        owner,
        repo,
        environment_name: name,
        deployment_branch_policy: deploymentBranchPolicy ?? null,
        wait_timer: waitTimer ?? 0,
        prevent_self_review: preventSelfReview ?? false,
        reviewers: githubReviewers.length ? githubReviewers : null
      });
      if (customBranchPolicyNames) {
        for (const item of customBranchPolicyNames) {
          await client.rest.repos.createDeploymentBranchPolicy({
            owner,
            repo,
            type: "branch",
            environment_name: name,
            name: item
          });
        }
      }
      if (customTagPolicyNames) {
        for (const item of customTagPolicyNames) {
          await client.rest.repos.createDeploymentBranchPolicy({
            owner,
            repo,
            type: "tag",
            environment_name: name,
            name: item
          });
        }
      }
      for (const [key, value] of Object.entries(environmentVariables ?? {})) {
        await client.rest.actions.createEnvironmentVariable({
          repository_id: repository.data.id,
          owner,
          repo,
          environment_name: name,
          name: key,
          value
        });
      }
      if (secrets) {
        const publicKeyResponse = await client.rest.actions.getEnvironmentPublicKey({
          repository_id: repository.data.id,
          owner,
          repo,
          environment_name: name
        });
        await Sodium__default.default.ready;
        const binaryKey = Sodium__default.default.from_base64(
          publicKeyResponse.data.key,
          Sodium__default.default.base64_variants.ORIGINAL
        );
        for (const [key, value] of Object.entries(secrets)) {
          const binarySecret = Sodium__default.default.from_string(value);
          const encryptedBinarySecret = Sodium__default.default.crypto_box_seal(
            binarySecret,
            binaryKey
          );
          const encryptedBase64Secret = Sodium__default.default.to_base64(
            encryptedBinarySecret,
            Sodium__default.default.base64_variants.ORIGINAL
          );
          await client.rest.actions.createOrUpdateEnvironmentSecret({
            repository_id: repository.data.id,
            owner,
            repo,
            environment_name: name,
            secret_name: key,
            encrypted_value: encryptedBase64Secret,
            key_id: publicKeyResponse.data.key_id
          });
        }
      }
    }
  });
}

githubEnvironment_cjs.createGithubEnvironmentAction = createGithubEnvironmentAction;

var githubPullRequest_cjs = {};

var githubPullRequest_examples_cjs = {};

var yaml$4 = require$$0$1;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$4 = /*#__PURE__*/_interopDefaultCompat$5(yaml$4);

const examples$4 = [
  {
    description: "Create a pull request",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with target branch name",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest with target branch name",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            targetBranchName: "test"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request as draft",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest as draft",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            draft: true
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with target path",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest with target path",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            targetPath: "targetPath"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with source path",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest with source path",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            sourcePath: "source"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with token",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with reviewers",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest with reviewers",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            reviewers: ["foobar"]
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with team reviewers",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest with team reviewers",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            teamReviewers: ["team-foo"]
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with commit message",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            commitMessage: "Custom commit message"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with a git author name and email",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            gitAuthorName: "Foo Bar",
            gitAuthorEmail: "foo@bar.example"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with a git author name",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            // gitAuthorEmail will be 'scaffolder@backstage.io'
            // once one author attribute has been set we need to set both
            gitAuthorName: "Foo Bar"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with a git author email",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            // gitAuthorName will be 'Scaffolder'
            // once one author attribute has been set we need to set both
            gitAuthorEmail: "foo@bar.example"
          }
        }
      ]
    })
  },
  {
    description: "Create a pull request with all parameters",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          action: "publish:github:pull-request",
          name: "Create a pull reuqest",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branchName: "new-app",
            title: "Create my new app",
            description: "This PR is really good",
            targetBranchName: "test",
            draft: true,
            targetPath: "targetPath",
            sourcePath: "source",
            token: "gph_YourGitHubToken",
            reviewers: ["foobar"],
            teamReviewers: ["team-foo"],
            commitMessage: "Commit for foo changes",
            gitAuthorName: "Foo Bar",
            gitAuthorEmail: "foo@bar.example"
          }
        }
      ]
    })
  }
];

githubPullRequest_examples_cjs.examples = examples$4;

var path = require$$0$2;
var pluginScaffolderNode$3 = require$$1$1;
var octokit$3 = require$$2;
var errors$3 = require$$0;
var octokitPluginCreatePullRequest = require$$4$1;
var helpers$3 = helpers_cjs;
var githubPullRequest_examples = githubPullRequest_examples_cjs;
var backendPluginApi = require$$7;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefaultCompat$4(path);

class GithubResponseError extends errors$3.CustomErrorBase {
}
const defaultClientFactory = async ({
  integrations,
  githubCredentialsProvider,
  owner,
  repo,
  host = "github.com",
  token: providedToken
}) => {
  const [encodedHost, encodedOwner, encodedRepo] = [host, owner, repo].map(
    encodeURIComponent
  );
  const octokitOptions = await helpers$3.getOctokitOptions({
    integrations,
    credentialsProvider: githubCredentialsProvider,
    repoUrl: `${encodedHost}?owner=${encodedOwner}&repo=${encodedRepo}`,
    token: providedToken
  });
  const OctokitPR = octokit$3.Octokit.plugin(octokitPluginCreatePullRequest.createPullRequest);
  return new OctokitPR({
    ...octokitOptions,
    ...{ throttle: { enabled: false } }
  });
};
const createPublishGithubPullRequestAction = (options) => {
  const {
    integrations,
    githubCredentialsProvider,
    clientFactory = defaultClientFactory,
    config
  } = options;
  return pluginScaffolderNode$3.createTemplateAction({
    id: "publish:github:pull-request",
    examples: githubPullRequest_examples.examples,
    supportsDryRun: true,
    schema: {
      input: {
        required: ["repoUrl", "title", "description", "branchName"],
        type: "object",
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the repository name and 'owner' is an organization or username`,
            type: "string"
          },
          branchName: {
            type: "string",
            title: "Branch Name",
            description: "The name for the branch"
          },
          targetBranchName: {
            type: "string",
            title: "Target Branch Name",
            description: "The target branch name of the merge request"
          },
          title: {
            type: "string",
            title: "Pull Request Name",
            description: "The name for the pull request"
          },
          description: {
            type: "string",
            title: "Pull Request Description",
            description: "The description of the pull request"
          },
          draft: {
            type: "boolean",
            title: "Create as Draft",
            description: "Create a draft pull request"
          },
          sourcePath: {
            type: "string",
            title: "Working Subdirectory",
            description: "Subdirectory of working directory to copy changes from"
          },
          targetPath: {
            type: "string",
            title: "Repository Subdirectory",
            description: "Subdirectory of repository to apply changes to"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to GitHub"
          },
          reviewers: {
            title: "Pull Request Reviewers",
            type: "array",
            items: {
              type: "string"
            },
            description: "The users that will be added as reviewers to the pull request"
          },
          teamReviewers: {
            title: "Pull Request Team Reviewers",
            type: "array",
            items: {
              type: "string"
            },
            description: "The teams that will be added as reviewers to the pull request"
          },
          commitMessage: {
            type: "string",
            title: "Commit Message",
            description: "The commit message for the pull request commit"
          },
          update: {
            type: "boolean",
            title: "Update",
            description: "Update pull request if already exists"
          },
          forceFork: {
            type: "boolean",
            title: "Force Fork",
            description: "Create pull request from a fork"
          },
          gitAuthorName: {
            type: "string",
            title: "Default Author Name",
            description: "Sets the default author name for the commit. The default value is the authenticated user or 'Scaffolder'"
          },
          gitAuthorEmail: {
            type: "string",
            title: "Default Author Email",
            description: "Sets the default author email for the commit. The default value is the authenticated user or 'scaffolder@backstage.io'"
          },
          forceEmptyGitAuthor: {
            type: "boolean",
            title: "Force Empty Git Author",
            description: "Forces the author to be empty. This is useful when using a Github App, it permit the commit to be verified on Github"
          }
        }
      },
      output: {
        required: ["remoteUrl"],
        type: "object",
        properties: {
          targetBranchName: {
            title: "Target branch name of the merge request",
            type: "string"
          },
          remoteUrl: {
            type: "string",
            title: "Pull Request URL",
            description: "Link to the pull request in Github"
          },
          pullRequestNumber: {
            type: "number",
            title: "Pull Request Number",
            description: "The pull request number"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        branchName,
        targetBranchName,
        title,
        description,
        draft,
        targetPath,
        sourcePath,
        token: providedToken,
        reviewers,
        teamReviewers,
        commitMessage,
        update,
        forceFork,
        gitAuthorEmail,
        gitAuthorName,
        forceEmptyGitAuthor
      } = ctx.input;
      const { owner, repo, host } = pluginScaffolderNode$3.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$3.InputError(
          `No owner provided for host: ${host}, and repo ${repo}`
        );
      }
      const client = await clientFactory({
        integrations,
        githubCredentialsProvider,
        host,
        owner,
        repo,
        token: providedToken
      });
      const fileRoot = sourcePath ? backendPluginApi.resolveSafeChildPath(ctx.workspacePath, sourcePath) : ctx.workspacePath;
      const directoryContents = await pluginScaffolderNode$3.serializeDirectoryContents(fileRoot, {
        gitignore: true
      });
      const determineFileMode = (file) => {
        if (file.symlink) return "120000";
        if (file.executable) return "100755";
        return "100644";
      };
      const determineFileEncoding = (file) => file.symlink ? "utf-8" : "base64";
      const files = Object.fromEntries(
        directoryContents.map((file) => [
          targetPath ? path__default.default.posix.join(targetPath, file.path) : file.path,
          {
            // See the properties of tree items
            // in https://docs.github.com/en/rest/reference/git#trees
            mode: determineFileMode(file),
            // Always use base64 encoding where possible to avoid doubling a binary file in size
            // due to interpreting a binary file as utf-8 and sending github
            // the utf-8 encoded content. Symlinks are kept as utf-8 to avoid them
            // being formatted as a series of scrambled characters
            //
            // For example, the original gradle-wrapper.jar is 57.8k in https://github.com/kennethzfeng/pull-request-test/pull/5/files.
            // Its size could be doubled to 98.3K (See https://github.com/kennethzfeng/pull-request-test/pull/4/files)
            encoding: determineFileEncoding(file),
            content: file.content.toString(determineFileEncoding(file))
          }
        ])
      );
      if (ctx.isDryRun) {
        ctx.logger.info(`Performing dry run of creating pull request`);
        ctx.output("targetBranchName", branchName);
        ctx.output("remoteUrl", repoUrl);
        ctx.output("pullRequestNumber", 43);
        ctx.logger.info(`Dry run complete`);
        return;
      }
      try {
        const createOptions = {
          owner,
          repo,
          title,
          changes: [
            {
              files,
              commit: commitMessage ?? config?.getOptionalString("scaffolder.defaultCommitMessage") ?? title
            }
          ],
          body: description,
          head: branchName,
          draft,
          update,
          forceFork
        };
        const gitAuthorInfo = {
          name: gitAuthorName ?? config?.getOptionalString("scaffolder.defaultAuthor.name"),
          email: gitAuthorEmail ?? config?.getOptionalString("scaffolder.defaultAuthor.email")
        };
        if (!forceEmptyGitAuthor) {
          if (gitAuthorInfo.name || gitAuthorInfo.email) {
            if (Array.isArray(createOptions.changes)) {
              createOptions.changes = createOptions.changes.map((change) => ({
                ...change,
                author: {
                  name: gitAuthorInfo.name || "Scaffolder",
                  email: gitAuthorInfo.email || "scaffolder@backstage.io"
                }
              }));
            } else {
              createOptions.changes = {
                ...createOptions.changes,
                author: {
                  name: gitAuthorInfo.name || "Scaffolder",
                  email: gitAuthorInfo.email || "scaffolder@backstage.io"
                }
              };
            }
          }
        }
        if (targetBranchName) {
          createOptions.base = targetBranchName;
        }
        const response = await client.createPullRequest(createOptions);
        if (!response) {
          throw new GithubResponseError("null response from Github");
        }
        const pullRequestNumber = response.data.number;
        if (reviewers || teamReviewers) {
          const pullRequest = { owner, repo, number: pullRequestNumber };
          await requestReviewersOnPullRequest(
            pullRequest,
            reviewers,
            teamReviewers,
            client,
            ctx.logger
          );
        }
        const targetBranch = response.data.base.ref;
        ctx.output("targetBranchName", targetBranch);
        ctx.output("remoteUrl", response.data.html_url);
        ctx.output("pullRequestNumber", pullRequestNumber);
      } catch (e) {
        throw new GithubResponseError("Pull request creation failed", e);
      }
    }
  });
  async function requestReviewersOnPullRequest(pr, reviewers, teamReviewers, client, logger) {
    try {
      const result = await client.rest.pulls.requestReviewers({
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number,
        reviewers,
        team_reviewers: teamReviewers ? [...new Set(teamReviewers)] : void 0
      });
      const addedUsers = result.data.requested_reviewers?.join(", ") ?? "";
      const addedTeams = result.data.requested_teams?.join(", ") ?? "";
      logger.info(
        `Added users [${addedUsers}] and teams [${addedTeams}] as reviewers to Pull request ${pr.number}`
      );
    } catch (e) {
      logger.error(
        `Failure when adding reviewers to Pull request ${pr.number}`,
        e
      );
    }
  }
};

githubPullRequest_cjs.createPublishGithubPullRequestAction = createPublishGithubPullRequestAction;
githubPullRequest_cjs.defaultClientFactory = defaultClientFactory;

var github_cjs = {};

var github_examples_cjs = {};

var yaml$3 = require$$0$1;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$3 = /*#__PURE__*/_interopDefaultCompat$3(yaml$3);

const examples$3 = [
  {
    description: "Initializes a git repository with the content in the workspace, and publishes it to GitHub with the default configuration.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:github",
          name: "Publish to GitHub",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitHub repository with a description.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:github",
          name: "Publish to GitHub",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            description: "Initialize a git repository"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitHub repository with public repo visibility, if not set defaults to private",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:github",
          name: "Publish to GitHub",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            repoVisibility: "public"
          }
        }
      ]
    })
  }
];

github_examples_cjs.examples = examples$3;

var errors$2 = require$$0;
var octokit$2 = require$$2;
var pluginScaffolderNode$2 = require$$1$1;
var helpers$2 = helpers_cjs;
var inputProperties$1 = inputProperties_cjs;
var outputProperties = outputProperties_cjs;
var github_examples = github_examples_cjs;

function createPublishGithubAction(options) {
  const { integrations, config, githubCredentialsProvider } = options;
  return pluginScaffolderNode$2.createTemplateAction({
    id: "publish:github",
    description: "Initializes a git repository of contents in workspace and publishes it to GitHub.",
    examples: github_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl"],
        properties: {
          repoUrl: inputProperties$1.repoUrl,
          description: inputProperties$1.description,
          homepage: inputProperties$1.homepage,
          access: inputProperties$1.access,
          bypassPullRequestAllowances: inputProperties$1.bypassPullRequestAllowances,
          requiredApprovingReviewCount: inputProperties$1.requiredApprovingReviewCount,
          restrictions: inputProperties$1.restrictions,
          requireCodeOwnerReviews: inputProperties$1.requireCodeOwnerReviews,
          dismissStaleReviews: inputProperties$1.dismissStaleReviews,
          requiredStatusCheckContexts: inputProperties$1.requiredStatusCheckContexts,
          requireBranchesToBeUpToDate: inputProperties$1.requireBranchesToBeUpToDate,
          requiredConversationResolution: inputProperties$1.requiredConversationResolution,
          requireLastPushApproval: inputProperties$1.requireLastPushApproval,
          repoVisibility: inputProperties$1.repoVisibility,
          defaultBranch: inputProperties$1.defaultBranch,
          protectDefaultBranch: inputProperties$1.protectDefaultBranch,
          protectEnforceAdmins: inputProperties$1.protectEnforceAdmins,
          deleteBranchOnMerge: inputProperties$1.deleteBranchOnMerge,
          gitCommitMessage: inputProperties$1.gitCommitMessage,
          gitAuthorName: inputProperties$1.gitAuthorName,
          gitAuthorEmail: inputProperties$1.gitAuthorEmail,
          allowMergeCommit: inputProperties$1.allowMergeCommit,
          allowSquashMerge: inputProperties$1.allowSquashMerge,
          squashMergeCommitTitle: inputProperties$1.squashMergeCommitTitle,
          squashMergeCommitMessage: inputProperties$1.squashMergeCommitMessage,
          allowRebaseMerge: inputProperties$1.allowRebaseMerge,
          allowAutoMerge: inputProperties$1.allowAutoMerge,
          sourcePath: inputProperties$1.sourcePath,
          collaborators: inputProperties$1.collaborators,
          hasProjects: inputProperties$1.hasProjects,
          hasWiki: inputProperties$1.hasWiki,
          hasIssues: inputProperties$1.hasIssues,
          token: inputProperties$1.token,
          topics: inputProperties$1.topics,
          repoVariables: inputProperties$1.repoVariables,
          secrets: inputProperties$1.secrets,
          oidcCustomization: inputProperties$1.oidcCustomization,
          requiredCommitSigning: inputProperties$1.requiredCommitSigning,
          customProperties: inputProperties$1.customProperties
        }
      },
      output: {
        type: "object",
        properties: {
          remoteUrl: outputProperties.remoteUrl,
          repoContentsUrl: outputProperties.repoContentsUrl,
          commitHash: outputProperties.commitHash
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        description,
        homepage,
        access,
        requireCodeOwnerReviews = false,
        dismissStaleReviews = false,
        bypassPullRequestAllowances,
        requiredApprovingReviewCount = 1,
        restrictions,
        requiredStatusCheckContexts = [],
        requireBranchesToBeUpToDate = true,
        requiredConversationResolution = false,
        requireLastPushApproval = false,
        repoVisibility = "private",
        defaultBranch = "master",
        protectDefaultBranch = true,
        protectEnforceAdmins = true,
        deleteBranchOnMerge = false,
        gitCommitMessage,
        gitAuthorName,
        gitAuthorEmail,
        allowMergeCommit = true,
        allowSquashMerge = true,
        squashMergeCommitTitle = "COMMIT_OR_PR_TITLE",
        squashMergeCommitMessage = "COMMIT_MESSAGES",
        allowRebaseMerge = true,
        allowAutoMerge = false,
        collaborators,
        hasProjects = void 0,
        hasWiki = void 0,
        hasIssues = void 0,
        topics,
        repoVariables,
        secrets,
        oidcCustomization,
        token: providedToken,
        customProperties,
        requiredCommitSigning = false
      } = ctx.input;
      const octokitOptions = await helpers$2.getOctokitOptions({
        integrations,
        credentialsProvider: githubCredentialsProvider,
        token: providedToken,
        repoUrl
      });
      const client = new octokit$2.Octokit(octokitOptions);
      const { owner, repo } = pluginScaffolderNode$2.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$2.InputError("Invalid repository owner provided in repoUrl");
      }
      const newRepo = await helpers$2.createGithubRepoWithCollaboratorsAndTopics(
        client,
        repo,
        owner,
        repoVisibility,
        description,
        homepage,
        deleteBranchOnMerge,
        allowMergeCommit,
        allowSquashMerge,
        squashMergeCommitTitle,
        squashMergeCommitMessage,
        allowRebaseMerge,
        allowAutoMerge,
        access,
        collaborators,
        hasProjects,
        hasWiki,
        hasIssues,
        topics,
        repoVariables,
        secrets,
        oidcCustomization,
        customProperties,
        ctx.logger
      );
      const remoteUrl = newRepo.clone_url;
      const repoContentsUrl = `${newRepo.html_url}/blob/${defaultBranch}`;
      const commitResult = await helpers$2.initRepoPushAndProtect(
        remoteUrl,
        octokitOptions.auth,
        ctx.workspacePath,
        ctx.input.sourcePath,
        defaultBranch,
        protectDefaultBranch,
        protectEnforceAdmins,
        owner,
        client,
        repo,
        requireCodeOwnerReviews,
        bypassPullRequestAllowances,
        requiredApprovingReviewCount,
        restrictions,
        requiredStatusCheckContexts,
        requireBranchesToBeUpToDate,
        requiredConversationResolution,
        requireLastPushApproval,
        config,
        ctx.logger,
        gitCommitMessage,
        gitAuthorName,
        gitAuthorEmail,
        dismissStaleReviews,
        requiredCommitSigning
      );
      ctx.output("commitHash", commitResult?.commitHash);
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
    }
  });
}

github_cjs.createPublishGithubAction = createPublishGithubAction;

var githubAutolinks_cjs = {};

var githubAutolinks_examples_cjs = {};

var yaml$2 = require$$0$1;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$2 = /*#__PURE__*/_interopDefaultCompat$2(yaml$2);

const examples$2 = [
  {
    description: "GitHub alphanumric autolink reference",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          action: "github:autolinks:create",
          name: "Create an autolink reference",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            keyPrefix: "TICKET-",
            urlTemplate: "https://example.com/TICKET?query=<num>",
            isAlphanumeric: false
          }
        }
      ]
    })
  }
];

githubAutolinks_examples_cjs.examples = examples$2;

var errors$1 = require$$0;
var pluginScaffolderNode$1 = require$$1$1;
var octokit$1 = require$$2;
var githubAutolinks_examples = githubAutolinks_examples_cjs;
var helpers$1 = helpers_cjs;

function createGithubAutolinksAction(options) {
  const { integrations, githubCredentialsProvider } = options;
  return pluginScaffolderNode$1.createTemplateAction({
    id: "github:autolinks:create",
    description: "Create an autolink reference for a repository",
    examples: githubAutolinks_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "keyPrefix", "urlTemplate"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
            type: "string"
          },
          keyPrefix: {
            title: "Key Prefix",
            description: "This prefix appended by certain characters will generate a link any time it is found in an issue, pull request, or commit.",
            type: "string"
          },
          urlTemplate: {
            title: "URL Template",
            description: "The URL must contain <num> for the reference number. <num> matches different characters depending on the value of isAlphanumeric.",
            type: "string"
          },
          isAlphanumeric: {
            title: "Alphanumeric",
            description: "Whether this autolink reference matches alphanumeric characters. If true, the <num> parameter of the url_template matches alphanumeric characters A-Z (case insensitive), 0-9, and -. If false, this autolink reference only matches numeric characters. Default: true",
            type: "boolean"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to GitHub"
          }
        }
      }
    },
    async handler(ctx) {
      const { repoUrl, keyPrefix, urlTemplate, isAlphanumeric, token } = ctx.input;
      ctx.logger.info(`Creating autolink reference for repo ${repoUrl}`);
      const { owner, repo } = pluginScaffolderNode$1.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$1.InputError("Invalid repository owner provided in repoUrl");
      }
      const client = new octokit$1.Octokit(
        await helpers$1.getOctokitOptions({
          integrations,
          repoUrl,
          credentialsProvider: githubCredentialsProvider,
          token
        })
      );
      await client.rest.repos.createAutolink({
        owner,
        repo,
        key_prefix: keyPrefix,
        url_template: urlTemplate,
        is_alphanumeric: isAlphanumeric
      });
      ctx.logger.info(`Autolink reference created successfully`);
    }
  });
}

githubAutolinks_cjs.createGithubAutolinksAction = createGithubAutolinksAction;

var githubPagesEnable_cjs = {};

var githubPagesEnable_examples_cjs = {};

var yaml$1 = require$$0$1;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$1(yaml$1);

const examples$1 = [
  {
    description: "Enables GitHub Pages for a repository.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages",
          name: "Enable GitHub Pages",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            buildType: "workflow",
            sourceBranch: "main",
            sourcePath: "/",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with a custom source path.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-custom-path",
          name: "Enable GitHub Pages with Custom Source Path",
          input: {
            repoUrl: "github.com?repo=customPathRepo&owner=customOwner",
            sourcePath: "/docs",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository using legacy build type.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-legacy",
          name: "Enable GitHub Pages with Legacy Build Type",
          input: {
            repoUrl: "github.com?repo=legacyRepo&owner=legacyOwner",
            buildType: "legacy",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with a custom source branch.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-custom-branch",
          name: "Enable GitHub Pages with Custom Source Branch",
          input: {
            repoUrl: "github.com?repo=customBranchRepo&owner=branchOwner",
            sourceBranch: "develop",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with full customization.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-full-custom",
          name: "Enable GitHub Pages with Full Customization",
          input: {
            repoUrl: "github.com?repo=fullCustomRepo&owner=customOwner",
            buildType: "workflow",
            sourceBranch: "main",
            sourcePath: "/docs",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with minimal configuration.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-minimal",
          name: "Enable GitHub Pages with Minimal Configuration",
          input: {
            repoUrl: "github.com?repo=minimalRepo&owner=minimalOwner",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with custom build type and source path.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-custom-build-path",
          name: "Enable GitHub Pages with Custom Build Type and Source Path",
          input: {
            repoUrl: "github.com?repo=customBuildPathRepo&owner=customOwner",
            buildType: "legacy",
            sourcePath: "/custom-path",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with custom source branch and path.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-custom-branch-path",
          name: "Enable GitHub Pages with Custom Source Branch and Path",
          input: {
            repoUrl: "github.com?repo=customBranchPathRepo&owner=branchPathOwner",
            sourceBranch: "feature-branch",
            sourcePath: "/project-docs",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with a custom owner and repository name.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-custom-owner-repo",
          name: "Enable GitHub Pages with Custom Owner and Repository Name",
          input: {
            repoUrl: "github.com?repo=customRepoName&owner=customOwnerName",
            token: "gph_YourGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with full customization and a different token.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-full-custom-diff-token",
          name: "Enable GitHub Pages with Full Customization and Different Token",
          input: {
            repoUrl: "github.com?repo=customTokenRepo&owner=tokenOwner",
            buildType: "workflow",
            sourceBranch: "main",
            sourcePath: "/site",
            token: "gph_DifferentGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a repository with a specific token for authorization.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-specific-token",
          name: "Enable GitHub Pages with Specific Token",
          input: {
            repoUrl: "github.com?repo=specificTokenRepo&owner=tokenOwner",
            token: "gph_SpecificGitHubToken"
          }
        }
      ]
    })
  },
  {
    description: "Enables GitHub Pages for a documentation site with custom configuration.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "github:pages",
          id: "github-pages-doc-site",
          name: "Enable GitHub Pages for Documentation Site",
          input: {
            repoUrl: "github.com?repo=docSiteRepo&owner=docsOwner",
            buildType: "workflow",
            sourceBranch: "docs-branch",
            sourcePath: "/docs-site",
            token: "gph_DocsGitHubToken"
          }
        }
      ]
    })
  }
];

githubPagesEnable_examples_cjs.examples = examples$1;

var hasRequiredGithubPagesEnable_cjs;

function requireGithubPagesEnable_cjs () {
	if (hasRequiredGithubPagesEnable_cjs) return githubPagesEnable_cjs;
	hasRequiredGithubPagesEnable_cjs = 1;

	var errors = require$$0;
	var octokit = require$$2;
	var pluginScaffolderNode = require$$1$1;
	var githubPagesEnable_examples = githubPagesEnable_examples_cjs;
	var pluginScaffolderBackendModuleGithub = requireIndex_cjs();

	function createGithubPagesEnableAction(options) {
	  const { integrations, githubCredentialsProvider } = options;
	  return pluginScaffolderNode.createTemplateAction({
	    id: "github:pages:enable",
	    examples: githubPagesEnable_examples.examples,
	    description: "Enables GitHub Pages for a repository.",
	    schema: {
	      input: {
	        type: "object",
	        required: ["repoUrl"],
	        properties: {
	          repoUrl: {
	            title: "Repository Location",
	            description: `Accepts the format 'github.com?repo=reponame&owner=owner' where 'reponame' is the new repository name and 'owner' is an organization or username`,
	            type: "string"
	          },
	          buildType: {
	            title: "Build Type",
	            type: "string",
	            description: 'The GitHub Pages build type - "legacy" or "workflow". Default is "workflow'
	          },
	          sourceBranch: {
	            title: "Source Branch",
	            type: "string",
	            description: 'The the GitHub Pages source branch. Default is "main"'
	          },
	          sourcePath: {
	            title: "Source Path",
	            type: "string",
	            description: 'The the GitHub Pages source path - "/" or "/docs". Default is "/"'
	          },
	          token: {
	            title: "Authorization Token",
	            type: "string",
	            description: "The token to use for authorization to GitHub"
	          }
	        }
	      }
	    },
	    async handler(ctx) {
	      const {
	        repoUrl,
	        buildType = "workflow",
	        sourceBranch = "main",
	        sourcePath = "/",
	        token: providedToken
	      } = ctx.input;
	      const octokitOptions = await pluginScaffolderBackendModuleGithub.getOctokitOptions({
	        integrations,
	        credentialsProvider: githubCredentialsProvider,
	        token: providedToken,
	        repoUrl
	      });
	      const client = new octokit.Octokit(octokitOptions);
	      const { owner, repo } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
	      if (!owner) {
	        throw new errors.InputError("Invalid repository owner provided in repoUrl");
	      }
	      ctx.logger.info(
	        `Attempting to enable GitHub Pages for ${owner}/${repo} with "${buildType}" build type, on source branch "${sourceBranch}" and source path "${sourcePath}"`
	      );
	      await client.request("POST /repos/{owner}/{repo}/pages", {
	        owner,
	        repo,
	        build_type: buildType,
	        source: {
	          branch: sourceBranch,
	          path: sourcePath
	        },
	        headers: {
	          "X-GitHub-Api-Version": "2022-11-28"
	        }
	      });
	      ctx.logger.info("Completed enabling GitHub Pages");
	    }
	  });
	}

	githubPagesEnable_cjs.createGithubPagesEnableAction = createGithubPagesEnableAction;
	
	return githubPagesEnable_cjs;
}

var githubBranchProtection_cjs = {};

var githubBranchProtection_examples_cjs = {};

var yaml = require$$0$1;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);

const examples = [
  {
    description: `GitHub Branch Protection for repository's default branch.`,
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "github:branch-protection:create",
          name: "Setup Branch Protection",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner"
          }
        }
      ]
    })
  },
  {
    description: `GitHub Branch Protection for a specific branch.`,
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "github:branch-protection:create",
          name: "Setup Branch Protection",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            branch: "my-awesome-branch"
          }
        }
      ]
    })
  },
  {
    description: `GitHub Branch Protection and required commit signing on default branch.`,
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "github:branch-protection:create",
          name: "Setup Branch Protection",
          input: {
            repoUrl: "github.com?repo=repo&owner=owner",
            requireCodeOwnerReviews: true,
            requiredStatusCheckContexts: ["test"],
            dismissStaleReviews: true,
            requireLastPushApproval: true,
            requiredConversationResolution: true,
            requiredCommitSigning: true
          }
        }
      ]
    })
  }
];

githubBranchProtection_examples_cjs.examples = examples;

var errors = require$$0;
var pluginScaffolderNode = require$$1$1;
var githubBranchProtection_examples = githubBranchProtection_examples_cjs;
var inputProperties = inputProperties_cjs;
var helpers = helpers_cjs;
var octokit = require$$2;
var gitHelpers = gitHelpers_cjs;

function createGithubBranchProtectionAction(options) {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "github:branch-protection:create",
    description: "Configures Branch Protection",
    examples: githubBranchProtection_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl"],
        properties: {
          repoUrl: inputProperties.repoUrl,
          branch: {
            title: "Branch name",
            description: `The branch to protect. Defaults to the repository's default branch`,
            type: "string"
          },
          enforceAdmins: inputProperties.protectEnforceAdmins,
          requiredApprovingReviewCount: inputProperties.requiredApprovingReviewCount,
          requireCodeOwnerReviews: inputProperties.requireCodeOwnerReviews,
          dismissStaleReviews: inputProperties.dismissStaleReviews,
          bypassPullRequestAllowances: inputProperties.bypassPullRequestAllowances,
          restrictions: inputProperties.restrictions,
          requiredStatusCheckContexts: inputProperties.requiredStatusCheckContexts,
          requireBranchesToBeUpToDate: inputProperties.requireBranchesToBeUpToDate,
          requiredConversationResolution: inputProperties.requiredConversationResolution,
          requireLastPushApproval: inputProperties.requireLastPushApproval,
          requiredCommitSigning: inputProperties.requiredCommitSigning,
          token: inputProperties.token
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        branch,
        enforceAdmins = true,
        requiredApprovingReviewCount = 1,
        requireCodeOwnerReviews = false,
        dismissStaleReviews = false,
        bypassPullRequestAllowances,
        restrictions,
        requiredStatusCheckContexts = [],
        requireBranchesToBeUpToDate = true,
        requiredConversationResolution = false,
        requireLastPushApproval = false,
        requiredCommitSigning = false,
        token: providedToken
      } = ctx.input;
      const octokitOptions = await helpers.getOctokitOptions({
        integrations,
        token: providedToken,
        repoUrl
      });
      const client = new octokit.Octokit(octokitOptions);
      const { owner, repo } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors.InputError(`No owner provided for repo ${repoUrl}`);
      }
      const repository = await client.rest.repos.get({
        owner,
        repo
      });
      await gitHelpers.enableBranchProtectionOnDefaultRepoBranch({
        repoName: repo,
        client,
        owner,
        logger: ctx.logger,
        requireCodeOwnerReviews,
        bypassPullRequestAllowances,
        requiredApprovingReviewCount,
        restrictions,
        requiredStatusCheckContexts,
        requireBranchesToBeUpToDate,
        requiredConversationResolution,
        requireLastPushApproval,
        defaultBranch: branch ?? repository.data.default_branch,
        enforceAdmins,
        dismissStaleReviews,
        requiredCommitSigning
      });
    }
  });
}

githubBranchProtection_cjs.createGithubBranchProtectionAction = createGithubBranchProtectionAction;

var module_cjs = {};

var hasRequiredModule_cjs;

function requireModule_cjs () {
	if (hasRequiredModule_cjs) return module_cjs;
	hasRequiredModule_cjs = 1;

	var backendPluginApi = require$$7;
	var alpha = require$$1$3;
	var githubActionsDispatch = githubActionsDispatch_cjs;
	var githubIssuesLabel = githubIssuesLabel_cjs;
	var githubRepoCreate = githubRepoCreate_cjs;
	var githubRepoPush = githubRepoPush_cjs;
	var githubWebhook = githubWebhook_cjs;
	var githubDeployKey = githubDeployKey_cjs;
	var githubEnvironment = githubEnvironment_cjs;
	var githubPullRequest = githubPullRequest_cjs;
	var github = github_cjs;
	var githubAutolinks = githubAutolinks_cjs;
	var githubPagesEnable = requireGithubPagesEnable_cjs();
	var githubBranchProtection = githubBranchProtection_cjs;

	var integration = require$$1;


	var catalogClient = require$$18;

	const githubModule = backendPluginApi.createBackendModule({
	  pluginId: "scaffolder",
	  moduleId: "github",
	  register({ registerInit }) {
	    registerInit({
	      deps: {
	        scaffolder: alpha.scaffolderActionsExtensionPoint,
	        config: backendPluginApi.coreServices.rootConfig,
	        discovery: backendPluginApi.coreServices.discovery
	      },
	      async init({ scaffolder, config, discovery }) {
	        const integrations = integration.ScmIntegrations.fromConfig(config);
	        const githubCredentialsProvider = integration.DefaultGithubCredentialsProvider.fromIntegrations(integrations);
	        const catalogClient$1 = new catalogClient.CatalogClient({
	          discoveryApi: discovery
	        });
	        scaffolder.addActions(
	          githubActionsDispatch.createGithubActionsDispatchAction({
	            integrations,
	            githubCredentialsProvider
	          }),
	          githubAutolinks.createGithubAutolinksAction({
	            integrations,
	            githubCredentialsProvider
	          }),
	          githubDeployKey.createGithubDeployKeyAction({
	            integrations
	          }),
	          githubEnvironment.createGithubEnvironmentAction({
	            integrations,
	            catalogClient: catalogClient$1
	          }),
	          githubIssuesLabel.createGithubIssuesLabelAction({
	            integrations,
	            githubCredentialsProvider
	          }),
	          githubRepoCreate.createGithubRepoCreateAction({
	            integrations,
	            githubCredentialsProvider
	          }),
	          githubRepoPush.createGithubRepoPushAction({ integrations, config }),
	          githubWebhook.createGithubWebhookAction({
	            integrations,
	            githubCredentialsProvider
	          }),
	          github.createPublishGithubAction({
	            integrations,
	            config,
	            githubCredentialsProvider
	          }),
	          githubPullRequest.createPublishGithubPullRequestAction({
	            integrations,
	            githubCredentialsProvider,
	            config
	          }),
	          githubPagesEnable.createGithubPagesEnableAction({
	            integrations,
	            githubCredentialsProvider
	          }),
	          githubBranchProtection.createGithubBranchProtectionAction({
	            integrations
	          })
	        );
	      }
	    });
	  }
	});

	module_cjs.githubModule = githubModule;
	
	return module_cjs;
}

var hasRequiredIndex_cjs;

function requireIndex_cjs () {
	if (hasRequiredIndex_cjs) return index_cjs$1;
	hasRequiredIndex_cjs = 1;

	Object.defineProperty(index_cjs$1, '__esModule', { value: true });

	var githubActionsDispatch = githubActionsDispatch_cjs;
	var githubIssuesLabel = githubIssuesLabel_cjs;
	var githubRepoCreate = githubRepoCreate_cjs;
	var githubRepoPush = githubRepoPush_cjs;
	var githubWebhook = githubWebhook_cjs;
	var githubDeployKey = githubDeployKey_cjs;
	var githubEnvironment = githubEnvironment_cjs;
	var githubPullRequest = githubPullRequest_cjs;
	var github = github_cjs;
	var githubAutolinks = githubAutolinks_cjs;
	var githubPagesEnable = requireGithubPagesEnable_cjs();
	var githubBranchProtection = githubBranchProtection_cjs;
	var helpers = helpers_cjs;
	var module$1 = requireModule_cjs();



	index_cjs$1.createGithubActionsDispatchAction = githubActionsDispatch.createGithubActionsDispatchAction;
	index_cjs$1.createGithubIssuesLabelAction = githubIssuesLabel.createGithubIssuesLabelAction;
	index_cjs$1.createGithubRepoCreateAction = githubRepoCreate.createGithubRepoCreateAction;
	index_cjs$1.createGithubRepoPushAction = githubRepoPush.createGithubRepoPushAction;
	index_cjs$1.createGithubWebhookAction = githubWebhook.createGithubWebhookAction;
	index_cjs$1.createGithubDeployKeyAction = githubDeployKey.createGithubDeployKeyAction;
	index_cjs$1.createGithubEnvironmentAction = githubEnvironment.createGithubEnvironmentAction;
	index_cjs$1.createPublishGithubPullRequestAction = githubPullRequest.createPublishGithubPullRequestAction;
	index_cjs$1.createPublishGithubAction = github.createPublishGithubAction;
	index_cjs$1.createGithubAutolinksAction = githubAutolinks.createGithubAutolinksAction;
	index_cjs$1.createGithubPagesEnableAction = githubPagesEnable.createGithubPagesEnableAction;
	index_cjs$1.createGithubBranchProtectionAction = githubBranchProtection.createGithubBranchProtectionAction;
	index_cjs$1.getOctokitOptions = helpers.getOctokitOptions;
	index_cjs$1.default = module$1.githubModule;
	
	return index_cjs$1;
}

var index_cjsExports = requireIndex_cjs();
var index_cjs = /*@__PURE__*/getDefaultExportFromCjs(index_cjsExports);

exports["default"] = index_cjs;
//# sourceMappingURL=index.cjs.js.map
