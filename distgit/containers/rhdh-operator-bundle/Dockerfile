#
# Copyright (c) 2023 Red Hat, Inc.
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

FROM scratch

# Copy files to locations specified by labels.
COPY manifests /manifests/
COPY metadata /metadata/

# append Brew metadata here
ENV SUMMARY="Red Hat Developer Hub operator bundle" \
    DESCRIPTION="Red Hat Developer Hub operator bundle" \
    UPSTREAM_REPO="janus-idp/operator main @ bb549e4e" \
    MIDSTREAM_REPO="gitlab.cee.redhat.com/rhidp/rhdh rhdh-1-rhel-9" \
    PRODNAME="rhdh" \
    COMPNAME="operator-bundle"

LABEL operators.operatorframework.io.bundle.mediatype.v1=registry+v1 \
      operators.operatorframework.io.bundle.manifests.v1=manifests/ \
      operators.operatorframework.io.bundle.metadata.v1=metadata/ \
      operators.operatorframework.io.bundle.package.v1=rhdh \
      operators.operatorframework.io.bundle.channels.v1=fast,fast-1.3 \
      operators.operatorframework.io.bundle.channel.default.v1=fast \
      com.redhat.delivery.operator.bundle="true" \
      com.redhat.openshift.versions="v4.12" \
      com.redhat.delivery.backport=false \
      summary="$SUMMARY" \
      description="$DESCRIPTION" \
      io.k8s.description="$DESCRIPTION" \
      io.k8s.display-name="$DESCRIPTION" \
      io.openshift.tags="$PRODNAME,$COMPNAME" \
      com.redhat.component="$PRODNAME-$COMPNAME-container" \
      name="$PRODNAME/$PRODNAME-$COMPNAME" \
      version="1.3" \
      license="ASLv2" \
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \
      io.openshift.expose-services="" \
      usage=""
