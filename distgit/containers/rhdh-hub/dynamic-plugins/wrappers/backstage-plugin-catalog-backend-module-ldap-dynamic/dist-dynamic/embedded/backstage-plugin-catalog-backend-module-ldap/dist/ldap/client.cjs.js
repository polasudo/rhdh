'use strict';

var errors = require('@backstage/errors');
var promises = require('fs/promises');
var ldap = require('ldapjs');
var lodash = require('lodash');
var tlsLib = require('tls');
var util = require('./util.cjs.js');
var vendors = require('./vendors.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var ldap__default = /*#__PURE__*/_interopDefaultCompat(ldap);
var tlsLib__default = /*#__PURE__*/_interopDefaultCompat(tlsLib);

class LdapClient {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  vendor;
  static async create(logger, target, bind, tls) {
    let secureContext;
    if (tls && tls.certs && tls.keys) {
      const cert = await promises.readFile(tls.certs, "utf-8");
      const key = await promises.readFile(tls.keys, "utf-8");
      secureContext = tlsLib__default.default.createSecureContext({
        cert,
        key
      });
    }
    const client = ldap__default.default.createClient({
      url: target,
      tlsOptions: {
        secureContext,
        rejectUnauthorized: tls?.rejectUnauthorized
      }
    });
    client.on("error", (err) => {
      logger.warn(`LDAP client threw an error, ${util.errorString(err)}`);
    });
    if (!bind) {
      return new LdapClient(client, logger);
    }
    return new Promise((resolve, reject) => {
      const { dn, secret } = bind;
      client.bind(dn, secret, (err) => {
        if (err) {
          reject(`LDAP bind failed for ${dn}, ${util.errorString(err)}`);
        } else {
          resolve(new LdapClient(client, logger));
        }
      });
    });
  }
  /**
   * Performs an LDAP search operation.
   *
   * @param dn - The fully qualified base DN to search within
   * @param options - The search options
   */
  async search(dn, options) {
    try {
      const output = [];
      const logInterval = setInterval(() => {
        this.logger.debug(`Read ${output.length} LDAP entries so far...`);
      }, 5e3);
      const search = new Promise((resolve, reject) => {
        this.client.search(dn, lodash.cloneDeep(options), (err, res) => {
          if (err) {
            reject(new Error(util.errorString(err)));
            return;
          }
          res.on("searchReference", () => {
            this.logger.warn("Received unsupported search referral");
          });
          res.on("searchEntry", (entry) => {
            output.push(entry);
          });
          res.on("error", (e) => {
            reject(new Error(util.errorString(e)));
          });
          res.on("page", (_result, cb) => {
            if (cb) {
              cb();
            }
          });
          res.on("end", (r) => {
            if (!r) {
              reject(new Error("Null response"));
            } else if (r.status !== 0) {
              reject(new Error(`Got status ${r.status}: ${r.errorMessage}`));
            } else {
              resolve(output);
            }
          });
        });
      });
      return await search.finally(() => {
        clearInterval(logInterval);
      });
    } catch (e) {
      throw new errors.ForwardedError(`LDAP search at DN "${dn}" failed`, e);
    }
  }
  /**
   * Performs an LDAP search operation, calls a function on each entry to limit memory usage
   *
   * @param dn - The fully qualified base DN to search within
   * @param options - The search options
   * @param f - The callback to call on each search entry
   */
  async searchStreaming(dn, options, f) {
    try {
      return await new Promise((resolve, reject) => {
        this.client.search(dn, util.createOptions(options), (err, res) => {
          if (err) {
            reject(new Error(util.errorString(err)));
          }
          let awaitList = [];
          let transformError = false;
          const transformReject = (e) => {
            transformError = true;
            reject(
              new Error(
                `Transform function threw an exception, ${errors.stringifyError(e)}`
              )
            );
          };
          res.on("searchReference", () => {
            this.logger.warn("Received unsupported search referral");
          });
          res.on("searchEntry", (entry) => {
            if (!transformError) awaitList.push(f(entry));
          });
          res.on("page", (_, cb) => {
            Promise.all(awaitList).then(() => {
              awaitList = [];
              if (cb) cb();
            }).catch(transformReject);
          });
          res.on("error", (e) => {
            reject(new Error(util.errorString(e)));
          });
          res.on("end", (r) => {
            if (!r) {
              throw new Error("Null response");
            } else if (r.status !== 0) {
              throw new Error(`Got status ${r.status}: ${r.errorMessage}`);
            } else {
              Promise.all(awaitList).then(() => resolve()).catch(transformReject);
            }
          });
        });
      });
    } catch (e) {
      throw new errors.ForwardedError(`LDAP search at DN "${dn}" failed`, e);
    }
  }
  /**
   * Get the Server Vendor.
   * Currently only detects Microsoft Active Directory Servers.
   *
   * @see https://ldapwiki.com/wiki/Determine%20LDAP%20Server%20Vendor
   */
  async getVendor() {
    if (this.vendor) {
      return this.vendor;
    }
    const clientHost = this.client?.host || "";
    this.vendor = this.getRootDSE().then((root) => {
      if (root && root.raw?.forestFunctionality) {
        return vendors.ActiveDirectoryVendor;
      } else if (root && root.raw?.ipaDomainLevel) {
        return vendors.FreeIpaVendor;
      } else if (root && "aeRoot" in root.raw) {
        return vendors.AEDirVendor;
      } else if (clientHost === "ldap.google.com") {
        return vendors.GoogleLdapVendor;
      } else if (root && root.raw?.vendorName?.toString() === "LLDAP") {
        return vendors.LLDAPVendor;
      }
      return vendors.DefaultLdapVendor;
    }).catch((err) => {
      this.vendor = void 0;
      throw err;
    });
    return this.vendor;
  }
  /**
   * Get the Root DSE.
   *
   * @see https://ldapwiki.com/wiki/RootDSE
   */
  async getRootDSE() {
    const result = await this.search("", {
      scope: "base",
      filter: "(objectclass=*)"
    });
    if (result && result.length === 1) {
      return result[0];
    }
    return void 0;
  }
}

exports.LdapClient = LdapClient;
//# sourceMappingURL=client.cjs.js.map
