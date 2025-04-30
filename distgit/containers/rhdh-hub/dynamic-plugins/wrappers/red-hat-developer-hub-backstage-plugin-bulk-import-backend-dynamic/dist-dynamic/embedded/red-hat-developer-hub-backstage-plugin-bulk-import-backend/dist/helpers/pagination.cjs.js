'use strict';

function paginateArray(array, page, size) {
  if (page <= 0) {
    throw new Error(`page must be >0. Got page=${page}`);
  }
  if (size < 0) {
    throw new Error(`size must be >=0. Got size=${size}`);
  }
  const startIndex = (page - 1) * size;
  const endIndex = startIndex + size;
  return {
    result: array?.slice(startIndex, endIndex) ?? [],
    totalCount: array?.length ?? 0
  };
}

exports.paginateArray = paginateArray;
//# sourceMappingURL=pagination.cjs.js.map
