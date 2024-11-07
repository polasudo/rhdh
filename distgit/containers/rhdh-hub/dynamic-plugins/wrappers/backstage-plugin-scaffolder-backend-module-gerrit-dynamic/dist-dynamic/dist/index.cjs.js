'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('crypto');
var require$$1 = require('@backstage/errors');
var require$$2 = require('@backstage/integration');
var require$$3 = require('@backstage/plugin-scaffolder-node');
var require$$4 = require('node-fetch');
var require$$0 = require('yaml');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var gerrit_cjs = {};

var gerrit_examples_cjs = {};

var yaml$1 = require$$0;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$3(yaml$1);

const examples$1 = [
  {
    description: "Initializes a Gerrit repository of contents in workspace and publish it to Gerrit with default configuration.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Gerrit repository with a description.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            description: "Initialize a gerrit repository"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Gerrit repository with a default Branch, if not set defaults to master",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            defaultBranch: "staging"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Gerrit repository with an initial commit message, if not set defaults to initial commit",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Gerrit repository with a repo Author Name, if not set defaults to Scaffolder",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            gitAuthorName: "John Doe"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Gerrit repository with a repo Author Email",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            gitAuthorEmail: "johndoe@email.com"
          }
        }
      ]
    })
  },
  {
    description: "Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            sourcePath: "repository/"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Gerrit repository with all proporties being set",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            description: "Initialize a gerrit repository",
            defaultBranch: "staging",
            gitCommitMessage: "Initial Commit Message",
            gitAuthorName: "John Doe",
            gitAuthorEmail: "johndoe@email.com",
            sourcePath: "repository/"
          }
        }
      ]
    })
  },
  {
    description: "Initialize a Gerrit Repository with Custom Default Branch and Commit Message",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit",
          name: "Publish to Gerrit",
          input: {
            repoUrl: "gerrit.com?repo=repo&owner=owner",
            defaultBranch: "feature-branch",
            gitCommitMessage: "Feature branch initialized"
          }
        }
      ]
    })
  }
];

gerrit_examples_cjs.examples = examples$1;

var crypto$1 = require$$0$1;
var errors$1 = require$$1;
var integration$1 = require$$2;
var pluginScaffolderNode$1 = require$$3;
var fetch = require$$4;
var gerrit_examples = gerrit_examples_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var crypto__default$1 = /*#__PURE__*/_interopDefaultCompat$2(crypto$1);
var fetch__default = /*#__PURE__*/_interopDefaultCompat$2(fetch);

