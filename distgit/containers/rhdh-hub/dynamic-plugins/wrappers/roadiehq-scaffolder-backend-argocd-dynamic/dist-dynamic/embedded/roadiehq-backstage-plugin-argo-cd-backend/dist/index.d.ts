import { Config } from '@backstage/config';
import express from 'express';
import { Logger } from 'winston';
import { LoggerService } from '@backstage/backend-plugin-api';

interface RouterOptions {
    logger: Logger | LoggerService;
    config: Config;
}
type Response = {
    status: string;
    message: string;
};
declare function createRouter({ logger, config, }: RouterOptions): Promise<express.Router>;

type getRevisionDataResp = {
    author: string;
    date: string;
    message: string;
};
type findArgoAppResp = {
    name: string;
    url: string;
    appName: Array<string>;
};
type SyncResponse = {
    status: 'Success' | 'Failure';
    message: string;
};
interface CreateArgoProjectProps {
    baseUrl: string;
    argoToken: string;
    projectName: string;
    namespace: string;
    sourceRepo: string;
    destinationServer?: string;
}
interface CreateArgoApplicationProps {
    baseUrl: string;
    argoToken: string;
    appName: string;
    projectName: string;
    namespace: string;
    sourceRepo: string;
    sourcePath: string;
    labelValue: string;
    destinationServer?: string;
}
interface CreateArgoResourcesProps {
    argoInstance: string;
    appName: string;
    projectName: string;
    namespace: string;
    sourceRepo: string;
    sourcePath: string;
    labelValue: string;
    logger: Logger | LoggerService;
}
interface UpdateArgoProjectAndAppProps {
    instanceConfig: InstanceConfig;
    argoToken: string;
    appName: string;
    projectName: string;
    namespace: string;
    sourceRepo: string;
    sourcePath: string;
    labelValue: string;
    destinationServer?: string;
}
interface DeleteProjectProps {
    baseUrl: string;
    argoProjectName: string;
    argoToken: string;
}
interface DeleteApplicationProps {
    baseUrl: string;
    argoApplicationName: string;
    argoToken: string;
}
interface DeleteApplicationAndProjectProps {
    argoAppName: string;
    argoInstanceName: string;
    terminateOperation?: boolean;
}
type DeleteApplicationAndProjectResponse = {
    terminateOperationDetails?: ResponseSchema<DeleteResponse> | undefined;
    deleteAppDetails: ResponseSchema<DeleteResponse | ArgoApplication> | undefined;
    deleteProjectDetails: ResponseSchema<DeleteResponse> | ResponseSchemaUnknown | undefined;
};
type status = 'pending' | 'success' | 'failed';
type ResponseSchema<T> = {
    status: Exclude<status, 'unknown'>;
    message: string;
    argoResponse: T;
};
type ResponseSchemaUnknown = {
    status: Extract<status, 'failed'>;
    message: string;
    argoResponse: Record<string, never>;
};
interface SyncArgoApplicationProps {
    argoInstance: findArgoAppResp;
    argoToken: string;
    appName: string;
}
interface ResyncProps {
    appSelector: string;
    terminateOperation?: boolean;
}
interface ArgoServiceApi {
    getArgoInstanceArray: () => InstanceConfig[];
    getAppArray: () => Config[];
    getArgoToken: (appConfig: {
        url: string;
        username?: string;
        password?: string;
    }) => Promise<string>;
    getArgoAppData: (baseUrl: string, argoInstanceName: string, argoToken: string, options: {
        name: string;
        selector: string;
    }) => Promise<object>;
    createArgoProject: (props: CreateArgoProjectProps) => Promise<object>;
    createArgoApplication: (props: CreateArgoApplicationProps) => Promise<object>;
    createArgoResources: (props: CreateArgoResourcesProps) => Promise<boolean>;
    deleteProject: (props: DeleteProjectProps) => Promise<DeleteResponse>;
    deleteApp: (props: DeleteApplicationProps) => Promise<DeleteResponse>;
    deleteAppandProject: (props: DeleteApplicationAndProjectProps) => Promise<DeleteApplicationAndProjectResponse>;
    syncArgoApp: (props: SyncArgoApplicationProps) => Promise<SyncResponse>;
    resyncAppOnAllArgos: (props: {
        appSelector: string;
    }) => Promise<SyncResponse[][]>;
    findArgoApp: (options: {
        name?: string;
        selector?: string;
    }) => Promise<findArgoAppResp[]>;
    updateArgoProjectAndApp: (props: UpdateArgoProjectAndAppProps) => Promise<boolean>;
    getArgoProject: (props: GetArgoProjectProps) => Promise<GetArgoProjectResp>;
    getArgoApplicationInfo: (props: getArgoApplicationInfoProps) => Promise<GetArgoApplication>;
    terminateArgoAppOperation: (props: terminateArgoAppOperationProps) => Promise<DeleteResponse>;
}
type InstanceConfig = {
    name: string;
    password?: string;
    token?: string;
    url: string;
    username?: string;
};
type GetArgoProjectProps = {
    baseUrl: string;
    argoToken: string;
    projectName: string;
};
type GetArgoProjectResp = {
    metadata: {
        resourceVersion: string;
    };
};
type HttpStatusCodes = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 500;
type ArgoErrorResponse = {
    message: string;
    error: string;
    code: number;
};
type DeleteResponse = (ArgoErrorResponse & {
    statusCode: Exclude<HttpStatusCodes, 200>;
}) | {
    statusCode: 200;
};
type GetArgoApplication = (ArgoErrorResponse & {
    statusCode: Exclude<HttpStatusCodes, 200>;
}) | (ArgoApplication & {
    statusCode: 200;
});
type ArgoApplication = {
    metadata: Metadata;
};
type Metadata = {
    name: string;
    namespace?: string;
    uid?: string;
    creationTimestamp?: string;
    deletionTimestamp?: string;
    deletionGracePeriodSeconds?: number;
    resourceVersion?: string;
    finalizers?: string[];
};
type getArgoApplicationInfoProps = {
    argoApplicationName: string;
    argoInstanceName: string;
} | {
    argoApplicationName: string;
    baseUrl: string;
    argoToken: string;
};
type terminateArgoAppOperationProps = {
    argoAppName: string;
    argoInstanceName: string;
} | {
    argoAppName: string;
    baseUrl: string;
    argoToken: string;
};

