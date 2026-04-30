# RHDH bootc + Quadlet (image mode)

Red Hat Developer Hub deployed as a RHEL 9 bootc image with Podman Quadlet services.

## Quick Start

### 1. Authenticate

```bash
# Registry credentials (for pulling RHDH/PostgreSQL images)
podman login registry.redhat.io

# RHEL packages (Fedora/non-RHEL hosts only)
sudo subscription-manager register
```

### 2. Build

```bash
./build.sh
```

The script auto-detects your registry credentials from `~/.config/containers/auth.json` and copies them to `files/auth.json` for the build. If the auto-detection fails, copy manually:

```bash
cp ~/.config/containers/auth.json files/auth.json
```

### 3. Run

```bash
# Remove any previous test container
podman rm -f rhdh-bootc-test 2>/dev/null

# Start the bootc image with systemd (--privileged), exposing RHDH (7007) and PostgreSQL (5432)
podman run -d --name rhdh-bootc-test --privileged -p 7007:7007 -p 5432:5432 localhost/rhdh-bootc:latest
```

First start takes ~2 minutes (plugin installation), you can verify services during this time. 

### 4. Open

The container auto-detects its IP address and configures RHDH accordingly. To find the correct URL:

```bash
podman exec rhdh-bootc-test grep '^BASE_URL' /etc/rhdh/rhdh.env
```

Example output: `BASE_URL=http://172.20.10.2:7007` open that URL in your browser and log in as **Guest**.

![Red Hat Developer Hub](./configs/catalog-entities/docs/images/rhdh-home-page.png)
---

## Verify Services

```bash
# Service status
podman exec rhdh-bootc-test systemctl status postgres.service rhdh.service --no-pager

# RHDH logs
podman exec rhdh-bootc-test journalctl -u rhdh.service -f

# Health check
podman exec rhdh-bootc-test /usr/local/bin/health-check.sh
```

Both `postgres.service` and `rhdh.service` should show `Active: active (running)`.

---

## Customization

### Day 0 (cloud-init)

