#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to prepare  
# macOS ARM64 environment for building RHDH images
SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
YQ="$HOME/.local/bin/yq_mf"
mikefarahyq_version=4.45.4

# Function to install Homebrew package with PATH management
install_brew_package() {
	local package="$1"
	local brew_package="${2:-$package}"
	local path_type="${3:-bin}"  # bin, gnu-sed, gawk, gnu-tar
	
	if ! command -v "$package" &>/dev/null; then
		echo "🔧 Installing $package..."
		brew install "$brew_package" >/dev/null 2>&1
		
		# Add appropriate PATH based on package type
		case "$path_type" in
			"gnu-sed")
				export PATH="/opt/homebrew/opt/gnu-sed/libexec/gnubin:$PATH"
				;;
			"gawk")
				export PATH="/opt/homebrew/opt/gawk/libexec/gnubin:$PATH"
				;;
			"gnu-tar")
				export PATH="/opt/homebrew/opt/gnu-tar/libexec/gnubin:$PATH"
				;;
			"bin")
				if [[ ":$PATH:" != *":/opt/homebrew/bin:"* ]]; then
					export PATH="/opt/homebrew/bin:$PATH"
				fi
				;;
		esac
	else
		echo "✅ $package is already installed."
	fi
}

prepareOSXARM64() {
	if [[ $(uname -o) == "Darwin" ]] && [[ $(uname -m) == "arm64" ]]; then
		echo "🔧 Preparing macOS environment..."
	else
		echo "❌ This script is intended for macOS ARM64 only. Exiting..."
		exit 0
	fi

  	if ! command -v brew &>/dev/null; then
		echo "❌ Homebrew is not installed. Installing Homebrew first..."
		/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	else	
		# Check if Homebrew is up to date
		echo "[INFO] Checking for Homebrew updates..."
		OUTDATED=$(brew outdated | grep -q . || echo "Already up-to-date")

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

	# Install GNU tools (need special PATH handling)
	install_brew_package "gsed" "gnu-sed" "gnu-sed"
	install_brew_package "gawk" "gawk" "gawk"
	install_brew_package "gnu-tar" "gnu-tar" "gnu-tar"

	# Install standard packages
	install_brew_package "rsync" "rsync"
	install_brew_package "gh" "gh"
	install_brew_package "git" "git"
	install_brew_package "helm" "helm"
	install_brew_package "helm-docs" "helm-docs"
	install_brew_package "oc" "openshift-cli"
	install_brew_package "podman" "podman"
	install_brew_package "oras" "oras"

	# Install Google Chrome (special case - cask)
	if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
		echo "✅ Google Chrome is installed or accessible."
	else
		echo "🔧 Installing Google Chrome..."
		brew install --cask google-chrome
	fi

	# Create symlink for Google Chrome
	if ! command -v google-chrome &>/dev/null; then
		echo "🔧 Adding a symlink for Google Chrome..."
		sudo ln -s "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" /usr/local/bin/google-chrome
	else
		echo "✅ symlink to Google Chrome is already available"
	fi

	# Install skopeo with wrapper (special case)
	if ! command -v skopeo >/dev/null 2>&1; then
		echo "🔧 Installing skopeo..."
		brew install skopeo

		echo "🔧 Adding a wrapper for skopeo..."
		cat <<'EOF' | sudo tee /usr/local/bin/skopeo > /dev/null
#!/usr/bin/env bash
/opt/homebrew/bin/skopeo "\$@" --override-arch=amd64 --override-os=linux
EOF
		sudo chmod +x /usr/local/bin/skopeo
	else
		echo "✅ A wrapper to skopeo is already available"
	fi

	if ! command -v "$YQ" &> /dev/null; then
			mkdir -p "$HOME/.local/bin/"
			echo -e "🔧 Installing mikefarah yq $mikefarahyq_version"
			curl -sSLo "$YQ" https://github.com/mikefarah/yq/releases/download/v"${mikefarahyq_version}"/yq_darwin_arm64
			chmod +x "$YQ"
	fi 
}

# this script should do nothing if we're not on arm64 Mac
prepareOSXARM64
