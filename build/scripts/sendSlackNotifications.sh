#!/bin/bash

PWD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_STATE='RC'
BUNDLE_TAG=''
RHDH_VERSION=''
RHDH_FULL_VERSION=''
WEBHOOK_URL=''
DRYRUN=0

usage() {
  echo "
  Utility script to send a slack notification to #forum-rhdh-releases regarding GA/RC builds
  
  Requires that you are already logged into the Konflux cluster via commandline, for example
   oc login --token=sha256~YOUR_TOKEN_HERE --server=https://api.stone-prod-p02.hjvn.p1.openshiftapps.com:6443

  To generate a token go to https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant 
  Then click on your username and select 'Copy login command' then 'Display token'
  
  Usage:
    $0 --version <x.y.z version> --bundle-tag x.y-zzz --slack-webhook https://hooks.slack.com/services/... [OPTIONS]
  
  Options:
    --version <x.y.z version> : Version of the RHDH RC or GA build. Required.
    --bundle-tag <bundle-tag> : Operator-bundle tag to use. If not provided, will search for the the latest operator-bundle image for the RHDH version.
    --slack-webhook <webhook> : Webhook to post a message to a given channel (For webhook for #forum-rhdh-releases, see bitwarden)
    --dryrun                  : Create payload but do not send to webhook.
    --release-state <release-state> : Release State (RC or GA) to be mentioned in the slack message; default: RC.

  Example:
    export SLACK_WEBHOOK=https://hooks.slack.com/services/...
    $0 --version 1.6.1 --bundle-tag 1.6-140 --slack-webhook \$SLACK_WEBHOOK
"
}

send_slack_message() {
  response=$(curl -s -w "%{http_code}" -X POST -H 'Content-type: application/json' --data "$PAYLOAD" "$WEBHOOK_URL")

  # Get the HTTP status code
  http_code="${response: -3}"

  # Check if the response code is 2xx (success)
  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    echo "[INFO] Slack message sent successfully."
  else
    echo "[ERROR] Failed to send Slack message. HTTP Status Code: $http_code"
  fi
}

create_payload() {
  HELM_INSTALL="cd /tmp; curl -sSLO https://raw.githubusercontent.com/redhat-developer/rhdh-chart/refs/heads/release-${RHDH_VERSION}/.rhdh/scripts/install.sh; chmod +x install.sh;\n./install.sh ${CHART_TAG}-CI --namespace rhdh-${RHDH_FULL_VERSION//./-}-${RELEASE_STATE,,}"
  HEADING=":announcement: $RELEASE_STATE $RHDH_FULL_VERSION is available + ready for testing :announcement:"
  BUNDLE_IMAGE="quay.io/rhdh/rhdh-operator-bundle:$BUNDLE_TAG"
  FBC_LINK="quay.io/rhdh/iib"

  # Create Slack payload in Block Kit format
  # See https://api.slack.com/reference/surfaces/formatting#mentioning-groups on how to mention groups and retrieve slack group IDs.
  # Currently the following groups/people are mentioned: rhdh-security(S07HB36PXN0), rhdh-qe(S06E0SM1W77), rhdh-docs-gate-keeper(S07LTQM5JGM),
  # rhdh-release-manager(S08DAH1PCF6), rhdh-release(S094AHZQ5M4)

  PAYLOAD=$(
    cat <<EOF
{
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "*${HEADING}*"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":quay: *Quay Images:*\`\`\`${IMAGE_LIST}\`\`\`"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":helm-3707: *Helm Chart Installation:*\`\`\`${HELM_INSTALL}\`\`\`"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":operator: *Operator Installation:* https://github.com/redhat-developer/rhdh-operator/blob/release-${RHDH_VERSION}/.rhdh/docs/installing-ci-builds.adoc (from ${FBC_LINK})"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "<!subteam^S07HB36PXN0> <!subteam^S06E0SM1W77> <!subteam^S07LTQM5JGM> <!subteam^S08DAH1PCF6> <!subteam^S094AHZQ5M4>"
			}
		}
	]
}
EOF
  )

  if [[ $DRYRUN -eq 1 ]]; then
    echo -e "\n[INFO] PAYLOAD created (--dryrun)"
    echo "==============="
    # remove newlines to avoid "control characters from U+0000 through U+001F must be escaped" message from yq
    echo -e "${PAYLOAD}" | tr "\n" " " | jq
    echo "==============="
    echo -e "\nTo post to Slack, use the --slack-webhook flag"
  fi
}

