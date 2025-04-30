'use strict';

class Interceptors {
  _fns;
  constructor() {
    this._fns = [];
  }
  eject(fn) {
    const index = this._fns.indexOf(fn);
    if (index !== -1) {
      this._fns = [...this._fns.slice(0, index), ...this._fns.slice(index + 1)];
    }
  }
  use(fn) {
    this._fns = [...this._fns, fn];
  }
}
const OpenAPI = {
  BASE: "https://dev139850.service-now.com",
  CREDENTIALS: "include",
  ENCODE_PATH: void 0,
  HEADERS: void 0,
  PASSWORD: void 0,
  RESULT: "body",
  TOKEN: void 0,
  USERNAME: void 0,
  VERSION: "latest",
  WITH_CREDENTIALS: false,
  interceptors: { request: new Interceptors(), response: new Interceptors() }
};

exports.Interceptors = Interceptors;
exports.OpenAPI = OpenAPI;
//# sourceMappingURL=OpenAPI.cjs.js.map
