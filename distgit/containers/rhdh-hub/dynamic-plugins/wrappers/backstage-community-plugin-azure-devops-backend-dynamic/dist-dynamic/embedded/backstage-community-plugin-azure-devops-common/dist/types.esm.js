var BuildResult = /* @__PURE__ */ ((BuildResult2) => {
  BuildResult2[BuildResult2["None"] = 0] = "None";
  BuildResult2[BuildResult2["Succeeded"] = 2] = "Succeeded";
  BuildResult2[BuildResult2["PartiallySucceeded"] = 4] = "PartiallySucceeded";
  BuildResult2[BuildResult2["Failed"] = 8] = "Failed";
  BuildResult2[BuildResult2["Canceled"] = 32] = "Canceled";
  return BuildResult2;
})(BuildResult || {});
var BuildStatus = /* @__PURE__ */ ((BuildStatus2) => {
  BuildStatus2[BuildStatus2["None"] = 0] = "None";
  BuildStatus2[BuildStatus2["InProgress"] = 1] = "InProgress";
  BuildStatus2[BuildStatus2["Completed"] = 2] = "Completed";
  BuildStatus2[BuildStatus2["Cancelling"] = 4] = "Cancelling";
  BuildStatus2[BuildStatus2["Postponed"] = 8] = "Postponed";
  BuildStatus2[BuildStatus2["NotStarted"] = 32] = "NotStarted";
  BuildStatus2[BuildStatus2["All"] = 47] = "All";
  return BuildStatus2;
})(BuildStatus || {});
var PullRequestStatus = /* @__PURE__ */ ((PullRequestStatus2) => {
  PullRequestStatus2[PullRequestStatus2["NotSet"] = 0] = "NotSet";
  PullRequestStatus2[PullRequestStatus2["Active"] = 1] = "Active";
  PullRequestStatus2[PullRequestStatus2["Abandoned"] = 2] = "Abandoned";
  PullRequestStatus2[PullRequestStatus2["Completed"] = 3] = "Completed";
  PullRequestStatus2[PullRequestStatus2["All"] = 4] = "All";
  return PullRequestStatus2;
})(PullRequestStatus || {});
var PolicyEvaluationStatus = /* @__PURE__ */ ((PolicyEvaluationStatus2) => {
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Queued"] = 0] = "Queued";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Running"] = 1] = "Running";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Approved"] = 2] = "Approved";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Rejected"] = 3] = "Rejected";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["NotApplicable"] = 4] = "NotApplicable";
  PolicyEvaluationStatus2[PolicyEvaluationStatus2["Broken"] = 5] = "Broken";
  return PolicyEvaluationStatus2;
})(PolicyEvaluationStatus || {});
var PolicyType = /* @__PURE__ */ ((PolicyType2) => {
  PolicyType2["Build"] = "Build";
  PolicyType2["Status"] = "Status";
  PolicyType2["MinimumReviewers"] = "MinimumReviewers";
  PolicyType2["Comments"] = "Comments";
  PolicyType2["RequiredReviewers"] = "RequiredReviewers";
  PolicyType2["MergeStrategy"] = "MergeStrategy";
  return PolicyType2;
})(PolicyType || {});
var PolicyTypeId = /* @__PURE__ */ ((PolicyTypeId2) => {
  PolicyTypeId2["Build"] = "0609b952-1397-4640-95ec-e00a01b2c241";
  PolicyTypeId2["Status"] = "cbdc66da-9728-4af8-aada-9a5a32e4a226";
  PolicyTypeId2["MinimumReviewers"] = "fa4e907d-c16b-4a4c-9dfa-4906e5d171dd";
  PolicyTypeId2["Comments"] = "c6a1889d-b943-4856-b76f-9e46bb6b0df2";
  PolicyTypeId2["RequiredReviewers"] = "fd2167ab-b0be-447a-8ec8-39368250530e";
  PolicyTypeId2["MergeStrategy"] = "fa4e907d-c16b-4a4c-9dfa-4916e5d171ab";
  return PolicyTypeId2;
})(PolicyTypeId || {});
var PullRequestVoteStatus = /* @__PURE__ */ ((PullRequestVoteStatus2) => {
  PullRequestVoteStatus2[PullRequestVoteStatus2["Approved"] = 10] = "Approved";
  PullRequestVoteStatus2[PullRequestVoteStatus2["ApprovedWithSuggestions"] = 5] = "ApprovedWithSuggestions";
  PullRequestVoteStatus2[PullRequestVoteStatus2["NoVote"] = 0] = "NoVote";
  PullRequestVoteStatus2[PullRequestVoteStatus2["WaitingForAuthor"] = -5] = "WaitingForAuthor";
  PullRequestVoteStatus2[PullRequestVoteStatus2["Rejected"] = -10] = "Rejected";
  return PullRequestVoteStatus2;
})(PullRequestVoteStatus || {});

export { BuildResult, BuildStatus, PolicyEvaluationStatus, PolicyType, PolicyTypeId, PullRequestStatus, PullRequestVoteStatus };
//# sourceMappingURL=types.esm.js.map