get_images() {
  if [ -z "$BUNDLE_TAG" ]; then
    BUNDLE_IMAGE=$("${PWD}/getLatestImageTags.sh" --quay --tag "${RHDH_VERSION}-" -c rhdh/rhdh-operator-bundle)
  else
    BUNDLE_IMAGE="quay.io/rhdh/rhdh-operator-bundle:$BUNDLE_TAG"
  fi

  # shellcheck disable=SC2086
  "${PWD}/checkImagesInCSV.sh" -q -y $BUNDLE_IMAGE -i 'hub|operator' >>"${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt"
  echo "$BUNDLE_IMAGE" >>"${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt"
  sort -uV "${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt" >"${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt_"
  mv "${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt"{_,}

  # Eg image: quay.io/rhdh/rhdh-operator-bundle:1.5-123
  # shellcheck disable=SC2086
  skopeo inspect docker://$BUNDLE_IMAGE >"${TMPDIR}"/container_inspect.txt

  # GET MID_SHA
  MID_SHA=$(jq -r '.Labels."vcs-ref"' "${TMPDIR}"/container_inspect.txt)
  MID_SHA=${MID_SHA/sha256:/}

  # given a bundle and its SHA get the snapshot
  SNAPSHOT=$(oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp \
    --selector="pac.test.appstudio.openshift.io/original-prname=rhdh-operator-bundle-$(echo "$RHDH_VERSION" | tr '.' '-')-on-push,pac.test.appstudio.openshift.io/sha=${MID_SHA}" |
    sed -r -e '/NAME +AGE/d' -e "s/([a-z0-9-]+)\ +([0-9smhdy]+)/\1/g")

  rm -f "${TMPDIR}"/container_inspect.txt

  # get hub and operator images from the bundle snapshot
  oc -n 'rhdh-tenant' get Snapshot "$SNAPSHOT" -o yaml >"${TMPDIR}"/"$SNAPSHOT".yaml
  IMAGES=$(yq -r '.spec.components[].containerImage' "${TMPDIR}"/"$SNAPSHOT".yaml | sort -uV)
  # echo "Got images: $IMAGES"
  IMAGE_LIST=""
  for i in $IMAGES; do
    imageAndTag="$("${PWD}/getTagForSHA.sh" "$i" -q -y)"
    if [[ "$imageAndTag" == *"rhdh-hub"* ]]; then 
      CHART_TAG=${imageAndTag}
      CHART_TAG=${CHART_TAG#*:}
      # echo "CHART_TAG=$CHART_TAG"
    fi
    # shellcheck disable=SC2086
    echo $imageAndTag >>"${TMPDIR}/imagelist_$SNAPSHOT.txt"
    # shellcheck disable=SC2001
    i=$(echo "$i" | sed 's/^[^@]*\(@.*\)/\1/')
    IMAGE_LIST="$IMAGE_LIST$imageAndTag ($i)\n"
  done

  # Remove leading and trailing newlines
  IMAGE_LIST=$(echo -e "$IMAGE_LIST" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # Check if images in Snapshot matches with CSV referecnes in the bundle
  if [[ "$(cat "${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt")" != "$(cat "${TMPDIR}/imagelist_$SNAPSHOT.txt")" ]]; then
    echo "[ERROR] CSV images != images in snapshot:"
    echo "===================CSV========================"
    cat "${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt"
    echo "===================CSV========================"
    echo
    echo "===================snapshot==================="
    cat "${TMPDIR}/imagelist_$SNAPSHOT.txt"
    echo "===================snapshot==================="
    exit
  else
    echo "[INFO] Snapshot images match CSV images!"
    cat "${TMPDIR}/imagelist_$SNAPSHOT.txt"
  fi
  rm -f "${TMPDIR}/imagelist_$SNAPSHOT.txt" "${TMPDIR}/imagelist_CSV_$RHDH_VERSION.txt" "${TMPDIR}/"$SNAPSHOT".yaml"
}

# Main script logic to process input options
while [ $# -gt 0 ]; do
  case $1 in
  --release-state)
    RELEASE_STATE="$2"
    shift
    ;;
  --bundle-tag)
    BUNDLE_TAG="$2"
    shift
    ;;
  --version)
    RHDH_FULL_VERSION="$2"
    shift
    ;;
  --dryrun)
    DRYRUN=1
    shift
    ;;
  --slack-webhook)
    WEBHOOK_URL="$2"
    shift
    ;;
  *)
    usage
    exit 1
    ;;
  esac
  shift
done

if [[ -z "$RHDH_FULL_VERSION" ]] || [[ ! "$RHDH_FULL_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "[ERROR] RHDH version x.y.z is required (e.g., 1.5.2)."
  usage
  exit 1
else
  RHDH_VERSION=${RHDH_FULL_VERSION%.*}
fi

if [[ -z "$WEBHOOK_URL" ]] && [[ $DRYRUN -eq 0 ]]; then
  echo "[ERROR] Slack Webhook URL is required; use --dryrun flag to create payload without sending."
  usage
  exit 1
fi

# work in a unique folder
TMPDIR=$(mktemp -d)

get_images
create_payload
if [[ $DRYRUN -eq 0 ]]; then
  send_slack_message
fi

# cleanup
rm -fr "$TMPDIR"