'use strict';

var limiterFactory = require('p-limit');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var limiterFactory__default = /*#__PURE__*/_interopDefaultCompat(limiterFactory);

const DEFAULT_TEAMS_LIMIT = 100;
class PullRequestsDashboardProvider {
  constructor(logger, azureDevOpsApi) {
    this.logger = logger;
    this.azureDevOpsApi = azureDevOpsApi;
  }
  teams = /* @__PURE__ */ new Map();
  teamMembers = /* @__PURE__ */ new Map();
  static async create(logger, azureDevOpsApi) {
    const provider = new PullRequestsDashboardProvider(logger, azureDevOpsApi);
    return provider;
  }
  async readTeams(limit) {
    this.logger.info("Reading teams.");
    let teams = await this.azureDevOpsApi.getAllTeams({ limit });
    teams = teams.filter(
      (team) => team.name && team.projectName ? team.name !== `${team.projectName} Team` : true
    );
    this.teams = /* @__PURE__ */ new Map();
    this.teamMembers = /* @__PURE__ */ new Map();
    const limiter = limiterFactory__default.default(5);
    await Promise.all(
      teams.map(
        (team) => limiter(async () => {
          const teamId = team.id;
          const projectId = team.projectId;
          if (teamId) {
            let teamMembers;
            if (projectId) {
              teamMembers = await this.azureDevOpsApi.getTeamMembers({
                projectId,
                teamId
              });
            }
            if (teamMembers) {
              team.members = teamMembers.reduce((arr, teamMember) => {
                const teamMemberId = teamMember.id;
                if (teamMemberId) {
                  arr.push(teamMemberId);
                  const memberOf = [
                    ...this.teamMembers.get(teamMemberId)?.memberOf ?? [],
                    teamId
                  ];
                  this.teamMembers.set(teamMemberId, {
                    ...teamMember,
                    memberOf
                  });
                }
                return arr;
              }, []);
              this.teams.set(teamId, team);
            }
          }
        })
      )
    );
  }
  async getDashboardPullRequests(projectName, options) {
    const dashboardPullRequests = await this.azureDevOpsApi.getDashboardPullRequests(projectName, options);
    await this.getAllTeams({ limit: options.teamsLimit });
    return dashboardPullRequests.map((pr) => {
      if (pr.createdBy?.id) {
        const teamIds = this.teamMembers.get(pr.createdBy.id)?.memberOf;
        pr.createdBy.teamIds = teamIds;
        pr.createdBy.teamNames = teamIds?.map(
          (teamId) => this.teams.get(teamId)?.name ?? ""
        );
      }
      return pr;
    });
  }
  async getUserTeamIds(email) {
    await this.getAllTeams({});
    return Array.from(this.teamMembers.values()).find(
      (teamMember) => teamMember.uniqueName === email
    )?.memberOf ?? [];
  }
  async getAllTeams(options) {
    if (!this.teams.size) {
      const maxTeams = options?.limit ?? DEFAULT_TEAMS_LIMIT;
      await this.readTeams(maxTeams);
    }
    return Array.from(this.teams.values());
  }
}

exports.DEFAULT_TEAMS_LIMIT = DEFAULT_TEAMS_LIMIT;
exports.PullRequestsDashboardProvider = PullRequestsDashboardProvider;
//# sourceMappingURL=PullRequestsDashboardProvider.cjs.js.map
