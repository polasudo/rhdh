'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/errors');
var require$$1 = require('@backstage/plugin-scaffolder-node');
var require$$2 = require('node-fetch');
var require$$0 = require('yaml');
var require$$3 = require('fs-extra');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$1$2 = require('@backstage/plugin-scaffolder-node/alpha');
var require$$5 = require('@backstage/integration');
var require$$1$1 = require('@backstage/plugin-bitbucket-cloud-common');

var index_cjs = {};

var bitbucketCloud_cjs = {};

var helpers_cjs = {};

const getAuthorizationHeader = (config) => {
  if (config.username && config.appPassword) {
    const buffer = Buffer.from(
      `${config.username}:${config.appPassword}`,
      "utf8"
    );
    return `Basic ${buffer.toString("base64")}`;
  }
  if (config.token) {
    return `Bearer ${config.token}`;
  }
  throw new Error(
    `Authorization has not been provided for Bitbucket Cloud. Please add either username + appPassword to the Integrations config or a user login auth token`
  );
};

helpers_cjs.getAuthorizationHeader = getAuthorizationHeader;

var bitbucketCloud_examples_cjs = {};

var yaml$2 = require$$0;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$2 = /*#__PURE__*/_interopDefaultCompat$5(yaml$2);

const examples$2 = [
  {
    description: "Initializes a git repository with the content in the workspace, and publishes it to Bitbucket Cloud with the default configuration.",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Bitbucket Cloud repository with a description.",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project",
            description: "Initialize a git repository"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Bitbucket Cloud repository with public repo visibility, if not set defaults to private",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project",
            repoVisibility: "public"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Bitbucket Cloud repository with a default Branch, if not set defaults to master",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project",
            defaultBranch: "main"
          }
        }
      ]
    })
  },
  {
    description: "Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project",
            sourcePath: "./repoRoot"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Bitbucket Cloud repository with a custom authentication token",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project",
            token: "your-custom-auth-token"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a Bitbucket Cloud repository with all proporties being set",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:bitbucketCloud",
          name: "Publish to Bitbucket Cloud",
          input: {
            repoUrl: "bitbucket.org?repo=repo&workspace=workspace&project=project",
            description: "Initialize a git repository",
            repoVisibility: "public",
            defaultBranch: "main",
            token: "your-custom-auth-token"
          }
        }
      ]
    })
  }
];

bitbucketCloud_examples_cjs.examples = examples$2;

var errors$2 = require$$0$1;
var pluginScaffolderNode$2 = require$$1;
var fetch$2 = require$$2;
var helpers$2 = helpers_cjs;
var bitbucketCloud_examples = bitbucketCloud_examples_cjs;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default$2 = /*#__PURE__*/_interopDefaultCompat$4(fetch$2);

