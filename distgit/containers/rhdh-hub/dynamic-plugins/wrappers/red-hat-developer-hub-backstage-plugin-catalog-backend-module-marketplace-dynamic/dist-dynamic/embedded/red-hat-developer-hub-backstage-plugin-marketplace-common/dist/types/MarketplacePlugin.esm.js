import { EXTENSIONS_API_VERSION } from '../consts.esm.js';
import { MarketplaceKind } from './MarketplaceKind.esm.js';

var DocumentationType = /* @__PURE__ */ ((DocumentationType2) => {
  DocumentationType2["about"] = "about";
  DocumentationType2["usage"] = "usage";
  DocumentationType2["installation"] = "installation";
  DocumentationType2["configuration"] = "configuration";
  return DocumentationType2;
})(DocumentationType || {});
var AssetType = /* @__PURE__ */ ((AssetType2) => {
  AssetType2["icon"] = "icon";
  AssetType2["image"] = "image";
  return AssetType2;
})(AssetType || {});
var MarketplacePluginInstallStatus = /* @__PURE__ */ ((MarketplacePluginInstallStatus2) => {
  MarketplacePluginInstallStatus2["NotInstalled"] = "NotInstalled";
  MarketplacePluginInstallStatus2["Installed"] = "Installed";
  MarketplacePluginInstallStatus2["PartiallyInstalled"] = "PartiallyInstalled";
  MarketplacePluginInstallStatus2["UpdateAvailable"] = "UpdateAvailable";
  return MarketplacePluginInstallStatus2;
})(MarketplacePluginInstallStatus || {});
function isMarketplacePlugin(entity) {
  return !!entity && (entity.apiVersion === EXTENSIONS_API_VERSION || entity.apiVersion === "marketplace.backstage.io/v1alpha1") && entity.kind === MarketplaceKind.Plugin;
}

export { AssetType, DocumentationType, MarketplacePluginInstallStatus, isMarketplacePlugin };
//# sourceMappingURL=MarketplacePlugin.esm.js.map
