'use strict';

var catalogModel = require('@backstage/catalog-model');
var lodash = require('lodash');
var annotation = require('./annotation.cjs.js');
var util = require('./util.cjs.js');

function withLocations(baseUrl, org, entity) {
  const login = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || entity.metadata.name;
  let team = entity.metadata.name;
  const slug = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [_, slugTeam] = util.splitTeamSlug(slug);
    team = slugTeam;
  }
  const location = entity.kind === "Group" ? `url:${baseUrl}/orgs/${org}/teams/${team}` : `url:${baseUrl}/${login}`;
  return lodash.merge(
    {
      metadata: {
        annotations: {
          [catalogModel.ANNOTATION_LOCATION]: location,
          [catalogModel.ANNOTATION_ORIGIN_LOCATION]: location
        }
      }
    },
    entity
  );
}

exports.withLocations = withLocations;
//# sourceMappingURL=withLocations.cjs.js.map
