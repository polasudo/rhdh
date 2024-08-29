#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to tag the janus/rhdh repos for a given release, or 
# create stable branches + update main branches after branch creation
SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

# RH production key, to use only in 1.yy.x stable branches; otherwise use the devel key for main
SEGMENT_WRITE_KEY="mUr49Tkld5bj1lFFPxxqHrAzkQMRINvF"

TMPDIR="/tmp/tmp-checkouts"

# defaults

MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi

# try to compute branches from currently checked out branch; else fall back to hard coded value
TARGET_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ $TARGET_BRANCH != "rhdh-1."*"-rhel-9" ]]; then
	TARGET_BRANCH="rhdh-1-rhel-9"
fi
pkgs_devel_branch=${TARGET_BRANCH}

DO_BUILD=1  # update yarn lock
DO_PUSH=1   # push the commit
DO_UPDATE=0 # force update of 1.yy.x branches, even if tag already exists
SKIP_GH=0   # skip updates to GH repos
SKIP_GL=0   # skip updates to GL repos
SKIP_PD=0   # skip updates to plgs.devel repos

# make builds faster
export HUSKY=0

# NOT USED
# FORCE_PUSH=""    # force push to the midstream repo in case of merge conflicts (use "-f")

pduser=rhdh-bot

# normally, use this script to create tags, not branches
# this also defines the branch to update after creating a new branch (eg., for a TARGET_BRANCH=1.2.x branch creation, bump SOURCE_BRANCH=main to 1.3.0)
SOURCE_BRANCH="" 

CLEAN="false" #  if set true, delete existing folders and do fresh checkouts

if [[ $# -lt 4 ]]; then
	echo "
To create or update existing branches:
  $0 -t PROD_VERSION --branchfrom SOURCE_GH_BRANCH -gh TARGET_GH_BRANCH -ghtoken GITHUB_TOKEN
Example: 
  $0 -t 1.3 --branchfrom main -gh 1.3.x -ghtoken \$GITHUB_TOKEN

To create tags (and push updates to 1.yy.x branches):
1. You should have a valid GITHUB_TOKEN for your user (for upstream PRs).
2. You should have a valid $pduser kerberos login (for mid- and downstreeam pushes).
3. Run this
  $0 -v CSV_VERSION -t PROD_VERSION -gh GH_BRANCH -ghtoken GITHUB_TOKEN -pd GITLAB_AND_PKGS_DEVEL_BRANCH -pduser kerberos_user
Example: 
  $0 -v 1.2.1 -t 1.2 -gh 1.2.x -pd rhdh-1.2-rhel-9 --clean --force-update -ghtoken \$GITHUB_TOKEN -pduser $pduser

Options:
    --clean                   delete existing temp folders and do fresh checkouts
    --force-update            update the 1.yy.x branch even if the tag already exists
    --nopush                  do not push local changes; default: push changes
    --dry-run                 do everything but create the PR; instead just display the PR contents
    --gitlab-pipeline-push    use this flag to push changes when running inside a gitlab pipeline
    -ghtoken                  run as a different GH user instead of the local environment's \$GITHUB_TOKEN
    -pduser                   run as a different bot user; default: $pduser 
    -tmpdir                   temporry dir for checkouts; default $TMPDIR
    --skip-gh                 skip github updates
    --skip-gl                 skip gitlab updates
    --skip-pd                 skip pkgs.devel updates
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
	'--gitlab-pipeline-push') DO_PUSH=1; DO_BUILD=1; GITLAB_PIPELINE="true";;
	'--dry-run') DRYRUN="$1";;
	'--force-update') DO_UPDATE=1;;
	'-tmpdir') TMPDIR="$2"; shift 1;;
	'--skip-gh') SKIP_GH=1;;
	'--skip-gl') SKIP_GL=1;;
	'--skip-pd') SKIP_PD=1;;
	'-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ ! ${PROD_VERSION} ]]; then
  PROD_VERSION=${CSV_VERSION%.*} # given 1.y.0, want 1.y
