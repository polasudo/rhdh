import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';

/**
 * A relation from a scaffolder template entity to the entity it generated.
 * Reverse direction of {@link RELATION_SCAFFOLDED_FROM}
 *
 * @public
 */
declare const RELATION_SCAFFOLDER_OF = "scaffolderOf";
/**
 * A relation of an entity generated from a scaffolder template entity
 * Reverse direction of {@link RELATION_SCAFFOLDER_OF}
 *
 * @public
 */
declare const RELATION_SCAFFOLDED_FROM = "scaffoldedFrom";

/**
 * Extension of the `spec` field of the entity model
 * Used to form relations between entities and the scaffolder templates that generated them
 *
 * @public
 */
type ScaffoldedFromSpec = {
    spec: {
        scaffoldedFrom: string;
    };
};

/**
 * Catalog processor that adds link relation between scaffolder templates and their generated entities
 *
 * @public
 */
declare const catalogModuleScaffolderRelationProcessor: _backstage_backend_plugin_api.BackendFeature;

/** @public */
declare class ScaffolderRelationEntityProcessor implements CatalogProcessor {
    getProcessorName(): string;
    postProcessEntity(entity: Entity, _location: LocationSpec, emit: CatalogProcessorEmit): Promise<Entity>;
}

export { RELATION_SCAFFOLDED_FROM, RELATION_SCAFFOLDER_OF, type ScaffoldedFromSpec, ScaffolderRelationEntityProcessor, catalogModuleScaffolderRelationProcessor as default };
