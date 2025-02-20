/** @public */
type PagerDutyIncident = {
    id: string;
    title: string;
    status: string;
    html_url: string;
    assignments: [
        {
            assignee: PagerDutyUser;
        }
    ];
    service: PagerDutyService;
    created_at: string;
    urgency?: string;
};
/** @public */
type PagerDutyUser = {
    id: string;
    summary: string;
    email: string;
    html_url: string;
    name: string;
    avatar_url: string;
};
/** @public */
type PagerDutyChangeEvent = {
    id: string;
    integration: PagerDutyIntegration[];
    source: string;
    html_url?: string;
    links: [
        {
            href: string;
            text: string;
        }
    ];
    summary: string;
    timestamp: string;
};
/** @public */
type PagerDutyService = {
    id: string;
    name: string;
    description?: string;
    escalation_policy: PagerDutyEscalationPolicy;
    alert_creation?: string;
    incident_urgency_rule?: PagerDutyIncidentUrgencyRule;
    integrations?: PagerDutyIntegration[];
    teams?: PagerDutyTeam[];
    status?: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url: string;
    account?: string;
};
/** @public */
type PagerDutyEscalationPolicy = {
    id: string;
    name: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url?: string;
    account?: string;
};
/** @public */
type PagerDutyIncidentUrgencyRule = {
    type: string;
    urgency: string;
};
/** @public */
type PagerDutyIntegration = {
    id: string;
    type: string;
    summary?: string;
    self?: string;
    html_url?: string;
    name?: string;
    service?: PagerDutyService;
    created_at?: string;
    vendor?: PagerDutyVendor;
    integration_key?: string;
};
/** @public */
type PagerDutyTeam = {
    id: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url?: string;
    name: string;
};
/** @public  */
type PagerDutyOnCall = {
    user: PagerDutyUser;
    escalation_level: number;
};
/** @public */
type PagerDutyOnCallUsersResponse = {
    users: PagerDutyUser[];
};
/** @public */
type PagerDutyVendor = {
    id: string;
    type?: string;
    summary?: string;
    self?: string;
    html_url?: string;
};
/** @public */
type PagerDutyServiceStandards = {
    resource_id: string;
    resource_type: string;
    score: {
        passing: number;
        total: number;
    };
    standards: PagerDutyServiceStandard[];
};
/** @public */
type PagerDutyServiceStandard = {
    active: boolean;
    description: string;
    id: string;
    name: string;
    pass: boolean;
    type: string;
};
/** @public */
type PagerDutyServiceStandardsResponse = {
    standards: PagerDutyServiceStandards;
};
/** @public */
type PagerDutyServiceMetrics = {
    mean_assignment_count?: number;
    mean_engaged_seconds?: number;
    mean_engaged_user_count?: number;
    mean_seconds_to_engage?: number;
    mean_seconds_to_first_ack?: number;
    mean_seconds_to_mobilize?: number;
    mean_seconds_to_resolve?: number;
    mean_user_defined_engaged_seconds?: number;
    service_id: string;
    service_name?: string;
    team_id?: string;
    team_name?: string;
    total_business_hour_interruptions?: number;
    total_down_time_minutes?: number;
    total_engaged_seconds?: number;
    total_escalation_count?: number;
    total_high_urgency_incidents?: number;
    total_incident_count?: number;
    total_incidents_acknowledged?: number;
    total_incidents_auto_resolved?: number;
    total_incidents_manual_escalated?: number;
    total_incidents_reassigned?: number;
    total_incidents_timeout_escalated?: number;
    total_interruptions?: number;
    total_low_urgency_incidents?: number;
    total_major_incidents?: number;
    total_notifications?: number;
    total_off_hour_interruptions?: number;
    total_sleep_hour_interruptions?: number;
    total_snoozed_seconds?: number;
    total_user_defined_engaged_seconds?: number;
    up_time_pct?: number;
};
/** @public */
type PagerDutyServiceMetricsResponse = {
    metrics: PagerDutyServiceMetrics[];
};
/** @public */
type PagerDutyServicesResponse = {
    services: PagerDutyService[];
};
/** @public */
type PagerDutyServicesAPIResponse = PagerDutyServicesResponse & {
    offset: number;
    limit: number;
    total: number | null;
    more: boolean;
};
/** @public */
type PagerDutyServiceResponse = {
    service: PagerDutyService;
};
/** @public */
type PagerDutyIncidentsResponse = {
    incidents: PagerDutyIncident[];
};
/** @public */
type PagerDutyChangeEventsResponse = {
    change_events: PagerDutyChangeEvent[];
};
/** @public */
type PagerDutyOnCallsResponse = {
    oncalls: PagerDutyOnCall[];
};
/** @public */
type PagerDutyIntegrationResponse = {
    integration: PagerDutyIntegration;
};
/** @public */
type PagerDutyEscalationPoliciesResponse = {
    escalation_policies: PagerDutyEscalationPolicy[];
    limit?: number;
    offset?: number;
    more?: boolean;
    total?: number;
};
/** @public */
type PagerDutyAbilitiesResponse = {
    abilities: string[];
};
/** @public */
declare class HttpError extends Error {
    constructor(message: string, status: number);
    status: number;
}
/** @public */
type PagerDutyOAuthConfig = {
    clientId: string;
    clientSecret: string;
    region?: string;
    subDomain: string;
};
/** @public */
type PagerDutyAccountConfig = {
    id: string;
    isDefault?: boolean;
    eventsBaseUrl?: string;
    apiBaseUrl?: string;
    apiToken?: string;
    oauth?: PagerDutyOAuthConfig;
};
/** @public */
type PagerDutyEntityMapping = {
    entityRef: string;
    entityName?: string;
    serviceId: string;
    serviceName?: string;
    integrationKey?: string;
    serviceUrl?: string;
    status?: "NotMapped" | "InSync" | "OutOfSync";
    processedDate?: Date;
    team?: string;
    escalationPolicy?: string;
    account?: string;
};
/** @public */
type PagerDutyEntityMappingsResponse = {
    mappings: PagerDutyEntityMapping[];
};
/** @public */
type PagerDutyEntityMappingResponse = {
    mapping: PagerDutyEntityMapping;
};
/** @public */
type PagerDutyServiceDependencyReference = {
    id: string;
    type: string;
};
/** @public */
type PagerDutyServiceDependency = {
    id?: string;
    type?: string;
    supporting_service: PagerDutyServiceDependencyReference;
    dependent_service: PagerDutyServiceDependencyReference;
};
/** @public */
type PagerDutyServiceDependencyResponse = {
    relationships: PagerDutyServiceDependency[];
};
/** @public */
type PagerDutySetting = {
    id: string;
    value: "backstage" | "pagerduty" | "both" | "disabled";
};
/** @public */
type PagerDutySettings = {
    settings: PagerDutySetting[];
};

