#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to tag the rhdh repos for a given release, or 
# create stable branches + update main branches after branch creation

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

# RH production key, to use only in release-1.yy stable branches; otherwise use the devel key for main
SEGMENT_WRITE_KEY="mUr49Tkld5bj1lFFPxxqHrAzkQMRINvF"

TMPDIR="$HOME/tmp/tmp-checkouts"

# defaults

MIDSTM_USER=rhdh-bot
MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi

# try to compute branches from currently checked out branch; else fall back to hard coded value
TARGET_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ $TARGET_BRANCH != "rhdh-1."*"-rhel-9" ]]; then
	TARGET_BRANCH="rhdh-1-rhel-9"
fi

DO_BUILD=1   # update yarn locks
DO_PUSH=1    # push the commit
DO_UPDATE=0  # force update of release-1.yy branches, even if tag already exists
SKIP_GH=0    # skip updates to GH repos
SKIP_GL=0    # skip updates to RHDH GL repo
SKIP_KRD=0   # skip updates to konflux-release-data repo
SKIP_PRODSEC=0 # skip updates to prodsec/product-definitions repo
SKIP_PYXIS=0 # skip updates to pyxis-repo-configs repo
# make builds faster
export HUSKY=0

REPOS_FILE="${SCRIPT_DIR}/release-repos.yaml"
if [[ ! -f "${REPOS_FILE}" ]]; then
	echo -e "${red}[ERROR] Required file not found: ${REPOS_FILE}${norm}"
	exit 1
fi
GH_REPOS=""
GL_REPOS=""

# normally, use this script to create tags, not branches
# this also defines the branch to update after creating a new branch (eg., for a TARGET_BRANCH=release-1.3 branch creation, bump SOURCE_BRANCH=main to 1.4.0)
SOURCE_BRANCH="" 

CLEAN="false" #  if set true, delete existing folders and do fresh checkouts

YQ="$HOME/.local/bin/yq_mf"
mikefarahyq_version=4.45.4

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

usage() {
	echo "
Utility script to perform updates to repos when branching or tagging

Requires: both yq (python wrapper for jq) and yq from https://github.com/mikefarah/yq/ >= v$mikefarahyq_version
	
To create or update existing branches:
  $0 --branchfrom SOURCE_GH_BRANCH -gh TARGET_GH_BRANCH -ghtoken GITHUB_TOKEN
Example: 
  $0 --branchfrom main -gh release-1.10 --clean -ghtoken \$GITHUB_TOKEN

To create tags (and push updates to release-1.yy branches):
1. You should have a valid $MIDSTM_USER GITHUB_TOKEN (for upstream PRs and tags).
2. You should have a valid $MIDSTM_USER kerberos login (for mid- and downstream pushes).
3. Run this
  $0 -v CSV_VERSION -t PROD_VERSION -gh GH_BRANCH -ghtoken GITHUB_TOKEN
Example: 
  $0 -v 1.9.3 -t 1.9 -gh release-1.9 --midstream-branch rhdh-1.9-rhel-9 --clean --force-update -tmpdir $TMPDIR --nobuild \\
    --skip-gl --skip-krd --skip-prodsec --skip-pyxis \\
    --gh-repos \"redhat-developer/rhdh redhat-developer/rhdh-operator\"

Options:
    --clean                   delete existing temp folders and do fresh checkouts
    --force-update            update the release-1.yy branch even if the tag already exists
    --nobuild                 do not regen yarn lock(s)
    --nopush                  do not push local changes; default: push changes
    --dry-run                 do everything but create the PR; instead just display the PR contents
    --gitlab-pipeline-push    use this flag to push changes when running inside a gitlab pipeline
    -ghtoken                  run as a different GH user instead of the local environment's \$GITHUB_TOKEN
    --midstream-user          run as a different bot user; default: $MIDSTM_USER 
    --midstream-branch        run against a different midstream branch; default: $MIDSTM_BRANCH
    --plugin-builds-dir       path to plugin catalog repo's plugin_builds/ folder
    -tmpdir                   temporary dir for checkouts; default $TMPDIR
    --skip-gh                 (1) skip all github updates
      --gh-repos                  space-separated list of GH repos to process, if not the whole set
    --skip-gl                 (2) skip gitlab rhdh repo updates
    --skip-prodsec            (3) skip gitlab prodsec/product-definitions repo updates
    --skip-pyxis              (4) skip gitlab pyxis-repo-configs repo updates
    --skip-krd                (5) skip gitlab konflux-release-data repo updates
    --debug                   more output
"
}

if [[ $# -lt 4 ]]; then 
	usage
	exit 1
fi

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
	'--branchfrom') SOURCE_BRANCH="$2"; shift 1;; # this flag will create branches instead of using branches to create tags
	'-v') CSV_VERSION="$2"; shift 1;; # 1.y.z
	'-t') PROD_VERSION="$2"; shift 1;; # 1.y # used to get released bundle container's CSV contents
	'-gh') TARGET_BRANCH="$2"; shift 1;;
	'-ghtoken') GITHUB_TOKEN="$2"; shift 1;;
	'--midstream-user') MIDSTM_USER="$2"; shift 1;;
	'--midstream-branch') MIDSTM_BRANCH="$2"; shift 1;;
	'--plugin-builds-dir') pluginBuildsJson="$2"; shift 1;;
	'--clean') CLEAN="true"; shift 0;; # if set true, delete existing folders and do fresh checkouts
	'--nobuild') DO_BUILD=0;; 
	'--nopush') DO_PUSH=0;;
	'--gitlab-pipeline-push') DO_PUSH=1; DO_BUILD=1; GITLAB_PIPELINE="true";;
	'--dry-run') DRYRUN="$1";;
	'--force-update') DO_UPDATE=1;;
	'-tmpdir') TMPDIR="$2"; shift 1;;
	'--skip-gh') SKIP_GH=1;;
	'--gh-repos') GH_REPOS_OVERRIDE="$2"; shift 1;;
	'--skip-gl') SKIP_GL=1;;
	'--skip-krd') SKIP_KRD=1;;
	'--skip-prodsec') SKIP_PRODSEC=1;;
	'--skip-pyxis') SKIP_PYXIS=1;;
	'--debug') VERBOSE=1;;
	'-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ "$pluginBuildsJson" ]] && [[ ! -d "$pluginBuildsJson" ]]; then 
	usage; echo -e "${red}[ERROR] Path to plugin_builds/ not found in $pluginBuildsJson ${norm}"; exit 1
fi

# check if the script is running as the rhdh-bot user, or someone ellse
if [[ $(git config user.email) != "rhdh-bot@redhat.com" ]]; then
	usage; echo -e "${red}[ERROR] This script must be run as the rhdh-bot@redhat.com user so that you can create PRs and tags using that user's permissions.${norm}"; exit 1
fi

# TODO switch to jq wrapper version of yq (not mikefarah)
if ! command -v "$YQ" &> /dev/null; then
    mkdir -p "$HOME/.local/bin/"
    echo -e "${blue}Installing mikefarah yq version $mikefarahyq_version for $(uname -m -o) ...${norm}"
    if [[ $(uname -m -o) == "arm64 Darwin" ]] || [[ $(uname -o -m) == "arm64 Darwin" ]]; then # recent Mac version switched o and m values 
        curl -sSLo "$YQ" https://github.com/mikefarah/yq/releases/download/v${mikefarahyq_version}/yq_darwin_arm64
    elif [[ "$(uname -m -o)" == "x86_64 GNU/Linux" ]]; then
        curl -sSLo "$YQ" https://github.com/mikefarah/yq/releases/download/v${mikefarahyq_version}/yq_linux_amd64
    else 
      usage; echo -e "${red}[ERROR] Please install yq v${mikefarahyq_version} from https://github.com/mikefarah/yq/ for your arch to ${YQ}${norm}"; exit 1
    fi
    chmod +x "$YQ"
fi 

# Read release repo lists from the central config file using yq.
if [[ -n "${GH_REPOS_OVERRIDE}" ]]; then
	GH_REPOS="${GH_REPOS_OVERRIDE}"
else
	GH_REPOS=$("$YQ" -r '.github_repos[]' "${REPOS_FILE}" | tr '\n' ' ')
fi
GL_REPOS=$("$YQ" -r '.gitlab_repos[] | split("/")[-1]' "${REPOS_FILE}" | tr '\n' ' ')

if [[ -z "${GH_REPOS// }" ]]; then
	echo -e "${red}[ERROR] No github_repos found in ${REPOS_FILE}${norm}"
	exit 1
fi
if [[ -z "${GL_REPOS// }" ]]; then
	echo -e "${red}[ERROR] No gitlab_repos found in ${REPOS_FILE}${norm}"
	exit 1
fi

if [[ ! ${PROD_VERSION} ]]; then
	PROD_VERSION=${CSV_VERSION%.*} # given 1.y.0, want 1.y
fi
if [[ ! ${PROD_VERSION} ]]; then
	PROD_VERSION=${TARGET_BRANCH/release-} # given release-1.y, want 1.y
fi
KFUX_VERSION=${PROD_VERSION/./-} # want 1-4, not 1.4

if [[ ${CLEAN} == "true" ]]; then
	rm -fr "$TMPDIR" || true
fi

