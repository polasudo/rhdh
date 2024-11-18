'use strict';

var backendCommon = require('@backstage/backend-common');
var router = require('./service/router.cjs.js');

async function createRouter(options) {
  return router.createRouter({
    ...options,
    ...backendCommon.createLegacyAuthAdapters(options)
  });
}

exports.createRouter = createRouter;
//# sourceMappingURL=deprecated.cjs.js.map
