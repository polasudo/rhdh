#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

DEBUG=0 # quieter
AUTORELEASE=0

RHDH_FULL_VERSION_INPUT="1.4.1"

CONTAINERS=""
DEST=""
# ARCHES="x86_64"  # TODO add arch64/arm64
OCP_VERSIONS="4.14 4.15 4.16 4.17 4.18"
BUNDLE_TAG_OR_SHA=""
SNAPSHOT_OVERRIDE=""
midstreamCommitSHA=""

usage () {
    echo "\
Utility script to release one container build snapshot (4+ images) + a set of FBCs with Konflux

Requires: oc >=4.16, jq >= 1.7

Requires that you are already logged into the Konflux cluster via commandline, for example
   oc login --token=sha256~YOUR_TOKEN_HERE --server=https://api.stone-prod-p02.hjvn.p1.openshiftapps.com:6443

To generate a token go to https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant 
Then click on your username and select 'Copy login command' then 'Display token'"
}

usageContainers () {
  echo "\

=======================
Usage - for container snapshots:
=======================

oc login ...

$0 --stage -c rhdh-operator-bundle -v $RHDH_FULL_VERSION_INPUT --debug
$0 --prod  -c rhdh-operator-bundle -v $RHDH_FULL_VERSION_INPUT

Options:
  --stage, --prod    Push to the stage or prod version of the RH Ecosystem Catalog
  -c                 Space-separated list of containers to release, such as \"rhdh-hub-rhel9 rhdh-rhel9-operator rhdh-operator-bundle\"
  -v                 RHDH version x.y.z to release"
}

usageFBCs () {
  echo "\

==============================
Usage - for IIB / FBC updates:
==============================

!!! Note: you MUST RE-RENDER and RE-BUILD your FBCs before pushing to production !!! 
!!! Also make sure that you have fetched the latest contents from the production index when rendering. !!! 
!!! See ../renderCatalogs.sh for more info, and use the --rhec flag to trigger new FBC builds. !!

# 0. oc login as above

oc login ...

# 1. render new catalogs
LATEST_CSV=$RHDH_FULL_VERSION_INPUT
for v in 4.14 4.15 4.16 4.17 4.18; do
  # while using quay.io/rhdh is fine for CI and stage builds, must switch to GA image
  # reference to avoid warning-failures from blocking the release with '--rhec' flag
  ./build/scripts/renderCatalogs.sh --latest --clean -v \${LATEST_CSV} --versions \$v \\
    --template catalogs/v\${v}/catalog-template.json --rhec
 echo 'Sleep 1 min to avoid Konflux tag collisions'; sleep 60s; echo; 
done

# 2. review FBC build completion at https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-17/activity/pipelineruns (and fbc-4-16, etc.)

# 3. For a stage push, get the chosen RHDH Operator Bundle tag or SHA from https://quay.io/repository/rhdh/rhdh-operator-bundle?tab=tags

# 4. For a production push, get the latest RHDH Operator Bundle tag or SHA from https://catalog.redhat.com/software/containers/rhdh/rhdh-operator-bundle/64bfdcd740aa90644e579cc6

# 5. Now you're ready to run this script!

$0 --stage  --fbc :1.3-127 -v 1.3.3 -o \"4.14 4.15 ...\" --auto --debug
$0 --prod   --fbc :1.3-127 -v 1.3.3 -o \"4.14 4.15 ...\"

$0 --stage  --fbc :1.4-150        -v 1.4.1 --debug
$0 --prod   --fbc :1.4-1734113472 -v 1.4.1 --debug
# or use SHA
$0 --prod   --fbc @sha256:2981d2470951ea1e26eb968aefc39ab48ab7d9634a520cf2bbd8c5fef313db15 -v $RHDH_FULL_VERSION_INPUT


Options:
  --stage, --prod    Push to the stage or prod version of the RH Ecosystem Catalog
  -v                 RHDH version x.y.z to release

  --fbc              Publish FBCs for the specified bundle tag, eg., 1.3-127 or 1.4-127
  --snapshot         Rather than pick the latest snapshot, use a specific older one, eg., fbc-4-14-znfg9
  --commit           Rather than pick the latest snapshot, use a specific older one matching a commit SHA, eg., 8ce7098e
  -o                 OCP versions for which to release FBC; default '$OCP_VERSIONS'

  --auto             Rather than showing you the yaml to apply, just execute it automatically. Be careful!
  "
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '--debug') DEBUG=1;;
    '-v') RHDH_FULL_VERSION="$2"; shift 1;;
    '-o') OCP_VERSIONS="$2"; shift 1;;
    '--stage'|'--prod') DEST=${1/--/};;
    '--auto') AUTORELEASE=1;;
    '--fbc') BUNDLE_TAG_OR_SHA=$2; shift 1;;
    '--snapshot') SNAPSHOT_OVERRIDE=$2; shift 1;;
    '--commit')   midstreamCommitSHA="$2"; shift 1;;
    '-c') CONTAINERS="$CONTAINERS $2"; shift 1;;
    *) usage; usageContainers; usageFBCs; echo; echo "[ERROR] Unknown flag $1"; exit 1;;
  esac
  shift 1
