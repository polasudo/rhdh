'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginScaffolderBackend = require('@backstage/plugin-scaffolder-backend');
var backstagePluginArgoCdBackend = require('@roadiehq/backstage-plugin-argo-cd-backend');
var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-scaffolder-node/alpha');
var backendCommon = require('@backstage/backend-common');

const createArgoCdResources = (config, logger) => {
  return pluginScaffolderBackend.createTemplateAction({
    id: "argocd:create-resources",
    schema: {
      input: {
        required: ["appName", "argoInstance", "namespace", "repoUrl", "path"],
        type: "object",
        properties: {
          projectName: {
            type: "string",
            title: "Project Name",
            description: "The name of the project as it will show up in Argo CD. By default we use the application name."
          },
          appName: {
            type: "string",
            title: "Application Name",
            description: "The name of the app as it will show up in Argo CD"
          },
          argoInstance: {
            type: "string",
            title: "Argo CD Instance",
            description: "The name of the Argo CD Instance to deploy to"
          },
          namespace: {
            type: "string",
            title: "Namespace",
            description: "The namespace Argo CD will target for resource deployment"
          },
          repoUrl: {
            type: "string",
            title: "Repository URL",
            description: "The Repo URL that will be programmed into the Argo CD project and application"
          },
          path: {
            type: "string",
            title: "path",
            description: "The path of the resources Argo CD will watch in the repository mentioned"
          },
          labelValue: {
            type: "string",
            title: "Label Value",
            description: "The label Backstage will use to find applications in Argo CD"
          }
        }
      }
    },
    async handler(ctx) {
      const argoUserName = config.getOptionalString("argocd.username") ?? "argocdUsername";
      const argoPassword = config.getOptionalString("argocd.password") ?? "argocdPassword";
      const argoSvc = new backstagePluginArgoCdBackend.ArgoService(
        argoUserName,
        argoPassword,
        config,
        logger
      );
      await argoSvc.createArgoResources({
        argoInstance: ctx.input.argoInstance,
        appName: ctx.input.appName,
        projectName: ctx.input.projectName ? ctx.input.projectName : ctx.input.appName,
        namespace: ctx.input.namespace,
        sourceRepo: ctx.input.repoUrl,
        sourcePath: ctx.input.path,
        labelValue: ctx.input.labelValue ? ctx.input.labelValue : ctx.input.appName,
        logger
      });
    }
  });
};

const scaffolderBackendArgoCD = backendPluginApi.createBackendModule({
  pluginId: "scaffolder",
  moduleId: "scaffolder-backend-argocd",
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ scaffolder, config, logger }) {
        scaffolder.addActions(
          createArgoCdResources(
            config,
            backendCommon.loggerToWinstonLogger(logger)
          )
        );
      }
    });
  }
});

exports.createArgoCdResources = createArgoCdResources;
exports.default = scaffolderBackendArgoCD;
//# sourceMappingURL=index.cjs.js.map
