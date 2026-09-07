#!/bin/bash

set -e

set -v

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PYTHONPATH="$SCRIPT_DIR/python-compat${PYTHONPATH:+:$PYTHONPATH}"
export PATH=$DEPOT_TOOLS:$PATH

PYTHON_BIN=python
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN=python3
fi

cd ${SOURCE_DIR}

if [ "$(uname)" == "Linux" ]; then
if [ "$TARGET_ARCH" == "arm" ]; then
  "$PYTHON_BIN" build/linux/sysroot_scripts/install-sysroot.py --arch=arm
elif [ "$TARGET_ARCH" == "arm64" ]; then
  "$PYTHON_BIN" build/linux/sysroot_scripts/install-sysroot.py --arch=arm64
else
  "$PYTHON_BIN" build/linux/sysroot_scripts/install-sysroot.py --arch=amd64
fi
fi

# NOTE(mroberts): Running hooks generates this file, but running hooks also
# takes too long in CI; so do this manually.
(cd build/util && "$PYTHON_BIN" lastchange.py -o LASTCHANGE)

"$SCRIPT_DIR/patch-webrtc-media-defaults.sh" "$SOURCE_DIR"
gn gen ${BINARY_DIR} "--args=${GN_GEN_ARGS}"
