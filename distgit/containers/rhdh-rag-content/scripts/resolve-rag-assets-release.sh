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

usage() {
    echo "Usage: $0 <github_repository> <llama_version>" >&2
    echo "" >&2
    echo "  github_repository  GitHub repository in owner/name form" >&2
    echo "  llama_version      Llama Stack version suffix used in release tag" >&2
    exit 1
}

if [ "$#" -ne 2 ]; then
    usage
fi

GITHUB_REPOSITORY_NAME="$1"
LLAMA_VERSION="$2"

if [ -z "$LLAMA_VERSION" ]; then
    echo "llama_version must not be empty" >&2
    exit 1
fi

RELEASE_TAG=$(gh api "repos/${GITHUB_REPOSITORY_NAME}/releases?per_page=100" \
    --jq ".[] | select(.tag_name | startswith(\"rag-assets-rhdh-\") and endswith(\"-lls-${LLAMA_VERSION}\")) | .tag_name" \
    | awk 'NR==1{print; exit}')

if [ -z "$RELEASE_TAG" ]; then
    echo "No release found for llama stack suffix '${LLAMA_VERSION}'" >&2
    exit 1
fi

ASSET_URL="https://github.com/${GITHUB_REPOSITORY_NAME}/releases/download/${RELEASE_TAG}/${RELEASE_TAG}.tar.gz"

echo "release_tag=${RELEASE_TAG}"
echo "asset_url=${ASSET_URL}"
