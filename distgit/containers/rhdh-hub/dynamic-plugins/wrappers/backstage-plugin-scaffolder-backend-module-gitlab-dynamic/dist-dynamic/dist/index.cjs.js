'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/plugin-scaffolder-node');
var require$$1 = require('@gitbeaker/node');
var require$$2 = require('zod');
var require$$3 = require('@backstage/errors');
var require$$4 = require('@gitbeaker/rest');
var require$$5 = require('yaml');
var require$$6 = require('luxon');
var require$$7 = require('path');
var require$$8 = require('@backstage/backend-plugin-api');
var require$$9 = require('@backstage/plugin-scaffolder-node/alpha');
var require$$10 = require('@backstage/integration');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var pluginScaffolderNode = require$$0;
var node = require$$1;
var zod = require$$2;
var errors = require$$3;
var rest = require$$4;
var yaml = require$$5;
var luxon = require$$6;
var path = require$$7;
var backendPluginApi = require$$8;
var alpha = require$$9;
var integration = require$$10;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);
var path__default = /*#__PURE__*/_interopDefaultCompat(path);

const commonGitlabConfig = zod.z.object({
  repoUrl: zod.z.string({ description: "Repository Location" }),
  token: zod.z.string({ description: "The token to use for authorization to GitLab" }).optional()
});
const commonGitlabConfigExample = {
  repoUrl: "gitlab.com?owner=namespace-or-owner&repo=project-name",
  token: "${{ secrets.USER_OAUTH_TOKEN }}"
};

const parseRepoHost = (repoUrl) => {
  let parsed;
  try {
    parsed = new URL(`https://${repoUrl}`);
  } catch (error) {
    throw new errors.InputError(
      `Invalid repo URL passed to publisher, got ${repoUrl}, ${error}`
    );
  }
  return parsed.host;
};
const getToken = (config, integrations) => {
  const host = parseRepoHost(config.repoUrl);
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  const token = config.token || integrationConfig.config.token;
  return { token, integrationConfig };
};
const parseRepoUrl = (repoUrl, integrations) => {
  var _a, _b;
  let parsed;
  try {
    parsed = new URL(`https://${repoUrl}`);
  } catch (error) {
    throw new errors.InputError(
      `Invalid repo URL passed to publisher, got ${repoUrl}, ${error}`
    );
  }
  const host = parsed.host;
  const owner = (_a = parsed.searchParams.get("owner")) != null ? _a : void 0;
  const repo = parsed.searchParams.get("repo");
  const type = (_b = integrations.byHost(host)) == null ? void 0 : _b.type;
  if (!type) {
    throw new errors.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  return { host, owner, repo };
};
function getClient(props) {
  const { host, token, integrations } = props;
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  const { config } = integrationConfig;
  if (!config.token && !token) {
    throw new errors.InputError(`No token available for host ${host}`);
  }
  const requestToken = token || config.token;
  const tokenType = token ? "oauthToken" : "token";
  const gitlabOptions = {
    host: config.baseUrl
  };
  gitlabOptions[tokenType] = requestToken;
  return new rest.Gitlab(gitlabOptions);
}
function convertDate(inputDate, defaultDate) {
  try {
    return inputDate ? new Date(inputDate).toISOString() : new Date(defaultDate).toISOString();
  } catch (error) {
    throw new errors.InputError(`Error converting input date - ${error}`);
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
    throw new errors.InputError(
      `Error finding top-level parent group ID: ${error.message}`
    );
  }
}
async function checkEpicScope(client, projectId, epicId) {
  try {
    const project = await client.Projects.show(projectId);
    if (!project) {
      throw new errors.InputError(
        `Project with id ${projectId} not found. Check your GitLab instance.`
      );
    }
    const topParentGroup = await getTopLevelParentGroup(
      client,
      project.namespace.id
    );
    if (!topParentGroup) {
      throw new errors.InputError(`Couldn't find a suitable top-level parent group.`);
    }
    const epic = (await client.Epics.all(topParentGroup.id)).find(
      (x) => x.id === epicId
    );
    if (!epic) {
      throw new errors.InputError(
        `Epic with id ${epicId} not found in the top-level parent group ${topParentGroup.name}.`
      );
    }
    const epicGroup = await client.Groups.show(epic.group_id);
    const projectNamespace = project.path_with_namespace;
    return projectNamespace.startsWith(epicGroup.full_path);
  } catch (error) {
    throw new errors.InputError(`Could not find epic scope: ${error.message}`);
  }
}

const examples$7 = [
  {
    description: "Creating a group at the top level",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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

const createGitlabGroupEnsureExistsAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:group:ensureExists",
    description: "Ensures a Gitlab group exists",
    supportsDryRun: true,
    examples: examples$7,
    schema: {
      input: commonGitlabConfig.merge(
        zod.z.object({
          path: zod.z.array(zod.z.string(), {
            description: "A path of group names that is ensured to exist"
          }).min(1)
        })
      ),
      output: zod.z.object({
        groupId: zod.z.number({ description: "The id of the innermost sub-group" }).optional()
      })
    },
    async handler(ctx) {
      if (ctx.isDryRun) {
        ctx.output("groupId", 42);
        return;
      }
      const { path } = ctx.input;
      const { token, integrationConfig } = getToken(ctx.input, integrations);
      const api = new node.Gitlab({
        host: integrationConfig.config.baseUrl,
        token
      });
      let currentPath = null;
      let parent = null;
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
          parent = await api.Groups.create(
            pathElement,
            pathElement,
            parent ? {
              parent_id: parent.id
            } : {}
          );
        } else {
          parent = subGroup;
        }
        currentPath = fullPath;
      }
      if (parent !== null) {
        ctx.output("groupId", parent == null ? void 0 : parent.id);
      }
    }
  });
};

