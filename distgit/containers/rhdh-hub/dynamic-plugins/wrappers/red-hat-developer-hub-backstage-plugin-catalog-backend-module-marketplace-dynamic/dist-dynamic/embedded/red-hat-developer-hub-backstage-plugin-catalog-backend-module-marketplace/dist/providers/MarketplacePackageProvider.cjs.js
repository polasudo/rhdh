'use strict';

var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var BaseEntityProvider = require('./BaseEntityProvider.cjs.js');

class MarketplacePackageProvider extends BaseEntityProvider.BaseEntityProvider {
  getKind() {
    return backstagePluginMarketplaceCommon.MarketplaceKind.Package;
  }
  getProviderName() {
    return "marketplace-package-provider";
  }
}

exports.MarketplacePackageProvider = MarketplacePackageProvider;
//# sourceMappingURL=MarketplacePackageProvider.cjs.js.map
