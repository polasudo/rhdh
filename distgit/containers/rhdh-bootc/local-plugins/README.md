# Local Plugins (Air-Gapped Deployments)

This directory is the landing zone for pre-extracted dynamic plugins in
disconnected/air-gapped bootc deployments where OCI registries are unreachable.

Contents are copied into the RHDH container at `/var/lib/rhdh/local-plugins/`.

## Usage

1. Extract plugin OCI artifacts at build time (downstream Containerfile):

```dockerfile
RUN skopeo copy \
    docker://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-example:1.0.0 \
    dir:/tmp/plugin-oci && \
    # extract the plugin tarball from the OCI layer into the local-plugins dir
    tar -xf /tmp/plugin-oci/<layer-hash> -C /var/lib/rhdh/local-plugins/
```

2. Reference local plugins in `dynamic-plugins.override.yaml`:

```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  - package: ./local-plugins/backstage-community-plugin-example
    disabled: false
```

3. For fully disconnected deployments, unset `CATALOG_INDEX_IMAGE` in `rhdh.env`
   to skip the runtime catalog-index OCI pull. Provide your own
   `dynamic-plugins.default.yaml` on disk or list all plugins explicitly
   in the override file.

## Scope

The RHDH base image ships this directory empty. Downstream consumers
(e.g. Ansible appliance layer) populate it at image build time with the
plugins required for their deployment profile.
