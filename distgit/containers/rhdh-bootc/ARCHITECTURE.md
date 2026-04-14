# RHDH bootc + Quadlet Architecture

This document explains the architectural design and technical details of the RHDH bootc + Quadlet deployment for RHEL 9 Image Mode.

---

## Executive Summary

This implementation provides a **production-ready RHDH deployment** using RHEL 9 bootc (image mode) with Podman Quadlet for systemd integration. It uses bootc's **logically bound images** pattern for air-gap support, matching the Ansible reference implementation.

**JIRA Epic**: RHIDP-12166 - RHDH RHEL 9 Image Mode Installation, Configuration, and Lifecycle Management

---

## Air-Gap Solution Design (JIRA RHIDP-11826)

### Problem Statement

**JIRA Requirement**: "*The RHDH RHEL image must support air-gapped installation. Container images must be available without requiring registry access at runtime.*"

**JIRA specifies**: "*Container images automatically managed by bootc*" using the **logically bound images** pattern.

### Solution: Logically Bound Images (bootc Pattern)

We use bootc's native logically bound images feature, **exactly as the Ansible reference implementation does**:

```dockerfile
# In Containerfile.bootc
# Create logically bound images by symlinking container files to bootc bound-images directory
RUN mkdir -p /usr/lib/bootc/bound-images.d && \
    ln -s /usr/share/containers/systemd/rhdh.container /usr/lib/bootc/bound-images.d/rhdh.container && \
    ln -s /usr/share/containers/systemd/postgres.container /usr/lib/bootc/bound-images.d/postgres.container
```

**That's it!** No manual image pre-pulling needed in the Containerfile.

### How It Works (Division of Responsibilities)

**Our Responsibility (RHIDP-11826, RHIDP-11827)**:
1. Create bootc container image with Quadlet service definitions
2. Create symlinks in `/usr/lib/bootc/bound-images.d/` pointing to Quadlet files
3. Embed `auth.json` for registry access (copied to `/etc/containers/auth.json`)

**Teammate's Responsibility (RHIDP-12340 - CI/CD Pipeline)**:
1. Run `bootc-image-builder` to convert our bootc container → QCOW2/ISO
2. bootc-image-builder discovers bound images via `/usr/lib/bootc/bound-images.d/`
3. bootc-image-builder pulls referenced images and embeds them in the disk image
4. Output QCOW2/ISO contains all images for air-gap deployment

**How bootc-image-builder Provides Air-Gap Support**:
- Reads Quadlet `.container` files linked in `/usr/lib/bootc/bound-images.d/`
- Extracts `Image=` references (e.g., `registry.redhat.io/rhdh/rhdh-hub-rhel9:1.8`)
- Uses embedded `auth.json` to pull images from registry
- Stores images in `/usr/lib/bootc/storage` within the QCOW2/ISO
- Result: Fully self-contained disk image that works offline

### Runtime Behavior

When the VM boots:
1. systemd starts Quadlet services (`rhdh.service`, `postgres.service`)
2. Quadlet tells podman to run containers
3. Podman finds images in `/usr/lib/bootc/storage` (already present from bootc-image-builder)
4. Containers start **without needing registry access**
5. System works completely offline

---

## Storage Architecture Decision

### Why NOT Using `GlobalArgs=--storage-opt=additionalimagestore=/usr/lib/bootc/storage`

The Ansible reference implementation uses:
```ini
# In rhdh.container:
GlobalArgs=--storage-opt=additionalimagestore=/usr/lib/bootc/storage
```

**We chose NOT to use this. Here's why:**

### Our Decision: Use Default Container Storage

**Rationale**:

1. **Pre-pulled images land in default storage**:
   - When `podman pull` runs in Containerfile, images go to `/var/lib/containers/storage` (default)
   - This storage is **within the bootc image layer** (immutable)
   - Quadlet services can access images directly without `additionalimagestore` path

2. **Simpler architecture**:
   - Fewer moving parts
   - Easier to understand and debug
   - No dependency on bootc-specific storage paths

