# change log at https://github.com/GoogleContainerTools/kaniko/releases
FROM gcr.io/kaniko-project/executor:v1.22.0-debug AS kaniko

# hadolint ignore=DL3006,DL3007
FROM registry.redhat.io/ubi9:latest
# hadolint ignore=DL3002
USER 0
WORKDIR /workspace
RUN \
    dnf -y -q update

COPY --from=kaniko /etc/nsswitch.conf /etc/nsswitch.conf
COPY --from=kaniko /kaniko/* /kaniko
WORKDIR /workspace
