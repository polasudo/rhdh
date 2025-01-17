#!/bin/bash
#
# Copyright (c) 2025 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# for a given RHDH 1.y version, find the latest images' sources, branches and commit SHAs

usage() {
    echo "Usage:

Specify one or more images, or a RHDH version to fetch the latest images from quay
    
    $0 repo/org/image:tag repo/org/image@digest ...

        OR

    $0 -v RHDH_VERSION [-b BRANCH]

Options:
    -b BRANCH
    -v RHDH_VERSION

Examples: 
    $0 -v 1.4
    $0 -v 1.5 -b rhdh-1-rhel-9
    $0 quay.io/rhdh/rhdh-rhel9-operator:1.5-70 quay.io/rhdh/rhdh-operator-bundle:1.5-66
"
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') RHDH_VERSION="$2"; shift 2;; 
    '-b') DWNSTM_BRANCH="$2"; shift 2;; 
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
    echo;echo "$q";   
    skopeo inspect "docker://$q" | jq -r '.Env[] | select(.|test("_REPO=")?)'
done