'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/errors');
var require$$1 = require('@backstage/plugin-scaffolder-node');
var require$$2 = require('@gitbeaker/node');
var require$$0 = require('yaml');
var require$$4 = require('zod');
var require$$1$1 = require('@gitbeaker/rest');
var require$$1$2 = require('path');
var require$$3 = require('@backstage/backend-plugin-api');
var require$$6 = require('crypto');
var require$$3$1 = require('luxon');
var require$$1$3 = require('@backstage/integration');
var require$$2$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var gitlab_cjs = {};

var gitlab_examples_cjs = {};

var yaml$9 = require$$0;

function _interopDefaultCompat$b (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$9 = /*#__PURE__*/_interopDefaultCompat$b(yaml$9);

const examples$9 = [
  {
    description: "Initializes a git repository with the content in the workspace, and publishes it to GitLab with the default configuration.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name"
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
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name",
            description: "Initialize a git repository"
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitLab repository with an initial commit message, if not set defaults to `initial commit`.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name",
            description: "Initialize a git repository",
            gitCommitMessage: "Started a project."
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitLab repository with aditional settings.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name",
            settings: {
              ci_config_path: ".gitlab-ci.yml",
              visibility: "public"
            }
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitLab repository with fast forward merge and always squash settings.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name",
            settings: {
              merge_method: "ff",
              squash_option: "always"
            }
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitLab repository with branch settings.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name",
            branches: [
              {
                name: "dev",
                create: true,
                protect: true,
                ref: "master"
              },
              {
                name: "master",
                protect: true
              }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitLab repository with environment variables.",
    example: yaml__default$9.default.stringify({
      steps: [
        {
          id: "publish",
          action: "publish:gitlab",
          name: "Publish to GitLab",
          input: {
            repoUrl: "gitlab.com?repo=project_name&owner=group_name",
            projectVariables: [
              {
                key: "key1",
                value: "value1",
                protected: true,
                masked: false
              },
              {
                key: "key2",
                value: "value2",
                protected: true,
                masked: false
              }
            ]
          }
        }
      ]
    })
  }
];

gitlab_examples_cjs.examples = examples$9;

var errors$9 = require$$0$1;
var pluginScaffolderNode$a = require$$1;
var node$2 = require$$2;
var gitlab_examples = gitlab_examples_cjs;

function createPublishGitlabAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode$a.createTemplateAction({
    id: "publish:gitlab",
    description: "Initializes a git repository of the content in the workspace, and publishes it to GitLab.",
    examples: gitlab_examples.examples,
    schema: {
      input: {
        type: "object",
        required: ["repoUrl"],
        properties: {
          repoUrl: {
            title: "Repository Location",
            type: "string",
            description: `Accepts the format 'gitlab.com?repo=project_name&owner=group_name' where 'project_name' is the repository name and 'group_name' is a group or username`
          },
          repoVisibility: {
            title: "Repository Visibility",
            description: `Sets the visibility of the repository. The default value is 'private'. (deprecated, use settings.visibility instead)`,
            type: "string",
            enum: ["private", "public", "internal"]
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
            description: "Path within the workspace that will be used as the repository root. If omitted, the entire workspace will be published as the repository.",
            type: "string"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to GitLab"
          },
          setUserAsOwner: {
            title: "Set User As Owner",
            type: "boolean",
            description: "Set the token user as owner of the newly created repository. Requires a token authorized to do the edit in the integration configuration for the matching host"
          },
          topics: {
            title: "Topic labels",
            description: "Topic labels to apply on the repository. (deprecated, use settings.topics instead)",
            type: "array",
            items: {
              type: "string"
            }
          },
          settings: {
            title: "Project settings",
            description: "Additional project settings, based on https://docs.gitlab.com/ee/api/projects.html#create-project attributes",
            type: "object",
            properties: {
              path: {
                title: "Project path",
                description: "Repository name for new project. Generated based on name if not provided (generated as lowercase with dashes).",
                type: "string"
              },
              auto_devops_enabled: {
                title: "Auto DevOps enabled",
                description: "Enable Auto DevOps for this project",
                type: "boolean"
              },
              ci_config_path: {
                title: "CI config path",
                description: "Custom CI config path for this project",
                type: "string"
              },
              description: {
                title: "Project description",
                description: "Short project description",
                type: "string"
              },
              merge_method: {
                title: "Merge Method to use",
                description: "Merge Methods (merge, rebase_merge, ff)",
                type: "string",
                enum: ["merge", "rebase_merge", "ff"]
              },
              squash_option: {
                title: "Squash option",
                description: "Set squash option for the project (never, always, default_on, default_off)",
                type: "string",
                enum: ["default_off", "default_on", "never", "always"]
              },
              topics: {
                title: "Topic labels",
                description: "Topic labels to apply on the repository",
                type: "array",
                items: {
                  type: "string"
                }
              },
              visibility: {
                title: "Project visibility",
                description: "The visibility of the project. Can be private, internal, or public. The default value is private.",
                type: "string",
                enum: ["private", "public", "internal"]
              }
            }
          },
          branches: {
            title: "Project branches settings",
            type: "array",
            items: {
              type: "object",
              required: ["name"],
              properties: {
                name: {
                  title: "Branch name",
                  type: "string"
                },
                protect: {
                  title: "Should branch be protected",
                  description: `Will mark branch as protected. The default value is 'false'`,
                  type: "boolean"
                },
                create: {
                  title: "Should branch be created",
                  description: `If branch does not exist, it will be created from provided ref. The default value is 'false'`,
                  type: "boolean"
                },
                ref: {
                  title: "Branch reference",
                  description: `Branch reference to create branch from. The default value is 'master'`,
                  type: "string"
                }
              }
            }
          },
          projectVariables: {
            title: "Project variables",
            description: "Project variables settings based on Gitlab Project Environments API - https://docs.gitlab.com/ee/api/project_level_variables.html#create-a-variable",
            type: "array",
            items: {
              type: "object",
              required: ["key", "value"],
              properties: {
                key: {
                  title: "Variable key",
                  description: "The key of a variable; must have no more than 255 characters; only A-Z, a-z, 0-9, and _ are allowed",
                  type: "string"
                },
                value: {
                  title: "Variable value",
                  description: "The value of a variable",
                  type: "string"
                },
                description: {
                  title: "Variable description",
                  description: `The description of the variable. The default value is 'null'`,
                  type: "string"
                },
                variable_type: {
                  title: "Variable type",
                  description: `The type of a variable. The default value is 'env_var'`,
                  type: "string",
                  enum: ["env_var", "file"]
                },
                protected: {
                  title: "Variable protection",
                  description: `Whether the variable is protected. The default value is 'false'`,
                  type: "boolean"
                },
                raw: {
                  title: "Variable raw",
                  description: `Whether the variable is in raw format. The default value is 'false'`,
                  type: "boolean"
                },
                environment_scope: {
                  title: "Variable environment scope",
                  description: `The environment_scope of the variable. The default value is '*'`,
                  type: "string"
                }
              }
            }
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
          projectId: {
            title: "The ID of the project",
            type: "number"
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
        repoVisibility = "private",
        defaultBranch = "master",
        gitCommitMessage = "initial commit",
        gitAuthorName,
        gitAuthorEmail,
        setUserAsOwner = false,
        topics = [],
        settings = {},
        branches = [],
        projectVariables = []
      } = ctx.input;
      const { owner, repo, host } = pluginScaffolderNode$a.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors$9.InputError(
          `No owner provided for host: ${host}, and repo ${repo}`
        );
      }
      const integrationConfig = integrations.gitlab.byHost(host);
      if (!integrationConfig) {
        throw new errors$9.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      if (!integrationConfig.config.token && !ctx.input.token) {
        throw new errors$9.InputError(`No token available for host ${host}`);
      }
      const token = ctx.input.token || integrationConfig.config.token;
      const tokenType = ctx.input.token ? "oauthToken" : "token";
      const client = new node$2.Gitlab({
        host: integrationConfig.config.baseUrl,
        [tokenType]: token
      });
      let targetNamespaceId;
      try {
        const namespaceResponse = await client.Namespaces.show(owner);
        targetNamespaceId = namespaceResponse.id;
      } catch (e) {
        if (e.response && e.response.statusCode === 404) {
          throw new errors$9.InputError(
            `The namespace ${owner} is not found or the user doesn't have permissions to access it`
          );
        }
        throw e;
      }
      const { id: userId } = await client.Users.current();
      if (!targetNamespaceId) {
        targetNamespaceId = userId;
      }
      const { id: projectId, http_url_to_repo } = await client.Projects.create({
        namespace_id: targetNamespaceId,
        name: repo,
        visibility: repoVisibility,
        ...topics.length ? { topics } : {},
        ...Object.keys(settings).length ? { ...settings } : {}
      });
      if (setUserAsOwner && integrationConfig.config.token) {
        const adminClient = new node$2.Gitlab({
          host: integrationConfig.config.baseUrl,
          token: integrationConfig.config.token
        });
        await adminClient.ProjectMembers.add(projectId, userId, 50);
      }
      const remoteUrl = http_url_to_repo.replace(/\.git$/, "");
      const repoContentsUrl = `${remoteUrl}/-/blob/${defaultBranch}`;
      const gitAuthorInfo = {
        name: gitAuthorName ? gitAuthorName : config.getOptionalString("scaffolder.defaultAuthor.name"),
        email: gitAuthorEmail ? gitAuthorEmail : config.getOptionalString("scaffolder.defaultAuthor.email")
      };
      const commitResult = await pluginScaffolderNode$a.initRepoAndPush({
        dir: pluginScaffolderNode$a.getRepoSourceDirectory(ctx.workspacePath, ctx.input.sourcePath),
        remoteUrl: http_url_to_repo,
        defaultBranch,
        auth: {
          username: "oauth2",
          password: token
        },
        logger: ctx.logger,
        commitMessage: gitCommitMessage ? gitCommitMessage : config.getOptionalString("scaffolder.defaultCommitMessage"),
        gitAuthorInfo
      });
      if (branches) {
        for (const branch of branches) {
          const {
            name,
            protect = false,
            create = false,
            ref = "master"
          } = branch;
          if (create) {
            try {
              await client.Branches.create(projectId, name, ref);
            } catch (e) {
              throw new errors$9.InputError(
                `Branch creation failed for ${name}. ${printGitlabError(e)}`
              );
            }
            ctx.logger.info(
              `Branch ${name} created for ${projectId} with ref ${ref}`
            );
          }
          if (protect) {
            try {
              await client.ProtectedBranches.protect(projectId, name);
            } catch (e) {
              throw new errors$9.InputError(
                `Branch protection failed for ${name}. ${printGitlabError(e)}`
              );
            }
            ctx.logger.info(`Branch ${name} protected for ${projectId}`);
          }
        }
      }
      if (projectVariables) {
        for (const variable of projectVariables) {
          const variableWithDefaults = Object.assign(variable, {
            variable_type: variable.variable_type ?? "env_var",
            protected: variable.protected ?? false,
            masked: variable.masked ?? false,
            raw: variable.raw ?? false,
            environment_scope: variable.environment_scope ?? "*"
          });
          try {
            await client.ProjectVariables.create(
              projectId,
              variableWithDefaults
            );
          } catch (e) {
            throw new errors$9.InputError(
              `Environment variable creation failed for ${variableWithDefaults.key}. ${printGitlabError(e)}`
            );
          }
        }
      }
      ctx.output("commitHash", commitResult?.commitHash);
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
      ctx.output("projectId", projectId);
    }
  });
}
function printGitlabError(error) {
  return JSON.stringify({ code: error.code, message: error.description });
}

gitlab_cjs.createPublishGitlabAction = createPublishGitlabAction;

var gitlabGroupEnsureExists_cjs = {};

var commonGitlabConfig_cjs = {};

Object.defineProperty(commonGitlabConfig_cjs, '__esModule', { value: true });

var zod$7 = require$$4;

const commonGitlabConfig$a = zod$7.z.object({
  repoUrl: zod$7.z.string({ description: "Repository Location" }),
  token: zod$7.z.string({ description: "The token to use for authorization to GitLab" }).optional()
});
const commonGitlabConfigExample = {
  repoUrl: "gitlab.com?owner=namespace-or-owner&repo=project-name",
  token: "${{ secrets.USER_OAUTH_TOKEN }}"
};
var IssueType = /* @__PURE__ */ ((IssueType2) => {
  IssueType2["ISSUE"] = "issue";
  IssueType2["INCIDENT"] = "incident";
  IssueType2["TEST"] = "test_case";
  IssueType2["TASK"] = "task";
  return IssueType2;
})(IssueType || {});
var IssueStateEvent = /* @__PURE__ */ ((IssueStateEvent2) => {
  IssueStateEvent2["CLOSE"] = "close";
  IssueStateEvent2["REOPEN"] = "reopen";
  return IssueStateEvent2;
})(IssueStateEvent || {});

commonGitlabConfig_cjs.IssueStateEvent = IssueStateEvent;
commonGitlabConfig_cjs.IssueType = IssueType;
commonGitlabConfig_cjs.commonGitlabConfigExample = commonGitlabConfigExample;
commonGitlabConfig_cjs.default = commonGitlabConfig$a;

var util_cjs = {};

var errors$8 = require$$0$1;
var rest$1 = require$$1$1;

const parseRepoHost = (repoUrl) => {
  let parsed;
  try {
    parsed = new URL(`https://${repoUrl}`);
  } catch (error) {
    throw new errors$8.InputError(
      `Invalid repo URL passed to publisher, got ${repoUrl}, ${error}`
    );
  }
  return parsed.host;
};
const getToken = (config, integrations) => {
  const host = parseRepoHost(config.repoUrl);
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors$8.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  const token = config.token || integrationConfig.config.token;
  return { token, integrationConfig };
};
const parseRepoUrl = (repoUrl, integrations) => {
  let parsed;
  try {
    parsed = new URL(`https://${repoUrl}`);
  } catch (error) {
    throw new errors$8.InputError(
      `Invalid repo URL passed to publisher, got ${repoUrl}, ${error}`
    );
  }
  const host = parsed.host;
  const owner = parsed.searchParams.get("owner") ?? void 0;
  const repo = parsed.searchParams.get("repo");
  const type = integrations.byHost(host)?.type;
  if (!type) {
    throw new errors$8.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  return { host, owner, repo };
};
function getClient(props) {
  const { host, token, integrations } = props;
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors$8.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  const { config } = integrationConfig;
  if (!config.token && !token) {
    throw new errors$8.InputError(`No token available for host ${host}`);
  }
  const requestToken = token || config.token;
  const tokenType = token ? "oauthToken" : "token";
  const gitlabOptions = {
    host: config.baseUrl
  };
  gitlabOptions[tokenType] = requestToken;
  return new rest$1.Gitlab(gitlabOptions);
}
function convertDate(inputDate, defaultDate) {
  try {
    return inputDate ? new Date(inputDate).toISOString() : new Date(defaultDate).toISOString();
  } catch (error) {
    throw new errors$8.InputError(`Error converting input date - ${error}`);
  }
}
async function getTopLevelParentGroup(client, groupId) {
  try {
    const topParentGroup = await client.Groups.show(groupId);
    if (topParentGroup.parent_id) {
      return getTopLevelParentGroup(
        client,
        topParentGroup.parent_id
      );
    }
    return topParentGroup;
  } catch (error) {
    throw new errors$8.InputError(
      `Error finding top-level parent group ID: ${error.message}`
    );
  }
}
async function checkEpicScope(client, projectId, epicId) {
  try {
    const project = await client.Projects.show(projectId);
    if (!project) {
      throw new errors$8.InputError(
        `Project with id ${projectId} not found. Check your GitLab instance.`
      );
    }
    const topParentGroup = await getTopLevelParentGroup(
      client,
      project.namespace.id
    );
    if (!topParentGroup) {
      throw new errors$8.InputError(`Couldn't find a suitable top-level parent group.`);
    }
    const epic = (await client.Epics.all(topParentGroup.id)).find(
      (x) => x.id === epicId
    );
    if (!epic) {
      throw new errors$8.InputError(
        `Epic with id ${epicId} not found in the top-level parent group ${topParentGroup.name}.`
      );
    }
    const epicGroup = await client.Groups.show(epic.group_id);
    const projectNamespace = project.path_with_namespace;
    return projectNamespace.startsWith(epicGroup.full_path);
  } catch (error) {
    throw new errors$8.InputError(`Could not find epic scope: ${error.message}`);
  }
}

util_cjs.checkEpicScope = checkEpicScope;
util_cjs.convertDate = convertDate;
util_cjs.getClient = getClient;
util_cjs.getToken = getToken;
util_cjs.getTopLevelParentGroup = getTopLevelParentGroup;
util_cjs.parseRepoHost = parseRepoHost;
util_cjs.parseRepoUrl = parseRepoUrl;

var gitlabGroupEnsureExists_examples_cjs = {};

var yaml$8 = require$$0;

function _interopDefaultCompat$a (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$8 = /*#__PURE__*/_interopDefaultCompat$a(yaml$8);

const examples$8 = [
  {
    description: "Creating a group at the top level",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          id: "gitlabGroup",
          name: "Group",
          action: "gitlab:group:ensureExists",
          input: {
            repoUrl: "gitlab.com",
            path: ["group1"]
          }
        }
      ]
    })
  },
  {
    description: "Create a group nested within another group",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          id: "gitlabGroup",
          name: "Group",
          action: "gitlab:group:ensureExists",
          input: {
            repoUrl: "gitlab.com",
            path: ["group1", "group2"]
          }
        }
      ]
    })
  },
  {
    description: "Create a group nested within multiple other groups",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          id: "gitlabGroup",
          name: "Group",
          action: "gitlab:group:ensureExists",
          input: {
            repoUrl: "gitlab.com",
            path: ["group1", "group2", "group3"]
          }
        }
      ]
    })
  },
  {
    description: "Create a group in dry run mode",
    example: yaml__default$8.default.stringify({
      steps: [
        {
          id: "gitlabGroup",
          name: "Group",
          action: "gitlab:group:ensureExists",
          isDryRun: true,
          input: {
            repoUrl: "https://gitlab.com/my-repo",
            path: ["group1", "group2", "group3"]
          }
        }
      ]
    })
  }
];

