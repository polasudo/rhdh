FROM quay.io/rhdh/plugin-catalog-builder-rhel9:1.9
USER 0

### GITLAB ONLY ### 
# Install non-RHEL RPMs (required for Gitlab pipelines only
# find latest at https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/
RUN \
    cd /tmp; \
    curl -sSLkO \
    https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00122526-redhat-internal-cert-install/redhat-internal-cert-install-0.2-4.el9.noarch.rpm; \
    curl -sSLkO \
    https://coprbe.devel.redhat.com/results/@endpoint-systems-sysadmins/unsupported-fedora-packages/epel-9-x86_64/00122526-redhat-internal-cert-install/redhat-internal-cert-install-ca2015-0.2-4.el9.noarch.rpm; \
    dnf -y -q install redhat-internal-cert-install*.rpm; \
    rm -f /tmp/redhat-internal-cert-install*.rpm
### GITLAB ONLY ### 

