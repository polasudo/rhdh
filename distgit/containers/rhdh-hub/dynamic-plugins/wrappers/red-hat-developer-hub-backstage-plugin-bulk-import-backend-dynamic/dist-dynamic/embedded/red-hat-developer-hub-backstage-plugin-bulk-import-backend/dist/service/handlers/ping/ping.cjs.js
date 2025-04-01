'use strict';

async function ping(logger) {
  logger.debug("PONG!");
  return {
    statusCode: 200,
    responseBody: { status: "ok" }
  };
}

exports.ping = ping;
//# sourceMappingURL=ping.cjs.js.map
