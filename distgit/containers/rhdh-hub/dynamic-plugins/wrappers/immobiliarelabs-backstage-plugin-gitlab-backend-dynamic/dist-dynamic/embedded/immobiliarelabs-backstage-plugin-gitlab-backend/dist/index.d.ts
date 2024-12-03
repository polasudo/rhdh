import { Config } from '@backstage/config';
import express from 'express';
import { Logger } from 'winston';
import { Entity } from '@backstage/catalog-model';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

interface RouterOptions {
    logger: Logger;
    config: Config;
}
declare function createRouter(options: RouterOptions): Promise<express.Router>;

/** @public */
declare class GitlabFillerProcessor implements CatalogProcessor {
    private readonly allowedKinds;
    private readonly gitLabIntegrationsConfig;
    constructor(config: Config);
    getProcessorName(): string;
    postProcessEntity(entity: Entity, location: LocationSpec, _emit: CatalogProcessorEmit): Promise<Entity>;
    private getGitlabSubPath;
    private getGitlabInstanceConfig;
    private isAllowedEntity;
}

declare const catalogPluginGitlabFillerProcessorModule: _backstage_backend_plugin_api.BackendFeatureCompat;
declare const gitlabPlugin: _backstage_backend_plugin_api.BackendFeatureCompat;

export { GitlabFillerProcessor, type RouterOptions, catalogPluginGitlabFillerProcessorModule, createRouter, gitlabPlugin };
