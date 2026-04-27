#!/bin/bash

#
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

set -eou pipefail

RHDH_VERSION=$1

trap "rm -rf red-hat-developers-documentation-rhdh" EXIT

rm -rf rhdh-product-docs-plaintext/${RHDH_VERSION}
rm -rf rhdh-docs-topic-map

git clone --single-branch --branch release-${RHDH_VERSION} https://github.com/redhat-developer/red-hat-developers-documentation-rhdh

git clone --single-branch --branch release-${RHDH_VERSION} https://github.com/redhat-ai-dev/rhdh-docs-topic-map

python scripts/convert_adoc_to_txt_rhdh.py \
    -i red-hat-developers-documentation-rhdh \
    -o rhdh-product-docs-plaintext/${RHDH_VERSION} \
    -t rhdh-docs-topic-map/rhdh_topic_map.yaml
