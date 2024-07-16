# hadolint ignore=DL3006,DL3007
FROM registry.redhat.io/ubi9:latest
# hadolint ignore=DL3002
USER 0
WORKDIR /workspace
COPY distgit/containers/rhdh-hub/package.json /tmp/
# hadolint ignore=DL3013,DL3041
RUN \
    dnf -y -q update && \
    dnf module enable nodejs:18 -y && \
    dnf -y -q install brotli-devel cmake gcc gcc-c++ git jq make nodejs npm openssl openssl-devel gettext \
        python3-pip rsync skopeo sudo zlib-devel && dnf clean all && \
    pip3 install --no-cache-dir -q yq
# hadolint ignore=SC3037,DL4006,DL3016
RUN \
    # latest npm is 10 but build needs 9; yarn v1 assumes node-gyp is installed globally (RHIDP-694)
    time npm install --global husky npm@9 node-gyp@9 prettier turbo yarn@1 @janus-idp/cli; \
    # install node-gyp 9 and update if the build requires something newer
    nodegyp_to_install=$(grep node-gyp /tmp/package.json | tr -d "\" " | sed -r -e "s/:/@^/"); \
    time npm install --global "${nodegyp_to_install}"; \
    # list installed binaries and default locations
    for r in jq node node-gyp npm prettier turbo yq janus-cli; do echo -n "$(which $r) : "; "$r" --version; done; \
    echo -n "husky : "; husky -v
