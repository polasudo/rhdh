'use strict';

var errors = require('@backstage/errors');

const EVENT_PREFIX = "BulkImport";
const UNKNOWN_ENDPOINT_EVENT = `${EVENT_PREFIX}UnknownEndpoint`;
async function auditLogRequestSuccess(auditLogger, openApiOperationId, req, responseStatus) {
  if (!openApiOperationId) {
    auditLogUnknownEndpoint(auditLogger, req);
    return;
  }
  auditLogger.auditLog({
    eventName: operationIdToEventName(openApiOperationId),
    stage: "completion",
    status: "succeeded",
    level: "info",
    request: req,
    response: {
      status: responseStatus
    },
    message: `'${req.method} ${req.path}' endpoint hit by ${await auditLogger.getActorId(req)}`
  });
}
async function auditLogRequestError(auditLogger, openApiOperationId, req, error) {
  if (!openApiOperationId) {
    auditLogUnknownEndpoint(auditLogger, req);
    return;
  }
  auditLogger.auditLog({
    eventName: operationIdToEventName(openApiOperationId),
    stage: "completion",
    status: "failed",
    level: "error",
    request: req,
    response: {
      status: 500,
      body: {
        errors: [
          {
            name: error.name,
            message: error.message || "internal server error"
          }
        ]
      }
    },
    errors: [error],
    message: `Error while requesting the '${req.method} ${req.path}' endpoint (request from ${await auditLogger.getActorId(req)})`
  });
}
async function auditLogUnknownEndpoint(auditLogger, req) {
  const error = new errors.NotFoundError(`'${req.method} ${req.path}' not found`);
  auditLogger.auditLog({
    eventName: UNKNOWN_ENDPOINT_EVENT,
    stage: "initiation",
    status: "failed",
    level: "info",
    request: req,
    response: {
      status: 404,
      body: {
        errors: [
          {
            name: error.name,
            message: error.message
          }
        ]
      }
    },
    errors: [error],
    message: `${await auditLogger.getActorId(req)} requested the unknown '${req.method} ${req.path}' endpoint`
  });
}
async function auditLogAuthError(auditLogger, openApiOperationId, req, error) {
  if (!openApiOperationId) {
    auditLogUnknownEndpoint(auditLogger, req);
    return;
  }
  auditLogger.auditLog({
    eventName: operationIdToEventName(openApiOperationId),
    stage: "authorization",
    status: "failed",
    level: "warn",
    request: req,
    response: {
      status: 403,
      body: {
        errors: [
          {
            name: error.name,
            message: error.message
          }
        ]
      }
    },
    errors: [error],
    message: `${await auditLogger.getActorId(
      req
    )} not authorized to request the '${req.method} ${req.path}' endpoint`
  });
}
function operationIdToEventName(openApiOperationId) {
  if (openApiOperationId.length === 0) {
    return EVENT_PREFIX;
  }
  return `${EVENT_PREFIX}${openApiOperationId.charAt(0).toUpperCase()}${openApiOperationId.slice(1)}`;
}

exports.auditLogAuthError = auditLogAuthError;
exports.auditLogRequestError = auditLogRequestError;
exports.auditLogRequestSuccess = auditLogRequestSuccess;
exports.auditLogUnknownEndpoint = auditLogUnknownEndpoint;
//# sourceMappingURL=auditLogUtils.cjs.js.map