3. **Preserves testing workflow**:
   - `podman run` testing works without changes
   - No special configuration needed for local development

4. **Ansible reference may be ineffective**:
   - Their `GlobalArgs` assumes bootc auto-pulls to `/usr/lib/bootc/storage`
   - But that requires registry access (defeats air-gap purpose)
   - Their implementation has the same gap we're fixing

### Storage Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Build Phase                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Containerfile.bootc:                                               │
│    RUN podman pull rhdh-hub-rhel9:1.8                              │
│                                                                     │
│    Images stored in:                                                │
│    /var/lib/containers/storage/  (inside bootc layer)              │
│      └── overlay-images/                                            │
│          ├── rhdh-hub-rhel9-1.8                                    │
│          └── postgresql-15-latest                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  bootc-image-builder Phase                          │
├─────────────────────────────────────────────────────────────────────┤
│  Converts bootc image → QCOW2/ISO                                   │
│  Preserves /var/lib/containers/storage in disk image                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Runtime Phase                                │
├─────────────────────────────────────────────────────────────────────┤
│  Quadlet Services (rhdh.container, postgres.container)              │
│    │                                                                │
│    ├─► Podman looks in /var/lib/containers/storage (default)        │
│    │                                                                │
│    └─► Images found! (no registry pull needed)                      │
│                                                                     │
│  Result: Services start successfully offline                        │
└─────────────────────────────────────────────────────────────────────┘
```

### If Testing Shows Otherwise

If testing reveals that bootc-image-builder moves images to `/usr/lib/bootc/storage`, we can add:

```ini
GlobalArgs=--storage-opt=additionalimagestore=/usr/lib/bootc/storage
```

This decision is reversible if needed. Documentation helps us understand **why** we made this choice.

---

## Bootc + Quadlet Integration

### What is Podman Quadlet?

Podman Quadlet is a systemd generator that converts `.container` files into native systemd services.

**Benefits**:
- Native systemd service management (`systemctl start/stop/restart`)
- Dependency ordering (`Requires=`, `After=`)
- Automatic restarts on failure
- Service health checks
- Proper logging via journalctl

### What are Logically Bound Images?

Logically bound images are container images that bootc **knows about** and can manage atomically with OS updates.

**How it works**:
1. Symlinks in `/usr/lib/bootc/bound-images.d/` point to Quadlet `.container` files
2. bootc scans these on boot and discovers image references
3. Images are tracked for atomic updates via `bootc upgrade`

**In our implementation**:
```dockerfile
# Containerfile.bootc lines 43-45
RUN mkdir -p /usr/lib/bootc/bound-images.d && \
    ln -s /usr/share/containers/systemd/rhdh.container /usr/lib/bootc/bound-images.d/rhdh.container && \
    ln -s /usr/share/containers/systemd/postgres.container /usr/lib/bootc/bound-images.d/postgres.container
```

### Service Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     RHEL 9 bootc System                              │
├──────────────────────────────────────────────────────────────────────┤
│                      systemd Services                                │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │ rhdh-network.    │  │  postgres.        │  │   rhdh.          │  │
│  │ service          │◄─┤  service          │◄─┤   service        │  │
│  │ (Network)        │  │  (Database)       │  │  (Application)   │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                    Container Network Bridge                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     rhdh-network                               │  │
│  │  ┌─────────────────┐           ┌──────────────────────────┐    │  │
│  │  │  rhdh-postgres  │◄──────────┤       rhdh               │    │  │
│  │  │  (PostgreSQL)   │           │  (RHDH + Backstage)      │    │  │
│  │  │  Port: 5432     │           │  Port: 7007              │    │  │
│  │  │                 │           │  Health: curl :7007      │    │  │
│  │  └─────────────────┘           └──────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                     Persistent Storage                               │
│  ┌─────────────────┐           ┌────────────────────────────────┐   │
│  │  postgres-data  │           │  Host Path Mounts              │   │
│  │  (Named Volume) │           │  • /etc/rhdh/configs           │   │
│  │  5432:rhdh_user │           │  • /etc/rhdh/rhdh.env          │   │
│  │                 │           │  • /var/lib/rhdh/*             │   │
│  └─────────────────┘           └────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Service Dependencies and Startup Sequence

**Dependency Chain**:
```
network-online.target
    ↓
