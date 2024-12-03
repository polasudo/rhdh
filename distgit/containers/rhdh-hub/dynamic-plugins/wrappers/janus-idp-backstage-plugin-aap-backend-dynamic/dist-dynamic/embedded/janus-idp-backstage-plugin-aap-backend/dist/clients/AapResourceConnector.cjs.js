'use strict';

async function listJobTemplates(baseUrl, access_token) {
  const res = await fetch(`${baseUrl}/api/v2/job_templates`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: access_token
    },
    method: "GET"
  });
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  const data = await res.json();
  return data.results;
}
async function listWorkflowJobTemplates(baseUrl, access_token) {
  const res = await fetch(`${baseUrl}/api/v2/workflow_job_templates`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: access_token
    },
    method: "GET"
  });
  if (!res.ok) {
    throw new Error(res.statusText);
  }
  const data = await res.json();
  return data.results;
}

exports.listJobTemplates = listJobTemplates;
exports.listWorkflowJobTemplates = listWorkflowJobTemplates;
//# sourceMappingURL=AapResourceConnector.cjs.js.map
