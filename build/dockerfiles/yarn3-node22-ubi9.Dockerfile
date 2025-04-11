# hadolint ignore=DL3006,DL3007
FROM registry.redhat.io/ubi9:latest
# hadolint ignore=DL3002
USER 0
WORKDIR /workspace
COPY distgit/containers/rhdh-hub/package.json /tmp/
# hadolint ignore=DL3013,DL3041
RUN \
    dnf -y -q update && \
    dnf module enable nodejs:22 -y && \
    dnf -y -q install brotli-devel cmake gcc gcc-c++ git jq make nodejs npm openssl openssl-devel gettext \
        python3 python3-pip python3-dnf rsync skopeo sudo zlib-devel && dnf clean all && \
        pip3 install --no-cache-dir -q yq; \
        pip3 install --no-cache-dir -q --user https://github.com/konflux-ci/rpm-lockfile-prototype/archive/refs/heads/main.zip; \
        mv ~/.local/bin/* /usr/local/bin/; \
    time npm install --network-timeout=600000 --global npm corepack husky node-gyp prettier turbo @janus-idp/cli; \
    corepack enable; \
    yarn set version 3.8.7; \
    yarn install; \
    yarn config set httpTimeout 600000; \
    yarn config set npmRegistryServer $(npm config get registry); \
    # list installed binaries and default locations
    for r in jq node node-gyp npm prettier yq janus-cli rpm-lockfile-prototype turbo; do echo -n "$(which $r) : "; "$r" --version || true; done