#!/usr/bin/env bash
set -euo pipefail

if (( $# == 0 )); then
  echo 'Usage: install-linux-dependencies.sh PACKAGE...' >&2
  exit 2
fi

missing=()
for package in "$@"; do
  if [[ ! "$package" =~ ^[a-z0-9][a-z0-9.+:-]*$ ]]; then
    echo "Invalid package name: $package" >&2
    exit 2
  fi
  if [[ "$(dpkg-query -W -f='${db:Status-Status}' "$package" 2>/dev/null || true)" != installed ]]; then
    missing+=("$package")
  fi
done

if (( ${#missing[@]} == 0 )); then
  echo 'Requested Linux dependencies are already installed; skipping apt.'
  exit 0
fi

# Hosted Ubuntu runners can reference an unavailable Azure mirror. Rewrite
# only that mirror, keeping distributions, components and signature checks.
# A custom directory permits isolated tests without changing the host's apt.
sources_directory="${APT_SOURCES_DIR:-/etc/apt}"
for source in "$sources_directory/sources.list" "$sources_directory"/sources.list.d/*.list "$sources_directory"/sources.list.d/*.sources; do
  if [[ -f "$source" ]]; then
    sudo sed -i -E 's|https?://azure\.archive\.ubuntu\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$source"
  fi
done

# Newer hosted runners use mirror+file:/etc/apt/apt-mirrors.txt rather
# than putting the Azure URL in sources.list or ubuntu.sources. Remove the
# failing Azure entry, retaining the existing signed Ubuntu fallback mirrors.
for mirror in "$sources_directory"/apt-mirrors*.txt; do
  if [[ -f "$mirror" ]]; then
    sudo sed -i -E '/azure\.archive\.ubuntu\.com/d' "$mirror"
  fi
done

options=(
  -o Acquire::Retries=2
  -o Acquire::http::Timeout=20
  -o Acquire::https::Timeout=20
  -o DPkg::Lock::Timeout=60
  -o APT::Update::Error-Mode=any
)

# Bound the whole operations as well as individual network requests. Failed
# index refreshes must fail the step, not silently install from stale indexes.
sudo timeout --signal=TERM --kill-after=15s 180s apt-get "${options[@]}" update
sudo timeout --signal=TERM --kill-after=15s 300s apt-get "${options[@]}" install -y --no-install-recommends "${missing[@]}"
