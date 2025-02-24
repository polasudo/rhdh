'use strict';

const MARKETPLACE_API_VERSION = "marketplace.backstage.io/v1alpha1";
var MarketplaceKinds = /* @__PURE__ */ ((MarketplaceKinds2) => {
  MarketplaceKinds2["plugin"] = "Plugin";
  MarketplaceKinds2["pluginList"] = "PluginList";
  return MarketplaceKinds2;
})(MarketplaceKinds || {});
var InstallStatus = /* @__PURE__ */ ((InstallStatus2) => {
  InstallStatus2["NotInstalled"] = "NotInstalled";
  InstallStatus2["Installed"] = "Installed";
  return InstallStatus2;
})(InstallStatus || {});

exports.InstallStatus = InstallStatus;
exports.MARKETPLACE_API_VERSION = MARKETPLACE_API_VERSION;
exports.MarketplaceKinds = MarketplaceKinds;
//# sourceMappingURL=types.cjs.js.map
