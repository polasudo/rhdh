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

VERSIONS_FILE="$(cd "$(dirname "$0")/.." && pwd)/versions.json"

usage() {
    echo "Usage: $0 <llama_stack_version>" >&2
    echo "  llama_stack_version  Version key from versions.json (e.g. '0.4.3', 'latest')" >&2
    exit 1
}

if [ $# -ne 1 ]; then
    usage
fi

VERSION="$1"

BASE_REPO=$(jq -r '.base_image' "$VERSIONS_FILE")
DIGEST=$(jq -r --arg version "$VERSION" \
    '.images[] | select(.llama_stack_version == $version) | .digest' "$VERSIONS_FILE")

if [ -z "$DIGEST" ] || [ "$DIGEST" == "null" ]; then
    AVAILABLE=$(jq -r '[.images[].llama_stack_version] | join(", ")' "$VERSIONS_FILE")
    echo "Error: Could not resolve digest for version='$VERSION' in $VERSIONS_FILE" >&2
    echo "Available versions: $AVAILABLE" >&2
    exit 1
fi

echo "${BASE_REPO}@${DIGEST}"