declare class ArgoService implements ArgoServiceApi {
    private readonly username;
    private readonly password;
    private readonly config;
    private readonly logger;
    instanceConfigs: InstanceConfig[];
    constructor(username: string, password: string, config: Config, logger: Logger | LoggerService);
    getArgoInstanceArray(): InstanceConfig[];
    getAppArray(): Config[];
    getRevisionData(baseUrl: string, options: {
        name: string;
        namespace?: string;
    }, argoToken: string, revisionID: string): Promise<getRevisionDataResp>;
    findArgoApp(options: {
        name?: string;
        selector?: string;
        namespace?: string;
    }): Promise<findArgoAppResp[]>;
    getArgoProject({ baseUrl, argoToken, projectName, }: GetArgoProjectProps): Promise<GetArgoProjectResp>;
    getArgoToken(appConfig: {
        url: string;
        username?: string;
        password?: string;
    }): Promise<string>;
    getArgoAppData(baseUrl: string, argoInstanceName: string, argoToken: string, options?: {
        name?: string;
        selector?: string;
        namespace?: string;
    }): Promise<any>;
    private buildArgoProjectPayload;
    createArgoProject({ baseUrl, argoToken, projectName, namespace, sourceRepo, destinationServer, }: CreateArgoProjectProps): Promise<object>;
    private updateArgoProject;
    private buildArgoApplicationPayload;
    createArgoApplication({ baseUrl, argoToken, appName, projectName, namespace, sourceRepo, sourcePath, labelValue, destinationServer, }: CreateArgoApplicationProps): Promise<object>;
    resyncAppOnAllArgos({ appSelector, terminateOperation, }: ResyncProps): Promise<SyncResponse[][]>;
    syncArgoApp({ argoInstance, argoToken, appName, }: SyncArgoApplicationProps): Promise<SyncResponse>;
    private updateArgoApp;
    deleteApp({ baseUrl, argoApplicationName, argoToken, }: DeleteApplicationProps): Promise<{
        statusCode: 200;
    } | {
        statusCode: 201 | 204 | 403 | 500 | 404 | 401 | 400;
        message: string;
        error: string;
        code: number;
    }>;
    deleteProject({ baseUrl, argoProjectName, argoToken, }: DeleteProjectProps): Promise<{
        statusCode: 200;
    } | {
        statusCode: 201 | 204 | 403 | 500 | 404 | 401 | 400;
        message: string;
        error: string;
        code: number;
    }>;
    deleteAppandProject({ argoAppName, argoInstanceName, terminateOperation, }: DeleteApplicationAndProjectProps): Promise<DeleteApplicationAndProjectResponse>;
    createArgoResources({ argoInstance, appName, projectName, namespace, sourceRepo, sourcePath, labelValue, logger, }: CreateArgoResourcesProps): Promise<boolean>;
    updateArgoProjectAndApp({ instanceConfig, argoToken, appName, projectName, namespace, sourceRepo, sourcePath, labelValue, destinationServer, }: UpdateArgoProjectAndAppProps): Promise<boolean>;
    getArgoApplicationInfo(props: getArgoApplicationInfoProps): Promise<{
        statusCode: 200;
        metadata: Metadata;
    } | {
        statusCode: 201 | 204 | 403 | 500 | 404 | 401 | 400;
        message: string;
        error: string;
        code: number;
    }>;
    terminateArgoAppOperation(props: terminateArgoAppOperationProps): Promise<{
        statusCode: 200;
    } | {
        statusCode: 201 | 204 | 403 | 500 | 404 | 401 | 400;
        message: string;
        error: string;
        code: number;
    }>;
}

export { ArgoService, type Response, type RouterOptions, createRouter };
