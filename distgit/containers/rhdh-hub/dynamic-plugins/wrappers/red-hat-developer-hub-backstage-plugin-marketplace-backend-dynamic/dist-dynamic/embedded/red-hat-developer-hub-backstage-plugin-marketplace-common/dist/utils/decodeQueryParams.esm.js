const decodeEntityFilterQuery = (searchParams) => {
  if (!searchParams.has("filter")) {
    return undefined;
  }
  const filter = {};
  searchParams.getAll("filter").forEach((keyValuePair) => {
    const firstEqualIndex = keyValuePair.indexOf("=");
    if (firstEqualIndex === -1) {
      return;
    }
    const name = keyValuePair.substring(0, firstEqualIndex);
    const value = keyValuePair.substring(firstEqualIndex + 1);
    const filterStringOrArray = filter[name];
    if (Array.isArray(filterStringOrArray)) {
      filterStringOrArray.push(value);
    } else if (filterStringOrArray) {
      filter[name] = [filterStringOrArray, value];
    } else {
      filter[name] = value;
    }
  });
  return filter;
};
const decodeEntityOrderQuery = (searchParams) => {
  if (!searchParams.has("orderFields")) {
    return undefined;
  }
  const orderFields = searchParams.getAll("orderFields");
  const decodedOrderFields = orderFields.map((field) => {
    const [key, order] = field.split(",");
    return { field: key, order };
  });
  return decodedOrderFields;
};
const decodeGetEntitiesRequest = (searchParams) => {
  const request = {};
  if (searchParams.has("fields")) {
    request.fields = searchParams.getAll("fields");
  }
  if (searchParams.get("limit")) {
    request.limit = Number(searchParams.get("limit"));
  }
  if (searchParams.get("offset")) {
    request.offset = Number(searchParams.get("offset"));
  }
  request.filter = decodeEntityFilterQuery(searchParams);
  request.orderFields = decodeEntityOrderQuery(searchParams);
  if (searchParams.get("fullTextTerm")) {
    request.fullTextFilter = {
      term: searchParams.get("fullTextTerm"),
      fields: searchParams.has("fullTextFields") ? searchParams.getAll("fullTextFields") : undefined
    };
  }
  return request;
};
const decodeGetEntityFacetsRequest = (searchParams) => {
  return {
    facets: searchParams.getAll("facet"),
    filter: decodeEntityFilterQuery(searchParams)
  };
};

export { decodeEntityFilterQuery, decodeEntityOrderQuery, decodeGetEntitiesRequest, decodeGetEntityFacetsRequest };
//# sourceMappingURL=decodeQueryParams.esm.js.map
