'use strict';

var azureDevopsUtils = require('../utils/azure-devops-utils.cjs.js');
var azureDevopsNodeApi = require('azure-devops-node-api');
var integration = require('@backstage/integration');
var mappers = require('./mappers.cjs.js');

class AzureDevOpsApi {
  logger;
  urlReader;
  config;
  credentialsProvider;
  constructor(logger, urlReader, config, credentialsProvider) {
    this.logger = logger;
    this.urlReader = urlReader;
    this.config = config;
    this.credentialsProvider = credentialsProvider;
  }
  static fromConfig(config, options) {
    const scmIntegrations = integration.ScmIntegrations.fromConfig(config);
    const credentialsProvider = integration.DefaultAzureDevOpsCredentialsProvider.fromIntegrations(scmIntegrations);
    return new AzureDevOpsApi(
      options.logger,
      options.urlReader,
      config,
      credentialsProvider
    );
  }
  async getWebApi(host, org) {
    const validHost = host ?? this.config.getOptionalString("azureDevOps.host");
    const validOrg = org ?? this.config.getOptionalString("azureDevOps.organization");
    if (!validHost || !validOrg) {
      throw new Error(
        "No 'host' or 'org' provided in annotations or configuration, unable to retrieve needed credentials"
      );
    }
    const url = `https://${validHost}/${encodeURIComponent(validOrg)}`;
    const credentials = await this.credentialsProvider.getCredentials({
      url
    });
    let authHandler;
    if (!credentials) {
      const token = this.config.getOptionalString("azureDevOps.token");
      if (!token) {
        throw new Error(
          "No 'azureDevOps.token' provided in configuration and credentials were not found in 'integrations.azure', unable to proceed"
        );
      }
      this.logger.warn(
        "Using the token from 'azureDevOps.token' has been deprecated, use 'integrations.azure' instead, for more details see: https://backstage.io/docs/integrations/azure/locations"
      );
      authHandler = azureDevopsNodeApi.getPersonalAccessTokenHandler(token);
    } else {
      authHandler = azureDevopsNodeApi.getHandlerFromToken(credentials.token);
    }
    const webApi = new azureDevopsNodeApi.WebApi(url, authHandler);
    return webApi;
  }
  async getProjects(host, org) {
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getCoreApi();
    const projectList = await client.getProjects();
    const projects = projectList.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description
    }));
    return projects.sort(
      (a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0
    );
  }
  async getGitRepository(projectName, repoName, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting Repository ${repoName} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    return client.getRepository(repoName, projectName);
  }
  async getBuildList(projectName, repoId, top, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository Id ${repoId} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getBuilds(
      projectName,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      top,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      repoId,
      "TfsGit"
    );
  }
  async getRepoBuilds(projectName, repoName, top, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    if (!gitRepository) {
      throw new Error(
        `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
      );
    }
    const buildList = await this.getBuildList(
      projectName,
      gitRepository.id,
      top,
      host,
      org
    );
    const repoBuilds = buildList.map((build) => {
      return mappers.mappedRepoBuild(build);
    });
    return repoBuilds;
  }
  async getGitTags(projectName, repoName, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting Git Tags for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    if (!gitRepository) {
      throw new Error(
        `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
      );
    }
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    const tagRefs = await client.getRefs(
      gitRepository.id,
      projectName,
      "tags",
      false,
      false,
      false,
      false,
      true
    );
    const linkBaseUrl = `${webApi.serverUrl}/${encodeURIComponent(
      projectName
    )}/_git/${encodeURIComponent(repoName)}?version=GT`;
    const commitBaseUrl = `${webApi.serverUrl}/${encodeURIComponent(
      projectName
    )}/_git/${encodeURIComponent(repoName)}/commit`;
    const gitTags = tagRefs.map((tagRef) => {
      return mappers.mappedGitTag(tagRef, linkBaseUrl, commitBaseUrl);
    });
    return gitTags;
  }
  async getPullRequests(projectName, repoName, options, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting up to ${options.top} Pull Requests for Repository ${repoName} for Project ${projectName}`
    );
    const gitRepository = await this.getGitRepository(
      projectName,
      repoName,
      host,
      org
    );
    if (!gitRepository) {
      throw new Error(
        `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
      );
    }
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getGitApi();
    const searchCriteria = {
      status: options.status
    };
    const gitPullRequests = await client.getPullRequests(
      gitRepository.id,
      searchCriteria,
      projectName,
      void 0,
      void 0,
      options.top
    );
    const linkBaseUrl = `${webApi.serverUrl}/${encodeURIComponent(
      projectName
    )}/_git/${encodeURIComponent(repoName)}/pullrequest`;
    const pullRequests = gitPullRequests.map((gitPullRequest) => {
      return mappers.mappedPullRequest(gitPullRequest, linkBaseUrl);
    });
    return pullRequests;
  }
  async getDashboardPullRequests(projectName, options) {
    this.logger?.debug(
      `Getting dashboard pull requests for project '${projectName}'.`
    );
    const webApi = await this.getWebApi();
    const client = await webApi.getGitApi();
    const searchCriteria = {
      status: options.status
    };
    const gitPullRequests = await client.getPullRequestsByProject(
      projectName,
      searchCriteria,
      void 0,
      void 0,
      options.top
    );
    return Promise.all(
      gitPullRequests.map(async (gitPullRequest) => {
        const projectId = gitPullRequest.repository?.project?.id;
        const prId = gitPullRequest.pullRequestId;
        let policies;
        if (projectId && prId) {
          policies = await this.getPullRequestPolicies(
            projectName,
            projectId,
            prId
          );
        }
        return azureDevopsUtils.convertDashboardPullRequest(
          gitPullRequest,
          webApi.serverUrl,
          policies
        );
      })
    );
  }
  async getPullRequestPolicies(projectName, projectId, pullRequestId) {
    this.logger?.debug(
      `Getting pull request policies for pull request id '${pullRequestId}'.`
    );
    const webApi = await this.getWebApi();
    const client = await webApi.getPolicyApi();
    const artifactId = azureDevopsUtils.getArtifactId(projectId, pullRequestId);
    const policyEvaluationRecords = await client.getPolicyEvaluations(projectName, artifactId);
    return policyEvaluationRecords.map(azureDevopsUtils.convertPolicy).filter((policy) => Boolean(policy));
  }
  async getAllTeams(options) {
    this.logger?.debug("Getting all teams.");
    const webApi = await this.getWebApi();
    const client = await webApi.getCoreApi();
    const webApiTeams = await client.getAllTeams(
      void 0,
      options?.limit,
      void 0,
      void 0
    );
    const teams = webApiTeams.map((team) => ({
      id: team.id,
      name: team.name,
      projectId: team.projectId,
      projectName: team.projectName
    }));
    return teams.sort(
      (a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0
    );
  }
  async getTeamMembers(options) {
    const { projectId, teamId } = options;
    this.logger?.debug(`Getting team member ids for team '${teamId}'.`);
    const webApi = await this.getWebApi();
    const client = await webApi.getCoreApi();
    const teamMembers = await client.getTeamMembersWithExtendedProperties(projectId, teamId);
    return teamMembers.map((teamMember) => ({
      id: teamMember.identity?.id,
      displayName: teamMember.identity?.displayName,
      uniqueName: teamMember.identity?.uniqueName
    }));
  }
  async getBuildDefinitions(projectName, definitionName, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting Build Definitions for ${definitionName} in Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getDefinitions(projectName, definitionName);
  }
  async getBuilds(projectName, top, repoId, definitions, host, org) {
    this.logger?.debug(
      `Calling Azure DevOps REST API, getting up to ${top} Builds for Repository Id ${repoId} for Project ${projectName}`
    );
    const webApi = await this.getWebApi(host, org);
    const client = await webApi.getBuildApi();
    return client.getBuilds(
      projectName,
      definitions,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      top,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      void 0,
      repoId,
      repoId ? "TfsGit" : void 0
    );
  }
  async getBuildRuns(projectName, top, repoName, definitionName, host, org) {
    let repoId;
    let definitions;
    if (repoName) {
      const gitRepository = await this.getGitRepository(
        projectName,
        repoName,
        host,
        org
      );
      if (!gitRepository) {
        throw new Error(
          `No repository found for Project "${projectName}" with Repository "${repoName}" on host "${host}" under organization "${org}".`
        );
      }
      repoId = gitRepository.id;
    }
    if (definitionName) {
      const buildDefinitions = await this.getBuildDefinitions(
        projectName,
        definitionName,
        host,
        org
      );
      definitions = buildDefinitions.map((bd) => bd.id).filter((bd) => Boolean(bd));
    }
    const builds = await this.getBuilds(
      projectName,
      top,
      repoId,
      definitions,
      host,
      org
    );
    const buildRuns = builds.map(mappers.mappedBuildRun);
    return buildRuns;
  }
  async getReadme(host, org, project, repo, path) {
    const url = azureDevopsUtils.buildEncodedUrl(host, org, project, repo, path);
    const response = await this.urlReader.readUrl(url);
    const buffer = await response.buffer();
    const content = await azureDevopsUtils.replaceReadme(
      this.urlReader,
      host,
      org,
      project,
      repo,
      buffer.toString()
    );
    return { url, content };
  }
}

exports.AzureDevOpsApi = AzureDevOpsApi;
//# sourceMappingURL=AzureDevOpsApi.cjs.js.map
