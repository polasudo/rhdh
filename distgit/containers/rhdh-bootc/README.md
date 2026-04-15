# RHDH bootc + Quadlet (image mode)

## Build

1. Log in to the Red Hat registry (creates `~/.config/containers/auth.json`):

   ```bash
   podman login registry.redhat.io
   ```

2. From **this directory**:

   ```bash
   ./build.sh
   ```

   If you have no `auth.json` yet, step 1 is required — the script looks for
   `~/.config/containers/auth.json`, `$XDG_RUNTIME_DIR/containers/auth.json`, or
   `~/.docker/config.json`.

Or copy credentials by hand:

```bash
cp ~/.config/containers/auth.json ./auth.json
podman build -f Containerfile.bootc -t rhdh-bootc:latest .
```

`auth.json` is gitignored. Refresh login before each build if pulls fail with **unauthorized**:

`podman login registry.redhat.io`

Credentials are copied to both `/etc/containers/auth.json` and `/root/.config/containers/auth.json` so Quadlet (root podman) can pull images.

### Registry Credentials

This image embeds registry credentials (`auth.json`) in the container image layer (line 32 in `Containerfile.bootc`). This design supports testing, development, and air-gapped bootc installations where bootc-image-builder requires credentials to pull bound images during disk image creation.

**Important**: Registry credentials are permanently stored in the image layer. Anyone with access to the image can extract these credentials.

**Production Recommendations**:
- Mount credentials at runtime: `podman run -v /run/secrets/auth.json:/etc/containers/auth.json:ro`
- Use systemd credentials or Kubernetes/OpenShift secrets
- Build separate images per environment with minimal credential scope
- Do not distribute this image publicly

## Default Configuration

This image is configured for **testing and development** out-of-the-box:

### Authentication
- **Default**: Guest authentication (no login required)
- To add custom authentication providers: Update `configs/app-config/app-config.yaml` with your auth provider configuration

### Catalog
- **Default locations**: Backstage example catalog is loaded automatically for demo purposes
- To add custom catalog sources: Update `configs/app-config/app-config.yaml` with your catalog locations

### Database
- **PostgreSQL**: Runs in a container (`rhdh-postgres`) via Quadlet
- **Credentials**: 
  - Username: `postgres`
  - Password: `secure_admin_password_123`
  - Database: `rhdh_backstage`
- **Superuser Requirement**: Backstage creates per-plugin databases (`backstage_plugin_catalog`, `backstage_plugin_scaffolder`, etc.) at runtime, requiring `CREATEDB` privilege. This implementation uses the PostgreSQL superuser for simplicity.

**Production Recommendations**:
- Change default password in `quadlet/rhdh.env` and `quadlet/postgres.env`
- Create a dedicated PostgreSQL user with `CREATEDB` privilege
- Pre-create all plugin databases and use a limited user
- Use an external managed PostgreSQL service

## Contents

- `configs/` — RHDH app config, catalog, dynamic plugins
- `quadlet/` — `rhdh.container`, `postgres.container`, network, env
- `scripts/` — plugin prep / startup (same as Ansible image_mode)

RHDH image tag is set in `quadlet/rhdh.container` (default `1.8`).

## Run and Test

### Start Container

First start can take 3-5 minutes as the container pulls images and installs plugins.

```bash
podman rm -f rhdh-bootc-test 2>/dev/null
podman run -d --name rhdh-bootc-test --privileged -p 7007:7007 -p 5432:5432 localhost/rhdh-bootc:latest
```

### Verify Services

Wait approximately 3 minutes for services to initialize, then check status:

```bash
podman exec rhdh-bootc-test systemctl status postgres.service rhdh.service --no-pager
podman exec rhdh-bootc-test podman ps -a
```

Both services should show `Active: active (running)`.

### Access RHDH Web Interface

The container auto-detects its IP address and configures RHDH accordingly. To find the correct URL:

```bash
podman exec rhdh-bootc-test cat /etc/rhdh/rhdh.env | grep “^BASE_URL”
```

Example output: `BASE_URL=http://172.20.10.2:7007`

**Open this URL in your browser** (e.g., `http://172.20.10.2:7007/`)

**Note**: Using `http://127.0.0.1:7007` or `http://localhost:7007` will fail due to CORS configuration. The application is configured to only accept requests from the detected BASE_URL.

**Login**: Select **Guest** authentication to access the application without additional configuration.

### After Login

Once authenticated, you will have access to:

- **Home/Dashboard**: Overview of your developer portal
- **Catalog**: Browse example components, APIs, and systems (loaded from Backstage examples)
- **API Docs**: View API documentation
- **Create**: Access Software Templates
- **Search**: Search across catalog entities

The default configuration includes example entities for demonstration purposes. To add your own catalog sources, edit `configs/app-config/app-config.yaml` and rebuild the image.

### BASE_URL Configuration

The `detect-and-set-base-url.sh` script automatically configures the application's BASE_URL at container startup.

**Bare Metal / VM Deployments**:
- Automatic IP detection via `ip route get 1.1.1.1`
- No configuration required
- BASE_URL set to `http://<detected-ip>:7007`

**OpenShift / Proxy Deployments**:

Automatic IP detection returns internal pod IPs on OpenShift, which causes CORS errors and OAuth redirect failures. Override the BASE_URL by setting `EXTERNAL_URL` in `quadlet/rhdh.env`:

```bash
# Set this to your external Route/Ingress URL
EXTERNAL_URL=https://rhdh-myproject.apps.cluster.example.com
```

The detection script prioritizes `EXTERNAL_URL` when present, falling back to automatic IP detection otherwise.

## Default Credentials

The bootc image includes default users for testing and SSH access:

- **admin**: `admin123` (wheel group, passwordless sudo)
- **root**: `root123`

**Production Deployment**: Change these passwords before deploying to any non-development environment.

## Quick Reference

### Common Commands

**Check service status**:
```bash
podman exec rhdh-bootc-test systemctl status postgres.service rhdh.service --no-pager
```

**View logs**:
```bash
podman exec rhdh-bootc-test journalctl -u rhdh.service -n 100
podman exec rhdh-bootc-test journalctl -u postgres.service -n 100
```

**Restart services**:
```bash
podman exec rhdh-bootc-test systemctl restart rhdh.service
```

**Get current BASE_URL**:
```bash
podman exec rhdh-bootc-test cat /etc/rhdh/rhdh.env | grep "^BASE_URL"
```

**Check health**:
```bash
podman exec rhdh-bootc-test /usr/local/bin/health-check.sh
```

### Configuration Files

- **RHDH Config**: `/etc/rhdh/configs/app-config/app-config.yaml`
- **Environment**: `/etc/rhdh/rhdh.env`
- **Database Config**: `/etc/rhdh/postgres.env`
- **Quadlet Services**: `/usr/share/containers/systemd/*.container`

## Logically Bound Images (Air-Gap Support)

This image uses bootc's logically bound images pattern for air-gap support (JIRA RHIDP-11826), matching the Ansible reference implementation.

### How It Works

1. Bootc image creates symlinks in `/usr/lib/bootc/bound-images.d/` pointing to Quadlet service definitions
2. bootc-image-builder (RHIDP-12340) discovers these symlinks and pulls the referenced container images
3. Final QCOW2/ISO contains all images embedded for offline deployment

### Verification

Check bound images metadata:

```bash
podman exec rhdh-bootc-test /usr/local/bin/manage-bound-images.sh
```

Container images will not be present in the bootc container itself during testing - they are embedded by bootc-image-builder during QCOW2/ISO creation.