const createGerritProject = async (config, options) => {
  const { projectName, parent, owner, description, defaultBranch } = options;
  const fetchOptions = {
    method: "PUT",
    body: JSON.stringify({
      parent,
      description,
      branches: [defaultBranch],
      owners: owner ? [owner] : [],
      create_empty_commit: false
    }),
    headers: {
      ...integration$1.getGerritRequestOptions(config).headers,
      "Content-Type": "application/json"
    }
  };
  const response = await fetch__default.default(
    `${config.baseUrl}/a/projects/${encodeURIComponent(projectName)}`,
    fetchOptions
  );
  if (response.status !== 201) {
    throw new Error(
      `Unable to create repository, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
};
const generateCommitMessage = (config, commitSubject) => {
  const changeId = crypto__default$1.default.randomBytes(20).toString("hex");
  const msg = `${config.getOptionalString("scaffolder.defaultCommitMessage") || commitSubject}

Change-Id: I${changeId}`;
  return msg;
};
function createPublishGerritAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode$1.createTemplateAction({
    id: "publish:gerrit",
    supportsDryRun: true,
    description: "Initializes a git repository of the content in the workspace, and publishes it to Gerrit.",
    examples: gerrit_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            type: "string"
          },
          description: {
            title: "Repository Description",
            type: "string"
          },
          defaultBranch: {
            title: "Default Branch",
            type: "string",
            description: `Sets the default branch on the repository. The default value is 'master'`
          },
          gitCommitMessage: {
            title: "Git Commit Message",
            type: "string",
            description: `Sets the commit message on the repository. The default value is 'initial commit'`
          },
          gitAuthorName: {
            title: "Default Author Name",
            type: "string",
            description: `Sets the default author name for the commit. The default value is 'Scaffolder'`
          },
          gitAuthorEmail: {
            title: "Default Author Email",
            type: "string",
            description: `Sets the default author email for the commit.`
          },
          sourcePath: {
            title: "Source Path",
            type: "string",
            description: `Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository.`
          }
        }
      },
      output: {
        type: "object",
        properties: {
          remoteUrl: {
            title: "A URL to the repository with the provider",
            type: "string"
          },
          repoContentsUrl: {
            title: "A URL to the root of the repository",
            type: "string"
          },
          commitHash: {
            title: "The git commit hash of the initial commit",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        description,
        defaultBranch = "master",
        gitAuthorName,
        gitAuthorEmail,
        gitCommitMessage = "initial commit",
        sourcePath
      } = ctx.input;
      const { repo, host, owner, workspace } = pluginScaffolderNode$1.parseRepoUrl(
        repoUrl,
        integrations
      );
      const integrationConfig = integrations.gerrit.byHost(host);
      if (!integrationConfig) {
        throw new errors$1.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      if (!workspace) {
        throw new errors$1.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing workspace`
        );
      }
      const repoContentsUrl = `${integrationConfig.config.gitilesBaseUrl}/${repo}/+/refs/heads/${defaultBranch}`;
      const remoteUrl = `${integrationConfig.config.cloneUrl}/a/${repo}`;
      const gitName = gitAuthorName ? gitAuthorName : config.getOptionalString("scaffolder.defaultAuthor.name");
      const gitEmail = gitAuthorEmail ? gitAuthorEmail : config.getOptionalString("scaffolder.defaultAuthor.email");
      const commitMessage = generateCommitMessage(config, gitCommitMessage);
      if (ctx.isDryRun) {
        ctx.logger.info(
          `Dry run arguments: ${{
            gitName,
            gitEmail,
            commitMessage,
            ...ctx.input
          }}`
        );
        ctx.output("remoteUrl", remoteUrl);
        ctx.output("commitHash", "abcd-dry-run-1234");
        ctx.output("repoContentsUrl", repoContentsUrl);
        return;
      }
      await createGerritProject(integrationConfig.config, {
        description,
        owner,
        projectName: repo,
        parent: workspace,
        defaultBranch
      });
      const auth = {
        username: integrationConfig.config.username,
        password: integrationConfig.config.password
      };
      const gitAuthorInfo = {
        name: gitName,
        email: gitEmail
      };
      const commitResult = await pluginScaffolderNode$1.initRepoAndPush({
        dir: pluginScaffolderNode$1.getRepoSourceDirectory(ctx.workspacePath, sourcePath),
        remoteUrl,
        auth,
        defaultBranch,
        logger: ctx.logger,
        commitMessage: generateCommitMessage(config, gitCommitMessage),
        gitAuthorInfo
      });
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("commitHash", commitResult?.commitHash);
      ctx.output("repoContentsUrl", repoContentsUrl);
    }
  });
}

gerrit_cjs.createPublishGerritAction = createPublishGerritAction;

var gerritReview_cjs = {};

var gerritReview_examples_cjs = {};

var yaml = require$$0;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat$1(yaml);

const examples = [
  {
    description: "Creates a new Gerrit review with minimal options",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit:review",
          name: "Publish new gerrit review",
          input: {
            repoUrl: "gerrithost.org?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message"
          }
        }
      ]
    })
  },
  {
    description: "Creates a new Gerrit review with gitAuthorName",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit:review",
          name: "Publish new gerrit review",
          input: {
            repoUrl: "gerrithost.org?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message",
            gitAuthorName: "Test User"
          }
        }
      ]
    })
  },
  {
    description: "Creates a new Gerrit review with gitAuthorEmail",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit:review",
          name: "Publish new gerrit review",
          input: {
            repoUrl: "gerrithost.org?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message",
            gitAuthorName: "Test User",
            gitAuthorEmail: "test.user@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Creates a new Gerrit review with custom branch",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit:review",
          name: "Publish new gerrit review",
          input: {
            repoUrl: "gerrithost.org?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message",
            branch: "develop"
          }
        }
      ]
    })
  },
  {
    description: "Creates a new Gerrit review with custom sourcePath",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit:review",
          name: "Publish new gerrit review",
          input: {
            repoUrl: "gerrithost.org?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message",
            sourcePath: "./src"
          }
        }
      ]
    })
  },
  {
    description: "Creates a new Gerrit review with all properties",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gerrit:review",
          name: "Publish new gerrit review",
          input: {
            repoUrl: "gerrithost.org?repo=repo&owner=owner",
            gitCommitMessage: "Initial Commit Message",
            gitAuthorName: "Test User",
            gitAuthorEmail: "test.user@example.com",
            branch: "develop",
            sourcePath: "./src"
          }
        }
      ]
    })
  }
];

