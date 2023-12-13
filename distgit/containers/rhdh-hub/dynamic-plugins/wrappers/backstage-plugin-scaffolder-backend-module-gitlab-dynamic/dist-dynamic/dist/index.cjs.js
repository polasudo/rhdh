'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var integration = require('@backstage/integration');
var require$$0 = require('@backstage/plugin-scaffolder-node');
var require$$1 = require('@gitbeaker/node');
var require$$2 = require('zod');
var require$$3 = require('@backstage/errors');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var pluginScaffolderNode = require$$0;
var node = require$$1;
var zod = require$$2;
var errors = require$$3;

const commonGitlabConfig = zod.z.object({
  repoUrl: zod.z.string({ description: "Repository Location" }),
  token: zod.z.string({ description: "The token to use for authorization to GitLab" }).optional()
});

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
  const tokenType = config.token ? "oauthToken" : "token";
  if (tokenType === "oauthToken") {
    throw new errors.InputError(`OAuth Token is currently not supported`);
  }
  return { token, integrationConfig };
};

const createGitlabGroupEnsureExistsAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:group:ensureExists",
    description: "Ensures a Gitlab group exists",
    supportsDryRun: true,
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

const createGitlabProjectDeployTokenAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:projectDeployToken:create",
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

const createGitlabProjectAccessTokenAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:projectAccessToken:create",
    schema: {
      input: commonGitlabConfig.merge(
        zod.z.object({
          projectId: zod.z.union([zod.z.number(), zod.z.string()], {
            description: "Project ID"
          }),
          name: zod.z.string({ description: "Deploy Token Name" }).optional(),
          accessLevel: zod.z.number({ description: "Access Level of the Token" }).optional(),
          scopes: zod.z.array(zod.z.string(), { description: "Scopes" }).optional()
        })
      ),
      output: zod.z.object({
        access_token: zod.z.string({ description: "Access Token" })
      })
    },
    async handler(ctx) {
      ctx.logger.info(`Creating Token for Project "${ctx.input.projectId}"`);
      const { projectId, name, accessLevel, scopes } = ctx.input;
      const { token, integrationConfig } = getToken(ctx.input, integrations);
      const response = await fetch(
        `${integrationConfig.config.baseUrl}/api/v4/projects/${projectId}/access_tokens`,
        {
          method: "POST",
          // *GET, POST, PUT, DELETE, etc.
          headers: {
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            scopes,
            access_level: accessLevel
          })
        }
      );
      const result = await response.json();
      ctx.output("access_token", result.token);
    }
  });
};

const createGitlabProjectVariableAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:projectVariable:create",
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

var createGitlabGroupEnsureExistsAction_1 = index_cjs.createGitlabGroupEnsureExistsAction = createGitlabGroupEnsureExistsAction;
var createGitlabProjectAccessTokenAction_1 = index_cjs.createGitlabProjectAccessTokenAction = createGitlabProjectAccessTokenAction;
var createGitlabProjectDeployTokenAction_1 = index_cjs.createGitlabProjectDeployTokenAction = createGitlabProjectDeployTokenAction;
var createGitlabProjectVariableAction_1 = index_cjs.createGitlabProjectVariableAction = createGitlabProjectVariableAction;

const dynamicPluginInstaller = {
  kind: "legacy",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scaffolder(env) {
    const integrations = integration.ScmIntegrations.fromConfig(env.config);
    return [
      createGitlabProjectAccessTokenAction_1({ integrations }),
      createGitlabProjectDeployTokenAction_1({ integrations }),
      createGitlabProjectVariableAction_1({ integrations }),
      createGitlabGroupEnsureExistsAction_1({ integrations })
    ];
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
