#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
#
# update pipelines to latest digests
#
# requires skopeo, yq (python wrapper for jq), gh cli

# set -x
set -e

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT")
PR_BRANCH="pr-update-tekton-tasks-$(date +%s)"
DO_MINOR="false"
REGEX="*yaml"
TRIGGER="false"
QUIET=1
docommit=1 # by default DO commit the change
dopush=1 # by default DO push the change

MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")

usage () {
    echo "\
Utility script to update digests and tags in the .tekton/ folder's pipelines to pull in newer task containers

Requires: skopeo, jq >= 1.7, yq, gh (Github cli)

Options:
  --digest-only     update to latest digest only - do not increment tags (default behaviour)
  --minor           update to latest minor tag, not just newest digest for the current tag
                    NOTE: this may cause migration issues! Mintmaker might be better for handling this
                          as it will provide migration instructions
                    Implies --no-push
  --regex           file pattern to search for; default: '$REGEX'
  --trigger         trigger konflux builds for this update: default: false
  --no-commit, -n   do not commit changes
  --no-push, -p     do not push changes
  --debug           show debug steps
  --quiet, -q       quieter console
  --help, -h        help

Examples:
  $0 -q                          # update digests only and push changes
  $0 --minor --debug             # update tags and digests, then commit, but do not push
"
}

if [[ $# -lt 1 ]]; then usage; exit; fi

while [[ "$#" -gt 0 ]]; do
	case $1 in
		'--regex') REGEX="$2"; shift 1;;
		'--trigger') TRIGGER="true"; shift 0;;
		'--digest-only') DO_MINOR="false"; shift 0;;
		'--minor') DO_MINOR="true"; dopush=0; shift 0;;
		'-n'|'--nocommit'|'--no-commit') docommit=0; dopush=0; shift 0;;
		'-p'|'--nopush'|'--no-push') dopush=0; shift 0;;
		'--debug') QUIET=0; shift 0;;
		'-q'|'--quiet') QUIET=1; shift 0;;
		'--help'|'-h') usage; exit;;
		*) echo "Invalid commandline argument: $1"; exit;; 
	esac
	shift 1
done

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

# mappings of base:oldTag = newTag and base:newTag = newSHA to avoid doing a lot of skopeo inspects
declare -A digests

# list of migrations due to minor updates
declare -A MIGRATIONS

# file counters: tf, cf
tf=0; cf=0

# shellcheck disable=SC2044
echo "Searching for $REGEX ..."
for file in $(find "$ROOTPATH" -name "${REGEX}"); do 
    (( tf = tf + 1 ))
done

