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

CONTAINERS=""
DEST=stage
ARCHES="x86_64"  # TODO add arch64/arm64
OCP_VERSIONS="4.14 4.15 4.16 4.17"
BUNDLE_TAG_OR_SHA=""

usage () {
    echo "\
Utility script to release one container build snapshot (4+ images) + a set of FBCs with Konflux

Requires: oc >=4.16, jq >= 1.7

Requires that you are already logged into the Konflux cluster via commandline, for example
   oc login --token=sha256~YOUR_TOKEN_HERE --server=https://api.stone-prod-p02.hjvn.p1.openshiftapps.com:6443

To generate a token go to https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant 
Then click on your username and select 'Copy login command' then 'Display token'

=======================
Usage - for containers:
=======================

oc login ...

$0 --stage rhdh-hub-rhel9 rhdh-rhel9-operator rhdh-operator-bundle -v 1.4.0 --debug
$0 --prod  rhdh-hub-rhel9 rhdh-rhel9-operator rhdh-operator-bundle -v 1.4.0 

==============================
Usage - for IIB / FBC updates:
==============================

!!! Note: you MUST RE-RENDER and RE-BUILD your FBCs before pushing to production !!! 
!!! Also make sure that you have fetched the latest contents from the production index when rendering. !!! 
!!! See ../renderCatalogs.sh for more info, and use the --rhec flag to trigger new FBC builds. !!

# 0. oc login as above

oc login ...

# 1. render new catalogs
LATEST_CSV=1.4.0
for v in 4.14 4.15 4.16 4.17; do
  # while using quay.io/rhdh is fine for CI and stage builds, must switch to GA image
  # reference to avoid warning-failures from blocking the release with '--rhec' flag
  ./build/scripts/renderCatalogs.sh --latest --clean -v ${LATEST_CSV} --versions $v \
    --template catalogs/v${v}/catalog-template.json --rhec
 echo 'Sleep 1 min to avoid Konflux tag collisions'; sleep 60s; echo; 
done

# 2. review FBC build completion at https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-17/activity/pipelineruns (and fbc-4-16, etc.)

# 3. For a stage push, get the chosen RHDH Operator Bundle tag or SHA from https://quay.io/repository/rhdh/rhdh-operator-bundle?tab=tags

# 4. For a production push, get the latest RHDH Operator Bundle tag or SHA from https://catalog.redhat.com/software/containers/rhdh/rhdh-operator-bundle/64bfdcd740aa90644e579cc6

# 5. Now you're ready to run this script!

$0 --stage  --fbc :1.3-127 -v 1.3.3 -o \"4.14 4.15 ...\" --auto --debug
$0 --prod   --fbc :1.3-127 -v 1.3.3 -o \"4.14 4.15 ...\"

$0 --stage  --fbc :1.4-127        -v 1.4.0 --debug
$0 --prod   --fbc :1.4-1734113472 -v 1.4.0 --debug
# or use SHA
$0 --prod   --fbc @sha256:2981d2470951ea1e26eb968aefc39ab48ab7d9634a520cf2bbd8c5fef313db15 -v 1.4.0 

Options:
  --stage, --prod    Push to the stage or prod version of the RH Ecosystem Catalog
  -v                 RHDH version x.y.z to release

  --fbc              Publish FBCs for the specified bundle tag, eg., 1.3-127 or 1.4-127
  -o                 OCP versions for which to release FBC; default '$OCP_VERSIONS'

  --auto             Rather than showing you the yaml to apply, just execute it automatically. Be careful!
  ";
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '--debug') DEBUG=1;;
    '-v') RHDH_FULL_VERSION="$2"; shift 1;;
    '-o') OCP_VERSIONS="$2"; shift 1;;
    '--stage'|'--prod') DEST=${1/--/};;
    '--auto') AUTORELEASE=1;;
    '--fbc') BUNDLE_TAG_OR_SHA=$2; shift 1;;
    *) CONTAINERS="$CONTAINERS $1";;
  esac
  shift 1
done

if [[ ! $CONTAINERS ]] && [[ ! $BUNDLE_TAG_OR_SHA ]]; then 
  echo "Must specify containers or a bundle image tag with --fbc 1.y-zzz to perfom a release!"
  echo; usage; exit
fi

if [[ ! $RHDH_FULL_VERSION ]]; then 
  echo "Must specify full RHDH version with -v x.y.z to perfom a release!"
  echo; usage; exit
