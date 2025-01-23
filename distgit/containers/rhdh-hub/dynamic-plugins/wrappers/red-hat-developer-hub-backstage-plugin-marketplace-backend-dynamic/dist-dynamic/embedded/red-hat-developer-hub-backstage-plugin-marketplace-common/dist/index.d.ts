import { Entity } from '@backstage/catalog-model';
import { JsonObject } from '@backstage/types';

/**
 * @public
 */
interface MarketplacePluginEntry extends Entity {
    spec?: MarketplacePluginSpec;
}
/**
 * @public
 */
interface MarketplacePluginList extends Entity {
    spec?: {
        plugins: string[];
    } & MarketplacePluginSpec;
}
/**
 * @public
 */
declare const MARKETPLACE_API_VERSION = "marketplace.backstage.io/v1alpha1";
/**
 * @public
 */
declare enum MarketplaceKinds {
    plugin = "Plugin",
    pluginList = "PluginList"
}
/**
 * @public
 */
declare enum InstallStatus {
    NotInstalled = "NotInstalled",
    Installed = "Installed"
}
/**
 * @public
 */
type MarketplacePackage = {
    name: string;
    version?: string;
    backstage?: {
        role?: string;
        'supported-versions'?: string;
    };
    distribution?: string;
};
/**
 * @public
 */
interface MarketplacePluginSpec extends JsonObject {
    packages?: (string | MarketplacePackage)[];
    installStatus?: keyof typeof InstallStatus;
    icon?: string;
    categories?: string[];
    developer?: string;
    highlights?: string[];
    description?: string;
    installation?: {
        markdown?: string;
        appconfig?: string;
    };
}

export { InstallStatus, MARKETPLACE_API_VERSION, MarketplaceKinds, type MarketplacePackage, type MarketplacePluginEntry, type MarketplacePluginList, type MarketplacePluginSpec };
