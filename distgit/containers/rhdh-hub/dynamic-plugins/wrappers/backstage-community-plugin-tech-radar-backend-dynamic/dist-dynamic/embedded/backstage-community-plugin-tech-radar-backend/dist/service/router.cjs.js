'use strict';

var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');
var express = require('express');
var Router = require('express-promise-router');
var index = require('../utils/index.cjs.js');

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

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
