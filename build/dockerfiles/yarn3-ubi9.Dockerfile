# hadolint ignore=DL3006,DL3007
FROM registry.redhat.io/ubi9:latest
# hadolint ignore=DL3002
USER 0
WORKDIR /workspace
COPY distgit/containers/rhdh-hub/package.json /tmp/
# hadolint ignore=DL3013,DL3041
RUN \
    dnf -y -q update && \
    dnf module enable nodejs:20 -y && \
    dnf -y -q install brotli-devel cmake gcc gcc-c++ git jq make nodejs npm openssl openssl-devel gettext \
        python3-pip rsync skopeo sudo zlib-devel && dnf clean all && \
    pip3 install --no-cache-dir -q yq
# hadolint ignore=SC3037,DL4006,DL3016
RUN \
    time npm install --network-timeout=600000 --global npm corepack husky node-gyp prettier turbo @janus-idp/cli; \
    corepack enable; \
    yarn set version 3.8.6; \
    yarn install; \
    yarn config set httpTimeout 600000; \
    yarn config set npmRegistryServer $(npm config get registry); \
    # list installed binaries and default locations
    for r in jq node node-gyp npm prettier turbo yq janus-cli; do echo -n "$(which $r) : "; "$r" --version; done; \
    echo -n "husky : "; husky -v
