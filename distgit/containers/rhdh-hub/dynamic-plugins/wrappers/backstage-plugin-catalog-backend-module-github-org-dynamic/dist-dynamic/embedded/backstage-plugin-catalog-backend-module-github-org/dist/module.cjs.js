'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var pluginCatalogBackendModuleGithub = require('@backstage/plugin-catalog-backend-module-github');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginEventsNode = require('@backstage/plugin-events-node');
var GithubOrgEntityCleanerProvider = require('./GithubOrgEntityCleanerProvider.cjs.js');

const githubOrgEntityProviderTransformsExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "catalog.githubOrgEntityProvider"
});
const catalogModuleGithubOrgEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "github-org-entity-provider",
  register(env) {
    let userTransformer;
    let teamTransformer;
    env.registerExtensionPoint(
      githubOrgEntityProviderTransformsExtensionPoint,
      {
        setUserTransformer(transformer) {
          if (userTransformer) {
            throw new Error("User transformer may only be set once");
          }
          userTransformer = transformer;
        },
        setTeamTransformer(transformer) {
          if (teamTransformer) {
            throw new Error("Team transformer may only be set once");
          }
          teamTransformer = transformer;
        }
      }
    );
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, events, logger, scheduler }) {
        const definitions = readDefinitionsFromConfig(config);
        for (const definition of definitions) {
          catalog.addEntityProvider(
            new GithubOrgEntityCleanerProvider.GithubOrgEntityCleanerProvider({ id: definition.id, logger })
          );
          catalog.addEntityProvider(
            pluginCatalogBackendModuleGithub.GithubMultiOrgEntityProvider.fromConfig(config, {
              id: definition.id,
              githubUrl: definition.githubUrl,
              orgs: definition.orgs,
              events,
              schedule: scheduler.createScheduledTaskRunner(
                definition.schedule
              ),
              logger,
              userTransformer,
              teamTransformer,
              alwaysUseDefaultNamespace: definitions.length === 1 && definition.orgs?.length === 1
            })
          );
        }
      }
    });
  }
});
function readDefinitionsFromConfig(rootConfig) {
  const baseKey = "catalog.providers.githubOrg";
  const baseConfig = rootConfig.getOptional(baseKey);
  if (!baseConfig) {
    return [];
  }
  const configs = Array.isArray(baseConfig) ? rootConfig.getConfigArray(baseKey) : [rootConfig.getConfig(baseKey)];
  return configs.map((c) => ({
    id: c.getString("id"),
    githubUrl: c.getString("githubUrl"),
    orgs: c.getOptionalStringArray("orgs"),
    schedule: backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
      c.getConfig("schedule")
    )
  }));
}

exports.catalogModuleGithubOrgEntityProvider = catalogModuleGithubOrgEntityProvider;
exports.githubOrgEntityProviderTransformsExtensionPoint = githubOrgEntityProviderTransformsExtensionPoint;
//# sourceMappingURL=module.cjs.js.map
