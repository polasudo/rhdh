import { EXTENSIONS_API_VERSION } from '../consts.esm.js';
import { MarketplaceKind } from './MarketplaceKind.esm.js';

function isMarketplaceCollection(entity) {
  return !!entity && (entity.apiVersion === EXTENSIONS_API_VERSION || entity.apiVersion === "marketplace.backstage.io/v1alpha1") && entity.kind === MarketplaceKind.Collection;
}

export { isMarketplaceCollection };
//# sourceMappingURL=MarketplaceCollection.esm.js.map
