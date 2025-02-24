'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
require('@backstage/catalog-model');
require('@backstage/errors');
require('@backstage-community/plugin-ocm-common');
require('@kubernetes/client-node');
require('semver');
var module$1 = require('./providers/module.cjs.js');
var router = require('./service/router.cjs.js');

const bundle = backendPluginApi.createBackendFeatureLoader({
  async loader() {
    return [module$1.catalogModuleOCMEntityProvider, router.ocmPlugin];
  }
});

exports.bundle = bundle;
//# sourceMappingURL=bundle.cjs.js.map
