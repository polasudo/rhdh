#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to prepare  
# macOS ARM64 environment for building RHDH images
SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

prepareOSXARM64() {
	if [[ $(uname -o) == "Darwin" ]] && [[ $(uname -m) == "arm64" ]]; then
		echo "🔧 Preparing macOS environment..."
	else
		echo "❌ This script is intended for macOS ARM64 only. Exiting..."
		exit 1
	fi

  	if ! command -v brew &>/dev/null; then
		echo "❌ Homebrew is not installed. Installing Homebrew first..."
		/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	else	
		# Check if Homebrew is up to date
		echo "[INFO] Checking for Homebrew updates..."
		OUTDATED=$(brew update --dry-run 2>&1)

		if echo "$OUTDATED" | grep -q "Already up-to-date"; then
			echo "✅ Homebrew is already up to date."
		else
			echo "🔧 Updating Homebrew..."
			brew update
			brew upgrade
		fi
	fi	

	# install the latest Bash on macOS if not already installed
	current_bash_version=$(bash --version | head -n1 | awk '{print $4}')
	major_bash_version=$(echo "$current_bash_version" | cut -d. -f1)

	# If current Bash is older than version 5, install newer one
	if [ "$major_bash_version" -lt 5 ]; then
		echo "🔧 Current Bash version is $current_bash_version. Installing latest Bash..."
		brew install bash

		# Optional: Add to /etc/shells and make it default
		new_bash="$(brew --prefix)/bin/bash"
		if ! grep -q "$new_bash" /etc/shells; then
			echo "Adding $new_bash to /etc/shells"
			echo "$new_bash" | sudo tee -a /etc/shells
		fi

		echo "To set it as your default shell, run:"
		echo "  chsh -s $new_bash"
	else
		echo "✅ Your Bash version ($current_bash_version) is already up to date (≥ 5)."
	fi
	
	if ! command -v gsed &>/dev/null; then
		echo "🔧 Installing GNU sed (gsed)..."
		brew install gnu-sed
		export PATH="/opt/homebrew/opt/gnu-sed/libexec/gnubin:$PATH"
	else
		echo "✅ gsed is already installed."
	fi

	if ! command -v gawk &>/dev/null; then
		echo "🔧 Installing GNU awk (gawk)..."
		brew install gawk
		export PATH="/opt/homebrew/opt/gawk/libexec/gnubin:$PATH"
	else
		echo "✅ gawk is already installed."
	fi

	if ! command -v rsync &>/dev/null; then
		echo "🔧 Installing rsync..."
		brew install rsync
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ rsync is already installed."
	fi

	if ! command -v gnu-tar &>/dev/null; then
		echo "🔧 Installing gnu-tar..."
		brew install gnu-tar
		export PATH="/opt/homebrew/opt/gnu-tar/libexec/gnubin:$PATH"
	else
		echo "✅ gnu-tar is already installed."
	fi

	if ! command -v gh &>/dev/null; then
		echo "🔧 Installing gh..."
		brew install gh
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ gh is already installed."
	fi

	if ! command -v git &>/dev/null; then
		echo "🔧 Installing git..."
		brew install git
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ git is already installed."
	fi

	if ! command -v helm &>/dev/null; then
		echo "🔧 Installing helm..."
		brew install helm
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ helm is already installed."
	fi

	if ! command -v helm-docs &>/dev/null; then
		echo "🔧 Installing helm-docs..."
		brew install helm-docs
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ helm-docs is already installed."
	fi

	if ! command -v oc &>/dev/null; then
		echo "🔧 Installing oc..."
		brew install openshift-cli
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ oc is already installed."
	fi

	if ! command -v podman &>/dev/null; then
		echo "🔧 Installing podman..."
		brew install podman
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ podman is already installed."
	fi

	if ! command -v oras &>/dev/null; then
		echo "🔧 Installing oras..."
		brew install oras
		
		if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
  			export PATH="/opt/homebrew/bin:$PATH"
		fi
	else
		echo "✅ oras is already installed."
	fi

	if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
		echo "Google Chrome is installed or accessible."
	else
		echo "Google Chrome is not available."
		echo "🔧 Installing Google Chrome..."
		brew install --cask google-chrome
	fi

	if ! command -v google-chrome &>/dev/null; then
		echo "🔧 Adding a symlink for Google Chrome..."
		sudo ln -s "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" /usr/local/bin/google-chrome
	else
		echo "✅ symlink to Google Chrome is already available"
	fi

	# Check if skopeo is installed
	if ! command -v skopeo >/dev/null 2>&1; then
		echo "🔧 Installing skopeo..."
		brew install skopeo

		echo "🔧 Adding a wrapper for skopeo..."

		cat <<'EOF' | sudo tee /usr/local/bin/skopeo > /dev/null
#!/bin/bash
/opt/homebrew/bin/skopeo "\$@" --override-arch=amd64 --override-os=linux
EOF
    	sudo chmod +x /usr/local/bin/skopeo
	else
    	echo "✅ A wrapper to skopeo is already available"
	fi
}

prepareOSXARM64