done

# compute numbder of OCP versions and fail if we're trying to run a specific snapshot from multiple OCP versions
num_ocp_versions=0
for OCP_VERSION in $OCP_VERSIONS; do
  (( num_ocp_versions = num_ocp_versions + 1 ))
done

if [[ $SNAPSHOT_OVERRIDE ]] && [[ $num_ocp_versions -gt 1 ]]; then
  usage; usageFBCs; echo; echo "[ERROR] Can only specify a snapshot for a single OCP version! Use '-o 4.18' to set the OCP version for the specified snapshot $SNAPSHOT_OVERRIDE !"; exit 1
fi

if [[ ! $CONTAINERS ]] && [[ ! $BUNDLE_TAG_OR_SHA ]]; then 
  usage; usageContainers; usageFBCs; echo; echo "[ERROR] Must specify '-c rhdh-operator-bundle', or for FBCs, use a bundle image tag with --fbc 1.y-zzz to perfom a release!"; exit 1
fi

if [[ ! $RHDH_FULL_VERSION ]]; then 
  usage; 
  if [[ $CONTAINERS ]]; then usageContainers; fi
  if [[ $BUNDLE_TAG_OR_SHA ]]; then usageFBCs; fi;
  echo; echo "[ERROR] Must specify full RHDH version with -v x.y.z to perfom a release!"; exit 1
fi

if [[ ! $DEST ]]; then 
  usage; 
  if [[ $CONTAINERS ]]; then usageContainers; fi
  if [[ $BUNDLE_TAG_OR_SHA ]]; then usageFBCs; fi;
  echo; echo "[ERROR] Must specify --stage or --prod to perfom a release!"; exit 1
fi

######################################################################################################################