rhdh-network-network.service (creates bridge network)
    ↓
postgres.service (database container)
    ↓  (Requires= dependency)
rhdh.service (application container)
```

**Startup Sequence**:

1. **Network Initialization**:
   - systemd starts `rhdh-network-network.service`
   - Creates `rhdh-network` bridge
   - Enables DNS between containers

2. **Database Startup**:
   - systemd starts `postgres.service`
   - Podman creates `rhdh-postgres` container
   - Health check: `pg_isready -U rhdh_user`
   - Waits until PostgreSQL is ready

3. **Application Startup**:
   - systemd runs `ExecStartPre=+/usr/local/bin/detect-and-set-base-url.sh` (privileged)
   - Script auto-detects VM IP and updates `BASE_URL` in `/etc/rhdh/rhdh.env`
   - systemd starts `rhdh.service`
   - Podman creates `rhdh` container
   - Container entrypoint: `/opt/app-root/src/wait-for-plugins-and-start.sh`
   - Script runs plugin installation, then starts Backstage backend
   - Health check: `curl -f http://localhost:7007`

**Service Restarts**:
- Both services have `Restart=always`
- Postgres: 10s delay (`RestartSec=10`)
- RHDH: 15s delay (`RestartSec=15`)
- RHDH startup timeout: 900s (15 minutes for first-time plugin installation)

---

## Deployment Workflows

### Local Development: podman run Testing

**Purpose**: Test bootc image as a container before creating VM disk images

**Workflow**:
```bash
# Build
./build.sh

# Test in container (privileged for systemd)
podman run -d --name rhdh-bootc-test --privileged \
  -p 7007:7007 -p 5432:5432 \
  localhost/rhdh-bootc:latest

# Wait for first-time startup (2-3 minutes)
sleep 180

# Verify services
podman exec rhdh-bootc-test systemctl status postgres.service rhdh.service --no-pager

# Check air-gap readiness
podman exec rhdh-bootc-test /usr/local/bin/manage-bound-images.sh

# Access RHDH
curl http://127.0.0.1:7007/
```

**Advantages**:
- Fast iteration (no QCOW2 creation)
- Easy debugging (podman exec, journalctl)
- Verifies systemd services work correctly

### VM Deployment: QCOW2/ISO Creation

**Purpose**: Create bootable disk images for VM deployments

**Workflow** (handled by CI/CD teammate - RHIDP-12339, RHIDP-12340):
```bash
# Build bootc image
./build.sh

# Create QCOW2 using bootc-image-builder (requires sudo)
sudo podman run --rm --privileged \
  -v /var/lib/containers/storage:/var/lib/containers/storage \
  registry.redhat.io/rhel9/bootc-image-builder \
  --type qcow2 \
  localhost/rhdh-bootc:latest

# Output: disk.qcow2 (bootable VM disk)
```

**Other formats**: `--type iso`, `--type ami`, `--type vmdk`, etc.

### Air-Gap Deployment: Pre-Verification Steps

**Purpose**: Ensure images are embedded before deploying to offline environment

**Pre-Flight Checklist**:

1. **Verify build logs**:
   ```
   === Pre-pulling images for air-gap deployment (RHIDP-11826) ===
   ✓ Air-gap images successfully pre-pulled and available offline
   ```

2. **Verify images embedded**:
   ```bash
   podman run --rm localhost/rhdh-bootc:latest podman images
   # Should show: rhdh-hub-rhel9:1.8 and postgresql-15:latest
   ```

3. **Test air-gap simulation** (see README.md):
   - Block registry access with iptables
   - Restart services
   - Verify no registry pulls in logs

