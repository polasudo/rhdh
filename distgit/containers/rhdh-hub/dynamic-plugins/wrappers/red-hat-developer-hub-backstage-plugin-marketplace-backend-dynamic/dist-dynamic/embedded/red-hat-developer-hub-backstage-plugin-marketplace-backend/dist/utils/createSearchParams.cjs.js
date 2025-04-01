'use strict';

const createSearchParams = (req) => {
  const searchParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === "string") searchParams.append(key, v);
      });
    } else if (typeof value === "string") {
      searchParams.append(key, value);
    }
  });
  return searchParams;
};

exports.createSearchParams = createSearchParams;
//# sourceMappingURL=createSearchParams.cjs.js.map
