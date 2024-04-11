#!/bin/bash
#
# Copyright (c) 2023 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Script to streamline installing an IIB image in an OpenShift cluster for testing
# Supports optionally installing an operator from the newly-created catalog source.
#
# Requires: oc, jq, curl
# Optional: podman (for brew.registry secret)

set -e

RED='\033[0;31m'
NC='\033[0m'

NAMESPACE_CATALOGSOURCE="openshift-marketplace" # instead of openshift-operators
NAMESPACE_SUBSCRIPTION="rhdh-operator" # default custom subscription namespace, instead of openshift-operators
DISABLE_CATALOGSOURCES="false"
INSTALL_PLAN_APPROVAL="Automatic"
OLM_CHANNEL="fast"

# default ICSP to use to resolve unreleased images
# if using --quay flag, this will include quay.io
# if using --brew flag, this will include brew.registry.redhat.io
# if you want your own registry here, use --icsp flag to specify it
ICSP_URLs=""

errorf() {
  echo -e "${RED}$1${NC}"
}

usage() {
echo "

######################################################################################################################################
For a simpler version of this script, see https://github.com/janus-idp/operator/blob/main/.rhdh/scripts/install-rhdh-catalog-source.sh 
######################################################################################################################################

This script streamlines testing IIB images by configuring an OpenShift cluster to enable it to use the specified IIB image
as a catalog source. The CatalogSource is created in the $NAMESPACE_CATALOGSOURCE namespace (override with '--namespace-catalogsource')
is named 'operatorName-channelName', eg., rhdh-fast

Note: to compute the latest IIB image for a given operator, use ./getIIBsForBundle.sh.

If IIB installation fails, see https://docs.engineering.redhat.com/display/CFC/Test and
follow steps in section 'Adding Brew Pull Secret'

Usage:
  $0 [OPTIONS]

Options:
  --iib <IIB_IMAGE>            : IIB image to install on the cluster; could be in the form:
                               : * registry-proxy.engineering.redhat.com/rh-osbs/iib:573813 [RH internal],
                               : * brew.registry.redhat.io/rh-osbs/iib:987654 [RH public, auth required], or
                               : * quay.io/rhdh/iib:3.7-v4.13-480383-476121-x86_64 or quay.io/rhdh/iib:latest-v4.12-x86_64 [public]
  --latest                     : Install from iib quay.io/rhdh/iib:latest-\$OCP_VER-\$OCP_ARCH (eg., latest-v4.12-x86_64)
  --next                       : Install from iib quay.io/rhdh/iib:next-\$OCP_VER-\$OCP_ARCH (eg., next-v4.12-x86_64)
  --install-operator <NAME>    : Install operator named $NAME after creating CatalogSource
  --channel <CHANNEL>          : Channel to use for operator subscription if installing operator. Default: '$OLM_CHANNEL'
  --manual-updates             : Use 'manual' InstallPlanApproval for the CatalogSource instead of 'automatic' if installing operator
  --disable-default-sources    : Disable default CatalogSources. Default: false
  --quay                       : Resolve images from quay.io using ImageContentSourcePolicy (requires authentication to quay.io/rhdh/)
  --brew                       : Resolve images from brew.registry.redhat.io using ImageContentSourcePolicy (requires authentication)
  --icsp                       : Install using specified registry in ImageContentSourcePolicy
  -nc, --namespace-catalogsource <NAMESPACE>  : Namespace to install CatalogSource into. Default: $NAMESPACE_CATALOGSOURCE
  -ns, --namespace-subscription  <NAMESPACE>  : Namespace to install Subscliption into. Default: $NAMESPACE_SUBSCRIPTION

Developer Hub Examples:
  $0 \\
  --iib brew.registry.redhat.io/rh-osbs/iib:573813 --install-operator rhdh --brew --quay --channel fast-1.2

  $0 \\
  --latest --install-operator rhdh # RC release in progess (from 1.yy branch)
  
  $0 \\
  --next --install-operator rhdh # CI future release (from main branch)
"
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '--iib') UPSTREAM_IIB="$2"; shift 1;;
    '--install-operator') TO_INSTALL="$2"; shift 1;;
    '--channel') OLM_CHANNEL="$2"; shift 1;;
    '--manual-updates') INSTALL_PLAN_APPROVAL="Manual";;
    '--disable-default-sources') DISABLE_CATALOGSOURCES="true";;
    '--icsp') ICSP_URLs="${ICSP_URLs} $2"; shift 1;;
    '--quay') ICSP_URLs="${ICSP_URLs} quay.io/rhdh/";;
    '--brew') ICSP_URLs="${ICSP_URLs} brew.registry.redhat.io/rh-osbs/rhdh-";;
    '--next'|'--latest') 
      ICSP_URLs="${ICSP_URLs} quay.io/rhdh/"
      OCP_VER="v$(oc version -o json | jq -r '.openshiftVersion' | sed -r -e "s#([0-9]+\.[0-9]+)\..+#\1#")"
      OCP_ARCH="$(oc version -o json | jq -r '.serverVersion.platform' | sed -r -e "s#linux/##")"
      if [[ $OCP_ARCH == "amd64" ]]; then OCP_ARCH="x86_64"; fi
      UPSTREAM_IIB="quay.io/rhdh/iib:${1/--/}-${OCP_VER}-$OCP_ARCH";;
    '-nc'|'--namespace-catalogsource') NAMESPACE_CATALOGSOURCE="$2"; shift 1;;
    '-ns'|'--namespace-subscription') NAMESPACE_SUBSCRIPTION="$2"; shift 1;;
    '-h'|'--help') usage; exit 0;;
    *) echo "[ERROR] Unknown parameter is used: $1."; usage; exit 1;;
  esac
  shift 1
