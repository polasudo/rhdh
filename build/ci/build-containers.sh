#!/bin/bash

# orchestrator for the 1 or more builds we need to perform based on upstream or midstream changes
# run everything but the bundle in parallel, then do the bundle after

# SCRIPT=$(readlink -f "$0")
# ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/ci}

# decide if we need to rebuild anything based on downstream sync results
DO_BUILDS=""
for REPO in rhdh-operator rhdh-hub rhdh-operator-bundle; do
  #  if change to hub, operator or bundle, trigger respin
  sync_check_repo=$(git diff --name-only HEAD~1 distgit/containers/$REPO/ || true; git diff --name-only HEAD~2 distgit/containers/$REPO/ || true)
  if [[ -f outputs2/sync-downstream.sh.$REPO.diff.txt ]] || [[ $sync_check_repo ]]; then
    echo "Diff to determine if we build $REPO:"
    echo "=============DIFF====================>"
    if [[ -f outputs2/sync-downstream.sh.$REPO.diff.txt ]]; then 
      cat outputs2/sync-downstream.sh.$REPO.diff.txt; 
    else 
      echo "[INFO] outputs2/sync-downstream.sh.$REPO.diff.txt not found."; 
    fi
    echo "--------------------------------------"
    echo "$sync_check_repo"
    echo "<=============DIFF===================="
    DO_BUILDS="$DO_BUILDS $REPO"
  fi
done
#  if changes to hub or operator, always build bundle
if [[ $DO_BUILDS ]] && [[ $DO_BUILDS != *"rhdh-operator-bundle" ]]; then DO_BUILDS="$DO_BUILDS rhdh-operator-bundle"; fi

function doBrewBuild() {
    local thisREPO
    thisREPO="$1"
    echo "Build $thisREPO container from branch $CI_COMMIT_REF_NAME ..."
    ## for testing parallel builds without actually building
    ## echo "    sleeping ${#thisREPO}s"; sleep ${#thisREPO}s; echo "$thisREPO done"
    echo "STARTED: build-downstream.sh -d $thisREPO ..."
    ./build/ci/build-downstream.sh -b "$CI_COMMIT_REF_NAME" -d "$thisREPO" || exit 17
    echo "DONE: build-downstream.sh -d $thisREPO"

    # echo "Currently in $(pwd)"
    # store results to be used in next stage
    mkdir -p outputs3; touch "outputs3/build-downstream.sh.$thisREPO.result.txt"
    if [[ -f /tmp/build-downstream.sh.$thisREPO.result.txt ]]; then mv -f "/tmp/build-downstream.sh.$thisREPO.result.txt" outputs3/; fi
    cancel_or_fail="$(grep -E "State: canceled|State: failed" "outputs3/build-downstream.sh.$thisREPO.result.txt" || true)"
    if [[ $cancel_or_fail ]]; then
      echo "OSBS Build $cancel_or_fail - must exit!"
      exit 99
    fi
}

if [[ $DO_BUILDS ]]; then
  echo "Build Plan: $DO_BUILDS"; echo
  # run non-bundle builds first
  for REPO in $DO_BUILDS; do
    if [[ $REPO != "rhdh-operator-bundle" ]]; then
        doBrewBuild "$REPO"
    fi
  done
  # then do bundle if needed
  if [[ $DO_BUILDS == *"rhdh-operator-bundle" ]]; then
    doBrewBuild rhdh-operator-bundle
  fi
else
  echo "No diff in midstream or downstream, so nothing to build!"
  cancel_pipeline
fi
