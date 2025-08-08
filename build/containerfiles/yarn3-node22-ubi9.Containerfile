# runtime environment for RHDH builds and plugin exports
# https://registry.access.redhat.com/ubi9/nodejs-22
# FROM registry.access.redhat.com/ubi9/nodejs-22:9.6-1753172464

https://registry.access.redhat.com/ubi9
FROM registry.redhat.io/ubi9:9.6-1754586119
USER 0

ENV oras_version="1.2.2" \
    DSF_TAG="v0.1.15" \
    RLP_TAG="v0.17.0"

# Install required tools
RUN PATH=$PATH:/opt/app-root/src/.local/bin; \
    useradd default -d /opt/app-root/src/ -u 1001 >/dev/null 2>&1 || true; \
    cd /tmp; \
    # find latest at https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/
    curl -sSLkO \
    https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00122526-redhat-internal-cert-install/redhat-internal-cert-install-0.2-4.el9.noarch.rpm; \
    curl -sSLkO \
    https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00122526-redhat-internal-cert-install/redhat-internal-cert-install-ca2015-0.2-4.el9.noarch.rpm; \
    # add repo to resolve helm
    dnf config-manager --add-repo https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel9/x86_64/ocp-tools/4.18/os/ -q; \
    dnf -y -q update && \
    dnf module enable nodejs:22 -y && \
    dnf -y -q install brotli-devel buildah cmake gcc gcc-c++ git golang helm jq make nodejs npm openssl openssl-devel gettext patch \
        python3 python3-pip python3-dnf python3.11-pip rsync skopeo sudo zlib-devel \
        krb5-workstation redhat-internal-cert-install*.rpm && dnf clean all && \
    rm -f /tmp/redhat-internal-cert-install*.rpm; \
    alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 && \
    # alternatives --install /usr/bin/pip pip /usr/bin/pip3.11 1 && \
    # alternatives --install /usr/bin/pip3 pip3 /usr/bin/pip3.11 1 && \
    # fix for "Python bindings for DNF are missing"
    dnf -y -q reinstall python3-dnf python3-libdnf python3; \
    # fix ownership for pip install folder
    mkdir -p /opt/app-root/src/.cache/pip && chown -R default:default /opt/app-root/src/ && \
    pip3 install --no-cache-dir -q yq; \
    \
    # to verify rpm-lockfile-prototype was installed correctly, start this container:
    #   cd /path/to/rhidp/rhdh/distgit/containers/rhdh-hub
    #   podman run -it --rm --entrypoint /bin/sh --user root -v .:/host-mount <this-container>
    # then
    #   cd /host-mount; su default -c "rpm-lockfile-prototype -f Containerfile rpms.in.yaml"
    su - default -c "PATH=${PATH}:/opt/app-root/src/.local/bin; pip3 install --no-cache-dir -q --user https://github.com/konflux-ci/rpm-lockfile-prototype/archive/refs/tags/${RLP_TAG}.zip"; \
    \
    mv /opt/app-root/src/.local/bin/* /usr/local/bin/; \
    time npm install --network-timeout=600000 --global npm corepack typescript husky node-gyp prettier turbo @janus-idp/cli; \
    corepack enable; \
    corepack install -g yarn; \
    yarn set version 3.8.7; yarn -v; \
    yarn install; \
    yarn config set httpTimeout 600000; \
    yarn config set npmRegistryServer $(npm config get registry); \
    # list installed binaries and default locations
    for r in jq node node-gyp npm prettier yq janus-cli turbo; do echo -n "$(which $r) : "; "$r" --version || true; done; \
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

RUN rm -fr /opt/app-root/src/.cache/pip; chown -R 1001:1001 /opt/app-root/src/

# Prepare appropriate storage driver for buildah
ENV STORAGE_DRIVER=vfs
RUN mkdir -p /etc/containers; touch /etc/containers/storage.conf; sed -i '/^mountopt =.*/d' /etc/containers/storage.conf

# for gitlab, run as root
USER 0

# for konflux, must run as non-root (RHIDP-4220)
# USER 1001
