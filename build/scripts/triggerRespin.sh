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
    $0 1.2 hub,op,bun
    $0 1.3 bun
    $0 1 all

"; 
}

if [[ ! $1 ]] && [[ ! $2 ]]; then 
    usage
    exit 1
fi

MIDSTM_BRANCH=rhdh-${1}-rhel-9
targets="$2"
if [[ $targets == *","* ]]; then
    commitMsg="trigger ${MIDSTM_BRANCH} builds: $targets"
else
    commitMsg="trigger ${MIDSTM_BRANCH} build: $targets"
fi
echo "$commitMsg ..."
if [[ $targets == "all" ]]; then targets="hub,op,bun"; fi

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
google-chrome https://gitlab.cee.redhat.com/rhidp/rhdh/-/pipelines

# cleanup
if [[ -d /tmp/rhdh-tmp ]]; then rm -fr /tmp/rhdh-tmp; fi
