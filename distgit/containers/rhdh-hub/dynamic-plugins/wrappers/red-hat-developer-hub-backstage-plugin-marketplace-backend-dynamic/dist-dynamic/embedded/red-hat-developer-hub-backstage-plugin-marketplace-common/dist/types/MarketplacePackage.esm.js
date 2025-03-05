import { EXTENSIONS_API_VERSION } from '../consts.esm.js';
import { MarketplaceKind } from './MarketplaceKind.esm.js';

var MarketplacePackageInstallStatus = /* @__PURE__ */ ((MarketplacePackageInstallStatus2) => {
  MarketplacePackageInstallStatus2["NotInstalled"] = "NotInstalled";
  MarketplacePackageInstallStatus2["Installed"] = "Installed";
  MarketplacePackageInstallStatus2["UpdateAvailable"] = "UpdateAvailable";
  return MarketplacePackageInstallStatus2;
})(MarketplacePackageInstallStatus || {});
function isMarketplacePackage(entity) {
  return !!entity && (entity.apiVersion === EXTENSIONS_API_VERSION || entity.apiVersion === "marketplace.backstage.io/v1alpha1") && entity.kind === MarketplaceKind.Package;
}

export { MarketplacePackageInstallStatus, isMarketplacePackage };
//# sourceMappingURL=MarketplacePackage.esm.js.map
