'use strict';

var constants = require('./constants.cjs.js');
var helper = require('./helper.cjs.js');

async function defaultOrganizationTransformer(organization) {
  if (!organization.id || !organization.displayName) {
    return void 0;
  }
  const name = helper.normalizeEntityName(organization.displayName);
  return {
    apiVersion: "backstage.io/v1alpha1",
    kind: "Group",
    metadata: {
      name,
      description: organization.displayName,
      annotations: {
        [constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION]: organization.id
      }
    },
    spec: {
      type: "root",
      profile: {
        displayName: organization.displayName
      },
      children: []
    }
  };
}
function extractGroupName(group) {
  if (group.securityEnabled) {
    return group.displayName;
  }
  return group.mailNickname || group.displayName;
}
async function defaultGroupTransformer(group, groupPhoto) {
  if (!group.id || !group.displayName) {
    return void 0;
  }
  const name = helper.normalizeEntityName(extractGroupName(group));
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "Group",
    metadata: {
      name,
      annotations: {
        [constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION]: group.id
      }
    },
    spec: {
      type: "team",
      profile: {},
      children: []
    }
  };
  if (group.description) {
    entity.metadata.description = group.description;
  }
  if (group.displayName) {
    entity.spec.profile.displayName = group.displayName;
  }
  if (group.mail) {
    entity.spec.profile.email = group.mail;
  }
  if (groupPhoto) {
    entity.spec.profile.picture = groupPhoto;
  }
  return entity;
}
async function defaultUserTransformer(user, userPhoto) {
  if (!user.id || !user.displayName) {
    return void 0;
  }
  const name = user.mail ? helper.normalizeEntityName(user.mail) : helper.normalizeEntityName(user.userPrincipalName);
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "User",
    metadata: {
      name,
      annotations: {
        [constants.MICROSOFT_GRAPH_USER_ID_ANNOTATION]: user.id
      }
    },
    spec: {
      profile: {
        displayName: user.displayName
        // TODO: Additional fields?
        // jobTitle: user.jobTitle || undefined,
        // officeLocation: user.officeLocation || undefined,
        // mobilePhone: user.mobilePhone || undefined,
      },
      memberOf: []
    }
  };
  if (user.mail) {
    entity.metadata.annotations[constants.MICROSOFT_EMAIL_ANNOTATION] = user.mail;
    entity.spec.profile.email = user.mail;
  }
  if (userPhoto) {
    entity.spec.profile.picture = userPhoto;
  }
  return entity;
}

exports.defaultGroupTransformer = defaultGroupTransformer;
exports.defaultOrganizationTransformer = defaultOrganizationTransformer;
exports.defaultUserTransformer = defaultUserTransformer;
//# sourceMappingURL=defaultTransformers.cjs.js.map
