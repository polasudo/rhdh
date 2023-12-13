FROM gcr.io/kaniko-project/executor:v1.14.0-debug AS kaniko

# hadolint ignore=DL3006
FROM registry.redhat.io/ubi9

COPY --from=kaniko /etc/nsswitch.conf /etc/nsswitch.conf
COPY --from=kaniko /kaniko/* /kaniko
WORKDIR /workspace
