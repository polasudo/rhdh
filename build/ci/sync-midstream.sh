#!/bin/bash
#
# Copyright (c) Red Hat, Inc.
#
# sync from upstream github to midstream gitlab
#
# requires yarn npm prettifier husky
# requires python3-pip npm git jq rsync
# requires yq (python wrapper for jq)
# requires make

# see also .gitlab-ci.yml and upstream_repos.yml

set -e

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/ci}
# THIS_REPO="rhpib/rhdh"
CLEAN=0     # clean up node_modules and anything from remote repo before creating local changes
FORCE=""    # force push to the midstream repo in case of merge conflicts
BUNDLEONLY=0 # normally build all three images
DO_BUILD=1  # fetch, transform, then build by default; use this to disable building
DO_COMMIT=1 # by default, commit change
DO_PUSH=1   # push the commit
GITLAB_PIPELINE="" # set "true" when running inside a gitlab pipeline to override default git push settings
CONTAINER_NUDGE="" # set  to tru when running inside a containerfile to skip git processes

TMPDIR=/tmp

# Ignore husky warnings
HUSKY=0; export HUSKY

# RH production key, to use only in rhdh-1.yy-rhel-9 stable branches; otherwise use the devel key for main
SEGMENT_WRITE_KEY="mUr49Tkld5bj1lFFPxxqHrAzkQMRINvF"

latestStableBranch="$(curl -sSLk --url "https://gitlab.cee.redhat.com/api/v4/projects/rhidp%2Frhdh/repository/branches?per_page=200&regex=^rhdh-1..*-rhel-9$" | jq -r '.[].name' | sort -uV | tail -1)"; # echo $latestStableBranch

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
latestNextExample=""
if [[ ${DWNSTM_BRANCH} == "rhdh-"*"-rhel-"* ]]; then 
  if [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]]; then
    latestNextExample="--next"
  elif [[ "$DWNSTM_BRANCH" == "${latestStableBranch}" ]]; then # latest stable branch
    latestNextExample="--latest"
  fi
fi

# upstream repos to fetch
UPSTREAM_FILE="${ROOTPATH}/upstream_repos.yml"

usage() {
  echo "
Usage:
* fetch & transform sources from upstream repos listed in $UPSTREAM_FILE
* transform Dockerfile to enable/disable osbs/cachito requirements
* transform app.title in app-config*.yaml to 'Red Hat Developer Hub'
* install deps, then build
* commit and push changes

Options:
    -f                        yaml file listing repos, branches, and plugins to build. Default: '${UPSTREAM_FILE##*/}'
    --force                   remove contents of sync/ folder to force a build to happen, even if no changes in upstream
                              will also push changes to midstream repo with --force
    --clean                   cleanup midstream sources before fetching new files
    --bundleonly              ONLY update the bundle folder w/ updated Containerfile version
    --bundleonly --force      ONLY update the bundle folder w/ updated Containerfile version, and newer related images
    --nobuild                 after fetching and transforming, do not run 'yarn install' and 'yarn build'
    --nocommit                do not commit or push local changes
    --nopush                  do not push local changes
    --no                      alias for '--nobuild --nocommit --nopush'
    --gitlab-pipeline-push    use this flag to push changes when running inside a gitlab pipeline
    -b DWNSTM_BRANCH          downstream branch to update w/ latest SHA; default: '$DWNSTM_BRANCH'
    --latest, --next          in addition to :1.y and :1.y-zz image tags, also create a :latest or :next tag 
    -y                        build and push to current branch, $(git branch --show-current || true), using all defaults

Examples:

    $0 --nobuild    --force --nopush ${latestNextExample} -b ${DWNSTM_BRANCH} 
    $0 --bundleonly --force --nopush ${latestNextExample} -b ${DWNSTM_BRANCH}
    $0 -y
"
  exit 1
}

if [[ "$#" -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
  '-f')
    UPSTREAM_FILE="$2"
    shift 2
    ;;
  '-b')
    DWNSTM_BRANCH="$2"
    shift 2
    ;;
  '--latest'|'--next') latestNext="${1/--/}"; shift 1;;
  '--force')
    FORCE="-f"
    #shellcheck disable=SC2044
    if [[ "${ROOTPATH}" ]]; then for d in $(find "${ROOTPATH}"/sync/ -type f); do echo "" > "$d"; done; fi
    shift 1
    ;;
  '--clean')
    CLEAN=1;
    shift 1
    ;;
  '--bundleonly')
    BUNDLEONLY=1; DO_BUILD=0
    shift 1
    ;;
  '--nobuild')
    DO_BUILD=0
    shift 1
    ;;
  '--nocommit')
    DO_COMMIT=0
    DO_PUSH=0
    shift 1
    ;;
  '--nopush')
    DO_PUSH=0
    shift 1
    ;;
  '--no')
    DO_BUILD=0
    DO_COMMIT=0
    DO_PUSH=0
    shift 1
    ;;
  '-y')
    DWNSTM_BRANCH="$(git branch --show-current || true)"
    DO_BUILD=1
    DO_COMMIT=1
    DO_PUSH=1
    shift 1
    ;;
  '--gitlab-pipeline-push')
    DO_PUSH=0
    GITLAB_PIPELINE="true"
    shift 1
    ;;
  '--container-nudge')
    DO_BUILD=0
    DO_PUSH=0
    DO_COMMIT=0
    CONTAINER_NUDGE="true"
    shift 1
    ;;
  '-h' | '--help')
    usage
    ;;
  *)
    echo "[ERROR] Invalid parameter: $1"
    echo
    usage
    ;;
  esac
done

if [[ ! -f $UPSTREAM_FILE ]]; then usage; fi
# if [[ ! $NAMESPACE ]]; then usage; fi

if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
fi

echo "#################################
Commandline switches:

CLEAN=$CLEAN
FORCE=$FORCE
DO_BUILD=$DO_BUILD
BUNDLEONLY=$BUNDLEONLY
DO_COMMIT=$DO_COMMIT
DO_PUSH=$DO_PUSH
GITLAB_PIPELINE=$GITLAB_PIPELINE
CONTAINER_NUDGE=$CONTAINER_NUDGE
#################################"

set -e

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

# from https://stackoverflow.com/questions/11268437/how-to-convert-string-to-integer-in-unix-shelll/59781257#59781257
int(){ printf '%d' "${1:-}" 2>/dev/null || :; }

