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

export RHDH_HUB="quay.io/rhdh/rhdh-hub-rhel9@sha256:1c2fead5406f7c1c164efa83b56210839bc296400284d3ca80753ccdc08f274a"
export RHDH_OPERATOR="quay.io/rhdh/rhdh-rhel9-operator@sha256:9539680c13deaac90cd6846bd5a39d5ce593eb92b6ce377076de2f09eb9dcc33"
    
SCRIPTPATH=$(dirname "$(readlink -f "$0")")

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi

# TODO set --latest or --next if applicable here
"${SCRIPTPATH}/sync-midstream.sh" --bundleonly --force -b "$DWNSTM_BRANCH" "$@"