mkfifo mypipe 2>/dev/null || true
for file in $(find "$ROOTPATH" -name "${REGEX}" | sort -V); do 
    (( cf = cf + 1 ))
    # line counters: tl, cl
    tl=0; cl=0

    echo -e "[$cf/$tf] ${blue}>>${norm} $file"
    grep -E "@sha256|value: .+(task|tekton|konflux)-.+:[0-9.]+" < "$file" | sort -uV > mypipe &
    while IFS= read -r line; do
        if [[ $line != "value:" ]]; then
            (( tl = tl + 1 ))
        fi
    done < mypipe
    grep -E "@sha256|value: .+(task|tekton|konflux)-.+:[0-9.]+" < "$file" | sort -urV > mypipe &
    while IFS= read -r line; do
        line="${line##*value: }"
        (( cl = cl + 1 ))
        # if [[ $QUIET -eq 0 ]]; then echo "[DEBUG] [$cf/$tf] [$cl/$tl] $line"; fi
        base=${line%%@sha256:*}
        oldTag=${base#*:}
        if [[ $QUIET -eq 0 ]]; then echo "[DEBUG]     OLD tag: $oldTag"; fi
        base=${base%:*}
        if [[ $QUIET -eq 0 ]]; then echo "[DEBUG]     base: $base"; fi
        if [[ $DO_MINOR == "true" ]]; then
            if [[ ! "${digests["${base}:${oldTag}_tag"]}" ]]; then 
                newTag=$(skopeo inspect "docker://${base}:${oldTag}" | jq -r '.RepoTags' | yq -r '.[]' | grep -v -- "-" | sort -uV | tail -1)
                digests["${base}:${oldTag}_tag"]="$newTag"
                if [[ $QUIET -eq 0 ]]; then echo "[DEBUG]     NEW tag: ${newTag}"; fi
            else
                newTag="${digests["${base}:${oldTag}_tag"]}"
            fi
        else
            # keep the old tag unless we're doing minor updates
            newTag="${oldTag}"
        fi
        if [[ $line == *"@"* ]]; then 
            oldSHA="${line##*@}"
        else
            oldSHA="NONE"
        fi
        
        if [[ $QUIET -eq 0 ]]; then echo "[DEBUG]     OLD SHA: $oldSHA"; fi
        if [[ ! "${digests["${base}:${newTag}_sha"]}" ]]; then 
            newSHA=$(skopeo inspect "docker://${base}:${newTag}" | jq -r '.Digest');
            digests["${base}:${newTag}_sha"]="$newSHA"
            if [[ $QUIET -eq 0 ]]; then echo "[DEBUG]     NEW SHA: $newSHA"; fi
        else
            newSHA="${digests["${base}:${newTag}_sha"]}"
        fi
        if [[ "$newSHA" ]] && [[ "$oldSHA" != "$newSHA" ]]; then
            if [[ $oldSHA == "NONE" ]]; then
                sed -i "$file" -r -e "s|${oldTag}$|${newTag}@${newSHA}|g"
            else
                sed -i "$file" -r -e "s|${oldTag}@${oldSHA}$|${newTag}@${newSHA}|g"
            fi
            if [[ "$newTag" == "$oldTag" ]]; then 
                echo -e "[$cf/$tf] [$cl/$tl] ${green}==>${norm} $base:${newTag}@${newSHA}"
            else
                url_frag="${base#*/task-}/${newTag}"
                echo -e "[$cf/$tf] [$cl/$tl] ${red}[!]${norm} $base:${newTag}@${newSHA}"
                echo -e "[$cf/$tf] [$cl/$tl] ${red}[!]${norm} migration required for ${base#*/task-} ${blue}$oldTag${norm} to ${red}$newTag${norm}!\n"
                MIGRATIONS["$url_frag"]="https://github.com/konflux-ci/build-definitions/blob/main/task/${url_frag}/MIGRATION.md"
            fi
        elif [[ ! "$newSHA" ]]; then
            echo -e "[$cf/$tf] [$cl/$tl] could not compute new SHA, skip!${norm} $line"
        else
            echo -e "[$cf/$tf] [$cl/$tl] ${blue}===${norm} $line"
        fi
    done < mypipe
done
rm -f mypipe
echo; echo "Changes:"
git diff "$ROOTPATH/*.yaml" | grep value: | sort -uV | grep +
echo; echo "Changed files:"
git diff  --name-only "$ROOTPATH/*.yaml"

createPr() {
	headBranch=$1
	baseBranch=$2
	git branch "${headBranch}" || true
	git checkout "${headBranch}"
	git merge "${baseBranch}"
	git push origin "${headBranch}"
	if [[ $(/usr/local/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
		gh pr create -f -B "${baseBranch}" -H "${headBranch}" || true 
	else
		echo "# Warning: gh is required to generate pull requests. See https://cli.github.com/ to install it."
		echo -n "# To manually create a pull request, go here: "
		git config --get remote.origin.url | sed -r -e "s#:#/#" -e "s#git@#https://#" -e "s#\.git#/tree/${headBranch}/#"
	fi
}

function openURL {
    if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome 2>&1) != *"which: no google-chrome"* ]]; then 
        google-chrome "$1" "$2" >/dev/null 2>&1
    else 
        echo " >> $1"
    fi
}

if [[ ${#MIGRATIONS[@]} -gt 0 ]]; then
    dopush=0
    target="--new-window"
    echo -e "\nThe following ${#MIGRATIONS[@]} migrations must occur to ensure continued working tasks:\n"
    mapfile -t sorted_keys < <(for key in "${!MIGRATIONS[@]}"; do echo "$key"; done | sort)
    for key in "${sorted_keys[@]}"; do
        echo -e " ${red}[!]${norm} ${MIGRATIONS[$key]}"
        openURL "${MIGRATIONS[$key]}" $target
        target=""
    done
fi

if [[ ${docommit} -eq 1 ]]; then 
    git add "$ROOTPATH/*.yaml" "$ROOTPATH/*.sh" || true
    if [[ $TRIGGER == "true" ]]; then
        # konflux trigger, skips gitlab
        git commit -s -m "chore: Update .tekton folder to latest task versions [ci skip]" "$ROOTPATH/" 
    else
        # no konflux or gitlab trigger
        git commit -s -m "[ci skip] chore: Update .tekton folder to latest task versions [ci skip]" "$ROOTPATH/" 
    fi
    if [[ ${dopush} -eq 1 ]]; then
        git pull origin "${MIDSTM_BRANCH}"
        PUSH_TRY="$(git push origin "${MIDSTM_BRANCH}" 2>&1 || true)"
        # shellcheck disable=SC2181
        if [[ $? -gt 0 ]] || [[ $PUSH_TRY == *"protected branch hook declined"* ]]; then
            # create pull request if target branch is restricted access
            createPr "${PR_BRANCH}" "${MIDSTM_BRANCH}"
        fi
    fi
fi