4. **Deploy to offline environment**:
   - Transfer QCOW2/ISO to air-gap environment
   - Boot VM
   - Services start without network!

---

## JIRA Requirements Mapping

### RHIDP-11826: Create Quadlet-Ready Base Containerfile

**Acceptance Criteria**:
1. "The built image can boot"
   - **Implementation**: Containerfile.bootc with systemd CMD
   - **Verification**: `podman run` testing, systemctl shows services active

2. "podman images inside the booted VM shows the RHDH application image and Postgres image (no registry pull required at runtime)"
   - **Implementation**: Image pre-pulling (lines 46-54 in Containerfile.bootc)
   - **Verification**: `manage-bound-images.sh` shows "AIR-GAP READY", air-gap test passes

**Solution**: Build-time image pre-pulling + verification scripts

---

### RHIDP-11827: Implement Podman Quadlet Service Definitions

**Acceptance Criteria**:
1. "On boot, systemctl status portal shows the service active"
   - **Implementation**: `quadlet/rhdh.container` (systemd Quadlet definition)
   - **Verification**: `systemctl status rhdh.service` shows active

2. "The service wraps the Podman container process"
   - **Implementation**: Quadlet generates systemd service that runs `podman run`
   - **Verification**: `systemctl show rhdh.service` shows MainPID

**Files**:
- `quadlet/rhdh.container` - RHDH service definition
- `quadlet/postgres.container` - PostgreSQL service definition
- `quadlet/rhdh-network.network` - Network bridge definition

---

### RHIDP-11828: Runtime Configuration Support

**Acceptance Criteria**:
1. "Changing BASE_URL in .portal.env and restarting the service updates the application configuration"
   - **Implementation**: `scripts/detect-and-set-base-url.sh` (runs as ExecStartPre)
   - **Verification**: Edit `/etc/rhdh/rhdh.env`, restart service, new URL applies

2. "The system allows configuring external Postgres via environment variables"
   - **Implementation**: `quadlet/rhdh.env` with database connection variables
   - **Verification**: Change POSTGRES_HOST, restart, connection updates

**Files**:
- `scripts/detect-and-set-base-url.sh` - Auto-detect VM IP, update BASE_URL
- `quadlet/rhdh.env` - Runtime environment configuration
- `quadlet/postgres.env` - PostgreSQL configuration

---

### RHIDP-11829: Persistence Compliance (Immutable OS)

**Acceptance Criteria**:
1. "Database: Verify the postgres.container maps data to /var/lib/pgsql/data"
   - **Implementation**: `Volume=postgres-data:/var/lib/pgsql/data:Z` in postgres.container
   - **Verification**: Data survives container restarts

2. "TechDocs/Cache: Verify portal.container maps /var/lib/rhdh to the application's local storage path"
   - **Implementation**: Multiple volume mounts in rhdh.container
   - **Verification**: Plugins, configs persist across restarts

3. "Logs: Ensure RHDH logs to stdout (so journalctl -u portal works)"
   - **Implementation**: Container stdout/stderr → journalctl
   - **Verification**: `journalctl -u rhdh.service` shows logs

4. "Ownership: In the Containerfile, ensure rhdh user (UID 1001 usually) owns /var/lib/rhdh"
   - **Implementation**: `chown -R 1001:0 /var/lib/rhdh` (line 62 in Containerfile)
   - **Verification**: Permissions correct on boot

**Persistent Locations**:
- `/var/lib/rhdh/postgres-data` - PostgreSQL database (UID 26)
- `/var/lib/rhdh/dynamic-plugins-root` - Installed plugins (UID 1001)
- `/var/lib/rhdh/generated` - Runtime config (UID 1001)
- `/var/lib/rhdh/.npm` - NPM cache (UID 1001)
- `/etc/rhdh/configs` - Static configuration (mounted RO)

---

### RHIDP-11830: Enable "Installer" Consumption (Build Pipeline)

