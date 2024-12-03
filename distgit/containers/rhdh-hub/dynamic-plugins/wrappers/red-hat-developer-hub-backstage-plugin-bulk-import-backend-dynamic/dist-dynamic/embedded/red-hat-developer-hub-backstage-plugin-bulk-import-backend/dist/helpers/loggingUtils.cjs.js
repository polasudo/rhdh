'use strict';

var errors = require('@backstage/errors');

function logErrorIfNeeded(logger, logMsg, error) {
  if (errors.isError(error)) {
    logger.error(logMsg, {
      // Default Error properties:
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Additional status code if available:
      status: error.response?.status
    });
  }
}

exports.logErrorIfNeeded = logErrorIfNeeded;
//# sourceMappingURL=loggingUtils.cjs.js.map
