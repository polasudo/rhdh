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
# Run locally, use --push flag to generate a PR
# Run in a headless pipeline, use --gitlab-pipeline-push to generate a PR

# SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
# FORCE=""
DO_PUSH=0
DRYRUN=""
GITLAB_PIPELINE="" # set "true" when running inside a gitlab pipeline to override default git push settings
BRANCHUSED="main"
PR_BRANCH="pr-update-sync-rhdh-hub-$(date +%s)"

SOURCEDIR=""

usage() {
  cat <<EOF
Compare two branches of a source tree to determine which plugins need to have their versions' y-digit bumped
If problems found, generate a pull request against the source tree's $BRANCHUSED branch

Requires:
* jq 1.6+

Usage:

$0 -s /path/to/sources -b 1.1.x [--push]

Options:
  -b, --ref-branch           : Reference branch against which plugin versions should be incremented, like 1.1.x
  -t, --target-branch        : Destination branch where changes will be merged; default: $BRANCHUSED
  --pr-branch                : Use a specific pull request topic branch instead of generated one like $PR_BRANCH
  --push                     : In addition to reporting problems, generate a PR to push a fix
  --gitlab-pipeline-push     : Use this flag to push changes when running inside a gitlab pipeline
  --dry-run                  : Do everything but create the PR; instead just display the PR contents
  -h, --help                 : Show this help

Examples:
  $0 -s /path/to/backstage-plugins -b 1.1.x

EOF
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-b'|'--ref-branch') BRANCH="$2"; shift 1;;        # reference branch, eg., 1.1.x 
    '-t'|'--target-branch') BRANCHUSED="$2"; shift 1;; # base branch to update, eg., main
    '--pr-branch') PR_BRANCH="$2"; shift 1;;
    '-s') SOURCEDIR="$2"; shift 1;;
    '--push') DO_PUSH=1;;
    '--gitlab-pipeline-push') DO_PUSH=1; GITLAB_PIPELINE="true";;
    '--dry-run') DRYRUN="$1";;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ ! $BRANCH ]] || [[ ! $SOURCEDIR ]]; then usage; exit 1; fi

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

HUSKY=0 git checkout "$BRANCHUSED" || true

# make changes in a PR topic branch
git branch "$PR_BRANCH" >/dev/null 2>&1 || true
git checkout "$PR_BRANCH" || true

# quietly install any updates to yarn.lock so PR will pass sniff test
yarn install 2> >(grep -v warning 1>&2) 

rootVer=""
for d in ./ packages/* plugins/*; do if [[ -f "$d/package.json" ]]; then 
    ver=$(jq -r '.version' "$d/package.json"); 
    if [[ "$d" == "./" ]] && [[ $ver =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then 
      XX=${BASH_REMATCH[1]}
      YY=${BASH_REMATCH[2]}
      ZZ=${BASH_REMATCH[3]}
      # plugins repo version is 2 majors larger than showcase/RHDH version (3.2.0 ~ 1.2.0)
      (( XX=XX-2 ))
      rootVer="$XX.$YY.$ZZ"
    fi
    if [[ ! "${plugins["$d"]}" ]]; then
        echo -e "[INFO] ${blue}$d is new in $BRANCHUSED branch; nothing to do.${norm}"; echo
    elif [[ $ver == "0.0.0" ]]; then
        echo -e "[INFO] ${blue}$d is unversioned at 0.0.0; nothing to do.${norm}"; echo
    else
      ver=${ver%.*} # only want the x.y version here 
      if verlte "$ver" "${plugins["$d"]}"; then 
        # need to bump version
        echo -en "[INFO] ${red}$d $ver needs to be incremented to greater than ${plugins["$d"]}${norm} (in $BRANCHUSED) ... "
        newver="$ver"
        if [[ $ver =~ ^([0-9]+)\.([0-9]+) ]]; then # increase the y digit
            XX=${BASH_REMATCH[1]}
            YY=${BASH_REMATCH[2]}
            (( YY=YY+1 ))
            newver="$XX.$YY.0"
        fi

        if [[ "$d" == "./" ]]; then # for root package.json, just bump the version as we don't release it semantically
          jq '.version|="'"$newver"'"' "$d/package.json" > "$d/package.json1"
          mv -f "$d/package.json1" "$d/package.json"
          echo -e "${green}$newver${norm}"; echo
        else 
          # comment in a md file to force a semantic release
          echo -e "${green}$newver${norm}"
          echo "- Bumped to $newver in $BRANCHUSED branch for next release $rootVer" >> "$d/.versionhistory.md"
          git add "$d/.versionhistory.md" >/dev/null 2>&1 || exit 2
          git commit -s -m "feat: checkPluginVersion.sh bump $d to $newver in $BRANCHUSED" "$d/.versionhistory.md" # >/dev/null 2>&1 || exit 3
          echo
        fi
      else
          echo -e "[INFO] ${green}$d $ver ${norm}($BRANCHUSED) > ${green}${plugins["$d"]}${norm} (in $BRANCH)"; echo
      fi
    fi
fi; done

# git diff plugins/

createPr() {
  headBranch=$1
  baseBranch=$2
  git pull origin "${baseBranch}"
  git branch "${headBranch}" || true
  git checkout "${headBranch}"
  git merge "${baseBranch}"
  # shellcheck disable=SC2086
  git push origin "${headBranch}" # ${FORCE}
  # TODO replace with gitlab equivalent, maybe using API?
  if [[ $(/usr/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
    gh repo set-default "$(git remote get-url origin)"
    # shellcheck disable=SC2086
    gh pr create --fill-verbose -t "feat: checkPluginVersion.sh bump plugins for $rootVer release" -B "${baseBranch}" -H "${headBranch}" ${DRYRUN} || true
    # if not running in a gitlab pipeline, open the PR in a browser 
    if [[ $GITLAB_PIPELINE != "true" ]]; then
      gh pr view --web || true
    fi
  else
    echo "[WARN] gh cli is required to generate pull requests. See https://github.com/cli/cli?tab=readme-ov-file#installation to install it."
    echo -n "# To manually create a pull request, go here: "
    git config --get remote.origin.url | sed -r -e "s#:#/#" -e "s#git@#https://#" -e "s#\.git#/tree/${headBranch}/#"
  fi
}

if [[ ${DO_PUSH} -eq 1 ]]; then
  # quietly install any updates to yarn.lock so PR will pass sniff test
  yarn install 2> >(grep -v warning 1>&2) 
  git commit -s -m "chore: checkPluginVersion.sh regen yarn.lock in $BRANCHUSED branch" .
  git pull origin "${BRANCHUSED}" || true
  set -x
  # create pull request if target branch is restricted access
  createPr "${PR_BRANCH}" "${BRANCHUSED}"
  set +x
fi ## if DO_PUSH