const examples$6 = [
  {
    description: "Create a GitLab project deploy token with minimal options.",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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

const createGitlabProjectDeployTokenAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:projectDeployToken:create",
    examples: examples$6,
    schema: {
      input: commonGitlabConfig.merge(
        zod.z.object({
          projectId: zod.z.union([zod.z.number(), zod.z.string()], {
            description: "Project ID"
          }),
          name: zod.z.string({ description: "Deploy Token Name" }),
          username: zod.z.string({ description: "Deploy Token Username" }).optional(),
          scopes: zod.z.array(zod.z.string(), { description: "Scopes" }).optional()
        })
      ),
      output: zod.z.object({
        deploy_token: zod.z.string({ description: "Deploy Token" }),
        user: zod.z.string({ description: "User" })
      })
    },
    async handler(ctx) {
      ctx.logger.info(`Creating Token for Project "${ctx.input.projectId}"`);
      const { projectId, name, username, scopes } = ctx.input;
      const { token, integrationConfig } = getToken(ctx.input, integrations);
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
        throw new errors.InputError(`No deploy_token given from gitlab instance`);
      }
      ctx.output("deploy_token", deployToken.token);
      ctx.output("user", deployToken.username);
    }
  });
};

const examples$5 = [
  {
    description: "Create a GitLab project access token with minimal options.",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
  }
];

const createGitlabProjectAccessTokenAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:projectAccessToken:create",
    examples: examples$5,
    schema: {
      input: zod.z.object({
        projectId: zod.z.union([zod.z.number(), zod.z.string()], {
          description: "Project ID/Name(slug) of the Gitlab Project"
        }),
        token: zod.z.string({
          description: "The token to use for authorization to GitLab"
        }).optional(),
        name: zod.z.string({ description: "Name of Access Key" }).optional(),
        repoUrl: zod.z.string({ description: "URL to gitlab instance" }),
        accessLevel: zod.z.number({
          description: "Access Level of the Token, 10 (Guest), 20 (Reporter), 30 (Developer), 40 (Maintainer), and 50 (Owner)"
        }).optional(),
        scopes: zod.z.string({
          description: "Scopes for a project access token"
        }).array().optional(),
        expiresAt: zod.z.string({
          description: "Expiration date of the access token in ISO format (YYYY-MM-DD). If Empty, it will set to the maximum of 365 days."
        }).optional()
      }),
      output: zod.z.object({
        access_token: zod.z.string({ description: "Access Token" })
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
      const { token, integrationConfig } = getToken(ctx.input, integrations);
      if (!integrationConfig.config.token && token) {
        throw new errors.InputError(
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

const examples$4 = [
  {
    description: "Creating a GitLab project variable of type env_var",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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

const createGitlabProjectVariableAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:projectVariable:create",
    examples: examples$4,
    schema: {
      input: commonGitlabConfig.merge(
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
        projectId,
        key,
        value,
        variableType,
        variableProtected = false,
        masked = false,
        raw = false,
        environmentScope = "*"
      } = ctx.input;
      const { token, integrationConfig } = getToken(ctx.input, integrations);
      const api = new node.Gitlab({
        host: integrationConfig.config.baseUrl,
        token
      });
      await api.ProjectVariables.create(projectId, {
        key,
        value,
        variable_type: variableType,
        protected: variableProtected,
        masked,
        raw,
        environment_scope: environmentScope
      });
    }
  });
};

const examples$3 = [
  {
    description: "Create a GitLab issue with minimal options",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfigExample,
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
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            assignees: [18],
            description: "This is the description of the issue",
            createdAt: "2022-09-27 18:00:00.000",
            dueDate: "2022-09-28 12:00:00.000"
          }
        }
      ]
    })
  },
  {
    description: "Create a GitLab Issue with several options",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "gitlabIssue",
          name: "Issues",
          action: "gitlab:issues:create",
          input: {
            ...commonGitlabConfigExample,
            projectId: 12,
            title: "Test Issue",
            assignees: [18, 15],
            description: "This is the description of the issue",
            confidential: false,
            createdAt: "2022-09-27 18:00:00.000",
            dueDate: "2022-09-28 12:00:00.000",
            discussionToResolve: 1,
            epicId: 1,
            labels: "phase1:label1,phase2:label2"
          }
        }
      ]
    })
  }
];

var IssueType = /* @__PURE__ */ ((IssueType2) => {
  IssueType2["ISSUE"] = "issue";
  IssueType2["INCIDENT"] = "incident";
  IssueType2["TEST"] = "test_case";
  return IssueType2;
})(IssueType || {});
const issueInputProperties = zod.z.object({
  projectId: zod.z.number().describe("Project Id"),
  title: zod.z.string({ description: "Title of the issue" }),
  assignees: zod.z.array(zod.z.number(), {
    description: "IDs of the users to assign the issue to."
  }).optional(),
  confidential: zod.z.boolean({ description: "Issue Confidentiality" }).optional(),
  description: zod.z.string().describe("Issue description").max(1048576).optional(),
  createdAt: zod.z.string().describe("Creation date/time").regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ"
  ).optional(),
  dueDate: zod.z.string().describe("Due date/time").regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "Invalid date format. Use YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.SSSZ"
  ).optional(),
  discussionToResolve: zod.z.string({
    description: 'Id of a discussion to resolve. Use in combination with "merge_request_to_resolve_discussions_of"'
  }).optional(),
  epicId: zod.z.number({ description: "Id of the linked Epic" }).min(0, "Valid values should be equal or greater than zero").optional(),
  labels: zod.z.string({ description: "Labels to apply" }).optional(),
  issueType: zod.z.nativeEnum(IssueType, {
    description: "Type of the issue"
  }).optional(),
  mergeRequestToResolveDiscussionsOf: zod.z.number({
    description: "IID of a merge request in which to resolve all issues"
  }).optional(),
  milestoneId: zod.z.number({ description: "Global ID of a milestone to assign the issue" }).optional(),
  weight: zod.z.number({ description: "The issue weight" }).min(0).refine((value) => {
    const isValid = value >= 0;
    if (!isValid) {
      return {
        message: "Valid values should be equal or greater than zero"
      };
    }
    return isValid;
  }).optional()
});
const issueOutputProperties = zod.z.object({
  issueUrl: zod.z.string({ description: "Issue Url" }),
  issueId: zod.z.number({ description: "Issue Id" }),
  issueIid: zod.z.number({ description: "Issue Iid" })
});
const createGitlabIssueAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:issues:create",
    description: "Creates a Gitlab issue.",
    examples: examples$3,
    schema: {
      input: commonGitlabConfig.merge(issueInputProperties),
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
        } = commonGitlabConfig.merge(issueInputProperties).parse(ctx.input);
        const { host } = parseRepoUrl(repoUrl, integrations);
        const api = getClient({ host, integrations, token });
        let isEpicScoped = false;
        if (epicId) {
          isEpicScoped = await checkEpicScope(
            api,
            projectId,
            epicId
          );
          if (isEpicScoped) {
            ctx.logger.info("Epic is within Project Scope");
          } else {
            ctx.logger.warn(
              "Chosen epic is not within the Project Scope. The issue will be created without an associated epic."
            );
          }
        }
        const mappedCreatedAt = convertDate(
          String(createdAt),
          (/* @__PURE__ */ new Date()).toISOString()
        );
        const mappedDueDate = dueDate ? convertDate(String(dueDate), (/* @__PURE__ */ new Date()).toISOString()) : void 0;
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
        if (error instanceof zod.z.ZodError) {
          throw new errors.InputError(`Validation error: ${error.message}`, {
            validationErrors: error.errors
          });
        }
        throw new errors.InputError(`Failed to create GitLab issue: ${error.message}`);
      }
    }
  });
};

