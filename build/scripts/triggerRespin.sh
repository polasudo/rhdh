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

# set true to change the 'max-keep-runs' value in the .tekton push pipeline
# this will trigger a konflux build (without triggering sync-midstream.sh)
KONFLUX_ONLY=0

usage () {
    echo "

Usage:

    # use existing sources
    cd /path/to/gitlab-rhdh-folder 
    $0 -v VERSION IMAGE1[,IMAGE2][,IMAGE3] [-k] 

or

    # check out sources if not already on disk
    $0 -v VERSION IMAGE1[,IMAGE2][,IMAGE3] [-k] 

Examples: 
    $0 -v 1 hub,op    # both hub and operator (NOT bundle)
    $0 -v 1 all       # both hub and operator (NOT bundle)
    $0 -v 1.6 hub     # only hub
    $0 -v 1.6 hub -k  # only hub, no midstream sync (konflux only)
    $0 -v 1.6 op      # only operator
    $0 -v 1.6 bun     # only bundle
"; 
}

if [[ $# -lt 3 ]]; then 
	usage
	exit 1
fi

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
	'-h'|'--help') usage; exit;;
	'-v') BRANCH=$2; shift 2;;
	'-k') KONFLUX_ONLY=1; shift 1;;
    *) targets="$1"; shift 1;;
  esac
done

MIDSTM_BRANCH=rhdh-${BRANCH}-rhel-9

if [[ $targets == "bun" ]] && [[ $KONFLUX_ONLY -eq 0 ]]; then
    latestStableBranch="$(curl -sSLk --url "https://gitlab.cee.redhat.com/api/v4/projects/rhidp%2Frhdh/repository/branches?per_page=200&regex=^rhdh-1..*-rhel-9$" | jq -r '.[].name' | sort -uV | tail -1)"; # echo $latestStableBranch
    latestNext=""
    if [[ ${MIDSTM_BRANCH} == "rhdh-"*"-rhel-"* ]]; then 
        if [[ $MIDSTM_BRANCH == "rhdh-1-rhel-9" ]]; then
            latestNext="--next"
        elif [[ "$MIDSTM_BRANCH" == "${latestStableBranch}" ]]; then # latest stable branch
            latestNext="--latest"
        fi
    fi
    "${SCRIPT_DIR}/../ci/sync-midstream.sh" --bundleonly --force $latestNext -b "${MIDSTM_BRANCH}"
    google-chrome "https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/rhdh-${BRANCH/./-}/activity/pipelineruns?name=bundle"
else
    if [[ $targets == *","* ]]; then
        commitMsg="trigger ${MIDSTM_BRANCH} builds: $targets"
    else
        commitMsg="trigger ${MIDSTM_BRANCH} build: $targets"
    fi
    
    # avoid gitlab pipelines for the konflux only respins
    if [[ $KONFLUX_ONLY -eq 1 ]]; then commitMsg="$commitMsg [ci skip]"; fi

    echo "$commitMsg ..."
    if [[ $targets == "all" ]]; then targets="hub,op"; fi

    if [[ $KONFLUX_ONLY -eq 1 ]]; then
        targets=${targets/op/operator}
        targets=${targets/bun/operator-bundle}
        targets=${targets//,/ }
    else
        targets=${targets/hub/upstream_SHA_rhdh-hub}
        targets=${targets/operator/upstream_SHA_rhdh-operator}
        targets=${targets/op/upstream_SHA_rhdh-operator}
        targets=${targets/bundle/upstream_SHA_rhdh-operator-bundle}
        targets=${targets/bun/upstream_SHA_rhdh-operator-bundle}
        targets=${targets//,/ }
    fi
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

    if [[ $KONFLUX_ONLY -eq 1 ]]; then
        for target in $targets; do 
            target_file=$(find "$ROOT_DIR/.tekton" -name "rhdh-${target}-${BRANCH/./-}-push.yaml")
            if [[ ! -f $target_file ]]; then 
                echo "[ERROR] Could not find $target_file!"; exit 1
            fi
            max_keep=$(yq -r '.metadata.annotations."pipelinesascode.tekton.dev/max-keep-runs"' "$target_file")
            (( max_keep = max_keep +1 ))
            if [[ $max_keep -eq 9 ]]; then max_keep=6; fi
            echo " > Bump pipelinesascode.tekton.dev/max-keep-runs to $max_keep in $target_file to trigger a respin ..."
            sed -i "$target_file" -r -e 's/(    pipelinesascode.tekton.dev\/max-keep-runs: )(.+)/\1\"'$max_keep'\"/'
        done
    else
        for target in $targets; do 
            if [[ -f sync/$target ]]; then
                echo "" > "sync/$target"
            fi
        done
    fi
    git diff --name-status sync/ .tekton/
    git commit -s -m "$commitMsg" sync/ .tekton/
    git push origin "${MIDSTM_BRANCH}"

    # cleanup
    if [[ -d /tmp/rhdh-tmp ]]; then rm -fr /tmp/rhdh-tmp; fi

    if [[ $KONFLUX_ONLY -eq 1 ]]; then
        google-chrome "https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/rhdh-${BRANCH/./-}/activity/pipelineruns?name=on-push"
    else
        google-chrome https://gitlab.cee.redhat.com/rhidp/rhdh/-/pipelines
    fi
fi
