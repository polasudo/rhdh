FROM scratch

# Copy files to locations specified by labels.
COPY manifests /manifests/
COPY metadata /metadata/

# append Brew metadata here
ENV SUMMARY="Red Hat Developer Hub operator bundle" \
    DESCRIPTION="Red Hat Developer Hub operator bundle" \
    UPSTREAM_REPO="https://github.com/redhat-developer/rhdh-operator/tree/main @ 2f51276f" \
    MIDSTREAM_REPO="https://gitlab.cee.redhat.com/rhidp/rhdh/-/commits/rhdh-1-rhel-9" \
    PRODNAME="rhdh" \
    COMPNAME="operator-bundle"

LABEL operators.operatorframework.io.bundle.mediatype.v1=registry+v1 \
      operators.operatorframework.io.bundle.manifests.v1=manifests/ \
      operators.operatorframework.io.bundle.metadata.v1=metadata/ \
      operators.operatorframework.io.bundle.package.v1=rhdh \
      operators.operatorframework.io.bundle.channels.v1=fast,fast-1.4 \
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
      version="1.4" \
      vendor="Red Hat, Inc." \
      license="ASLv2" \
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \
      io.openshift.expose-services="" \
      usage="" \
      konflux.additional-tags="1.4, 1.4-RELEASE_NUMBER" \
      distribution-scope="public" \
      url="https://red.ht/rhdh"
