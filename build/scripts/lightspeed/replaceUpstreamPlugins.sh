#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# replaces lightspeed flavour upstream plugin OCI images with the product ones
#

# error if the required arguments are not met
if [ $# -ne 1 ]; then
    echo "expected one argument: $0 <values_or_flavor_configmap>"
    exit 1
fi

yml=$1

sed -i "$yml" -r \
    -e "s@'?oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-lightspeed-backend:.+'?@oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-lightspeed-backend:{{inherit}}@g" \
    -e "s@'?oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-lightspeed:.+'?@oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-lightspeed:{{inherit}}@g"
