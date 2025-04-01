import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { UserTransformer, TeamTransformer } from '@backstage/plugin-catalog-backend-module-github';
export { GithubMultiOrgEntityProvider, TeamTransformer, UserTransformer } from '@backstage/plugin-catalog-backend-module-github';

/**
 * Interface for {@link githubOrgEntityProviderTransformsExtensionPoint}.
 *
 * @public
 */
interface GithubOrgEntityProviderTransformsExtensionPoint {
    /**
     * Set a custom transformer for transforming from GitHub users to catalog
     * entities.
     */
    setUserTransformer(transformer: UserTransformer): void;
    /**
     * Set a custom transformer for transforming from GitHub teams to catalog
     * entities.
     */
    setTeamTransformer(transformer: TeamTransformer): void;
}
/**
 * Extension point for runtime configuration of catalogModuleGithubOrgEntityProvider.
 *
 * @public
 */
declare const githubOrgEntityProviderTransformsExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<GithubOrgEntityProviderTransformsExtensionPoint>;
/**
 * Registers the `GithubMultiOrgEntityProvider` with the catalog processing extension point.
 *
 * @public
 */
declare const catalogModuleGithubOrgEntityProvider: _backstage_backend_plugin_api.BackendFeature;

export { type GithubOrgEntityProviderTransformsExtensionPoint, catalogModuleGithubOrgEntityProvider as default, githubOrgEntityProviderTransformsExtensionPoint };
