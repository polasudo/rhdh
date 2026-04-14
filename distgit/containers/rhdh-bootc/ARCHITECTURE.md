# RHDH bootc + Quadlet Architecture

This document explains the architectural design and technical details of the RHDH bootc + Quadlet deployment for RHEL 9 Image Mode.

## Table of Contents

- [Overview](#overview)
- [Air-Gap Deployment Strategy](#air-gap-deployment-strategy)
- [Storage Architecture Decision](#storage-architecture-decision)
- [Bootc + Quadlet Integration](#bootc--quadlet-integration)
- [Deployment Workflows](#deployment-workflows)
- [Design Requirements](#design-requirements)
- [Relationship to Ansible Reference Implementation](#relationship-to-ansible-reference-implementation)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Security Considerations](#security-considerations)
- [Performance Characteristics](#performance-characteristics)
- [References](#references)

---

## Overview

This implementation provides a production-ready RHDH deployment using RHEL 9 bootc (Image Mode) with Podman Quadlet for systemd integration. The design prioritizes:

- **Air-gap support** via bootc's logically bound images pattern
- **Immutable infrastructure** with atomic updates and rollbacks
- **Native RHEL integration** using systemd for service management
- **Runtime flexibility** for network and database configuration

This architecture closely follows the [Ansible bootc reference implementation](https://github.com/ansible/ansible-backstage-plugins/tree/image_mode_quadlet/image_mode/quadlet) while adding air-gap verification and enhanced operational tooling.

---

## Air-Gap Deployment Strategy

### Design Goal

The RHDH bootc image must support fully offline (air-gapped) installation where container images are pre-embedded in the VM disk image, eliminating runtime registry dependencies.

### Logically Bound Images Pattern

We use bootc's native **logically bound images** feature to declare container image dependencies:

```dockerfile
# Containerfile.bootc
RUN mkdir -p /usr/lib/bootc/bound-images.d && \
    ln -s /usr/share/containers/systemd/rhdh.container \
          /usr/lib/bootc/bound-images.d/rhdh.container && \
    ln -s /usr/share/containers/systemd/postgres.container \
          /usr/lib/bootc/bound-images.d/postgres.container
```

These symlinks signal to `bootc-image-builder` which container images to embed in the final disk image.

### Build-Time vs. Deployment-Time Responsibilities

**Bootc Image Build** (this repository):
1. Define Quadlet service specifications in `/usr/share/containers/systemd/`
2. Create symlinks in `/usr/lib/bootc/bound-images.d/` pointing to Quadlet files
3. Embed registry credentials at `/etc/containers/auth.json` for image pulls

**Disk Image Build** (CI/CD pipeline):
1. Run `bootc-image-builder` to convert bootc container → QCOW2/ISO
2. Discover bound images via symlinks in `/usr/lib/bootc/bound-images.d/`
3. Pull referenced container images using embedded `auth.json`
4. Embed images into the disk image storage

**Result**: The final QCOW2/ISO contains:
- RHEL 9 bootc operating system
- RHDH container image (`registry.redhat.io/rhdh/rhdh-hub-rhel9:1.8`)
- PostgreSQL container image (`registry.redhat.io/rhel9/postgresql-15:latest`)
- All configuration and scripts

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
   - PostgreSQL initializes database schema
   - Health check: `pg_isready -U rhdh_user -d rhdh_backstage`
   - Waits until PostgreSQL accepts connections

3. **Application Startup**:
   - systemd runs `ExecStartPre=+/usr/local/bin/detect-and-set-base-url.sh` (privileged)
   - Script checks for `EXTERNAL_URL` override or auto-detects VM IP
   - Updates `BASE_URL` in `/etc/rhdh/rhdh.env`
   - systemd starts `rhdh.service`
   - Podman creates `rhdh` container
   - Container entrypoint: `/opt/app-root/src/wait-for-plugins-and-start.sh`
   - Plugin installation script runs:
     - Installs enabled dynamic plugins from `/opt/app-root/src/dynamic-plugins/`
     - Generates plugin configuration
     - Creates symlinks for plugin access
   - Backstage backend starts:
     - Connects to PostgreSQL
     - Creates per-plugin databases (`backstage_plugin_*`)
     - Initializes catalog with default entities
     - Starts HTTP server on port 7007
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

# Wait for first-time startup (3-5 minutes)
sleep 180

# Verify services
podman exec rhdh-bootc-test systemctl status postgres.service rhdh.service --no-pager

# Check air-gap readiness
podman exec rhdh-bootc-test /usr/local/bin/manage-bound-images.sh

# Get the detected BASE_URL
podman exec rhdh-bootc-test cat /etc/rhdh/rhdh.env | grep "^BASE_URL"

# Access RHDH using the detected IP (example output: http://172.20.10.2:7007)
# Open in browser: http://<detected-ip>:7007
# Login: Select "Guest" authentication
```

**Advantages**:
- Fast iteration (no QCOW2 creation)
- Easy debugging (podman exec, journalctl)
- Verifies systemd services work correctly

### VM Deployment: QCOW2/ISO Creation

**Purpose**: Create bootable disk images for VM deployments

**Workflow** (handled by CI/CD pipeline):
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

### Air-Gap Deployment Verification

**Pre-Flight Checklist**:

1. **Verify bound images**:
   ```bash
   podman exec rhdh-bootc-test /usr/local/bin/manage-bound-images.sh
   ```

2. **Test air-gap simulation** (see README.md):
   - Block registry access with iptables
   - Restart services
   - Verify no registry pulls in logs

3. **Deploy to offline environment**:
   - Transfer QCOW2/ISO to air-gap environment
   - Boot VM
   - Services start without network

---

## Design Requirements

This implementation satisfies the following requirements for RHEL 9 Image Mode deployment:

### Bootable System
- Container image boots as a complete operating system
- systemd manages service lifecycle
- Quadlet integrates container workloads with systemd

### Air-Gap Support
- Container images pre-embedded in disk image using logically bound images
- No runtime registry access required
- Registry credentials embedded for bootc upgrade functionality

### Runtime Configuration
- Environment-based configuration via `/etc/rhdh/rhdh.env`
- Dynamic IP detection and BASE_URL configuration
- Support for external PostgreSQL via environment variables

### Authentication & Authorization
- Guest authentication enabled by default for testing/development
- AAP/RHAAP OAuth provider available (requires configuration)
- GitHub OAuth provider available (requires token configuration)
- Configurable via `signInPage` setting in `configs/app-config/app-config.yaml`

### Catalog Configuration
- Default Backstage example catalog loaded automatically
- AAP catalog provider available (requires AAP instance and credentials)
- Supports external catalog sources via configuration

### Data Persistence
- Database persistence via named volumes (`postgres-data`)
- Application state in `/var/lib/rhdh/` (mutable)
- Configuration in `/etc/rhdh/` (mutable)
- OS layer remains immutable

### Service Management
- RHDH and PostgreSQL as systemd services
- Health checks and automatic restarts
- Dependency-based startup ordering
- Logging via journalctl

---

## Relationship to Ansible Reference Implementation

This implementation is based on the [Ansible bootc + Quadlet reference](https://github.com/ansible/ansible-backstage-plugins/tree/image_mode_quadlet/image_mode/quadlet) with the following shared patterns:

- **Logically bound images** for air-gap support
- **Dynamic IP detection** via `detect-and-set-base-url.sh`
- **Quadlet systemd integration** with service dependencies and health checks
- **PostgreSQL configuration** using Red Hat PostgreSQL image
- **Script-based plugin installation** during container startup

### Key Differences

**Air-Gap Verification**:
- Added `manage-bound-images.sh` script with readiness checks
- Enhanced `health-check.sh` with conditional Ansible plugin checks

**Storage Configuration**:
- Uses default podman storage (`/var/lib/containers/storage`)
- Simplifies testing workflow (`podman run` works without special configuration)
- Alternative: Could add `GlobalArgs=--storage-opt=additionalimagestore=/usr/lib/bootc/storage` if needed

---

## Troubleshooting Guide

### Common Issues

#### Images Not Pre-Pulled

**Symptom**: `manage-bound-images.sh` shows "NOT AIR-GAP READY"

**Cause**: Build failed or images not accessible

**Fix**:
```bash
# Verify auth.json exists:
ls -la ./auth.json
# Should exist and contain registry credentials

# Rebuild:
./build.sh

# Verify images are present:
podman exec rhdh-bootc-test podman images | grep -E "(rhdh|postgresql)"
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

- Registry credentials (`auth.json`) embedded in image layer for bootc upgrade and air-gap support
- Database credentials in environment files (`quadlet/rhdh.env`, `quadlet/postgres.env`)
- Default credentials provided for testing; change for production deployments
- BACKEND_SECRET should be set to a random value in production environments
- Production deployments should use external secrets management (systemd credentials, Kubernetes secrets, etc.)

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

- [bootc Documentation](https://containers.github.io/bootc/) - Image-based OS fundamentals
- [Podman Quadlet Documentation](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) - Container systemd integration
- [RHDH Documentation](https://docs.redhat.com/en/documentation/red_hat_developer_hub) - Red Hat Developer Hub product docs
- [Ansible bootc Reference](https://github.com/ansible/ansible-backstage-plugins/tree/image_mode_quadlet/image_mode/quadlet) - Upstream reference implementation

---
