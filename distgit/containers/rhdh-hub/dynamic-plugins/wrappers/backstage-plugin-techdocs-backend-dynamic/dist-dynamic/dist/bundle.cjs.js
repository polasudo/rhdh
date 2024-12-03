'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var techdocsSearchModule = require('@backstage/plugin-search-backend-module-techdocs/alpha');
var techdocsPlugin = require('@backstage/plugin-techdocs-backend/alpha');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var techdocsSearchModule__default = /*#__PURE__*/_interopDefaultCompat(techdocsSearchModule);
var techdocsPlugin__default = /*#__PURE__*/_interopDefaultCompat(techdocsPlugin);

const bundle = backendPluginApi.createBackendFeatureLoader({
  async loader() {
    return [techdocsPlugin__default.default, techdocsSearchModule__default.default];
  }
});

exports.bundle = bundle;
//# sourceMappingURL=bundle.cjs.js.map
