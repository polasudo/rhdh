#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Utility script to release a single plugin when multi-semantic-release (MSR) fails
# Will create a release on npmjs.com and tag the source repo with @scope/plugin-name@version 
# so that MSR will think the plugin already exists and will skip it

# SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
SECRETS_DIR=$(cd "$(dirname "$0")/../../secrets/" || exit; pwd)
PLUGIN_DIRS=""

if [[ ! $NPM_TOKEN ]]; then NPM_TOKEN=$(grep -v -E "^#" "${SECRETS_DIR}"/janus-idp.npm.token); fi
if [[ ! $NPM_TOKEN ]]; then echo "NPM_TOKEN not set!"; exit 1; fi

if [[ ! $GITHUB_TOKEN ]]; then echo "GITHUB_TOKEN not set!"; exit 1; fi

usage () {
    echo "Usage: $0 -d /path/to/project plugins/some-plugin-dir1 [plugins/some-plugin-dir2...]";
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
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

for PLUGIN_DIR in $PLUGIN_DIRS; do
    PLUGIN_DIR=${PLUGIN_DIR%/}
    filter=${PLUGIN_DIR##*/}; filter=${filter//\/}
    PLUGIN_DIR="${PLUGIN_DIR#"${BASE_DIR}/"}"
    echo "
    PLUGIN_DIR: $PLUGIN_DIR
    BASE_DIR: $BASE_DIR
    Filter: $filter"
    pushd "$BASE_DIR" >/dev/null || exit 1
        npm config set workspaces-update false
        yarn build --filter="$filter"

        # create release
        yarn release --ignore-private-packages --filter="$filter" --ci false

        # create tag
        pluginName=$(jq -r .name "$BASE_DIR/$PLUGIN_DIR/package.json")
        pluginVersion=$(jq -r .version "$BASE_DIR/$PLUGIN_DIR/package.json")
        git tag "$pluginName@$pluginVersion"
        git push origin "$pluginName@$pluginVersion" || true
        # note: will not recreate an existing tag; if you want that, delete the existing tag first.
    popd >/dev/null || exit 1
done
