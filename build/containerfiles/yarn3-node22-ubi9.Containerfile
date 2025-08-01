# Using this containerfile to define the runtime environment for the export plugins tekton tasks
# https://registry.access.redhat.com/ubi9/nodejs-22
FROM registry.access.redhat.com/ubi9/nodejs-22:9.6-1753172464
USER 0

ENV oras_version="1.2.2" \
    DSF_TAG="v0.1.15"

# Install required libraries
RUN PATH=$PATH:/opt/app-root/src/.local/bin; \
    cd /tmp; curl -sSLkO \
    https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00122526-redhat-internal-cert-install/redhat-internal-cert-install-0.2-4.el9.noarch.rpm; \
    curl -sSLkO \
    https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00122526-redhat-internal-cert-install/redhat-internal-cert-install-ca2015-0.2-4.el9.noarch.rpm; \
    # add repo to resolve helm
    dnf config-manager --add-repo https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel9/x86_64/ocp-tools/4.18/os/ -q; \
    dnf update -y -q && \
    dnf install -y -q jq buildah git python3.11-pip patch brotli-devel cmake gcc gcc-c++ git golang helm jq make nodejs npm openssl openssl-devel gettext \
        rsync skopeo sudo zlib-devel \
        krb5-workstation redhat-internal-cert-install*.rpm && dnf clean all && \
        rm -f /tmp/redhat-internal-cert-install*.rpm; \
    alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    alternatives --install /usr/bin/pip pip /usr/bin/pip3.11 1 && \
      # fix ownership for pip install folder
    mkdir -p /opt/app-root/src/.cache/pip && chown -R root:root /opt/app-root && \
    pip install --no-cache-dir -q yq && \
    yq --version; \
    pip install --no-cache-dir -q --user https://github.com/konflux-ci/rpm-lockfile-prototype/archive/refs/heads/main.zip; \
    mv ~/.local/bin/* /usr/local/bin/; \
    time npm install --network-timeout=600000 --global npm corepack typescript husky node-gyp prettier turbo @janus-idp/cli; \
    corepack enable; \
    corepack install -g yarn; \
    yarn set version 3.8.7; \
    yarn install; \
    yarn config set httpTimeout 600000; \
    yarn config set npmRegistryServer $(npm config get registry); \
    yarn -v; \
    # list installed binaries and default locations
    for r in jq node node-gyp npm prettier yq janus-cli rpm-lockfile-prototype turbo; do echo -n "$(which $r) : "; "$r" --version || true; done; \
    dnf repolist; for r in /etc/yum.repos.d/*; do echo "==== $r ====>"; grep -E "enabled=1|enabled = 1" -B3 -A2 $r; echo "<==== $r ===="; done

# build and install download-secure-files from sources
RUN \
    pushd /tmp >/dev/null || exit 1; \
    # Redirect console output and errors to a log file to make this log shorter
    exec 3>&1 4>&2 1>> /tmp/gitlab-ci-env-setup.sh.build.log.txt 2>> /tmp/gitlab-ci-env-setup.sh.build.log.txt; \
        rm -fr download-secure-files/; \
        git clone https://gitlab.com/gitlab-org/incubation-engineering/mobile-devops/download-secure-files.git && cd download-secure-files/; \
        git checkout $DSF_TAG; \
        echo "download-secure-files version: $(cat VERSION)"; \
        go get; CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-X 'main.Version=$(cat VERSION)'" -o "$HOME/bin/download-secure-files" download-secure-files; \
        go test -v; \
        chmod +x "$HOME/bin/download-secure-files"; \
        rm -fr /tmp/download-secure-files; \
    # end console redirection of output and errors
    exec 1>&3 3>&- 2>&4 4>&- ; \
    popd >/dev/null || exit 1

RUN orasrepo="https://github.com/oras-project/oras/releases/download/v${oras_version}/" &&\
    orastar="oras_${oras_version}_linux_amd64.tar.gz" &&\
    echo "Installing oras from $orasrepo ..." &&\
    curl -sSLO "${orasrepo}${orastar}" &&\
    tar -zxf $orastar -C /usr/local/bin/ oras &&\
    rm -rf $orastar oras-install/

# RHIDP-4220 - make Konflux preflight and EC checks happy - [check-container] Create a directory named /licenses and include all relevant licensing
COPY licenses /licenses/

RUN chown -R 1001:1001 /opt/app-root/src/

# Prepare appropriate storage driver for buildah
ENV STORAGE_DRIVER=vfs
RUN sed -i '/^mountopt =.*/d' /etc/containers/storage.conf

# # RHIDP-4220 - make Konflux preflight happy (don't run as root)
# USER 1001

# append Brew metadata here
ENV SUMMARY="Red Hat Developer Hub plugin catalog index" \
    DESCRIPTION="Red Hat Developer Hub plugin catalog index" \
    UPSTREAM_REPO="https://github.com/redhat-developer/rhdh-plugin-export-overlays/tree/main @ fcfb07f6" \
    MIDSTREAM_REPO="https://gitlab.cee.redhat.com/rhidp/rhdh-plugin-catalog/-/commits/rhdh-1-rhel-9" \
    PRODNAME="rhdh" \
    COMPNAME="plugin-catalog-index"

LABEL summary="$SUMMARY" \
      description="$DESCRIPTION" \
      io.k8s.description="$DESCRIPTION" \
      io.k8s.display-name="$DESCRIPTION" \
      io.openshift.tags="$PRODNAME,$COMPNAME" \
      com.redhat.component="$PRODNAME-$COMPNAME-container" \
      name="$PRODNAME/$PRODNAME-$COMPNAME-rhel9" \
      version="1.8" \
      release="0" \
      license="ASLv2" \
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \
      vendor="Red Hat, Inc." \
      io.openshift.expose-services="" \
      usage="" \
      konflux.additional-tags="next" \
      distribution-scope="public" \
      url="https://red.ht/rhdh"