gitlabGroupEnsureExists_examples_cjs.examples = examples$8;

var pluginScaffolderNode$9 = require$$1;
var zod$6 = require$$4;
var commonGitlabConfig$9 = commonGitlabConfig_cjs;
var util$6 = util_cjs;
var gitlabGroupEnsureExists_examples = gitlabGroupEnsureExists_examples_cjs;

const createGitlabGroupEnsureExistsAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$9.createTemplateAction({
    id: "gitlab:group:ensureExists",
    description: "Ensures a Gitlab group exists",
    supportsDryRun: true,
    examples: gitlabGroupEnsureExists_examples.examples,
    schema: {
      input: commonGitlabConfig$9.default.merge(
        zod$6.z.object({
          path: zod$6.z.array(zod$6.z.string(), {
            description: "A path of group names that is ensured to exist"
          }).min(1)
        })
      ),
      output: zod$6.z.object({
        groupId: zod$6.z.number({ description: "The id of the innermost sub-group" }).optional()
      })
    },
    async handler(ctx) {
      if (ctx.isDryRun) {
        ctx.output("groupId", 42);
        return;
      }
      const { token, repoUrl, path } = ctx.input;
      const { host } = util$6.parseRepoUrl(repoUrl, integrations);
      const api = util$6.getClient({ host, integrations, token });
      let currentPath = null;
      let parentId = null;
      for (const pathElement of path) {
        const fullPath = currentPath ? `${currentPath}/${pathElement}` : pathElement;
        const result = await api.Groups.search(
          fullPath
        );
        const subGroup = result.find(
          (searchPathElem) => searchPathElem.full_path === fullPath
        );
        if (!subGroup) {
          ctx.logger.info(`creating missing group ${fullPath}`);
          parentId = (await api.Groups.create(
            pathElement,
            pathElement,
            parentId ? {
              parentId
            } : {}
          ))?.id;
        } else {
          parentId = subGroup.id;
        }
        currentPath = fullPath;
      }
      if (parentId !== null) {
        ctx.output("groupId", parentId);
      }
    }
  });
};

