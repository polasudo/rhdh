var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class HttpError extends Error {
  constructor(message, status) {
    super(message);
    __publicField(this, "status");
    this.status = status;
  }
}

const PAGERDUTY_INTEGRATION_KEY = "pagerduty.com/integration-key";
const PAGERDUTY_SERVICE_ID = "pagerduty.com/service-id";

export { HttpError, PAGERDUTY_INTEGRATION_KEY, PAGERDUTY_SERVICE_ID };
//# sourceMappingURL=index.esm.js.map