checkImage () {
    local USE_QUAY="true"
    local QUIET=1

    checkImage_result=""
    local imageAndSHA="$1"
    imageAndSHA=${imageAndSHA/registry.redhat.io\/rhdh/quay.io\/rhdh}
    imageAndSHA=${imageAndSHA%%@*}
    imageOnly=${imageAndSHA%%:*}
    if [[ $QUIET -eq 0 ]]; then echo "For $imageAndSHA"; fi

    # echo "[DEBUG] Got image = $image"
    # shellcheck disable=SC2086
    image_version=$(skopeo inspect docker://${imageAndSHA} 2>/dev/null | jq -r '.Labels.version')
    # shellcheck disable=SC2086
    image_release=$(skopeo inspect docker://${imageAndSHA} 2>/dev/null | jq -r '.Labels.release')

    # echo "[DEBUG] For $imageOnly, got $image_version - $image_release"
    if [[ $image_version ]] && [[ $image_release ]]; then
        container=${imageOnly}:${image_version}-${image_release}
        digest="$(skopeo inspect "docker://${container}" 2>/dev/null | jq -r '.Digest' 2>/dev/null )"
        if [[ $digest ]]; then
          container="${container%:*}@$digest"
          if [[ $QUIET -eq 0 ]]; then echo "Got $container for ${imageOnly}:${image_version}-${image_release}"; else echo "       * $container (${imageOnly}:${image_version}-${image_release})"; fi
        else
          # try previous image
          # shellcheck disable=SC2086
          image_release=$(int $image_release)
          (( image_release = image_release-1 ))
          container=${imageOnly}:${image_version}-${image_release}
          digest="$(skopeo inspect "docker://${container}" 2>/dev/null | jq -r '.Digest' 2>/dev/null )"
          if [[ $digest ]]; then
            container="${container%:*}@$digest"
            if [[ $QUIET -eq 0 ]]; then echo "Got $container for ${imageOnly}:${image_version}-${image_release}"; else echo "       * $container (${imageOnly}:${image_version}-${image_release})"; fi
          else
            # no digest, so just use :tag
            container=${imageOnly}:${image_version}
            digest="$(skopeo inspect "docker://${container}" 2>/dev/null | jq -r '.Digest' 2>/dev/null )"
            if [[ $digest ]]; then
              container="${container%:*}@$digest"
            fi
            if [[ $QUIET -eq 0 ]]; then echo "Got $container for ${imageOnly}:${image_version}"; else echo "       * $container (${imageOnly}:${image_version})"; fi
          fi
        fi
        checkImage_result="$container"
    else
        if [[ ${imageAndSHA} == "quay.io/"* ]];then 
            echo "Not found"
        elif [[ $USE_QUAY != "true" ]]; then 
            echo "Not found; try --quay or -y flag to check same image on quay.io registry"
        fi
        if [[ "$USE_QUAY" == "true" ]]; then
            checkImage_result="NONE"
        fi
    fi
    # skopeo inspect docker://${container} | jq -r .Digest # note, this might be different from the input SHA, but still equivalent 
}

# get all upstream branches to avoid merge conflicts
if [[ $GITLAB_PIPELINE == "true" ]]; then
  # NOTE that if debugging PRIVATE_TOKEN with set -x, token will be revealed in plaintext, not obfuscated
  git remote rm origin; git remote add origin "https://${CI_PROJECT_NAME}:${PRIVATE_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_NAMESPACE}/${CI_PROJECT_NAME}.git"
  git remote set-branches origin "*" || true
  git fetch --all || true
  git checkout "${DWNSTM_BRANCH}" || true
  git pull origin "${DWNSTM_BRANCH}" || true
fi

# cleanup before fetching new files
if [[ $CLEAN -eq 1 ]]; then
  git checkout -- .
  git rm -rf --cached .
  git reset --hard HEAD
  git clean -fdx
fi
git config --global core.autocrlf input
git config --global core.eol input
git config --global pull.rebase true

# not sure we want these restrictions
# git config --global merge.ff only
# git config --global pull.ff only

# https://stackoverflow.com/questions/5480069/autosetuprebase-vs-autosetupmerge
git config --global branch.autosetupmerge true  # for tracking upstream 
git config --global branch.autosetuprebase always # to rebase (linear history) when pulling 

git config --global advice.skippedCherryPicks false
git config --global advice.detachedHead false
git config --global core.safecrlf false

# read "${UPSTREAM_FILE}" file; check out sources and include the required ones
NUM_REPOS=$(grep -v -E " +#" "${UPSTREAM_FILE}" | grep -c "repo:") # 2

# fp=0 # cound of fetched plugins from upstream
# cp=0 # count of converted/transformed plugins (midstreamed)

# upstream build metadata to add as ENV vars in the containers
upstream_repo_hub=""
upstream_repo_hub_branch=""
upstream_repo_op=""

commitMsg=""
# num_plugins=0 # total number of plugins to fetch/build
destination_folders=""
mkdir -p sync/
declare -A SKIPPED_CONTAINERS

BUNDLEDIR="" # absolute path distgit/containers/rhdh-operator-bundle/ folder

# if we're only doing the bundle start on repo 1; else start on the showcase (repo 0)
START_REPO=0; if [[ $BUNDLEONLY -eq 1 ]]; then START_REPO=1; fi
# shellcheck disable=SC2086,SC2295
for ((i = START_REPO; i < NUM_REPOS; i++)); do # echo $i
  # plugins__=""
  # plugins_collapsed=""
  repo=$(yq --arg i "$i" -r '.repos['$i'].repo' "${UPSTREAM_FILE}")
  reponame=${repo##*/}
  repoorg=${repo%/${reponame}}
  repoorg=${repoorg##*/}
  branch0=$(yq --arg i "$i" -r '.repos['$i'].branch[0]' "${UPSTREAM_FILE}")
  branch1=$(yq --arg i "$i" -r '.repos['$i'].branch[1]' "${UPSTREAM_FILE}")
  if [[ $(git ls-remote --heads $repo refs/heads/$branch0 | wc -l) -eq 1 ]]; then
    branch=$branch0
  elif [[ $(git ls-remote --heads $repo refs/heads/$branch1 | wc -l) -eq 1 ]]; then
    branch=$branch1
  else
    echo "[ERROR] Could not find $branch0 or $branch1 at $repo !"; exit 1
  fi
  
  destination_folder=$(yq --arg i "$i" -r '.repos['$i'].destination_folder' "${UPSTREAM_FILE}")
  CONTAINER_NAME=${destination_folder#distgit/containers/}; CONTAINER_NAME=${CONTAINER_NAME%/}; # echo $CONTAINER_NAME # rhdh-hub or rhdh-operator
  destination_folders="${destination_folders} ${destination_folder}"
  rm -fr "$TMPDIR/repo${i}"
  echo
  echo "[INFO] Fetch $repo into $TMPDIR/repo${i} from branch $branch, then sync to $destination_folder ..."
  git clone $repo -b $branch "$TMPDIR/repo${i}" --depth=3 && \
  pushd "$TMPDIR/repo${i}" >/dev/null || exit 1
    # set -x
    branch="$(git branch --show-current)"
    SHA="$(git rev-parse --short=8 HEAD)"
    if [[ $CONTAINER_NAME == "rhdh-hub" ]]; then
      upstream_repo_hub="$repo/tree/$branch @ $SHA"
      upstream_repo_hub_branch="$branch"
    elif [[ $CONTAINER_NAME == "rhdh-operator" ]] || [[ $CONTAINER_NAME == "rhdh-operator-bundle" ]]; then
      upstream_repo_op="$repo/tree/$branch @ $SHA"
      if [[ $upstream_repo_hub_branch == "" ]]; then upstream_repo_hub_branch="$branch"; fi
    fi

    # cat "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}"; echo "$SHA = $branch @ $repo"
    # if the current SHA file contains the current SHA/branch/repo combination, then there's nothing to sync! 
    if [[ -f "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}" ]] && [[ $(cat "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}") == *"$SHA = $branch @ $repo"* ]]; then
      if [[ ${CONTAINER_NAME} == "rhdh-hub" ]]; then 
        DO_BUILD=0
        echo "[INFO] Nothing changed in upstream repo: $SHA = $branch @ $repo; skip yarn build and sync!"
      else
        echo "[INFO] Nothing changed in upstream repo: $SHA = $branch @ $repo; skip sync!"
      fi
      SKIPPED_CONTAINERS[${#SKIPPED_CONTAINERS[@]}]="${CONTAINER_NAME}/"
      popd >/dev/null || exit 1
      # rm -fr $TMPDIR/repo${i}
      continue
    fi

    if [[ -f .gitmodules ]]; then
      sed -i .gitmodules -r -e "s#(url = )git@github.com:#\1https://github.com/#"
      cat .gitmodules
      git submodule init
      git submodule update
      git submodule status
      # run whatever setup steps we need to do to bring things offline
      if [[ -f Makefile ]] && [[ $(grep -E "^init:$" Makefile) == "init:" ]]; then
        make init
      fi
      rm -f .gitmodules
    fi
    echo
    SHA="$(git rev-parse --short=8 HEAD)"

    echo "$SHA = $branch @ $repo" > "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}"
    msg="${CONTAINER_NAME} from: $repo/tree/$branch @ $SHA"
    echo "[INFO] Update: $msg"
    commitMsg="${commitMsg} ${msg};"
    ##################################### rhdh-operator-bundle #####################################
    # if processing the upstream operator, also collect sync/upstream_SHA* file for operator-bundle
    if [[ $destination_folder == *"rhdh-operator"* ]]; then
      echo "$SHA = $branch @ $repo" > "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}-bundle"
      msg="${CONTAINER_NAME}-bundle from: $repo/tree/$branch @ $SHA"
      echo "[INFO] Update: $msg"
      commitMsg="${commitMsg} ${msg};"
    fi
    ##################################### rhdh-operator-bundle #####################################
  popd >/dev/null || exit 1
  # set +x

  # remove checked out files
  # shellcheck disable=SC2086
  if [[ $(yq --arg i "$i" -r '.repos['$i'].include_root' "${UPSTREAM_FILE}") == "false" ]]; then
    # rm -fr "$TMPDIR/repo${i}"
    continue
  else
    excludesList="$(yq --arg i "$i" -r '.repos['$i'].exclude_root[]' "${UPSTREAM_FILE}")"
    for ex in $excludesList; do
      excludesFlags="${excludesFlags} --exclude=${ex}"
    done
    echo -n "[INFO] [In $(pwd)] Sync upstream folder $TMPDIR/repo${i}/ to midstream ${destination_folder}... "
    pushd "$TMPDIR/" >/dev/null || exit 1
    # set -x
    rsync -azq --delete $TMPDIR/repo${i}/* $TMPDIR/repo${i}/.??* "${ROOTPATH}/${destination_folder}/" --exclude=.git ${excludesFlags}
    # set +x

    # ##################################### konflux containerfiles #####################################
    # if [[ $destination_folder == *"rhdh-hub"* ]]; then
    #   rsync -azq $TMPDIR/repo${i}/docker/Dockerfile "${ROOTPATH}/${destination_folder%/}/Containerfile" --exclude=.git ${excludesFlags}
    # elif [[ $destination_folder == *"rhdh-operator"* ]]; then
    #   rsync -azq $TMPDIR/repo${i}/docker/Dockerfile "${ROOTPATH}/${destination_folder%/}/Containerfile" --exclude=.git ${excludesFlags}
    #   rsync -azq $TMPDIR/repo${i}/docker/bundle.Dockerfile "${ROOTPATH}/${destination_folder%/}-bundle/Containerfile" --exclude=.git ${excludesFlags}
    # fi

    ##################################### rhdh-hub #####################################
    # if processing the upstream showcase/hub, also make some changes to the hub folder dowstream
    if [[ $destination_folder == *"rhdh-hub"* ]]; then
      rsync -azq $TMPDIR/repo${i}/.rhdh/docker/* "${ROOTPATH}/${destination_folder%/}/docker/" --exclude=.git ${excludesFlags}

      pushd "${ROOTPATH}/${destination_folder%/}" >/dev/null || exit 1
        # RHIDP-4014 konflux - remove e2e-tests folder entirely 
        rm -fr e2e-tests
      popd >/dev/null || exit 1
    fi

    ##################################### rhdh-operator-bundle #####################################
    # if processing the upstream operator, also make some changes to the operator-bundle folder dowstream
    if [[ $BUNDLEONLY -eq 1 ]] && [[ $destination_folder == *"rhdh-operator"* ]]; then
      echo " and ${destination_folder%/}-bundle ... "
      BUNDLEDIR="${ROOTPATH}/${destination_folder%/}-bundle"
      # copy the contents of bundle/rhdh/ into distgit/containers/rhdh-operator-bundle/
      # NOTE: if we add any .dotfiles in bundle/rhdh/, add $TMPDIR/repo${i}/bundle/.??* to regexes copied 
      rsync -azq --delete $TMPDIR/repo${i}/bundle/rhdh/* $TMPDIR/repo${i}/.gitignore "${BUNDLEDIR}/" --exclude=.git ${excludesFlags}
      # downstream CSV and annotations are stored in https://github.com/redhat-developer/rhdh-operator/tree/main/bundle/rhdh/manifests
      # append overrides from the .rhdh/ tree: CSV and annotations
      rsync -azq $TMPDIR/repo${i}/.rhdh/bundle/* "${BUNDLEDIR}/" --exclude=.git ${excludesFlags}
      # and copy .rhdh/docker/bundle.Dockerfile to Dockerfile.in
      rsync -azq $TMPDIR/repo${i}/.rhdh/docker/bundle.Dockerfile "${BUNDLEDIR}/Dockerfile.in"

      # remove files we don't need downstream in operator-bundle/ or operator/bundle/rhdh
      for bundle_dir in "${BUNDLEDIR}" "${ROOTPATH}/${destination_folder%/}/bundle/rhdh"; do 
        pushd "${bundle_dir}" >/dev/null || exit 1
          # shellcheck disable=SC2043
          for df in \
              backstage.io \
              rhdh \
            ; do 
            git rm -fr $df 2>/dev/null || rm -f $df 2>/dev/null || true
          done
        popd >/dev/null || exit 1
      done

      declare -A digest_mapping

      # shellcheck disable=SC2066
      for bundle_dir in "${BUNDLEDIR}"; do
        pushd "${bundle_dir}" >/dev/null || exit 1
          for yml in manifests/backstage-operator.clusterserviceversion.yaml manifests/rhdh-operator.clusterserviceversion.yaml; do
            if [[ -f $yml ]]; then
              echo "[INFO] Transform $bundle_dir/$yml ..."
              # upstream CSV uses references to quay.io => replace with registry.redhat.io
              # This is especially needed for example because quay.io/fedora/postgresql-15
              # for example is not the same as registry.redhat.io/rhel9/postgresql-15
              operatorImage=$(yq -r '.spec.install.spec.deployments[] | select (.name=="rhdh-operator") | .spec.template.spec.containers[] | select (.name == "manager") | .image' "$yml") # quay.io/rhdh/rhdh-rhel9-operator:1.5
              dhImageTag=${operatorImage##*:} # 1.5

              sed -i $yml -r \
                -e "s@quay.io/fedora/postgresql-15:@registry.redhat.io/rhel9/postgresql-15:@g" \
                -e "s@quay.io/rhdh/rhdh-hub-rhel9:.*@quay.io/rhdh/rhdh-hub-rhel9:$dhImageTag@g"

              # transform tags to digests
              # shellcheck disable=SC2013
              for imageAndSHA in $(cat $yml | grep -E "registry|quay.io" | sed -r "s/.+(containerImage|image|value): //g" | sort -u); do
                imageFloatingTag=${imageAndSHA%%@*}
                echo "         Compute digest for ${imageFloatingTag} ..."
                checkImage "${imageFloatingTag}"
                if [[ "$checkImage_result" == "NONE" ]]; then
                  if [[ "${imageFloatingTag}" != "quay.io/"* ]]; then # don't check quay again if we already did!
                    quayImage="${imageFloatingTag#*/}"
                    # transform brew rh-osbs/foo-foo-operator to quay foo/foo-operator
                    quayImage="$(echo "$quayImage" | sed -r -e "s@rh-osbs/([^-]+)-(.+)@\1/\2@")"
                    checkImage "quay.io/${quayImage}"
                  fi
                fi
                # echo "Got $checkImage_result for $imageAndSHA"
                if [[ "$checkImage_result" != "NONE" ]]; then
                  digest_mapping["${imageAndSHA}"]="${checkImage_result}"
                  digest_mapping["${imageFloatingTag}"]="${checkImage_result}"
                  sed -i $yml -r -e "s|$imageAndSHA|$checkImage_result|g" 
                  # git diff $yml
                else
                  echo "[ERROR] Could not compute digest for $imageAndSHA or $imageFloatingTag !"; exit 1
                fi
              done
              sed -i $yml -r \
                  -e "s@registry-proxy.engineering.redhat.com/rh-osbs/([^-]+)-(.+)@registry.redhat.io/\1/\2@g" \
                  -e "s@quay.io/rhdh/@registry.redhat.io/rhdh/@g"
              if [[ $(git diff --name-only $yml) ]]; then # also update createdAt timestamp
                now=$(date -u +%FT%TZ) # "2023-12-18T16:11:34Z"
                echo "[INFO] Set createdAt: $now in $yml"
                sed -i $yml -r \
                    -e "s/createdAt: \"[0-9TZ:-]+\"/createdAt: \"${now}\"/g"
              fi
            fi
          done

          # replace upstream refs in configmap
            # image: quay.io/fedora/postgresql-15:latest
            # image: quay.io/rhdh/rhdh-hub-rhel9:next
          yml=manifests/rhdh-default-config_v1_configmap.yaml
          echo -e "\n[INFO] Transform $bundle_dir/$yml ..."
          sed -i $yml -r \
              -e "s@quay.io/fedora/postgresql-15:.+@registry.redhat.io/rhel9/postgresql-15:latest@g" \
              -e "s@quay.io/rhdh/rhdh-hub-rhel9:.*@quay.io/rhdh/rhdh-hub-rhel9:$dhImageTag@g"
          for d in registry.redhat.io/rhel9/postgresql-15:latest quay.io/rhdh/rhdh-hub-rhel9:$dhImageTag; do
            if [[ ! ${digest_mapping[$d]} ]]; then 
              checkImage "$d"
              echo "       + Got $checkImage_result for $d"
              if [[ "$checkImage_result" != "NONE" ]]; then
                digest_mapping["${d}"]="${checkImage_result}"
              fi
            else
              echo "       > Use ${digest_mapping[$d]} for $d"
              checkImage_result="${digest_mapping[$d]}"
            fi
            if [[ "$checkImage_result" != "NONE" ]]; then
              sed -i $yml -r -e "s|$d|$checkImage_result|g" 
            fi
          done
          sed -i $yml -r -e "s@quay.io/rhdh/@registry.redhat.io/rhdh/@g"
          # debugging: show contents after transformation
          # grep "image:" $yml
        popd >/dev/null || exit 1
      done

      pushd "${BUNDLEDIR}" >/dev/null || exit 1
        yml=manifests/rhdh-operator.clusterserviceversion.yaml
        echo -e "\n[INFO] Replace backstage CSV in $BUNDLEDIR/manifests ..."
        # use rhdh-operator.clusterserviceversion.yaml instead of backstage-operator as we need the product name in konflux configs
        git mv -f manifests/{backstage,rhdh}-operator.clusterserviceversion.yaml >/dev/null 2>&1 || \
            mv -f manifests/{backstage,rhdh}-operator.clusterserviceversion.yaml >/dev/null 2>&1 
        git add . || true
      popd >/dev/null || exit 1
    fi
    ##################################### rhdh-operator-bundle #####################################

    popd >/dev/null || exit 1
    # rm -fr "$TMPDIR/repo${i}"
    echo "done."; echo
  fi

  echo "[INFO] Process files in ${destination_folder} ..."
  pushd "${destination_folder}" >/dev/null || exit 1

    ##################################### rhdh-hub #####################################
    if [[ $destination_folder == *"rhdh-hub"* ]]; then

      # remove tests
      sed -i Containerfile -r -e "/e2e-tests/d"

      # set MIDSTREAM_REPO env var in Konflux Containerfile
      midstream_repo_and_SHA="https://$(git remote -v | grep origin | grep -v push | sed -r -e "s|.+@(.+)\.git.+|\1|" | tr ":" "/")/-/commits/$(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short=8 HEAD)"
      sed -i Containerfile -r -e "s|(MIDSTREAM_REPO=)\".+\"|\1\"${midstream_repo_and_SHA}\"|"

      # set build-metadata.json info, using upstream info: ${ROOTPATH}/sync/upstream_SHA_rhdh-hub ==> redhat-developer/rhdh main @ 2ff35695
      now="$(date -u +%FT%TZ)";
      sed -i packages/app/src/build-metadata.json -r \
        -e 's|"Last Commit": "(.+)"|"Upstream": "'"$upstream_repo_hub"'", "Midstream": "'"$midstream_repo_and_SHA"'", "Build Time": "'"$now"'"|'
    fi
    ##################################### rhdh-hub #####################################

    # transform Dockerfile to Dockerfile.in; enable/disable osbs/cachito requirements
    # find the right file from one of several path options
    # NOTE: this transformation only works for hub and operator, not for .rhdh/docker/bundle.Dockerfile!
    DOCKERFILE_OPTIONS=".rhdh/docker/Dockerfile Dockerfile"
    for d in $DOCKERFILE_OPTIONS; do
      if [[ -f $d ]]; then
        echo "[INFO] Convert $d to ${destination_folder}Dockerfile.in ..."
        DOCKERFILE="$d"
        awk '
/# Downstream comment/{
  found_comment=1 # start a commenting block
  print $0
  next
}
/# Downstream uncomment/{
  found_uncomment=1 # start a commenting block
  print $0
  next
}
/#\/ Downstream comment/{
  found_comment=0 # end a commenting block
  print $0
  next
}
/#\/ Downstream uncomment/{
  found_uncomment=0 # end a commenting block
  print $0
  next
}
/.*/ {
  if (!found_comment && !found_uncomment) {
    print $0 # print the line as is
  }
  if(found_uncomment){ # uncomment the line
    print gensub(/^# (.+)/,"\\1", "g")
  }
  if(found_comment){ # comment the line
    print "# "gensub(/^# (.+)/,"\\1", "g")
  }
}
' $DOCKERFILE > Dockerfile.in
        # if [[ -f Dockerfile.in ]]; then 
        #   echo "######################## ${destination_folder}Dockerfile.in ########################"
        #   cat Dockerfile.in
        #   echo "######################## ${destination_folder}Dockerfile.in ########################"
        # fi

        rm -f $DOCKERFILE
        break
      fi
    done

  popd >/dev/null || exit 1 # distgit/containers/*
done                        # foreach upstream repo

if [[ "${#SKIPPED_CONTAINERS[@]}" == "$NUM_REPOS" ]]; then 
  echo " 
=================================================================
[SKIP] Nothing to sync or build: ${#SKIPPED_CONTAINERS[@]} of $NUM_REPOS upstream repos unchanged!
=================================================================
" | tee /tmp/sync-midstream.sh.result.txt
  ./build/ci/cancel-pipeline.sh
  exit 0
fi

# use this to set ENV var in container image so we can get this via skopeo inspect without downloading the container image
# upstream_repo_and_SHA__hub=$(sed -r -e "s|([0-9a-f]+) = (.+) @ .+/([^/]+/[^/]+)|\3 \2 @ \1|" "${ROOTPATH}/sync/upstream_SHA_rhdh-hub")
# upstream_repo_and_SHA__operator=$(sed -r -e "s|([0-9a-f]+) = (.+) @ .+/([^/]+/[^/]+)|\3 \2 @ \1|" "${ROOTPATH}/sync/upstream_SHA_rhdh-operator")
midstream_repo="https://gitlab.cee.redhat.com/rhidp/rhdh/-/commits/${DWNSTM_BRANCH}"
echo "Using upstream repo(s):"
[[ ${upstream_repo_hub} ]] && echo "* hub: ${upstream_repo_hub}"
[[ ${upstream_repo_op} ]]  && echo "* operator: ${upstream_repo_op}"
echo "Using midstream_repo:
* ${midstream_repo}
"

latestNextTag=""; if [[ $latestNext ]]; then latestNextTag="${latestNext}, "; fi 

if [[ $BUNDLEONLY -eq 0 ]]; then

  # append Brew metadata here
  for c in distgit/containers/rhdh-hub/Dockerfile.in distgit/containers/rhdh-hub/Dockerfile distgit/containers/rhdh-hub/Containerfile; do
    if [[ -f $c ]]; then sed -i '/# append Brew metadata here/q' $c; fi
  done
  cat <<EOT >$TMPDIR/hub.Dockerfile.foot
ENV SUMMARY="Red Hat Developer Hub container" \\
    DESCRIPTION="Red Hat Developer Hub container" \\
    UPSTREAM_REPO="${upstream_repo_hub}" \\
    MIDSTREAM_REPO="${midstream_repo}" \\
    PRODNAME="rhdh" \\
    COMPNAME="hub"

LABEL summary="\$SUMMARY" \\
      description="\$DESCRIPTION" \\
      io.k8s.description="\$DESCRIPTION" \\
      io.k8s.display-name="\$DESCRIPTION" \\
      io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
      com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
      name="\$PRODNAME/\$PRODNAME-\$COMPNAME-rhel9" \\
      version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
      release="\${RELEASE_NUMBER}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      vendor="Red Hat, Inc." \\
      io.openshift.expose-services="" \\
      usage="" \\
      konflux.additional-tags="${latestNextTag}\${CI_X_VERSION}.\${CI_Y_VERSION}, \${CI_X_VERSION}.\${CI_Y_VERSION}-\${RELEASE_NUMBER}" \\
      distribution-scope="public" \\
      url="https://red.ht/rhdh"
EOT
  echo "[INFO] Added metadata to $TMPDIR/hub.Dockerfile.foot"

  mkdir -p distgit/containers/rhdh-hub/.git/
  cat <<EOT >distgit/containers/rhdh-hub/.git/config
[core]
  repositoryformatversion = 0
  filemode = true
  bare = false
  logallrefupdates = true
  hooksPath = .husky
  autocrlf = input
EOT
  echo "[INFO] Generated distgit/containers/rhdh-hub/.git/config for use with Husky"

  # append Brew metadata here
  # set -x
  for c in distgit/containers/rhdh-operator/Dockerfile.in distgit/containers/rhdh-operator/Dockerfile distgit/containers/rhdh-operator/Containerfile; do
    if [[ -f $c ]]; then sed -i '/# append Brew metadata here/q' $c; fi
  done
  # set +x
  cat <<EOT >$TMPDIR/operator.Dockerfile.foot
ENV SUMMARY="Red Hat Developer Hub operator" \\
    DESCRIPTION="Red Hat Developer Hub operator" \\
    UPSTREAM_REPO="${upstream_repo_op}" \\
    MIDSTREAM_REPO="${midstream_repo}" \\
    PRODNAME="rhdh" \\
    COMPNAME="operator"

LABEL summary="\$SUMMARY" \\
      description="\$DESCRIPTION" \\
      io.k8s.description="\$DESCRIPTION" \\
      io.k8s.display-name="\$DESCRIPTION" \\
      io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
      com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
      name="\$PRODNAME/\$PRODNAME-rhel9-\$COMPNAME" \\
      version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
      release="\${RELEASE_NUMBER}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      vendor="Red Hat, Inc." \\
      io.openshift.expose-services="" \\
      usage="" \\
      konflux.additional-tags="${latestNextTag}\${CI_X_VERSION}.\${CI_Y_VERSION}, \${CI_X_VERSION}.\${CI_Y_VERSION}-\${RELEASE_NUMBER}" \\
      distribution-scope="public" \\
      url="https://red.ht/rhdh"
EOT
  echo "[INFO] Added metadata to $TMPDIR/operator.Dockerfile.foot"
fi

if [[ $BUNDLEONLY -eq 1 ]]; then
  for c in \
      distgit/containers/rhdh-operator-bundle/Dockerfile.in \
      distgit/containers/rhdh-operator-bundle/Dockerfile \
      distgit/containers/rhdh-operator-bundle/Containerfile \
      distgit/containers/rhdh-operator-bundle/Containerfile.sealights; do
    if [[ -f $c ]]; then 
      echo "Adjust $c to add downstream metadata"
      sed -i '/# append Brew metadata here/q' $c
    fi
  done
  cat <<EOT >$TMPDIR/operator-bundle.Dockerfile.foot
ENV SUMMARY="Red Hat Developer Hub operator bundle" \\
    DESCRIPTION="Red Hat Developer Hub operator bundle" \\
    UPSTREAM_REPO="${upstream_repo_op}" \\
    MIDSTREAM_REPO="${midstream_repo}" \\
    PRODNAME="rhdh" \\
    COMPNAME="operator-bundle"

LABEL operators.operatorframework.io.bundle.mediatype.v1=registry+v1 \\
      operators.operatorframework.io.bundle.manifests.v1=manifests/ \\
      operators.operatorframework.io.bundle.metadata.v1=metadata/ \\
      operators.operatorframework.io.bundle.package.v1=rhdh \\
      operators.operatorframework.io.bundle.channels.v1=fast,fast-\${CI_X_VERSION}.\${CI_Y_VERSION} \\
      operators.operatorframework.io.bundle.channel.default.v1=fast \\
      com.redhat.delivery.operator.bundle="true" \\
      com.redhat.openshift.versions="v4.12" \\
      com.redhat.delivery.backport=false \\
      summary="\$SUMMARY" \\
      description="\$DESCRIPTION" \\
      io.k8s.description="\$DESCRIPTION" \\
      io.k8s.display-name="\$DESCRIPTION" \\
      io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
      com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
      name="\$PRODNAME/\$PRODNAME-\$COMPNAME" \\
      version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
      vendor="Red Hat, Inc." \\
      release="\${RELEASE_NUMBER}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      io.openshift.expose-services="" \\
      usage="" \\
      konflux.additional-tags="${latestNextTag}\${CI_X_VERSION}.\${CI_Y_VERSION}, \${CI_X_VERSION}.\${CI_Y_VERSION}-\${RELEASE_NUMBER}" \\
      distribution-scope="public" \\
      url="https://red.ht/rhdh"
EOT
  echo "[INFO] Added metadata to $TMPDIR/operator-bundle.Dockerfile.foot"
fi

# build the plugins
if [[ $DO_BUILD -eq 0 ]]; then
  # TODO do we still need these yarn 1 leftovers?
  # destination_folder="distgit/containers/rhdh-hub"
  # pushd $destination_folder >/dev/null || exit 1
  #   #shellcheck disable=SC2044
  #   YARN=$(which yarn)
  #   export YARN
  #   $YARN config set enableStrictSsl false
  #   $YARN config set httpTimeout 600000
  # popd >/dev/null || exit 1
  true
else
  haderror=0

  destination_folder="distgit/containers/rhdh-hub"
  pushd $destination_folder >/dev/null || exit 1
    echo "
 
=================================================================
[INFO] Build $(pwd) ...
=================================================================
 
" | tee /tmp/sync-midstream.sh.build.log.txt

    # Redirect console output and errors to a log file to make this log shorter
    exec 3>&1 4>&2 1>> /tmp/sync-midstream.sh.build.log.txt 2>> /tmp/sync-midstream.sh.build.log.txt

    echo
    #shellcheck disable=SC2044
    YARN=$(which yarn)
    export YARN
    $YARN config set enableStrictSsl false
    # $YARN config set unsafe-perm true # not sure what the Yarn 3 equivalent is here or if we still need this
    $YARN config set httpTimeout 600000
    $YARN config --verbose
    echo -n "Yarn version ($YARN): "; $YARN --version
    echo

    echo "[INFO] ===================================== INSTALL =====================================>"
    # suppress warnings with: >(grep -v warning 1>&2)
    if ! time $YARN install --no-immutable --silent; then
      (( haderror = haderror + 40 ))
    fi
    # if we need node-gyp to be globally installed in gitlab runner, re can re-enable this
    # if [[ $(id -u) -eq 0 ]]; then
    #   time npm i -g node-gyp@^9.4.1 turbo prettier
    # fi
    # for d in node-gyp turbo prettier; do echo -n "$d : "; $d --version; done;
    echo "[INFO] <===================================== INSTALL ====================================="
    echo

    echo "[INFO] ===================================== EXPORT + COPY DYNAMIC PLUGINS =====================================>"
    # see (brew.)Dockerfile for more details about these steps
    echo -n "Yarn version ($YARN): ";  $YARN --version
    if ! time $YARN export-dynamic; then
      (( haderror = haderror + 41 ))
    fi
    if ! time $YARN copy-dynamic-plugins dist; then
      (( haderror = haderror + 42 ))
    fi
    echo "[INFO] <===================================== EXPORT + COPY DYNAMIC PLUGINS ====================================="
    echo
  popd >/dev/null || exit 1

  echo "[INFO] ====================== Remove node_modules and other generated / gitignored content =====================>"
  set +x
  set +e
  # shellcheck disable=SC2086
  for ignored in \
    node_modules \
    .DS_Store \
    logs \
    *.log *debug.log* *error.log* \
    coverage \
    .env .env.test \
    dist-types dist-scalprum \
    cache \
    *.swp site *.local.yaml \
    .rhdh \
    *.session.sql .turbo; do
      find distgit/containers/rhdh-*/ -name "${ignored}" -exec rm -fr {} \; 2>/dev/null
  done
  # shellcheck disable=SC2043
  for ignored in \
    dist; do
      find distgit/containers/rhdh-*/packages/ -name "${ignored}" -exec rm -fr {} \; 2>/dev/null
  done
  # same package.json+yarn.lock present in dynamic-plugins/wrappers/ so we don't need dynamic-plugins/dist/ too
  rm -fr \
    distgit/containers/rhdh-hub/dynamic-plugins-root/* \
    distgit/containers/rhdh-hub/dynamic-plugins/dist/ \
    distgit/containers/rhdh-hub/dynamic-plugins/wrappers/*/dist-dynamic/src \
    distgit/containers/rhdh-hub/dynamic-plugins/wrappers/*/dist-dynamic/yarn.lock \
    distgit/containers/rhdh-hub/dynamic-plugins/*/dist-dynamic/src
  touch distgit/containers/rhdh-hub/dynamic-plugins-root/.gitkeep

  echo "[INFO] <===================== Remove node_modules and other generated / gitignored content ====================="
  echo
  set -e

    echo "[INFO] ===================================== Configure cachito =====================================>"
    # switch from yarn to npm registry, in case this makes Cachito happier?
  # Could not download types-jest-29.5.7.tgz from https://cachito-nexus.engineering.redhat.com/repository/cachito-yarn-1047885/@types/jest/-/jest-29.5.7.tgz
  # shellcheck disable=SC2044
  for d in $(find distgit/containers/rhdh-hub/ -name yarn.lock); do sed -i "$d" -r -e "s#registry.yarnpkg.com#registry.npmjs.org#g"; done

  # shellcheck disable=SC2086
  echo "[INFO] <===================================== Configure cachito ====================================="
  echo
  # end console redirection of output and errors
  exec 1>&3 3>&- 2>&4 4>&- 
fi ## if DO_BUILD

# shellcheck disable=SC2181
if [[ $? -gt 0 ]] || [[ $haderror -gt 0 ]]; then 
  echo "[ERROR] Build error occurred!";
  cat /tmp/sync-midstream.sh.build.log.txt
else
  # TODO optionally do we want a --debug flag to show the log?
  if [[ $DO_BUILD -eq 1 ]]; then 
    echo "[INFO] Build passed (lengthy yarn log suppressed)."
  fi
fi

# compute x.y version from package.json upstream
# TODO RHIDP-1022 switch to rhdh repo instead of showcase
showcasePackageJson="https://raw.githubusercontent.com/redhat-developer/rhdh/refs/heads/$upstream_repo_hub_branch/package.json"
DH_VERSION=$(curl -sSLko- "$showcasePackageJson" | yq -r '.version') # 1.5.0
DH_VERSION=${DH_VERSION%.*} # 1.2
echo "[INFO] Got DH_VERSION = $DH_VERSION from $showcasePackageJson #.version"

if [[ $BUNDLEONLY -eq 1 ]]; then
  these_dirs="distgit/containers/rhdh-operator-bundle"
else
  these_dirs="distgit/containers/rhdh-hub distgit/containers/rhdh-operator" # distgit/containers/rhdh-operator-bundle
fi
# set -x
for d in $these_dirs; do
  if [[ $d == "distgit/containers/rhdh-hub" ]] && [[ " ${SKIPPED_CONTAINERS[*]} " == *"rhdh-hub/"* ]]; then
    echo "[INFO] ======= Skip rhdh-hub ======="
    continue
  elif [[ $d == "distgit/containers/rhdh-operator" ]] && [[ " ${SKIPPED_CONTAINERS[*]} " == *"rhdh-operator/"* ]]; then
    echo "[INFO] ======= Skip rhdh-operator ======="
    continue
  elif [[ $d == "distgit/containers/rhdh-operator-bundle" ]] &&[[ " ${SKIPPED_CONTAINERS[*]} " == *"rhdh-operator-bundle/"* ]]; then
    echo "[INFO] ======= Skip rhdh-operator-bundle ======="
    continue
  fi
  echo "[INFO] Remove generated/ignored content from $d/"
  pushd "$d" >/dev/null || exit 1
    set +e
    # shellcheck disable=SC2086
    for ignored in \
      node_modules \
      *.pack *.pack.old .webpack-cache \
      .DS_Store \
      logs \
      *.log *debug.log* *error.log* \
      coverage \
      .env .env.test \
      dist-types \
      cache \
      *.swp site *.local.yaml \
      .rhdh \
      install-state.gz \
      *.session.sql .turbo; do
        find . -name "${ignored}" -exec rm -fr {} \; 2>/dev/null
    done
    set -e

    # ls -1 Containerfile Dockerfile* || true
    
    # set -x
    if [[ -f Dockerfile.in ]]; then 
      echo "[INFO] Regen Containerfile from Dockerfile.in [$(pwd), ${d}] ..."
      sed -r -e 's|\$\{CI_X_VERSION\}\.\$\{CI_Y_VERSION\}|'"$DH_VERSION"'|g' Dockerfile.in > Dockerfile
    fi

    ## generate Containerfile for Konflux
    if [[ $d == "distgit/containers/rhdh-hub" ]] && [[ " ${SKIPPED_CONTAINERS[*]} " != *"rhdh-hub/"* ]]; then
      cp -f Dockerfile Containerfile
    elif [[ $d == "distgit/containers/rhdh-operator" ]] && [[ " ${SKIPPED_CONTAINERS[*]} " != *"rhdh-operator/"* ]]; then
      # for operator use the transformed Dockerfile.in with the correct LABEL and ENV  values
      cp -f Dockerfile Containerfile
    elif [[ $d == "distgit/containers/rhdh-operator-bundle" ]] && [[ " ${SKIPPED_CONTAINERS[*]} " != *"rhdh-operator-bundle/"* ]]; then
      # for bundle use the downstream OSBS Dockerfile with the correct LABEL and ENV  values
      cp -f Dockerfile Containerfile
    fi

    if [[ -f "$TMPDIR/${d##*rhdh-}.Dockerfile.foot" ]]; then
      for CONTAINERFILE in Containerfile Containerfile.sealights; do
        if [[ -f $CONTAINERFILE ]]; then
          echo "[INFO] Append metadata to $CONTAINERFILE ..."
          sed -i '/# append Brew metadata here/q' $CONTAINERFILE
        
          cat "$TMPDIR/${d##*rhdh-}.Dockerfile.foot" >> $CONTAINERFILE
          sed -r -e 's|\$\{CI_X_VERSION\}\.\$\{CI_Y_VERSION\}|'"$DH_VERSION"'|g' -i "$CONTAINERFILE"
        fi
      done
    fi
    # set +x

    ##################################### set NVR values for Konflux #####################################
    # remove release= value from Dockerfile (OSBS creates this)
    sed -r -i '/release=".+"/d' Dockerfile
    # set release value in Containerfile (Konflux does not do this)
    nextReleaseNum=000
    # set -x
    # NOTE: to also check for latest NVRs in Brew, use getNextReleaseNum.sh --check-nvr (obsolete as of 1.4+)
    if [[ $d == "distgit/containers/rhdh-hub" ]]; then
      image=rhdh/rhdh-hub-rhel9
      nextReleaseNum=$("${ROOTPATH}"/build/scripts/getNextReleaseNum.sh -b "${DWNSTM_BRANCH}" --tag "${DH_VERSION}" -c "$image" -q)
    elif [[ $d == "distgit/containers/rhdh-operator" ]]; then
      image="rhdh/rhdh-rhel9-operator"
      nextReleaseNum=$("${ROOTPATH}"/build/scripts/getNextReleaseNum.sh -b "${DWNSTM_BRANCH}" --tag "${DH_VERSION}" -c "$image" -q)
    elif [[ $d == "distgit/containers/rhdh-operator-bundle" ]]; then
      image="rhdh/rhdh-operator-bundle"
      nextReleaseNum=$("${ROOTPATH}"/build/scripts/getNextReleaseNum.sh -b "${DWNSTM_BRANCH}" --tag "${DH_VERSION}" -c "$image" -q)
    fi
    # when bootstrapping the first builds for a new 1.yy stream, use just 1.yy-1
    if [[ $nextReleaseNum -eq 0 ]]; then nextReleaseNum=1; fi
    echo "[INFO] Set image version and release: $image:$DH_VERSION-$nextReleaseNum"
    for CONTAINERFILE in Containerfile Containerfile.sealights; do
      if [[ -f $CONTAINERFILE ]]; then
        sed -r -e 's|\$\{RELEASE_NUMBER\}|'"$nextReleaseNum"'|' -i $CONTAINERFILE
      fi
    done
    set +x
    ##################################### set NVR values for Konflux #####################################

    ##################################### fix SEGMENT_WRITE_KEY for rhdh-1.y branches ONLY ##################################### 
    if [[ $d == "distgit/containers/rhdh-hub" ]] && [[ $DWNSTM_BRANCH == "rhdh-1."*"-rhel-9" ]]; then
        sed -i Containerfile -r -e "s|(.*SEGMENT_WRITE_KEY=).*|\1$SEGMENT_WRITE_KEY|g"
        echo "[INFO] Use SEGMENT_WRITE_KEY = $SEGMENT_WRITE_KEY for branch $DWNSTM_BRANCH"
    fi
    ##################################### fix SEGMENT_WRITE_KEY for rhdh-1.y branches ONLY ##################################### 

    ##################################### update the RPM lock files to make Cachi2 and ECP happy ##################################### 
    if [[ $d == "distgit/containers/rhdh-hub" ]] || [[ $d == "distgit/containers/rhdh-operator" ]]; then
      if [[ -f rpms.in.yaml ]] && [[ -f rpms.lock.yaml ]]; then
        set -x
        if [[ $(which rpm-lockfile-prototype 2>&1) == *"no rpm-lockfile-prototype in"* ]]; then 
          echo "Installing rpm-lockfile-prototype ... "
          sudo dnf -q -y install python3 python3-pip python3-dnf
          mkdir -p "${HOME}/.local/bin/"
          python3 -m pip install --user https://github.com/konflux-ci/rpm-lockfile-prototype/archive/refs/heads/main.zip
          export PATH=${PATH%":${HOME}/.local/bin"}:${HOME}/.local/bin
        fi
        echo "[INFO] Regen $d/rpms.lock.yaml from Containerfile + rpms.in.yaml"
        which rpm-lockfile-prototype
        /usr/local/bin/rpm-lockfile-prototype -f Containerfile rpms.in.yaml # >/dev/null 2>&1 
        set +x
      fi
    fi

    ##################################### update the RPM lock file to make Cachi2 and ECP happy ##################################### 

    ##################################### rhdh-operator-bundle #####################################
    # generate annotations from upstream file in .rhdh/bundle/metadata/annotations.yaml
    if [[ $d == "distgit/containers/rhdh-operator-bundle" ]] && [[ -f metadata/annotations.yaml ]]; then 
      sed -r -e 's|\$\{CI_X_VERSION\}\.\$\{CI_Y_VERSION\}|'"$DH_VERSION"'|' -i metadata/annotations.yaml
    fi
    ##################################### rhdh-operator-bundle #####################################
  popd >/dev/null || exit 1
done

# revert local changes if running locally or in gitlab, but skip if inside a Containerfile build
revertFiles() {
  d="$1"
  if [[ -f $d ]] || [[ -d $d ]]; then git restore --staged "$d" || true; git restore "$d" || true; fi
}

# revert any local changes to the hub so we don't accidentally push in changes from upstream without first running a yarn build
# want to keep changes to distgit/containers/rhdh-hub/packages/app/src/build-metadata.json ! 
if [[ $CONTAINER_NUDGE != "true" ]]; then
  if [[ $BUNDLEONLY -eq 1 ]]; then
    for d in \
      distgit/containers/rhdh-hub/ \
      distgit/containers/rhdh-operator/ \
      sync/upstream_SHA_rhdh-hub \
      sync/upstream_SHA_rhdh-operator \
      ; do revertFiles "$d"
    done
    rm -fr distgit/containers/rhdh-operator/.rhdh/
  else
    if [[ $DO_BUILD -eq 0 ]]; then
      for d in \
        distgit/containers/rhdh-hub/.nvm/ \
        distgit/containers/rhdh-hub/python/ \
        distgit/containers/rhdh-hub/dynamic-plugins/ \
        distgit/containers/rhdh-hub/e2e-tests/ \
        distgit/containers/rhdh-hub/packages/app/public/ \
        distgit/containers/rhdh-hub/packages/backend/ \
        distgit/containers/rhdh-hub/yarn.lock \
        ; do revertFiles "$d"
      done
    fi
    for d in \
      distgit/containers/rhdh-operator-bundle/ \
      sync/upstream_SHA_rhdh-operator-bundle \
      ; do revertFiles "$d"
    done

    # revert the single change to bump the version if no other changes
    # shellcheck disable=SC2143
    if [[ $(git diff --name-only distgit/containers/rhdh-hub) == "distgit/containers/rhdh-hub/Containerfile" ]] && \
       [[ $(git diff distgit/containers/rhdh-hub/Containerfile | grep -v -E "^\+\+\+|release=|konflux.additional-tags=" | grep -E "^\+") == "" ]]; then
      revertFiles "distgit/containers/rhdh-hub/Containerfile"
    fi
    # shellcheck disable=SC2143
    if [[ $(git diff --name-only distgit/containers/rhdh-operator) == "distgit/containers/rhdh-operator/Containerfile" ]] && \
       [[ $(git diff distgit/containers/rhdh-operator/Containerfile | grep -v -E "^\+\+\+|release=|konflux.additional-tags=" | grep -E "^\+") == "" ]]; then
      revertFiles "distgit/containers/rhdh-operator/Containerfile"
    fi
  fi
fi

# purge any files we definitely don't want downstream, including things that confuse snyk/clair scans
# remove rhdh-operator/bundle folder so we don't have upstream dockerfiles or CSVs referencing unpinned digests or quay.io images
# shellcheck disable=SC2086
for d in \
  distgit/containers/rhdh-hub/Dockerfile \
  distgit/containers/rhdh-hub/Dockerfile.in \
  distgit/containers/rhdh-hub/docker/Dockerfile \
  distgit/containers/rhdh-hub/docker/Dockerfile.in \
  \
  distgit/containers/rhdh-operator/bundle \
  distgit/containers/rhdh-operator/Dockerfile \
  distgit/containers/rhdh-operator/Dockerfile.in \
  distgit/containers/rhdh-operator/docker/Dockerfile \
  distgit/containers/rhdh-operator/docker/Dockerfile.in \
  \
  distgit/containers/rhdh-operator-bundle/Dockerfile \
  distgit/containers/rhdh-operator-bundle/Dockerfile.in \
  distgit/containers/rhdh-operator-bundle/docker/Dockerfile \
  distgit/containers/rhdh-operator-bundle/docker/Dockerfile.in \
  distgit/containers/rhdh-operator-bundle/bundle.Dockerfile \
  ; do git rm -fr $d >/dev/null 2>&1 || rm -fr $d >/dev/null 2>&1 
done

# Konflux performance workaround
# set concurrency for turbo commands so that builds don't run our of file handles / disk space / memory (instead of default 10)
# concurrency=4 crashes the build, so use 1? maybe 2 will also work?
# +    "export-dynamic": "turbo run export-dynamic --concurrency=z",
# +    "export-dynamic:clean": "turbo run export-dynamic:clean --concurrency=z",
if [[ -f distgit/containers/rhdh-hub/package.json ]]; then
  sed -i distgit/containers/rhdh-hub/package.json -r -e 's| --concurrency=[0-9]+||g' -e 's|("export-dynamic.+)",|\1 --concurrency=1",|'
fi

echo
if [[ $(git status -s || true) ]]; then
  echo "################# DIFF #############################>"
  echo "[INFO] Commit changes in $(pwd):"
  git status -s || true
  echo "<################# DIFF #############################"
else
  echo "[INFO] No new changes to commit in $(pwd)! "
fi
echo

################################# COMMIT CHANGES #################################

if [[ $DO_COMMIT -eq 1 ]]; then
  if [[ $BUNDLEONLY -eq 1 ]]; then
    echo "[INFO] Committing changes to ${destination_folders/operator/operator-bundle} dir and sync/upstream_SHA* files ..."
    gitdiff="$(git diff --name-only || true)"
    # shellcheck disable=SC2086
    git add -f ${destination_folders/operator/operator-bundle} sync/upstream_SHA*bundle || true
  else 
    echo "[INFO] Committing changes to $destination_folders dirs and sync/upstream_SHA* files ..."
    gitdiff="$(git diff --name-only || true)"
    # shellcheck disable=SC2086
    git add -f ${destination_folders} sync/upstream_SHA* || true
  fi
  if [[ $gitdiff ]]; then
    echo "
==============================================================
[INFO] Midstream diff:

$gitdiff

==============================================================
"
echo "$gitdiff" > "/tmp/sync-midstream.sh.diff.txt"
  else
    echo " 
==============================================================
[SKIP] Nothing to sync: midstream diff is empty!
==============================================================
" | tee /tmp/sync-midstream.sh.result.txt
    ./build/ci/cancel-pipeline.sh
  fi

  ## include license files from hub and operator in /licenses folder to make Konflux happy
  [[ $BUNDLEONLY -eq 1 ]] && LICENSE_DIRS="rhdh-operator-bundle" || LICENSE_DIRS="rhdh-hub rhdh-operator" 
  for d in $LICENSE_DIRS; do
    if [[ -f distgit/containers/${d}/LICENSE ]]; then
      cp -f distgit/containers/${d}/LICENSE licenses/${d}-LICENSE
      git add licenses/${d}-LICENSE 1>/dev/null 2>&1 || true
    fi
    # RHIDP-4220 konflux preflight check 
    rsync -Azq licenses/* distgit/containers/${d}/licenses/
  done

  ##################################################################
  # pre-commit tests for content validity -- add more here as needed
  ##################################################################
  
  # RHIDP-7644 verify segment key is correct based on branch
  c="distgit/containers/rhdh-hub/Containerfile"
  if [[ -f "$c" ]]; then
    # for stable branches rhdh-1.y, want the above PROD segment key
    if [[ $DWNSTM_BRANCH == "rhdh-1."*"-rhel-9" ]] && [[ $(grep -c "SEGMENT_WRITE_KEY=$SEGMENT_WRITE_KEY" "$c") -lt 1 ]]; then 
      # prod key not found, must exit
      echo "[ERROR] Could not find SEGMENT_WRITE_KEY=$SEGMENT_WRITE_KEY in distgit/containers/rhdh-hub/Containerfile for branch $DWNSTM_BRANCH - must exit."
      echo "[ERROR] Please ensure the prod key is used in stable 1.y branch builds, not the dev key!"
      exit 4
    elif [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]] && [[ $(grep -c "SEGMENT_WRITE_KEY=gGVM6sYRK0D0ndVX22BOtS7NRcxPej8t" "$c") -lt 1 ]]; then 
      # dev key not found, must exit
      echo "[ERROR] Could not find SEGMENT_WRITE_KEY=gGVM6sYRK0D0ndVX22BOtS7NRcxPej8t in distgit/containers/rhdh-hub/Containerfile for branch $DWNSTM_BRANCH - must exit."
      echo "[ERROR] Please ensure the dev key is used in 1.next CI branch builds, not the prod key!"
      exit 5
    elif [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]] && [[ $(grep -c "SEGMENT_WRITE_KEY=$SEGMENT_WRITE_KEY" "$c") -eq 1 ]]; then 
      # dev key not found, must exit
      echo "[ERROR] Prod key SEGMENT_WRITE_KEY=$SEGMENT_WRITE_KEY not allowed in distgit/containers/rhdh-hub/Containerfile for branch $DWNSTM_BRANCH - must exit."
      echo "[ERROR] Please ensure the dev key gGVM6sYRK0D0ndVX22BOtS7NRcxPej8t is used in 1.next CI branch builds, not the prod key!"
      exit 6
    else
      echo "[INFO] Correctly set SEGMENT_WRITE_KEY in $c for branch $DWNSTM_BRANCH: $(grep "SEGMENT_WRITE_KEY=" "$c")"
    fi
  fi

  #################################################################
  # first commit: update any changed files, plus sync/upstream_SHA*
  #################################################################

  if [[ $BUNDLEONLY -eq 1 ]]; then
    # trigger only kfux, not GL pipeline
    git commit -s -m "[ci skip] Bundle Update Only: ${commitMsg}" . || true
  else
    git commit -s -m "chore: Update:${commitMsg}" . || true
  fi
fi ## if DO_COMMIT

################################# PUSH CHANGES #################################

# if pushing as a normal user
if [[ ${DO_PUSH} -eq 1 ]]; then
  BRANCHUSED="${DWNSTM_BRANCH}"
  PR_BRANCH="pr-update-sync-rhdh-hub-$(date +%s)"
  git pull origin "${BRANCHUSED}"
  set -x
  PUSH_TRY="$(git push origin "${BRANCHUSED}" ${FORCE} 2>&1 || true)"
  # shellcheck disable=SC2181
  if [[ $? -gt 0 ]] || [[ $PUSH_TRY == *"protected branch hook declined"* ]]; then
    # create pull request if target branch is restricted access
    createPr "${PR_BRANCH}" "${BRANCHUSED}"
  fi
  set +x
fi ## if DO_PUSH

# if pushing as a gitlab pipeline
if [[ $GITLAB_PIPELINE == "true" ]]; then
  # push changes; see also https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  echo "Pushing changes as $GITLAB_USER_LOGIN ($GITLAB_USER_EMAIL) to branch $CI_COMMIT_REF_NAME of ${CI_SERVER_HOST}/${CI_PROJECT_NAMESPACE}/${CI_PROJECT_NAME} ..."
  set -x
  git pull --rebase origin "HEAD:$CI_COMMIT_REF_NAME" || true
  git push origin "HEAD:$CI_COMMIT_REF_NAME" -o ci.skip ${FORCE} || exit 16
  set +x
fi

# cleanup
for ((i = 0; i < NUM_REPOS; i++)); do rm -fr "$TMPDIR/repo${i}"; done
rm -f $TMPDIR/hub.Dockerfile.foot $TMPDIR/operator.Dockerfile.foot $TMPDIR/operator-bundle.Dockerfile.foot

if [[ ${DO_PUSH} -eq 1 ]]; then
  app_name=${DWNSTM_BRANCH/-rhel-9}
  app_name=${app_name/./-}
  echo
  if [[ $BUNDLEONLY -eq 1 ]]; then
    echo "See bundle pipeline: https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/${app_name}/activity/pipelineruns?name=rhdh-operator-bundle"
  else
    echo "See running pipelines: https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/${app_name}/activity/pipelineruns?name=on-push"
  fi
fi