gitlabGroupEnsureExists_cjs.createGitlabGroupEnsureExistsAction = createGitlabGroupEnsureExistsAction;

var gitlabIssueCreate_cjs = {};

var gitlabIssueCreate_examples_cjs = {};

var yaml$7 = require$$0;
var commonGitlabConfig$8 = commonGitlabConfig_cjs;

function _interopDefaultCompat$9 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$7 = /*#__PURE__*/_interopDefaultCompat$9(yaml$7);

const examples$7 = [
  {
    description: "Create a GitLab issue with minimal options",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            description: "This is the description of the issue"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue with assignees and date options",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            assignees: [18],
            description: "This is the description of the issue",
            createdAt: "2022-09-27T18:00:00.000Z",
            dueDate: "2022-09-28T12:00:00.000Z"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab Issue with several options",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            assignees: [18, 15],
            description: "This is the description of the issue",
            confidential: false,
            createdAt: "2022-09-27T18:00:00.000Z",
            dueDate: "2022-09-28T12:00:00.000Z",
            discussionToResolve: "1",
            epicId: 1,
            labels: "phase1:label1,phase2:label2"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue with token",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            description: "This is the description of the issue",
            token: "sample token"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue with a specific milestone and weight",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue with Milestone",
            description: "This is the description of the issue",
            milestoneId: 5,
            weight: 3
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue of type INCIDENT",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Confidential Test Issue",
            description: "This is the description of the issue",
            issueType: "incident"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue of type TEST",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Confidential Test Issue",
            description: "This is the description of the issue",
            issueType: "test_case"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue of type TASK with assignees",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Confidential Test Issue",
            description: "This is the description of the issue",
            issueType: "task",
            assignees: [18, 22]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue of type ISSUE and close it",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Confidential Test Issue",
            description: "This is the description of the issue",
            issueType: "issue",
            stateEvent: "close"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue of type INCIDENT and reopen it",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Confidential Test Issue",
            description: "This is the description of the issue",
            issueType: "incident",
            stateEvent: "reopen"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab issue to resolve a discussion in a merge request",
    example: yaml__default$7.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfig$8.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue for MR Discussion",
            description: "This is the description of the issue",
            mergeRequestToResolveDiscussionsOf: 42,
            discussionToResolve: "abc123"
          }
        }
      ]
    })
  }
];

gitlabIssueCreate_examples_cjs.examples = examples$7;

var errors$7 = require$$0$1;
var pluginScaffolderNode$8 = require$$1;
var commonGitlabConfig$7 = commonGitlabConfig_cjs;
var gitlabIssueCreate_examples = gitlabIssueCreate_examples_cjs;
var zod$5 = require$$4;
var util$5 = util_cjs;

const issueInputProperties = zod$5.z.object({
  projectId: zod$5.z.number().describe("Project Id"),
  title: zod$5.z.string({ description: "Title of the issue" }),
  assignees: zod$5.z.array(zod$5.z.number(), {
    description: "IDs of the users to assign the issue to."
  }).optional(),
  confidential: zod$5.z.boolean({ description: "Issue Confidentiality" }).optional(),
  description: zod$5.z.string().describe("Issue description").max(1048576).optional(),
  createdAt: zod$5.z.string().describe("Creation date/time").regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ"
  ).optional(),
  dueDate: zod$5.z.string().describe("Due date/time").regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ"
  ).optional(),
  discussionToResolve: zod$5.z.string({
    description: 'Id of a discussion to resolve. Use in combination with "merge_request_to_resolve_discussions_of"'
  }).optional(),
  epicId: zod$5.z.number({ description: "Id of the linked Epic" }).min(0, "Valid values should be equal or greater than zero").optional(),
  labels: zod$5.z.string({ description: "Labels to apply" }).optional(),
  issueType: zod$5.z.nativeEnum(commonGitlabConfig$7.IssueType, {
    description: "Type of the issue"
  }).optional(),
  mergeRequestToResolveDiscussionsOf: zod$5.z.number({
    description: "IID of a merge request in which to resolve all issues"
  }).optional(),
  milestoneId: zod$5.z.number({ description: "Global ID of a milestone to assign the issue" }).optional(),
  weight: zod$5.z.number({ description: "The issue weight" }).min(0).refine((value) => {
    const isValid = value >= 0;
    if (!isValid) {
      return {
        message: "Valid values should be equal or greater than zero"
      };
    }
    return isValid;
  }).optional()
});
const issueOutputProperties = zod$5.z.object({
  issueUrl: zod$5.z.string({ description: "Issue Url" }),
  issueId: zod$5.z.number({ description: "Issue Id" }),
  issueIid: zod$5.z.number({ description: "Issue Iid" })
});
const createGitlabIssueAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$8.createTemplateAction({
    id: "gitlab:issues:create",
    description: "Creates a Gitlab issue.",
    examples: gitlabIssueCreate_examples.examples,
    schema: {
      input: commonGitlabConfig$7.default.merge(issueInputProperties),
      output: issueOutputProperties
    },
    async handler(ctx) {
      try {
        const {
          repoUrl,
          projectId,
          title,
          description = "",
          confidential = false,
          assignees = [],
          createdAt = "",
          dueDate,
          discussionToResolve = "",
          epicId,
          labels = "",
          issueType,
          mergeRequestToResolveDiscussionsOf,
          milestoneId,
          weight,
          token
        } = commonGitlabConfig$7.default.merge(issueInputProperties).parse(ctx.input);
        const { host } = util$5.parseRepoUrl(repoUrl, integrations);
        const api = util$5.getClient({ host, integrations, token });
        let isEpicScoped = false;
        if (epicId) {
          isEpicScoped = await util$5.checkEpicScope(api, projectId, epicId);
          if (isEpicScoped) {
            ctx.logger.info("Epic is within Project Scope");
          } else {
            ctx.logger.warn(
              "Chosen epic is not within the Project Scope. The issue will be created without an associated epic."
            );
          }
        }
        const mappedCreatedAt = util$5.convertDate(
          String(createdAt),
          (/* @__PURE__ */ new Date()).toISOString()
        );
        const mappedDueDate = dueDate ? util$5.convertDate(String(dueDate), (/* @__PURE__ */ new Date()).toISOString()) : void 0;
        const issueOptions = {
          description,
          assigneeIds: assignees,
          confidential,
          epicId: isEpicScoped ? epicId : void 0,
          labels,
          createdAt: mappedCreatedAt,
          dueDate: mappedDueDate,
          discussionToResolve,
          issueType,
          mergeRequestToResolveDiscussionsOf,
          milestoneId,
          weight
        };
        const response = await api.Issues.create(
          projectId,
          title,
          issueOptions
        );
        ctx.output("issueId", response.id);
        ctx.output("issueUrl", response.web_url);
        ctx.output("issueIid", response.iid);
      } catch (error) {
        if (error instanceof zod$5.z.ZodError) {
          throw new errors$7.InputError(`Validation error: ${error.message}`, {
            validationErrors: error.errors
          });
        }
        throw new errors$7.InputError(`Failed to create GitLab issue: ${error.message}`);
      }
    }
  });
};

gitlabIssueCreate_cjs.createGitlabIssueAction = createGitlabIssueAction;

var gitlabIssueEdit_cjs = {};

var gitlabIssueEdit_examples_cjs = {};

var yaml$6 = require$$0;
var commonGitlabConfig$6 = commonGitlabConfig_cjs;