RHDH_VERSION=${RHDH_FULL_VERSION%.*}
RHDH_FULL_VERSION=${RHDH_FULL_VERSION//./-}

TS=$(date +'%Y%m%d-%H%M%S' -u) # unique timestamp 

if [[ $CONTAINERS ]]; then
  echo
  echo -n "[INFO] Collect bundle and related images from quay.io/rhdh/rhdh-operator-bundle:$RHDH_VERSION " 

  rm -f "/tmp/imagelist_latest_$RHDH_VERSION.txt"
  latest_bundle=$("${SCRIPT_DIR}/getLatestImageTags.sh" -b "rhdh-${RHDH_VERSION}-rhel-9" --quay -c rhdh/rhdh-operator-bundle)
  echo -n "."
  echo "$latest_bundle" >> "/tmp/imagelist_latest_$RHDH_VERSION.txt"
  "${SCRIPT_DIR}/checkImagesInCSV.sh" -q -y "$latest_bundle" -i 'hub|operator' >> "/tmp/imagelist_latest_$RHDH_VERSION.txt"
  echo -n "."
  sort -uV "/tmp/imagelist_latest_$RHDH_VERSION.txt" > "/tmp/imagelist_latest_$RHDH_VERSION.txt_"; mv "/tmp/imagelist_latest_$RHDH_VERSION.txt"{_,}
  echo ". done."
  echo
fi

# collect array of processed images so we don't process duplicate snapshots
declare -A processed_images

for CONTAINER in $CONTAINERS; do
  # compute the container image SHA/tag - skopeo inspect
  skopeo inspect "docker://quay.io/rhdh/${CONTAINER}:${RHDH_VERSION}" > /tmp/container_inspect.txt
  tagXYZ=$(jq -r '.Labels.version+"-"+.Labels.release' /tmp/container_inspect.txt)
  digest=$(jq -r '.Digest' /tmp/container_inspect.txt)
  echo " * $CONTAINER:${tagXYZ}@${digest} built on $(jq -r '.Labels."build-date"' /tmp/container_inspect.txt) from $(jq -r '.Env[]|select(.|contains("UPSTREAM_REPO"))' /tmp/container_inspect.txt)"

  processed_images["${CONTAINER}:${tagXYZ}"]+="${CONTAINER}@${digest}"

  # compute the midstream commit SHA
  MID_SHA=$(jq -r '.Labels."vcs-ref"' /tmp/container_inspect.txt)
  MID_SHA=${MID_SHA/sha256:/}

  # using midstream commit SHA and the container image, find Snapshot(s_)
  if [[ $DEBUG -eq 1 ]]; then set -x; fi
  SNAPSHOT=$(oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp \
    --selector='pac.test.appstudio.openshift.io/original-prname='"${CONTAINER/-rhel9/}"'-'"${RHDH_VERSION/./-}"'-on-push,pac.test.appstudio.openshift.io/sha='"${MID_SHA}"| \
    sed -r -e '/NAME +AGE/d' -e "s/([a-z0-9-]+)\ +([0-9smhdy]+)/\1/g")
  if [[ $DEBUG -eq 1 ]]; then set +x; fi
  echo; echo -e "[INFO] For midstream SHA = $MID_SHA, found these snapshot(s):\n$SNAPSHOT"
  # TODO fail if we find more than one snapshot for this image; exit 1
  SNAPSHOTS="${SNAPSHOTS} ${SNAPSHOT}"
  rm -f /tmp/container_inspect.txt
done
echo 

# TODO now compute the images in the bundle snapshot to make sure we have one that contains all the latest/correct images; if not all are present, fail!
for SNAPSHOT in $SNAPSHOTS; do
  if [[ ! -v processed_images["$SNAPSHOT"] ]]; then # process this new one
    rm -f "/tmp/imagelist_$SNAPSHOT.txt"
    echo "[INFO] Inspecting $SNAPSHOT:"
    
    oc -n rhdh-tenant get Snapshot "$SNAPSHOT" -o yaml > /tmp/"$SNAPSHOT".yaml
    # collect 3 images
    for i in $(yq -r '.spec.components[].containerImage' /tmp/"$SNAPSHOT".yaml | sort -uV); do 
      imageAndTag="$(~/pp/getTagForSHA.sh "$i" -q -y)" 
      echo -e " * $imageAndTag = $i"
      echo "$imageAndTag" >> "/tmp/imagelist_$SNAPSHOT.txt"
    done
    echo

    # compare with the contents of the latest bundle's operands
    if [[ "$(cat "/tmp/imagelist_latest_$RHDH_VERSION.txt")" != "$(cat "/tmp/imagelist_$SNAPSHOT.txt")" ]]; then
      echo "[WARNING] Latest images != images in snapshot:"
      echo "===================latest==================="
      cat "/tmp/imagelist_latest_$RHDH_VERSION.txt"
      echo "===================latest==================="
      echo
      echo "===================snapshot==================="
      cat "/tmp/imagelist_$SNAPSHOT.txt"
      echo "===================snapshot==================="
    else
      echo "[INFO] Snapshot images match latest images:"
      cat "/tmp/imagelist_$SNAPSHOT.txt"
    fi
    rm -f "/tmp/imagelist_$SNAPSHOT.txt" "/tmp/imagelist_latest_$RHDH_VERSION.txt"

    echo
    cat << EOT > "/tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: release-${RHDH_FULL_VERSION}-${SNAPSHOT}-${DEST}-${TS}
  namespace: rhdh-tenant
  labels:
    release.appstudio.openshift.io/author: nboldt
spec:
  releasePlan: rhdh-${RHDH_VERSION/./-}-${DEST}
  snapshot: ${SNAPSHOT}
EOT
    # if [[ $DEBUG -eq 1 ]]; then cat "/tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"; fi
    if [[ $AUTORELEASE -eq 1 ]]; then
      echo -n "[INFO] "
      oc apply -f "/tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"
      echo

      # now check for maanged pipeline runs
      # for release-rhdh-1-4-4p59p-stage-20250115-210603, get rhtap-releng-tenant/managed-cc5zr
      managedPipeline=$(oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml | yq -r '.items[]|select(.metadata.name|startswith("'"release-${RHDH_FULL_VERSION}-${SNAPSHOT}-${DEST}-${TS}"'"))' | grep pipelineRun | sed -r -e "s|.+rhtap-releng-tenant/(.+)\",|\1|")
      managedPipelineURL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhtap-releng/applications/rhdh-${RHDH_VERSION/./-}/pipelineruns/${managedPipeline}/taskruns"
      echo "[INFO] Run in $managedPipelineURL"

      RELEASE_URL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/rhdh-${RHDH_VERSION/./-}/releases/release-${RHDH_FULL_VERSION}-${SNAPSHOT}-${DEST}-${TS}"
      echo "       and $RELEASE_URL"

      # open a browser to watch the release
      if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome) != *"which: no google-chrome"* ]]; then 
        google-chrome "$managedPipelineURL" >/dev/null 2>&1; 
      fi
      echo "-----------------------------------------------------------------------"
      echo
    else
      collected_commands="${collected_commands}\n  oc apply -f /tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"
      echo -e "Run this:\n  oc apply -f /tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"; echo 
      releasesURL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/rhdh-${RHDH_VERSION/./-}/releases/"
      echo "Then watch release at $releasesURL"
      if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome) != *"which: no google-chrome"* ]]; then 
        google-chrome "$releasesURL" >/dev/null 2>&1; 
      fi
      echo -e "\nOr run: oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > /tmp/releases.yaml"
    fi
  fi