done

# minimum requirements
if [[ ! $(command -v oc) ]]; then
  errorf "Please install oc 4.10+ from an RPM or https://mirror.openshift.com/pub/openshift-v4/clients/ocp/"
  exit 1
fi
if [[ ! $(command -v jq) ]]; then
  errorf "Please install jq 1.2+ from an RPM or https://pypi.org/project/jq/"
  exit 1
fi
if [[ ! $(command -v curl) ]]; then
  errorf "Please install curl"
  exit 1
fi
if [[ ! $(command -v skopeo) ]]; then
  errorf "Please install skopeo 1.11+"
  exit 1
fi

# Check that we have IIB image and use Brew mirror
if [ -z "$UPSTREAM_IIB" ]; then
  errorf "IIB image is required (specify '--iib <image>')"
  usage
  exit 1
fi
if [[ $UPSTREAM_IIB == "registry-proxy.engineering.redhat.com/rh-osbs/iib:"* ]]; then
  IIB_IMAGE="brew.registry.redhat.io/rh-osbs/iib:${UPSTREAM_IIB##*:}"
  echo "[INFO] Using iib $TO_INSTALL image $IIB_IMAGE mirrored from $UPSTREAM_IIB"
else
  UPSTREAM_IIB_MANIFEST="$(skopeo inspect docker://${UPSTREAM_IIB} --raw || exit 2)"
  # echo "Got: $UPSTREAM_IIB_MANIFEST"
  if [[ $UPSTREAM_IIB_MANIFEST == *"Error parsing image name "* ]] || [[ $UPSTREAM_IIB_MANIFEST == *"manifest unknown"* ]]; then
    echo "$UPSTREAM_IIB_MANIFEST"; exit 3
  else
    echo "[INFO] Using iib $TO_INSTALL image $UPSTREAM_IIB"
    IIB_IMAGE="${UPSTREAM_IIB}"
  fi
fi

# optional requirements (for brew.registry secret)
if [[ "${IIB_IMAGE}" == "brew.registry"* ]] && [[ ! $(command -v podman) ]]; then
  errorf "Please install podman to login to brew.registry.redhat.io, or use --iib to specify an IIB from a registry that doesn't require login"
  exit 1
fi

