'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var techdocsPlugin = require('@backstage/plugin-techdocs-backend/alpha');
var techdocsSearchModule = require('@backstage/plugin-search-backend-module-techdocs/alpha');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var techdocsPlugin__default = /*#__PURE__*/_interopDefaultLegacy(techdocsPlugin);
var techdocsSearchModule__default = /*#__PURE__*/_interopDefaultLegacy(techdocsSearchModule);

const dynamicPluginInstaller = {
  kind: "new",
  install: () => [techdocsPlugin__default["default"](), techdocsSearchModule__default["default"]()]
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
