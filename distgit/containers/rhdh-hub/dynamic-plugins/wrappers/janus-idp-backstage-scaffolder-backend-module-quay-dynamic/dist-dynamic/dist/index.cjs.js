'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/plugin-scaffolder-node');
var require$$0$1 = require('@backstage/backend-plugin-api');
var require$$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs = {};

var createQuayRepository_cjs = {};

var pluginScaffolderNode = require$$0;

const getUrl = (url) => {
  if (!url) {
    return "https://quay.io";
  }
  try {
    new URL(url);
  } catch (error) {
    throw new Error('"baseUrl" is invalid');
  }
  return url;
};
const isValueValid = (value, valueName, valueOpts) => {
  if (valueOpts.includes(value)) {
    return;
  }
  throw new Error(
    `For the "${valueName}" parameter "${value}" is not a valid option, available options are: ${valueOpts.map((v) => v || "none").join(", ")}`
  );
};
function createQuayRepositoryAction() {
  return pluginScaffolderNode.createTemplateAction({
    id: "quay:create-repository",
    description: "Create an quay image repository",
    schema: {
      input: {
        type: "object",
        required: ["name", "visibility", "description", "token"],
        properties: {
          name: {
            title: "Repository name",
            description: "Name of the repository to be created",
            type: "string"
          },
          visibility: {
            title: "Visibility setting",
            description: "Visibility setting for the created repository, either public or private",
            type: "string"
          },
          description: {
            title: "Repository description",
            description: "The repository desription",
            type: "string"
          },
          token: {
            title: "Token",
            description: "Bearer token used for authorization",
            type: "string"
          },
          baseUrl: {
            title: "Base URL",
            description: 'URL of your quay instance, set to "https://quay.io" by default',
            type: "string"
          },
          namespace: {
            title: "Namespace",
            description: "Namespace in which to create the repository, by default the users namespace",
            type: "string"
          },
          repoKind: {
            title: "Repository kind",
            description: "The crated repository type either image or an application, if empty image will be used",
            type: "string"
          }
        }
      },
      output: {
        type: "object",
        properties: {
          repositoryUrl: {
            title: "Quay image repository URL",
            type: "string",
            description: "Created repository URL link"
          }
        }
      }
    },
    async handler(ctx) {
      const { token, name, visibility, namespace, description, repoKind } = ctx.input;
      const baseUrl = getUrl(ctx.input.baseUrl);
      isValueValid(visibility, "visibility", ["public", "private"]);
      isValueValid(repoKind, "repository kind", [
        "application",
        "image",
        void 0
      ]);
      const params = {
        description,
        repository: name,
        visibility,
        namespace,
        repo_kind: repoKind
      };
      const uri = encodeURI(`${baseUrl}/api/v1/repository`);
      const response = await fetch(uri, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params),
        method: "POST"
      });
      if (!response.ok) {
        const errorBody = await response.json();
        const errorStatus = errorBody.status || response.status;
        const errorMsg = errorBody.detail || errorBody.error;
        throw new Error(
          `Failed to create Quay repository, ${errorStatus} -- ${errorMsg}`
        );
      }
      const body = await response.json();
      ctx.output(
        "repositoryUrl",
        `${baseUrl}/repository/${body.namespace}/${body.name}`
      );
    }
  });
}

createQuayRepository_cjs.createQuayRepositoryAction = createQuayRepositoryAction;

var module_cjs = {};

var backendPluginApi = require$$0$1;
var alpha = require$$1;
var createQuayRepository$1 = createQuayRepository_cjs;

const scaffolderModuleQuayAction = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-quay",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint
      },
      async init({ scaffolder }) {
        scaffolder.addActions(createQuayRepository$1.createQuayRepositoryAction());
      }
    });
  }
});

module_cjs.scaffolderModuleQuayAction = scaffolderModuleQuayAction;

Object.defineProperty(index_cjs, '__esModule', { value: true });

var createQuayRepository = createQuayRepository_cjs;
var module$1 = module_cjs;



index_cjs.createQuayRepositoryAction = createQuayRepository.createQuayRepositoryAction;
var _default = index_cjs.default = module$1.scaffolderModuleQuayAction;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
