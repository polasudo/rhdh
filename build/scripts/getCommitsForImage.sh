#!/usr/bin/env bash
#
# Copyright (c) 2025 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# for a given RHDH 1.y version, find the latest images' sources, branches and commit SHAs

UPSTREAM=0

usage() {
    echo "Usage:

Specify one or more images, or a RHDH version to fetch the latest images from quay
    
    $0 repo/org/image:tag repo/org/image@digest ... [--upstream]

        OR

    $0 -v RHDH_VERSION [-b BRANCH] [--upstream]

Options:
    -b BRANCH
    -v RHDH_VERSION
    --upstream        quieter output: just show the commit SHA for the upstream repo used to build the container

Examples: 
    $0 -v 1.4
    $0 -v 1.5 -b rhdh-1-rhel-9
    $0 quay.io/rhdh/rhdh-hub-rhel9:1.6-91 quay.io/rhdh/rhdh-rhel9-operator:1.6-29 quay.io/rhdh/rhdh-operator-bundle:1.6-140
    $0 registry.redhat.io/rhdh/rhdh-hub-rhel9:1.6.1 --upstream
"
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') RHDH_VERSION="$2"; shift 2;; 
    '-b') DWNSTM_BRANCH="$2"; shift 2;;
    '--upstream') UPSTREAM=1; shift 1;;
    '-h') shift 1; usage; exit;;

    *) CONTAINERS="$CONTAINERS $1"; shift 1;;
  esac
done

if [[ ! $DWNSTM_BRANCH ]]; then DWNSTM_BRANCH="rhdh-${RHDH_VERSION}-rhel-9"; fi
if [[ ! $RHDH_VERSION ]] && [[ ! $CONTAINERS ]]; then usage; exit; fi

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")

# if no containers specified then get the latest ones from the specified stream/branch
if [[ ! $CONTAINERS ]]; then CONTAINERS="$("${SCRIPTPATH}/getLatestImageTags.sh" -b "${DWNSTM_BRANCH}" --quay --tag "${RHDH_VERSION}-")"; fi
for q in $CONTAINERS; do 
if [[ $UPSTREAM -eq  1 ]]; then 
    skopeo inspect "docker://$q" | jq -r '.Env[] | select(.|test("_REPO=")?)' | grep UPSTREAM_REPO= | sed -r -e "s/.+@ //"
else
    echo;echo "$q";   
    skopeo inspect "docker://$q" | jq -r '.Env[] | select(.|test("_REPO=")?)'
fi
done