function _interopDefaultCompat$8 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$6 = /*#__PURE__*/_interopDefaultCompat$8(yaml$6);

const examples$6 = [
  {
    description: "Edit a GitLab issue with minimal options",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Modified Test Issue",
            description: "This is a modified description of the issue"
          }
        }
      ]
    })
  },
  {
    description: "Edit a GitLab issue with assignees and date options",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            assignees: [18],
            description: "This is the edited description of the issue",
            updatedAt: "2024-05-10T18:00:00.000Z",
            dueDate: "2024-09-28"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab Issue with several options",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Test Edit Issue",
            assignees: [18, 15],
            description: "This is the description of the issue",
            confidential: false,
            updatedAt: "2024-05-10T18:00:00.000Z",
            dueDate: "2024-09-28",
            discussionLocked: true,
            epicId: 1,
            labels: "phase1:label1,phase2:label2"
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to change  its state to close",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            stateEvent: "close"
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to change  its state to reopened",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            stateEvent: "reopen"
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to assign it to multiple users and set milestone",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Test issue with milestone",
            assignees: [18, 20],
            description: "This issue has milestone set",
            milestoneId: 5
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to add weight and update labels",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Issue with weight and labels",
            description: "This issue has weight and new labels",
            weight: 3,
            labels: "bug,urgent"
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to make it confidential",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Confidential Issue",
            description: "This issue is confidential",
            confidential: true
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to lock the discussion",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Locked Discussion Issue",
            description: "This discussion on this issue is locked",
            discussionLocked: true
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to remove labels and update milestone",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Issue with labels removed and milestone updated",
            description: "This issue has labels removed and milestone updated",
            removeLabels: "phase1:label1",
            milestoneId: 6
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to remove some labels and new ones",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Issue with labels updated",
            description: "This issue has labels removed and new ones added",
            removeLabels: "bug,urgent",
            labels: "enhancement:documentation"
          }
        }
      ]
    })
  },
  {
    description: "Edit a gitlab issue to change issue type and add labels",
    example: yaml__default$6.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "EditIssues",
          action: "gitlab:issue:edit",
          input: {
            ...commonGitlabConfig$6.commonGitlabConfigExample,
            projectId: 12,
            title: "Issue with type and labels",
            description: "This issue has been changes and new labels added",
            labels: "task,high-priority",
            issueType: "task"
          }
        }
      ]
    })
  }
];

gitlabIssueEdit_examples_cjs.examples = examples$6;

var errors$6 = require$$0$1;
var pluginScaffolderNode$7 = require$$1;
var commonGitlabConfig$5 = commonGitlabConfig_cjs;
var gitlabIssueEdit_examples = gitlabIssueEdit_examples_cjs;
var zod$4 = require$$4;
var util$4 = util_cjs;

const editIssueInputProperties = zod$4.z.object({
  projectId: zod$4.z.number().describe(
    "The global ID or URL-encoded path of the project owned by the authenticated user."
  ),
  issueIid: zod$4.z.number().describe("The internal ID of a project's issue"),
  addLabels: zod$4.z.string({
    description: "Comma-separated label names to add to an issue. If a label does not already exist, this creates a new project label and assigns it to the issue."
  }).optional(),
  assignees: zod$4.z.array(zod$4.z.number(), {
    description: "IDs of the users to assign the issue to."
  }).optional(),
  confidential: zod$4.z.boolean({ description: "Updates an issue to be confidential." }).optional(),
  description: zod$4.z.string().describe("The description of an issue. Limited to 1,048,576 characters.").max(1048576).optional(),
  discussionLocked: zod$4.z.boolean({
    description: "Flag indicating if the issue\u2019s discussion is locked. If the discussion is locked only project members can add or edit comments."
  }).optional(),
  dueDate: zod$4.z.string().describe(
    "The due date. Date time string in the format YYYY-MM-DD, for example 2016-03-11."
  ).regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD").optional(),
  epicId: zod$4.z.number({
    description: "ID of the epic to add the issue to. Valid values are greater than or equal to 0."
  }).min(0, "Valid values should be equal or greater than zero").optional(),
  issueType: zod$4.z.nativeEnum(commonGitlabConfig$5.IssueType, {
    description: "Updates the type of issue. One of issue, incident, test_case or task."
  }).optional(),
  labels: zod$4.z.string({
    description: "Comma-separated label names for an issue. Set to an empty string to unassign all labels. If a label does not already exist, this creates a new project label and assigns it to the issue."
  }).optional(),
  milestoneId: zod$4.z.number({
    description: "The global ID of a milestone to assign the issue to. Set to 0 or provide an empty value to unassign a milestone"
  }).optional(),
  removeLabels: zod$4.z.string({
    description: "Comma-separated label names to remove from an issue."
  }).optional(),
  stateEvent: zod$4.z.nativeEnum(commonGitlabConfig$5.IssueStateEvent, {
    description: "The state event of an issue. To close the issue, use close, and to reopen it, use reopen."
  }).optional(),
  title: zod$4.z.string().describe("The title of an issue.").optional(),
  updatedAt: zod$4.z.string().describe(
    "When the issue was updated. Date time string, ISO 8601 formatted"
  ).regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ"
  ).optional(),
  weight: zod$4.z.number({ description: "The issue weight" }).min(0, "Valid values should be equal or greater than zero").max(10, "Valid values should be equal or less than 10").optional()
});
const editIssueOutputProperties = zod$4.z.object({
  issueUrl: zod$4.z.string({ description: "Issue WebUrl" }),
  projectId: zod$4.z.number({
    description: "The project id the issue belongs to WebUrl"
  }),
  issueId: zod$4.z.number({ description: "The issues Id" }),
  issueIid: zod$4.z.number({
    description: "The issues internal ID of a project's issue"
  }),
  state: zod$4.z.string({ description: "The state event of an issue" }),
  title: zod$4.z.string({ description: "The title of an issue." }),
  updatedAt: zod$4.z.string({ description: "The last updated time of the issue." })
});
const editGitlabIssueAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$7.createTemplateAction({
    id: "gitlab:issue:edit",
    description: "Edit a Gitlab issue.",
    examples: gitlabIssueEdit_examples.examples,
    schema: {
      input: commonGitlabConfig$5.default.merge(editIssueInputProperties),
      output: editIssueOutputProperties
    },
    async handler(ctx) {
      try {
        const {
          repoUrl,
          projectId,
          title,
          addLabels,
          removeLabels,
          issueIid,
          description,
          confidential = false,
          assignees = [],
          updatedAt = "",
          dueDate,
          discussionLocked = false,
          epicId,
          labels,
          issueType,
          milestoneId,
          stateEvent,
          weight,
          token
        } = commonGitlabConfig$5.default.merge(editIssueInputProperties).parse(ctx.input);
        const { host } = util$4.parseRepoUrl(repoUrl, integrations);
        const api = util$4.getClient({ host, integrations, token });
        let isEpicScoped = false;
        if (epicId) {
          isEpicScoped = await util$4.checkEpicScope(api, projectId, epicId);
          if (isEpicScoped) {
            ctx.logger.info("Epic is within Project Scope");
          } else {
            ctx.logger.warn(
              "Chosen epic is not within the Project Scope. The issue will be created without an associated epic."
            );
          }
        }
        const mappedUpdatedAt = util$4.convertDate(
          String(updatedAt),
          (/* @__PURE__ */ new Date()).toISOString()
        );
        const editIssueOptions = {
          addLabels,
          assigneeIds: assignees,
          confidential,
          description,
          discussionLocked,
          dueDate,
          epicId: isEpicScoped ? epicId : void 0,
          issueType,
          labels,
          milestoneId,
          removeLabels,
          stateEvent,
          title,
          updatedAt: mappedUpdatedAt,
          weight
        };
        const response = await api.Issues.edit(
          projectId,
          issueIid,
          editIssueOptions
        );
        ctx.output("issueId", response.id);
        ctx.output("projectId", response.project_id);
        ctx.output("issueUrl", response.web_url);
        ctx.output("issueIid", response.iid);
        ctx.output("title", response.title);
        ctx.output("state", response.state);
        ctx.output("updatedAt", response.updated_at);
      } catch (error) {
        if (error instanceof zod$4.z.ZodError) {
          throw new errors$6.InputError(`Validation error: ${error.message}`, {
            validationErrors: error.errors
          });
        }
        throw new errors$6.InputError(
          `Failed to edit/modify GitLab issue: ${error.message}`
        );
      }
    }
  });
};

gitlabIssueEdit_cjs.editGitlabIssueAction = editGitlabIssueAction;

var gitlabMergeRequest_cjs = {};

var helpers_cjs = {};

var pluginScaffolderNode$6 = require$$1;
var errors$5 = require$$0$1;
var node$1 = require$$2;

function createGitlabApi(options) {
  const { integrations, token: providedToken, repoUrl } = options;
  const { host } = pluginScaffolderNode$6.parseRepoUrl(repoUrl, integrations);
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors$5.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  if (!integrationConfig.config.token && !providedToken) {
    throw new errors$5.InputError(`No token available for host ${host}`);
  }
  const token = providedToken ?? integrationConfig.config.token;
  const tokenType = providedToken ? "oauthToken" : "token";
  return new node$1.Gitlab({
    host: integrationConfig.config.baseUrl,
    [tokenType]: token
  });
}

