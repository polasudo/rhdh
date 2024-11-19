'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/plugin-scaffolder-node');
var require$$1 = require('yaml');
var require$$2 = require('querystring');
var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var createSonarQubeProject_cjs = {};

var pluginScaffolderNode = require$$0;
var yaml = require$$1;
var querystring = require$$2;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);
var querystring__default = /*#__PURE__*/_interopDefaultCompat(querystring);

const id = "sonarqube:create-project";
const examples = [
  {
    description: "Create a new SonarQube project using all the input parameters",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: id,
          id: "create-sonar-project",
          name: "Create SonarQube Project",
          input: {
            baseUrl: "https://sonarqube.com",
            token: "4518a13e-093f-4b66-afac-46a1aece3149",
            name: "My SonarQube Project",
            key: "my-sonarqube-project",
            branch: "main",
            visibility: "public"
          }
        }
      ]
    })
  },
  {
    description: "Create a new SonarQube project using only required parameters",
    example: yaml__default.default.stringify({
      steps: [
        {
          action: id,
          id: "create-sonar-project",
          name: "Create SonarQube Project",
          input: {
            baseUrl: "https://sonarqube.com",
            token: "4518a13e-093f-4b66-afac-46a1aece3149",
            name: "My SonarQube Project",
            key: "my-sonarqube-project"
          }
        }
      ]
    })
  }
];
const createSonarQubeProjectAction = () => {
  return pluginScaffolderNode.createTemplateAction({
    id,
    description: "Creates a new project in SonarQube",
    examples,
    schema: {
      input: {
        required: ["baseUrl", "name", "key"],
        type: "object",
        properties: {
          baseUrl: {
            type: "string",
            title: "Base URL",
            description: 'SonarQube server base URL. Example: "https://sonar-server.com"'
          },
          name: {
            type: "string",
            title: "Name",
            description: 'Name of the project to be created in SonarQube. Example: "My Project"'
          },
          key: {
            type: "string",
            title: "Key",
            description: 'Key of the project to identify the project in SonarQube. Example: "my-project"'
          },
          branch: {
            type: "string",
            title: "Branch",
            description: "Name of the main branch of the project. If not provided, the default main branch name will be used"
          },
          visibility: {
            type: "string",
            title: "Visibility",
            description: 'Whether the created project should be visible to everyone or only specific groups. If no visibility is specified, the default project visibility will be used. Allowed values: "public" or "private"'
          },
          token: {
            type: "string",
            title: "Token",
            description: "SonarQube authentication token. Please review the SonarQube documentation on how to create a token"
          },
          username: {
            type: "string",
            title: "Username",
            description: "SonarQube username. If a token is provided it will be used instead of username and password"
          },
          password: {
            type: "string",
            title: "Password",
            description: "SonarQube password. If a token is provided it will be used instead of username and password"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          projectUrl: {
            title: "SonarQube project URL",
            type: "string",
            description: "SonarQube project URL created by this action"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        baseUrl,
        token,
        username,
        password,
        name,
        key,
        branch,
        visibility
      } = ctx.input;
      if (!token && (!username || !password)) {
        throw new Error(
          '"token" or "username" and "password" are required input parameters'
        );
      }
      if (!baseUrl) {
        throw new Error('"baseUrl" is a required input parameter');
      }
      if (!name) {
        throw new Error('"name" is a required input parameter');
      }
      if (!key) {
        throw new Error('"key" is a required input parameter');
      }
      const requestParams = {
        name,
        project: key
      };
      if (branch) {
        requestParams.mainBranch = branch;
      }
      if (visibility) {
        requestParams.visibility = visibility;
      }
      const queryString = querystring__default.default.stringify({ ...requestParams });
      const encodedURI = encodeURI(
        `${baseUrl}/api/projects/create?${queryString}`
      );
      const authString = token ? `${token}:` : `${username}:${password}`;
      const encodedAuthString = Buffer.from(authString).toString("base64");
      const response = await fetch(encodedURI, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedAuthString}`
        },
        method: "POST"
      });
      if (!response.ok) {
        let errorMessage = response.statusText;
        if (response.status === 401) {
          errorMessage = "Unauthorized, please use a valid token or username and password";
        } else if (!response.statusText) {
          const responseBody = await response.json();
          const errorList = responseBody.errors;
          errorMessage = errorList[0].msg;
        }
        throw new Error(
          `Failed to create SonarQube project, status ${response.status} - ${errorMessage}`
        );
      }
      ctx.output("projectUrl", `${baseUrl}/dashboard?id=${key}`);
    }
  });
};

createSonarQubeProject_cjs.createSonarQubeProjectAction = createSonarQubeProjectAction;

var module_cjs = {};

var backendPluginApi = require$$0$1;
var alpha = require$$1$1;
var createSonarQubeProject$1 = createSonarQubeProject_cjs;

const scaffolderModuleSonarqubeActions = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-sonarqube",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(createSonarQubeProject$1.createSonarQubeProjectAction());
      }
    });
  }
});

module_cjs.scaffolderModuleSonarqubeActions = scaffolderModuleSonarqubeActions;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var createSonarQubeProject = createSonarQubeProject_cjs;
var module$1 = module_cjs;



index_cjs.createSonarQubeProjectAction = createSonarQubeProject.createSonarQubeProjectAction;
var _default = index_cjs.default = module$1.scaffolderModuleSonarqubeActions;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
