#!/usr/bin/env bash
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

# NOTE: Private plugins will not be incremented.

# SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
# FORCE=""
DO_BUILD=1
DO_PUSH=0
DRYRUN=""
GITLAB_PIPELINE="" # set "true" when running inside a gitlab pipeline to override default git push settings
BRANCHUSED="main"
PR_BRANCH="pr-update-sync-rhdh-hub-$(date +%s)"
CHECK_NPM=0

SOURCEDIR=""

usage() {
  cat <<EOF
Compare two branches of a source tree to determine which plugins need to have their versions' y-digit bumped
If problems found, generate a pull request against the source tree's $BRANCHUSED branch

Requires:
* jq 1.6+

Usage:

$0 -s /path/to/sources -b stable-ref-branch [--push]

Options:
  -b, --ref-branch           : Reference branch against which plugin versions should be incremented, like release-1.3
  -t, --target-branch        : Destination branch where changes will be merged; default: $BRANCHUSED
  --pr-branch                : Use a specific pull request topic branch instead of generated one like $PR_BRANCH
  --push                     : In addition to reporting problems, generate a PR to push a fix
  --nobuild                  : Skip 'yarn install' steps; no PR will be generated
  --gitlab-pipeline-push     : Use this flag to push changes when running inside a gitlab pipeline
  --dry-run                  : Do everything but create the PR; instead just display the PR contents
  --check-npm                : Optional: report if the plugin versions in the ref-branch exist at npmjs.com
  -h, --help                 : Show this help

Examples:
  $0 -s /path/to/backstage-plugins -b release-1.3 --push

EOF
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-b'|'--ref-branch') BRANCH="$2"; shift 1;;        # reference branch, eg., release-1.3 
    '-t'|'--target-branch') BRANCHUSED="$2"; shift 1;; # base branch to update, eg., main
    '--pr-branch') PR_BRANCH="$2"; shift 1;;
    '-s') SOURCEDIR="$2"; shift 1;;
    '--nobuild') DO_BUILD=0; DO_PUSH=0;;
    '--push') DO_PUSH=1; DO_BUILD=1;;
    '--gitlab-pipeline-push') DO_PUSH=1; DO_BUILD=1; GITLAB_PIPELINE="true";;
    '--dry-run') DRYRUN="$1";;
    '--check-npm') CHECK_NPM=1;;
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

# method to check if a given plugin and version exists already in the wild, or needs to be manually released to the stated version
checkIfPluginExists() {
  pluginPath="$1"
  pluginVersionXYZ="$2"
  pluginName=$(yq -r '.name' "$pluginPath/package.json"  2>/dev/null)
  # echo "   [DEBUG] Checking for existence of $pluginName @ $pluginVersionXYZ ... "
  if [[ $(curl -sSLko- "https://www.npmjs.com/package/$pluginName/v/$pluginVersionXYZ" -I | grep HTTP/2) == *"404"* ]]; then
    echo -e "       [$c/$num_plugins] ${red}NOT FOUND${norm}: https://www.npmjs.com/package/$pluginName/v/$pluginVersionXYZ"
  else
    echo -e "       [$c/$num_plugins] ${blue}EXISTS${norm}: https://www.npmjs.com/package/$pluginName/v/$pluginVersionXYZ"
  fi
}

declare -A plugins
declare -A pluginsXYZ

cd "$SOURCEDIR" || { echo "[ERROR] $SOURCEDIR does not exist - must exit!"; exit 1; }

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