helpers_cjs.createGitlabApi = createGitlabApi;

var gitlabMergeRequest_examples_cjs = {};

var yaml$5 = require$$0;

function _interopDefaultCompat$7 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$5 = /*#__PURE__*/_interopDefaultCompat$7(yaml$5);

const examples$5 = [
  {
    description: "Create a merge request with a specific assignee",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createMergeRequest",
          action: "publish:gitlab:merge-request",
          name: "Create a Merge Request",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            title: "Create my new MR",
            description: "This MR is really good",
            sourcePath: "./path/to/my/changes",
            branchName: "new-mr",
            assignee: "my-assignee"
          }
        }
      ]
    })
  },
  {
    description: "Create a merge request with removal of source branch after merge",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createMergeRequest",
          action: "publish:gitlab:merge-request",
          name: "Create a Merge Request",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            title: "Create my new MR",
            description: "This MR is really good",
            sourcePath: "./path/to/my/changes",
            branchName: "new-mr",
            removeSourceBranch: true
          }
        }
      ]
    })
  },
  {
    description: "Create a merge request with a target branch",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createMergeRequest",
          action: "publish:gitlab:merge-request",
          name: "Create a Merge Request",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            title: "Create my new MR",
            description: "This MR is really good",
            sourcePath: "./path/to/my/changes",
            branchName: "new-mr",
            targetBranchName: "test",
            targetPath: "Subdirectory"
          }
        }
      ]
    })
  },
  {
    description: "Create a merge request with a commit action as create",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createMergeRequest",
          action: "publish:gitlab:merge-request",
          name: "Create a Merge Request",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            title: "Create my new MR",
            branchName: "new-mr",
            description: "MR description",
            commitAction: "create",
            targetPath: "source"
          }
        }
      ]
    })
  },
  {
    description: "Create a merge request with a commit action as delete",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createMergeRequest",
          action: "publish:gitlab:merge-request",
          name: "Create a Merge Request",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            title: "Create my new MR",
            branchName: "new-mr",
            description: "MR description",
            commitAction: "delete",
            targetPath: "source"
          }
        }
      ]
    })
  },
  {
    description: "Create a merge request with a commit action as update",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createMergeRequest",
          action: "publish:gitlab:merge-request",
          name: "Create a Merge Request",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            title: "Create my new MR",
            branchName: "new-mr",
            description: "MR description",
            commitAction: "update",
            targetPath: "source"
          }
        }
      ]
    })
  }
];

gitlabMergeRequest_examples_cjs.examples = examples$5;

var pluginScaffolderNode$5 = require$$1;
var path$1 = require$$1$2;
var errors$4 = require$$0$1;
var backendPluginApi$2 = require$$3;
var helpers$1 = helpers_cjs;
var gitlabMergeRequest_examples = gitlabMergeRequest_examples_cjs;
var crypto = require$$6;

function _interopDefaultCompat$6 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var path__default$1 = /*#__PURE__*/_interopDefaultCompat$6(path$1);

function computeSha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(file.content);
  return hash.digest("hex");
}
async function getFileAction(fileInfo, target, api, logger, remoteFiles, defaultCommitAction = "auto") {
  if (defaultCommitAction === "auto") {
    const filePath = path__default$1.default.join(fileInfo.targetPath ?? "", fileInfo.file.path);
    if (remoteFiles?.some((remoteFile) => remoteFile.path === filePath)) {
      try {
        const targetFile = await api.RepositoryFiles.show(
          target.repoID,
          filePath,
          target.branch
        );
        if (computeSha256(fileInfo.file) === targetFile.content_sha256) {
          return "skip";
        }
      } catch (error) {
        logger.warn(
          `Unable to retrieve detailed information for remote file ${filePath}`
        );
      }
      return "update";
    }
    return "create";
  }
  return defaultCommitAction;
}
const createPublishGitlabMergeRequestAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$5.createTemplateAction({
    id: "publish:gitlab:merge-request",
    examples: gitlabMergeRequest_examples.examples,
    schema: {
      input: {
        required: ["repoUrl", "branchName"],
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            title: "Repository Location",
            description: `Accepts the format 'gitlab.com?repo=project_name&owner=group_name' where 'project_name' is the repository name and 'group_name' is a group or username`
          },
          /** @deprecated projectID is passed as query parameters in the repoUrl */
          projectid: {
            type: "string",
            title: "projectid",
            description: "Project ID/Name(slug) of the Gitlab Project"
          },
          title: {
            type: "string",
            title: "Merge Request Name",
            description: "The name for the merge request"
          },
          description: {
            type: "string",
            title: "Merge Request Description",
            description: "The description of the merge request"
          },
          branchName: {
            type: "string",
            title: "Source Branch Name",
            description: "The source branch name of the merge request"
          },
          targetBranchName: {
            type: "string",
            title: "Target Branch Name",
            description: "The target branch name of the merge request"
          },
          sourcePath: {
            type: "string",
            title: "Working Subdirectory",
            description: `Subdirectory of working directory to copy changes from. For reasons of backward compatibility, any specified 'targetPath' input will be applied in place of an absent/falsy value for this input. Circumvent this behavior using '.'`
          },
          targetPath: {
            type: "string",
            title: "Repository Subdirectory",
            description: "Subdirectory of repository to apply changes to"
          },
          token: {
            title: "Authentication Token",
            type: "string",
            description: "The token to use for authorization to GitLab"
          },
          commitAction: {
            title: "Commit action",
            type: "string",
            enum: ["create", "update", "delete", "auto"],
            description: `The action to be used for git commit. Defaults to the custom 'auto' action provided by backstage,
which uses additional API calls in order to detect whether to 'create', 'update' or 'skip' each source file.`
          },
          removeSourceBranch: {
            title: "Delete source branch",
            type: "boolean",
            description: "Option to delete source branch once the MR has been merged. Default: false"
          },
          assignee: {
            title: "Merge Request Assignee",
            type: "string",
            description: "User this merge request will be assigned to"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          targetBranchName: {
            title: "Target branch name of the merge request",
            type: "string"
          },
          projectid: {
            title: "Gitlab Project id/Name(slug)",
            type: "string"
          },
          projectPath: {
            title: "Gitlab Project path",
            type: "string"
          },
          mergeRequestUrl: {
            title: "MergeRequest(MR) URL",
            type: "string",
            description: "Link to the merge request in GitLab"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        assignee,
        branchName,
        targetBranchName,
        description,
        repoUrl,
        removeSourceBranch,
        targetPath,
        sourcePath,
        title,
        token
      } = ctx.input;
      const { owner, repo, project } = pluginScaffolderNode$5.parseRepoUrl(repoUrl, integrations);
      const repoID = project ? project : `${owner}/${repo}`;
      const api = helpers$1.createGitlabApi({
        integrations,
        token,
        repoUrl
      });
      let assigneeId = void 0;
      if (assignee !== void 0) {
        try {
          const assigneeUser = await api.Users.username(assignee);
          assigneeId = assigneeUser[0].id;
        } catch (e) {
          ctx.logger.warn(
            `Failed to find gitlab user id for ${assignee}: ${e}. Proceeding with MR creation without an assignee.`
          );
        }
      }
      let fileRoot;
      if (sourcePath) {
        fileRoot = backendPluginApi$2.resolveSafeChildPath(ctx.workspacePath, sourcePath);
      } else if (targetPath) {
        fileRoot = backendPluginApi$2.resolveSafeChildPath(ctx.workspacePath, targetPath);
      } else {
        fileRoot = ctx.workspacePath;
      }
      const fileContents = await pluginScaffolderNode$5.serializeDirectoryContents(fileRoot, {
        gitignore: true
      });
      let targetBranch = targetBranchName;
      if (!targetBranch) {
        const projects = await api.Projects.show(repoID);
        const { default_branch: defaultBranch } = projects;
        targetBranch = defaultBranch;
      }
      let remoteFiles = [];
      if ((ctx.input.commitAction ?? "auto") === "auto") {
        try {
          remoteFiles = await api.Repositories.tree(repoID, {
            ref: targetBranch,
            recursive: true,
            path: targetPath ?? void 0
          });
        } catch (e) {
          ctx.logger.warn(
            `Could not retrieve the list of files for ${repoID} (branch: ${targetBranch}) : ${e}`
          );
        }
      }
      const actions = ctx.input.commitAction === "skip" ? [] : (await Promise.all(
        fileContents.map(async (file) => {
          const action = await getFileAction(
            { file, targetPath },
            { repoID, branch: targetBranch },
            api,
            ctx.logger,
            remoteFiles,
            ctx.input.commitAction
          );
          return { file, action };
        })
      )).filter((o) => o.action !== "skip").map(({ file, action }) => ({
        action,
        filePath: targetPath ? path__default$1.default.posix.join(targetPath, file.path) : file.path,
        encoding: "base64",
        content: file.content.toString("base64"),
        execute_filemode: file.executable
      }));
      let createBranch;
      if (actions.length) {
        createBranch = true;
      } else {
        try {
          await api.Branches.show(repoID, branchName);
          createBranch = false;
          ctx.logger.info(
            `Using existing branch ${branchName} without modification.`
          );
        } catch (e) {
          createBranch = true;
        }
      }
      if (createBranch) {
        try {
          await api.Branches.create(repoID, branchName, String(targetBranch));
        } catch (e) {
          throw new errors$4.InputError(
            `The branch creation failed. Please check that your repo does not already contain a branch named '${branchName}'. ${e}`
          );
        }
      }
      if (actions.length) {
        try {
          await api.Commits.create(repoID, branchName, title, actions);
        } catch (e) {
          throw new errors$4.InputError(
            `Committing the changes to ${branchName} failed. Please check that none of the files created by the template already exists. ${e}`
          );
        }
      }
      try {
        const mergeRequestUrl = await api.MergeRequests.create(
          repoID,
          branchName,
          String(targetBranch),
          title,
          {
            description,
            removeSourceBranch: removeSourceBranch ? removeSourceBranch : false,
            assigneeId
          }
        ).then((mergeRequest) => {
          return mergeRequest.web_url;
        });
        ctx.output("projectid", repoID);
        ctx.output("targetBranchName", targetBranch);
        ctx.output("projectPath", repoID);
        ctx.output("mergeRequestUrl", mergeRequestUrl);
      } catch (e) {
        throw new errors$4.InputError(`Merge request creation failed${e}`);
      }
    }
  });
};

