'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var errors = require('@backstage/errors');
var helpers = require('./helpers.cjs.js');
var gitlabRepoPush_examples = require('./gitlabRepoPush.examples.cjs.js');

const createGitlabProjectMigrateAction = (options) => {
  const { integrations } = options;
  return pluginScaffolderNode.createTemplateAction({
    id: "gitlab:group:migrate",
    examples: gitlabRepoPush_examples.examples,
    schema: {
      input: {
        required: [
          "destinationAccessToken",
          "destinationUrl",
          "sourceAccessToken",
          "sourceFullPath",
          "sourceUrl"
        ],
        type: "object",
        properties: {
          destinationAccessToken: {
            type: "string",
            title: "Target Repository Access Token",
            description: `The token to use for authorization to the target GitLab'`
          },
          destinationUrl: {
            type: "string",
            title: "Target Project Location",
            description: `Accepts the format 'gitlab.com?repo=project_name&owner=group_name' where 'project_name' is the repository name and 'group_name' is a group or username`
          },
          sourceAccessToken: {
            type: "string",
            title: "Source Group Access Token",
            description: `The token to use for authorization to the source GitLab'`
          },
          sourceFullPath: {
            type: "string",
            title: "Group Full Path",
            description: "Full path to the project in the source Gitlab instance"
          },
          sourceUrl: {
            type: "string",
            title: "Source URL Location",
            description: `Accepts the format 'https://gitlab.com/'`
          }
        }
      },
      output: {
        type: "object",
        properties: {
          importedRepoUrl: {
            title: "URL to the newly imported repo",
            type: "string"
          },
          migrationId: {
            title: "Id of the migration that imports the project",
            type: "number"
          }
        }
      }
    },
    async handler(ctx) {
      const {
        destinationAccessToken,
        destinationUrl,
        sourceAccessToken,
        sourceFullPath,
        sourceUrl
      } = ctx.input;
      const {
        host: destinationHost,
        repo: destinationSlug,
        owner: destinationNamespace
      } = pluginScaffolderNode.parseRepoUrl(destinationUrl, integrations);
      if (!destinationNamespace) {
        throw new errors.InputError(
          `Failed to determine target repository to migrate to. Make sure destinationUrl matches the format 'gitlab.myorg.com?repo=project_name&owner=group_name'`
        );
      }
      const api = helpers.createGitlabApi({
        integrations,
        token: destinationAccessToken,
        repoUrl: destinationUrl
      });
      const migrationEntity = [
        {
          sourceType: "project_entity",
          sourceFullPath,
          destinationSlug,
          destinationNamespace
        }
      ];
      const sourceConfig = {
        url: sourceUrl,
        access_token: sourceAccessToken
      };
      try {
        const { id: migrationId } = await api.Migrations.create(
          sourceConfig,
          migrationEntity
        );
        ctx.output(
          "importedRepoUrl",
          `${destinationHost}/${destinationNamespace}/${destinationSlug}`
        );
        ctx.output("migrationId", migrationId);
      } catch (e) {
        throw new errors.InputError(
          `Failed to transfer repo ${sourceFullPath}. Make sure that ${sourceFullPath} exists in ${sourceUrl}, and token has enough rights.
Error: ${e}`
        );
      }
    }
  });
};

exports.createGitlabProjectMigrateAction = createGitlabProjectMigrateAction;
//# sourceMappingURL=gitlabProjectMigrate.cjs.js.map
