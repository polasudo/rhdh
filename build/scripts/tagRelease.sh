#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# script to tag the janus/rhdh repos for a given release

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")
# defaults
# try to compute branches from currently checked out branch; else fall back to hard coded value
TARGET_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ $TARGET_BRANCH != "rhdh-1."*"-rhel-9" ]]; then
	TARGET_BRANCH="rhdh-1-rhel-9"
fi
pkgs_devel_branch=${TARGET_BRANCH}

DO_PUSH=1   # push the commit

# NOT USED
FORCE=""    # force push to the midstream repo in case of merge conflicts (use "-f")

pduser=rhdh-bot

SOURCE_BRANCH="" # normally, use this script to create tags, not branches

CLEAN="false" #  if set true, delete existing folders and do fresh checkouts

if [[ $# -lt 4 ]]; then
	echo "
To create or update existing branches:
  $0 -t PROD_VERSION --branchfrom SOURCE_GH_BRANCH -gh TARGET_GH_BRANCH -ghtoken GITHUB_TOKEN
Example: 
  $0 -t 1.1 --branchfrom main -gh 1.1.x -ghtoken \$GITHUB_TOKEN

To create tags (and push updated CSV content into operator-bundle repo):
  $0 -v CSV_VERSION -t PROD_VERSION -gh GH_BRANCH -ghtoken GITHUB_TOKEN -pd GITLAB_AND_PKGS_DEVEL_BRANCH -pduser kerberos_user
Example: 
  $0 -v 1.1.0 -t 1.1 -gh 1.1.x -pd rhdh-1.1-rhel-9 -ghtoken \$GITHUB_TOKEN

Options:
      --nopush                  do not push local changes; default: push changes
      -pduser                   run as a different bot user; default: $pduser 
"
	exit 1
fi

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
	'--branchfrom') SOURCE_BRANCH="$2"; shift 1;; # this flag will create branches instead of using branches to create tags
	'-v') CSV_VERSION="$2"; shift 1;; # 1.y.0
	'-t') PROD_VERSION="$2"; shift 1;; # 1.y # used to get released bundle container's CSV contents
	'-gh') TARGET_BRANCH="$2"; shift 1;;
	'-ghtoken') GITHUB_TOKEN="$2"; shift 1;;
	'-pd') pkgs_devel_branch="$2"; shift 1;;
	'-pduser') pduser="$2"; shift 1;;
	'--clean') CLEAN="true"; shift 0;; # if set true, delete existing folders and do fresh checkouts
	'--nopush') DO_PUSH=0; shift 1;;
  esac
  shift 1
done

if [[ ! ${PROD_VERSION} ]]; then
  PROD_VERSION=${CSV_VERSION%.*} # given 1.y.0, want 1.y
fi

if [[ ${CLEAN} == "true" ]]; then
	rm -fr /tmp/tmp-checkouts || true
fi

mkdir -p /tmp/tmp-checkouts
cd /tmp/tmp-checkouts

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

doPush () {
  set -x
  BRANCHUSED="$1"
  PR_BRANCH="pr-update-${BRANCHUSED}-$(date +%s)"

  git pull origin "${BRANCHUSED}" || true
  PUSH_TRY="$(git push origin "${BRANCHUSED}" ${FORCE} 2>&1 || true)"
  # shellcheck disable=SC2181
  if [[ $? -gt 0 ]] || [[ $PUSH_TRY == *"protected branch hook declined"* ]]; then
    # create pull request if target branch is restricted access
    createPr "${PR_BRANCH}" "${BRANCHUSED}"
  fi
  set +x
}

# ############
# UPSTREAM 
# ############