fi

RHDH_VERSION=${RHDH_FULL_VERSION%.*}
RHDH_FULL_VERSION=${RHDH_FULL_VERSION//./-}

TS=$(date +'%Y%m%d-%H%M%S' -u) # unique timestamp 

# collect array of processed images so we don't process duplicate snapshots
# declare -A processed_images

for CONTAINER in $CONTAINERS; do
  # compute the container image SHA/tag - skopeo inspect
  skopeo inspect "docker://quay.io/rhdh/${CONTAINER}:${RHDH_VERSION}" > /tmp/inspect.txt
  tagXYZ=$(jq -r '.Labels.version+"-"+.Labels.release' /tmp/inspect.txt)
  digest=$(jq -r '.Digest' /tmp/inspect.txt)
  echo "$CONTAINER:${tagXYZ}@${digest} built on $(jq -r '.Labels."build-date"' /tmp/inspect.txt) from $(jq -r '.Env[]|select(.|contains("UPSTREAM_REPO"))' /tmp/inspect.txt)"

  # processed_images["${CONTAINER}:${tagXYZ}"]+="${CONTAINER}@${digest}"

  # compute the midstream commit SHA
  MID_SHA=$(jq -r '.Labels."vcs-ref"' /tmp/inspect.txt)
  MID_SHA=${MID_SHA/sha256:/}

  # using midstream commit SHA and the container image, find Snapshot(s_)
  if [[ $DEBUG -eq 1 ]]; then set -x; fi
  SNAPSHOT=$(oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp \
    --selector='pac.test.appstudio.openshift.io/original-prname='"${CONTAINER/-rhel9/}"'-'"${RHDH_VERSION/./-}"'-on-push,pac.test.appstudio.openshift.io/sha='"${MID_SHA}"| \
    sed -r -e '/NAME +AGE/d' -e "s/([a-z0-9-]+)\ +([0-9smhdy]+)/\1/g")
  if [[ $DEBUG -eq 1 ]]; then set +x; fi
  echo -e "For midstream SHA = $MID_SHA, found these snapshot(s):\n$SNAPSHOT"
  # TODO fail if we find more than one snapshot for this image; exit 1
  # SNAPSHOTS="${SNAPSHOTS} ${SNAPSHOT}"
done
echo 

# TODO now compute the images in the snapshot to make sure we have a snapshot that contains all three images; if not all are present, skip that snapshot until we find one good one

# foreach snapshot in $SNAPSHOTS; do
    #   if [[ ! -v processed_images["$snapshot"] ]]; then # process this new one
    #     # create a new Release with a unique name for each valid snapshot

# echo "apiVersion: appstudio.redhat.com/v1alpha1
# kind: Release
# metadata:
#   name: release-rhdh-1-4-prod-20241217-1100
#   namespace: rhdh-tenant
#   labels:
#     release.appstudio.openshift.io/author: 'nboldt'
# spec:
#   releasePlan: rhdh-1-4-prod
#   snapshot: rhdh-1-4-rpcsx
# " |  oc apply -f -

# TODO see how this was done for FBCs below. Can we refactor into a reusable method here? 
# see releases in progress here https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/rhdh-1-4/releases
# foreach ...
    #     # collect array of processed images so we don't process duplicate snapshots
    #     processed_images["$snapshot"]+="1"
    #   fi
# done

# can compute the managed pipeline with these filters
#     appstudio.openshift.io/application: rhdh-1-4
#     appstudio.openshift.io/snapshot: rhdh-1-4-rpcsx
#     pipelines.appstudio.openshift.io/type: managed
#     release.appstudio.openshift.io/name: release-rhdh-1-4-prod-20241217-1100
#     release.appstudio.openshift.io/namespace: rhdh-tenant

# TODO display link to https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/rhdh-1-4/releases/release-rhdh-1-4-prod-20241217-1100
# TODO display link to https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhtap-releng/applications/rhdh-1-4/pipelineruns/managed-x7kvl

rm -fr /tmp/inspect.txt

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
    echo "Error! Could not find operator bundle from specifed tag or SHA! Try this again to get a valid tag:"; 
    echo "  skopeo inspect --raw docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}";
    exit 1
  else 
    echo "Inspecting ${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA} ..."
    time skopeo inspect "docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}" > /tmp/inspect.txt
    echo
  fi
  tagXYZ=$(jq -r '.Labels.version+"-"+.Labels.release' /tmp/inspect.txt)
  digest=$(jq -r '.Digest' /tmp/inspect.txt)
  operator_bundle_mapping["rhdh-operator-bundle:${tagXYZ}"]+="rhdh-operator-bundle@${digest}"

  BRANCH="rhdh-${RHDH_VERSION}-rhel-9"

  for OCP_VERSION in $OCP_VERSIONS; do
    OCP_VERSION=${OCP_VERSION/./-} # replace . with -
    # # compute the correct fbc Snapshot with these filters:
    # pac.test.appstudio.openshift.io/branch: rhdh-1.4-rhel-9
    # pac.test.appstudio.openshift.io/original-prname: fbc-4-14-on-push
    # pac.test.appstudio.openshift.io/sha: 7e6c56d5dccb86c37e26672e40ed3a0a9bcd28a2

    oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp --selector='pac.test.appstudio.openshift.io/original-prname=fbc-'"${OCP_VERSION}"'-on-push' -o yaml > "/tmp/fbc-snapshots-${OCP_VERSION}.yaml"
    if [[ $DEBUG -eq 1 ]]; then
      echo "Found these snapshots:"
      echo -e "timestamp\tsnapshot\tpipelinerun\t\tmidstreamCommitSHA"
      yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "completed")|.metadata.labels."test.appstudio.openshift.io/pipelinerunfinishtime" + "\t" + .metadata.name + "\t" + .metadata.labels."appstudio.openshift.io/build-pipelinerun" + "\t" + .metadata.labels."pac.test.appstudio.openshift.io/sha"' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml"
      # 1734044836	fbc-4-14-mhchr	fbc-4-14-on-push-s687p	76ada30bafa4341c6032496c1aa64d8c8a441447
      # 1734114561	fbc-4-14-d766t	fbc-4-14-on-push-g9fpp	7e6c56d5dccb86c37e26672e40ed3a0a9bcd28a2
      echo
    fi

    # TODO -- for now just pick the last one; ideally we would reverse the sort and start processing them from most recent to oldest, find the iib image, and extract that to pull out the referenced operator-bundle image for this release; stop after the first good one
    SNAPSHOT=$(yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "completed")|.metadata.name' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" | tail -1)
    SNAPSHOT_TIME=$(yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "completed")|.metadata.labels."test.appstudio.openshift.io/pipelinerunfinishtime"' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" | tail -1); SNAPSHOT_TIME=$(date --date='@'"${SNAPSHOT_TIME}" +'%F %T')
    
    # TODO collect multiple snapshots to process later?
    # SNAPSHOTS="${SNAPSHOTS} ${SNAPSHOT}"

    # pipelinerun: https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-14/pipelineruns/fbc-4-14-on-push-g9fpp
    # snapshot:    https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-14/snapshots/fbc-4-14-d766t
    echo -e "For $OCP_VERSION, found this final snapshot (built $SNAPSHOT_TIME):\nhttps://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-4-14/snapshots/$SNAPSHOT"

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
        if [[ $DEBUG -eq 1 ]]; then cat "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"; fi
        if [[ $AUTORELEASE -eq 1 ]]; then
          oc apply -f "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
          echo
          RELEASE_URL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-${OCP_VERSION}/releases/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}"
          echo "Running in $RELEASE_URL"
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
      echo "WARNING! Could not proceed with the release! Matching bundle image not found. If this is an FBC release for an OSBS build, pass in the image tag to release with '--fbc x.y-zzz'"
      echo
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

  echo "Run this to find managed pipelines in progress and watch status:"
  echo "oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > /tmp/releases.yaml"
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
      # echo "Got: $managedPipeline"
      managedPipeline_mapping["${OCP_VERSION}"]+="${managedPipelines}"
      for managedPipeline in ${managedPipelines}; do 
        yq -r '.items[]|select(.spec.releasePlan == "'"${RP}"'")|select(.metadata.name|startswith("'"${RN}"'"))|.metadata.name + "\t" + .spec.releasePlan + "\t'"${managedPipeline}"'\t\t" + .status.managedProcessing.startTime + "\t" + .status.managedProcessing.completionTime' "/tmp/releases-${OCP_VERSION}.yaml"
      done
    else 
      echo "Error: could not find a Release for ReleasePlan $RP !"
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
  rm -f /tmp/inspect.txt
  if [[ $AUTORELEASE -eq 1 ]]; then rm -f /tmp/release-rhdh-*.yaml; fi
fi