done
rm -fr /tmp/container_inspect.txt

###############################################################################################################

# process the FBCs the same way for all the valid arches (x86_64 for now) and OCP versions (4.14-4.17)
collected_commands=""
if [[ $BUNDLE_TAG_OR_SHA ]]; then 
  declare -A operator_bundle_mapping
  
  # compute the correct operator bundle 
  if [[ $DEST == "prod" ]]; then
    CONTAINER_PRE="registry.redhat.io/rhdh"
  else
    CONTAINER_PRE="quay.io/rhdh"
  fi
  # shellcheck disable=SC2143
  if [[ $(skopeo inspect --raw "docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}" 2>&1 | grep "Error parsing") ]]; then
    echo "[ERROR] Could not find operator bundle from specifed tag or SHA! Try this again to get a valid tag:"; 
    echo "  skopeo inspect --raw docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}";
    exit 1
  else 
    echo "Inspecting ${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA} ..."
    time skopeo inspect "docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}" > /tmp/fbc_inspect.txt
    echo
  fi
  tagXYZ=$(jq -r '.Labels.version+"-"+.Labels.release' /tmp/fbc_inspect.txt)
  digest=$(jq -r '.Digest' /tmp/fbc_inspect.txt)
  operator_bundle_mapping["rhdh-operator-bundle:${tagXYZ}"]+="rhdh-operator-bundle@${digest}"

  BRANCH="rhdh-${RHDH_VERSION}-rhel-9"

  for OCP_VERSION in $OCP_VERSIONS; do
    OCP_VERSION=${OCP_VERSION/./-} # replace . with -
    # # compute the correct fbc Snapshot with these filters:
    # pac.test.appstudio.openshift.io/branch: rhdh-1.4-rhel-9
    # pac.test.appstudio.openshift.io/original-prname: fbc-4-14-on-push
    # pac.test.appstudio.openshift.io/sha: 7e6c56d5dccb86c37e26672e40ed3a0a9bcd28a2

    oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp --selector='pac.test.appstudio.openshift.io/original-prname=fbc-'"${OCP_VERSION}"'-on-push' -o yaml > "/tmp/fbc-snapshots-${OCP_VERSION}.yaml"

    extraSelect=""
    if [[ $midstreamCommitSHA ]]; then 
      extraSelect='|select(.metadata.labels."pac.test.appstudio.openshift.io/sha" | startswith("'"$midstreamCommitSHA"'"))'
    fi
    if [[ $SNAPSHOT_OVERRIDE ]]; then 
      extraSelect='|select(.metadata.name == "'"$SNAPSHOT_OVERRIDE"'")'
    fi

    pipelinerunfinishtime=""
    if [[ $DEBUG -eq 1 ]]; then
      echo "Found snapshot(s):"
      echo -e "finish timestamp\tsnapshot\tpipelinerun\t\tmidstreamCommitSHA"
    fi
    yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "completed")'"$extraSelect"'|.metadata.labels."test.appstudio.openshift.io/pipelinerunfinishtime" + "\t" + .metadata.name + "\t" + .metadata.labels."appstudio.openshift.io/build-pipelinerun" + "\t" + .metadata.labels."pac.test.appstudio.openshift.io/sha"' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" > "/tmp/fbc-snapshots-${OCP_VERSION}.csv"
    # 1734044836	fbc-4-14-mhchr	fbc-4-14-on-push-s687p	76ada30bafa4341c6032496c1aa64d8c8a441447
    # 1734114561	fbc-4-14-d766t	fbc-4-14-on-push-g9fpp	7e6c56d5dccb86c37e26672e40ed3a0a9bcd28a2
    # get the 5 most recent ones 
    tail -5 "/tmp/fbc-snapshots-${OCP_VERSION}.csv" > "/tmp/fbc-snapshots-${OCP_VERSION}.csv_"
    mv -f "/tmp/fbc-snapshots-${OCP_VERSION}.csv"{_,}
    while IFS= read -r line; do
      pipelinerunfinishtime=${line%%$'\t'*} # first column
      pipelinerunfinishtime=$(date --date="@${pipelinerunfinishtime}" +'%Y-%m-%dT%H:%M:%SZ' -u) # 2024-12-23T21:43:32Z

      snapshotdata=${line#*$'\t'}
      snapshotdata=${snapshotdata%$'\t'*} #middle columns

      midstreamCommitSHA_URL="https://gitlab.cee.redhat.com/rhidp/rhdh/-/commit/${line##*$'\t'}" # last column

      if [[ $DEBUG -eq 1 ]]; then
        echo -e "$pipelinerunfinishtime\t$snapshotdata\t${midstreamCommitSHA_URL}"
      fi
    done < "/tmp/fbc-snapshots-${OCP_VERSION}.csv"
    if [[ $DEBUG -eq 1 ]]; then echo; fi

    # TODO should we reverse the sort and start processing them from most recent to oldest, find the iib image, and extract that to pull out the referenced operator-bundle image for this release; stop after the first good one

    # pick the last (or only) snapshot
    SNAPSHOT=$(yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "completed")'"$extraSelect"'|.metadata.name' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" | tail -1)
    
    if [[ ! $SNAPSHOT ]] || [[ ! $pipelinerunfinishtime ]]; then
      echo "[ERROR] Could not find a snapshot! Try different values for the --fbc, --snapshot, and/or --commit flags."; exit 1
    fi

    # pipelinerun: https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-14/pipelineruns/fbc-4-14-on-push-g9fpp
    # snapshot:    https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-14/snapshots/fbc-4-14-d766t
    echo -e "For $OCP_VERSION, found snapshot (completed $pipelinerunfinishtime):"
    echo -e " * Commit:   https://gitlab.cee.redhat.com/rhidp/rhdh/-/commit/$(tail -1 "/tmp/fbc-snapshots-${OCP_VERSION}.csv" | sed -r -e "s@.+\t([^\t]+)@\1@")"
    echo -e " * Snapshot: https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-${OCP_VERSION}/snapshots/$SNAPSHOT\n"

    # for each SNAPSHOT, find the iib bundle, extract its contents, and pick the last bundle reference; check if that matches the value above
    oc -n rhdh-tenant get Snapshot "${SNAPSHOT}" -o yaml > "/tmp/${SNAPSHOT}.yaml"
    IIB=$(yq -r '.spec.components[0].containerImage' "/tmp/${SNAPSHOT}.yaml") # quay.io/rhdh/iib@sha256:23eb6996df56471120723b8741ac4f19dc2d23441bdbaea62003de6fd1a507a0
    sudo rm -fr /tmp/quay.io-rhdh-iib-sha256-*
    if [[ $DEBUG -eq 1 ]]; then echo; echo "Extracting $IIB to get catalog.json ..."; fi
    "$SCRIPT_DIR/containerExtract.sh" "${IIB}" -q
    bundle=$(cat /tmp/quay.io-rhdh-iib-sha256-*/configs/rhdh/catalog.json | grep rhdh-operator-bundle@ | sed -r -e 's|.+"image": ".+/rhdh/(.+)",*|\1|' | tail -1)

    # TODO do we need to do this at all? and should we validate stage pushed images too?
    # if [[ $DEST == "prod" ]]; then # use prod URL
    #   bundle=$(bundle/quay.io/registry.redhat.io)
    # fi

    # cleanup exploded container
    sudo rm -fr /tmp/quay.io-rhdh-iib-sha256-*

    # grab the only quay.io entry (last one)
    echo "Found $bundle"
    PROCEED=0
    for k in "${!operator_bundle_mapping[@]}"; do 
      echo "Check ${operator_bundle_mapping[$k]} ($k)"
      if [[ ${operator_bundle_mapping[$k]} == "$bundle" ]]; then
        PROCEED=1
        echo; echo "Release can proceed - should take about 30 mins per OCP version!"; echo
        cat << EOT > "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  labels:
    release.appstudio.openshift.io/author: nboldt
  name: release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}
  namespace: rhdh-tenant
