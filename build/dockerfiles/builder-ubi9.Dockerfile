# hadolint ignore=DL3006
FROM registry.redhat.io/ubi9:latest
USER 0
WORKDIR /workspace
COPY distgit/containers/rhdh-hub/package.json /tmp/
RUN \
    dnf -y -q update && \
    dnf module enable nodejs:18 -y && \
    dnf -y -q install brotli-devel cmake gcc gcc-c++ git jq make nodejs npm openssl openssl-devel \
        python3-pip rsync skopeo sudo zlib-devel && \
    pip3 install -q yq
RUN \
    # latest npm is 10 but build needs 9; yarn v1 assumes node-gyp is installed globally (RHIDP-694)
    time npm install --global husky npm@9 node-gyp@9 prettier turbo yarn@1; \
    # install node-gyp 9 and update if the build requires something newer
    nodegyp_to_install=$(grep node-gyp /tmp/package.json | tr -d "\" " | sed -r -e "s/:/@^/"); \
    time npm install --global "${nodegyp_to_install}"; \
    # list installed binaries and default locations
    for r in jq node node-gyp npm prettier turbo yq; do echo -n "$(which $r) : "; $r --version; done; \
    echo -n "husky : "; husky -v