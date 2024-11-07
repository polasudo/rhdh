'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/errors');
var require$$1 = require('@backstage/integration');
var require$$2 = require('@backstage/plugin-scaffolder-node');
var require$$3 = require('node-fetch');
var require$$0 = require('yaml');
var require$$4 = require('fs-extra');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var bitbucketServer_cjs = {};

var bitbucketServer_examples_cjs = {};

var yaml$1 = require$$0;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$3(yaml$1);

const examples$1 = [
  {
    description: "Initialize git repository with required properties",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-minimal",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with all properties",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-minimal",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            description: "This is a test repository",
            repoVisibility: "private",
            defaultBranch: "main",
            sourcePath: "packages/backend",
            enableLFS: false,
            token: "test-token",
            gitCommitMessage: "Init check commit",
            gitAuthorName: "Test User",
            gitAuthorEmail: "test.user@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with public visibility",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-minimal",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            description: "This is a test repository",
            repoVisibility: "public",
            defaultBranch: "main",
            sourcePath: "packages/backend",
            enableLFS: true,
            token: "test-token",
            gitCommitMessage: "Init check commit",
            gitAuthorName: "Test User",
            gitAuthorEmail: "test.user@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with different default branch",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-minimal",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            description: "This is a test repository",
            repoVisibility: "public",
            defaultBranch: "develop",
            sourcePath: "packages/backend",
            enableLFS: true,
            token: "test-token",
            gitCommitMessage: "Init check commit",
            gitAuthorName: "Test User",
            gitAuthorEmail: "test.user@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with different source path",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-minimal",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            description: "This is a test repository",
            repoVisibility: "public",
            defaultBranch: "develop",
            sourcePath: "packages/api",
            enableLFS: true,
            token: "test-token",
            gitCommitMessage: "Init check commit",
            gitAuthorName: "Test User",
            gitAuthorEmail: "test.user@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with default settings and custom author information",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-custom-author",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            gitAuthorName: "Custom Author",
            gitAuthorEmail: "custom.author@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with LFS enabled and a specific commit message",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-lfs-commit",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            enableLFS: true,
            gitCommitMessage: "Initial commit with LFS enabled"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with a custom source path and token",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-custom-source",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            sourcePath: "custom/source/path",
            token: "custom-token"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with private visibility and custom author details",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-private-custom-author",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            repoVisibility: "private",
            gitAuthorName: "Private Author",
            gitAuthorEmail: "private.author@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with public visibility and specific commit message",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-public-commit",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            repoVisibility: "public",
            gitCommitMessage: "Public repository initial commit"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with all settings customized",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-all-custom",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            description: "A fully customized repository",
            repoVisibility: "private",
            defaultBranch: "development",
            sourcePath: "src/backend",
            enableLFS: true,
            token: "custom-token",
            gitCommitMessage: "Fully customized initial commit",
            gitAuthorName: "Custom Dev",
            gitAuthorEmail: "custom.dev@example.com"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with a specific default branch and no LFS",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-no-lfs",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            defaultBranch: "main",
            enableLFS: false
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with a custom repository description and public visibility",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-custom-description",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            description: "A public repository with a custom description",
            repoVisibility: "public"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with a custom token for authentication",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-custom-token",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            token: "custom-auth-token"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with a different repository root path",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-different-root",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            sourcePath: "different/root/path"
          }
        }
      ]
    })
  },
  {
    description: "Initialize git repository with private visibility and LFS enabled",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer",
          id: "publish-bitbucket-server-private-lfs",
          name: "Publish To Bitbucket Server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            repoVisibility: "private",
            enableLFS: true
          }
        }
      ]
    })
  }
];

bitbucketServer_examples_cjs.examples = examples$1;

var errors$1 = require$$0$1;
var integration$2 = require$$1;
var pluginScaffolderNode$1 = require$$2;
var fetch$1 = require$$3;
var bitbucketServer_examples = bitbucketServer_examples_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default$1 = /*#__PURE__*/_interopDefaultCompat$2(fetch$1);

