'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('crypto');
var require$$1 = require('@backstage/errors');
var require$$2 = require('@backstage/integration');
var require$$3 = require('@backstage/plugin-scaffolder-node');
var require$$4 = require('node-fetch');
var require$$5 = require('yaml');
var require$$6 = require('@backstage/backend-plugin-api');
var require$$7 = require('@backstage/plugin-scaffolder-node/alpha');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var index_cjs$1 = {};

(function (exports) {

	Object.defineProperty(exports, '__esModule', { value: true });

	var crypto = require$$0;
	var errors = require$$1;
	var integration = require$$2;
	var pluginScaffolderNode = require$$3;
	var fetch = require$$4;
	var yaml = require$$5;
	var backendPluginApi = require$$6;
	var alpha = require$$7;

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
	var fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch);
	var yaml__default = /*#__PURE__*/_interopDefaultLegacy(yaml);

	const examples = [
	  {
	    description: "Initializes a Gerrit repository of contents in workspace and publish it to Gerrit with default configuration.",
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	    example: yaml__default["default"].stringify({
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
	  }
	];

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
	      ...integration.getGerritRequestOptions(config).headers,
	      "Content-Type": "application/json"
	    }
	  };
	  const response = await fetch__default["default"](
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
	  const changeId = crypto__default["default"].randomBytes(20).toString("hex");
	  const msg = `${config.getOptionalString("scaffolder.defaultCommitMessage") || commitSubject}

Change-Id: I${changeId}`;
	  return msg;
	};
	function createPublishGerritAction(options) {
	  const { integrations, config } = options;
	  return pluginScaffolderNode.createTemplateAction({
	    id: "publish:gerrit",
	    supportsDryRun: true,
	    description: "Initializes a git repository of the content in the workspace, and publishes it to Gerrit.",
	    examples,
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
	      const { repo, host, owner, workspace } = pluginScaffolderNode.parseRepoUrl(
	        repoUrl,
	        integrations
	      );
	      const integrationConfig = integrations.gerrit.byHost(host);
	      if (!integrationConfig) {
	        throw new errors.InputError(
	          `No matching integration configuration for host ${host}, please check your integrations config`
	        );
	      }
	      if (!workspace) {
	        throw new errors.InputError(
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
	      const commitResult = await pluginScaffolderNode.initRepoAndPush({
	        dir: pluginScaffolderNode.getRepoSourceDirectory(ctx.workspacePath, sourcePath),
	        remoteUrl,
	        auth,
	        defaultBranch,
	        logger: ctx.logger,
	        commitMessage: generateCommitMessage(config, gitCommitMessage),
	        gitAuthorInfo
	      });
	      ctx.output("remoteUrl", remoteUrl);
	      ctx.output("commitHash", commitResult == null ? void 0 : commitResult.commitHash);
	      ctx.output("repoContentsUrl", repoContentsUrl);
	    }
	  });
	}

	const generateGerritChangeId = () => {
	  const changeId = crypto__default["default"].randomBytes(20).toString("hex");
	  return `I${changeId}`;
	};
	function createPublishGerritReviewAction(options) {
	  const { integrations, config } = options;
	  return pluginScaffolderNode.createTemplateAction({
	    id: "publish:gerrit:review",
	    description: "Creates a new Gerrit review.",
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
	      var _a;
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
	      (_a = ctx.logger) == null ? void 0 : _a.info(`Review available on ${reviewUrl}`);
	      ctx.output("repoContentsUrl", repoContentsUrl);
	      ctx.output("reviewUrl", reviewUrl);
	    }
	  });
	}

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
	          createPublishGerritAction({ integrations, config }),
	          createPublishGerritReviewAction({ integrations, config })
	        );
	      }
	    });
	  }
	});

	exports.createPublishGerritAction = createPublishGerritAction;
	exports.createPublishGerritReviewAction = createPublishGerritReviewAction;
	exports["default"] = gerritModule;
	
} (index_cjs$1));

var index_cjs = /*@__PURE__*/getDefaultExportFromCjs(index_cjs$1);

exports["default"] = index_cjs;
//# sourceMappingURL=index.cjs.js.map
