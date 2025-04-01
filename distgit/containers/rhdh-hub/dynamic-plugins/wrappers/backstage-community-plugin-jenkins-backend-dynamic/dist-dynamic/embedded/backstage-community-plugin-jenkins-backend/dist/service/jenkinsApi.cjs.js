'use strict';

var Jenkins = require('jenkins');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var pluginJenkinsCommon = require('@backstage-community/plugin-jenkins-common');
var fetch = require('node-fetch');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Jenkins__default = /*#__PURE__*/_interopDefaultCompat(Jenkins);
var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

class JenkinsApiImpl {
  constructor(permissionApi) {
    this.permissionApi = permissionApi;
  }
  static lastBuildTreeSpec = `lastBuild[
                    number,
                    url,
                    fullDisplayName,
                    displayName,
                    building,
                    result,
                    timestamp,
                    duration,
                    actions[
                      *[
                        *[
                          *[
                            *
                          ]
                        ]
                      ]
                    ]
                  ],`;
  static jobTreeSpec = `actions[*],
                   ${JenkinsApiImpl.lastBuildTreeSpec}
                   jobs{0,1},
                   url,
                   name,
                   fullName,
                   displayName,
                   fullDisplayName,
                   inQueue`;
  static jobsTreeSpec = `jobs[
                   ${JenkinsApiImpl.jobTreeSpec}
                 ]`;
  static jobBuildsTreeSpec = `
                   name,
                   description,
                   url,
                   fullName,
                   displayName,
                   fullDisplayName,
                   inQueue,
                   builds[*]`;
  /**
   * Get a list of projects for the given JenkinsInfo.
   * @see ../../../jenkins/src/api/JenkinsApi.ts#getProjects
   */
  async getProjects(jenkinsInfo, branches) {
    const client = await JenkinsApiImpl.getClient(jenkinsInfo);
    if (branches) {
      return this.fetchBranchSpecificProjects(client, jenkinsInfo, branches);
    }
    return this.fetchAllProjects(client, jenkinsInfo);
  }
  async fetchBranchSpecificProjects(client, jenkinsInfo, branches) {
    const projects = await Promise.all(
      jenkinsInfo.fullJobNames.map(async (jobName) => {
        const job = await Promise.any(
          branches.map(
            (branch) => client.job.get({
              name: `${jobName}/${encodeURIComponent(branch)}`,
              tree: JenkinsApiImpl.jobTreeSpec.replace(/\s/g, "")
            })
          )
        );
        return this.augmentProject(job);
      })
    );
    return projects;
  }
  async fetchAllProjects(client, jenkinsInfo) {
    const limitedJobsTreeSpec = `${JenkinsApiImpl.jobsTreeSpec}{0,${jenkinsInfo.projectCountLimit}}`.replace(
      /\s/g,
      ""
    );
    const limitedStandaloneJobTreeSpec = `${JenkinsApiImpl.jobTreeSpec}{0,${jenkinsInfo.projectCountLimit}}`.replace(
      /\s/g,
      ""
    );
    const projects = jenkinsInfo.fullJobNames.map(async (jobName) => {
      const project = await client.job.get({
        name: jobName,
        tree: limitedJobsTreeSpec
      });
      if (!project.jobs) {
        const standaloneProject = await client.job.get({
          name: jobName,
          tree: limitedStandaloneJobTreeSpec
        });
        return [this.augmentProject(standaloneProject)];
      }
      return project.jobs.map(
        (jobDetails) => this.augmentProject(jobDetails)
      );
    });
    const nestedProjects = await Promise.all(projects);
    return nestedProjects.flat();
  }
  /**
   * Get a single build.
   * @see ../../../jenkins/src/api/JenkinsApi.ts#getBuild
   */
  async getBuild(jenkinsInfo, jobFullName, buildNumber) {
    const client = await JenkinsApiImpl.getClient(jenkinsInfo);
    const project = await client.job.get({
      name: jobFullName,
      depth: 1
    });
    const build = await client.build.get(jobFullName, buildNumber);
    const jobScmInfo = JenkinsApiImpl.extractScmDetailsFromJob(project);
    return this.augmentBuild(build, jobScmInfo);
  }
  /**
   * Trigger a build of a project
   * @see ../../../jenkins/src/api/JenkinsApi.ts#retry
   */
  async rebuildProject(jenkinsInfo, jobFullName, buildNumber, resourceRef, options) {
    if (this.permissionApi) {
      const response2 = await this.permissionApi.authorize(
        [{ permission: pluginJenkinsCommon.jenkinsExecutePermission, resourceRef }],
        { credentials: options.credentials }
      );
      const { result } = response2[0];
      if (result === pluginPermissionCommon.AuthorizeResult.DENY) {
        return 401;
      }
    }
    const buildUrl = this.getBuildUrl(jenkinsInfo, jobFullName, buildNumber);
    const response = await fetch__default.default(`${buildUrl}/replay/rebuild`, {
      method: "post",
      headers: jenkinsInfo.headers
    });
    return response.status;
  }
  // private helper methods
  static async getClient(jenkinsInfo) {
    return new Jenkins__default.default({
      baseUrl: jenkinsInfo.baseUrl,
      headers: jenkinsInfo.headers,
      promisify: true,
      crumbIssuer: jenkinsInfo.crumbIssuer
    });
  }
  augmentProject(project) {
    let status;
    if (project.inQueue) {
      status = "queued";
    } else if (!project.lastBuild) {
      status = "build not found";
    } else if (project.lastBuild.building) {
      status = "running";
    } else if (!project.lastBuild.result) {
      status = "unknown";
    } else {
      status = project.lastBuild.result;
    }
    const jobScmInfo = JenkinsApiImpl.extractScmDetailsFromJob(project);
    return {
      ...project,
      lastBuild: project.lastBuild ? this.augmentBuild(project.lastBuild, jobScmInfo) : null,
      status
      // actions: undefined,
    };
  }
  augmentBuild(build, jobScmInfo) {
    const source = build.actions.filter(
      (action) => action?._class === "hudson.plugins.git.util.BuildData"
    ).map((action) => {
      const [first] = Object.values(action.buildsByBranchName);
      const branch = first.revision.branch[0];
      return {
        branchName: branch.name,
        commit: {
          hash: branch.SHA1.substring(0, 8)
        }
      };
    }).pop() || {};
    if (jobScmInfo) {
      source.url = jobScmInfo.url;
      source.displayName = jobScmInfo.displayName;
      source.author = jobScmInfo.author;
    }
    let status;
    if (build.building) {
      status = "running";
    } else if (!build.result) {
      status = "unknown";
    } else {
      status = build.result;
    }
    return {
      ...build,
      status,
      source,
      tests: this.getTestReport(build)
    };
  }
  static extractScmDetailsFromJob(project) {
    const scmInfo = project.actions.filter(
      (action) => action?._class === "jenkins.scm.api.metadata.ObjectMetadataAction"
    ).map((action) => {
      return {
        url: action?.objectUrl,
        // https://javadoc.jenkins.io/plugin/scm-api/jenkins/scm/api/metadata/ObjectMetadataAction.html
        // branch name for regular builds, pull request title on pull requests
        displayName: action?.objectDisplayName
      };
    }).pop();
    if (!scmInfo) {
      return void 0;
    }
    const author = project.actions.filter(
      (action) => action?._class === "jenkins.scm.api.metadata.ContributorMetadataAction"
    ).map((action) => {
      return action.contributorDisplayName;
    }).pop();
    if (author) {
      scmInfo.author = author;
    }
    return scmInfo;
  }
  getTestReport(build) {
    return build.actions.filter(
      (action) => action?._class === "hudson.tasks.junit.TestResultAction"
    ).map((action) => {
      return {
        total: action.totalCount,
        passed: action.totalCount - action.failCount - action.skipCount,
        skipped: action.skipCount,
        failed: action.failCount,
        testUrl: `${build.url}${action.urlName}/`
      };
    }).pop();
  }
  getBuildUrl(jenkinsInfo, jobFullName, buildId) {
    const jobs = jobFullName.split("/");
    return `${jenkinsInfo.baseUrl}/job/${jobs.join("/job/")}/${buildId}`;
  }
  async getJobBuilds(jenkinsInfo, jobFullName) {
    let jobName = jobFullName;
    if (jobFullName.includes("/")) {
      jobName = jobFullName.split("/").map((s) => `${encodeURIComponent(s)}`).join("/job/");
    }
    const response = await fetch__default.default(
      `${jenkinsInfo.baseUrl}/job/${jobName}/api/json?tree=${JenkinsApiImpl.jobBuildsTreeSpec.replace(
        /\s/g,
        ""
      )}`,
      {
        method: "get",
        headers: jenkinsInfo.headers
      }
    );
    const jobBuilds = await response.json();
    return jobBuilds;
  }
  /**
   * Get the console text for a single build.
   * @see ../../../jenkins/src/api/JenkinsApi.ts#getBuildConsoleText
   */
  async getBuildConsoleText(jenkinsInfo, jobFullName, buildNumber) {
    const buildUrl = this.getBuildUrl(jenkinsInfo, jobFullName, buildNumber);
    const response = await fetch__default.default(`${buildUrl}/consoleText`, {
      method: "get",
      headers: jenkinsInfo.headers
    });
    const consoleText = await response.text();
    return consoleText;
  }
}

exports.JenkinsApiImpl = JenkinsApiImpl;
//# sourceMappingURL=jenkinsApi.cjs.js.map
