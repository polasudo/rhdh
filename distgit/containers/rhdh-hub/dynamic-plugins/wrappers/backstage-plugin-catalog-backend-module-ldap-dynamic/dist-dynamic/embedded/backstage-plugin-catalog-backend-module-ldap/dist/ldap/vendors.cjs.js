'use strict';

const DefaultLdapVendor = {
  dnAttributeName: "entryDN",
  uuidAttributeName: "entryUUID",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
const ActiveDirectoryVendor = {
  dnAttributeName: "distinguishedName",
  uuidAttributeName: "objectGUID",
  decodeStringAttribute: (entry, name) => {
    const decoder = (value) => {
      if (name === ActiveDirectoryVendor.uuidAttributeName) {
        return formatGUID(value);
      }
      return value.toString();
    };
    return decode(entry, name, decoder);
  }
};
const FreeIpaVendor = {
  dnAttributeName: "dn",
  uuidAttributeName: "ipaUniqueID",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
const AEDirVendor = {
  dnAttributeName: "dn",
  uuidAttributeName: "entryUUID",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
const GoogleLdapVendor = {
  dnAttributeName: "dn",
  uuidAttributeName: "uid",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name, (value) => {
      return value.toString();
    });
  }
};
const LLDAPVendor = {
  dnAttributeName: "dn",
  uuidAttributeName: "entryuuid",
  decodeStringAttribute: (entry, name) => {
    return decode(entry, name.toLocaleLowerCase("en-US"), (value) => {
      return value.toString();
    });
  }
};
function decode(entry, attributeName, decoder) {
  const values = entry.raw[attributeName];
  if (Array.isArray(values)) {
    return values.map((v) => {
      return decoder(v);
    });
  } else if (values) {
    return [decoder(values)];
  }
  return [];
}
function formatGUID(objectGUID) {
  let data;
  if (typeof objectGUID === "string") {
    data = Buffer.from(objectGUID, "binary");
  } else {
    data = objectGUID;
  }
  let template = "{3}{2}{1}{0}-{5}{4}-{7}{6}-{8}{9}-{10}{11}{12}{13}{14}{15}";
  for (let i = 0; i < data.length; i++) {
    let dataStr = data[i].toString(16);
    dataStr = data[i] >= 16 ? dataStr : `0${dataStr}`;
    template = template.replace(`{${i}}`, dataStr);
  }
  return template;
}

exports.AEDirVendor = AEDirVendor;
exports.ActiveDirectoryVendor = ActiveDirectoryVendor;
exports.DefaultLdapVendor = DefaultLdapVendor;
exports.FreeIpaVendor = FreeIpaVendor;
exports.GoogleLdapVendor = GoogleLdapVendor;
exports.LLDAPVendor = LLDAPVendor;
//# sourceMappingURL=vendors.cjs.js.map
