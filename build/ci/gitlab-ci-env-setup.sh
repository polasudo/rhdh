#!/usr/bin/env bash
#
# Copyright (c) 2023-2024 Red Hat, Inc.
# 
# set up gitlab CI runner environment
# called by .gitlab-ci.yml 
# see build/dockerfiles/gitlab-runner.Dockerfile
# to test, run in quay.io/rhdh/gitlab-runner:1.10

# set -x
set -e

# echo "CI_BUILDS_DIR = $CI_BUILDS_DIR
# CI_PROJECT_DIR = $CI_PROJECT_DIR
# CI_PROJECT_PATH = $CI_PROJECT_PATH
# CI_PROJECT_NAMESPACE = $CI_PROJECT_NAMESPACE
# CI_PROJECT_NAME = $CI_PROJECT_NAME"

# add ~/.ssh/known_hosts entry for gitlab.cee.redhat.com and pkgs.devel.redhat.com
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat << EOT >> ~/.ssh/known_hosts
gitlab.cee.redhat.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICBgflBIyju1LV/29PmFDw0GLdB9h0JUXglNrvWjBQ2u 
gitlab.cee.redhat.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDXAc+2x0Z5jMxGVk1J6rN5e1a1hA0L/xLrZMV8iAJmDU/QjlaCcFduF73TzUQnAQu55jpmx4WmBizkz5YqR5SIiJy9y4GXXpup6YKXketFVGJinphl66LMCKWH2nRmdJbe6nzNac8nS6ZKb2X9Oc3NbxgEQMtY5Q2bzPkEiOf4Etp3MInbi9AAJsdkRC9yKhrQcHAniBO5Ugkk6XtxuzW/TdismBto2JZoarsGAuBe4oVOXwfo6arbVE6P8HGH0XShwzFLkm1E92eckeE2/93PDYWm1vteJv5VT8Gr0acEkPX93TpqwL5MqKbbco7pFStuDe5SrJ4i36KV/aCl4Ixz
gitlab.cee.redhat.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNJJ7oW5YthSOORuIael9+pvEwkGc0VZxLlqvufzjYk09JV82f+UZRcsjud2cPUSogvgmGGtLKqmwLLeKhe6xgc=
pkgs.devel.redhat.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBDT8I6l839M7tb6V/Le8x3pGo3sTo6SG/kMrVwPQ6kUtxuaWKBLCmI1HVawfRbBz4fO+8AifdKjtOKUHcI6iPr8=
pkgs.devel.redhat.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCsc8DV5JsCx3dhD5BF2PPnUxZQsVWQ0ODLegg+3Sf898NrEtQaQiIgMf826whS0HLIcj1aspMe0W83zGH7GZEPMW3Y/Xche1kFdfmsnovdWwxE01edFN2B7h56NYB+Ec3zqd1/QUGeAKa+hde42/JFHyl2jrA+xbnhmaCcGvZFtLAQ4gCi7j/MY/2SHuFC+kj7LcyNMUC3GdY9IpbtrY2SRUBQa+WMw4X1rrTWpn0dyCLLu5eE+xGZ9aAkZjNyMQRPuG13ilWVWkU6olIphnT9lJ245P9xabuQOuMGxm0oih0zJLc/e5SH4HYj7MDXnKXXYMBuzlwqA7L73HVSwhGD
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
EOT

pushd "${CI_PROJECT_DIR}/" >/dev/null || exit 1

# git config user.email "${GITLAB_USER_EMAIL}"
# git config user.name "RHDH Build ($GITLAB_USER_LOGIN)"
git config --global user.email "rhdh-bot@redhat.com"
git config --global user.name "RHDH Build (rhdh-bot)"
git config --global push.default matching
git config --global merge.ff true
git config --global pull.ff-only true
git config --global pull.rebase true
git config --global branch.autosetupmerge true
git config --global branch.autosetuprebase always

git config --global advice.skippedCherryPicks false
git config --global advice.detachedHead false
# git config --global init.defaultBranch main

# git checkout -- .; git reset HEAD .; git clean -fdx
git fetch --all
git branch
git checkout "${CI_COMMIT_BRANCH}" || exit 1
git submodule sync --recursive
git submodule update --init --recursive
git rev-parse --abbrev-ref HEAD

