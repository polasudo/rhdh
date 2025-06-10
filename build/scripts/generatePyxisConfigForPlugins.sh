#!/bin/bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# for a list of plugins, generate the yaml to update https://gitlab.cee.redhat.com/releng/pyxis-repo-configs/-/blob/main/products/developer-hub/developer-hub.yaml

pluginsFile=""
CLEAN=0

RELEASE_CATEGORY="Tech Preview" # TODO: switch to "Generally Available" when we're happy with this approach

usage () {
	echo "Usage:
    
  $0 /path/to/plugin_builds.json

Options:
  --clean          delete existing git checkout folder before running script
  -h, --help       this help
"
}

if [[ $# -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
    case $1 in
        '--clean') CLEAN=1;;
        '-h'|'--help')       usage; exit 0;;
        *)         pluginsFile="$1";;
    esac
    shift 1
done

if [[ ! $pluginsFile ]]; then usage; exit 1; fi

set -e

git config --global push.default matching
git config --global merge.ff true
git config --global pull.ff-only true
git config --global pull.rebase true
git config --global branch.autosetupmerge true
git config --global branch.autosetuprebase always
git config --global advice.skippedCherryPicks false
git config --global advice.detachedHead false

createPr() {
  headBranch=$1
  baseBranch=$2

  # git rev-parse --symbolic-full-name HEAD
    
  # if working in an existing PR
  if [[ $(git rev-parse --symbolic-full-name HEAD) != "refs/heads/main" ]]; then
    headBranch=$(git rev-parse --symbolic-full-name HEAD)
    headBranch=${headBranch##*/}
  fi
  if [[ $(git diff --name-only HEAD~1 2>/dev/null || true) ]]; then # only if we have changes
	# in case we checked out from release-1.4 but need to base a PR against main
	git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'; git fetch --depth=10 >/dev/null 2>&1 || true
	git pull origin "${baseBranch}" 1>/dev/null 2>&1 || true
	git branch "${headBranch}" || true
	git checkout "${headBranch}" 1>/dev/null 2>&1
	git merge "${baseBranch}" 1>/dev/null 2>&1 || true
	# shellcheck disable=SC2086
    echo -e "\n > git push -f $(whoami) ${headBranch}\n"
	if [[ $(/usr/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
		if [[ $(git diff --name-only HEAD~1 2>/dev/null || true) ]]; then
            # try using the current user's fork
            git remote add "$(whoami)" "git@gitlab.cee.redhat.com:$(whoami)/releng-pyxis-repo-configs.git" 2>/dev/null || true
            PR_URL=$(git push -f "$(whoami)" "${headBranch}" 2>&1 | grep "${headBranch}" | grep "https://" | sed -r -e "s/remote:   //" | tr -d " ")
            if [[ ! $PR_URL ]]; then 
                echo "[ERROR] Cannot create a PR for your changes. Please create a PR manually from sources in $(pwd) !"
                echo "[ERROR] Check for existing PR at https://gitlab.cee.redhat.com/nboldt/releng-pyxis-repo-configs/-/merge_requests ?"
                exit 1
            else 
                PR_URL="${PR_URL}&merge_request%5Btarget_branch%5D=${baseBranch}"
                echo "Create merge request at ${PR_URL}"
                google-chrome "$PR_URL"
            fi
		else
			echo "No changes for which to create PR for $baseBranch"
		fi
	else
		echo "[WARN] gh cli is required to generate pull requests. See https://github.com/cli/cli?tab=readme-ov-file#installation to install it."
		echo -n "# To manually create a pull request, go here: "
		git config --get remote.origin.url | sed -r -e "s#:#/#" -e "s#git@#https://#" -e "s#\.git#/tree/${headBranch}/#"
	fi
  else
	echo "nothing to commit, working tree clean (2)"
  fi
}

doPush () {
  the_branch="$1"
  pr_branch="pr-update-${the_branch}-$(date +%s)"

  git pull origin "${the_branch}" 1>/dev/null 2>&1 || true
  createPr "${pr_branch}" "${the_branch}"
}

if [[ $CLEAN -eq 1 ]]; then
    rm -fr /tmp/pyxis-repo-configs
fi

yaml=developer-hub.yaml
if [[ -f $pluginsFile ]]; then
    if [[ -d /tmp/pyxis-repo-configs ]]; then # checked out already, so reuse that folder
        pushd /tmp/pyxis-repo-configs/products/developer-hub >/dev/null 2>&1 || exit 1
    else # do a fresh checkout
        cd /tmp >/dev/null 2>&1 
        git clone git@gitlab.cee.redhat.com:releng/pyxis-repo-configs.git pyxis-repo-configs >/dev/null 2>&1 
        pushd /tmp/pyxis-repo-configs/products/developer-hub >/dev/null 2>&1 || exit 1
    fi
    sed -i '/# insert plugin catalog entries below this line/q' $yaml
    grep registryReference "$pluginsFile" | sed -r -e 's|.+registryReference": "(.+)",*|\1|' | while IFS= read -r line; do
        echo "$line" # quay.io/rhdh-plugin-catalog/backstage-community-plugin-scaffolder-backend-module-regex:2.4.0@sha256:c32763dedbbc81bf380e5a4504f1404cc60bb4199fa06d2966ac2f0533f589f5
        repo=${line%%:*}
        repo=${repo#*/}
        plugin_name=${repo#*/}
        # plugin_ver=${line#*:}
        # plugin_ver=${plugin_ver%@*}
        cat << EOL >> $yaml
- image_type: Base
  base_rhel_version: rhel9
  repository:
    repository: $repo
    release_categories:
      - "$RELEASE_CATEGORY"
    includes_multiple_content_streams: true
    content_stream_tags: # list os tags
      *release-tags
    build_categories:
      - Standalone image
    team_id: "6423d6e67d139e5ada2e4f8d"
    display_data:
      name: "rhdh-plugin-catalog--$plugin_name"
      long_description: "RHDH Plugin Catalog: OCI artifact for plugin $plugin_name"
    vendor_label: redhat
    application_categories:
      - "Developer Tools"
    privileged_images_allowed: false
    documentation_links:
      *documentation-links
    contacts:
      *team-contacts
    use_latest: false
    requires_terms: true
EOL
    done
    # git status
    git commit --no-gpg-sign -s -m 'chore(rhdh): update developer-hub repositories: add new plugin-catalog artifacts' $yaml || echo "nothing to commit, working tree clean"
    doPush "main"
    popd  >/dev/null 2>&1 || exit 1
fi

echo -e "\nPR checked out in in /tmp/pyxis-repo-configs/products/developer-hub"
