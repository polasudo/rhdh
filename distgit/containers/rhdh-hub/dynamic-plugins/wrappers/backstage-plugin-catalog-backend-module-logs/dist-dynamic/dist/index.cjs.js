'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$1 = require('@backstage/plugin-catalog-backend');
var require$$2 = require('@backstage/plugin-events-node');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendPluginApi = require$$0;
var pluginCatalogBackend = require$$1;
var pluginEventsNode = require$$2;

const catalogModuleLogs = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "logs",
  register(env) {
    env.registerInit({
      deps: {
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ events, logger }) {
        events.subscribe({
          id: "catalog",
          topics: [pluginCatalogBackend.CATALOG_ERRORS_TOPIC],
          async onEvent(params) {
            const event = params;
            const { entity, location, errors } = event.eventPayload;
            for (const error of errors) {
              logger.warn(error.message, {
                entity,
                location
              });
            }
          }
        });
      }
    });
  }
});

var _default = index_cjs.default = catalogModuleLogs;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