/** @public */
declare const PAGERDUTY_INTEGRATION_KEY = "pagerduty.com/integration-key";
/** @public */
declare const PAGERDUTY_SERVICE_ID = "pagerduty.com/service-id";

export { HttpError, PAGERDUTY_INTEGRATION_KEY, PAGERDUTY_SERVICE_ID, PagerDutyAbilitiesResponse, PagerDutyAccountConfig, PagerDutyChangeEvent, PagerDutyChangeEventsResponse, PagerDutyEntityMapping, PagerDutyEntityMappingResponse, PagerDutyEntityMappingsResponse, PagerDutyEscalationPoliciesResponse, PagerDutyEscalationPolicy, PagerDutyIncident, PagerDutyIncidentUrgencyRule, PagerDutyIncidentsResponse, PagerDutyIntegration, PagerDutyIntegrationResponse, PagerDutyOAuthConfig, PagerDutyOnCall, PagerDutyOnCallUsersResponse, PagerDutyOnCallsResponse, PagerDutyService, PagerDutyServiceDependency, PagerDutyServiceDependencyReference, PagerDutyServiceDependencyResponse, PagerDutyServiceMetrics, PagerDutyServiceMetricsResponse, PagerDutyServiceResponse, PagerDutyServiceStandard, PagerDutyServiceStandards, PagerDutyServiceStandardsResponse, PagerDutyServicesAPIResponse, PagerDutyServicesResponse, PagerDutySetting, PagerDutySettings, PagerDutyTeam, PagerDutyUser, PagerDutyVendor };
