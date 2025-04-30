'use strict';

var annotation = require('./annotation.cjs.js');

const defaultUserTransformer = async (item, _ctx) => {
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "User",
    metadata: {
      name: item.login,
      annotations: {
        [annotation.ANNOTATION_GITHUB_USER_LOGIN]: item.login
      }
    },
    spec: {
      profile: {},
      memberOf: []
    }
  };
  if (item.bio) entity.metadata.description = item.bio;
  if (item.name) entity.spec.profile.displayName = item.name;
  if (item.email) entity.spec.profile.email = item.email;
  if (item.avatarUrl) entity.spec.profile.picture = item.avatarUrl;
  return entity;
};
const defaultOrganizationTeamTransformer = async (team) => {
  const annotations = {
    [annotation.ANNOTATION_GITHUB_TEAM_SLUG]: team.combinedSlug
  };
  if (team.editTeamUrl) {
    annotations["backstage.io/edit-url"] = team.editTeamUrl;
  }
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "Group",
    metadata: {
      name: team.slug,
      annotations
    },
    spec: {
      type: "team",
      profile: {},
      children: []
    }
  };
  if (team.description) {
    entity.metadata.description = team.description;
  }
  if (team.name) {
    entity.spec.profile.displayName = team.name;
  }
  if (team.avatarUrl) {
    entity.spec.profile.picture = team.avatarUrl;
  }
  if (team.parentTeam) {
    entity.spec.parent = team.parentTeam.slug;
  }
  entity.spec.members = team.members.map((user) => user.login);
  return entity;
};

exports.defaultOrganizationTeamTransformer = defaultOrganizationTeamTransformer;
exports.defaultUserTransformer = defaultUserTransformer;
//# sourceMappingURL=defaultTransformers.cjs.js.map