For initial deployment, use cloud-init user-data to set credentials, database config, and integrations. See [Cloud-Init](#cloud-init-day-0-provisioning) above.

### Day 2 (runtime, no rebuild)

Edit environment variables in `quadlet/rhdh.env` on the running host:

- `BASE_URL` / `EXTERNAL_URL` — application URL
- `GITHUB_TOKEN` / `GITLAB_TOKEN` — SCM integration
- `POSTGRES_PASSWORD` — database credential
- Branding colors: `PRIMARY_LIGHT_COLOR`, `HEADER_LIGHT_COLOR_1`, etc.

### Build-time (requires rebuild)

Copy the example override files, edit them, then run `./build.sh`:

```bash
# Dynamic plugins
cp configs/dynamic-plugins/dynamic-plugins.override.example.yaml \
   configs/dynamic-plugins/dynamic-plugins.override.yaml

# Catalog users and groups
cp configs/catalog-entities/users.override.example.yaml \
   configs/catalog-entities/users.override.yaml

# Catalog components
cp configs/catalog-entities/components.override.example.yaml \
   configs/catalog-entities/components.override.yaml
```

App configuration layers (highest to lowest priority):

1. `configs/app-config/app-config.local.yaml` (your local overrides, gitignored)
2. `configs/app-config/app-config.production.yaml` (day-2 ops)
3. `app-config.patched.yaml` (auto-generated integrations)
4. `configs/app-config/app-config.yaml` (base defaults, read-only)

### BASE_URL

Defaults to `http://localhost:7007`. To override, set `EXTERNAL_URL` in `quadlet/rhdh.env`:

```bash
EXTERNAL_URL=auto                              # auto-detect VM/cloud IP
EXTERNAL_URL=https://rhdh.apps.example.com     # specific URL (OpenShift/proxy)
```

---

## Cloud-Init (Day 0 Provisioning)

For production and VM deployments, cloud-init configures the instance at first boot — no SSH access needed.

### How it works

1. Attach `cloud-init-user-data.yaml` as user-data when deploying the VM
2. On first boot, `first-boot-config.service` reads the user-data
3. SSH keys are injected, credentials become Podman secrets, app config is written to `app-config.production.yaml`
4. Quadlet drop-ins inject secrets into rhdh and postgres containers
5. The user-data is shredded after processing

```
cloud-config.service → first-boot-config.service → postgres.service → rhdh.service
```

### Deploy with cloud-init

1. Copy and edit the template:
   ```bash
   cp cloud-init-user-data.yaml my-user-data.yaml
   # Edit: add your SSH key, set passwords or leave as "auto"
   ```

2. Attach to your VM:
   ```bash
   # QEMU/KVM
   virt-install --cloud-init user-data=my-user-data.yaml ...

   # OCP Virt — set in VirtualMachine spec:
   #   spec.volumes[].cloudInitNoCloud.userData
   ```

### What "auto" means

Values set to `"auto"` in user-data are securely generated on first boot:
- `security.backend_secret` → 64-char hex string
- `database.builtin.password` → 32-char hex string
- `database.builtin.admin_password` → 32-char hex string

### Without cloud-init

If no user-data is provided, `first-boot-config.service` auto-generates all infrastructure secrets (BACKEND_SECRET, POSTGRESQL_PASSWORD, POSTGRESQL_ADMIN_PASSWORD) so the services can still start. This is useful for local testing with `podman run`.

### Verify secrets and drop-ins

```bash
# List Podman secrets
podman exec rhdh-bootc-test podman secret ls

# Check generated drop-ins
podman exec rhdh-bootc-test cat /etc/containers/systemd/rhdh.container.d/secrets.conf
podman exec rhdh-bootc-test cat /etc/containers/systemd/postgres.container.d/secrets.conf

# Check first-boot marker
podman exec rhdh-bootc-test cat /etc/rhdh/.first-boot-complete
```

---

## Access & Credentials

| Service    | User    | Default                              | Notes                          |
|------------|---------|--------------------------------------|--------------------------------|
| SSH        | admin   | (locked — provide SSH keys via cloud-init) | wheel group, sudo access |
| PostgreSQL | postgres| auto-generated or from cloud-init    | stored as Podman secret        |
| PostgreSQL | rhdh_user| auto-generated or from cloud-init   | database: `rhdh_backstage`     |
| RHDH       | Guest   | (none)                               | dev environment only           |

With cloud-init, credentials are injected as Podman secrets — the `CHANGE_ME_*` placeholders in env files are overridden by Quadlet drop-ins at runtime.

---

## Registry Credentials

The build embeds `files/auth.json` into the image so Quadlet can pull images at runtime and for air-gapped bootc-image-builder flows.

`files/auth.json` is gitignored. Refresh before each build if pulls fail:

```bash
podman login registry.redhat.io
rm files/auth.json
./build.sh
```

**Production**: Mount credentials at runtime instead of embedding:
```bash
podman run -v /run/secrets/auth.json:/etc/containers/auth.json:ro ...
```

---

## Project Structure

| Path | Description |
|------|-------------|
| `Containerfile.bootc` | Image definition |
| `build.sh` | Build script |
| `cloud-init-user-data.yaml` | Cloud-init template for Day 0 provisioning |
| `configs/app-config/` | RHDH app configuration |
| `configs/dynamic-plugins/` | Plugin configuration |
| `configs/catalog-entities/` | Users, groups, components, TechDocs |
| `quadlet/` | Systemd Quadlet units (rhdh, postgres, network) and env files |
| `scripts/` | Plugin prep, startup, base URL detection, postgres grants |
| `scripts/lib/` | Shared libraries (common.sh, secrets-dropin.sh, yaml-helper.py) |
| `systemd/` | Systemd service units (first-boot-config.service) |
| `files/` | Runtime files embedded in image (auth.json) |

---

## Air-Gap / Pre-Pulled Images

Container images are pre-pulled during build into `/usr/lib/containers/storage` and registered via `additionalimagestores` in `storage.conf`. This means podman finds images locally at runtime without needing registry access.

Verify available images:
```bash
podman exec rhdh-bootc-test podman images
```

For VM deployment, `bootc-image-builder` embeds these images into the final QCOW2/ISO.

---

## Troubleshooting

### Build fails with 403 on DNF repos

Your subscription may have expired or your consumer profile was deleted:

```bash
sudo subscription-manager identity
# If deleted: unregister and re-register
sudo subscription-manager unregister
sudo subscription-manager register
sudo subscription-manager status
```

### Build fails with "insufficient UIDs"

The build uses nested podman (podman pull inside podman build). The `build.sh` already passes `--cap-add SYS_ADMIN --security-opt label=disable` to handle this. If it still fails, check that your user has subordinate ID ranges:

```bash
grep $USER /etc/subuid /etc/subgid
```

### CORS errors / can't reach RHDH

CORS only allows requests from the `BASE_URL` origin. Check what it's set to:

```bash
podman exec rhdh-bootc-test grep '^BASE_URL' /etc/rhdh/rhdh.env
```

Use the URL shown there. If you set `EXTERNAL_URL=auto`, BASE_URL will be an IP — use that instead of `localhost`.

### Cloud-init not applying

Check that `first-boot-config.service` ran successfully:

```bash
podman exec rhdh-bootc-test systemctl status first-boot-config.service --no-pager
podman exec rhdh-bootc-test journalctl -u first-boot-config.service --no-pager
```

If first-boot already completed, the service is skipped. To re-run, remove the marker:

```bash
podman exec rhdh-bootc-test rm /etc/rhdh/.first-boot-complete
podman exec rhdh-bootc-test systemctl restart first-boot-config.service
```

### Services not starting

```bash
podman exec rhdh-bootc-test journalctl -u rhdh.service --no-pager
podman exec rhdh-bootc-test journalctl -u postgres.service --no-pager
```