const examples$2 = [
  {
    description: "Initializes a git repository with the content in the workspace, and publishes it to GitLab with the default configuration.",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
                protected: true,
                ref: "master"
              },
              {
                name: "master",
                protected: true
              }
            ]
          }
        }
      ]
    })
  },
  {
    description: "Initializes a GitLab repository with environment variables.",
    example: yaml__default.default.stringify({
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

function createPublishGitlabAction(options) {
  const { integrations, config } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "publish:gitlab",
    description: "Initializes a git repository of the content in the workspace, and publishes it to GitLab.",
    examples: examples$2,
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
      var _a, _b, _c, _d, _e;
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
      const { owner, repo, host } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      if (!owner) {
        throw new errors.InputError(
          `No owner provided for host: ${host}, and repo ${repo}`
        );
      }
      const integrationConfig = integrations.gitlab.byHost(host);
      if (!integrationConfig) {
        throw new errors.InputError(
          `No matching integration configuration for host ${host}, please check your integrations config`
        );
      }
      if (!integrationConfig.config.token && !ctx.input.token) {
        throw new errors.InputError(`No token available for host ${host}`);
      }
      const token = ctx.input.token || integrationConfig.config.token;
      const tokenType = ctx.input.token ? "oauthToken" : "token";
      const client = new node.Gitlab({
        host: integrationConfig.config.baseUrl,
        [tokenType]: token
      });
      let targetNamespaceId;
      try {
        const namespaceResponse = await client.Namespaces.show(owner);
        targetNamespaceId = namespaceResponse.id;
      } catch (e) {
        if (e.response && e.response.statusCode === 404) {
          throw new errors.InputError(
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
        const adminClient = new node.Gitlab({
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
      const commitResult = await pluginScaffolderNode.initRepoAndPush({
        dir: pluginScaffolderNode.getRepoSourceDirectory(ctx.workspacePath, ctx.input.sourcePath),
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
              throw new errors.InputError(
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
              throw new errors.InputError(
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
            variable_type: (_a = variable.variable_type) != null ? _a : "env_var",
            protected: (_b = variable.protected) != null ? _b : false,
            masked: (_c = variable.masked) != null ? _c : false,
            raw: (_d = variable.raw) != null ? _d : false,
            environment_scope: (_e = variable.environment_scope) != null ? _e : "*"
          });
          try {
            await client.ProjectVariables.create(
              projectId,
              variableWithDefaults
            );
          } catch (e) {
            throw new errors.InputError(
              `Environment variable creation failed for ${variableWithDefaults.key}. ${printGitlabError(e)}`
            );
          }
        }
      }
      ctx.output("commitHash", commitResult == null ? void 0 : commitResult.commitHash);
      ctx.output("remoteUrl", remoteUrl);
      ctx.output("repoContentsUrl", repoContentsUrl);
      ctx.output("projectId", projectId);
    }
  });
}
function printGitlabError(error) {
  return JSON.stringify({ code: error.code, message: error.description });
}

function createGitlabApi(options) {
  const { integrations, token: providedToken, repoUrl } = options;
  const { host } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  if (!integrationConfig.config.token && !providedToken) {
    throw new errors.InputError(`No token available for host ${host}`);
  }
  const token = providedToken != null ? providedToken : integrationConfig.config.token;
  const tokenType = providedToken ? "oauthToken" : "token";
  return new node.Gitlab({
    host: integrationConfig.config.baseUrl,
    [tokenType]: token
  });
}

const examples$1 = [
  {
    description: "Create a merge request with a specific assignee",
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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
    example: yaml__default.default.stringify({
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

const createPublishGitlabMergeRequestAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "publish:gitlab:merge-request",
    examples: examples$1,
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
      const { owner, repo, project } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
      const repoID = project ? project : `${owner}/${repo}`;
      const api = createGitlabApi({
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
        fileRoot = backendPluginApi.resolveSafeChildPath(ctx.workspacePath, sourcePath);
      } else if (targetPath) {
        fileRoot = backendPluginApi.resolveSafeChildPath(ctx.workspacePath, targetPath);
      } else {
        fileRoot = ctx.workspacePath;
      }
      const fileContents = await pluginScaffolderNode.serializeDirectoryContents(fileRoot, {
        gitignore: true
      });
      const actions = fileContents.map((file) => {
        var _a;
        return {
          action: (_a = ctx.input.commitAction) != null ? _a : "create",
          filePath: targetPath ? path__default.default.posix.join(targetPath, file.path) : file.path,
          encoding: "base64",
          content: file.content.toString("base64"),
          execute_filemode: file.executable
        };
      });
      let targetBranch = targetBranchName;
      if (!targetBranch) {
        const projects = await api.Projects.show(repoID);
        const { default_branch: defaultBranch } = projects;
        targetBranch = defaultBranch;
      }
      try {
        await api.Branches.create(repoID, branchName, String(targetBranch));
      } catch (e) {
        throw new errors.InputError(
          `The branch creation failed. Please check that your repo does not already contain a branch named '${branchName}'. ${e}`
        );
      }
      try {
        await api.Commits.create(repoID, branchName, ctx.input.title, actions);
      } catch (e) {
        throw new errors.InputError(
          `Committing the changes to ${branchName} failed. Please check that none of the files created by the template already exists. ${e}`
        );
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
        throw new errors.InputError(`Merge request creation failed${e}`);
      }
    }
  });
};

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

const createGitlabRepoPushAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:repo:push",
    examples,
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
      var _a;
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
      const api = createGitlabApi({
        integrations,
        token,
        repoUrl
      });
      let fileRoot;
      if (sourcePath) {
        fileRoot = backendPluginApi.resolveSafeChildPath(ctx.workspacePath, sourcePath);
      } else {
        fileRoot = ctx.workspacePath;
      }
      const fileContents = await pluginScaffolderNode.serializeDirectoryContents(fileRoot, {
        gitignore: true
      });
      const actions = fileContents.map((file) => ({
        action: commitAction != null ? commitAction : "create",
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
        if (((_a = e.response) == null ? void 0 : _a.statusCode) !== 404) {
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
          createGitlabGroupEnsureExistsAction({ integrations }),
          createGitlabIssueAction({ integrations }),
          createGitlabProjectAccessTokenAction({ integrations }),
          createGitlabProjectDeployTokenAction({ integrations }),
          createGitlabProjectVariableAction({ integrations }),
          createGitlabRepoPushAction({ integrations }),
          createPublishGitlabAction({ config, integrations }),
          createPublishGitlabMergeRequestAction({ integrations })
        );
      }
    });
  }
});

index_cjs.IssueType = IssueType;
index_cjs.createGitlabGroupEnsureExistsAction = createGitlabGroupEnsureExistsAction;
index_cjs.createGitlabIssueAction = createGitlabIssueAction;
index_cjs.createGitlabProjectAccessTokenAction = createGitlabProjectAccessTokenAction;
index_cjs.createGitlabProjectDeployTokenAction = createGitlabProjectDeployTokenAction;
index_cjs.createGitlabProjectVariableAction = createGitlabProjectVariableAction;
index_cjs.createGitlabRepoPushAction = createGitlabRepoPushAction;
index_cjs.createPublishGitlabAction = createPublishGitlabAction;
index_cjs.createPublishGitlabMergeRequestAction = createPublishGitlabMergeRequestAction;
var _default = index_cjs.default = gitlabModule;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
