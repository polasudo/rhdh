#!/bin/bash

# requires 
#    dnf install -y brewkoji python3-koji-containerbuild-cli \
#     openldap-clients python3-rpkg python3-kobo python3-bugzilla \
#     gcc openssl-devel bzip2-devel sqlite-devel

# brew container-build rhdh-1.1-rhel-9-containers-candidate 
#      git+https://pkgs.devel.redhat.com/git/containers/rhdh-operator#5459112551259a7f5a194227e7b3537be38afdf0 \
#     --git-branch rhdh-1.1-rhel-9 

set -e

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/ci}

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi
debugflag=""

usage () {
	echo "
Usage: 
  $0 -b BRANCH [options]

Options:
    -b DWNSTM_BRANCH    downstream branch from which to compute latest quay image, eg., rhdh-1.1-rhel-9
    -h, --help          This help

Example
  $0 -d rhdh-hub -b rhdh-1.1-rhel-9 
"
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
  '-b')
    DWNSTM_BRANCH="$2"
    shift 1
    ;;
  '-h'| '--help') 
    usage; exit 0
    ;;
  '--debug') debugflag="--debug";;
  *)
    echo "[ERROR] Invalid parameter: $1"
    echo
    usage
    ;;
  esac
  shift 1
done

if [[ ! $DWNSTM_BRANCH ]]; then usage; exit 1; fi

if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
fi

# NOTE: This must be run using the GITHUB_TOKEN of rhdh-bot@redhat.com in order to push to that user's gist, and need the QUAY_TOKEN to read image metadata from private repo
# see token in https://gitlab.cee.redhat.com/rhidp/productization/-/tree/main/secrets
# see gitlab-ci-env-setup.sh for how to load the token from .secure_files
next_tag=$(./build/scripts/getLatestImageTags.sh -b "${DWNSTM_BRANCH}" --quay -c rhdh/rhdh-hub-rhel9); next_tag=${next_tag##*:} # 1.0-163
if [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]] && [[ $next_tag == "???" ]]; then 
  # if no :next tag for 1.x branch, pull the :latest tag instead 
  next_tag=$(./build/scripts/getLatestImageTags.sh -b "${DWNSTM_BRANCH}" --quay -c rhdh/rhdh-hub-rhel9 --latestNext latest); next_tag=${next_tag##*:} 
elif [[ $DWNSTM_BRANCH != "rhdh-1-rhel-9" ]] && [[ $next_tag == "???" ]]; then
  # if nothing in 1.yy branch yet, pull the :next tag instead 
  next_tag=$(./build/scripts/getLatestImageTags.sh -b "${DWNSTM_BRANCH}" --quay -c rhdh/rhdh-hub-rhel9 --latestNext next); next_tag=${next_tag##*:} 
fi

pushd "build/helm/" >/dev/null || exit 1
    echo "Create chart for $next_tag" | tee /tmp/publish-helmchart.sh.result.txt
    ./prepare.sh ${debugflag} --chart-version "${next_tag}-CI" --rhdh-version "${next_tag}" --extra-branch "${DWNSTM_BRANCH}" --catalog "https://rhdh-bot:${GITHUB_TOKEN}@github.com/rhdh-bot/openshift-helm-charts.git" --publish | tee -a /tmp/publish-helmchart.sh.result.txt
popd >/dev/null || exit 1
