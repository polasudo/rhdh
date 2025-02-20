'use strict';

var express = require('express');
var Router = require('express-promise-router');
var errors = require('@backstage/errors');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

async function createRouter(options) {
  const { logger, sonarqubeInfoProvider } = options;
  const router = Router__default.default();
  router.use(express__default.default.json());
  router.get("/findings", async (request, response) => {
    const componentKey = request.query.componentKey;
    const instanceKey = request.query.instanceKey;
    if (!componentKey)
      throw new errors.InputError("ComponentKey must be provided as a single string.");
    logger.info(
      instanceKey ? `Retrieving findings for component ${componentKey}  in sonarqube instance name ${instanceKey}` : `Retrieving findings for component ${componentKey} in default sonarqube instance`
    );
    response.json(
      await sonarqubeInfoProvider.getFindings({
        componentKey,
        instanceName: instanceKey
      })
    );
  });
  router.get("/instanceUrl", (request, response) => {
    const instanceKey = request.query.instanceKey;
    logger.info(
      instanceKey ? `Retrieving sonarqube instance URL for key ${instanceKey}` : `Retrieving default sonarqube instance URL as instanceKey is not provided`
    );
    const { baseUrl, externalBaseUrl } = sonarqubeInfoProvider.getBaseUrl({
      instanceName: instanceKey
    });
    response.json({
      instanceUrl: externalBaseUrl || baseUrl
    });
  });
  return router;
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
