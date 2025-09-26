#!/usr/bin/env bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Utility script to release 1 or more plugins when multi-semantic-release (MSR) fails
# Will create a release on npmjs.com and tag the source repo with @scope/plugin-name@version 
# so that MSR will think the plugin already exists and will skip it

# SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
DRY_RUN=""
PUSH_DYNAMIC=0
PLUGIN_DIRS=""

if [[ ! $NPM_TOKEN ]]; then echo "NPM_TOKEN not set! Get latest token from https://vault.bitwarden.com/"; exit 1; fi

if [[ ! $GITHUB_TOKEN ]]; then echo "GITHUB_TOKEN not set!"; exit 1; fi

usage () {
    echo "\

Utility script to release 1 or more plugins when multi-semantic-release (MSR) fails
Will create a release on npmjs.com and tag the source repo with @scope/plugin-name@version 
so that MSR will think the plugin already exists and will skip it

To use this script, there are a number of steps.

Step 1: get sources

  * If the plugin is already merged to the repo, fetch the latest changes on the main branch; OR
  * If the plugin is being added via a PR, check out the PR sources locally

Step 2: release manually

  * Locally, remove private:true from the package.json (do not commit this change!)
  * Release manually using this script

Step 3: release other plugins (not the new private plugin)

  * Put private:true back in the package.json
  * Regen yarn.lock (or use https://github.com/janus-idp/backstage-plugins/actions/workflows/yarn-lock.yaml)
  * Submit a PR for the above changes
  * Merge the PR: MSR should release everything EXCEPT the new private plugin from https://github.com/janus-idp/backstage-plugins/actions/workflows/push.yaml

Step 4: release the new plugin (non-private)

  * If https://github.com/janus-idp/backstage-plugins/actions/workflows/push.yaml is green, 
  * Remove private:true from the package.json, and submit the PR
  * Merge the PR: MSR should release just the new plugin, updating any plugin refs and yarn.lock if needed

--

Usage: 
  $0 -d /path/to/plugins-project plugins/some-plugin-dir1 [plugins/some-plugin-dir2...]
  
Options:
  --dry-run          do everything but actually pushing to npmjs.com
  --dynamic          if a dist-dynamic folder exists, also push the plugin-foo-dynamic folder
  ";
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '--dry-run') DRY_RUN="$1";;
    '--dynamic') PUSH_DYNAMIC=1;;
    '-d') BASE_DIR="$2"; shift 1;;
    *) PLUGIN_DIRS="$PLUGIN_DIRS $1";;
  esac
  shift 1
done
if [[ ! $BASE_DIR ]]; then usage; exit 1; fi
if [[ ! $PLUGIN_DIRS ]]; then usage; exit 1; fi

for cmd in npm yarn jq git; do
  command -v "$cmd" >/dev/null 2>&1     || which "$cmd" >/dev/null 2>&1     || { echo "$cmd is not installed. Please install it to continue."; exit 1; }
done

npm config set workspaces-update false

for PLUGIN_DIR in $PLUGIN_DIRS; do
    PLUGIN_DIR=${PLUGIN_DIR%/}
    PLUGIN_DIR="${PLUGIN_DIR#"${BASE_DIR}/"}"
    echo "
    PLUGIN_DIR: $PLUGIN_DIR
    BASE_DIR: $BASE_DIR"
    pushd "$PLUGIN_DIR" >/dev/null || exit 1
        yarn --cwd . tsc
        yarn --cwd . build

        # create release
        npm pkg fix --cwd . -w . 
        # to see what was changed
        git diff . 

        # to see what will happen, use --dry-run 
        # shellcheck disable=SC2086
        CMD="npm publish --cwd . --access public -w . $DRY_RUN"
        echo "$CMD"
        $CMD

        # also push the -dynamic content?
        if [[ $PUSH_DYNAMIC -eq 1 ]] && [[ -d 'dist-dynamic' ]]; then 
          echo 'Publish backend derived package ...'
          pushd dist-dynamic >/dev/null || exit 1
            npm pkg delete scripts
            # shellcheck disable=SC2086
            CMD="npm publish --access public $DRY_RUN"
            echo "$CMD"
            $CMD
          popd >/dev/null || exit 1
        fi

        # create tag
        pluginName=$(jq -r .name "package.json")
        pluginVersion=$(jq -r .version "package.json")
        if [[ $DRY_RUN ]]; then
          echo "Tag to create: $pluginName@$pluginVersion"
        else
          git tag "$pluginName@$pluginVersion"
          git push origin "$pluginName@$pluginVersion" || true
          # note: will not recreate an existing tag; if you want that, delete the existing tag first.
        fi
    popd >/dev/null || exit 1
done
