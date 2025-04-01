'use strict';

var express = require('express');
var Router = require('express-promise-router');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var createSearchParams = require('./utils/createSearchParams.cjs.js');
var removeVerboseSpecContent = require('./utils/removeVerboseSpecContent.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

async function createRouter({
  marketplaceApi
}) {
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.get("/collections", async (req, res) => {
    const request = backstagePluginMarketplaceCommon.decodeGetEntitiesRequest(createSearchParams.createSearchParams(req));
    const collections = await marketplaceApi.getCollections(request);
    res.json(collections);
  });
  router.get("/collections/facets", async (req, res) => {
    const request = backstagePluginMarketplaceCommon.decodeGetEntityFacetsRequest(createSearchParams.createSearchParams(req));
    const facets = await marketplaceApi.getCollectionsFacets(request);
    res.json(facets);
  });
  router.get("/collection/:namespace/:name", async (req, res) => {
    const collection = await marketplaceApi.getCollectionByName(
      req.params.namespace,
      req.params.name
    );
    res.json(collection);
  });
  router.get("/collection/:namespace/:name/plugins", async (req, res) => {
    const plugins = await marketplaceApi.getCollectionPlugins(
      req.params.namespace,
      req.params.name
    );
    removeVerboseSpecContent.removeVerboseSpecContent(plugins);
    res.json(plugins);
  });
  router.get("/packages", async (req, res) => {
    const request = backstagePluginMarketplaceCommon.decodeGetEntitiesRequest(createSearchParams.createSearchParams(req));
    const packages = await marketplaceApi.getPackages(request);
    removeVerboseSpecContent.removeVerboseSpecContent(packages.items);
    res.json(packages);
  });
  router.get("/packages/facets", async (req, res) => {
    const request = backstagePluginMarketplaceCommon.decodeGetEntityFacetsRequest(createSearchParams.createSearchParams(req));
    const facets = await marketplaceApi.getPackagesFacets(request);
    res.json(facets);
  });
  router.get("/package/:namespace/:name", async (req, res) => {
    res.json(
      await marketplaceApi.getPackageByName(
        req.params.namespace,
        req.params.name
      )
    );
  });
  router.get("/plugins", async (req, res) => {
    const request = backstagePluginMarketplaceCommon.decodeGetEntitiesRequest(createSearchParams.createSearchParams(req));
    const plugins = await marketplaceApi.getPlugins(request);
    removeVerboseSpecContent.removeVerboseSpecContent(plugins.items);
    res.json(plugins);
  });
  router.get("/plugins/facets", async (req, res) => {
    const request = backstagePluginMarketplaceCommon.decodeGetEntityFacetsRequest(createSearchParams.createSearchParams(req));
    const facets = await marketplaceApi.getPluginFacets(request);
    res.json(facets);
  });
  router.get("/plugin/:namespace/:name", async (req, res) => {
    const plugin = await marketplaceApi.getPluginByName(
      req.params.namespace,
      req.params.name
    );
    res.json(plugin);
  });
  router.get("/plugin/:namespace/:name/packages", async (req, res) => {
    const packages = await marketplaceApi.getPluginPackages(
      req.params.namespace,
      req.params.name
    );
    removeVerboseSpecContent.removeVerboseSpecContent(packages);
    res.json(packages);
  });
  return router;
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