HUSKY=0 git checkout "$BRANCH" 2>/dev/null || true
for d in plugins/* packages/* ./; do if [[ -f "$d/package.json" ]]; then 
    ver=$(jq -r '.version' "$d/package.json")
    pluginsXYZ["$d"]="$ver"

    ver=${ver%.*} # only want the x.y version here 
    plugins["$d"]="$ver"
    # echo "$d ${plugins["$d"]}"
fi; done

HUSKY=0 git checkout "$BRANCHUSED" 2>/dev/null || true

# make changes in a PR topic branch
git branch "$PR_BRANCH" >/dev/null 2>&1 || true
git checkout "$PR_BRANCH" 2>/dev/null || true

if [[ $DO_BUILD -eq 1 ]]; then
  # quietly install any updates to yarn.lock so PR will pass sniff test
  yarn install 2> >(grep -v warning 1>&2) 
fi

rootVer=""
for d in ./ packages/* plugins/*; do if [[ -f "$d/package.json" ]]; then 
    (( num_plugins=num_plugins+1 ))
fi; done
rootDir=$(pwd)
for d in ./ packages/* plugins/*; do if [[ -f "$d/package.json" ]]; then 
    (( c=c+1 ))
    ver=$(jq -r '.version' "$d/package.json"); 
    isPrivate=$(jq -r '.private' "$d/package.json"); 
    if [[ "$d" == "./" ]] && [[ $ver =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then 
      XX=${BASH_REMATCH[1]}
      YY=${BASH_REMATCH[2]}
      ZZ=${BASH_REMATCH[3]}
      # plugins repo version is 2 majors larger than showcase/RHDH version (3.2.0 ~ 1.2.0)
      (( XX=XX-2 ))
      rootVer="$XX.$YY.$ZZ"
    fi

    # do not bump private packages, new packages, and anything with version 0.0.0
    if [[ "$d" != "./" ]] && [[ $isPrivate == "true" ]]; then
        echo -e "[INFO] [$c/$num_plugins] ${blue}$d is marked private; nothing to do.${norm}"; echo
    elif [[ ! "${plugins["$d"]}" ]]; then
        echo -e "[INFO] [$c/$num_plugins] ${blue}$d is new in $BRANCHUSED branch; nothing to do.${norm}"; echo
    elif [[ $ver == "0.0.0" ]]; then
        echo -e "[INFO] [$c/$num_plugins] ${blue}$d is unversioned at 0.0.0; nothing to do.${norm}"; echo
    else
      ver=${ver%.*} # only want the x.y version here 
      if verlte "$ver" "${plugins["$d"]}"; then 
        # need to bump version
        echo -en "[INFO] [$c/$num_plugins] ${red}$d $ver needs to be incremented to greater than ${plugins["$d"]}${norm} (in $BRANCHUSED) ... "
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
          git add "$d/" >/dev/null 2>&1 || exit 2
          git commit -s -m "feat: checkPluginVersion.sh bump $d to $newver in $BRANCHUSED" "$d/" >/dev/null 2>&1 || exit 3
        else 
          echo -e "${green}$newver${norm}"
          pluginName=$(yq -r ".name" "$d/package.json")
          echo "- Bumped to $newver in $BRANCHUSED branch, in prep for release of $rootVer" >> "$d/.versionhistory.md"
          echo "---
\"$pluginName\": minor
---

Bump $d to $newver in $BRANCHUSED branch, in prep for release of $rootVer
" > "$rootDir/.changeset/${d/\//-}.md"

          git add "$d/" "$rootDir/.changeset/${d/\//-}.md" >/dev/null 2>&1 || exit 2
          git commit -s -m "feat: checkPluginVersion.sh bump $d to $newver in $BRANCHUSED" "$d/" "$rootDir/.changeset/" >/dev/null 2>&1 || exit 3
          echo
        fi
      else
          echo -e "[INFO] [$c/$num_plugins] ${green}$d $ver ${norm}($BRANCHUSED) > ${green}${pluginsXYZ["$d"]}${norm} (in $BRANCH)"
          if [[ $CHECK_NPM -eq 1 ]]; then checkIfPluginExists "$d" "${pluginsXYZ["$d"]}"; fi
          echo
      fi
    fi
fi; done

# git diff plugins/

createPr() {
  headBranch=$1
  baseBranch=$2
  # in case we checked out from release-1.4 but need to base a PR against main
  git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'; git fetch --depth=10
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
    # echo "### cPV.sh CREATING PR for baseBranch=$baseBranch .. headBranch=$headBranch ..."
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
  if [[ $DO_BUILD -eq 1 ]]; then
    # quietly install any updates to yarn.lock so PR will pass sniff test
    yarn install 2> >(grep -v warning 1>&2) 
  fi
  git commit -s -m "chore: checkPluginVersion.sh regen yarn.lock in $BRANCHUSED branch" 2>/dev/null
  git pull origin "${BRANCHUSED}" || true
  # create pull request if target branch is restricted access
  createPr "${PR_BRANCH}" "${BRANCHUSED}"
fi ## if DO_PUSH
