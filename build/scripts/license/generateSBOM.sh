#!/usr/bin/env bash

if ! command -v podman &> /dev/null || ! command -v syft &> /dev/null; then
  echo "Error: Both podman and syft must be installed. To install syft, see https://github.com/anchore/syft/tree/main?tab=readme-ov-file#recommended"
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Usage: $0 <full_image_name> [<full_image_name> ...]"
  exit 1
fi

for RHDH_IMAGE in "$@"; do
  IMAGE_TAG=$(echo "$RHDH_IMAGE" | awk -F: '{print $2}')
  RHDH_SBOM_NAME="${IMAGE_TAG}.sbom.json"
  TAR_NAME="${IMAGE_TAG//:/-}.tar"

  export RHDH_IMAGE
  export RHDH_SBOM_NAME

  podman pull --platform linux/amd64 "$RHDH_IMAGE"

  IMAGE_ID=$(podman images --format "{{.ID}}" --filter reference="$RHDH_IMAGE")

  if [ -z "$IMAGE_ID" ]; then
    echo "Failed to extract image ID for $RHDH_IMAGE."
    exit 1
  fi

  podman save -o "$TAR_NAME" "$IMAGE_ID"

  syft scan "docker-archive:$TAR_NAME" --output cyclonedx-json="$RHDH_SBOM_NAME"

  rm "$TAR_NAME"
done
