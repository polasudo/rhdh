'use strict';

var express = require('express');
var Router = require('express-promise-router');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

async function createRouter({
  marketplaceService
}) {
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.get("/plugins", async (_req, res) => {
    const plugins = await marketplaceService.getPlugins();
    res.json(plugins);
  });
  router.get("/pluginlist", async (_req, res) => {
    const pluginlist = await marketplaceService.getPluginList();
    res.json(pluginlist);
  });
  return router;
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
