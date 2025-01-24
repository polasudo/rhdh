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

SCRIPTPATH=$(dirname "$(readlink -f "$0")")

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi

# TODO set --latest or --next if applicable here
"${SCRIPTPATH}/sync-midstream.sh" --bundleonly --force -b "$DWNSTM_BRANCH" "$@"