# create branch or tag
pushBranchAndOrTagGH () {
	orgAndRepo="$1"

	# nothing to do if tag already exists
	if [[ $CSV_VERSION ]] && [[ $(git ls-remote "https://github.com/$orgAndRepo" "refs/tags/$CSV_VERSION") ]]; then
		echo; echo "[WARN] https://github.com/$orgAndRepo/tree/$CSV_VERSION already exists."
	else
		d="${orgAndRepo/\//__}"
		echo; 
		if [[ $SOURCE_BRANCH ]]; then
			echo "== $orgAndRepo :: branch from $SOURCE_BRANCH to $TARGET_BRANCH =="
		elif [[ $CSV_VERSION ]]; then
			echo "== $orgAndRepo :: tag $CSV_VERSION from $TARGET_BRANCH =="
		fi
		# if source_branch defined and target branch doesn't exist yet, check out the source branch
		if [[ ${SOURCE_BRANCH} ]] && [[ $(git ls-remote --heads "https://github.com/${orgAndRepo}" "${TARGET_BRANCH}") == "" ]]; then
			clone_branch=${SOURCE_BRANCH}
		else # if source branch not set (tagging operation) or target branch already exists
			clone_branch=${TARGET_BRANCH}
		fi
		if [[ ! -d "/tmp/tmp-checkouts/projects_${d}" ]]; then
			git clone -q --depth 1 -b "${clone_branch}" "https://github.com/${orgAndRepo}" "projects_${d}" || echo "Branch $clone_branch doesn't exist: skip!"
		fi
		if [[ -d "/tmp/tmp-checkouts/projects_${d}" ]]; then
			pushd "/tmp/tmp-checkouts/projects_${d}" >/dev/null || exit 1
				export GITHUB_TOKEN="${GITHUB_TOKEN}"
				git config user.email "${pduser}@redhat.com"
				git config user.name "RHDH Build (${pduser})"
				git remote set-url origin "https://${GITHUB_TOKEN}:x-oauth-basic@github.com/${orgAndRepo}"

				git checkout --track "origin/${clone_branch}" -q || true
				git pull -q
				if [[ ${SOURCE_BRANCH} ]]; then 
					# create a branch or use existing
					git branch "${TARGET_BRANCH}" || true
					git checkout "${TARGET_BRANCH}" || true
					git pull origin "${TARGET_BRANCH}" || true

					# TODO apply changes to janus plugins and showcase / rhdh repos

					git pull origin "${TARGET_BRANCH}" || true
					if [[ $DO_PUSH -eq 1 ]]; then 
						doPush "${TARGET_BRANCH}"
					fi
				fi
				if [[ $CSV_VERSION ]]; then # push a new tag (or no-op if exists)
					git tag "${CSV_VERSION}" || true
					if [[ $DO_PUSH -eq 1 ]]; then 
						git push origin "${CSV_VERSION}" || true
					fi
				fi
			popd >/dev/null || exit 1
		fi
	fi
}

# ############
# MIDSTREAM 
# ############

pushTagGL () 
{
	d="$1"
	# nothing to do if tag already exists
	if [[ $CSV_VERSION ]] && [[ $(git ls-remote "https://gitlab.cee.redhat.com/rhidp/${d}.git/" "refs/tags/$CSV_VERSION") ]]; then
		echo; echo "[WARN] https://gitlab.cee.redhat.com/rhidp/${d}/-/tree/${CSV_VERSION}?ref_type=tags already exists."
	else
		echo;
		if [[ $SOURCE_BRANCH ]]; then
			echo "== $d :: branch from $SOURCE_BRANCH to $TARGET_BRANCH =="
		elif [[ $CSV_VERSION ]]; then
			echo "== $d :: tag $CSV_VERSION from $TARGET_BRANCH =="
		fi
		if [[ ! -d "/tmp/tmp-checkouts/gitlab_${d}" ]]; then
			git clone -q --depth 1 -b "${pkgs_devel_branch}" "git@gitlab.cee.redhat.com:rhidp/${d}.git" "gitlab_${d}" || echo "Branch $pkgs_devel_branch doesn't exist: skip!"
		fi
		if [[ -d "/tmp/tmp-checkouts/gitlab_${d}" ]]; then
			pushd "/tmp/tmp-checkouts/gitlab_${d}" >/dev/null || exit 1
				git config user.email "${pduser}@redhat.com"
				git config user.name "RHDH Build (${pduser})"
				git checkout --track origin/"${pkgs_devel_branch}" -q || true
				git pull -q
				if [[ ${SOURCE_BRANCH} ]]; then 
					# create a branch or use existing
					git branch "${TARGET_BRANCH}" || true
					git checkout "${TARGET_BRANCH}" || true
					git pull origin "${TARGET_BRANCH}" || true

					# TODO apply changes to janus plugins and showcase / rhdh repos

					git pull origin "${TARGET_BRANCH}" || true
					if [[ $DO_PUSH -eq 1 ]]; then 
						doPush "${TARGET_BRANCH}"
					fi
				fi
				if [[ $CSV_VERSION ]]; then # push a new tag (or no-op if exists)
					git tag -a "${CSV_VERSION}" -m "${CSV_VERSION}" || true
					if [[ $DO_PUSH -eq 1 ]]; then 
						git push origin "${CSV_VERSION}" || true
					fi
				fi
			popd >/dev/null || exit 1
		fi
	fi
}

