#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Utility script to compare a list of plugins' version across branches and report which ones need incrementing

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
DO_PUSH=0
FORCE=""

SOURCEDIR=""

usage() {
  cat <<EOF
Compare two branches of a source tree to determine which plugins need to have their versions' y-digit bumped
If problems found, generate a pull request against the source tree's main branch

Requires:
* jq 1.6+

Usage:

$0 -s /path/to/sources -b 1.1.x

Options:
  -h, --help                 : Show this help

Examples:
  $0 -s /path/to/backstage-plugins -b 1.1.x

EOF
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-b') BRANCH="$2"; shift 1;;
    '-s') SOURCEDIR="$2"; shift 1;;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ ! $BRANCH ]] || [[ ! $SOURCEDIR ]]; then usage; exit 1; fi

createPr() {
  headBranch=$1
  baseBranch=$2
  git pull origin "${baseBranch}"
  git branch "${headBranch}" || true
  git checkout "${headBranch}"
  git merge "${baseBranch}"
  git push origin "${headBranch}" ${FORCE}
  # TODO replace with gitlab equivalent, maybe using API?
  if [[ $(/usr/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
    gh pr create -f -B "${baseBranch}" -H "${headBranch}" -w || true

  else
    echo "[WARN] gh cli is required to generate pull requests. See https://github.com/cli/cli?tab=readme-ov-file#installation to install it."
    echo -n "# To manually create a pull request, go here: "
    git config --get remote.origin.url | sed -r -e "s#:#/#" -e "s#git@#https://#" -e "s#\.git#/tree/${headBranch}/#"
  fi
}

verlte() {
    printf '%s\n' "$1" "$2" | sort -C -V
}

verlt() {
    ! verlte "$2" "$1"
}

declare -A plugins
export HUSKY=0

cd "$SOURCEDIR" || { echo "[ERROR] $SOURCEDIR does not exist - must exit!"; exit 1; }

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

HUSKY=0 git checkout "$BRANCH" || true
for d in plugins/* packages/* ./; do if [[ -f "$d/package.json" ]]; then 
    ver=$(jq -r '.version' "$d/package.json"); ver=${ver%.*} # only want the x.y version here 
    plugins["$d"]="$ver"
    # echo "$d ${plugins["$d"]}"
fi; done

HUSKY=0 git checkout "main" || true
for d in plugins/* packages/* ./; do if [[ -f "$d/package.json" ]]; then 
    ver=$(jq -r '.version' "$d/package.json"); 
    if [[ ! "${plugins["$d"]}" ]]; then
        echo -e "[INFO] ${blue}$d is new in main branch; nothing to do.${norm}"
    elif [[ $ver == "0.0.0" ]]; then
        echo -e "[INFO] ${blue}$d is unversioned at 0.0.0; nothing to do.${norm}"
    else
      ver=${ver%.*} # only want the x.y version here 
      if verlte "$ver" "${plugins["$d"]}"; then 
        # need to bump version
        echo -en "[INFO] ${red}$d $ver needs to be incremented to greater than ${plugins["$d"]}${norm} (in main) ... "
        newver="$ver"
        if [[ $ver =~ ^([0-9]+)\.([0-9]+) ]]; then # increase the y digit
            XX=${BASH_REMATCH[1]}
            YY=${BASH_REMATCH[2]}
            (( YY=YY+1 ))
            newver="$XX.$YY.0"
        fi
        jq '.version|="'"$newver"'"' "$d/package.json" > "$d/package.json1"
        mv -f "$d/package.json1" "$d/package.json"
        echo -e "${green}$newver${norm}"
      else
          echo -e "[INFO] ${green}$d $ver ${norm}(main) > ${green}${plugins["$d"]}${norm} (in $BRANCH)"
      fi
    fi
fi; done

# git diff plugins/

if [[ ${DO_PUSH} -eq 1 ]]; then
  BRANCHUSED="main"
  PR_BRANCH="pr-update-sync-rhdh-hub-$(date +%s)"

  git pull origin "${BRANCHUSED}"
  set -x
  # shellcheck disable=SC2086
  PUSH_TRY="$(git push origin "${BRANCHUSED}" ${FORCE} 2>&1 || true)"
  # shellcheck disable=SC2181
  if [[ $? -gt 0 ]] || [[ $PUSH_TRY == *"protected branch hook declined"* ]]; then
    # create pull request if target branch is restricted access
    createPr "${PR_BRANCH}" "${BRANCHUSED}"
  fi
  set +x
fi ## if DO_PUSH

