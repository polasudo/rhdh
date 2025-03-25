'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');

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
        undefined
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

exports.createQuayRepositoryAction = createQuayRepositoryAction;
//# sourceMappingURL=createQuayRepository.cjs.js.map
