#!/usr/bin/env bash
#
# Copyright Red Hat
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <image_ref> <output_dir>" >&2
    echo "  image_ref   Local image reference (e.g. vector-store:latest)" >&2
    echo "  output_dir  Destination directory for extracted RAG assets" >&2
    exit 1
fi

IMAGE_REF="$1"
OUTPUT_DIR="$2"

CONTAINER_ID=""
MOUNT_POINT=""

cleanup() {
    if [ -n "$CONTAINER_ID" ]; then
        if [ -n "$MOUNT_POINT" ]; then
            buildah unmount "$CONTAINER_ID" >/dev/null 2>&1 || true
        fi
        buildah rm "$CONTAINER_ID" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

CONTAINER_ID=$(buildah from "$IMAGE_REF")
MOUNT_POINT=$(buildah mount "$CONTAINER_ID")

VECTOR_DB_SOURCE="${MOUNT_POINT}/rag/vector_db"
EMBEDDING_MODEL_SOURCE="${MOUNT_POINT}/rag/embeddings_model"

if [ ! -d "$VECTOR_DB_SOURCE" ]; then
    echo "Missing vector DB directory in image at '$VECTOR_DB_SOURCE'" >&2
    exit 1
fi

if [ ! -d "$EMBEDDING_MODEL_SOURCE" ]; then
    echo "Missing embeddings model directory in image at '$EMBEDDING_MODEL_SOURCE'" >&2
    exit 1
fi

mkdir -p "${OUTPUT_DIR}/vector_db"
mkdir -p "${OUTPUT_DIR}/embeddings_model"
cp -a "${VECTOR_DB_SOURCE}/." "${OUTPUT_DIR}/vector_db/"
cp -a "${EMBEDDING_MODEL_SOURCE}/." "${OUTPUT_DIR}/embeddings_model/"
