'use strict';

function parseGithubOrgUrl(urlString) {
  const path = new URL(urlString).pathname.slice(1).split("/");
  if (path.length === 1 && path[0].length) {
    return { org: decodeURIComponent(path[0]) };
  }
  throw new Error(`Expected a URL pointing to /<org>`);
}
function satisfiesTopicFilter(topics, topicFilter) {
  if (!topicFilter) return true;
  if (!topicFilter.include && !topicFilter.exclude) return true;
  if (!topicFilter.include?.length && !topicFilter.exclude?.length) return true;
  if (topicFilter.include?.length && !topicFilter.exclude) {
    for (const topic of topics) {
      if (topicFilter.include.includes(topic)) return true;
    }
    return false;
  }
  if (!topicFilter.include && topicFilter.exclude?.length) {
    if (!topics.length) return true;
    for (const topic of topics) {
      if (topicFilter.exclude.includes(topic)) return false;
    }
    return true;
  }
  if (topicFilter.include && topicFilter.exclude) {
    const matchesInclude = satisfiesTopicFilter(topics, {
      include: topicFilter.include
    });
    const matchesExclude = !satisfiesTopicFilter(topics, {
      exclude: topicFilter.exclude
    });
    if (matchesExclude) return false;
    return matchesInclude;
  }
  return true;
}
function satisfiesForkFilter(allowForks, isFork) {
  if (!allowForks && isFork) return false;
  return true;
}
function splitTeamSlug(slug) {
  const parts = slug.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Github team slug '${slug}' was not in the expected format <organisation>/<team>`
    );
  }
  return [parts[0], parts[1]];
}
function satisfiesVisibilityFilter(visibilities, visibility) {
  if (!visibilities.length) {
    return true;
  }
  const lowerCaseVisibilities = visibilities.map(
    (v) => v.toLocaleLowerCase("en-US")
  );
  const lowerCaseVisibility = visibility.toLocaleLowerCase("en-US");
  return lowerCaseVisibilities.includes(lowerCaseVisibility);
}

exports.parseGithubOrgUrl = parseGithubOrgUrl;
exports.satisfiesForkFilter = satisfiesForkFilter;
exports.satisfiesTopicFilter = satisfiesTopicFilter;
exports.satisfiesVisibilityFilter = satisfiesVisibilityFilter;
exports.splitTeamSlug = splitTeamSlug;
//# sourceMappingURL=util.cjs.js.map
