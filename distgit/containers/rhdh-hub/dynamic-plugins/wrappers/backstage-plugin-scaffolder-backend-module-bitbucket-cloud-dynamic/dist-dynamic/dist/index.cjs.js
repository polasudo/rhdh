'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/errors');
var require$$1 = require('@backstage/plugin-scaffolder-node');
var require$$2 = require('node-fetch');
var require$$3 = require('yaml');
var require$$4 = require('@backstage/backend-plugin-api');
var require$$5 = require('@backstage/plugin-scaffolder-node/alpha');
var require$$6 = require('@backstage/integration');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var errors = require$$0;
var pluginScaffolderNode = require$$1;
var fetch = require$$2;
var yaml = require$$3;
var backendPluginApi = require$$4;
var alpha = require$$5;
var integration = require$$6;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);
var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);

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
    response = await fetch__default.default(
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
  return pluginScaffolderNode.createTemplateAction({
    id: "publish:bitbucketCloud",
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
        repoVisibility = "private"
      } = ctx.input;
      const { workspace, project, repo, host } = pluginScaffolderNode.parseRepoUrl(
        repoUrl,
        integrations
      );
      if (!workspace) {
        throw new errors.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing workspace`
        );
      }
      if (!project) {
        throw new errors.InputError(
          `Invalid URL provider was included in the repo URL to create ${ctx.input.repoUrl}, missing project`
        );
      }
      const integrationConfig = integrations.bitbucketCloud.byHost(host);
      if (!integrationConfig) {
        throw new errors.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      const authorization = getAuthorizationHeader(
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
      const commitResult = await pluginScaffolderNode.initRepoAndPush({
        dir: pluginScaffolderNode.getRepoSourceDirectory(ctx.workspacePath, ctx.input.sourcePath),
        remoteUrl,
        auth,
        defaultBranch,
        logger: ctx.logger,
        commitMessage: config.getOptionalString(
          "scaffolder.defaultCommitMessage"
        ),
        gitAuthorInfo
      });
      ctx.output("commitHash", commitResult == null ? void 0 : commitResult.commitHash);
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
    }
  });
}

const examples = [
  {
    description: "Trigger a pipeline for a branch",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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

const id = "bitbucket:pipelines:run";
const createBitbucketPipelinesRunAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id,
    description: "Run a bitbucket cloud pipeline",
    examples,
    schema: {
      input: {
        type: "object",
        required: ["workspace", "repo_slug"],
        properties: {
          workspace: workspace,
          repo_slug: repo_slug,
          body: pipelinesRunBody,
          token: token
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
      var _a;
      const { workspace, repo_slug, body, token } = ctx.input;
      const host = "bitbucket.org";
      const integrationConfig = integrations.bitbucketCloud.byHost(host);
      const authorization = getAuthorizationHeader(
        token ? { token } : integrationConfig.config
      );
      let response;
      try {
        response = await fetch__default.default(
          `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo_slug}/pipelines`,
          {
            method: "POST",
            headers: {
              Authorization: authorization,
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: (_a = JSON.stringify(body)) != null ? _a : {}
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

const bitbucketCloudModule = backendPluginApi.createBackendModule({
  moduleId: "bitbucketCloud",
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
          createPublishBitbucketCloudAction({ integrations, config }),
          createBitbucketPipelinesRunAction({ integrations })
        );
      }
    });
  }
});

index_cjs.createBitbucketPipelinesRunAction = createBitbucketPipelinesRunAction;
index_cjs.createPublishBitbucketCloudAction = createPublishBitbucketCloudAction;
var _default = index_cjs.default = bitbucketCloudModule;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
