#!/bin/bash
#
# Copyright (c) Red Hat, Inc.
#
# bash wrapper that simply rebuilds the operator-bundle image for changes to its operands
#
# called by .metadata.annotations."build.appstudio.openshift.io/build-nudge-files" in .tekton/*push*.yaml files
# see also sync-midstream.sh

# set -x
set -e

# TODO: are these consistently aligned to the latest images, for the correct 1.y branch?
export RHDH_HUB="quay.io/rhdh/rhdh-hub-rhel9@sha256:73b23b44d5b2fb64a70c7a94deb7bf58619a8398866c302580b778acf7cdbd48"
export RHDH_OPERATOR="quay.io/rhdh/rhdh-rhel9-operator@sha256:d2c7c32a3c0283ebe20f8435c90ef2b41f51d321979ddce0ea35945a2c0ef349"
    
SCRIPTPATH=$(dirname "$(readlink -f "$0")")

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi

latestStableBranch="$(curl -sSLk --url "https://gitlab.cee.redhat.com/api/v4/projects/rhidp%2Frhdh/repository/branches?per_page=200&regex=^rhdh-1..*-rhel-9$" | jq -r '.[].name' | sort -uV | tail -1)"; # echo $latestStableBranch

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
latestNextExample=""
if [[ ${DWNSTM_BRANCH} == "rhdh-"*"-rhel-"* ]]; then 
  if [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]]; then
    latestNextExample="--next"
  elif [[ "$DWNSTM_BRANCH" == "${latestStableBranch}" ]]; then # latest stable branch
    latestNextExample="--latest"
  fi
fi

"${SCRIPTPATH}/sync-midstream.sh" --bundleonly --force -b "$DWNSTM_BRANCH" "$latestNextExample" "$@"
