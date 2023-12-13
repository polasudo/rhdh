'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginSearchBackendModuleTechdocs = require('@backstage/plugin-search-backend-module-techdocs');
var backendCommon = require('@backstage/backend-common');
var pluginTechdocsBackend = require('@backstage/plugin-techdocs-backend');
var Docker = require('dockerode');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Docker__default = /*#__PURE__*/_interopDefaultLegacy(Docker);

async function buildRouter(env) {
  const preparers = await pluginTechdocsBackend.Preparers.fromConfig(env.config, {
    logger: env.logger,
    reader: env.reader
  });
  const dockerClient = new Docker__default["default"]();
  const containerRunner = new backendCommon.DockerContainerRunner({ dockerClient });
  const generators = await pluginTechdocsBackend.Generators.fromConfig(env.config, {
    logger: env.logger,
    containerRunner
  });
  const publisher = await pluginTechdocsBackend.Publisher.fromConfig(env.config, {
    logger: env.logger,
    discovery: env.discovery
  });
  await publisher.getReadiness();
  return await pluginTechdocsBackend.createRouter({
    preparers,
    generators,
    publisher,
    logger: env.logger,
    config: env.config,
    discovery: env.discovery,
    cache: env.cache
  });
}

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "techdocs",
    createPlugin: buildRouter
  },
  search(indexBuilder, schedule, env) {
    indexBuilder.addCollator({
      schedule,
      factory: pluginSearchBackendModuleTechdocs.DefaultTechDocsCollatorFactory.fromConfig(env.config, {
        discovery: env.discovery,
        logger: env.logger,
        tokenManager: env.tokenManager
      })
    });
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