gitlabMergeRequest_cjs.createPublishGitlabMergeRequestAction = createPublishGitlabMergeRequestAction;

var gitlabPipelineTrigger_cjs = {};

var gitlabPipelineTrigger_examples_cjs = {};

var yaml$4 = require$$0;
var commonGitlabConfig$4 = commonGitlabConfig_cjs;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$4 = /*#__PURE__*/_interopDefaultCompat$5(yaml$4);

const examples$4 = [
  {
    description: "Trigger a GitLab Project Pipeline",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          id: "triggerPipeline",
          name: "Trigger Project Pipeline",
          action: "gitlab:pipeline:trigger",
          input: {
            ...commonGitlabConfig$4.commonGitlabConfigExample,
            projectId: 12,
            tokenDescription: "This is the text that will appear in the pipeline token",
            token: "glpt-xxxxxxxxxxxx",
            branch: "main",
            variables: { var_one: "one", var_two: "two" }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a GitLab Project Pipeline with No Variables",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          id: "triggerPipeline",
          name: "Trigger Project Pipeline",
          action: "gitlab:pipeline:trigger",
          input: {
            ...commonGitlabConfig$4.commonGitlabConfigExample,
            projectId: 12,
            tokenDescription: "This is the text that will appear in the pipeline token",
            token: "glpt-xxxxxxxxxxxx",
            branch: "main",
            variables: {}
          }
        }
      ]
    })
  },
  {
    description: "Trigger a GitLab Project Pipeline with Single Variables",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          id: "triggerPipeline",
          name: "Trigger Project Pipeline",
          action: "gitlab:pipeline:trigger",
          input: {
            ...commonGitlabConfig$4.commonGitlabConfigExample,
            projectId: 12,
            tokenDescription: "This is the text that will appear in the pipeline token",
            token: "glpt-xxxxxxxxxxxx",
            branch: "main",
            variables: { var_one: "one" }
          }
        }
      ]
    })
  },
  {
    description: "Trigger a GitLab Project Pipeline with Multiple Variables",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          id: "triggerPipeline",
          name: "Trigger Project Pipeline",
          action: "gitlab:pipeline:trigger",
          input: {
            ...commonGitlabConfig$4.commonGitlabConfigExample,
            projectId: 12,
            tokenDescription: "This is the text that will appear in the pipeline token",
            token: "glpt-xxxxxxxxxxxx",
            branch: "main",
            variables: { var_one: "one", var_two: "two", var_three: "three" }
          }
        }
      ]
    })
  }
];

gitlabPipelineTrigger_examples_cjs.examples = examples$4;

var errors$3 = require$$0$1;
var pluginScaffolderNode$4 = require$$1;
var zod$3 = require$$4;
var commonGitlabConfig$3 = commonGitlabConfig_cjs;
var util$3 = util_cjs;
var gitlabPipelineTrigger_examples = gitlabPipelineTrigger_examples_cjs;

const pipelineInputProperties = zod$3.z.object({
  projectId: zod$3.z.number().describe("Project Id"),
  tokenDescription: zod$3.z.string().describe("Pipeline token description"),
  branch: zod$3.z.string().describe("Project branch"),
  variables: zod$3.z.record(zod$3.z.string(), zod$3.z.string()).optional().describe(
    "A object/record of key-valued strings containing the pipeline variables."
  )
});
const pipelineOutputProperties = zod$3.z.object({
  pipelineUrl: zod$3.z.string({ description: "Pipeline Url" })
});
const createTriggerGitlabPipelineAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$4.createTemplateAction({
    id: "gitlab:pipeline:trigger",
    description: "Triggers a GitLab Pipeline.",
    examples: gitlabPipelineTrigger_examples.examples,
    schema: {
      input: commonGitlabConfig$3.default.merge(pipelineInputProperties),
      output: pipelineOutputProperties
    },
    async handler(ctx) {
      let pipelineTokenResponse = null;
      const { repoUrl, projectId, tokenDescription, token, branch, variables } = commonGitlabConfig$3.default.merge(pipelineInputProperties).parse(ctx.input);
      const { host } = util$3.parseRepoUrl(repoUrl, integrations);
      const api = util$3.getClient({ host, integrations, token });
      try {
        pipelineTokenResponse = await api.PipelineTriggerTokens.create(
          projectId,
          tokenDescription
        );
        if (!pipelineTokenResponse.token) {
          ctx.logger.error("Failed to create pipeline token.");
          return;
        }
        ctx.logger.info(
          `Pipeline token id ${pipelineTokenResponse.id} created.`
        );
        const pipelineTriggerResponse = await api.PipelineTriggerTokens.trigger(
          projectId,
          branch,
          pipelineTokenResponse.token,
          { variables }
        );
        if (!pipelineTriggerResponse.id) {
          ctx.logger.error("Failed to trigger pipeline.");
          return;
        }
        ctx.logger.info(`Pipeline id ${pipelineTriggerResponse.id} triggered.`);
        ctx.output("pipelineUrl", pipelineTriggerResponse.web_url);
      } catch (error) {
        if (error instanceof zod$3.z.ZodError) {
          throw new errors$3.InputError(`Validation error: ${error.message}`, {
            validationErrors: error.errors
          });
        }
        throw new errors$3.InputError(`Failed to trigger Pipeline: ${error.message}`);
      } finally {
        if (pipelineTokenResponse && pipelineTokenResponse.id) {
          try {
            await api.PipelineTriggerTokens.remove(
              projectId,
              pipelineTokenResponse.id
            );
            ctx.logger.info(
              `Deleted pipeline token ${pipelineTokenResponse.id}.`
            );
          } catch (error) {
            ctx.logger.error(
              `Failed to delete pipeline token id ${pipelineTokenResponse.id}.`
            );
          }
        }
      }
    }
  });
};

gitlabPipelineTrigger_cjs.createTriggerGitlabPipelineAction = createTriggerGitlabPipelineAction;

var gitlabProjectAccessTokenCreate_cjs = {};

var gitlabProjectAccessTokenCreate_examples_cjs = {};

var yaml$3 = require$$0;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$3 = /*#__PURE__*/_interopDefaultCompat$4(yaml$3);

const examples$3 = [
  {
    description: "Create a GitLab project access token with minimal options.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "456"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with custom scopes.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "789",
            scopes: ["read_registry", "write_repository"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with a specified name.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            name: "my-custom-token"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with a numeric project ID.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: 42
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with a specified expired Date.",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "123",
            expiresAt: "2024-06-25"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with an access level",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "456",
            accessLevel: 30
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with multiple options",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "456",
            accessLevel: 40,
            name: "full-access-token",
            expiresAt: "2024-12-31"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with a token for authorization",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            token: "personal-access-token"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with read-only scopes",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            scopes: ["read_repository", "read_api"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with guest access level",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            accessLevel: 10
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with maintainer access level",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            accessLevel: 40
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with owner access level",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            accessLevel: 50
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token with a specified name and no expiration date",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            name: "no-expiry-token"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project access token for a specific gitlab instance",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "createAccessToken",
          action: "gitlab:projectAccessToken:create",
          name: "Create GitLab Project Access Token",
          input: {
            repoUrl: "gitlab.example.com?repo=repo&owner=owner",
            projectId: "101112"
          }
        }
      ]
    })
  }
];

gitlabProjectAccessTokenCreate_examples_cjs.examples = examples$3;

var errors$2 = require$$0$1;
var pluginScaffolderNode$3 = require$$1;
var rest = require$$1$1;
var luxon = require$$3$1;
var zod$2 = require$$4;
var util$2 = util_cjs;
var gitlabProjectAccessTokenCreate_examples = gitlabProjectAccessTokenCreate_examples_cjs;

const createGitlabProjectAccessTokenAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$3.createTemplateAction({
    id: "gitlab:projectAccessToken:create",
    examples: gitlabProjectAccessTokenCreate_examples.examples,
    schema: {
      input: zod$2.z.object({
        projectId: zod$2.z.union([zod$2.z.number(), zod$2.z.string()], {
          description: "Project ID/Name(slug) of the Gitlab Project"
        }),
        token: zod$2.z.string({
          description: "The token to use for authorization to GitLab"
        }).optional(),
        name: zod$2.z.string({ description: "Name of Access Key" }).optional(),
        repoUrl: zod$2.z.string({ description: "URL to gitlab instance" }),
        accessLevel: zod$2.z.number({
          description: "Access Level of the Token, 10 (Guest), 20 (Reporter), 30 (Developer), 40 (Maintainer), and 50 (Owner)"
        }).optional(),
        scopes: zod$2.z.string({
          description: "Scopes for a project access token"
        }).array().optional(),
        expiresAt: zod$2.z.string({
          description: "Expiration date of the access token in ISO format (YYYY-MM-DD). If Empty, it will set to the maximum of 365 days."
        }).optional()
      }),
      output: zod$2.z.object({
        access_token: zod$2.z.string({ description: "Access Token" })
      })
    },
    async handler(ctx) {
      ctx.logger.info(`Creating Token for Project "${ctx.input.projectId}"`);
      const {
        projectId,
        name = "tokenname",
        accessLevel = 40,
        scopes = ["read_repository"],
        expiresAt
      } = ctx.input;
      const { token, integrationConfig } = util$2.getToken(ctx.input, integrations);
      if (!integrationConfig.config.token && token) {
        throw new errors$2.InputError(
          `No token available for host ${integrationConfig.config.baseUrl}`
        );
      }
      let api;
      if (!ctx.input.token) {
        api = new rest.Gitlab({
          host: integrationConfig.config.baseUrl,
          token
        });
      } else {
        api = new rest.Gitlab({
          host: integrationConfig.config.baseUrl,
          oauthToken: token
        });
      }
      const response = await api.ProjectAccessTokens.create(
        projectId,
        name,
        scopes,
        {
          expiresAt: expiresAt || luxon.DateTime.now().plus({ days: 365 }).toISODate(),
          accessLevel
        }
      );
      if (!response.token) {
        throw new Error("Could not create project access token");
      }
      ctx.output("access_token", response.token);
    }
  });
};

gitlabProjectAccessTokenCreate_cjs.createGitlabProjectAccessTokenAction = createGitlabProjectAccessTokenAction;

var gitlabProjectDeployTokenCreate_cjs = {};

var gitlabProjectDeployTokenCreate_examples_cjs = {};

var yaml$2 = require$$0;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$2 = /*#__PURE__*/_interopDefaultCompat$3(yaml$2);

const examples$2 = [
  {
    description: "Create a GitLab project deploy token with minimal options.",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "createDeployToken",
          action: "gitlab:projectDeployToken:create",
          name: "Create GitLab Project Deploy Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "456",
            name: "tokenname"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project deploy token with custom scopes.",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "createDeployToken",
          action: "gitlab:projectDeployToken:create",
          name: "Create GitLab Project Deploy Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "789",
            name: "tokenname",
            scopes: ["read_registry", "write_repository"]
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project deploy token with a specified name.",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "createDeployToken",
          action: "gitlab:projectDeployToken:create",
          name: "Create GitLab Project Deploy Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "101112",
            name: "my-custom-token"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project deploy token with a numeric project ID.",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "createDeployToken",
          action: "gitlab:projectDeployToken:create",
          name: "Create GitLab Project Deploy Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: 42,
            name: "tokenname"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project deploy token with a custom username",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "createDeployToken",
          action: "gitlab:projectDeployToken:create",
          name: "Create GitLab Project Deploy Token",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: 42,
            name: "tokenname",
            username: "tokenuser"
          }
        }
      ]
    })
  }
];

gitlabProjectDeployTokenCreate_examples_cjs.examples = examples$2;

var errors$1 = require$$0$1;
var pluginScaffolderNode$2 = require$$1;
var node = require$$2;
var zod$1 = require$$4;
var commonGitlabConfig$2 = commonGitlabConfig_cjs;
var util$1 = util_cjs;
var gitlabProjectDeployTokenCreate_examples = gitlabProjectDeployTokenCreate_examples_cjs;

const createGitlabProjectDeployTokenAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$2.createTemplateAction({
    id: "gitlab:projectDeployToken:create",
    examples: gitlabProjectDeployTokenCreate_examples.examples,
    schema: {
      input: commonGitlabConfig$2.default.merge(
        zod$1.z.object({
          projectId: zod$1.z.union([zod$1.z.number(), zod$1.z.string()], {
            description: "Project ID"
          }),
          name: zod$1.z.string({ description: "Deploy Token Name" }),
          username: zod$1.z.string({ description: "Deploy Token Username" }).optional(),
          scopes: zod$1.z.array(zod$1.z.string(), { description: "Scopes" }).optional()
        })
      ),
      output: zod$1.z.object({
        deploy_token: zod$1.z.string({ description: "Deploy Token" }),
        user: zod$1.z.string({ description: "User" })
      })
    },
    async handler(ctx) {
      ctx.logger.info(`Creating Token for Project "${ctx.input.projectId}"`);
      const { projectId, name, username, scopes } = ctx.input;
      const { token, integrationConfig } = util$1.getToken(ctx.input, integrations);
      const api = new node.Gitlab({
        host: integrationConfig.config.baseUrl,
        token
      });
      const deployToken = await api.ProjectDeployTokens.add(
        projectId,
        name,
        scopes,
        {
          username
        }
      );
      if (!deployToken.hasOwnProperty("token")) {
        throw new errors$1.InputError(`No deploy_token given from gitlab instance`);
      }
      ctx.output("deploy_token", deployToken.token);
      ctx.output("user", deployToken.username);
    }
  });
};

gitlabProjectDeployTokenCreate_cjs.createGitlabProjectDeployTokenAction = createGitlabProjectDeployTokenAction;

var gitlabProjectVariableCreate_cjs = {};

var gitlabProjectVariableCreate_examples_cjs = {};

var yaml$1 = require$$0;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$2(yaml$1);

const examples$1 = [
  {
    description: "Creating a GitLab project variable of type env_var",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:createGitlabProjectVariableAction",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "123",
            key: "MY_VARIABLE",
            value: "my_value",
            variableType: "env_var"
          }
        }
      ]
    })
  },
  {
    description: "Creating a GitLab project variable of type file",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:createGitlabProjectVariableAction",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "123",
            key: "MY_VARIABLE",
            value: "my-file-content",
            variableType: "file"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project variable that is protected.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:createGitlabProjectVariableAction",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "456",
            key: "MY_VARIABLE",
            value: "my_value",
            variableType: "env_var",
            variableProtected: true
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project variable with masked flag as true",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:createGitlabProjectVariableAction",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "789",
            key: "DB_PASSWORD",
            value: "password123",
            variableType: "env_var",
            masked: true
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project variable that is expandable.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:projectVariable:create",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "123",
            key: "MY_VARIABLE",
            value: "my_value",
            variableType: "env_var",
            raw: true
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project variable with a specific environment scope.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:projectVariable:create",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "123",
            key: "MY_VARIABLE",
            value: "my_value",
            variableType: "env_var",
            environmentScope: "production"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab project variable with a wildcard environment scope.",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "createVariable",
          action: "gitlab:projectVariable:create",
          name: "Create GitLab Project Variable",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            projectId: "123",
            key: "MY_VARIABLE",
            value: "my_value",
            variableType: "env_var",
            environmentScope: "*"
          }
        }
      ]
    })
  }
];

gitlabProjectVariableCreate_examples_cjs.examples = examples$1;

var pluginScaffolderNode$1 = require$$1;
var zod = require$$4;
var commonGitlabConfig$1 = commonGitlabConfig_cjs;
var util = util_cjs;
var gitlabProjectVariableCreate_examples = gitlabProjectVariableCreate_examples_cjs;

const createGitlabProjectVariableAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode$1.createTemplateAction({
    id: "gitlab:projectVariable:create",
    examples: gitlabProjectVariableCreate_examples.examples,
    schema: {
      input: commonGitlabConfig$1.default.merge(
        zod.z.object({
          projectId: zod.z.union([zod.z.number(), zod.z.string()], {
            description: "Project ID"
          }),
          key: zod.z.string({
            description: "The key of a variable; must have no more than 255 characters; only A-Z, a-z, 0-9, and _ are allowed"
          }).regex(/^[A-Za-z0-9_]{1,255}$/),
          value: zod.z.string({ description: "The value of a variable" }),
          variableType: zod.z.string({
            description: "Variable Type (env_var or file)"
          }),
          variableProtected: zod.z.boolean({ description: "Whether the variable is protected" }).default(false).optional(),
          masked: zod.z.boolean({ description: "Whether the variable is masked" }).default(false).optional(),
          raw: zod.z.boolean({ description: "Whether the variable is expandable" }).default(false).optional(),
          environmentScope: zod.z.string({ description: "The environment_scope of the variable" }).default("*").optional()
        })
      )
    },
    async handler(ctx) {
      const {
        repoUrl,
        projectId,
        key,
        value,
        variableType,
        variableProtected = false,
        masked = false,
        raw = false,
        environmentScope = "*",
        token
      } = ctx.input;
      const { host } = util.parseRepoUrl(repoUrl, integrations);
      const api = util.getClient({ host, integrations, token });
      await api.ProjectVariables.create(projectId, key, value, {
        variableType,
        protected: variableProtected,
        masked,
        raw,
        environmentScope
      });
    }
  });
};

gitlabProjectVariableCreate_cjs.createGitlabProjectVariableAction = createGitlabProjectVariableAction;