fi

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
  git pull origin "${baseBranch}" 1>/dev/null 2>&1 || true
  git branch "${headBranch}" || true
  git checkout "${headBranch}" 1>/dev/null 2>&1
  git merge "${baseBranch}" 1>/dev/null 2>&1 || true
  # shellcheck disable=SC2086
  if [[ $(/usr/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
    if [[ $(git diff HEAD~1 2>/dev/null || true) ]]; then
		# if github
		if [[ $(git remote -v | grep github || true) ]]; then
			git push origin "${headBranch}" 1>/dev/null # ${FORCE_PUSH}
			gh repo set-default "$(git remote get-url origin)"
			# shellcheck disable=SC2086
			gh pr create --fill -B "${baseBranch}" -H "${headBranch}" ${DRYRUN} || true
			# if not running in a gitlab pipeline, open the PR in a browser 
			if [[ $GITLAB_PIPELINE != "true" ]]; then
				gh pr view --web || true
			fi
		else # not github
			PR_URL=$(git push origin "${headBranch}" 2>&1 | grep "${headBranch}" | grep "https://" | sed -r -e "s/remote:   //")
			echo "Create merge request at $PR_URL"
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
}

# for creating a new branch, or pushing changes to an existing branch (may require PR)
doPush () {
  the_branch="$1"
  pr_branch="pr-update-${the_branch}-$(date +%s)"

  git pull origin "${the_branch}" 1>/dev/null 2>&1 || true
  createPr "${pr_branch}" "${the_branch}"
}

# compute the next .z versions based on the input CSV version
# eg., for 1.1.2 get 1.1.3 (showcase repo, RHDH CSV), 0.1.3 (operator repo, upstream CSV), and 3.1.3 (plugins repo root package.json)
CSV_VERSION_Z=""
CSV_VERSION_Z_OPERATOR=""
CSV_VERSION_Z_PLUGINS=""
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
		CSV_VERSION_Z_PLUGINS="$XX.$YY.$ZZ"
	fi
}

# compute the next .z versions based on the input CSV version
# eg., for 1.1.2 get 1.1.3 (showcase repo, RHDH CSV), 0.1.3 (operator repo, upstream CSV)
newver="1.y.0"
newverOp="0.y.0"
getXYplusOneFromBranch() {
	ver="$1"
	if [[ $ver =~ ^([0-9]+)\.([0-9]+)\..* ]]; then # increase the y digit
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

# note that this will bump versions of all plugins' package.json AND the root package.json too
# to bump only the root package.json, see updatePluginsRootVersion()
function updatePluginVersions() {
	# for janus-idp/backstage-plugins, run checkPluginVersions.sh
	# TODO move to backstage/community-plugins
	orgAndRepo="janus-idp/backstage-plugins"
	d="${orgAndRepo/\//__}"
	pushd ""$TMPDIR"/projects_${d}" >/dev/null || exit 1
	git checkout "${SOURCE_BRANCH}" || true
	
	# get script
	if [[ -x ${SCRIPT_DIR}/checkPluginVersions.sh ]]; then
		CPV=${SCRIPT_DIR}/checkPluginVersions.sh
	else
		if [[ $VERBOSE -eq 1 ]]; then echo "Downloading checkPluginVersions.sh script from Github"; fi
		pushd /tmp >/dev/null || exit
		curl -sSLO "https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/${MIDSTM_BRANCH}/build/scripts/checkPluginVersions.sh" && chmod +x checkPluginVersions.sh
		CPV=/tmp/checkPluginVersions.sh
		popd >/dev/null || exit
	fi

	# TODO VERIFY THIS WORKS with 1.3 branch creation
	set -x
	$CPV -s "$(pwd)" -b "${TARGET_BRANCH}" --pr-branch "tagRelease.sh_branch_${TARGET_BRANCH}" --push
	set +x

	popd >/dev/null || exit 1
}

# for backstage-plugins, bump root package.json to specified version
# to bump all plugins as well, see updatePluginVersions()
function updatePluginsRootVersion() {
	the_branch="$1"
	the_version="$2"
	# TODO move to backstage/community-plugins
	orgAndRepo="janus-idp/backstage-plugins"
	d="${orgAndRepo/\//__}"
	rm -fr ""$TMPDIR"/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "https://github.com/${orgAndRepo}" ""$TMPDIR"/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd ""$TMPDIR"/projects_${d}_2" >/dev/null || exit 1

	###############
	# update 1 file
	###############

	d=package.json
	jq -r --arg the_version "$the_version" '.version|=$the_version' $d > "${d}1"; mv -f "${d}1" "${d}"

	echo -n "updatePluginsRootVersion: "; pwd; git diff || true
	if [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch"
		if [[ $DO_BUILD -eq 1 ]]; then
			# quietly install any updates to yarn.lock so PR will pass sniff test
			yarn install 2> >(grep -v warning 1>&2) 
			COMMITMSG="${COMMITMSG} + regen yarn.lock"
		fi
		if [[ $(git diff || true ) ]]; then
			git commit --no-gpg-sign -s -m "${COMMITMSG}" .
			git pull origin "${the_branch}" || true
			# create pull request if target branch is restricted access
			pr_branch="pr-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
			createPr "${pr_branch}" "${the_branch}"
		fi
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# for backstage-showcase, bump to specified version
function updateShowcaseVersions() {
	the_branch="$1"
	the_version="$2"
	# TODO move to red-hat-developer-hub
	orgAndRepo="janus-idp/backstage-showcase"
	d="${orgAndRepo/\//__}"
	rm -fr ""$TMPDIR"/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "https://github.com/${orgAndRepo}" ""$TMPDIR"/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd ""$TMPDIR"/projects_${d}_2" >/dev/null || exit 1

	################
	# update 3 files
	################

	for d in package.json e2e-tests/package.json; do
		jq -r --arg the_version "$the_version" '.version|=$the_version' $d > "${d}1"; mv -f "${d}1" "${d}"
	done
	sed -i packages/app/src/build-metadata.json -r \
		-e "s/(\"RHDH Version: )[0-9.]+\"/\1$the_version\"/"

	echo -n "updateShowcaseVersions: "; pwd; git diff || true
	if [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch"
		if [[ $DO_BUILD -eq 1 ]]; then
			# quietly install any updates to yarn.lock so PR will pass sniff test
			yarn install 2> >(grep -v warning 1>&2) 
			COMMITMSG="${COMMITMSG} + regen yarn.lock"
		fi
		if [[ $(git diff || true ) ]]; then
			git commit --no-gpg-sign -s -m "${COMMITMSG}" .
			git pull origin "${the_branch}" || true
			# create pull request if target branch is restricted access
			pr_branch="pr-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
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
	# TODO move to red-hat-developer-hub-operator
	orgAndRepo="redhat-developer/rhdh-operator"
	d="${orgAndRepo/\//__}"
	rm -fr ""$TMPDIR"/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "https://github.com/${orgAndRepo}" ""$TMPDIR"/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd ""$TMPDIR"/projects_${d}_2" >/dev/null || exit 1

	################
	# update 4 files
	################

	# update Makefile
	sed -i Makefile -r -e "s/(VERSION \?= )[0-9.]+/\1$the_version_op/" # 0.3.0
	# update bundle/manifests/backstage-operator.clusterserviceversion.yaml
	sed -i bundle/manifests/backstage-operator.clusterserviceversion.yaml -r \
		-e "s/(skipRange: '>=0.0.1 <)[0-9.]+'/\1$the_version_op'/" \
		-e "s/(name: backstage-operator.v)[0-9.]+/\1$the_version_op/" \
		-e "s/(image: quay.io\/janus-idp\/operator:)[0-9.]+/\1$the_version_op/" \
		-e "s/(^  version: )[0-9.]+/\1$the_version_op/" # 0.3.0
	# update config/manager/kustomization.yaml
	sed -i config/manager/kustomization.yaml -r \
		-e "s/(^  newTag:  )[0-9.]+/\1$the_version_op/" # 0.3.0
	# update .rhdh/bundle/manifests/rhdh-operator.csv.yaml use both 1.3.0 and 1.3 (three times for image ref replacements: operator, operator, hub)
	sed -i .rhdh/bundle/manifests/rhdh-operator.csv.yaml -r \
		-e "s/(skipRange: '>=1.0.0 <)[0-9.]+'/\1$the_version'/" \
		-e "s/(name: rhdh-operator.v)[0-9.]+/\1$the_version/" \
		-e "s/(^  version: )[0-9.]+/\1$the_version/" \
		-e "s/(rhdh-rhdh-hub-rhel9:|rhdh-rhdh-rhel9-operator:)[0-9.]+/\1${the_version%.*}/" \
		-e "s|(.*https://access.redhat.com/documentation/en-us/red_hat_developer_hub/)([0-9.]+)(/html-single/administration_guide_for_red_hat_developer_hub/index#assembly-rhdh-telemetry_admin-rhdh.*)|\1${the_version%.*}\3|g" # replace with 1.3 

	echo -n "updateOperatorVersions: "; pwd; git diff || true
	if [[ $(git diff || true ) ]] && [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch"
		git commit --no-gpg-sign -s -m "${COMMITMSG}" .
		git pull origin "${the_branch}" || true
		# create pull request if target branch is restricted access
		pr_branch="pr-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
		createPr "${pr_branch}" "${the_branch}"
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

function updateDocVersions() {
	the_branch="$1"
	the_version="$2"
	orgAndRepo="redhat-developer/red-hat-developers-documentation-rhdh"
	d="${orgAndRepo/\//__}"
	rm -fr ""$TMPDIR"/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "https://github.com/${orgAndRepo}" ""$TMPDIR"/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd ""$TMPDIR"/projects_${d}_2" >/dev/null || exit 1

	###############
	# update 1 file
	###############

	d=artifacts/attributes.adoc
	sed -i $d -r \
		-e "s/(:product-version: ).+/\1${the_version%.*}/" \
		-e "s/(:product-bundle-version: ).+/\1${the_version}/" \
		-e "s/(:product-chart-version: ).+/\1${the_version}/"

	echo -n "updateDocVersions: "; pwd; git diff || true
	if [[ $(git diff || true ) ]] && [[ ${DO_PUSH} -eq 1 ]]; then
		COMMITMSG="chore: tagRelease.sh: bump to $the_version in $the_branch branch"
		git commit --no-gpg-sign -s -m "${COMMITMSG}" .
		git pull origin "${the_branch}" || true
		# create pull request if target branch is restricted access
		pr_branch="pr-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
		createPr "${pr_branch}" "${the_branch}"
	fi ## if DO_PUSH

	popd >/dev/null || exit 1
}

# for charts repo, bump to specified version
# TODO: chart version must increment (y+1) in charts/backstage/Chart.yaml and in README.md
function updateChartVersions(){
    the_branch="$1"
    the_version="$2" # 1.3.0
    the_version="${the_version%.*}" # 1.3
    # push path to repo onto the stack
    orgAndRepo="redhat-developer/rhdh-chart"
    d="${orgAndRepo/\//__}"
	rm -fr ""$TMPDIR"/projects_${d}_2" && git clone -q --depth 1 -b "${the_branch}" "https://github.com/${orgAndRepo}" ""$TMPDIR"/projects_${d}_2" || echo "Branch $clone_branch doesn't exist: skip!"
	pushd ""$TMPDIR"/projects_${d}_2" >/dev/null || exit 1

	files_to_bump="./charts/backstage/README.md ./charts/backstage/Chart.yaml"

    # update telemetry link in chart files to new version 
	for file in $files_to_bump; do
		sed -i "${file}" -r -e \
			"s|(.*https://access.redhat.com/documentation/en-us/red_hat_developer_hub/)([0-9.]+)(/html-single/administration_guide_for_red_hat_developer_hub/index#assembly-rhdh-telemetry_admin-rhdh.*)|\1${the_version}\3|g"
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
			sed -i "${file}" -r -e "s/(^version: |Version: |Version-)([0-9.]+)/\1$newver/g"
		done
		git diff || true

		COMMITMSG="chore: tagRelease.sh: bump to ${the_version} in ${the_branch} branch"
		git commit --no-gpg-sign -s -m "${COMMITMSG}" . || git commit --no-gpg-sign -s -m "${COMMITMSG}" . 
		git pull origin "${the_branch}" || true
		# create pull request if target branch is restricted access
		pr_branch="pr-bump-to-${the_version}-in-${the_branch}-$(date +%s)"
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
	if [[ $CSV_VERSION ]] && [[ $(git ls-remote "https://github.com/$orgAndRepo" "refs/tags/$CSV_VERSION") ]] && [[ $DO_UPDATE -eq 0 ]]; then
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
		# echo "[DEBUG] Using clone_branch=$clone_branch ..."
		
		if [[ ! -d ""$TMPDIR"/projects_${d}" ]]; then
			git clone -q --depth 1 -b "${clone_branch}" "https://github.com/${orgAndRepo}" "projects_${d}" || echo "Branch $clone_branch doesn't exist: skip!"
		fi
		if [[ -d ""$TMPDIR"/projects_${d}" ]]; then
			pushd ""$TMPDIR"/projects_${d}" >/dev/null || exit 1
				export GITHUB_TOKEN="${GITHUB_TOKEN}"
				git config user.email "${pduser}@redhat.com"
				git config user.name "RHDH Build (${pduser})"
				git remote set-url origin "https://${GITHUB_TOKEN}:x-oauth-basic@github.com/${orgAndRepo}"

				git checkout --track "origin/${clone_branch}" -q 2>/dev/null || true
				git pull -q 2>/dev/null

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

					# changes to apply to new midstream 1.yy.x branch
					# https://issues.redhat.com/browse/RHIDP-1311 apply the production key to the 1.yy.x stable branches, so we can use the devel key for main/CI builds
					if [[ $d == "janus-idp__backstage-showcase" ]] || [[ $d == "redhat-developer__red-hat-developer-hub" ]]; then
						sed -i .rhdh/docker/Dockerfile -r -e "s|(.*SEGMENT_WRITE_KEY=).*|\1$SEGMENT_WRITE_KEY|g"
						COMMITMSG="chore: switch SEGMENT_WRITE_KEY in $TARGET_BRANCH"
						git commit --no-gpg-sign -s -m "${COMMITMSG}" .rhdh/docker/Dockerfile
					fi

					if [[ $DO_PUSH -eq 1 ]]; then 
						doPush "${TARGET_BRANCH}"
					fi
				fi

				##############################
				# if doing a tagging operation
				##############################

				if [[ $CSV_VERSION ]]; then # push a new tag (or no-op if exists)
					git tag "${CSV_VERSION}" || true
					if [[ $DO_PUSH -eq 1 ]]; then 
						git push origin "${CSV_VERSION}" || true
					fi

					# now bump TARGET_BRANCH = 1.yy.x branch to x.yy.(z+1)
					getNextCSVZ "$CSV_VERSION" 
					# echo "[INFO] Next CSV version is $CSV_VERSION_Z / $CSV_VERSION_Z_OPERATOR"
					if [[ $d == "janus-idp__backstage-showcase" ]] || [[ $d == "redhat-developer__red-hat-developer-hub" ]]; then
						echo "[INFO] Bump $d to $CSV_VERSION_Z" 
						updateShowcaseVersions "$TARGET_BRANCH" "$CSV_VERSION_Z"
					elif [[ $d == "janus-idp__operator" ]] || [[ $d == "redhat-developer__red-hat-developer-hub-operator" ]]; then
						echo "[INFO] Bump $d to $CSV_VERSION_Z / $CSV_VERSION_Z_OPERATOR" 
						updateOperatorVersions "$TARGET_BRANCH" "$CSV_VERSION_Z" "$CSV_VERSION_Z_OPERATOR"
					elif [[ $d == "janus-idp__backstage-plugins" ]]; then
						echo "[INFO] Bump $d to $CSV_VERSION_Z_PLUGINS" 
						updatePluginsRootVersion "$TARGET_BRANCH" "$CSV_VERSION_Z_PLUGINS"
					elif [[ $d == "redhat-developer__red-hat-developers-documentation-rhdh" ]]; then
						echo "[INFO] Bump $d to $CSV_VERSION" 
						# note: for now, only bump to the last RELEASED version in the docs
						# so use CSV_VERSION=1.1.2 here (while showcase, operator, plugins move to 1.1.3 to prepare for a future release)
						updateDocVersions "$TARGET_BRANCH" "$CSV_VERSION"
					else
						echo "[INFO] No version bumps needed for $d" 
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
		# convert 1.2.x to rhdh-1.2-rhel-9
		DWNSTM_TARGET_BRANCH=rhdh-${TARGET_BRANCH/.x/-rhel-9}
		echo;
		if [[ $SOURCE_BRANCH ]]; then
			echo "== $d :: branch from $MIDSTM_BRANCH to $DWNSTM_TARGET_BRANCH =="
		elif [[ $CSV_VERSION ]]; then
			echo "== $d :: tag $CSV_VERSION from $DWNSTM_TARGET_BRANCH =="
		fi
		if [[ ! -d ""$TMPDIR"/gitlab_${d}" ]]; then
			git clone -q --depth 1 -b "${MIDSTM_BRANCH}" "git@gitlab.cee.redhat.com:rhidp/${d}.git" "gitlab_${d}" || echo "Branch $MIDSTM_BRANCH doesn't exist: skip!"
		fi
		if [[ -d ""$TMPDIR"/gitlab_${d}" ]]; then
			pushd ""$TMPDIR"/gitlab_${d}" >/dev/null || exit 1
				git config user.email "${pduser}@redhat.com"
				git config user.name "RHDH Build (${pduser})"
				git checkout --track origin/"${MIDSTM_BRANCH}" -q 2>/dev/null || true
				git pull -q 2>/dev/null
				if [[ ${SOURCE_BRANCH} ]]; then 
					# create a branch or use existing
					git branch --set-upstream-to="origin/${DWNSTM_TARGET_BRANCH}" "${DWNSTM_TARGET_BRANCH}" || git branch "${DWNSTM_TARGET_BRANCH}" || true
					git checkout --track origin/"${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
					git pull origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
					git push origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true

					# changes to apply to new midstream rhdh-1.yy-rhel-9 branch
					if [[ $d == "rhdh" ]]; then # for rhidp/rhdh
						sed -i upstream_repos.yml -r -e "s|- main|- ${DWNSTM_TARGET_BRANCH}|g"
						rm -f sync/*
						COMMITMSG="chore: tagRelease.sh: use $DWNSTM_TARGET_BRANCH in upstream_repos.yml; trigger full build"
						git commit --no-gpg-sign -s -m "${COMMITMSG}" sync/ upstream_repos.yml
					fi

					if [[ $DO_PUSH -eq 1 ]]; then 
						git push origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null 2>&1  || true
						doPush "${DWNSTM_TARGET_BRANCH}"
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
		# convert 1.2.x to rhdh-1.2-rhel-9
		DWNSTM_TARGET_BRANCH=rhdh-${TARGET_BRANCH/.x/-rhel-9}
		echo; 
		if [[ $SOURCE_BRANCH ]]; then
			echo "== $d :: branch from $pkgs_devel_branch to $DWNSTM_TARGET_BRANCH =="
		elif [[ $CSV_VERSION ]]; then
			echo "== $d :: tag $CSV_VERSION from $DWNSTM_TARGET_BRANCH =="
		fi
		if [[ ! -d ""$TMPDIR"/containers_${d}" ]]; then
			git clone -q --depth 1 -b "${pkgs_devel_branch}" "ssh://${pduser}@pkgs.devel.redhat.com/containers/${d}" "containers_${d}"
			pushd ""$TMPDIR"/containers_${d}" >/dev/null || exit 1
				git config user.email "${pduser}@redhat.com"
				git config user.name "RHDH Build (${pduser})"
				git checkout --track origin/"${pkgs_devel_branch}" -q 2>/dev/null || true
				git pull -q 2>/dev/null
			popd >/dev/null || exit 1
		fi
		pushd ""$TMPDIR"/containers_${d}" >/dev/null || exit 1
			if [[ ${SOURCE_BRANCH} ]]; then 
				# create a branch or use existing
				set -x 
				git branch --set-upstream-to="origin/${DWNSTM_TARGET_BRANCH}" "${DWNSTM_TARGET_BRANCH}" || git branch "${DWNSTM_TARGET_BRANCH}" || true
				git checkout --track origin/"${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
				git pull origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
				git push origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
				set +x 

				# currently, no changes to apply to new midstream rhdh-1.yy-rhel-9 branch (as this content is synced from midstream)

				if [[ $DO_PUSH -eq 1 ]]; then 
					git push origin "${DWNSTM_TARGET_BRANCH}" 1>/dev/null || true
					doPush "${DWNSTM_TARGET_BRANCH}"
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

getXYplusOneFromBranch "$TARGET_BRANCH"
# eg., for 1.2.2 get 1.2.3 (showcase repo, RHDH CSV), 0.2.3 (operator repo, upstream CSV)
# echo "newver = $newver; newverOp = $newverOp"

# getNextCSVZ
# # eg., for 1.2.2 get 1.2.3 (showcase repo, RHDH CSV), 0.2.3 (operator repo, upstream CSV), and 3.2.3 (plugins repo root package.json)
# echo "CSV_VERSION_Z = $CSV_VERSION_Z; CSV_VERSION_Z_OPERATOR = $CSV_VERSION_Z_OPERATOR; CSV_VERSION_Z_PLUGINS = $CSV_VERSION_Z_PLUGINS"

############
# UPSTREAM 
############

# TODO move janus-idp to redhat-developer
	# RHIDP-1018 Sunset Janus IDP GH repos
	# RHIDP-1019 Migrate Janus IDP plugins repo to backstage upstream
	# RHIDP-1022 Migrate Janus IDP showcase repo to redhat-developers org
	# RHIDP-1021 Migrate Janus IDP operator repo to redhat-developers org

# branch and/or tag GH repos
if [[ $SKIP_GH -eq 0 ]]; then
	for repo in \
		redhat-developer/rhdh-chart \
		redhat-developer/red-hat-developers-documentation-rhdh \
		redhat-developer/red-hat-developer-hub-software-templates \
		redhat-developer/red-hat-developer-hub-theme \
		redhat-developer/rhdh-operator \
		janus-idp/backstage-showcase \
		janus-idp/backstage-plugins \
		; do
		pushBranchAndOrTagGH $repo 
	done
fi

# ###################################################################################################

# now update main branches for the above branch creation
if [[ $SKIP_GH -eq 0 ]]; then
	if [[ ${SOURCE_BRANCH} ]]; then
		# check for changes and push a PR for each repo
		# TODO VERIFY THIS WORKS with 1.3 branch creation
		updatePluginVersions # requires manual commits to janus plugins repo / missing gpg key?
		updateOperatorVersions "$SOURCE_BRANCH" "$newver" "$newverOp"
		updateDocVersions "$SOURCE_BRANCH" "$newver"
		updateShowcaseVersions "$SOURCE_BRANCH" "$newver"
		updateChartVersions "$SOURCE_BRANCH" "$newver"
	fi
fi

# ############
# MIDSTREAM 
# ############

# branch or tag GL repo(s)
if [[ $SKIP_GL -eq 0 ]]; then
	if [[ "${pkgs_devel_branch}" ]]; then
		for repo in \
			rhdh \
			; do
		pushTagGL $repo
		done
		# cleanup
		rm -fr "$TMPDIR"/*
	fi
fi

# ############
# DOWNSTREAM 
# ############

# tag pkgs.devel repos 
if [[ $SKIP_PD -eq 0 ]]; then
	if [[ "${pkgs_devel_branch}" ]] && [[ $CSV_VERSION ]]; then
		for repo in \
			rhdh-hub \
			rhdh-operator \
			rhdh-operator-bundle \
			; do
		pushTagPD $repo
		done
	else
		echo "
You must branch pkgs.devel repos manually - as these steps might fail due to long-running processes (and need to be repeated):

DWNSTM_TARGET_BRANCH=\"rhdh-${TARGET_BRANCH/.x/-rhel-9}\"
for d in hub operator operator-bundle; do
	pushd ~/5/5-pkgs.devel_\$d >/dev/null || exit
	git restore --staged .; git restore .
	git checkout rhdh-1-rhel-9; git pull origin rhdh-1-rhel-9
	git branch \$DWNSTM_TARGET_BRANCH
	git checkout \"\$DWNSTM_TARGET_BRANCH\"
	git push origin \"\$DWNSTM_TARGET_BRANCH\"
	popd >/dev/null || exit
done

Now submit a ticket like https://issues.redhat.com/browse/SPMM-17463 to get new Errata PV and Brew targets created.
NOTE: this may no longer be needed once we switch to Konflux.
"
	fi
fi

# cleanup
rm -fr "$TMPDIR"
