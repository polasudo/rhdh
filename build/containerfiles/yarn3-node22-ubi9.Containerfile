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
    # find latest at https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/
    cd /tmp; curl -sSLkO https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00118133-redhat-internal-cert-install/redhat-internal-cert-install-0.2-2.el9.noarch.rpm; \
    # add repo to resolve helm
    dnf config-manager --add-repo https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel9/x86_64/ocp-tools/4.17/os/ -q; \
    dnf -y -q install brotli-devel cmake gcc gcc-c++ git golang helm jq make nodejs npm openssl openssl-devel gettext \
        python3 python3-pip python3-dnf rsync skopeo sudo zlib-devel \
        krb5-workstation redhat-internal-cert-install*.rpm && dnf clean all && \
        rm -f /tmp/redhat-internal-cert-install*.rpm; \
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
    for r in jq node node-gyp npm prettier yq janus-cli rpm-lockfile-prototype turbo; do echo -n "$(which $r) : "; "$r" --version || true; done; \
    dnf repolist; for r in /etc/yum.repos.d/*; do echo "==== $r ====>"; grep "enabled = 1" -B3 -A2 $r; echo "<==== $r ===="; done