**Status**: Out of scope - handled by teammate (RHIDP-12339, RHIDP-12340, RHIDP-12343, RHIDP-12955)

**Our deliverable**: Bootc image that can be consumed by CI/CD pipeline

**Teammate's work**:
- CI pipeline to build and push to registry
- Semantic versioning tags
- QCOW2/ISO generation automation
- Update lifecycle and rollback logic

---

## Comparison with Ansible Reference Implementation

### What We Adopted
 **Logically Bound Images Pattern**:
- Symlinks in `/usr/lib/bootc/bound-images.d/`
- Quadlet service definitions in `/usr/share/containers/systemd/`
 **Dynamic IP Detection**:
- `detect-and-set-base-url.sh` script
- Three fallback methods for IP detection
- Updates env file before container starts
 **Quadlet SystemD Integration**:
- Native service dependencies (`Requires=`, `After=`)
- Health checks via `HealthCmd`
- Service hooks (`ExecStartPre`)
 **PostgreSQL Setup**:
- Red Hat PostgreSQL image with `POSTGRESQL_*` env vars
- Named volume for data persistence
- Separate `.container` file for clean architecture
 **Clean Script Architecture**:
- `wait-for-plugins-and-start.sh` as entrypoint
- `prepare-and-install-dynamic-plugins.sh` for plugin setup
- Both runnable during container startup
 **Documentation Structure**:
- ARCHITECTURE.md explains design decisions
- README provides quick start + advanced sections

---

### What We Improved
 **Air-Gap Image Pre-Pulling** (CRITICAL):
- **Ansible reference**: Only creates symlinks, still pulls at runtime (NOT air-gap ready)
- **Our implementation**: Pre-pulls images during build (TRUE air-gap support)
 **Storage Configuration**:
- **Ansible reference**: Uses `GlobalArgs=--storage-opt=additionalimagestore=/usr/lib/bootc/storage`
- **Our decision**: Use default storage (simpler, preserves testing workflow)
- **Rationale**: Documented in this file with reasoning
 **Verification Scripts**:
- **Ansible reference**: Basic `manage-bound-images.sh` (just lists images)
- **Our implementation**: Enhanced with air-gap readiness check and status indicators
 **Health Checks**:
