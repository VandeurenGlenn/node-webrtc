#!/bin/bash

set -e

set -v

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


EXTRA_GN_ARGS=""
if [ "$(uname)" == "Linux" ]; then
  # GCC 13+ (default on ubuntu-24.04+) removed transitive inclusion of <cstdint>,
  # causing uint8_t/uint64_t to be unavailable in abseil-cpp headers.  Switching
  # to C++17 aligns with what the abseil version bundled in WebRTC branch-heads/4500
  # actually requires and resolves the compilation errors.
  # -Wno-error=return-type suppresses a GCC 12+ error in WebRTC's
  # video_frame_buffer.cc where the default case of a switch in a non-void
  # function has no return statement.
  EXTRA_GN_ARGS=' extra_cflags_cc=["-std=c++17","-Wno-error=return-type"]'
fi

gn gen ${BINARY_DIR} "--args=${GN_GEN_ARGS}${EXTRA_GN_ARGS}"