var gitlabRepoPush_cjs = {};

var gitlabRepoPush_examples_cjs = {};

var yaml = require$$0;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat$1(yaml);

const examples = [
  {
    description: "Push changes to gitlab repository with minimal changes",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "pushChanges",
          action: "gitlab:repo:push",
          name: "Push changes to gitlab repository",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            commitMessage: "Initial Commit",
            branchName: "feature-branch"
          }
        }
      ]
    })
  },
  {
    description: "Push changes to gitlab repository with a specific source and target path",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "pushChanges",
          action: "gitlab:repo:push",
          name: "Push changes to gitlab repository",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            commitMessage: "Initial Commit",
            branchName: "feature-branch",
            sourcePath: "src",
            targetPath: "dest"
          }
        }
      ]
    })
  },
  {
    description: "Push changes to gitlab repository with a specific commit action",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "pushChanges",
          action: "gitlab:repo:push",
          name: "Push changes to gitlab repository",
          input: {
            repoUrl: "gitlab.com?repo=repo&owner=owner",
            commitMessage: "Initial Commit",
            branchName: "feature-branch",
            commitAction: "update"
          }
        }
      ]
    })
  }
];

gitlabRepoPush_examples_cjs.examples = examples;

var pluginScaffolderNode = require$$1;
var path = require$$1$2;
var errors = require$$0$1;
var backendPluginApi$1 = require$$3;
var helpers = helpers_cjs;
var gitlabRepoPush_examples = gitlabRepoPush_examples_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefaultCompat(path);

const createGitlabRepoPushAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:repo:push",
    examples: gitlabRepoPush_examples.examples,
    schema: {
      input: {
        required: ["repoUrl", "branchName", "commitMessage"],
        type: "object",
        properties: {
          repoUrl: {
            type: "string",
            title: "Repository Location",
            description: `Accepts the format 'gitlab.com?repo=project_name&owner=group_name' where 'project_name' is the repository name and 'group_name' is a group or username`
          },
          branchName: {
            type: "string",
            title: "Source Branch Name",
            description: "The branch name for the commit"
          },
          commitMessage: {
            type: "string",
            title: "Commit Message",
            description: `The commit message`
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
            description: "The token to use for authorization to GitLab"
          },
          commitAction: {
            title: "Commit action",
            type: "string",
            enum: ["create", "update", "delete"],
            description: "The action to be used for git commit. Defaults to create."
          }
        }
      },
      output: {
        type: "object",
        properties: {
          projectid: {
            title: "Gitlab Project id/Name(slug)",
            type: "string"
          },
          projectPath: {
            title: "Gitlab Project path",
            type: "string"
          },
          commitHash: {
            title: "The git commit hash of the commit",
            type: "string"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        branchName,
        repoUrl,
        targetPath,
        sourcePath,
        token,
        commitAction
      } = ctx.input;
      const { owner, repo, project } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      const repoID = project ? project : `${owner}/${repo}`;
      const api = helpers.createGitlabApi({
        integrations,
        token,
        repoUrl
      });
      let fileRoot;
      if (sourcePath) {
        fileRoot = backendPluginApi$1.resolveSafeChildPath(ctx.workspacePath, sourcePath);
      } else {
        fileRoot = ctx.workspacePath;
      }
      const fileContents = await pluginScaffolderNode.serializeDirectoryContents(fileRoot, {
        gitignore: true
      });
      const actions = fileContents.map((file) => ({
        action: commitAction ?? "create",
        filePath: targetPath ? path__default.default.posix.join(targetPath, file.path) : file.path,
        encoding: "base64",
        content: file.content.toString("base64"),
        execute_filemode: file.executable
      }));
      let branchExists = false;
      try {
        await api.Branches.show(repoID, branchName);
        branchExists = true;
      } catch (e) {
        if (e.response?.statusCode !== 404) {
          throw new errors.InputError(
            `Failed to check status of branch '${branchName}'. Please make sure that branch already exists or Backstage has permissions to create one. ${e}`
          );
        }
      }
      if (!branchExists) {
        try {
          const projects = await api.Projects.show(repoID);
          const { default_branch: defaultBranch } = projects;
          await api.Branches.create(repoID, branchName, String(defaultBranch));
        } catch (e) {
          throw new errors.InputError(
            `The branch '${branchName}' was not found and creation failed with error. Please make sure that branch already exists or Backstage has permissions to create one. ${e}`
          );
        }
      }
      try {
        const commit = await api.Commits.create(
          repoID,
          branchName,
          ctx.input.commitMessage,
          actions
        );
        ctx.output("projectid", repoID);
        ctx.output("projectPath", repoID);
        ctx.output("commitHash", commit.id);
      } catch (e) {
        throw new errors.InputError(
          `Committing the changes to ${branchName} failed. Please check that none of the files created by the template already exists. ${e}`
        );
      }
    }
  });
};

gitlabRepoPush_cjs.createGitlabRepoPushAction = createGitlabRepoPushAction;

var module_cjs = {};

var backendPluginApi = require$$3;
var integration = require$$1$3;
var alpha = require$$2$1;
var gitlab$1 = gitlab_cjs;
var gitlabGroupEnsureExists$1 = gitlabGroupEnsureExists_cjs;
var gitlabIssueCreate$1 = gitlabIssueCreate_cjs;
var gitlabIssueEdit$1 = gitlabIssueEdit_cjs;
var gitlabMergeRequest$1 = gitlabMergeRequest_cjs;
var gitlabPipelineTrigger$1 = gitlabPipelineTrigger_cjs;
var gitlabProjectAccessTokenCreate$1 = gitlabProjectAccessTokenCreate_cjs;
var gitlabProjectDeployTokenCreate$1 = gitlabProjectDeployTokenCreate_cjs;
var gitlabProjectVariableCreate$1 = gitlabProjectVariableCreate_cjs;
var gitlabRepoPush$1 = gitlabRepoPush_cjs;


const gitlabModule = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "gitlab",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config }) {
        const integrations = integration.ScmIntegrations.fromConfig(config);
        scaffolder.addActions(
          gitlabGroupEnsureExists$1.createGitlabGroupEnsureExistsAction({ integrations }),
          gitlabIssueCreate$1.createGitlabIssueAction({ integrations }),
          gitlabProjectAccessTokenCreate$1.createGitlabProjectAccessTokenAction({ integrations }),
          gitlabProjectDeployTokenCreate$1.createGitlabProjectDeployTokenAction({ integrations }),
          gitlabProjectVariableCreate$1.createGitlabProjectVariableAction({ integrations }),
          gitlabRepoPush$1.createGitlabRepoPushAction({ integrations }),
          gitlabIssueEdit$1.editGitlabIssueAction({ integrations }),
          gitlab$1.createPublishGitlabAction({ config, integrations }),
          gitlabMergeRequest$1.createPublishGitlabMergeRequestAction({ integrations }),
          gitlabPipelineTrigger$1.createTriggerGitlabPipelineAction({ integrations })
        );
      }
    });
  }
});

module_cjs.gitlabModule = gitlabModule;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var gitlab = gitlab_cjs;
var gitlabGroupEnsureExists = gitlabGroupEnsureExists_cjs;
var gitlabIssueCreate = gitlabIssueCreate_cjs;
var gitlabIssueEdit = gitlabIssueEdit_cjs;
var gitlabMergeRequest = gitlabMergeRequest_cjs;
var gitlabPipelineTrigger = gitlabPipelineTrigger_cjs;
var gitlabProjectAccessTokenCreate = gitlabProjectAccessTokenCreate_cjs;
var gitlabProjectDeployTokenCreate = gitlabProjectDeployTokenCreate_cjs;
var gitlabProjectVariableCreate = gitlabProjectVariableCreate_cjs;
var gitlabRepoPush = gitlabRepoPush_cjs;
var commonGitlabConfig = commonGitlabConfig_cjs;
var module$1 = module_cjs;



index_cjs.createPublishGitlabAction = gitlab.createPublishGitlabAction;
index_cjs.createGitlabGroupEnsureExistsAction = gitlabGroupEnsureExists.createGitlabGroupEnsureExistsAction;
index_cjs.createGitlabIssueAction = gitlabIssueCreate.createGitlabIssueAction;
index_cjs.editGitlabIssueAction = gitlabIssueEdit.editGitlabIssueAction;
index_cjs.createPublishGitlabMergeRequestAction = gitlabMergeRequest.createPublishGitlabMergeRequestAction;
index_cjs.createTriggerGitlabPipelineAction = gitlabPipelineTrigger.createTriggerGitlabPipelineAction;
index_cjs.createGitlabProjectAccessTokenAction = gitlabProjectAccessTokenCreate.createGitlabProjectAccessTokenAction;
index_cjs.createGitlabProjectDeployTokenAction = gitlabProjectDeployTokenCreate.createGitlabProjectDeployTokenAction;
index_cjs.createGitlabProjectVariableAction = gitlabProjectVariableCreate.createGitlabProjectVariableAction;
index_cjs.createGitlabRepoPushAction = gitlabRepoPush.createGitlabRepoPushAction;
index_cjs.IssueStateEvent = commonGitlabConfig.IssueStateEvent;
index_cjs.IssueType = commonGitlabConfig.IssueType;
var _default = index_cjs.default = module$1.gitlabModule;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