const createRepository = async (opts) => {
  const {
    project,
    repo,
    description,
    authorization,
    repoVisibility,
    defaultBranch,
    apiBaseUrl
  } = opts;
  let response;
  const options = {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      description,
      defaultBranch,
      public: repoVisibility === "public"
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default$1.default(`${apiBaseUrl}/projects/${project}/repos`, options);
  } catch (e) {
    throw new Error(`Unable to create repository, ${e}`);
  }
  if (response.status !== 201) {
    throw new Error(
      `Unable to create repository, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
  const r = await response.json();
  let remoteUrl = "";
  for (const link of r.links.clone) {
    if (link.name === "http") {
      remoteUrl = link.href;
    }
  }
  const repoContentsUrl = `${r.links.self[0].href}`;
  return { remoteUrl, repoContentsUrl };
};
const performEnableLFS = async (opts) => {
  const { authorization, host, project, repo } = opts;
  const options = {
    method: "PUT",
    headers: {
      Authorization: authorization
    }
  };
  const { ok, status, statusText } = await fetch__default$1.default(
    `https://${host}/rest/git-lfs/admin/projects/${project}/repos/${repo}/enabled`,
    options
  );
  if (!ok)
    throw new Error(
      `Failed to enable LFS in the repository, ${status}: ${statusText}`
    );
};
function createPublishBitbucketServerAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode$1.createTemplateAction({
    id: "publish:bitbucketServer",
    description: "Initializes a git repository of the content in the workspace, and publishes it to Bitbucket Server.",
    examples: bitbucketServer_examples.examples,
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
          repoVisibility: {
            title: "Repository Visibility",
            type: "string",
            enum: ["private", "public"]
          },
          defaultBranch: {
            title: "Default Branch",
            type: "string",
            description: `Sets the default branch on the repository. The default value is 'master'`
          },
          sourcePath: {
            title: "Source Path",
            description: "Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository.",
            type: "string"
          },
          enableLFS: {
            title: "Enable LFS?",
            description: "Enable LFS for the repository.",
            type: "boolean"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to BitBucket Server"
          },
          gitCommitMessage: {
            title: "Git Commit Message",
            type: "string",
            description: `Sets the commit message on the repository. The default value is 'initial commit'`
          },
          gitAuthorName: {
            title: "Author Name",
            type: "string",
            description: `Sets the author name for the commit. The default value is 'Scaffolder'`
          },
          gitAuthorEmail: {
            title: "Author Email",
            type: "string",
            description: `Sets the author email for the commit.`
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
        repoVisibility = "private",
        enableLFS = false,
        gitCommitMessage = "initial commit",
        gitAuthorName,
        gitAuthorEmail
      } = ctx.input;
      const { project, repo, host } = pluginScaffolderNode$1.parseRepoUrl(repoUrl, integrations);
      if (!project) {
        throw new errors$1.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing project`
        );
      }
      const integrationConfig = integrations.bitbucketServer.byHost(host);
      if (!integrationConfig) {
        throw new errors$1.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      const token = ctx.input.token ?? integrationConfig.config.token;
      const authConfig = {
        ...integrationConfig.config,
        ...{ token }
      };
      const reqOpts = integration$2.getBitbucketServerRequestOptions(authConfig);
      const authorization = reqOpts.headers.Authorization;
      if (!authorization) {
        throw new Error(
          `Authorization has not been provided for ${integrationConfig.config.host}. Please add either (a) a user login auth token, or (b) a token or (c) username + password to the integration config.`
        );
      }
      const apiBaseUrl = integrationConfig.config.apiBaseUrl;
      const { remoteUrl, repoContentsUrl } = await createRepository({
        authorization,
        project,
        repo,
        repoVisibility,
        defaultBranch,
        description,
        apiBaseUrl
      });
      const gitAuthorInfo = {
        name: gitAuthorName ? gitAuthorName : config.getOptionalString("scaffolder.defaultAuthor.name"),
        email: gitAuthorEmail ? gitAuthorEmail : config.getOptionalString("scaffolder.defaultAuthor.email")
      };
      const auth = authConfig.token ? {
        token
      } : {
        username: authConfig.username,
        password: authConfig.password
      };
      const commitResult = await pluginScaffolderNode$1.initRepoAndPush({
        dir: pluginScaffolderNode$1.getRepoSourceDirectory(ctx.workspacePath, ctx.input.sourcePath),
        remoteUrl,
        auth,
        defaultBranch,
        logger: ctx.logger,
        commitMessage: gitCommitMessage ? gitCommitMessage : config.getOptionalString("scaffolder.defaultCommitMessage"),
        gitAuthorInfo
      });
      if (enableLFS) {
        await performEnableLFS({ authorization, host, project, repo });
      }
      ctx.output("commitHash", commitResult?.commitHash);
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
    }
  });
}

bitbucketServer_cjs.createPublishBitbucketServerAction = createPublishBitbucketServerAction;

var bitbucketServerPullRequest_cjs = {};

var bitbucketServerPullRequest_examples_cjs = {};

var yaml = require$$0;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat$1(yaml);

const examples = [
  {
    description: "Creating pull request on bitbucket server with required fields",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer:pull-request",
          id: "publish-bitbucket-server-pull-request-minimal",
          name: "Creating pull request on bitbucket server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket server with custom descriptions",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer:pull-request",
          id: "publish-bitbucket-server-pull-request-minimal",
          name: "Creating pull request on bitbucket server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            description: "This is a detailed description of my pull request"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket server with different target branch",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer:pull-request",
          id: "publish-bitbucket-server-pull-request-target-branch",
          name: "Creating pull request on bitbucket server",
          input: {
            repoUrl: "hosted.bitbucket.com?project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            targetBranch: "development"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket server with authorization token",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer:pull-request",
          id: "publish-bitbucket-server-pull-request-minimal",
          name: "Creating pull request on bitbucket server",
          input: {
            repoUrl: "no-credentials.bitbucket.com?project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            token: "my-auth-token"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket server with all fields",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketServer:pull-request",
          id: "publish-bitbucket-server-pull-request-minimal",
          name: "Creating pull request on bitbucket server",
          input: {
            repoUrl: "no-credentials.bitbucket.com?project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            targetBranch: "development",
            description: "This is a detailed description of my pull request",
            reviewers: ["reviewer1", "reviewer2"],
            token: "my-auth-token",
            gitAuthorName: "test-user",
            gitAuthorEmail: "test-user@sample.com"
          }
        }
      ]
    })
  }
];

bitbucketServerPullRequest_examples_cjs.examples = examples;

var errors = require$$0$1;
var integration$1 = require$$1;
var pluginScaffolderNode = require$$2;
var fetch = require$$3;
var fs = require$$4;
var bitbucketServerPullRequest_examples = bitbucketServerPullRequest_examples_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);
var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

const createPullRequest = async (opts) => {
  const {
    project,
    repo,
    title,
    description,
    toRef,
    fromRef,
    reviewers,
    authorization,
    apiBaseUrl
  } = opts;
  let response;
  const data = {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      state: "OPEN",
      open: true,
      closed: false,
      locked: true,
      toRef,
      fromRef,
      reviewers: reviewers?.map((reviewer) => ({ user: { name: reviewer } }))
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(
      `${apiBaseUrl}/projects/${encodeURIComponent(
        project
      )}/repos/${encodeURIComponent(repo)}/pull-requests`,
      data
    );
  } catch (e) {
    throw new Error(`Unable to create pull-reqeusts, ${e}`);
  }
  if (response.status !== 201) {
    throw new Error(
      `Unable to create pull requests, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
  const r = await response.json();
  return `${r.links.self[0].href}`;
};
const findBranches = async (opts) => {
  const { project, repo, branchName, authorization, apiBaseUrl } = opts;
  let response;
  const options = {
    method: "GET",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(
      `${apiBaseUrl}/projects/${encodeURIComponent(
        project
      )}/repos/${encodeURIComponent(
        repo
      )}/branches?boostMatches=true&filterText=${encodeURIComponent(
        branchName
      )}`,
      options
    );
  } catch (e) {
    throw new Error(`Unable to get branches, ${e}`);
  }
  if (response.status !== 200) {
    throw new Error(
      `Unable to get branches, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
  const r = await response.json();
  for (const object of r.values) {
    if (object.displayId === branchName) {
      return object;
    }
  }
  return void 0;
};
const createBranch = async (opts) => {
  const { project, repo, branchName, authorization, apiBaseUrl, startPoint } = opts;
  let response;
  const options = {
    method: "POST",
    body: JSON.stringify({
      name: branchName,
      startPoint
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(
      `${apiBaseUrl}/projects/${encodeURIComponent(
        project
      )}/repos/${encodeURIComponent(repo)}/branches`,
      options
    );
  } catch (e) {
    throw new Error(`Unable to create branch, ${e}`);
  }
  if (response.status !== 200) {
    throw new Error(
      `Unable to create branch, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
  return await response.json();
};
const getDefaultBranch = async (opts) => {
  const { project, repo, authorization, apiBaseUrl } = opts;
  let response;
  const options = {
    method: "GET",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(
      `${apiBaseUrl}/projects/${project}/repos/${repo}/default-branch`,
      options
    );
  } catch (error) {
    throw error;
  }
  const { displayId } = await response.json();
  const defaultBranch = displayId;
  if (!defaultBranch) {
    throw new Error(`Could not fetch default branch for ${project}/${repo}`);
  }
  return defaultBranch;
};
const isApiBaseUrlHttps = (apiBaseUrl) => {
  const url = new URL(apiBaseUrl);
  return url.protocol === "https:";
};
function createPublishBitbucketServerPullRequestAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "publish:bitbucketServer:pull-request",
    examples: bitbucketServerPullRequest_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl", "title", "sourceBranch"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            type: "string"
          },
          title: {
            title: "Pull Request title",
            type: "string",
            description: "The title for the pull request"
          },
          description: {
            title: "Pull Request Description",
            type: "string",
            description: "The description of the pull request"
          },
          targetBranch: {
            title: "Target Branch",
            type: "string",
            description: `Branch of repository to apply changes to. The default value is 'master'`
          },
          sourceBranch: {
            title: "Source Branch",
            type: "string",
            description: "Branch of repository to copy changes from"
          },
          reviewers: {
            title: "Pull Request Reviewers",
            type: "array",
            items: {
              type: "string"
            },
            description: "The usernames of reviewers that will be added to the pull request"
          },
          token: {
            title: "Authorization Token",
            type: "string",
            description: "The token to use for authorization to BitBucket Server"
          },
          gitAuthorName: {
            title: "Author Name",
            type: "string",
            description: `Sets the author name for the commit. The default value is 'Scaffolder'`
          },
          gitAuthorEmail: {
            title: "Author Email",
            type: "string",
            description: `Sets the author email for the commit.`
          }
        }
      },
      output: {
        type: "object",
        properties: {
          pullRequestUrl: {
            title: "A URL to the pull request with the provider",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        repoUrl,
        title,
        description,
        targetBranch,
        sourceBranch,
        reviewers,
        gitAuthorName,
        gitAuthorEmail
      } = ctx.input;
      const { project, repo, host } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      if (!project) {
        throw new errors.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing project`
        );
      }
      const integrationConfig = integrations.bitbucketServer.byHost(host);
      if (!integrationConfig) {
        throw new errors.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      const token = ctx.input.token ?? integrationConfig.config.token;
      const authConfig = {
        ...integrationConfig.config,
        ...{ token }
      };
      const reqOpts = integration$1.getBitbucketServerRequestOptions(authConfig);
      const authorization = reqOpts.headers.Authorization;
      if (!authorization) {
        throw new Error(
          `Authorization has not been provided for ${integrationConfig.config.host}. Please add either (a) a user login auth token, or (b) a token input from the template or (c) username + password to the integration config.`
        );
      }
      const apiBaseUrl = integrationConfig.config.apiBaseUrl;
      let finalTargetBranch = targetBranch;
      if (!finalTargetBranch) {
        finalTargetBranch = await getDefaultBranch({
          project,
          repo,
          authorization,
          apiBaseUrl
        });
      }
      const toRef = await findBranches({
        project,
        repo,
        branchName: finalTargetBranch,
        authorization,
        apiBaseUrl
      });
      let fromRef = await findBranches({
        project,
        repo,
        branchName: sourceBranch,
        authorization,
        apiBaseUrl
      });
      if (!fromRef) {
        ctx.logger.info(
          `source branch not found -> creating branch named: ${sourceBranch} lastCommit: ${toRef.latestCommit}`
        );
        const latestCommit = toRef.latestCommit;
        fromRef = await createBranch({
          project,
          repo,
          branchName: sourceBranch,
          authorization,
          apiBaseUrl,
          startPoint: latestCommit
        });
        const isHttps = isApiBaseUrlHttps(apiBaseUrl);
        const remoteUrl = `${isHttps ? "https" : "http"}://${host}/scm/${project}/${repo}.git`;
        const auth = authConfig.token ? {
          token
        } : {
          username: authConfig.username,
          password: authConfig.password
        };
        const gitAuthorInfo = {
          name: gitAuthorName || config.getOptionalString("scaffolder.defaultAuthor.name"),
          email: gitAuthorEmail || config.getOptionalString("scaffolder.defaultAuthor.email")
        };
        const tempDir = await ctx.createTemporaryDirectory();
        const sourceDir = pluginScaffolderNode.getRepoSourceDirectory(ctx.workspacePath, void 0);
        await pluginScaffolderNode.cloneRepo({
          url: remoteUrl,
          dir: tempDir,
          auth,
          logger: ctx.logger,
          ref: sourceBranch
        });
        await pluginScaffolderNode.createBranch({
          dir: tempDir,
          auth,
          logger: ctx.logger,
          ref: sourceBranch
        });
        fs__default.default.cpSync(sourceDir, tempDir, {
          recursive: true,
          filter: (path) => {
            return !(path.indexOf(".git") > -1);
          }
        });
        await pluginScaffolderNode.addFiles({
          dir: tempDir,
          auth,
          logger: ctx.logger,
          filepath: "."
        });
        await pluginScaffolderNode.commitAndPushBranch({
          dir: tempDir,
          auth,
          logger: ctx.logger,
          commitMessage: description ?? config.getOptionalString("scaffolder.defaultCommitMessage") ?? "",
          gitAuthorInfo,
          branch: sourceBranch
        });
      }
      const pullRequestUrl = await createPullRequest({
        project,
        repo,
        title,
        description,
        toRef,
        fromRef,
        reviewers,
        authorization,
        apiBaseUrl
      });
      ctx.output("pullRequestUrl", pullRequestUrl);
    }
  });
}