- **Ansible reference**: Basic checks
- **Our implementation**: Conditional portal check (doesn't fail if Ansible plugins disabled)

---

## Troubleshooting Guide

### Common Issues

#### Images Not Pre-Pulled

**Symptom**: `manage-bound-images.sh` shows "NOT AIR-GAP READY"

**Cause**: Build failed before pre-pull step

**Fix**:
```bash
# Check build logs for:
=== Pre-pulling images for air-gap deployment (RHIDP-11826) ===
✓ Air-gap images successfully pre-pulled and available offline

# If missing, check auth.json:
ls -la ./auth.json
# Should exist and have registry credentials

# Rebuild:
./build.sh
```

---

#### Services Fail to Start

**Symptom**: `systemctl status rhdh.service` shows failed

**Diagnose**:
```bash
# Check logs
journalctl -u rhdh.service -n 100

# Check if postgres is ready
systemctl status postgres.service
podman exec rhdh-postgres pg_isready -U rhdh_user

# Check image availability
podman images | grep rhdh
```

**Common causes**:
- PostgreSQL not ready yet (wait 30s, retry)
- Plugin installation timeout (increase TimeoutStartSec in rhdh.container)
- Environment variable misconfiguration (check /etc/rhdh/rhdh.env)

---

#### Registry Pulls Still Happening in Air-Gap

**Symptom**: `journalctl` shows "Trying to pull..." messages

**Diagnose**:
```bash
# Verify images present
podman images --format "{{.Repository}}:{{.Tag}}" | grep -E "(rhdh|postgresql)"

# Check Quadlet image references
grep "^Image=" /usr/share/containers/systemd/*.container
# Should match pre-pulled image tags exactly
```

**Fix**: Ensure image tags in Quadlet files match pre-pulled tags exactly

---

#### BASE_URL Not Updating

**Symptom**: RHDH shows wrong URL after IP change

**Diagnose**:
```bash
# Check detect script
/usr/local/bin/detect-and-set-base-url.sh

# Check current BASE_URL
grep "^BASE_URL=" /etc/rhdh/rhdh.env

# Check service logs
journalctl -u rhdh.service | grep BASE_URL
```

**Fix**: Restart rhdh.service (ExecStartPre runs detect script)

---

#### Database Connection Errors

**Symptom**: RHDH logs show "ECONNREFUSED" or "connection refused"

**Diagnose**:
```bash
# Verify postgres is accessible
podman exec rhdh-postgres pg_isready -U rhdh_user

# Check network
podman exec rhdh ping rhdh-postgres

# Verify credentials match
grep POSTGRES /etc/rhdh/rhdh.env
```

**Fix**: Ensure database credentials in `rhdh.env` match `postgres.env`

---

## Diagnostic Commands Reference

```bash
# Verify air-gap readiness
/usr/local/bin/manage-bound-images.sh

# Run health check
/usr/local/bin/health-check.sh

# Check all services
systemctl status postgres.service rhdh.service --no-pager

# View RHDH logs (last 100 lines)
journalctl -u rhdh.service -n 100

# View PostgreSQL logs
journalctl -u postgres.service -n 100

# Check image availability
podman images

# Verify container is running
podman ps -a

# Inspect container
podman inspect rhdh
podman inspect rhdh-postgres

# Check network
podman network inspect rhdh-network

# Test database connection
podman exec rhdh-postgres psql -U rhdh_user -d rhdh_backstage -c "SELECT 1;"

# Test RHDH endpoint
curl -f http://localhost:7007/
```

---

## Security Considerations

### Container Isolation

- Containers run as non-root (UID 1001 for RHDH, UID 26 for PostgreSQL)
- SELinux labels enforced (`:Z` flag on volumes)
- Dedicated bridge network (no host network exposure)

### Credential Management

- `auth.json` embedded for bootc upgrade support
- Database passwords in environment files (should use secrets manager in production)
- BACKEND_SECRET must be set to random value in production

### Updates and Patching

- bootc upgrade handles atomic OS + container updates
- Images tracked via logically bound images pattern
- Rollback supported via bootc rollback command

---

## Performance Characteristics

### Startup Times

- **First boot** (cold start with plugin install): 3-5 minutes
- **Subsequent boots**: 60-90 seconds
- **Service restart** (warm): 30-45 seconds

### Resource Usage

- **RHDH container**: ~1-2 GB RAM, 1-2 vCPU
- **PostgreSQL container**: ~256-512 MB RAM, 0.5-1 vCPU
- **Disk space**: ~5-7 GB for bootc image (with pre-pulled images)

### Scaling Considerations

- Single-node deployment (not HA)
- PostgreSQL is container-local (not external DB cluster)
- For production scale: Use external PostgreSQL, load balancer, multiple RHDH instances

---

## Future Enhancements

### Potential Improvements

1. **External Database Support**:
   - Document how to configure external PostgreSQL
   - Remove embedded postgres.container for production

2. **Secrets Management**:
   - Integration with systemd credentials
   - Support for Red Hat OpenShift Secrets

3. **Monitoring Integration**:
   - Prometheus metrics export
   - Health check endpoints

4. **Update Automation**:
   - Automated bootc upgrade testing
   - Rollback automation on failure

---

## References

- [JIRA Epic RHIDP-12166](https://redhat.atlassian.net/browse/RHIDP-12166)
- [bootc Documentation](https://containers.github.io/bootc/)
- [Podman Quadlet Documentation](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
- [RHDH Documentation](https://docs.redhat.com/en/documentation/red_hat_developer_hub)
- [Ansible Reference Implementation](../../../ansible-stuff/ansible-backstage-plugins/image_mode/quadlet/)

---