gerritReview_examples_cjs.examples = examples;

var crypto = require$$0$1;
var errors = require$$1;
var pluginScaffolderNode = require$$3;
var gerritReview_examples = gerritReview_examples_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var crypto__default = /*#__PURE__*/_interopDefaultCompat(crypto);

const generateGerritChangeId = () => {
  const changeId = crypto__default.default.randomBytes(20).toString("hex");
  return `I${changeId}`;
};
function createPublishGerritReviewAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "publish:gerrit:review",
    description: "Creates a new Gerrit review.",
    examples: gerritReview_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "gitCommitMessage"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            type: "string"
          },
          branch: {
            title: "Repository branch",
            type: "string",
            description: "Branch of the repository the review will be created on"
          },
          sourcePath: {
            type: "string",
            title: "Working Subdirectory",
            description: "Subdirectory of working directory containing the repository"
          },
          gitCommitMessage: {
            title: "Git Commit Message",
            type: "string",
            description: `Sets the commit message on the repository.`
          },
          gitAuthorName: {
            title: "Default Author Name",
            type: "string",
            description: `Sets the default author name for the commit. The default value is 'Scaffolder'`
          },
          gitAuthorEmail: {
            title: "Default Author Email",
            type: "string",
            description: `Sets the default author email for the commit.`
          }
        }
      },
      output: {
        type: "object",
        properties: {
          reviewUrl: {
            title: "A URL to the review",
            type: "string"
          },
          repoContentsUrl: {
            title: "A URL to the root of the repository",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        branch = "master",
        sourcePath,
        gitAuthorName,
        gitAuthorEmail,
        gitCommitMessage
      } = ctx.input;
      const { host, repo } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      if (!gitCommitMessage) {
        throw new errors.InputError(`Missing gitCommitMessage input`);
      }
      const integrationConfig = integrations.gerrit.byHost(host);
      if (!integrationConfig) {
        throw new errors.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      const auth = {
        username: integrationConfig.config.username,
        password: integrationConfig.config.password
      };
      const gitAuthorInfo = {
        name: gitAuthorName ? gitAuthorName : config.getOptionalString("scaffolder.defaultAuthor.name"),
        email: gitAuthorEmail ? gitAuthorEmail : config.getOptionalString("scaffolder.defaultAuthor.email")
      };
      const changeId = generateGerritChangeId();
      const commitMessage = `${gitCommitMessage}

Change-Id: ${changeId}`;
      await pluginScaffolderNode.commitAndPushRepo({
        dir: pluginScaffolderNode.getRepoSourceDirectory(ctx.workspacePath, sourcePath),
        auth,
        logger: ctx.logger,
        commitMessage,
        gitAuthorInfo,
        branch,
        remoteRef: `refs/for/${branch}`
      });
      const repoContentsUrl = `${integrationConfig.config.gitilesBaseUrl}/${repo}/+/refs/heads/${branch}`;
      const reviewUrl = `${integrationConfig.config.baseUrl}/#/q/${changeId}`;
      ctx.logger?.info(`Review available on ${reviewUrl}`);
      ctx.output("repoContentsUrl", repoContentsUrl);
      ctx.output("reviewUrl", reviewUrl);
    }
  });
}

gerritReview_cjs.createPublishGerritReviewAction = createPublishGerritReviewAction;

var module_cjs = {};

var backendPluginApi = require$$0$2;
var alpha = require$$1$1;
var gerrit$1 = gerrit_cjs;
var gerritReview$1 = gerritReview_cjs;
var integration = require$$2;

const gerritModule = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "geritt",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config }) {
        const integrations = integration.ScmIntegrations.fromConfig(config);
        scaffolder.addActions(
          gerrit$1.createPublishGerritAction({ integrations, config }),
          gerritReview$1.createPublishGerritReviewAction({ integrations, config })
        );
      }
    });
  }
});

module_cjs.gerritModule = gerritModule;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var gerrit = gerrit_cjs;
var gerritReview = gerritReview_cjs;
var module$1 = module_cjs;



index_cjs.createPublishGerritAction = gerrit.createPublishGerritAction;
index_cjs.createPublishGerritReviewAction = gerritReview.createPublishGerritReviewAction;
var _default = index_cjs.default = module$1.gerritModule;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
