import { Build, BuildDefinitionReference } from 'azure-devops-node-api/interfaces/BuildInterfaces';
import { Project, RepoBuild, GitTag, PullRequestOptions, PullRequest, DashboardPullRequest, Team, TeamMember, BuildRun } from '@backstage-community/plugin-azure-devops-common';
import { GitRepository } from 'azure-devops-node-api/interfaces/GitInterfaces';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

/** @public */
declare class AzureDevOpsApi {
    private readonly logger;
    private readonly urlReader;
    private readonly config;
    private readonly credentialsProvider;
    private constructor();
    static fromConfig(config: Config, options: {
        logger: LoggerService;
        urlReader: UrlReaderService;
    }): AzureDevOpsApi;
    private getWebApi;
    getProjects(host?: string, org?: string): Promise<Project[]>;
    getGitRepository(projectName: string, repoName: string, host?: string, org?: string): Promise<GitRepository>;
    getBuildList(projectName: string, repoId: string, top: number, host?: string, org?: string): Promise<Build[]>;
    getRepoBuilds(projectName: string, repoName: string, top: number, host?: string, org?: string): Promise<RepoBuild[]>;
    getGitTags(projectName: string, repoName: string, host?: string, org?: string): Promise<GitTag[]>;
    getPullRequests(projectName: string, repoName: string, options: PullRequestOptions, host?: string, org?: string): Promise<PullRequest[]>;
    getDashboardPullRequests(projectName: string, options: PullRequestOptions): Promise<DashboardPullRequest[]>;
    private getPullRequestPolicies;
    getAllTeams(options?: {
        limit?: number;
    }): Promise<Team[]>;
    getTeamMembers(options: {
        projectId: string;
        teamId: string;
    }): Promise<TeamMember[] | undefined>;
    getBuildDefinitions(projectName: string, definitionName: string, host?: string, org?: string): Promise<BuildDefinitionReference[]>;
    getBuilds(projectName: string, top: number, repoId?: string, definitions?: number[], host?: string, org?: string): Promise<Build[]>;
    getBuildRuns(projectName: string, top: number, repoName?: string, definitionName?: string, host?: string, org?: string): Promise<BuildRun[]>;
    getReadme(host: string, org: string, project: string, repo: string, path: string): Promise<{
        url: string;
        content: string;
    }>;
}

/**
 * Azure DevOps backend plugin
 *
 * @public
 */
declare const azureDevOpsPlugin: _backstage_backend_plugin_api.BackendFeature;

export { AzureDevOpsApi, azureDevOpsPlugin as default };