bitbucketServerPullRequest_cjs.createPublishBitbucketServerPullRequestAction = createPublishBitbucketServerPullRequestAction;

var module_cjs = {};

var backendPluginApi = require$$0$2;
var alpha = require$$1$1;
var bitbucketServer$1 = bitbucketServer_cjs;
var bitbucketServerPullRequest$1 = bitbucketServerPullRequest_cjs;
var integration = require$$1;

const bitbucketServerModule = backendPluginApi.createBackendModule({
  moduleId: "bitbucketServer",
  pluginId: "scaffolder",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config }) {
        const integrations = integration.ScmIntegrations.fromConfig(config);
        scaffolder.addActions(
          bitbucketServer$1.createPublishBitbucketServerAction({ integrations, config }),
          bitbucketServerPullRequest$1.createPublishBitbucketServerPullRequestAction({
            integrations,
            config
          })
        );
      }
    });
  }
});

module_cjs.bitbucketServerModule = bitbucketServerModule;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var bitbucketServer = bitbucketServer_cjs;
var bitbucketServerPullRequest = bitbucketServerPullRequest_cjs;
var module$1 = module_cjs;



index_cjs.createPublishBitbucketServerAction = bitbucketServer.createPublishBitbucketServerAction;
index_cjs.createPublishBitbucketServerPullRequestAction = bitbucketServerPullRequest.createPublishBitbucketServerPullRequestAction;
var _default = index_cjs.default = module$1.bitbucketServerModule;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
