import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { ServiceMock } from '@backstage/backend-test-utils';
import { CatalogApi } from '@backstage/catalog-client';

/**
 * Creates a fake catalog client that handles entities in memory storage. Note
 * that this client may be severely limited in functionality, and advanced
 * functions may not be available at all.
 *
 * @public
 */
declare function catalogServiceMock(options?: {
    entities?: Entity[];
}): CatalogApi;
/**
 * A collection of mock functionality for the catalog service.
 *
 * @public
 */
declare namespace catalogServiceMock {
    /**
     * Creates a fake catalog client that handles entities in memory storage. Note
     * that this client may be severely limited in functionality, and advanced
     * functions may not be available at all.
     */
    const factory: (options?: {
        entities?: Entity[];
    }) => _backstage_backend_plugin_api.ServiceFactory<CatalogApi, "plugin", "singleton">;
    /**
     * Creates a catalog client whose methods are mock functions, possibly with
     * some of them overloaded by the caller.
     */
    const mock: (partialImpl?: Partial<CatalogApi> | undefined) => ServiceMock<CatalogApi>;
}

export { catalogServiceMock };