mkdir -p "$TMPDIR"
cd "$TMPDIR"

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
  if [[ $(git diff --name-only HEAD~1 2>/dev/null || true) ]]; then # only if we have changes
	# in case we checked out from release-1.4 but need to base a PR against main
	# set -x
	git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'; git fetch --depth=10 >/dev/null 2>&1 || true
	git pull origin "${baseBranch}" 1>/dev/null 2>&1 || true
	git branch "${headBranch}" || true
	git checkout "${headBranch}" 1>/dev/null 2>&1
	git merge "${baseBranch}" 1>/dev/null 2>&1 || true
	# shellcheck disable=SC2086
	if [[ $(/usr/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
		if [[ $(git diff --name-only HEAD~1 2>/dev/null || true) ]]; then
			# if github
			if [[ $(git remote -v | grep github || true) ]]; then
				git push origin "${headBranch}" 1>/dev/null
				gh repo set-default "$(git remote get-url origin)"
				# shellcheck disable=SC2086
				# echo "### tR.sh CREATING PR for baseBranch=$baseBranch .. headBranch=$headBranch ..."
				gh pr create --fill -B "${baseBranch}" -H "${headBranch}" ${DRYRUN} || true
				# if not running in a gitlab pipeline, open the PR in a browser 
				if [[ $GITLAB_PIPELINE != "true" ]]; then
					gh pr view --web || true
				fi
			else # not github; assume gitlab
				PR_URL=$(git push origin "${headBranch}" 2>&1 | grep "${headBranch}" | grep "https://" | sed -r -e "s/remote:   //" | tr -d " ")
				if [[ ! $PR_URL ]]; then
					# try again using the current user's fork
					# dynamically determine the repo name from origin remote
					origin_repo=$(git remote get-url origin | sed -r -e 's#.*[:/]([^/]+)/([^/]+)(\.git)?$#\2#' | sed -r -e "s/.git$//")
					git remote add "$(whoami)" "git@gitlab.cee.redhat.com:$(whoami)/${origin_repo}.git" 2>/dev/null || git remote set-url "$(whoami)" "git@gitlab.cee.redhat.com:$(whoami)/${origin_repo}.git"
					PR_URL=$(git push -f "$(whoami)" "${headBranch}" 2>&1 | grep "${headBranch}" | grep "https://" | sed -r -e "s/remote:   //" | tr -d " ")
				fi
				# if can't push to fork, try origin
				if [[ ! $PR_URL ]]; then 
					PR_URL=$(git push -f "origin" "${headBranch}" 2>&1 | grep "${headBranch}" | grep "https://" | sed -r -e "s/remote:   //" | tr -d " ")
				fi
				if [[ ! $PR_URL ]]; then 
					echo -e "${red}[ERROR] Cannot create a PR for your changes by pushing topic branch to either origin or $(whoami) fork. Please create a PR manually from sources in $(pwd) !${norm}"
					exit 1
				else 
					PR_URL="${PR_URL}&merge_request%5Btarget_branch%5D=${baseBranch}"
					echo "Create merge request at ${PR_URL}"
					google-chrome "$PR_URL"
				fi
			fi
		else
			echo "No changes for which to create PR for $baseBranch"
		fi
	else
		echo -e "${blue}[WARN] gh cli is required to generate pull requests. See https://github.com/cli/cli?tab=readme-ov-file#installation to install it.${norm}"
		echo -n "# To manually create a pull request, go here: "
		git config --get remote.origin.url | sed -r -e "s#:#/#" -e "s#git@#https://#" -e "s#\.git#/tree/${headBranch}/#"
	fi
	# set +x
  else
	echo "nothing to commit, working tree clean (6)"
  fi
}

# for creating a new branch, or pushing changes to an existing branch (may require PR)
doPush () {
  the_branch="$1"
  pr_branch="chore/automated-update-${the_branch}-$(date +%s)"

  git pull origin "${the_branch}" 1>/dev/null 2>&1 || true
  createPr "${pr_branch}" "${the_branch}"
}

# compute the next .z versions based on the input CSV version
# eg., for 1.1.2 get 1.1.3 (showcase repo, RHDH CSV), 0.1.3 (operator repo, upstream CSV), and 3.1.3 (plugins repo root package.json)
CSV_VERSION_Z=""
CSV_VERSION_Z_OPERATOR=""
getNextCSVZ() {
	ver="$1"
	if [[ $ver =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then # increase the z digit
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]}
		ZZ=${BASH_REMATCH[3]}
		(( ZZ=ZZ+1 ))
		CSV_VERSION_Z="$XX.$YY.$ZZ"
		if [[ $XX -gt 1 ]]; then 
			(( XX=XX-1 ))
		else
			XX="0"
		fi
		CSV_VERSION_Z_OPERATOR="$XX.$YY.$ZZ"
		(( XX=XX+3 ))
	fi
}

# compute the next .z versions based on the input CSV version
# eg., for 1.1.2 get 1.1.3 (showcase repo, RHDH CSV), 0.1.3 (operator repo, upstream CSV)
newver="1.y.0"
newverOp="0.y.0"
getXYplusOneFromBranch() {
	ver="$1" # 1.y.x or release-1.y
	ver=${ver/.x/}
	ver=${ver/release-/}
	if [[ $ver =~ ^([0-9]+)\.([0-9]+) ]]; then # increase the y digit
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]}
		(( YY=YY+1 ))
		newver="$XX.$YY.0"
		if [[ $XX -gt 1 ]]; then 
			(( XX=XX-1 ))
		else
			XX="0"
		fi
		newverOp="$XX.$YY.0"
	fi
}

