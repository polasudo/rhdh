import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, RootConfigService, DiscoveryService, AuthService } from '@backstage/backend-plugin-api';
import { PagerDutyEntityMapping, PagerDutySetting, PagerDutyService, PagerDutyEntityMappingsResponse } from '@pagerduty/backstage-plugin-common';
import * as express from 'express';
import { CatalogApi, GetEntitiesResponse } from '@backstage/catalog-client';

type RawDbEntityResultRow = {
    id: string;
    entityRef: string;
    serviceId: string;
    integrationKey: string;
    account?: string;
    processedDate?: Date;
};
/** @public */
interface PagerDutyBackendStore {
    insertEntityMapping(entity: PagerDutyEntityMapping): Promise<string>;
    getAllEntityMappings(): Promise<RawDbEntityResultRow[]>;
    findEntityMappingByEntityRef(entityRef: string): Promise<RawDbEntityResultRow | undefined>;
    findEntityMappingByServiceId(serviceId: string): Promise<RawDbEntityResultRow | undefined>;
    updateSetting(setting: PagerDutySetting): Promise<string>;
    findSetting(settingId: string): Promise<PagerDutySetting | undefined>;
    getAllSettings(): Promise<PagerDutySetting[]>;
}

interface RouterOptions {
    logger: LoggerService;
    config: RootConfigService;
    store: PagerDutyBackendStore;
    discovery: DiscoveryService;
    auth?: AuthService;
    catalogApi?: CatalogApi;
}
type Annotations = {
    "pagerduty.com/integration-key": string;
    "pagerduty.com/service-id": string;
    "pagerduty.com/account": string;
};
declare function createComponentEntitiesReferenceDict({ items: componentEntities }: GetEntitiesResponse): Promise<Record<string, {
    ref: string;
    name: string;
}>>;
declare function buildEntityMappingsResponse(entityMappings: RawDbEntityResultRow[], componentEntitiesDict: Record<string, {
    ref: string;
    name: string;
}>, componentEntities: GetEntitiesResponse, pagerDutyServices: PagerDutyService[]): Promise<PagerDutyEntityMappingsResponse>;
declare function createRouter(options: RouterOptions): Promise<express.Router>;

/** @public */
declare const pagerDutyPlugin: _backstage_backend_plugin_api.BackendFeatureCompat;

export { type Annotations, type RouterOptions, buildEntityMappingsResponse, createComponentEntitiesReferenceDict, createRouter, pagerDutyPlugin as default };