# Check we're logged into a cluster
if ! oc whoami > /dev/null 2>&1; then
  errorf "Not logged into an OpenShift cluster"
  exit 1
fi

# Optionally disable all default CatalogSources, since we'll be installing from the IIB
if [ "$DISABLE_CATALOGSOURCES" == "true" ]; then
  echo "[INFO] Disable default catalog sources"
  oc patch OperatorHub cluster --type json -p '[{"op": "add", "path": "/spec/disableAllDefaultSources", "value": true}]'
fi

if [[ "${IIB_IMAGE}" == "brew.registry"* ]]; then
  # Grab Brew registry token and verify we can use it
  BREW_TOKENS="$(curl --negotiate -u : https://employee-token-manager.registry.redhat.com/v1/tokens -s)"
  if [[ $(echo "$BREW_TOKENS" | jq -r 'length') == "0" ]]; then
    errorf "No registry token configured -- make sure you've run kinit and have a token set up according to"
    errorf "the 'Adding Brew Pull Secret' section in https://docs.engineering.redhat.com/display/CFC/Test"
    exit 1
  fi
  if [[ $(echo "$BREW_TOKENS" | jq -r 'length') != "1" ]]; then
    echo "Multiple tokens found, using the first one"
  fi
  # Add image pull secret to cluster to allow pulling from brew.registry.redhat.io
  TOKEN_USERNAME=$(echo "$BREW_TOKENS" | jq -r '.[0].credentials.username')
  PASSWORD=$(echo "$BREW_TOKENS" | jq -r '.[0].credentials.password')
  oc get secret/pull-secret -n openshift-config -o json | jq -r '.data.".dockerconfigjson"' | base64 -d > authfile
  # CRW-3463 can use podman login --tls-verify=false to work around 'certificate signed by unknown authority'
  echo "$PASSWORD" | podman login --authfile authfile --username "$TOKEN_USERNAME" --password-stdin brew.registry.redhat.io
  oc set data secret/pull-secret -n openshift-config --from-file=.dockerconfigjson=authfile
  rm authfile
fi

# Create catalogsource project if necessary
if ! oc get project "$NAMESPACE_CATALOGSOURCE" > /dev/null 2>&1; then
  echo "Project $NAMESPACE_CATALOGSOURCE does not exist; creating it"
  oc new-project "$NAMESPACE_CATALOGSOURCE"
fi

if [[ $TO_INSTALL ]]; then
  # Create subscription project if necessary
  if ! oc get project "$NAMESPACE_SUBSCRIPTION" > /dev/null 2>&1; then
    echo "Project $NAMESPACE_SUBSCRIPTION does not exist; creating it"
    oc create namespace "$NAMESPACE_SUBSCRIPTION"
  fi
fi

TMPDIR=$(mktemp -d)

