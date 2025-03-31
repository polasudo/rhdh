#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# for changes to midstream or missed changes upstream (due to pipeline failure),
# this script can be used to force a new build to occur by deleting content in the sync/ folder
#

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR"/../../ || exit; pwd)

usage () {
    echo "

Usage:

    # use existing sources
    cd /path/to/gitlab-rhdh-folder 
    $0 VERSION IMAGE1[,IMAGE2][,IMAGE3] 

or

    # check out sources if not already on disk
    $0 VERSION IMAGE1[,IMAGE2][,IMAGE3] 

Examples: 
    $0 1 hub,op  # both hub and operator (NOT bundle)
    $0 1.6 hub   # only hub
    $0 1.6 op    # only operator
    $0 1.6 bun   # only bundle
"; 
}

if [[ ! $1 ]] && [[ ! $2 ]]; then 
    usage
    exit 1
fi

MIDSTM_BRANCH=rhdh-${1}-rhel-9
targets="$2"

if [[ $targets == "bun" ]]; then
    latestStableBranch="$(curl -sSLk --url "https://gitlab.cee.redhat.com/api/v4/projects/rhidp%2Frhdh/repository/branches?per_page=200&regex=^rhdh-1..*-rhel-9$" | jq -r '.[].name' | sort -uV | tail -1)"; # echo $latestStableBranch
    latestNext=""
    if [[ ${DWNSTM_BRANCH} == "rhdh-"*"-rhel-"* ]]; then 
        if [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]]; then
            latestNext="--next"
        elif [[ "$DWNSTM_BRANCH" == "${latestStableBranch}" ]]; then # latest stable branch
            latestNext="--latest"
        fi
    fi
    "${SCRIPT_DIR}/../ci/sync-midstream.sh" --bundleonly --force $latestNext -b "${MIDSTM_BRANCH}"
else
    if [[ $targets == *","* ]]; then
        commitMsg="trigger ${MIDSTM_BRANCH} builds: $targets"
    else
        commitMsg="trigger ${MIDSTM_BRANCH} build: $targets"
    fi
    echo "$commitMsg ..."
    if [[ $targets == "all" ]]; then targets="hub,op"; fi

    targets=${targets/hub/upstream_SHA_rhdh-hub}
    targets=${targets/operator/upstream_SHA_rhdh-operator}
    targets=${targets/op/upstream_SHA_rhdh-operator}
    targets=${targets/bundle/upstream_SHA_rhdh-operator-bundle}
    targets=${targets/bun/upstream_SHA_rhdh-operator-bundle}
    targets=${targets//,/ }
    if [[ -d "$ROOT_DIR/sync" ]]; then 
        cd "$ROOT_DIR" || exit 1
    else
        cd /tmp || exit 1
        rm -fr /tmp/rhdh-tmp
        git clone git@gitlab.cee.redhat.com:rhidp/rhdh.git rhdh-tmp || exit 1
        cd rhdh-tmp || exit 1
        git checkout "$MIDSTM_BRANCH" || exit 1
    fi
    git checkout "${MIDSTM_BRANCH}"
    git pull origin "${MIDSTM_BRANCH}"

    for target in $targets; do 
        if [[ -f sync/$target ]]; then
            echo "" > "sync/$target"
        fi
    done
    git diff --name-status sync/
    git commit -s -m "$commitMsg" sync/
    git push origin "${MIDSTM_BRANCH}"

    # cleanup
    if [[ -d /tmp/rhdh-tmp ]]; then rm -fr /tmp/rhdh-tmp; fi
fi

google-chrome https://gitlab.cee.redhat.com/rhidp/rhdh/-/pipelines
