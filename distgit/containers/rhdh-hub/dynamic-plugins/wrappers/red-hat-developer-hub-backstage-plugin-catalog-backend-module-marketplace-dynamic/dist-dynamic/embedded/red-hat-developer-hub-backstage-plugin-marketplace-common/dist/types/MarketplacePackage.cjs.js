'use strict';

var consts = require('../consts.cjs.js');
var MarketplaceKind = require('./MarketplaceKind.cjs.js');

var MarketplacePackageInstallStatus = /* @__PURE__ */ ((MarketplacePackageInstallStatus2) => {
  MarketplacePackageInstallStatus2["NotInstalled"] = "NotInstalled";
  MarketplacePackageInstallStatus2["Installed"] = "Installed";
  MarketplacePackageInstallStatus2["UpdateAvailable"] = "UpdateAvailable";
  return MarketplacePackageInstallStatus2;
})(MarketplacePackageInstallStatus || {});
function isMarketplacePackage(entity) {
  return !!entity && (entity.apiVersion === consts.EXTENSIONS_API_VERSION || entity.apiVersion === "marketplace.backstage.io/v1alpha1") && entity.kind === MarketplaceKind.MarketplaceKind.Package;
}

exports.MarketplacePackageInstallStatus = MarketplacePackageInstallStatus;
exports.isMarketplacePackage = isMarketplacePackage;
//# sourceMappingURL=MarketplacePackage.cjs.js.map
