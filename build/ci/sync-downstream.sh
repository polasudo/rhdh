#!/bin/bash
#
# Copyright (c) 2023 Red Hat, Inc.
#
# sync from gitlab distgit/containers/$d folder to pkgs.devel repo
# replacement for missing cpaas automation
# see also .gitlab-ci.sh

set -e

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/ci}

CONTAINER_NAME=rhdh-hub # or rhdh-operator or rhdh-operator-bundle
DWNSTM_BRANCH=$(cd "${ROOTPATH}" || exit 1; git rev-parse --abbrev-ref HEAD)

usage() {
  echo "
Usage: 
* rsync everything from midstream to downstream
* commit and push changes
* trigger a container build

Options:
    -b DWNSTM_BRANCH     downstream branch to update; default: '$DWNSTM_BRANCH'
    -d CONTAINER_NAME    folder to sync; default: '$CONTAINER_NAME'
    --dir CONTAINER_DIR  folder to create for downstream sources: default: '/tmp/downstream-${CONTAINER_NAME}'

Example:

    $0 -b rhdh-1.1-rhel-9 -d rhdh-hub
"
  exit 0
}

if [[ "$#" -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
  '-d') CONTAINER_NAME="$2"
    shift 2
    ;;
  '-b')
    DWNSTM_BRANCH="$2"
    shift 2
    ;;
  '-h' | '--help') usage ;;
  *)
    echo "[ERROR] Invalid parameter: $1"
    echo
    usage
    ;;
  esac
done

if [[ ! -d "${ROOTPATH}"/distgit/containers/"${CONTAINER_NAME}" ]]; then 
    echo "Error: ${ROOTPATH}/distgit/containers/${CONTAINER_NAME} does not exist; cannot sync to downstream!"; exit 1
fi

if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
fi

if [[ ! $DWNSTM_BRANCH ]]; then DWNSTM_BRANCH=$(cd "${ROOTPATH}" || exit 1; git rev-parse --abbrev-ref HEAD); fi

CONTAINER_DIR="/tmp/downstream-${CONTAINER_NAME}"
midSHA=$(cd "${ROOTPATH}" || exit 1; git rev-parse HEAD)

# sync to downstream's distgit/containers/$d folder to pkgs.devel
# delete existing downstream checkout folder
if [[ -d "${CONTAINER_DIR}" ]]; then rm -fr "${CONTAINER_DIR}"; fi

# git clone pkgs.devel from the DWNSTM_BRANCH branch
klist; git clone "ssh://rhdh-bot@pkgs.devel.redhat.com/containers/${CONTAINER_NAME}" "${CONTAINER_DIR}" && pushd "${CONTAINER_DIR}" >/dev/null || exit 1 
  git checkout "$DWNSTM_BRANCH" || exit 1

  git config user.email "rhdh-bot@redhat.com"
  git config user.name "RHDH Build (rhdh-bot)"
  git config --global push.default matching
  git config --global pull.rebase true
  git config --global init.defaultBranch main
  git config --global advice.detachedHead false

  # grab latest commits
  pushd "${ROOTPATH}"/ >/dev/null || exit 1
    git pull origin "${DWNSTM_BRANCH}"
  popd >/dev/null || exit 1

  # copy from mid to down    
  rsync -azq --delete \
      "${ROOTPATH}"/distgit/containers/"${CONTAINER_NAME}"/* "${ROOTPATH}"/distgit/containers/"${CONTAINER_NAME}"/.??* \
      "${CONTAINER_DIR}/" \
      --exclude=.git --exclude=node_modules
  
  # update downstream container.yaml to have the same sha values as in the midstream
  sed -i "${CONTAINER_DIR}/container.yaml" -r -e "s/ref: ([a-z0-9]+)/ref: $midSHA/"

  # store one unique diff file per downstream repo
  git diff --name-only | tee -a "/tmp/sync-downstream.sh.${CONTAINER_NAME}.diff.txt"
  # commit and push changes
  git add -f . || true
  git commit -s -m "chore: Update from midstream distgit/containers/${CONTAINER_NAME} @ ${midSHA} [skip ci]" . || true
  git pull origin "${DWNSTM_BRANCH}"
  git push origin "${DWNSTM_BRANCH}"
popd >/dev/null || exit 1

# to run a brew container-build, see build/ci/build-downstream.sh
