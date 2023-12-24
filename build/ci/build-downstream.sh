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
CONTAINER_NAME="" # rhdh-hub, rhdh-operator, rhdh-operator-bundle

scratchFlag=""

usage () {
	echo "
Usage: 
  $0 -d REPO -b BRANCH [options]

Options:
    -b DWNSTM_BRANCH    downstream branch to update, eg., rhdh-1.1-rhel-9
    -d CONTAINER_NAME   folder to sync, eg., rhdh-hub or rhdh-operator
    -s, --scratch       Do a scratch build
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
  '-d') CONTAINER_NAME="$2"
    shift 1
    ;;
  '-s'|'--scratch')
    scratchFlag="--scratch"
    ;;
  '-h'| '--help') 
    usage; exit 0
    ;;
  *)
    echo "[ERROR] Invalid parameter: $1"
    echo
    usage
    ;;
  esac
  shift 1
done

if [[ ! $DWNSTM_BRANCH ]] || [[ ! $CONTAINER_NAME ]]; then usage; exit 1; fi

if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
fi

CONTAINER_DIR="/tmp/downstream-${CONTAINER_NAME}"
rm -fr "$CONTAINER_DIR"
git clone "ssh://rhdh-bot@pkgs.devel.redhat.com/containers/${CONTAINER_NAME}" "${CONTAINER_DIR}" && pushd "${CONTAINER_DIR}" >/dev/null || exit 1 
  git checkout "$DWNSTM_BRANCH" || exit 1

  git config user.email "rhdh-bot@redhat.com"
  git config user.name "RHDH Build (rhdh-bot)"
  git config --global push.default matching
  git config --global pull.rebase true
  git config --global init.defaultBranch main
  git config --global advice.detachedHead false

  sha="$(git rev-parse HEAD)"
  CMD="brew container-build ${DWNSTM_BRANCH}-containers-candidate git+https://pkgs.devel.redhat.com/git/containers/${CONTAINER_NAME}#${sha} --git-branch ${DWNSTM_BRANCH} --nowait ${scratchFlag}"
  # shellcheck disable=SC2086
  git pull && git push && tmpfile=$(mktemp) && \
  $CMD 2>"${tmpfile}.err" | tee 2>&1 "${tmpfile}" && \
  if [[ $(grep -c -E "brew: error: " "${tmpfile}.err") -gt 0 ]]; then
  echo "[ERROR] Could not run brew container-build!
===============================
$CMD
===============================
"
    grep -E -v '^[[:space:]]*$|DeprecationWarning' "${tmpfile}.err"
echo "
===============================
"
    exit 4
  fi
  taskID=$(grep "Created task:" "${tmpfile}" | sed -e "s#Created task: *##") && brew watch-logs $taskID | tee 2>&1 "${tmpfile}"
  taskID=${taskID// /}
  results=$(brew taskinfo "$taskID" | grep -E "Owner|Type|State|Created|Started|Finished" || true)
  echo "
Task completed:
$results
URL: https://brewweb.engineering.redhat.com/brew/taskinfo?taskID=$taskID
" | tee "/tmp/build-downstream.sh.${CONTAINER_NAME}.result.txt"

  if [[ "$results" == *"State: failed"* ]]; then exit 42; fi

popd >/dev/null || exit 1