# 2025/08/01: build and install download-secure-files in builder.Containerfile / quay.io/rhdh/gitlab-runner to save recompiling every time
# DSF_TAG="v0.1.12"
# pushd /tmp >/dev/null || exit 1
# # Redirect console output and errors to a log file to make this log shorter
# exec 3>&1 4>&2 1>> /tmp/gitlab-ci-env-setup.sh.build.log.txt 2>> /tmp/gitlab-ci-env-setup.sh.build.log.txt
#     rm -fr download-secure-files/
#     git clone https://gitlab.com/gitlab-org/incubation-engineering/mobile-devops/download-secure-files.git && cd download-secure-files/
#     git checkout $DSF_TAG
#     echo "download-secure-files version: $(cat VERSION)"
#     go get; CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-X 'main.Version=$(cat VERSION)'"  -o "$HOME/bin/download-secure-files" download-secure-files
#     go test -v
#     chmod +x "$HOME/bin/download-secure-files"
#     rm -fr /tmp/download-secure-files
# # end console redirection of output and errors
# exec 1>&3 3>&- 2>&4 4>&- 
# popd >/dev/null || exit 1

# try several times because it seems to work less than half the time...
for d in {1..90}; do 
    failed=0
    echo -n "[$d] "; "$HOME/bin/download-secure-files" || failed=1
    if [[ $failed -eq 0 ]]; then 
        break
    else
        echo " download-secure-files failed [$d]; sleep and try again..."
    fi
    sleep 2
done

# personal access token (rhdh-bot.pat) uploaded to Secure Files, see https://gitlab.cee.redhat.com/rhidp/rhdh/-/settings/ci_cd
if [[ -f "${CI_PROJECT_DIR}/.secure_files/rhdh-bot.gitlab.pat" ]]; then
    set +x
    # NOTE that if debugging PRIVATE_TOKEN with set -x, token will be revealed in plaintext, not obfuscated
    # for pushing to gitlab
    PRIVATE_TOKEN=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh-bot.gitlab.pat")
    export PRIVATE_TOKEN

    # for pushing to github
    GITHUB_TOKEN=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/RHDH_BOT_TOKEN" | sed -r -e "s/ *# *notsecret//" | tr -d " ")
    export GITHUB_TOKEN

    # for querying quay for images, in order to do a helm chart publish
    QUAY_TOKEN=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_quay.token")
    export QUAY_TOKEN
    # set a shared location for the podman/skopeo authentication
    export REGISTRY_AUTH_FILE=/run/containers/0/auth.json
    REGISTRY="quay.io"
    QUAY_USER="rhdh+rhdh_bot"
    echo -n "[INFO]: Log into $REGISTRY ... "
    echo "${QUAY_TOKEN}" | skopeo login -u="${QUAY_USER}" --password-stdin ${REGISTRY} -v --authfile $REGISTRY_AUTH_FILE

    # login to registry.redhat.io as rhdh-bot
    RRIO_USERNAME=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_registry_redhat_io.user")
    RRIO_PASSWORD=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_registry_redhat_io.pwd")
    export RRIO_PASSWORD
    REGISTRY="registry.redhat.io"
    echo -n "[INFO]: Log into $REGISTRY ... "
    echo "${RRIO_PASSWORD}" | skopeo login -u="${RRIO_USERNAME}" --password-stdin ${REGISTRY} -v --authfile $REGISTRY_AUTH_FILE

    # set up kerberos and log in as the rhdh-bot
    set -x
    cp "build/ci/krb5.conf" /etc/krb5.conf; # cat /etc/krb5.conf
    sed -i /etc/ssh/ssh_config -r \
        -e "s@# Host \*@Host *@"  \
        -e "s@.*GSSAPIAuthentication.*@GSSAPIAuthentication yes@" \
        -e "s@.*GSSAPIDelegateCredentials.*@GSSAPIDelegateCredentials yes@"
    kdestroy -A; kinit -k -t "${CI_PROJECT_DIR}/.secure_files/rhdh-bot.keytab" -V rhdh-bot@IPA.REDHAT.COM; klist
    set +x

    ######################################################################################
    # for use with the tag deletion script to clean up old quay tags -- USE WITH CAUTION!
    ######################################################################################
    QUAY_APP_ACCESS_TOKEN=$(cat "${CI_PROJECT_DIR}/.secure_files/rhdh_quay_app_access_token")
    export QUAY_APP_ACCESS_TOKEN

    rm -fr "${CI_PROJECT_DIR}/.secure_files"
else
    echo "Error: could not load ${CI_PROJECT_DIR}/.secure_files/; must exit!"
    exit 69
fi

echo " 
 
================================================================
Your gitlab ci enviroment set up is complete. On with the build!
================================================================
 
 "
