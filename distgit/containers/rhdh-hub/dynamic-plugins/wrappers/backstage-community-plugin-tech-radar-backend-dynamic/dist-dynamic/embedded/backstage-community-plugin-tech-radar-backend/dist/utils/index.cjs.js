'use strict';

var pluginTechRadarCommon = require('@backstage-community/plugin-tech-radar-common');

async function readTechRadarResponseFromURL(url, urlReader, logger) {
  let buffer = void 0;
  let responseJson = void 0;
  try {
    const response = await urlReader.readUrl(url);
    buffer = await response.buffer();
  } catch (e) {
    logger.warn(
      `Failed to read file from ${url} with provided integrations (error is "${e.message}").`
    );
  }
  if (buffer) {
    try {
      responseJson = JSON.parse(buffer.toString());
      const validationResult = pluginTechRadarCommon.TechRadarLoaderResponseParser.safeParse(responseJson);
      if (!validationResult.success) {
        const errorMessage = `Could not parse data from remote URL '${url}' because validation failed: ${aggregateErrorMessages(
          validationResult.error
        )}. URL must serve JSON that is compatible with the TechRadarLoaderResponse schema.`;
        logger.error(errorMessage);
      }
      return validationResult.data;
    } catch (e) {
      logger.error(
        `Failed to parse JSON from remote resource ${url}, data will not be loaded!`
      );
    }
  }
  return void 0;
}
function aggregateErrorMessages(zodError) {
  return zodError.issues.reduce((acc, issue) => {
    if (issue) {
      return [acc, `${issue.message} parameter '${issue.path}'`].filter(Boolean).join(". ");
    }
    return acc;
  }, "");
}

exports.readTechRadarResponseFromURL = readTechRadarResponseFromURL;
//# sourceMappingURL=index.cjs.js.map
