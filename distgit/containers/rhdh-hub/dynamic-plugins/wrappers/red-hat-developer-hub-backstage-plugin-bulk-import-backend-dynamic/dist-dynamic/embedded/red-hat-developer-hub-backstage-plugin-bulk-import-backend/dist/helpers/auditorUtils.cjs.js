'use strict';

var kebabCase = require('just-kebab-case');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var kebabCase__default = /*#__PURE__*/_interopDefaultCompat(kebabCase);

const UNKNOWN_ENDPOINT_EVENT = `unknown-endpoint`;
async function auditCreateEvent(auditor, eventId, req, meta) {
  return await auditor.createEvent({
    eventId: eventId ? kebabCase__default.default(eventId) : UNKNOWN_ENDPOINT_EVENT,
    severityLevel: "medium",
    request: req,
    meta
  });
}

exports.auditCreateEvent = auditCreateEvent;
//# sourceMappingURL=auditorUtils.cjs.js.map
