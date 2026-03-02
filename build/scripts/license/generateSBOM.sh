#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Generate SBOMs for RHDH container images.

Options:
  --image <ref>           RHDH hub image reference (e.g. registry.redhat.io/rhdh/rhdh-hub-rhel9:1.10)
  --catalog-index <ref>   Plugin catalog-index image reference (e.g. quay.io/rhdh/plugin-catalog-index:1.10)
  --output-dir <path>     Directory for generated SBOMs (default: ./sboms)
  --help                  Show this help message

At least one of --image or --catalog-index must be provided.
EOF
}

IMAGE=""
CATALOG_INDEX=""
OUTPUT_DIR="./sboms"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      IMAGE="$2"
      shift 2
      ;;
    --catalog-index)
      CATALOG_INDEX="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$IMAGE" && -z "$CATALOG_INDEX" ]]; then
  echo "Error: At least one of --image or --catalog-index must be provided." >&2
  usage >&2
  exit 1
fi

if ! command -v podman &> /dev/null || ! command -v syft &> /dev/null; then
  echo "Error: Both podman and syft must be installed." >&2
  echo "To install syft, see https://github.com/anchore/syft/tree/main?tab=readme-ov-file#recommended" >&2
  exit 1
fi

if [[ -n "$CATALOG_INDEX" ]] && ! command -v jq &> /dev/null; then
  echo "Error: jq must be installed when using --catalog-index." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

generate_sbom() {
  local image="$1"
  local sbom_name="$2"

  echo "========================================"
  echo "Generating SBOM: $sbom_name"
  echo "  Image: $image"
  echo "========================================"

  # TODO: Remove platform flag once we support arm64
  podman pull --platform linux/amd64 "$image"

  local image_id
  image_id=$(podman images --format "{{.ID}}" --filter reference="$image")

  if [[ -z "$image_id" ]]; then
    echo "Error: Failed to extract image ID for $image." >&2
    return 1
  fi

  local tar_name
  tar_name=$(mktemp --suffix=.tar)

  podman save -o "$tar_name" "$image_id"
  syft scan "docker-archive:$tar_name" --output cyclonedx-json="$OUTPUT_DIR/$sbom_name"
  rm -f "$tar_name"

  echo "  -> Saved to $OUTPUT_DIR/$sbom_name"
  echo ""
}

if [[ -n "$IMAGE" ]]; then
  IMAGE_TAG="${IMAGE##*:}"
  IMAGE_TAG="${IMAGE_TAG##*@}"
  generate_sbom "$IMAGE" "${IMAGE_TAG}.sbom.json"
fi

if [[ -n "$CATALOG_INDEX" ]]; then
  echo "========================================"
  echo "Processing catalog-index: $CATALOG_INDEX"
  echo "========================================"

  TMPDIR=$(mktemp -d)
  trap 'rm -rf "$TMPDIR"' EXIT

  podman pull --platform linux/amd64 "$CATALOG_INDEX"

  CONTAINER_ID=$(podman create "$CATALOG_INDEX")

  podman cp "$CONTAINER_ID:/index.json" "$TMPDIR/index.json"
  podman rm "$CONTAINER_ID" > /dev/null

  PLUGIN_COUNT=$(jq 'length' "$TMPDIR/index.json")
  echo "Found $PLUGIN_COUNT plugins in $CATALOG_INDEX."
  echo ""

  jq -r 'to_entries[] | "\(.key) \(.value.registryReference)"' "$TMPDIR/index.json" |
  while read -r PLUGIN_NAME PLUGIN_IMAGE; do
    # Replace r.a.r.com registry with the quay.io registry since r.a.r.com images aren't available until GA
    PLUGIN_IMAGE="${PLUGIN_IMAGE/registry.access.redhat.com/quay.io}"
    generate_sbom "$PLUGIN_IMAGE" "${PLUGIN_NAME}.sbom.json"
  done
fi

echo "All SBOMs written to $OUTPUT_DIR."