# for redhat-developer/rhdh-local, update versions in container-image-guide.md, default.env, and compose.yaml
function updateRHDHLocalVersions() {
	the_branch="$1"
	the_version_z=""
	if [[ "$2" =~ ^([0-9]+\.[0-9]+)\.[0-9]+ ]]; then
		the_version_y="${BASH_REMATCH[1]}"
		the_version_z="$2"
	else
		the_version_y="$2"
	fi

	the_next_version_y=${the_version_y}
	the_stable_version_y=${the_version_y}
	if [[ $the_version_y =~ ^([0-9]+)\.([0-9]+) ]]; then
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]}
		(( YY=YY+1 ))
		the_next_version_y="${XX}.${YY}"
		if [[ ${BASH_REMATCH[2]} -ge 1 ]]; then
			the_stable_version_y="${XX}.$((BASH_REMATCH[2] - 1))"
		fi
	fi
	
	the_rhdh_version="${the_version_z:-$the_stable_version_y}"

	orgAndRepo="redhat-developer/rhdh-local"
	d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	################
	# set tags
	################
	guide_rhdh_image_tag="next-${the_version_y}"
	guide_ci_build_tag="${the_next_version_y}"
	guide_example_tag="${the_version_y}"

	if [[ "$the_version_z" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		# 1.y.z release
		guide_community_tag="${the_version_y}"
		guide_registry_tag="${the_version_z}"
		guide_quay_tag="${the_next_version_y}"
		guide_which_includes_tag="${the_version_y}"
		default_env_tag="${the_version_y}"
		compose_tag="${the_version_y}"
	else
		# 1.y (branching from main)
		guide_community_tag="${the_stable_version_y}"
		guide_registry_tag="${the_rhdh_version}"
		guide_quay_tag="${the_version_y}"
		guide_which_includes_tag="${the_stable_version_y}"
		default_env_tag="${the_stable_version_y}"
		compose_tag="${the_stable_version_y}"
	fi

	for f in \
		./docs/rhdh-local-guide/container-image-guide.md \
		./docs/guides/container-image-guide.md \
		./default.env \
		./compose.yaml \
		; do
		if [[ ! -f "$f" ]]; then continue; fi
		if [[ "$f" == *"container-image-guide.md" ]]; then
			sed -i "$f" -r \
				-e "s|RHDH_IMAGE=quay.io/rhdh-community/rhdh:(next-)?[0-9]+\.[0-9]+|RHDH_IMAGE=quay.io/rhdh-community/rhdh:${guide_rhdh_image_tag}|g" \
				-e "s|rhdh-community/rhdh:([0-9]+\.[0-9]+)|rhdh-community/rhdh:${guide_community_tag}|g" \
				-e "s|(registry.redhat.io/rhdh/rhdh-hub-rhel9:)([0-9]+\.[0-9.]+)|\1${guide_registry_tag}|g" \
				-e "s|(quay.io/rhdh/rhdh-hub-rhel9:)([0-9]+\.[0-9]+)|\1${guide_quay_tag}|g" \
				-e "s|(\(for example, )([0-9]+\.[0-9]+)|\1${guide_example_tag}|" \
				-e "s|(CI build of RHDH 1.y \(for example, )([0-9]+\.[0-9]+)|\1${guide_ci_build_tag}|" \
				-e "s|(\(for example, )([0-9]+\.[0-9]+)(\),? *which include[s]?)|\1${guide_which_includes_tag}\3|"
		elif [[ "$f" == *"default.env" ]]; then
			sed -i "$f" -r \
				-e "s|rhdh-community/rhdh:(next-)?([0-9]+\.[0-9]+)|rhdh-community/rhdh:${default_env_tag}|g" \
				-e "s|plugin-catalog-index:([0-9]+\.[0-9]+)|plugin-catalog-index:${the_version_y}|g"
		else # compose.yaml
			sed -i "$f" -r \
				-e "s|rhdh-community/rhdh:(next-)?([0-9]+\.[0-9]+)|rhdh-community/rhdh:${compose_tag}|g"
		fi
	done
	echo -n "updateRHDHLocalVersions: "; pwd; git diff || true
	if [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to ${the_version_z:-$the_version_y} in $the_branch branch"
		COMMITMSG="${COMMITMSG} [skip-build] [skip-e2e]"
		if [[ $(git diff || true ) ]]; then
			git commit --no-gpg-sign -s -m "${COMMITMSG}" .
			git pull origin "${the_branch}" || true
			# create pull request if target branch is restricted access
			pr_branch="chore/automated-bump-to-${the_version_z:-$the_version_y}-in-${the_branch}-$(date +%s)"
			createPr "${pr_branch}" "${the_branch}"
		fi
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# for redhat-developer/rhdh-cli, bump to specified version
function updateRHDHCLIVersion() {
	the_branch="$1"
	the_version="$2"
	orgAndRepo="redhat-developer/rhdh-cli"
	d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	################
	# update 1 file
	################

	d=package.json
	jq -r --arg the_version "$the_version" '.version|=$the_version' $d > "${d}1"; mv -f "${d}1" "${d}"

	echo -n "updateRHDHCLIVersion: "; pwd; git diff || true
	if [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch"
		if [[ $DO_BUILD -eq 1 ]]; then
			# quietly install any updates to yarn.lock so PR will pass sniff test
			yarn install 2> >(grep -v warning 1>&2) 
			COMMITMSG="${COMMITMSG} + regen yarn.lock"
		else
			COMMITMSG="${COMMITMSG} [skip-build] [skip-e2e]"
		fi
		if [[ $(git diff || true ) ]]; then
			git commit --no-gpg-sign -s -m "${COMMITMSG}" .
			git pull origin "${the_branch}" || true
			# create pull request if target branch is restricted access
			pr_branch="chore/automated-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
			createPr "${pr_branch}" "${the_branch}"
		fi
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}
# for redhat-developer/rhdh, bump to specified version
function updateRHDHVersions() {
	the_branch="$1"
	the_version="$2"
	orgAndRepo="redhat-developer/rhdh"
	d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	######################################
	# update RHDH doc URLs with version
	######################################

	# TODO https://issues.redhat.com/browse/RHIDP-8936 
	# update this to use https://github.com/redhat-developer/rhdh-plugin-export-overlays/ (or https://gitlab.cee.redhat.com/rhidp/rhdh-plugin-catalog)
	# once catalog entities have moved to new location

	# Directory containing the plugin YAML files with docs URLs
	docsDir="catalog-entities/marketplace"
	branchVersion="${the_branch#release-}"

	# do not make this change in main branch, only for release-1.y branches!
	count=0
	if [[ -d "$docsDir" ]] && [[ ! ${SOURCE_BRANCH} ]]; then
		echo "Updating docs URLs with RHDH version ${branchVersion} in $docsDir"
		while IFS= read -r -d '' file; do
			(( count = count + 1 ))
			echo " - Updating $file"
			sed -i "$file" -r \
				-e "s~(https://docs.redhat.com/en/documentation/red_hat_developer_hub)(/([0-9]+\.[0-9]+)|/latest)?~\1/${branchVersion}~g" 
		done < <(find "$docsDir" -type f -name "*.yaml" -print0)
		echo "Updated $count files"
	fi

	################
	# update 3+ files
	################

	for d in package.json ./*/package.json ./.?*/package.json; do # dynamic-plugins/package.json is new for 1.7+; .ibm/package.json is new for 1.8+
		if [[ -f $d ]]; then
			jq -r --arg the_version "$the_version" '.version|=$the_version' "$d" > "${d}1"; mv -f "${d}1" "${d}"
		fi
	done
	sed -i packages/app/src/build-metadata.json -r \
		`# up to RHDH 1.5` \
		-e "s/(\"RHDH Version: )[0-9.]+\"/\1$the_version\"/" \
		`# RHDH 1.6+` \
		-e "s/(\"RHDH Version\": \")[0-9.]+\"/\1$the_version\"/"

	echo -n "updateRHDHVersions: "; pwd; git diff || true
	if [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch"
		if [[ $DO_BUILD -eq 1 ]]; then
			# quietly install any updates to yarn.lock so PR will pass sniff test
			yarn install 2> >(grep -v warning 1>&2) 
			COMMITMSG="${COMMITMSG} + regen yarn.lock"
		else
			COMMITMSG="${COMMITMSG} [skip-build] [skip-e2e]"
		fi
		if [[ $(git diff || true ) ]]; then
			git commit --no-gpg-sign -s -m "${COMMITMSG}" .
			git pull origin "${the_branch}" || true
			# create pull request if target branch is restricted access
			pr_branch="chore/automated-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
			createPr "${pr_branch}" "${the_branch}"
		fi
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# for redhat-developer/rhdh-must-gather, bump Makefile VERSION after a GA tag
function updateRHDHMustGatherVersions() {
	the_branch="$1"
	the_version="$2"
	orgAndRepo="redhat-developer/rhdh-must-gather"
	d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $the_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	# Upstream repo is flat (root Makefile); distgit/containers/... exists only under rhidp/rhdh midstream.
	if [[ -f Makefile ]]; then
		echo "Updating Makefile VERSION to ${the_version}"
		sed -i Makefile -r \
			-e "s/^VERSION \\?= .*/VERSION ?= ${the_version}/"
	fi

	echo -n "updateRHDHMustGatherVersions: "; pwd; git diff || true
	if [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to ${the_version} in ${the_branch} branch [skip-build]"
		if [[ $(git diff || true ) ]]; then
			git commit --no-gpg-sign -s -m "${COMMITMSG}" .
			git pull origin "${the_branch}" || true
			pr_branch="chore/automated-bump-must-gather-to-${the_version}-in-${the_branch}-$(date +%s)"
			createPr "${pr_branch}" "${the_branch}"
		fi
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# for operator, bump to specified version
function updateOperatorVersions() {
	the_branch="$1"
	the_version="$2"
	the_version_op="$3"
	echo "[DEBUG] the_branch=$the_branch, the_version=$the_version, the_version_op=$the_version_op"
	orgAndRepo="redhat-developer/rhdh-operator"
	d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	################
	# update 4 files
	################

	# set -x 
	# pwd

	# update Makefile
	sed -i Makefile -r -e "s/(VERSION \?= )[0-9.]+/\1$the_version_op/" # 0.y.0

	# update *.clusterserviceversion.yaml
	for y in \
		config/manifests/rhdh/bases/backstage-operator.clusterserviceversion.yaml \
		bundle/rhdh/manifests/backstage-operator.clusterserviceversion.yaml; do
		if [[ -f $y ]]; then
			echo "Update $y ..."
			sed -i $y -r \
				` # update the tags in the CSV to the latest 1.y version` \
				-e "s|(/rhdh/rhdh-.+:)([0-9.]+)|\1${the_version%.*}|g" \
				` # update refs to the latest x.y.0 or x.y.z version` \
				-e "s/(skipRange: '>=1.0.0 <)[0-9.]+'/\1$the_version'/" \
				-e "s/(name: rhdh-operator.v)[0-9.]+/\1$the_version/" \
				-e "s/(^  version: )[0-9.]+/\1$the_version/" \
				-e "s/(^  replaces: rhdh-operator.v)[0-9.]+/\1${PROD_VERSION}.0/" \
				-e "s/(rhdh-rhdh-hub-rhel9:|rhdh-rhdh-rhel9-operator:)[0-9.]+/\1${the_version%.*}/" \
				-e "s/(plugin-catalog-index:|plugin-catalog-index:)[0-9.]+/\1${the_version%.*}/" \
				-e "s|(.*https://access.redhat.com/documentation/en-us/red_hat_developer_hub/)([0-9.]+)(/html-single/administration_guide_for_red_hat_developer_hub/index#assembly-rhdh-telemetry_admin-rhdh.*)|\1${the_version%.*}\3|g"
			# NOTE: downstream we need to rename this file from backstage-operator.clusterserviceversion.yaml to rhdh-operator.clusterserviceversion.yaml
		fi
	done

	# update config/manager/kustomization.yaml
	# shellcheck disable=SC2044
	for d in \
		$(find . -name kustomization.yaml) \
		bundle/backstage.io/manifests/backstage-operator.clusterserviceversion.yaml; do 
		if [[ -f $d ]]; then
			echo "Update $d ..."
			sed -i "$d" -r \
			-e "s/(^  newTag:  )[0-9.]+/\1$the_version_op/" \
			-e "s/(^  version: )[0-9.]+/\1$the_version_op/" # 0.y.0
		fi
	done

	# remove old refs to reg-proxy
	for d in \
		config/manifests/rhdh/bases/csv.yaml \
		bundle/rhdh/manifests/backstage-operator.clusterserviceversion.yaml; do
		if [[ -f $d ]]; then
			echo "Update $d ..."
			sed -i "$d" -r \
			-e "s|registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh|quay.io/rhdh/rhdh|" \
			-e "s|(containerImage: quay.io/rhdh/rhdh-rhel9-operator:)[0-9.]+|\1$PROD_VERSION|" \
			-e "s|(containerImage: quay.io/rhdh/plugin-catalog-index:)[0-9.]+|\1$PROD_VERSION|"
		fi
	done

	echo -n "updateOperatorVersions: "; pwd; git diff || true
	if [[ $(git diff || true ) ]] && [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch [skip-build] [skip-e2e]"
		git commit --no-gpg-sign -s -m "${COMMITMSG}" .
		git pull origin "${the_branch}" || true
		# create pull request if target branch is restricted access
		pr_branch="chore/automated-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
		createPr "${pr_branch}" "${the_branch}"
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

function updateDocVersions() {
	the_branch="$1"
	the_version="$2"
	orgAndRepo="redhat-developer/red-hat-developers-documentation-rhdh"
	d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	###############
	# update 1 file
	###############

	d=artifacts/attributes.adoc
	sed -i "$d" -r \
		-e "s/(:product-version: ).+/\1${the_version%.*}/" \
		-e "s/(:product-bundle-version: ).+/\1${the_version}/" \
		-e "s/(:product-chart-version: ).+/\1${the_version}/"

	echo -n "updateDocVersions: "; pwd; git diff || true
	if [[ $(git diff || true ) ]] && [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch [skip-build] [skip-e2e]"
		git commit --no-gpg-sign -s -m "${COMMITMSG}" .
		git pull origin "${the_branch}" || true
		# create pull request if target branch is restricted access
		pr_branch="chore/automated-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
		createPr "${pr_branch}" "${the_branch}"
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# for charts repo, bump to specified version
# chart version must increment (y+1) in charts/backstage/Chart.yaml and in README.md
function updateChartVersions(){
    the_branch="$1"
    the_version="$2" # 1.3.0
    the_version="${the_version%.*}" # 1.3
    # push path to repo onto the stack
    orgAndRepo="redhat-developer/rhdh-chart"
    d="${orgAndRepo/\//__}"
	rm -fr "$TMPDIR/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "git@github.com:${orgAndRepo}" "$TMPDIR/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}_2" >/dev/null || exit 1

	files_to_bump="./charts/backstage/README.md ./charts/backstage/Chart.yaml"

    # update telemetry link in chart files to new version 
	for file in $files_to_bump; do
		sed -i "${file}" -r \
			-e "s|(.*https://access.redhat.com/documentation/en-us/red_hat_developer_hub/)([0-9.]+)(/html-single/administration_guide_for_red_hat_developer_hub/index#assembly-rhdh-telemetry_admin-rhdh.*)|\1${the_version}\3|g"
	done
    
    # if there are changes in the file and commit can be pushed
    echo -n "updateChartVersions: "; pwd; git diff || true
	if [[ $(git diff || true ) ]] && [[ ${DO_PUSH} -eq 1 ]]; then

		# bump chart version to x.y+1.0 when switching versions
		chart_ver=$(yq -r '.version' ./charts/backstage/Chart.yaml)
		if [[ $chart_ver =~ ^([0-9]+)\.([0-9]+)\..* ]]; then # increase the y digit
			XX=${BASH_REMATCH[1]}
			YY=${BASH_REMATCH[2]}
			(( YY=YY+1 ))
			newver="$XX.$YY.0"
		fi
		for file in $files_to_bump; do
			sed -i "${file}" -r \
				-e "s/(^version: |Version: |Version-)([0-9.]+)/\1$newver/g"
		done
		git diff || true

		COMMITMSG="chore: tagRelease.sh: bump to ${the_version} in ${the_branch} branch [skip-build] [skip-e2e]"
		git commit --no-gpg-sign -s -m "${COMMITMSG}" . || git commit --no-gpg-sign -s -m "${COMMITMSG}" . 
		git pull origin "${the_branch}" || true
		# create pull request if target branch is restricted access
		pr_branch="chore/automated-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
		createPr "${pr_branch}" "${the_branch}"
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# ############
# UPSTREAM 
# ############

# create branch or tag
pushBranchAndOrTagGH () {
	orgAndRepo="$1"

	# nothing to do if tag already exists
	if [[ $CSV_VERSION ]] && [[ $(git ls-remote "git@github.com:$orgAndRepo" "refs/tags/$CSV_VERSION") ]] && [[ $DO_UPDATE -eq 0 ]]; then
		echo; echo -e "${blue}[WARN] https://github.com/$orgAndRepo/tree/$CSV_VERSION already exists.${norm}"
	else
		d="${orgAndRepo/\//__}"
		echo; 
		if [[ $SOURCE_BRANCH ]]; then
			if [[ "$MIDSTM_BRANCH" == "$DWNSTM_TARGET_BRANCH" ]]; then 
				echo -e "${red}[ERROR] Cannot branch if MIDSTM_BRANCH=$MIDSTM_BRANCH equals DWNSTM_TARGET_BRANCH=$DWNSTM_TARGET_BRANCH ! ${norm}"
				echo -e "${red}[ERROR] Always run this script from the rhdh-1-rhel-9 branch when creating branches${norm}"
				exit 1
			fi
			echo -e "${green}== $orgAndRepo :: branch from $SOURCE_BRANCH to $TARGET_BRANCH ==${norm}"
		elif [[ $CSV_VERSION ]]; then
			echo -e "${green}== $orgAndRepo :: tag $CSV_VERSION from $TARGET_BRANCH ==${norm}"
		fi
		# if source_branch defined and target branch doesn't exist yet, check out the source branch
		if [[ ${SOURCE_BRANCH} ]] && [[ $(git ls-remote --heads "git@github.com:${orgAndRepo}" "${TARGET_BRANCH}") == "" ]]; then
			clone_branch=${SOURCE_BRANCH}
		else # if source branch not set (tagging operation) or target branch already exists
			clone_branch=${TARGET_BRANCH}
		fi
		# echo "[DEBUG] Using clone_branch=$clone_branch ..."
		
		if [[ ! -d "$TMPDIR/projects_${d}" ]]; then
			git clone -q --depth 15 -b "${clone_branch}" "git@github.com:${orgAndRepo}" "projects_${d}" || echo "Branch $clone_branch doesn't exist: skip!"
		fi
		if [[ -d "$TMPDIR/projects_${d}" ]]; then
			pushd "$TMPDIR/projects_${d}" >/dev/null || exit 1
				export GITHUB_TOKEN="${GITHUB_TOKEN}"
				git config user.email "${MIDSTM_USER}@redhat.com"
				git config user.name "RHDH Build (${MIDSTM_USER})"
				git remote set-url origin "https://${GITHUB_TOKEN}:x-oauth-basic@github.com/${orgAndRepo}"

				git checkout --track "origin/${clone_branch}" -q 2>/dev/null || true
				git pull -q 2>/dev/null || true 

				#################################
				## if doing a branching operation
				#################################

				if [[ ${SOURCE_BRANCH} ]]; then 
					# create a branch or use existing
					git branch "${TARGET_BRANCH}" || true
					git checkout "${TARGET_BRANCH}" 2>/dev/null || true
					git pull origin "${TARGET_BRANCH}" 2>/dev/null || true

					if [[ $DO_PUSH -eq 1 ]]; then
						echo "git push origin ${TARGET_BRANCH} ..."
						git push origin "${TARGET_BRANCH}" 2>/dev/null || true
					fi

					# changes to apply to new midstream release-1.yy branch
					# https://issues.redhat.com/browse/RHIDP-1311 apply the production key to the release-1.yy stable branches, so we can use the devel key for main/CI builds
					if [[ $d == "redhat-developer__rhdh" ]]; then
						sed -i build/containerfiles/Containerfile -r \
							-e "s|(.*SEGMENT_WRITE_KEY=).*|\1$SEGMENT_WRITE_KEY|g"
						COMMITMSG="chore: switch SEGMENT_WRITE_KEY in $TARGET_BRANCH"
						git commit --no-gpg-sign -s -m "${COMMITMSG}" build/containerfiles/Containerfile || true # if no changes, continue
					# RHDHBUGS-2133: Pin RHDH image to :next-1.y tag (release-1.y branch), instead of :next (main)
					elif [[ $d == "redhat-developer__rhdh-operator" ]]; then
						for f in \
							config/profile/rhdh/default-config/deployment.yaml \
							config/profile/rhdh/patches/deployment-patch.yaml; do
							if [[ -f $f ]]; then
								sed -i "$f" -r \
									-e "s|quay.io/rhdh-community/rhdh:next|quay.io/rhdh-community/rhdh:next-${PROD_VERSION}|g"
							fi
						done
						COMMITMSG="chore: pin to quay.io/rhdh-community/rhdh:next-${PROD_VERSION}"
						git commit --no-gpg-sign -s -m "${COMMITMSG}" \
							config/profile/rhdh/default-config/deployment.yaml \
							config/profile/rhdh/patches/deployment-patch.yaml || true
					# RHDHBUGS-2133: Pin RHDH image to :next-1.y tag (release-1.y branch), instead of :next (main)
					elif [[ $d == "redhat-developer__rhdh-chart" ]]; then
						if [[ -f charts/backstage/values.yaml ]]; then
							yq -i '.upstream.backstage.image.tag = "next-'"${PROD_VERSION}"'"' charts/backstage/values.yaml
						fi
						COMMITMSG="chore: pin to quay.io/rhdh-community/rhdh:next-${PROD_VERSION}"
						git commit --no-gpg-sign -s -m "${COMMITMSG}" charts/backstage/values.yaml || true
					elif [[ $d == "redhat-developer__rhdh-local" ]]; then
						# Update both main and release-1.y branches when creating a new release branch
						echo -e "${green}[INFO] Bump $d main to next-${PROD_VERSION}${norm}"
						updateRHDHLocalVersions "main" "${PROD_VERSION}" 
						echo -e "${green}[INFO] Bump $d $TARGET_BRANCH to ${PROD_VERSION}${norm}"
						updateRHDHLocalVersions "$TARGET_BRANCH" "${PROD_VERSION}" 
					fi

					if [[ $DO_PUSH -eq 1 ]]; then 
						doPush "${TARGET_BRANCH}"
					fi
				fi

				##############################
				# if doing a tagging operation
				##############################

				if [[ $CSV_VERSION ]]; then # push a new tag (or no-op if exists)
					# RHIDP-7906 inspect the rhdh container and tag the repo based on THAT SHA, not just the latest one in the branch
					if [[ $orgAndRepo == "redhat-developer/rhdh" ]]; then
						upstream_image="registry.access.redhat.com/rhdh/rhdh-hub-rhel9:${CSV_VERSION}"
					elif [[ $orgAndRepo == "redhat-developer/rhdh-must-gather" ]]; then
						upstream_image="registry.access.redhat.com/rhdh/rhdh-must-gather-rhel9:${CSV_VERSION}"
					fi
					if [[ -n $upstream_image ]]; then
						upstream_digest=$(skopeo inspect "docker://${upstream_image}" | grep UPSTREAM | sed -r -e "s/.+ \@ ([0-9a-f]+).+/\1/")
						if [[ ! $upstream_digest ]]; then
							echo "[ERROR] Could not find commit SHA used to build ${upstream_image} !"
							exit 1
						else
							previous_sha=$(git rev-parse HEAD)
							git checkout "$upstream_digest"
							if [[ $DO_PUSH -eq 1 ]]; then
								echo "[INFO] Tag $orgAndRepo from $upstream_digest as $CSV_VERSION"
								git push origin ":${CSV_VERSION}" || true
								git tag -d "${CSV_VERSION}" || true
								git tag "${CSV_VERSION}" || true
								git push origin "${CSV_VERSION}" || { echo "Could not push tag as user $(git config user.name) <$(git config user.email)> ! Try running 'gh auth switch' to run this script as the rhdh-bot!"; exit 1; }
							fi
							# now create the floating 1.y tag too; first delete the existing one, then recreate it at the new SHA
							if [[ $DO_PUSH -eq 1 ]]; then
								echo "[INFO] Tag $orgAndRepo from $upstream_digest as ${CSV_VERSION%.*}"
								git push origin ":${CSV_VERSION%.*}" || true
								git tag -d "${CSV_VERSION%.*}" || true
								git tag "${CSV_VERSION%.*}" || true
								git push origin "${CSV_VERSION%.*}" || { echo "Could not push tag as user $(git config user.name) <$(git config user.email)> ! Try running 'gh auth switch' to run this script as the rhdh-bot!"; exit 1; }
							fi
							git checkout "$previous_sha"
						fi
					elif [[ $orgAndRepo == "redhat-developer/rhdh-cli" ]]; then
						# do not tag the rhdh-cli repo, since it releases and tags using npm processes
						true
					else
						# other repos just get a single x.y.z tag
						git tag "${CSV_VERSION}" || true
						if [[ $DO_PUSH -eq 1 ]]; then 
							git push origin "${CSV_VERSION}" || true
						fi
					fi

					# now bump TARGET_BRANCH = release-1.yy branch to x.yy.(z+1)
					getNextCSVZ "$CSV_VERSION" 
					# echo -e "${green}[INFO] Next CSV version is $CSV_VERSION_Z / $CSV_VERSION_Z_OPERATOR${norm}"
					if [[ $d == "redhat-developer__rhdh" ]]; then
						echo -e "${green}[INFO] Bump $d to $CSV_VERSION_Z${norm}" 
						updateRHDHVersions "$TARGET_BRANCH" "$CSV_VERSION_Z"
					elif [[ $d == "redhat-developer__rhdh-must-gather" ]]; then
						echo -e "${green}[INFO] Bump $d to $CSV_VERSION_Z${norm}"
						updateRHDHMustGatherVersions "$TARGET_BRANCH" "$CSV_VERSION_Z"
					elif [[ $d == "redhat-developer__rhdh-operator" ]]; then
						echo -e "${green}[INFO] Bump $d to $CSV_VERSION_Z / $CSV_VERSION_Z_OPERATOR${norm}" 
						updateOperatorVersions "$TARGET_BRANCH" "$CSV_VERSION_Z" "$CSV_VERSION_Z_OPERATOR"
					elif [[ $d == "redhat-developer__rhdh-local" ]]; then
						echo -e "${green}[INFO] Bump $d $TARGET_BRANCH to ${CSV_VERSION}${norm}"
						updateRHDHLocalVersions "$TARGET_BRANCH" "$CSV_VERSION" 
					elif [[ $d == "redhat-developer__red-hat-developers-documentation-rhdh" ]]; then
						echo -e "${green}[INFO] Bump $d to $CSV_VERSION${norm}" 
						# note: for now, only bump to the last RELEASED version in the docs
						# so use CSV_VERSION=1.1.2 here (while showcase, operator, plugins move to 1.1.3 to prepare for a future release)
						updateDocVersions "$TARGET_BRANCH" "$CSV_VERSION"
					# rhdh-cli lifecycle is handled outside of RHDH releases; eg., we're on cli 1.7.1 at the time of RHDH 1.7.0 GA
					# elif [[ $d == "redhat-developer__rhdh-cli" ]]; then
						# echo -e "${green}[INFO] Bump $d to $CSV_VERSION_Z${norm}" 
						# updateRHDHCLIVersion "$TARGET_BRANCH" "$CSV_VERSION_Z"
					else
						echo -e "${green}[INFO] No version bumps needed for $d${norm}" 
					fi
				fi

			popd >/dev/null || exit 1
		fi
	fi
}

# When branching:  when new OCP version is added in ocp-versions.yaml, generate catalogs/vX.Y/*
# and .tekton/fbc-X-YY-push.yaml. 
generateCatalogAndFBCPipeline () {

	SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
	# Load OCP version configuration from YAML file
	CONFIG_FILE="$SCRIPT_DIR/ocp-versions.yaml"
	if [[ ! -f "$CONFIG_FILE" ]]; then
			echo "OCP versions file not found: $CONFIG_FILE"
			exit 1
	fi

	OCP_VERSION_NEXT=$("$YQ" -r '.OCP_VERSION_NEXT // ""' "$CONFIG_FILE")
	OCP_LAST_VER=$("$YQ" -r '.SUPPORTED_VERSIONS[-1]' "$CONFIG_FILE")

	ver_next_minor="${OCP_VERSION_NEXT##*.}" # next version minor e.g. 22
	ver_next_dash="${OCP_VERSION_NEXT//./-}" # next version with dash e.g. 4-22
	ver_prev_minor="${OCP_LAST_VER##*.}" # last supported version minor e.g. 21
	ver_prev_dash="${OCP_LAST_VER//./-}" # last supported version with dash e.g. 4-21

	# If catalog folder for OCP_VERSION_NEXT already exists, skip
	if [[ -d "catalogs/v${OCP_VERSION_NEXT}" ]]; then
		echo " = catalogs/v${OCP_VERSION_NEXT}/ already exists; skipping catalog and FBC pipeline generation"
		return 0
	fi

	cp -r "catalogs/v${OCP_LAST_VER}" "catalogs/v${OCP_VERSION_NEXT}"
	# Update Containerfiles for the last version to use the public image
	sed -i "catalogs/v${OCP_LAST_VER}/Containerfile" \
		-e "s|FROM brew\\.registry\\.redhat\\.io/rh-osbs/openshift-ose-operator-registry-rhel9:v${OCP_LAST_VER}|FROM registry.redhat.io/openshift4/ose-operator-registry-rhel9:v${OCP_LAST_VER}|"

	sed -i "catalogs/v${OCP_VERSION_NEXT}/Containerfile" \
		-e "s|${OCP_LAST_VER//./\\.}|${OCP_VERSION_NEXT}|g"

	# Count catalog work: git diff misses untracked files (the whole new v${OCP_VERSION_NEXT}/ tree).
	if [[ -n "$(git status --porcelain -- "catalogs/v${OCP_VERSION_NEXT}/" "catalogs/v${OCP_LAST_VER}/" 2>/dev/null)" ]] || \
		[[ -n "$(git diff --name-only -- "catalogs/v${OCP_VERSION_NEXT}/" "catalogs/v${OCP_LAST_VER}/" 2>/dev/null)" ]]; then
		(( CHANGES = CHANGES + 1 ))
	fi

	if [[ -f ".tekton/fbc-4-${ver_next_minor}-push.yaml" ]]; then
		echo " = .tekton/fbc-4-${ver_next_minor}-push.yaml already exists; skipping"
	elif [[ -f ".tekton/fbc-4-${ver_prev_minor}-push.yaml" ]]; then
		echo " = create .tekton/fbc-4-${ver_next_minor}-push.yaml from fbc-4-${ver_prev_minor}-push.yaml"
		sed -e "s|${OCP_LAST_VER//./\\.}|${OCP_VERSION_NEXT}|g" -e "s|${ver_prev_dash}|${ver_next_dash}|g" ".tekton/fbc-4-${ver_prev_minor}-push.yaml" > ".tekton/fbc-4-${ver_next_minor}-push.yaml"
		(( CHANGES = CHANGES + 1 ))
	else
		echo " = .tekton/fbc-4-${ver_prev_minor}-push.yaml not found; skipping creation of .tekton/fbc-4-${ver_next_minor}-push.yaml"
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
		echo; echo -e "${blue}[WARN] https://gitlab.cee.redhat.com/rhidp/${d}/-/tree/${CSV_VERSION}?ref_type=tags already exists.${norm}"
	else
		# convert release-1.4 to rhdh-1.4-rhel-9
		DWNSTM_TARGET_BRANCH=rhdh-${TARGET_BRANCH/release-/}-rhel-9
		echo;
		if [[ $SOURCE_BRANCH ]]; then
			if [[ "$MIDSTM_BRANCH" == "$DWNSTM_TARGET_BRANCH" ]]; then 
				echo -e "${red}[ERROR] Cannot branch if MIDSTM_BRANCH=$MIDSTM_BRANCH equals DWNSTM_TARGET_BRANCH=$DWNSTM_TARGET_BRANCH ! ${norm}"
				echo -e "${red}[ERROR] Always run this script from the rhdh-1-rhel-9 branch when creating branches${norm}"
				exit 1
			fi
			echo "== $d :: branch from $MIDSTM_BRANCH to $DWNSTM_TARGET_BRANCH =="
		elif [[ $CSV_VERSION ]]; then
			echo "== $d :: tag $CSV_VERSION from $DWNSTM_TARGET_BRANCH =="
		fi
		if [[ ! -d "$TMPDIR/gitlab_${d}" ]]; then
			git clone -q --depth 1 -b "${DWNSTM_TARGET_BRANCH}" "git@gitlab.cee.redhat.com:rhidp/${d}.git" "gitlab_${d}" || \
			git clone -q --depth 1 -b "${MIDSTM_BRANCH}" "git@gitlab.cee.redhat.com:rhidp/${d}.git" "gitlab_${d}" || \
			echo "Branch $MIDSTM_BRANCH doesn't exist: skip!"
		fi
		if [[ -d "$TMPDIR/gitlab_${d}" ]]; then
			pushd "$TMPDIR/gitlab_${d}" >/dev/null || exit 1
				git config user.email "${MIDSTM_USER}@redhat.com"
				git config user.name "RHDH Build (${MIDSTM_USER})"
				if [[ $(git rev-parse --abbrev-ref HEAD 2>/dev/null || true) == "$DWNSTM_TARGET_BRANCH" ]]; then #if already on 1.y branch
					echo "Update existing branch $DWNSTM_TARGET_BRANCH"
				else 
					git checkout --track origin/"${MIDSTM_BRANCH}" -q 2>/dev/null || true
					git pull -q 2>/dev/null || true
				fi
				if [[ ${SOURCE_BRANCH} ]]; then 
					if [[ $(git rev-parse --abbrev-ref HEAD 2>/dev/null || true) != "$DWNSTM_TARGET_BRANCH" ]]; then # if not already on 1.y branch
						# create a branch or use existing
						git branch --set-upstream-to="origin/${DWNSTM_TARGET_BRANCH}" "${DWNSTM_TARGET_BRANCH}" || git branch "${DWNSTM_TARGET_BRANCH}" || true
						git checkout --track origin/"${DWNSTM_TARGET_BRANCH}" 1>/dev/null || git checkout "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
						# echo "[DEBUG] Currently in branch $(git rev-parse --abbrev-ref HEAD); expecting ${DWNSTM_TARGET_BRANCH}"
						git pull origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
						git push origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
					fi

					if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] For SOURCE_BRANCH=$SOURCE_BRANCH, working in $TMPDIR/gitlab_${d} branch DWNSTM_TARGET_BRANCH=$DWNSTM_TARGET_BRANCH"; fi

					# changes to apply to new midstream rhdh-1.yy-rhel-9 branch
					CHANGES=0
					if [[ $d == "rhdh" ]]; then # for rhidp/rhdh
						pushd "$TMPDIR/gitlab_${d}/.tekton" >/dev/null || exit 1
							"${SCRIPT_DIR}/../../.tekton/generatePipelineRuns.sh" -t "${TARGET_BRANCH/release-/}" # 1.y rhdh-1.y-rhel-9
						popd >/dev/null || exit 1
						if [[ $(git diff --name-only -- .tekton/) != "" ]]; then 
							(( CHANGES = CHANGES + 1 ))
							git add .tekton/* || true
						fi

						# in new 1.y branch, switch from next tags to latest tags
						# TODO how do we remove latest tags 3mo later for older streams?
						echo " = update FBCs in $DWNSTM_TARGET_BRANCH to latest"
						pushd "$TMPDIR/gitlab_${d}/catalogs" >/dev/null || exit 1
							for c in */Containerfile; do 
								echo " > $c"
								sed -i "$c" -r \
									-e "s@next-v4@latest-v4@g"
							done
							if [[ $(git diff --name-only -- catalogs/) != "" ]]; then (( CHANGES = CHANGES + 1 )); fi
							COMMITMSG="chore: tagRelease.sh: update FBCs in $DWNSTM_TARGET_BRANCH to latest"					
							git commit --no-gpg-sign -s -m "${COMMITMSG}" . || echo "nothing to commit, working tree clean (4)"

						popd >/dev/null || exit 1

						# Update plugin-catalog-builder base image tag to new PROD_VERSION
						cf="build/containerfiles/builder.Containerfile"
						if [[ -f "$cf" ]]; then
							echo " = update plugin-catalog-builder base image to ${PROD_VERSION} in $(basename "$cf")"
							sed -i "$cf" -r \
								-e "s|(FROM quay.io/rhdh/plugin-catalog-builder-rhel9:)[0-9.]+|\\1${PROD_VERSION}|"
							if [[ $(git diff --name-only -- build/containerfiles/builder.Containerfile) != "" ]]; then (( CHANGES = CHANGES + 1 )); fi
						fi

						generateCatalogAndFBCPipeline

						sed -i upstream_repos.yml -r \
							-e "s|- main|- ${TARGET_BRANCH}|g"
						if [[ $(git diff --name-only -- upstream_repos.yml) != "" ]]; then (( CHANGES = CHANGES + 1 )); fi
						if [[ $CHANGES -gt 0 ]]; then 
							rm -f sync/*
						fi
					elif [[ $d == "rhdh-plugin-catalog" ]]; then # for rhidp/rhdh-plugin-catalog
						# generate new tekton pipelines for plugin-catalog-builder only
						pushd "$TMPDIR/gitlab_${d}/.tekton" >/dev/null || exit 1
							generateNewTektonPipelines "${TARGET_BRANCH/release-/}" "$DWNSTM_TARGET_BRANCH" "plugin-catalog-builder"
							generateNewTektonPipelines "${TARGET_BRANCH/release-/}" "$DWNSTM_TARGET_BRANCH" "oci-plugin-build-pipeline"
						popd >/dev/null || exit 1
						if [[ $(git diff --name-only -- .tekton/) != "" ]]; then 
							(( CHANGES = CHANGES + 1 ))
							git add .tekton/* || true
						fi

						# update upstream_repos.yml to use release-1.y
						$YQ '.repos[0].branch[0]|="'"$TARGET_BRANCH"'"' -i "upstream_repos.yml"
						# TODO remove this when we no longer need to fetch catalog entities from rhd/rhdh repo.
						$YQ '.repos[1].branch[0]|="'"$TARGET_BRANCH"'"' -i "upstream_repos.yml"
						if [[ $(git diff --name-only -- upstream_repos.yml) != "" ]]; then (( CHANGES = CHANGES + 1 )); fi
					fi
					if [[ $d == "rhdh" ]] || [[ $d == "rhdh-plugin-catalog" ]]; then 
						if [[ $d == "rhdh" ]]; then
							COMMITMSG="chore: tagRelease.sh: use $TARGET_BRANCH in upstream_repos.yml; update builder.Cotnainerfile to ${PROD_VERSION}; add OCP_VERSION_NEXT catalog and FBC pipeline; trigger rhdh build"
							git commit --no-gpg-sign -s -m "${COMMITMSG}" .tekton/ sync/ upstream_repos.yml catalogs/ || echo "nothing to commit, working tree clean (5a)"
						elif [[ $d == "rhdh-plugin-catalog" ]]; then
							COMMITMSG="chore: tagRelease.sh: use $TARGET_BRANCH in upstream_repos.yml"
							git commit --no-gpg-sign -s -m "${COMMITMSG}" .tekton/ upstream_repos.yml build/containerfiles/builder.Containerfile || echo "nothing to commit, working tree clean (5b)"
						fi
					fi

					if [[ $DO_PUSH -eq 1 ]]; then
						if [[ $CHANGES -gt 0 ]]; then 
							git push origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null 2>&1  || true
							doPush "${DWNSTM_TARGET_BRANCH}"
						fi
					else
						echo "Updated files are in $TMPDIR/gitlab_${d}/ -- commit and push them manually"
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

# update the RPA to provide a semver tag
updateKonfluxReleasePlanAdmissionYamls ()
{
	repo=konflux-release-data
	getNextCSVZ "$CSV_VERSION"
	echo; echo "== $repo :: bump $KFUX_VERSION RPAs to $CSV_VERSION_Z  =="

	pushd "$TMPDIR" >/dev/null || exit 1
	# fetch repo
	if [[ -d "${repo}" ]]; then rm -fr "${repo}"; fi
	git clone -q --depth 1 -b main "git@gitlab.cee.redhat.com:releng/${repo}.git" "${repo}"
	if [[ -d "$TMPDIR/${repo}" ]]; then
		pushd "$TMPDIR/${repo}/config/stone-prod-p02.hjvn.p1/product/ReleasePlanAdmission/rhdh" >/dev/null || exit 1
		# adjust the rhdh-1-y-prod.yaml and rhdh-1-y-stage.yaml files to use a semver tag instead of 1.y-timestamp

		RPA_FILES=(
			"rhdh-${KFUX_VERSION}-prod.yaml"
			"rhdh-${KFUX_VERSION}-stage.yaml"
		)
		# rhdh-plugin-catalog-* RPAs exist only for streams newer than 1.8 (KFUX_VERSION minor > 8)
		if [[ ${KFUX_VERSION#*-} -gt 8 ]] || [[ ${KFUX_VERSION%-*} -gt 1 ]]; then # support 1.9, 1.10 and 2+
			RPA_FILES+=(
				"rhdh-plugin-catalog-${KFUX_VERSION}-prod.yaml"
				"rhdh-plugin-catalog-${KFUX_VERSION}-stage.yaml"
			)
		fi

		#### NOTE THIS REQUIRES mikefarah's yq (which we have in the helm folder)
		#### The python yq wrapper for jq does not preserve comments (because json has no comments)
		for f in "${RPA_FILES[@]}"; do
			"$YQ" e '.spec.data.mapping.defaults.tags[1]|="'"$CSV_VERSION_Z"'"' -i "$f"
			# also add a timestamped tag for prod sec - RHIDP-6721
			"$YQ" e '.spec.data.mapping.defaults.tags[2]|="'"$CSV_VERSION_Z"'-{{ timestamp }}"' -i "$f"
			if [[ $f == rhdh-plugin-catalog-* ]]; then
				# replace "1.9.0" or  "1.9.0-- with "1.9.1 or  "1.9.1--
				sed -i "$f" -r \
					-e "s/\"(${KFUX_VERSION}\.[0-9]+)(\"|--)/\"$CSV_VERSION_Z\2/"
			fi
		done
		COMMITMSG="chore: update rhdh-$KFUX_VERSION-*.yaml RPAs for upcoming release $CSV_VERSION_Z"
		if [[ ${DO_PUSH} -eq 1 ]]; then
			# submit a MR
			# shellcheck disable=SC2068
			git commit --no-gpg-sign -s -m "${COMMITMSG}" ${RPA_FILES[@]}
			doPush "main"
		else
			echo "$COMMITMSG"
			git diff || true
		fi
		popd  >/dev/null || exit 1
	fi
	popd  >/dev/null || exit 1
}

# update the prodsec/product-definitions for a new release stream, and remove obsolete ones
updateProdsecDefinitions ()
{
	repo=product-definitions
	local TYPE="$1" # either for a new branch, or when tagging for a .0 GA

	# if adding 1.10, then delete 1.7, keep 1.8 and 1.9 in moderate_ps_update_streams, add 1.10
	if [[ $PROD_VERSION =~ ^([0-9]+)\.([0-9]+) ]]; then # decrease the y digit by 3 for deletion; by 1 and 2 for moderate streams
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]} # e.g. 10
		(( YY=YY-1 ))
		PROD_VERSION_PREV="$XX.$YY"   # e.g. 1.9 (previous GA, stays in default, active and moderate)
		(( YY=YY-1 ))
		PROD_VERSION_PREV2="$XX.$YY"   # e.g. 1.8 (previous GA, stays in default, active and moderate... until we do a GA for 1.10)
	fi

	COMMITMSG="$PROD_VERSION: set $PROD_VERSION_PREV, $PROD_VERSION for default, active and moderate configs"
	if [[ $TYPE == "branch" ]]; then # for branching operations
		COMMITMSG="$PROD_VERSION: set $PROD_VERSION_PREV2, $PROD_VERSION_PREV, $PROD_VERSION for default, active and moderate configs"
	elif [[ $TYPE == *".0" ]]; then # for .0 tagging operations
		COMMITMSG="$PROD_VERSION: set $PROD_VERSION_PREV, $PROD_VERSION for default, active and moderate configs"
	fi
	echo; echo "== $repo :: generate Prod Sec yaml for RHDH $COMMITMSG =="

	pushd "$TMPDIR" >/dev/null || exit 1
	# fetch repo
	if [[ ! -d "${repo}" ]]; then 
		if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] Clone prodsec/$repo ..."; fi
		git clone -q -b master "git@gitlab.cee.redhat.com:prodsec/${repo}.git" "${repo}"
	fi
	if [[ -d "$TMPDIR/${repo}" ]]; then
		echo
		pushd "$TMPDIR/${repo}" >/dev/null || exit 1
			if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] Working dir: $(pwd)" ;fi

			NEW_STREAM='{ "pp_label": "rhdh-rhdh-'"${PROD_VERSION}"'", "version": "'"${PROD_VERSION}.0"'", "cpe": [ "cpe:/a:redhat:rhdh:'"${PROD_VERSION}"'::el9" ] }'

			# TODO need custom rules when the version after 1.10 is 2.0, so that we keep 1.10 around longer
			NEW_KEY="rhdh-${PROD_VERSION}"         # new key,     e.g. rhdh-1.10
			PREV_KEY="rhdh-${PROD_VERSION_PREV}"   # previous GA  e.g. rhdh-1.9
			PREV2_KEY="rhdh-${PROD_VERSION_PREV2}"   # previous GA  e.g. rhdh-1.8

		  # set -x
			jq --arg NEW_KEY "${NEW_KEY}" --arg NEW_STREAM "${NEW_STREAM}" '.ps_update_streams."'"$NEW_KEY"'" += '"$NEW_STREAM" \
				data/developer/ps_update_streams/rhdh.json > data/developer/ps_update_streams/rhdh.json_; mv data/developer/ps_update_streams/rhdh.json{_,}

			ARR_KEY="ps_update_streams"
			jq --arg ARR_KEY "${ARR_KEY}" --arg NEW_KEY "${NEW_KEY}" \
				'.["ps_modules"]["rhdh-1"][$ARR_KEY] |= (. + [$NEW_KEY] | reduce .[] as $x ([]; . as $acc | if ($acc | index($x)) != null then $acc else $acc + [$x] end))' \
				data/developer/ps_modules.json > data/developer/ps_modules.json_; mv data/developer/ps_modules.json{_,}

			if [[ $TYPE == "branch" ]]; then # for branching operations
				# set to current and 2 previous streams (e.g. rhdh-1.8, rhdh-1.9, rhdh-1.10) when branching for 1.10
				for ARR_KEY in active_ps_update_streams default_ps_update_streams moderate_ps_update_streams; do
					jq --arg ARR_KEY "${ARR_KEY}"  --arg PREV2_KEY "${PREV2_KEY}" --arg PREV_KEY "${PREV_KEY}" --arg NEW_KEY "${NEW_KEY}" \
						'.["ps_modules"]["rhdh-1"][$ARR_KEY] |= [$PREV2_KEY, $PREV_KEY, $NEW_KEY]' \
						data/developer/ps_modules.json > data/developer/ps_modules.json_; mv data/developer/ps_modules.json{_,}
				done
			elif [[ $TYPE == *".0" ]]; then # for .0 tagging operations
				# set to current and previous stream only (e.g. rhdh-1.8, rhdh-1.9)
				for ARR_KEY in active_ps_update_streams default_ps_update_streams moderate_ps_update_streams; do
					jq --arg ARR_KEY "${ARR_KEY}"  --arg PREV_KEY "${PREV_KEY}" --arg NEW_KEY "${NEW_KEY}" \
						'.["ps_modules"]["rhdh-1"][$ARR_KEY] |= [$PREV_KEY, $NEW_KEY]' \
						data/developer/ps_modules.json > data/developer/ps_modules.json_; mv data/developer/ps_modules.json{_,}
				done
			fi

		  # set +x
			git add data/developer/

			# commit changes 
			COMMITMSG="chore(rhdh): for $COMMITMSG"
			if [[ ${DO_PUSH} -eq 1 ]]; then
				# submit a MR
				git commit --no-gpg-sign -s -m "${COMMITMSG}" data/developer/
				set -x
				doPush "master"
				set +x
			else
				echo "$COMMITMSG"
				git diff || true
			fi
		popd >/dev/null || exit 1
	fi
	popd >/dev/null || exit 1
}

# Remove FBC files for OCP versions that are no longer supported
removeUnsupportedFBC() {
	local FBC_PATH="tenants-config/cluster/stone-prod-p02/tenants/rhdh-tenant/fbc"
	local OCP_VERSIONS_FILE="${SCRIPT_DIR}/ocp-versions.yaml"
	
	# Extract unsupported versions
	local UNSUPPORTED_VERSIONS_ARRAY=()
	while IFS= read -r version; do
		version=$(echo "$version" | tr -d '"')
		[[ -n "$version" ]] && UNSUPPORTED_VERSIONS_ARRAY+=("$version")
	done < <(yq '.UNSUPPORTED_VERSIONS[]' "$OCP_VERSIONS_FILE" 2>/dev/null || echo "")
	
	if [[ ${#UNSUPPORTED_VERSIONS_ARRAY[@]} -eq 0 ]]; then
		echo -e "${green}[INFO] No unsupported OCP versions found in $OCP_VERSIONS_FILE${norm}"
		return 0
	fi
	
	pushd "$FBC_PATH" >/dev/null || exit 1
	
	for unsupported_version in "${UNSUPPORTED_VERSIONS_ARRAY[@]}"; do
		verdash="${unsupported_version//./-}"
		if [[ -f "fbc-${verdash}.yaml" ]]; then
			echo "[INFO] removing FBC file for unsupported OCP version: fbc-${verdash}.yaml"
			git rm -f "fbc-${verdash}.yaml"
		fi
		sed -r -i kustomization.yaml -e "/  - fbc-${verdash}.yaml/d"
	done

	popd >/dev/null || exit 1
}

# update the konflux-release-data for a new branch: create new application, components, RPAs, RPs, etc. and remove fbc files for unsupported OCP versions
generateNewKonfluxReleaseDataYamls ()
{
	repo=konflux-release-data

	if [[ $PROD_VERSION =~ ^([0-9]+)\.([0-9]+) ]]; then # decrease the y digit
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]}
		(( YY=YY-1 ))
		PROD_VERSION_PREV="$XX.$YY"
		(( YY=YY-2 ))
		KFUX_VERSION_DEAD="$XX-$YY"
	fi

	echo; echo "== $repo :: generate Konflux $KFUX_VERSION yaml for RHDH $PROD_VERSION (based on $PROD_VERSION_PREV config; delete $KFUX_VERSION_DEAD) =="

	pushd "$TMPDIR" >/dev/null || exit 1
	# fetch repo
	if [[ ! -d "${repo}" ]]; then 
		if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] Clone releng/$repo ..."; fi
		git clone -q --depth 1 -b main "git@gitlab.cee.redhat.com:releng/${repo}.git" "${repo}"
	fi
	if [[ -d "$TMPDIR/${repo}" ]]; then
		echo
		pushd "$TMPDIR/${repo}" >/dev/null || exit 1
		if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] Working dir: $(pwd)" ;fi

			# 1. create content in config and tenants-config folders, including three kustomization.yaml files
			for d in \
				config/stone-prod-p02.hjvn.p1/product/ReleasePlanAdmission/rhdh/ \
				tenants-config/cluster/stone-prod-p02/tenants/rhdh-tenant \
				tenants-config/cluster/stone-prod-p02/tenants/rhdh-tenant/components \
				tenants-config/cluster/stone-prod-p02/tenants/rhdh-tenant/release-plans; do
				for f in $(find $d -maxdepth 1 -type f -name "*${PROD_VERSION_PREV/./-}*" | sort -uV); do # find the previous files
					g=$(echo "$f" | sed -r -e "s@${PROD_VERSION_PREV/./-}@${KFUX_VERSION}@")
					echo "Convert $f to ${g##*/} ..."
					cp "$f" "$g"
					sed -i "$g" -r \
						-e "s@-${PROD_VERSION_PREV/./-}@-${KFUX_VERSION}@g" \
						-e "s@Hub ${PROD_VERSION_PREV//./\\.}@Hub ${PROD_VERSION}@g" \
						-e "s@rhdh-${PROD_VERSION_PREV//./\\.}@rhdh-${PROD_VERSION}@g" \
						-e "s@\"${PROD_VERSION_PREV//./\\.}\"@\"${PROD_VERSION}\"@g" \
						-e "s@\"${PROD_VERSION_PREV//./\\.}\.([1-9]+)\"@\"${PROD_VERSION}.0\"@g" \
					# append into kustomization file
					if [[ -f $d/kustomization.yaml ]]; then 
						echo "   Edit $d/kustomization.yaml ..."
						sed -i "$d/kustomization.yaml" -r \
							-e "/-${KFUX_VERSION_DEAD}\.yaml/d" \
							-e "/-${KFUX_VERSION_DEAD}-.+\.yaml/d"
						"$YQ" e '.resources[.resources|length]|="'"${g##*/}"'"|.resources = (.resources | sort | unique)' \
							-i "$d/kustomization.yaml"
					fi
				done
				for f in $(find $d -maxdepth 1 -type f -name "*${KFUX_VERSION_DEAD}*" | sort -uV); do # find the deleteable files
					echo " Delete $f ..."
					git rm -f "$f" >/dev/null || rm -f "$f"
				done
			done

			pushd config/stone-prod-p02.hjvn.p1/product/ReleasePlanAdmission/rhdh/ >/dev/null || exit 1
			#### NOTE THIS REQUIRES mikefarah's yq (which we have in the helm folder)
			#### The python yq wrapper for jq does not preserve comments (because json has no comments)
			for f in "rhdh-${KFUX_VERSION}-prod.yaml" "rhdh-${KFUX_VERSION}-stage.yaml"; do
				# replace timestamped tag for prod sec
				"$YQ" e '.spec.data.mapping.defaults.tags[2]|="'"${PROD_VERSION}.0"'-{{ timestamp }}"' -i "$f"
			done
			popd >/dev/null || exit 1

			# 2. Remove fbc files for unsupported OCP versions
			removeUnsupportedFBC

			# 3. auto-generate content
			pushd "$TMPDIR/${repo}/tenants-config" >/dev/null || exit 1
				./build-single.sh rhdh
			popd >/dev/null || exit 1
			echo 
			git add config/stone-prod-p02.hjvn.p1/product/ReleasePlanAdmission/rhdh/ tenants-config/cluster/stone-prod-p02/tenants/rhdh-tenant tenants-config/auto-generated/cluster/stone-prod-p02/tenants/rhdh-tenant

			# commit changes 
			COMMITMSG="chore: add new applications, components, RPs, RPAs for upcoming release RHDH $PROD_VERSION and remove unsupported OCP versions"
			if [[ ${DO_PUSH} -eq 1 ]]; then
				# submit a MR
				git commit --no-gpg-sign -s -m "${COMMITMSG}" config/ tenants-config/
				doPush "main"
			else
				echo "$COMMITMSG"
				git diff || true
			fi
		popd >/dev/null || exit 1
	fi
	popd >/dev/null || exit 1

	echo; echo "== $repo :: MR generated for Konflux $KFUX_VERSION yaml for RHDH $PROD_VERSION. NOTE: new CPE MR for prodsec/product-definitions MUST BE MERGED or this MR will fail!  =="
}

# create new pipelines based on the rhdh-1 versions; rename and do sed replacements
generateNewTektonPipelines ()
{
	xdashy=$1; xdashy=${xdashy/./-} # 1-5
	branchy=$2                       # rhdh-1.5-rhel-9
	regex="$3"
	# rename the -1- files to -1.y-
	# update them to replace -1- with -1-y- and rhdh-1-rhel-9 with rhdh-1.y-rhel-9
	echo " = generate new piplines in $(pwd) for $branchy ($xdashy)"
	for y in "${regex}"*.yaml; do
		if [[ $y == *"-1-"* ]]; then # rename rhdh pipelines
			e="$(echo "$y" | sed -r \
				-e "s@-1-([a-z]+)@-${xdashy}-\1@g")"
			if [[ "$e" != "$y" ]]; then
				if [[ $VERBOSE -eq 1 ]]; then echo -n ">> $y"; fi
				git mv "$y" "$e"
				y="${e}"
			fi
		fi
		echo " > $y"
		sed -i "$y" -r \
			-e "s@rhdh-1-rhel-9@${branchy}@g" \
			-e "s@-1-([a-z]+)@-${xdashy}-\1@g" \
			-e "s@${xdashy}-next@${xdashy}@g" \
			-e "s/(application: (rhdh-plugin-catalog-1|rhdh-1))$/\1-${xdashy}/" \
			-e "s/(component: (plugin-catalog-builder-|rhdh-)[a-z-]+)-1$/\1-${xdashy}/"
	done
}

function updateFBCVersions() {
	if [[ $PROD_VERSION =~ ^([0-9]+)\.([0-9]+) ]]; then # decrease the y digit by 3
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]}
		(( YY=YY+1 ))
		PROD_VERSION_NEXTY="$XX.$YY"
	fi
	echo "= update FBCs in $MIDSTM_BRANCH to $PROD_VERSION_NEXTY"
	d="rhdh"
	if [[ -d "$TMPDIR/gitlab_${d}" ]]; then rm -fr "$TMPDIR/gitlab_${d}"; fi
	git clone -q --depth 1 -b "${MIDSTM_BRANCH}" "git@gitlab.cee.redhat.com:rhidp/${d}.git" "gitlab_${d}" || \
		{ echo "ERROR: Branch $MIDSTM_BRANCH doesn't exist: fail!"; exit 1; }
	pushd "$TMPDIR/gitlab_${d}" >/dev/null || exit 1
		git checkout --track origin/"${MIDSTM_BRANCH}" -q 2>/dev/null || true
		git pull -q 2>/dev/null || true
		pushd "$TMPDIR/gitlab_${d}/catalogs" >/dev/null || exit 1
			for c in */Containerfile; do 
				echo " > $c"
				sed -i "$c" -r \
					-e "s@$PROD_VERSION-v@$PROD_VERSION_NEXTY-v@g"  \
					-e "s@fast-$PROD_VERSION@fast-$PROD_VERSION_NEXTY@g"
			done
			COMMITMSG="chore: tagRelease.sh: update FBCs in $MIDSTM_BRANCH to $PROD_VERSION_NEXTY"
			git commit --no-gpg-sign -s -m "${COMMITMSG}" . || echo "nothing to commit, working tree clean (2)"
			if [[ $DO_PUSH -eq 1 ]]; then
				if [[ $(git diff --name-only HEAD~1 2>/dev/null || true) ]]; then 
					git push origin "${MIDSTM_BRANCH}" 1>/dev/null 2>&1  || true
					doPush "${MIDSTM_BRANCH}"
				else 
					echo "nothing to commit, working tree clean (3)"
				fi
			else
				echo "Updated files are in $TMPDIR/gitlab_${d}/ -- commit and push them manually"
			fi
		popd >/dev/null || exit 1
	popd >/dev/null || exit 1
}

# when creating a new branch, update the Pyxis Config to add any new plugins + release streams (1.5, 1.6, 1.7)
function generatePyxisConfigForPlugins() {
	the_branch="rhdh-1-rhel-9"
	if [[ ! "$pluginBuildsJson" ]] || [[ ! -d "$pluginBuildsJson" ]]; then pluginBuildsJson="$(pwd)/plugin_builds/"; fi
	orgAndRepo="rhidp/rhdh-plugin-catalog"
	local keepcount="$1"
	local operation="$2"
	d="${orgAndRepo/\//__}"
	
	rm -fr "$TMPDIR/projects_${d}" && git clone -q --depth 1 -b "${the_branch}" "git@gitlab.cee.redhat.com:${orgAndRepo}" "$TMPDIR/projects_${d}" || echo "Branch $the_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}" >/dev/null || exit 1
	./build/scripts/generatePyxisConfigForPlugins.sh -f "${pluginBuildsJson}" -v "${PROD_VERSION}.0" --keep "$keepcount" "$operation"
	popd >/dev/null || exit 1
}

# when creating a new branch, update the Konflux release data to add any new plugins and plugin catalog index; requires that the above PR is merged first!
function generateKonfluxReleaseDataForPlugins() {
	the_branch="rhdh-1-rhel-9"
	if [[ ! "$pluginBuildsJson" ]] || [[ ! -d "$pluginBuildsJson" ]]; then pluginBuildsJson="$(pwd)/plugin_builds/"; fi
	orgAndRepo="rhidp/rhdh-plugin-catalog"
	d="${orgAndRepo/\//__}"
	
	rm -fr "$TMPDIR/projects_${d}" && git clone -q --depth 1 -b "${the_branch}" "git@gitlab.cee.redhat.com:${orgAndRepo}" "$TMPDIR/projects_${d}" || echo "Branch $the_branch doesn't exist: skip!"
	pushd "$TMPDIR/projects_${d}" >/dev/null || exit 1
	./build/scripts/generateKonfluxReleaseDataForPlugins.sh -f "${pluginBuildsJson}" -v "${PROD_VERSION}.0"
	popd >/dev/null || exit 1
}

####################################

getXYplusOneFromBranch "$TARGET_BRANCH"
# eg., for 1.2.2 get 1.2.3 (showcase repo, RHDH CSV), 0.2.3 (operator repo, upstream CSV)
# echo "newver = $newver; newverOp = $newverOp"

############
# UPSTREAM 
############

# branch and/or tag GH repos
if [[ $SKIP_GH -eq 0 ]]; then
	echo "  ## ## ## Processing Github Repos ... ## ## ## "
	for repo in $GH_REPOS \
		; do
		pushBranchAndOrTagGH "$repo"
	done
	echo "  ## ## ## Processing Github Repos done! ## ## ## "
fi

# ###################################################################################################

# now update main branches for the above branch creation
if [[ $SKIP_GH -eq 0 ]]; then
	if [[ ${SOURCE_BRANCH} ]]; then
		echo "  ## ## ## Processing Github Repos (main branch) ... ## ## ## "
		# check for changes and push a PR for each repo
		updateRHDHCLIVersion "$SOURCE_BRANCH" "$newver"
		updateOperatorVersions "$SOURCE_BRANCH" "$newver" "$newverOp"
		updateRHDHVersions "$SOURCE_BRANCH" "$newver"
		updateRHDHMustGatherVersions "$SOURCE_BRANCH" "$newver"
		updateChartVersions "$SOURCE_BRANCH" "$newver"
		## CCS has requested that we not bump the version in main branch, as they prefer manual steps to automation.
		## updateDocVersions "$SOURCE_BRANCH" "$newver"
		echo "  ## ## ## Processing Github Repos (main branch) done! ## ## ## "
	fi
fi

# ############
# MIDSTREAM 
# ############

# for operator, bump to specified version
function removeOperatorBundleLatestTags() {
	if [[ $PROD_VERSION =~ ^([0-9]+)\.([0-9]+) ]]; then # decrease the y digit
		XX=${BASH_REMATCH[1]}
		YY=${BASH_REMATCH[2]}
		(( YY=YY-1 ))
		PROD_VERSION_PREV="$XX.$YY"
	fi
	MIDSTM_BRANCH_PREV="rhdh-${PROD_VERSION_PREV}-rhel-9"
	echo "= remove latest tags from Containerfiles in ${MIDSTM_BRANCH_PREV} branch"
	d="rhdh"
	if [[ -d "$TMPDIR/gitlab_${d}" ]]; then rm -fr "$TMPDIR/gitlab_${d}"; fi
	git clone -q --depth 1 -b "${MIDSTM_BRANCH_PREV}" "git@gitlab.cee.redhat.com:rhidp/${d}.git" "gitlab_${d}" || \
		{ echo "ERROR: Branch $MIDSTM_BRANCH_PREV doesn't exist: fail!"; exit 1; }
	pushd "$TMPDIR/gitlab_${d}" >/dev/null || exit 1
		git checkout --track origin/"${MIDSTM_BRANCH_PREV}" -q 2>/dev/null || true
		git pull -q 2>/dev/null || true
		pushd "$TMPDIR/gitlab_${d}/distgit/containers/" >/dev/null || exit 1
			for c in */Containerfile; do 
				echo " > $c"
				sed -i "$c" -r \
					-e "/konflux.additional-tags/ s/latest, //"
			done
			COMMITMSG="chore: tagRelease.sh: remove latest tags from Containerfiles in ${MIDSTM_BRANCH_PREV} branch"
			git commit --no-gpg-sign -s -m "${COMMITMSG}" . || echo "nothing to commit, working tree clean (7)"
			if [[ $DO_PUSH -eq 1 ]]; then
				if [[ $(git diff --name-only HEAD~1 2>/dev/null || true) ]]; then 
					git push origin "${MIDSTM_BRANCH_PREV}" 1>/dev/null 2>&1  || true
					doPush "${MIDSTM_BRANCH_PREV}"
				else 
					echo "nothing to commit, working tree clean (8)"
				fi
			else
				echo "Updated files are in $TMPDIR/gitlab_${d}/ -- commit and push them manually"
			fi
		popd >/dev/null || exit 1
	popd >/dev/null || exit 1
}

# echo "SKIPS: $SKIP_GL"
# branch or tag GL repo(s)
if [[ $SKIP_GL -eq 0 ]] && [[ "${MIDSTM_BRANCH}" ]]; then
	echo "  ## ## ## Processing Gitlab Repos ... ## ## ## "
	for repo in \
		$GL_REPOS \
		; do
		pushTagGL $repo
		# updates to 1.x branch after branching
		if [[ ! $CSV_VERSION ]] && [[ $repo == "rhdh" ]]; then
			echo "Update existing branch $MIDSTM_BRANCH" 
			updateFBCVersions
			removeOperatorBundleLatestTags 
		fi
	done
	echo "  ## ## ## Processing Gitlab Repos done! ## ## ## "
fi

# for tagging
if [[ $CSV_VERSION ]] && [[ "${MIDSTM_BRANCH}" ]]; then
	# only on release of a .0 GA do we remove the -2 version (eg., when 1.10 is live,, remove 1.8)
	if [[ $SKIP_PRODSEC -eq 0 ]] && [[ $CSV_VERSION == *".0" ]]; then
		echo "  ## ## ## Processing Prodsec Repo ... ## ## ## "
		updateProdsecDefinitions "$CSV_VERSION"
		echo "  ## ## ## Processing Prodsec Repo done! ## ## ## "
	fi

	if [[ $SKIP_PYXIS -eq 0 ]] && [[ $CSV_VERSION == *".0" ]]; then
		echo "  ## ## ## Processing Pyxis Repo ... ## ## ## "
		if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] update the Pyxis Repo Configs repo to add new plugins"; fi
		
		echo "[INFO] pyxis-repo-configs merge requests may fail if there are required changes to this repo:"
		echo "       * https://gitlab.cee.redhat.com/prodsec/product-definitions/-/merge_requests/ (new RHDH version)"
		# this will also reduce the cert-manager-releases list to keep only the new version (1.10) + 1 previous ones (1.9) as 1.8 is now EOL
		generatePyxisConfigForPlugins 2 "--tag"
		echo "  ## ## ## Processing Pyxis Repo done! ## ## ## "
	fi

	if [[ $SKIP_KRD -eq 0 ]]; then
		# midstream konflux-release-data sources - bump the RPA to 1.y.z
		echo "  ## ## ## Processing Konflux Release Data Repo (RPAs) ... ## ## ## "
		updateKonfluxReleasePlanAdmissionYamls
		echo "  ## ## ## Processing Konflux Release Data Repo (RPAs) done! ## ## ## "
		# TODO should we also run generatePyxisConfigForPlugins after tagging, 
		# or when preparing an RC?
	fi
fi

# for branching - create everything at version 1.y.0
if [[ ! $CSV_VERSION ]]; then
	if [[ $SKIP_PYXIS -eq 0 ]] || [[ $SKIP_PRODSEC -eq 0 ]] || [[ $SKIP_KRD -eq 0 ]]; then
		if [[ $SKIP_PRODSEC -eq 0 ]]; then
			echo "  ## ## ## Processing Prodsec Repo ... ## ## ## "
			updateProdsecDefinitions "branch"
			echo "  ## ## ## Processing Prodsec Repo done! ## ## ## "
		fi
		
		if [[ $SKIP_PYXIS -eq 0 ]]; then
			echo "  ## ## ## Processing Pyxis Repo ... ## ## ## "
			if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] update the Pyxis Repo Configs repo to add new plugins"; fi
			
			echo "[INFO] pyxis-repo-configs merge requests may fail if there are required changes to this repo:"
			echo "       * https://gitlab.cee.redhat.com/prodsec/product-definitions/-/merge_requests/ (new RHDH version)"
			# this will also reduce the cert-manager-releases list to keep only the new version (1.10) + 2 previous ones (1.8 and 1.9)
			generatePyxisConfigForPlugins 3 "--branch"
			echo "  ## ## ## Processing Pyxis Repo done! ## ## ## "
		fi

		if [[ $SKIP_KRD -eq 0 ]]; then
			echo "  ## ## ## Processing Konflux Release Data Repo (Comopnents + RPAs)... ## ## ## "
			generateNewKonfluxReleaseDataYamls
			echo "  ## ## ## Processing Konflux Release Data Repo (Comopnents + RPAs) done! ## ## ## "
			if [[ $VERBOSE -eq 1 ]]; then 
				echo "[DEBUG] update the Konflux Release Data repo to add new plugins and catalog index"
			fi
			echo "[INFO] konflux-release-data merge requests may fail if there are required changes to either of these repos:"
			echo "       * https://gitlab.cee.redhat.com/prodsec/product-definitions/-/merge_requests/ (new RHDH version)"
			echo "       * https://gitlab.cee.redhat.com/releng/pyxis-repo-configs/-/merge_requests/ (new plugin repos)"
			echo "  ## ## ## Processing Konflux Release Data Repo (plugins) ... ## ## ## "
			generateKonfluxReleaseDataForPlugins
			echo "  ## ## ## Processing Konflux Release Data Repo (plugins) done! ## ## ## "
		fi
	fi
	# cleanup
	# rm -fr "${TMPDIR:?}"/*
fi

if [[ ${DO_PUSH} -eq 1 ]]; then
	# cleanup
	rm -fr "$TMPDIR"
fi

echo -e "\n${green}[INFO] Done! ${norm}"
