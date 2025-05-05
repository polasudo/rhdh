#!/bin/bash

# ------------------------------------------------------------------------------
# Script: update-sealights-bundles.sh
#
# Description:
#   This script is used to generate RHDH bundles with Sealights images that are related to orginal bundles manifests.
#
#   It leverages Cosign to retrieve pristine image attestations and extract related
#   Sealights image references based on trusted artifact metadata. All Konflux components
#   built with Sealights via Tekton tasks include a `konflux-ci/sealights: "true"` label,
#   which Cosign uses to easily identify and retrieve the corresponding Sealights image
#   associated with the pristine image.
#
#   For more details, refer to the Sealights task documentation:
#   https://github.com/konflux-ci/tekton-integration-catalog/blob/main/tasks/sealights/sealights-get-refs/0.1/README.md
#
#   operator-related YAML manifests.
#
#   It performs the following steps:
#     1. Extracts the operator image and the RHDH Hub image from the operator CSV file.
#     2. Swaps `registry.redhat.io` to `quay.io` (for attestation compatibility).
#     3. Attempts to extract Sealights Container Images from cosign attestation.
#     4. Falls back to the `quay.io` version of the image if Sealights Image env is missing.
#     5. Replaces the original image strings in both target YAML files.
#
# Requirements:
#   - yq
#   - jq
#   - cosign (for downloading attestations)
#
# ------------------------------------------------------------------------------

set -euo pipefail

CONTEXT="${CONTEXT:-.}"

# Ensure the context path is valid
if [ ! -d "$CONTEXT/manifests" ]; then
  echo "[ERROR] Directory '$CONTEXT/manifests' not found."
  echo "Please set CONTEXT to the correct path. Example:"
  echo "  CONTEXT=/path/to/dir ./update-sealights-bundles.sh"
  exit 1
fi

OPERATOR_FILE="$CONTEXT/manifests/rhdh-operator.clusterserviceversion.yaml"

# Manifests files to update
TARGET_FILES=(
  "$CONTEXT/manifests/rhdh-operator.clusterserviceversion.yaml"
  "$CONTEXT/manifests/rhdh-default-config_v1_configmap.yaml"
)

# Extract RHDH hub and operator images
RHDH_OPERATOR_IMAGE=$(yq '.metadata.annotations.containerImage' "$OPERATOR_FILE")
RHDH_HUB_IMAGE=$(yq '.spec.install.spec.deployments[].spec.template.spec.containers[].env[]
  | select(.name == "RELATED_IMAGE_backstage") | .value' "$OPERATOR_FILE")

# Swap registry.redhat.io -> quay.io
swap_registry_if_needed() {
  local image="$1"
  [[ "$image" == registry.redhat.io/* ]] && echo "${image/registry.redhat.io/quay.io}" || echo "$image"
}

# Resolve final image from cosign or fallback to quay.io ones if dont exist any Sealights image
resolve_final_image() {
  local IMAGE="$1"
  local COSIGN_IMAGE
  COSIGN_IMAGE=$(swap_registry_if_needed "$IMAGE")

  # Use container name to name attestation file
  local SAFE_NAME
  SAFE_NAME=$(basename "$(echo "$IMAGE" | cut -d'@' -f1 | cut -d':' -f1)")
  local COSIGN_FILE="cosign_metadata_${SAFE_NAME}.json"

  echo "[INFO] Trying cosign attestation for: $COSIGN_IMAGE" >&2
  if ! cosign download attestation "$COSIGN_IMAGE" > "$COSIGN_FILE" 2>/dev/null; then
    echo "[WARN] SL_CONTAINER_IMAGE not found — using fallback $COSIGN_IMAGE" >&2
    echo "$COSIGN_IMAGE"
    return
  fi

  local SL_CONTAINER_IMAGE
  SL_CONTAINER_IMAGE=$(jq -r '
    .payload
    | @base64d
    | fromjson
    | .predicate.buildConfig.tasks[]
    | select(.invocation.parameters.IMAGE? // "" | test("sealights"))
    | .invocation.parameters.IMAGE
  ' "$COSIGN_FILE")

  if [ -z "$SL_CONTAINER_IMAGE" ] || [ "$SL_CONTAINER_IMAGE" == "null" ]; then
    echo "[WARN] SL_CONTAINER_IMAGE not found — using fallback $COSIGN_IMAGE" >&2
    echo "$COSIGN_IMAGE"
  else
    echo "[INFO] Resolved SL_CONTAINER_IMAGE: $SL_CONTAINER_IMAGE" >&2
    echo "$SL_CONTAINER_IMAGE"
  fi
}

replace_image_in_files() {
  local ORIGINAL="$1"
  local REPLACEMENT="$2"

  local CLEANED_REPLACEMENT
  CLEANED_REPLACEMENT=$(echo "$REPLACEMENT" | tr -d '\n')
  local ESCAPED_REPLACEMENT
  ESCAPED_REPLACEMENT=$(printf '%s' "$CLEANED_REPLACEMENT" | sed 's/[\/&]/\\&/g')

  for FILE in "${TARGET_FILES[@]}"; do
    echo "[INFO] Replacing in $FILE: $ORIGINAL → $CLEANED_REPLACEMENT"
    sed -i "s|$ORIGINAL|$ESCAPED_REPLACEMENT|g" "$FILE"
  done
}

# Process operator image
if [ -n "$RHDH_OPERATOR_IMAGE" ] && [ "$RHDH_OPERATOR_IMAGE" != "null" ]; then
  FINAL_OPERATOR_IMAGE=$(resolve_final_image "$RHDH_OPERATOR_IMAGE")
  replace_image_in_files "$RHDH_OPERATOR_IMAGE" "$FINAL_OPERATOR_IMAGE"
else
  echo "[WARN] RHDH_OPERATOR_IMAGE not found"
fi

# Process RHDH hub image
if [ -n "$RHDH_HUB_IMAGE" ] && [ "$RHDH_HUB_IMAGE" != "null" ]; then
  FINAL_HUB_IMAGE=$(resolve_final_image "$RHDH_HUB_IMAGE")
  replace_image_in_files "$RHDH_HUB_IMAGE" "$FINAL_HUB_IMAGE"
else
  echo "[WARN] RHDH_HUB_IMAGE not found"
fi

echo "[INFO] All image replacements complete."
