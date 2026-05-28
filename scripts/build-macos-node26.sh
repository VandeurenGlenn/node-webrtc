#!/usr/bin/env bash
set -euo pipefail

# Build wrtc from source on macOS with Node 26 and the known-good env.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v nvm >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
  fi
fi

if ! command -v nvm >/dev/null 2>&1; then
  echo "nvm is required but not found." >&2
  exit 1
fi

nvm use 26.2.0

export PATH="/usr/bin:$PATH"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export SDKROOT="${SDKROOT:-$(xcrun --sdk macosx --show-sdk-path)}"
export FORCE_MAC_SDK_MIN="${FORCE_MAC_SDK_MIN:-15.4}"
export SKIP_DOWNLOAD=true

npm install "$@"