const createRepository = async (opts) => {
  const {
    workspace,
    project,
    repo,
    description,
    repoVisibility,
    mainBranch,
    authorization,
    apiBaseUrl
  } = opts;
  const options = {
    method: "POST",
    body: JSON.stringify({
      scm: "git",
      description,
      is_private: repoVisibility === "private",
      project: { key: project }
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  let response;
  try {
    response = await fetch__default$2.default(
      `${apiBaseUrl}/repositories/${workspace}/${repo}`,
      options
    );
  } catch (e) {
    throw new Error(`Unable to create repository, ${e}`);
  }
  if (response.status !== 200) {
    throw new Error(
      `Unable to create repository, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
  const r = await response.json();
  let remoteUrl = "";
  for (const link of r.links.clone) {
    if (link.name === "https") {
      remoteUrl = link.href;
    }
  }
  const repoContentsUrl = `${r.links.html.href}/src/${mainBranch}`;
  return { remoteUrl, repoContentsUrl };
};
function createPublishBitbucketCloudAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode$2.createTemplateAction({
    id: "publish:bitbucketCloud",
    examples: bitbucketCloud_examples.examples,
    description: "Initializes a git repository of the content in the workspace, and publishes it to Bitbucket Cloud.",
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
          gitCommitMessage: {
            title: "Git Commit Message",
            type: "string",
            description: `Sets the commit message on the repository. The default value is 'initial commit'`
          },
          sourcePath: {
            title: "Source Path",
            description: "Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository.",
            type: "string"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to BitBucket Cloud"
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
        gitCommitMessage,
        repoVisibility = "private"
      } = ctx.input;
      const { workspace, project, repo, host } = pluginScaffolderNode$2.parseRepoUrl(
        repoUrl,
        integrations
      );
      if (!workspace) {
        throw new errors$2.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing workspace`
        );
      }
      if (!project) {
        throw new errors$2.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing project`
        );
      }
      const integrationConfig = integrations.bitbucketCloud.byHost(host);
      if (!integrationConfig) {
        throw new errors$2.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      const authorization = helpers$2.getAuthorizationHeader(
        ctx.input.token ? { token: ctx.input.token } : integrationConfig.config
      );
      const apiBaseUrl = integrationConfig.config.apiBaseUrl;
      const { remoteUrl, repoContentsUrl } = await createRepository({
        authorization,
        workspace: workspace || "",
        project,
        repo,
        repoVisibility,
        mainBranch: defaultBranch,
        description,
        apiBaseUrl
      });
      const gitAuthorInfo = {
        name: config.getOptionalString("scaffolder.defaultAuthor.name"),
        email: config.getOptionalString("scaffolder.defaultAuthor.email")
      };
      let auth;
      if (ctx.input.token) {
        auth = {
          username: "x-token-auth",
          password: ctx.input.token
        };
      } else {
        if (!integrationConfig.config.username || !integrationConfig.config.appPassword) {
          throw new Error(
            "Credentials for Bitbucket Cloud integration required for this action."
          );
        }
        auth = {
          username: integrationConfig.config.username,
          password: integrationConfig.config.appPassword
        };
      }
      const commitResult = await pluginScaffolderNode$2.initRepoAndPush({
        dir: pluginScaffolderNode$2.getRepoSourceDirectory(ctx.workspacePath, ctx.input.sourcePath),
        remoteUrl,
        auth,
        defaultBranch,
        logger: ctx.logger,
        commitMessage: gitCommitMessage || config.getOptionalString("scaffolder.defaultCommitMessage"),
        gitAuthorInfo
      });
      ctx.output("commitHash", commitResult?.commitHash);
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
    }
  });
}

bitbucketCloud_cjs.createPublishBitbucketCloudAction = createPublishBitbucketCloudAction;

var bitbucketCloudPipelinesRun_cjs = {};

var bitbucketCloudPipelinesRun_examples_cjs = {};

var yaml$1 = require$$0;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$3(yaml$1);

const examples$1 = [
  {
    description: "Trigger a pipeline for a branch",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "bitbucket:pipelines:run",
          id: "run-bitbucket-pipeline",
          name: "Run an example bitbucket pipeline",
          input: {
            workspace: "test-workspace",
            repo_slug: "test-repo-slug",
            body: {
              target: {
                ref_type: "branch",
                type: "pipeline_ref_target",
                ref_name: "master"
              }
            }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a pipeline for a commit on a branch",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "bitbucket:pipelines:run",
          id: "run-bitbucket-pipeline",
          name: "Run an example bitbucket pipeline",
          input: {
            workspace: "test-workspace",
            repo_slug: "test-repo-slug",
            body: {
              target: {
                commit: {
                  type: "commit",
                  hash: "ce5b7431602f7cbba007062eeb55225c6e18e956"
                },
                ref_type: "branch",
                type: "pipeline_ref_target",
                ref_name: "master"
              }
            }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a specific pipeline definition for a commit",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "bitbucket:pipelines:run",
          id: "run-bitbucket-pipeline",
          name: "Run an example bitbucket pipeline",
          input: {
            workspace: "test-workspace",
            repo_slug: "test-repo-slug",
            body: {
              target: {
                commit: {
                  type: "commit",
                  hash: "a3c4e02c9a3755eccdc3764e6ea13facdf30f923"
                },
                selector: {
                  type: "custom",
                  pattern: "Deploy to production"
                },
                type: "pipeline_commit_target"
              }
            }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a specific pipeline definition for a commit on a branch or tag",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "bitbucket:pipelines:run",
          id: "run-bitbucket-pipeline",
          name: "Run an example bitbucket pipeline",
          input: {
            workspace: "test-workspace",
            repo_slug: "test-repo-slug",
            body: {
              target: {
                commit: {
                  type: "commit",
                  hash: "a3c4e02c9a3755eccdc3764e6ea13facdf30f923"
                },
                selector: {
                  type: "custom",
                  pattern: "Deploy to production"
                },
                type: "pipeline_ref_target",
                ref_name: "master",
                ref_type: "branch"
              }
            }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a custom pipeline with variables",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "bitbucket:pipelines:run",
          id: "run-bitbucket-pipeline",
          name: "Run an example bitbucket pipeline",
          input: {
            workspace: "test-workspace",
            repo_slug: "test-repo-slug",
            body: {
              target: {
                type: "pipeline_ref_target",
                ref_name: "master",
                ref_type: "branch",
                selector: {
                  type: "custom",
                  pattern: "Deploy to production"
                }
              },
              variables: [
                { key: "var1key", value: "var1value", secured: true },
                {
                  key: "var2key",
                  value: "var2value"
                }
              ]
            }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a pull request pipeline",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          action: "bitbucket:pipelines:run",
          id: "run-bitbucket-pipeline",
          name: "Run an example bitbucket pipeline",
          input: {
            workspace: "test-workspace",
            repo_slug: "test-repo-slug",
            body: {
              target: {
                type: "pipeline_pullrequest_target",
                source: "pull-request-branch",
                destination: "master",
                destination_commit: {
                  hash: "9f848b7"
                },
                commit: {
                  hash: "1a372fc"
                },
                pull_request: {
                  id: "3"
                },
                selector: {
                  type: "pull-requests",
                  pattern: "**"
                }
              }
            }
          }
        }
      ]
    })
  }
];

bitbucketCloudPipelinesRun_examples_cjs.examples = examples$1;

var inputProperties_cjs = {};

const workspace = {
  title: "Workspace",
  description: `The workspace name`,
  type: "string"
};
const repo_slug = {
  title: "Repository name",
  description: "The repository name",
  type: "string"
};
const ref_type = {
  title: "ref_type",
  type: "string"
};
const type = {
  title: "type",
  type: "string"
};
const ref_name = {
  title: "ref_name",
  type: "string"
};
const source = {
  title: "source",
  type: "string"
};
const destination = {
  title: "destination",
  type: "string"
};
const hash = {
  title: "hash",
  type: "string"
};
const pattern = {
  title: "pattern",
  type: "string"
};
const id$1 = {
  title: "id",
  type: "string"
};
const key = {
  title: "key",
  type: "string"
};
const value = {
  title: "value",
  type: "string"
};
const secured = {
  title: "secured",
  type: "boolean"
};
const token = {
  title: "Authentication Token",
  type: "string",
  description: "The token to use for authorization to BitBucket Cloud"
};
const destination_commit = {
  title: "destination_commit",
  type: "object",
  properties: {
    hash
  }
};
const commit = {
  title: "commit",
  type: "object",
  properties: {
    type,
    hash
  }
};
const selector = {
  title: "selector",
  type: "object",
  properties: {
    type,
    pattern
  }
};
const pull_request = {
  title: "pull_request",
  type: "object",
  properties: {
    id: id$1
  }
};
const pipelinesRunBody = {
  title: "Request Body",
  description: "Request body properties: see Bitbucket Cloud Rest API documentation for more details",
  type: "object",
  properties: {
    target: {
      title: "target",
      type: "object",
      properties: {
        ref_type,
        type,
        ref_name,
        source,
        destination,
        destination_commit,
        commit,
        selector,
        pull_request
      }
    },
    variables: {
      title: "variables",
      type: "array",
      items: {
        type: "object",
        properties: {
          key,
          value,
          secured
        }
      }
    }
  }
};

inputProperties_cjs.pipelinesRunBody = pipelinesRunBody;
inputProperties_cjs.repo_slug = repo_slug;
inputProperties_cjs.token = token;
inputProperties_cjs.workspace = workspace;

var bitbucketCloudPipelinesRun_examples = bitbucketCloudPipelinesRun_examples_cjs;
var pluginScaffolderNode$1 = require$$1;
var fetch$1 = require$$2;
var inputProperties = inputProperties_cjs;
var helpers$1 = helpers_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default$1 = /*#__PURE__*/_interopDefaultCompat$2(fetch$1);

const id = "bitbucket:pipelines:run";
const createBitbucketPipelinesRunAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$1.createTemplateAction({
    id,
    description: "Run a bitbucket cloud pipeline",
    examples: bitbucketCloudPipelinesRun_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["workspace", "repo_slug"],
        properties: {
          workspace: inputProperties.workspace,
          repo_slug: inputProperties.repo_slug,
          body: inputProperties.pipelinesRunBody,
          token: inputProperties.token
        }
      },
      output: {
        type: "object",
        properties: {
          buildNumber: {
            title: "Build number",
            type: "number"
          },
          repoUrl: {
            title: "A URL to the pipeline repositry",
            type: "string"
          },
          repoContentsUrl: {
            title: "A URL to the pipeline",
            type: "string"
          }
        }
      }
    },
    supportsDryRun: false,
    async handler(ctx) {
      const { workspace, repo_slug, body, token } = ctx.input;
      const host = "bitbucket.org";
      const integrationConfig = integrations.bitbucketCloud.byHost(host);
      const authorization = helpers$1.getAuthorizationHeader(
        token ? { token } : integrationConfig.config
      );
      let response;
      try {
        response = await fetch__default$1.default(
          `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo_slug}/pipelines`,
          {
            method: "POST",
            headers: {
              Authorization: authorization,
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body) ?? {}
          }
        );
      } catch (e) {
        throw new Error(`Unable to run pipeline, ${e}`);
      }
      if (response.status !== 201) {
        throw new Error(
          `Unable to run pipeline, ${response.status} ${response.statusText}, ${await response.text()}`
        );
      }
      const responseObject = await response.json();
      ctx.output("buildNumber", responseObject.build_number);
      ctx.output("repoUrl", responseObject.repository.links.html.href);
      ctx.output(
        "pipelinesUrl",
        `${responseObject.repository.links.html.href}/pipelines`
      );
    }
  });
};

bitbucketCloudPipelinesRun_cjs.createBitbucketPipelinesRunAction = createBitbucketPipelinesRunAction;

var bitbucketCloudPullRequest_cjs = {};

var bitbucketCloudPullRequest_examples_cjs = {};

var yaml = require$$0;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat$1(yaml);

const examples = [
  {
    description: "Creating pull request on bitbucket cloud with required fields",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketCloud:pull-request",
          id: "publish-bitbucket-cloud-pull-request-minimal",
          name: "Creating pull request on bitbucket cloud",
          input: {
            repoUrl: "bitbucket.org?workspace=workspace&project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket cloud with custom descriptions",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketCloud:pull-request",
          id: "publish-bitbucket-cloud-pull-request-minimal",
          name: "Creating pull request on bitbucket cloud",
          input: {
            repoUrl: "bitbucket.org?workspace=workspace&project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            description: "This is a detailed description of my pull request"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket cloud with different target branch",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketCloud:pull-request",
          id: "publish-bitbucket-cloud-pull-request-target-branch",
          name: "Creating pull request on bitbucket cloud",
          input: {
            repoUrl: "bitbucket.org?workspace=workspace&project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            targetBranch: "development"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket cloud with authorization token",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketCloud:pull-request",
          id: "publish-bitbucket-cloud-pull-request-minimal",
          name: "Creating pull request on bitbucket cloud",
          input: {
            repoUrl: "bitbucket.org?workspace=workspace&project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            token: "my-auth-token"
          }
        }
      ]
    })
  },
  {
    description: "Creating pull request on bitbucket cloud with all fields",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: "publish:bitbucketCloud:pull-request",
          id: "publish-bitbucket-cloud-pull-request-minimal",
          name: "Creating pull request on bitbucket cloud",
          input: {
            repoUrl: "bitbucket.org?workspace=workspace&project=project&repo=repo",
            title: "My pull request",
            sourceBranch: "my-feature-branch",
            targetBranch: "development",
            description: "This is a detailed description of my pull request",
            token: "my-auth-token",
            gitAuthorName: "test-user",
            gitAuthorEmail: "test-user@sample.com"
          }
        }
      ]
    })
  }
];

bitbucketCloudPullRequest_examples_cjs.examples = examples;

var errors$1 = require$$0$1;
var pluginScaffolderNode = require$$1;
var fetch = require$$2;
var fs = require$$3;
var helpers = helpers_cjs;
var bitbucketCloudPullRequest_examples = bitbucketCloudPullRequest_examples_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);
var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

const createPullRequest = async (opts) => {
  const {
    workspace,
    repo,
    title,
    description,
    targetBranch,
    sourceBranch,
    authorization,
    apiBaseUrl
  } = opts;
  let response;
  const data = {
    method: "POST",
    body: JSON.stringify({
      title,
      summary: {
        raw: description
      },
      state: "OPEN",
      source: {
        branch: {
          name: sourceBranch
        }
      },
      destination: {
        branch: {
          name: targetBranch
        }
      }
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(
      `${apiBaseUrl}/repositories/${workspace}/${repo}/pullrequests`,
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
  return r.links.html.href;
};
const findBranches = async (opts) => {
  const { workspace, repo, branchName, authorization, apiBaseUrl } = opts;
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
      `${apiBaseUrl}/repositories/${workspace}/${repo}/refs/branches?q=${encodeURIComponent(
        `name = "${branchName}"`
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
  return r.values[0];
};
const createBranch = async (opts) => {
  const {
    workspace,
    repo,
    branchName,
    authorization,
    apiBaseUrl,
    startBranch
  } = opts;
  let response;
  const options = {
    method: "POST",
    body: JSON.stringify({
      name: branchName,
      target: {
        hash: startBranch
      }
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  try {
    response = await fetch__default.default(
      `${apiBaseUrl}/repositories/${workspace}/${repo}/refs/branches`,
      options
    );
  } catch (e) {
    throw new Error(`Unable to create branch, ${e}`);
  }
  if (response.status !== 201) {
    throw new Error(
      `Unable to create branch, ${response.status} ${response.statusText}, ${await response.text()}`
    );
  }
  return await response.json();
};
const getDefaultBranch = async (opts) => {
  const { workspace, repo, authorization, apiBaseUrl } = opts;
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
      `${apiBaseUrl}/repositories/${workspace}/${repo}`,
      options
    );
  } catch (error) {
    throw error;
  }
  const { mainbranch } = await response.json();
  const defaultBranch = mainbranch.name;
  if (!defaultBranch) {
    throw new Error(`Could not fetch default branch for ${workspace}/${repo}`);
  }
  return defaultBranch;
};
function createPublishBitbucketCloudPullRequestAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "publish:bitbucketCloud:pull-request",
    examples: bitbucketCloudPullRequest_examples.examples,
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
          token: {
            title: "Authorization Token",
            type: "string",
            description: "The token to use for authorization to BitBucket Cloud"
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
        gitAuthorName,
        gitAuthorEmail
      } = ctx.input;
      const { workspace, repo, host } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      if (!workspace) {
        throw new errors$1.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing workspace`
        );
      }
      const integrationConfig = integrations.bitbucketCloud.byHost(host);
      if (!integrationConfig) {
        throw new errors$1.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      const authorization = helpers.getAuthorizationHeader(
        ctx.input.token ? { token: ctx.input.token } : integrationConfig.config
      );
      const apiBaseUrl = integrationConfig.config.apiBaseUrl;
      let finalTargetBranch = targetBranch;
      if (!finalTargetBranch) {
        finalTargetBranch = await getDefaultBranch({
          workspace,
          repo,
          authorization,
          apiBaseUrl
        });
      }
      const sourceBranchRef = await findBranches({
        workspace,
        repo,
        branchName: sourceBranch,
        authorization,
        apiBaseUrl
      });
      if (!sourceBranchRef) {
        ctx.logger.info(
          `source branch not found -> creating branch named: ${sourceBranch}`
        );
        await createBranch({
          workspace,
          repo,
          branchName: sourceBranch,
          authorization,
          apiBaseUrl,
          startBranch: finalTargetBranch
        });
        const remoteUrl = `https://${host}/${workspace}/${repo}.git`;
        let auth;
        if (ctx.input.token) {
          auth = {
            username: "x-token-auth",
            password: ctx.input.token
          };
        } else {
          if (!integrationConfig.config.username || !integrationConfig.config.appPassword) {
            throw new Error(
              "Credentials for Bitbucket Cloud integration required for this action."
            );
          }
          auth = {
            username: integrationConfig.config.username,
            password: integrationConfig.config.appPassword
          };
        }
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
        workspace,
        repo,
        title,
        description,
        targetBranch: finalTargetBranch,
        sourceBranch,
        authorization,
        apiBaseUrl
      });
      ctx.output("pullRequestUrl", pullRequestUrl);
    }
  });
}

bitbucketCloudPullRequest_cjs.createPublishBitbucketCloudPullRequestAction = createPublishBitbucketCloudPullRequestAction;

var module_cjs = {};

var autocomplete_cjs = {};

var errors = require$$0$1;
var pluginBitbucketCloudCommon = require$$1$1;

async function handleAutocompleteRequest({
  resource,
  token,
  context
}) {
  const client = pluginBitbucketCloudCommon.BitbucketCloudClient.fromConfig({
    host: "bitbucket.org",
    apiBaseUrl: "https://api.bitbucket.org/2.0",
    token
  });
  switch (resource) {
    case "workspaces": {
      const results = [];
      for await (const page of client.listWorkspaces().iteratePages()) {
        const slugs = [...page.values].map((p) => ({ title: p.slug }));
        results.push(...slugs);
      }
      return { results };
    }
    case "projects": {
      if (!context.workspace)
        throw new errors.InputError("Missing workspace context parameter");
      const results = [];
      for await (const page of client.listProjectsByWorkspace(context.workspace).iteratePages()) {
        const keys = [...page.values].map((p) => ({ title: p.key }));
        results.push(...keys);
      }
      return { results };
    }
    case "repositories": {
      if (!context.workspace || !context.project)
        throw new errors.InputError(
          "Missing workspace and/or project context parameter"
        );
      const results = [];
      for await (const page of client.listRepositoriesByWorkspace(context.workspace, {
        q: `project.key="${context.project}"`
      }).iteratePages()) {
        const slugs = [...page.values].map((p) => ({ title: p.slug }));
        results.push(...slugs);
      }
      return { results };
    }
    case "branches": {
      if (!context.workspace || !context.repository)
        throw new errors.InputError(
          "Missing workspace and/or repository context parameter"
        );
      const results = [];
      for await (const page of client.listBranchesByRepository(context.repository, context.workspace).iteratePages()) {
        const names = [...page.values].map((p) => ({ title: p.name }));
        results.push(...names);
      }
      return { results };
    }
    default:
      throw new errors.InputError(`Invalid resource: ${resource}`);
  }
}

autocomplete_cjs.handleAutocompleteRequest = handleAutocompleteRequest;

var backendPluginApi = require$$0$2;
var alpha = require$$1$2;
var bitbucketCloud$1 = bitbucketCloud_cjs;
var bitbucketCloudPipelinesRun$1 = bitbucketCloudPipelinesRun_cjs;
var bitbucketCloudPullRequest$1 = bitbucketCloudPullRequest_cjs;
var integration = require$$5;
var autocomplete = autocomplete_cjs;

const bitbucketCloudModule = backendPluginApi.createBackendModule({
  moduleId: "bitbucketCloud",
  pluginId: "scaffolder",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        autocomplete: alpha.scaffolderAutocompleteExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config, autocomplete: autocomplete$1 }) {
        const integrations = integration.ScmIntegrations.fromConfig(config);
        scaffolder.addActions(
          bitbucketCloud$1.createPublishBitbucketCloudAction({ integrations, config }),
          bitbucketCloudPipelinesRun$1.createBitbucketPipelinesRunAction({ integrations }),
          bitbucketCloudPullRequest$1.createPublishBitbucketCloudPullRequestAction({
            integrations,
            config
          })
        );
        autocomplete$1.addAutocompleteProvider({
          id: "bitbucket-cloud",
          handler: autocomplete.handleAutocompleteRequest
        });
      }
    });
  }
});

module_cjs.bitbucketCloudModule = bitbucketCloudModule;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var bitbucketCloud = bitbucketCloud_cjs;
var bitbucketCloudPipelinesRun = bitbucketCloudPipelinesRun_cjs;
var bitbucketCloudPullRequest = bitbucketCloudPullRequest_cjs;
var module$1 = module_cjs;



index_cjs.createPublishBitbucketCloudAction = bitbucketCloud.createPublishBitbucketCloudAction;
index_cjs.createBitbucketPipelinesRunAction = bitbucketCloudPipelinesRun.createBitbucketPipelinesRunAction;
index_cjs.createPublishBitbucketCloudPullRequestAction = bitbucketCloudPullRequest.createPublishBitbucketCloudPullRequestAction;
var _default = index_cjs.default = module$1.bitbucketCloudModule;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