spec:
  releasePlan: rhdh-${RHDH_VERSION/./-}-fbc-${OCP_VERSION}-${DEST}-release-plan
  snapshot: ${SNAPSHOT}
EOT
        # if [[ $DEBUG -eq 1 ]]; then cat "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"; fi
        if [[ $AUTORELEASE -eq 1 ]]; then
          oc apply -f "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
          echo
          RELEASE_URL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-${OCP_VERSION}/releases/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}"
          echo "Run in $RELEASE_URL"
          # open a browser to watch the release
          if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome) != *"which: no google-chrome"* ]]; then google-chrome "$RELEASE_URL"; fi
          echo "-----------------------------------------------------------------------"
          echo
        else
          collected_commands="${collected_commands}\n  oc apply -f /tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
          echo -e "Run this:\n  oc apply -f /tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"; echo 
        fi
      fi
      break
    done
    if [[ $PROCEED -eq 0 ]]; then 
      echo "[ERROR] Can not proceed with the release: matching operator-bundle image not found!"
      echo "[ERROR] Make sure to pass in the correct image tag to release with '--fbc x.y-zzz'. Note that prod and stage may use different bundle tags (:1.4-1734113472 vs. :1.4-127)"
      echo "[ERROR] Use the --commit or --snapshot flag to specify an older snapshot with the desired bundle image."
      exit 1
    fi
  done
  
  # cleanup
  rm -f /tmp/fbc-snapshots*.yaml

  if [[ $collected_commands ]]; then
    echo
    echo "--------------------------------------------------------------------------"
    echo -e "Run the following commands to start your release(s):$collected_commands"
    echo -e "\nThen cleanup temp files with:\n  rm -f /tmp/release-rhdh-*.yaml"
    echo
  fi

  echo -e "Run this to find managed pipelines in progress and watch status (or run this script again in --debug mode, not --auto mode):\n  oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > /tmp/releases.yaml"
  echo 

  # now search for existing running pipelines 
  declare -A managedPipeline_mapping=()
  echo "Found these releases:"
  echo -e "release name\t\t\t\t\t\trelease plan\t\t\t\tmanaged pipelinerun\tstart time\t\tend time"
  for OCP_VERSION in $OCP_VERSIONS; do
    OCP_VERSION=${OCP_VERSION/./-} # replace . with -
    oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > "/tmp/releases-${OCP_VERSION}.yaml"
    RP="rhdh-${RHDH_VERSION/./-}-fbc-${OCP_VERSION}-${DEST}-release-plan"
    RN="release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-"
    managedPipelines=$(yq -r '.items[]|select(.spec.releasePlan == "'"${RP}"'")|select(.metadata.name|startswith("'"${RN}"'"))|.status.managedProcessing.pipelineRun|split("/")[1]' "/tmp/releases-${OCP_VERSION}.yaml")
    if [[ $managedPipelines ]]; then 
      # echo "Got: [$managedPipelines]"
      managedPipeline_mapping["${OCP_VERSION}"]+="${managedPipelines}"
      for managedPipeline in ${managedPipelines}; do 
        # echo "Query: $managedPipeline"
        yq -r '.items[]|select(.spec.releasePlan == "'"${RP}"'")|select(.metadata.name|startswith("'"${RN}"'"))|select(.status.managedProcessing.pipelineRun|split("/")[1] == "'"$managedPipeline"'")|.metadata.name + "\t" + .spec.releasePlan + "\t'"${managedPipeline}"'\t\t" + .status.managedProcessing.startTime + "\t" + .status.managedProcessing.completionTime' "/tmp/releases-${OCP_VERSION}.yaml"
      done
    else 
      echo "[ERROR] Could not find a Release for ReleasePlan $RP !"; exit 1
    fi
  done
  rm -f /tmp/releases-*
  echo
  
  if [[ ${#managedPipeline_mapping[@]} -gt 0 ]]; then 
    echo "Found these managed pipeline releases:"
    for k in "${!managedPipeline_mapping[@]}"; do 
      for managedPipeline in ${managedPipeline_mapping[$k]}; do
        echo "  https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhtap-releng/applications/fbc-$k/pipelineruns/${managedPipeline}/taskruns"
      done
    done
  fi

  # cleanup tmp files
  rm -f /tmp/fbc_inspect.txt
  if [[ $AUTORELEASE -eq 1 ]]; then rm -f /tmp/release-rhdh-*.yaml; fi
fi