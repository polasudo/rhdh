'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/backend-defaults/rootHttpRouter');
var require$$1 = require('express');
var require$$2 = require('express-promise-router');
var zod = require('zod');
var require$$0$2 = require('@backstage/backend-plugin-api');

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var index_cjs$1 = {};

var router_cjs = {};

var index_cjs = {};

var MovedState = /* @__PURE__ */ ((MovedState2) => {
  MovedState2[MovedState2["Down"] = -1] = "Down";
  MovedState2[MovedState2["NoChange"] = 0] = "NoChange";
  MovedState2[MovedState2["Up"] = 1] = "Up";
  return MovedState2;
})(MovedState || {});

const RadarRingParser = zod.z.object({
  // ID of the Ring
  id: zod.z.string(),
  // Display name of the Ring
  name: zod.z.string(),
  // Color used for entries in particular Ring, Supports any value parseable by {@link https://www.npmjs.com/package/color-string | color-string}
  color: zod.z.string(),
  // Description of the Ring
  description: zod.z.string().optional()
});
const RadarQuadrantParser = zod.z.object({
  // ID of the Quadrant
  id: zod.z.string(),
  // Display name of the Quadrant
  name: zod.z.string()
});
const RadarEntryLinkParser = zod.z.object({
  // URL of the link
  url: zod.z.string(),
  // Display name of the link
  title: zod.z.string()
});
const RadarEntrySnapshotParser = zod.z.object({
  // Point in time when change happened
  date: zod.z.coerce.date(),
  // ID of {@link RadarRing}
  ringId: zod.z.string(),
  // Description of change
  description: zod.z.string().optional(),
  // Indicates trend compared to previous snapshot
  moved: zod.z.nativeEnum(MovedState).optional()
});
const RadarEntryParser = zod.z.object({
  // React key to use for this Entry
  key: zod.z.string(),
  // ID of this Radar Entry
  id: zod.z.string(),
  // ID of {@link RadarQuadrant} this Entry belongs to
  quadrant: zod.z.string(),
  // Display name of the Entry
  title: zod.z.string(),
  // User-clickable URL when rendered in Radar
  url: zod.z.string().optional(),
  // History of the Entry moving through {@link RadarRing}
  timeline: zod.z.array(RadarEntrySnapshotParser),
  // Description of the Entry
  description: zod.z.string().optional(),
  // User-clickable links to provide more information about the Entry
  links: zod.z.array(RadarEntryLinkParser).optional()
});
const TechRadarLoaderResponseParser = zod.z.object({
  quadrants: zod.z.array(RadarQuadrantParser),
  rings: zod.z.array(RadarRingParser),
  entries: zod.z.array(RadarEntryParser)
});

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	MovedState: MovedState,
	TechRadarLoaderResponseParser: TechRadarLoaderResponseParser
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var pluginTechRadarCommon = require$$0;

async function readTechRadarResponseFromURL(url, urlReader, logger) {
  let buffer = void 0;
  let responseJson = void 0;
  try {
    const response = await urlReader.readUrl(url);
    buffer = await response.buffer();
  } catch (e) {
    logger.warn(
      `Failed to read file from ${url} with provided integrations (error is "${e.message}").`
    );
  }
  if (buffer) {
    try {
      responseJson = JSON.parse(buffer.toString());
      const validationResult = pluginTechRadarCommon.TechRadarLoaderResponseParser.safeParse(responseJson);
      if (!validationResult.success) {
        const errorMessage = `Could not parse data from remote URL '${url}' because validation failed: ${aggregateErrorMessages(
          validationResult.error
        )}. URL must serve JSON that is compatible with the TechRadarLoaderResponse schema.`;
        logger.error(errorMessage);
      }
      return validationResult.data;
    } catch (e) {
      logger.error(
        `Failed to parse JSON from remote resource ${url}, data will not be loaded!`
      );
    }
  }
  return void 0;
}
function aggregateErrorMessages(zodError) {
  return zodError.issues.reduce((acc, issue) => {
    if (issue) {
      return [acc, `${issue.message} parameter '${issue.path}'`].filter(Boolean).join(". ");
    }
    return acc;
  }, "");
}

index_cjs.readTechRadarResponseFromURL = readTechRadarResponseFromURL;

var rootHttpRouter = require$$0$1;
var express = require$$1;
var Router = require$$2;
var index = index_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

async function createRouter(options) {
  const { logger, config, reader } = options;
  const router = Router__default.default();
  router.use(express__default.default.json());
  const url = config.getString("techRadar.url");
  router.get("/health", (_, response) => {
    logger.info("PONG!");
    response.json({ status: "ok" });
  });
  router.get("/data", async (_, response) => {
    const dataFromUrl = await index.readTechRadarResponseFromURL(url, reader, logger);
    if (!dataFromUrl) {
      response.status(502).json({ message: "Unable to retrieve data from provided URL" });
      return;
    }
    response.json(dataFromUrl);
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config });
  router.use(middleware.error());
  return router;
}

router_cjs.createRouter = createRouter;

var plugin_cjs = {};

var backendPluginApi = require$$0$2;
var router$1 = router_cjs;

const techRadarPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "tech-radar",
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        reader: backendPluginApi.coreServices.urlReader
      },
      async init({ httpRouter, logger, config, reader }) {
        httpRouter.use(
          await router$1.createRouter({
            logger,
            config,
            reader
          })
        );
        httpRouter.addAuthPolicy({
          path: "/health",
          allow: "unauthenticated"
        });
      }
    });
  }
});

plugin_cjs.techRadarPlugin = techRadarPlugin;

Object.defineProperty(index_cjs$1, '__esModule', { value: true });

var router = router_cjs;
var plugin = plugin_cjs;



index_cjs$1.createRouter = router.createRouter;
var _default = index_cjs$1.default = plugin.techRadarPlugin;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
