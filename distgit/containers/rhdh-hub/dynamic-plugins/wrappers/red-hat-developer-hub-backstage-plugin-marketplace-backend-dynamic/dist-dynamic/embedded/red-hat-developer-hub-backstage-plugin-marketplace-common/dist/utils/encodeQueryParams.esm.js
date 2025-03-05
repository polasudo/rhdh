const encodeEntityFilterQuery = (filter) => {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((v) => {
      params.append("filter", `${key}=${v}`);
    });
  });
  return params;
};
const encodeEntityOrderQuery = (orderFields) => {
  const params = new URLSearchParams();
  if (Array.isArray(orderFields)) {
    orderFields.forEach(({ field, order }) => {
      params.append("orderFields", `${field},${order}`);
    });
  } else {
    const { field, order } = orderFields;
    params.append("orderFields", `${field},${order}`);
  }
  return params;
};
const encodeGetEntitiesRequest = (request) => {
  const params = new URLSearchParams();
  if (!request) {
    return params;
  }
  if (request.fields) {
    request.fields.forEach((field) => params.append("field", field));
  }
  if (request.limit) {
    params.append("limit", String(request.limit));
  }
  if (request.offset) {
    params.append("offset", String(request.offset));
  }
  if (request.filter) {
    encodeEntityFilterQuery(request.filter).forEach(
      (value, key) => params.append(key, value)
    );
  }
  if (request.orderFields) {
    encodeEntityOrderQuery(request.orderFields).forEach(
      (value, key) => params.append(key, value)
    );
  }
  if (request.fullTextFilter?.term) {
    params.append("fullTextTerm", request.fullTextFilter.term);
    request.fullTextFilter.fields?.forEach(
      (field) => params.append("fullTextFields", field)
    );
  }
  return params;
};
const encodeGetEntityFacetsRequest = (request) => {
  const params = new URLSearchParams();
  if (!request) {
    return params;
  }
  if (request.facets) {
    request.facets.forEach((facet) => params.append("facet", facet));
  }
  if (request.filter) {
    encodeEntityFilterQuery(request.filter).forEach(
      (value, key) => params.append(key, value)
    );
  }
  return params;
};

export { encodeEntityFilterQuery, encodeEntityOrderQuery, encodeGetEntitiesRequest, encodeGetEntityFacetsRequest };
//# sourceMappingURL=encodeQueryParams.esm.js.map
