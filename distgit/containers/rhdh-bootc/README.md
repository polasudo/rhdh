# RHDH Bootc Base Image

RHEL 9 Image Mode (bootc) base container for Red Hat Developer Hub. The Ansible
team layers portal-specific customisations (plugins, app-config, CLI tools,
devtools) on top of this image.

## Prerequisites

Registry credentials for `registry.redhat.io` are required. See
[Getting a Red Hat login](https://access.redhat.com/articles/RegistryAuthentication#getting-a-red-hat-login-2)
for details.

```bash
podman login registry.redhat.io
```

## Build

From **this directory**:

```bash
./build.sh                  # uses auto-detected auth
./build.sh --no-cache       # rebuild without layer cache
```

The script looks for credentials in `./auth.json`,
`~/.config/containers/auth.json`, `$XDG_RUNTIME_DIR/containers/auth.json`, or
`~/.docker/config.json`. `auth.json` is gitignored.

## Contents

```
Containerfile             # production Containerfile (bootc base image)
configs/
  app-config/             # RHDH app-config (base defaults)
  catalog-entities/       # catalog entities and docs
  dynamic-plugins/        # dynamic plugin overrides
quadlet/
  rhdh.container          # Quadlet for RHDH hub (pinned to SHA digest)
  rhdh.env                # RHDH environment variables
  postgres.container      # Quadlet for PostgreSQL 15 (pinned to SHA digest)
  postgres.env            # PostgreSQL environment variables
  rhdh-network.network    # bridge network for inter-container DNS
scripts/
  detect-and-set-base-url.sh                # auto-detect VM IP at boot
  health-check.sh                           # service health verification
  prepare-and-install-dynamic-plugins.sh    # plugin installation
  wait-for-plugins-and-start.sh             # RHDH startup script
rpms.in.yaml              # RPM deps for Cachi2 prefetch
```

## Test locally

Quadlet services start automatically via systemd inside the bootc container:

```bash
podman run -d --name rhdh-bootc-test --privileged \
  -p 7007:7007 -p 5432:5432 \
  localhost/rhdh-bootc:latest

# Wait ~60s for services, then:
podman exec rhdh-bootc-test systemctl status postgres.service rhdh.service --no-pager
```

Use `http://127.0.0.1:7007/` (not `localhost`) to avoid IPv6 issues.

## SSH access

The base image creates a locked `admin` user with key-based SSH only (password
auth disabled). Downstream layers inject SSH public keys at build time or via
cloud-init.

## Air-gap support

Container images (RHDH hub + PostgreSQL) are pre-pulled into
`/usr/lib/containers/storage` at build time. The Quadlet `.container` files are
symlinked into `/usr/lib/bootc/bound-images.d/` so bootc tracks them for
lifecycle management.

## Konflux pipeline

The Tekton pipeline template is at `.tekton-templates/rhdh-bootc-pipeline.yaml`.
Generate push/pull variants with:

```bash
.tekton/generatePipelineRuns.sh -t <version>
```

The bootc component has its own Konflux Application (`rhdh-bootc-<version>`)
and is released independently from hub/operator/bundle.
