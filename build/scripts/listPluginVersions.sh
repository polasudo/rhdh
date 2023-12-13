#!/bin/bash
#
# Copyright (c) 2023 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Utility script to collect a list of plugins from a RHDH or backstage-showcase folder

SOURCEDIR=""

usage() {
  cat <<EOF
Build a list of plugins in a given backstage or RHDH source tree

Requires:
* jq 1.6+, podman 4+, glibc 2.28+

Usage: $0 -s /path/to/sources [OPTIONS]

Options:
  -h, --help                 : Show this help

Examples:
  $0 -s /path/to/backstage-showcase 
  $0 -s /path/to/rhdh-hub

EOF
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-s') SOURCEDIR="$2"; shift 1;;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ ! -d "$SOURCEDIR" ]]; then usage; exit; fi

pushd "$SOURCEDIR" >/dev/null || exit 1
    rm -f /tmp/pluginList.txt
    for d in $(find . -name package.json | grep -E -v "dist-dynamic/|node_modules/"); do 
        echo "Process $d ..."
        dd=${d#./}; echo "${dd/\/package.json}:$(jq -r .version "$d")" >> /tmp/pluginList.txt
    done
    for d in $(find . -name package.json | grep -E -v "node_modules/|dist-dynamic/"); do 
      if grep -q "peerDependencies" "$d"; then
        echo "Collect peerDependencies from $d ..."
        jq -r '.peerDependencies' "$d" | grep -v -E "{|}" | tr -d "@\" ," >> /tmp/pluginList.txt
      fi
    done
    for d in ./packages/app/package.json ./packages/backend/package.json; do
        echo "Collect dependencies from $d ..."
        jq -r '.dependencies' "$d" | grep -v -E "{|}" | tr -d "@\" ," >> /tmp/pluginList.txt
    done
    sort -uV /tmp/pluginList.txt | sed -r -e "s/npm://" | tr ":" "\t" > /tmp/pluginListSorted_paths.txt; rm -f /tmp/pluginList.txt /tmp/pluginListSorted_paths.txt_
    # shellcheck disable=SC2129
    grep -E "backstage/|wrappers/backstage"             /tmp/pluginListSorted_paths.txt >> /tmp/pluginListSorted_paths.txt_
        echo >> /tmp/pluginListSorted_paths.txt_
    grep -E "immobiliarelabs/|wrappers/immobiliarelabs" /tmp/pluginListSorted_paths.txt >> /tmp/pluginListSorted_paths.txt_
        echo >> /tmp/pluginListSorted_paths.txt_
    grep -E "janus-idp/|wrappers/janus-idp"             /tmp/pluginListSorted_paths.txt >> /tmp/pluginListSorted_paths.txt_
        echo >> /tmp/pluginListSorted_paths.txt_
    grep -E "roadiehq/|wrappers/roadiehq"               /tmp/pluginListSorted_paths.txt >> /tmp/pluginListSorted_paths.txt_
        echo >> /tmp/pluginListSorted_paths.txt_
    # filter out things we ignore
    grep -E -v "/alpha|backstage/|wrappers/backstage|immobiliarelabs/|wrappers/immobiliarelabs|janus-idp/|wrappers/janus-idp|roadiehq/|wrappers/roadiehq" \
        /tmp/pluginListSorted_paths.txt >> /tmp/pluginListSorted_paths.txt_
    mv /tmp/pluginListSorted_paths.txt_ /tmp/pluginListSorted_paths.txt
    echo "List of plugins with paths written to: /tmp/pluginListSorted_paths.txt"

    # now create a simpler list without dynamic-plugins/wrappers/, dynamic-plugins/dist/ or dynamic-plugins-root prefix folders
    sed -r -e "s#dynamic-plugins/wrappers/|dynamic-plugins/dist/|dynamic-plugins-root/##g" /tmp/pluginListSorted_paths.txt | sort -u > /tmp/pluginListSorted_nopaths.txt
    echo "List of plugins without paths written to: /tmp/pluginListSorted_nopaths.txt"
popd >/dev/null || exit 1

