#!/usr/bin/env bash
#
# Copyright (c) 2023-2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Utility script to collect a list of plugins from a RHDH folder

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

SOURCEDIR=""

usage() {
  cat <<EOF
Build a list of plugins in a given backstage or RHDH source tree or container image

Requires:
* jq 1.6+, podman 4+, glibc 2.28+

Usage:

For existing sources: 

$0 -s /path/to/sources 

For a container:

$0 -c registry.io/org/repo:tag-or-sha

Options:
  -h, --help                 : Show this help

Examples:
  $0 -c quay.io/rhdh/rhdh-hub-rhel9:1.0-200
  $0 -c quay.io/rhdh/rhdh-hub-rhel9:1.1-87
  $0 -s /path/to/rhdh-hub
  $0 -s /path/to/redhat-developer/rhdh

EOF
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-c') CONTAINER="$2"; shift 1;;
    '-s') SOURCEDIR="$2"; shift 1;;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ ! -d "$SOURCEDIR" ]] && [[ ! $CONTAINER ]]; then usage; exit; fi

filename_suffix=".txt"
containerExtract=""
if [[ $CONTAINER ]]; then 
  containerExtract="containerExtract.sh"
  if [[ ! -x $SCRIPT_DIR/${containerExtract} ]] && [[ ! -x /tmp/${containerExtract} ]]; then
    MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
    if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi
    containerExtract="containerExtract.sh"
    pushd /tmp >/dev/null || exit
      curl -sSLO "https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/${MIDSTM_BRANCH}/build/scripts/${containerExtract}" && \
      chmod +x "${containerExtract}"
    popd >/dev/null || exit
  elif [[ -x $SCRIPT_DIR/${containerExtract} ]]; then
    containerExtract="$SCRIPT_DIR/${containerExtract}"
  fi
  if [[ -x /tmp/${containerExtract} ]]; then
    containerExtract="/tmp/${containerExtract}"
  fi
  sudo rm -fr "/tmp/$(echo "$CONTAINER" | tr "/:" "--")"-*/
  $containerExtract "$CONTAINER"
  SOURCEDIR="$(cd "/tmp/$(echo "$CONTAINER" | tr "/:" "--")"-*/ || exit;pwd)"
  filename_suffix="_$(echo "$CONTAINER" | tr "/:" "--").txt"
fi

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
    # shellcheck disable=SC2044,SC2046
    for d in $(find $(find . -maxdepth 4 -name packages -type d) -maxdepth 2 -name package.json); do
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
    grep -E -v "/alpha|backstage/|wrappers/backstage|immobiliarelabs/|wrappers/immobiliarelabs|janus-idp/|wrappers/janus-idp|roadiehq/|wrappers/roadiehq|e2e-tests" \
        /tmp/pluginListSorted_paths.txt >> /tmp/pluginListSorted_paths.txt_
    mv /tmp/pluginListSorted_paths.txt_ /tmp/pluginListSorted_paths"${filename_suffix}"
    echo "List of plugins with paths written to: /tmp/pluginListSorted_paths${filename_suffix}"

    # now create a simpler list without dynamic-plugins/wrappers/, dynamic-plugins/dist/ or dynamic-plugins-root prefix folders
    sed -r -e "s#dynamic-plugins/wrappers/|dynamic-plugins/dist/|dynamic-plugins-root/##g" \
      -e "s#opt/app-root/src/dynamic-plugins-root/|opt/app-root/src/dynamic-plugins/dist/##g" \
      -e "s#opt/app-root/src/##g" \
      -e "/null/d" \
      /tmp/pluginListSorted_paths"${filename_suffix}" | sort -u > /tmp/pluginListSorted_nopaths"${filename_suffix}"
    echo "List of plugins without paths written to: /tmp/pluginListSorted_nopaths${filename_suffix}"

    # now create a simpler list without dynamic-plugins/wrappers/, dynamic-plugins/dist/ or dynamic-plugins-root prefix folders
    grep -E "opt/app-root/src/" /tmp/pluginListSorted_paths"${filename_suffix}" | \
    sed -r \
      -e "s#opt/app-root/src/dynamic-plugins-root/|opt/app-root/src/dynamic-plugins/dist/##g" \
      -e "s#opt/app-root/src/##g" \
      -e "s#^packages/.+##" -e "/^dynamic-plugins-imports-peer-dependencies.+/d" \
      -e "s#plugins/##" \
      | sort -u > /tmp/pluginListSorted_dynamic"${filename_suffix}"
    echo "List of dynamic plugins written to: /tmp/pluginListSorted_dynamic${filename_suffix}"
popd >/dev/null || exit 1

# cleanup temp files
if [[ $filename_suffix != ".txt" ]]; then
  rm -f /tmp/pluginListSorted_paths.txt /tmp/pluginListSorted_nopaths.txt /tmp/pluginListSorted_dynamic.txt
fi