# ############
# DOWNSTREAM 
# ############

pushTagPD () 
{
	d="$1"
	# nothing to do if tag already exists
	if [[ $CSV_VERSION ]] && [[ $(git ls-remote "ssh://${pduser}@pkgs.devel.redhat.com/containers/${d}" "refs/tags/$CSV_VERSION") ]]; then
		echo; echo "[WARN] https://pkgs.devel.redhat.com/cgit/containers/${d}/tag/?h=$CSV_VERSION already exists."
	else
		echo; 
		if [[ $SOURCE_BRANCH ]]; then
			echo "== $d :: branch from $SOURCE_BRANCH to $TARGET_BRANCH =="
		elif [[ $CSV_VERSION ]]; then
			echo "== $d :: tag $CSV_VERSION from $TARGET_BRANCH =="
		fi
		if [[ ! -d "/tmp/tmp-checkouts/containers_${d}" ]]; then
			git clone -q -b "${pkgs_devel_branch}" "ssh://${pduser}@pkgs.devel.redhat.com/containers/${d}" "containers_${d}"
			pushd "/tmp/tmp-checkouts/containers_${d}" >/dev/null || exit 1
				git config user.email "${pduser}@redhat.com"
				git config user.name "RHDH Build (${pduser})"
				git checkout --track origin/"${pkgs_devel_branch}" -q || true
				git pull -q
			popd >/dev/null || exit 1
		fi
		pushd "/tmp/tmp-checkouts/containers_${d}" >/dev/null || exit 1
			if [[ ${SOURCE_BRANCH} ]]; then 
				# create a branch or use existing
				git branch "${TARGET_BRANCH}" || true
				git checkout "${TARGET_BRANCH}" || true
				git pull origin "${TARGET_BRANCH}" || true

				# TODO apply changes to janus plugins and showcase / rhdh repos

				git pull origin "${TARGET_BRANCH}" || true
				if [[ $DO_PUSH -eq 1 ]]; then 
					doPush "${TARGET_BRANCH}"
				fi
			fi
			if [[ $CSV_VERSION ]]; then # push a new tag (or no-op if exists)
				git tag -a "${CSV_VERSION}" -m "${CSV_VERSION}" || true
				if [[ $DO_PUSH -eq 1 ]]; then 
					git push origin "${CSV_VERSION}" || true
				fi
			fi
		popd >/dev/null || exit 1
	fi
}

####################################

############
# UPSTREAM 
############

# TODO add redhat-developer/red-hat-developer-hub-theme ?
# TODO RHIDP-1025 add redhat-developer/red-hat-developer-hub-customization-provider?

# TODO move janus-idp to redhat-developer
	# RHIDP-1018 Sunset Janus IDP GH repos
	# RHIDP-1019 Migrate Janus IDP plugins repo to backstage upstream
	# RHIDP-1022 Migrate Janus IDP showcase repo to redhat-developers org
	# RHIDP-1021 Migrate Janus IDP operator repo to redhat-developers org

# branch and/or tag GH repos
for repo in \
	janus-idp/backstage-plugins \
	janus-idp/backstage-showcase \
	janus-idp/operator \
	redhat-developer/red-hat-developers-documentation-rhdh \
	redhat-developer/rhdh-chart \
	redhat-developer/red-hat-developer-hub-software-templates \
	; do
	pushBranchAndOrTagGH $repo 
done

# ############
# MIDSTREAM 
# ############

# branch or tag GL repo(s)
if [[ "${pkgs_devel_branch}" ]] && [[ "${CSV_VERSION}" ]]; then
	for repo in \
		rhdh \
		; do
	  pushTagGL $repo
	done
	# cleanup
	rm -fr /tmp/tmp-checkouts/*
fi

# ############
# DOWNSTREAM 
# ############

# tag pkgs.devel repos only (branches are created by SPMM ticket, eg., https://projects.engineering.redhat.com/browse/SPMM-2517)
if [[ "${pkgs_devel_branch}" ]] && [[ "${CSV_VERSION}" ]]; then
	for repo in \
		rhdh-hub \
		rhdh-operator \
		rhdh-operator-bundle \
		; do
	  pushTagPD $repo
	done
fi

# cleanup
rm -fr /tmp/tmp-checkouts