# Add ImageContentSourcePolicy to let us pull the IIB
if [[ $ICSP_URLs ]]; then
  for ICSP_URL in $ICSP_URLs; do
    ICSP_URL_PRE=${ICSP_URL%%/*}
    # echo "[DEBUG] ${ICSP_URL_PRE}, ${ICSP_URL_PRE//./-}, ${ICSP_URL}"
    echo "apiVersion: operator.openshift.io/v1alpha1
kind: ImageContentSourcePolicy
metadata:
  name: ${ICSP_URL_PRE//./-}
spec:
  repositoryDigestMirrors:
  ## 1. add mappings for Developer Hub bundle, operator, hub
  - mirrors:
    - ${ICSP_URL}rhdh-operator-bundle
    source: registry.redhat.io/rhdh/rhdh-operator-bundle
  - mirrors:
    - ${ICSP_URL}rhdh-operator-bundle
    source: registry.stage.redhat.io/rhdh/rhdh-operator-bundle
  - mirrors:
    - ${ICSP_URL}rhdh-operator-bundle
    source: registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-operator-bundle

  - mirrors:
    - ${ICSP_URL}rhdh-rhel9-operator
    source: registry.redhat.io/rhdh/rhdh-rhel9-operator
  - mirrors:
    - ${ICSP_URL}rhdh-rhel9-operator
    source: registry.stage.redhat.io/rhdh/rhdh-rhel9-operator
  - mirrors:
    - ${ICSP_URL}rhdh-rhel9-operator
    source: registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-rhel9-operator

  - mirrors:
    - ${ICSP_URL}rhdh-hub-rhel9
    source: registry.redhat.io/rhdh/rhdh-hub-rhel9
  - mirrors:
    - ${ICSP_URL}rhdh-hub-rhel9
    source: registry.stage.redhat.io/rhdh/rhdh-hub-rhel9
  - mirrors:
    - ${ICSP_URL}rhdh-hub-rhel9
    source: registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-hub-rhel9

  ## 2. general repo mappings
  - mirrors:
    - ${ICSP_URL_PRE}
    source: registry.redhat.io
  - mirrors:
    - ${ICSP_URL_PRE}
    source: registry.stage.redhat.io
  - mirrors:
    - ${ICSP_URL_PRE}
    source: registry-proxy.engineering.redhat.com

  ### now add mappings to resolve internal references
  - mirrors:
    - registry.redhat.io
    source: registry.stage.redhat.io
  - mirrors:
    - registry.stage.redhat.io
    source: registry-proxy.engineering.redhat.com
  - mirrors:
    - registry.redhat.io
    source: registry-proxy.engineering.redhat.com
" > $TMPDIR/ImageContentSourcePolicy_${ICSP_URL_PRE}.yml && oc apply -f $TMPDIR/ImageContentSourcePolicy_${ICSP_URL_PRE}.yml
  done
fi

# Add CatalogSource for the IIB
# Throw it in openshift-operators to make life a little easier for now
if [ -z "$TO_INSTALL" ]; then
  IIB_NAME="${UPSTREAM_IIB##*:}"
  IIB_NAME="${IIB_NAME//_/-}"
  IIB_NAME="${IIB_NAME//./-}"
  IIB_NAME="$(echo "$IIB_NAME" | tr '[:upper:]' '[:lower:]')"
  CATALOGSOURCE_NAME="iib-${IIB_NAME}-${OLM_CHANNEL}"
else
  CATALOGSOURCE_NAME="${TO_INSTALL}-${OLM_CHANNEL}"
fi
# echo "Creating catalog source: $CATALOGSOURCE_NAME ..."
echo "apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: ${CATALOGSOURCE_NAME}
  namespace: $NAMESPACE_CATALOGSOURCE
spec:
  sourceType: grpc
  image: ${IIB_IMAGE}
  publisher: IIB ${CATALOGSOURCE_NAME} ${TO_INSTALL}
  displayName: IIB ${CATALOGSOURCE_NAME} ${TO_INSTALL}
" > $TMPDIR/CatalogSource.yml && oc apply -f $TMPDIR/CatalogSource.yml

if [ -z "$TO_INSTALL" ]; then
  echo "Done"
  exit 0
fi

# Create OperatorGroup to allow installing all-namespaces operators in $NAMESPACE_SUBSCRIPTION
echo "Creating OperatorGroup to allow all-namespaces operators to be installed"
echo "apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: rhdh-operator-group
  namespace: ${NAMESPACE_SUBSCRIPTION}
" > $TMPDIR/OperatorGroup.yml && oc apply -f $TMPDIR/OperatorGroup.yml

# Create subscription for operator
echo "apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: $TO_INSTALL
  namespace: $NAMESPACE_SUBSCRIPTION
spec:
  channel: $OLM_CHANNEL
  installPlanApproval: $INSTALL_PLAN_APPROVAL
  name: $TO_INSTALL
  source: ${CATALOGSOURCE_NAME}
  sourceNamespace: $NAMESPACE_CATALOGSOURCE
" > $TMPDIR/Subscription.yml && oc apply -f $TMPDIR/Subscription.yml

# cleanup temp yaml files
# echo "Temp files in $TMPDIR"
rm -fr $TMPDIR
