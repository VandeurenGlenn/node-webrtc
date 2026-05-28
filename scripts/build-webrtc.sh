#!/bin/bash

set -e

set -v

NINJA_BIN=$(command -v ninja || true)

export PATH=$DEPOT_TOOLS:$PATH

if [ -z "$NINJA_BIN" ]; then
  NINJA_BIN=$(command -v ninja || true)
fi

if [ -z "$NINJA_BIN" ]; then
  echo "Could not find ninja on PATH" >&2
  exit 1
fi

export TARGETS="webrtc libjingle_peerconnection"
if [[ "$(uname)" == "Linux" && "$TARGET_ARCH" == arm* ]]; then
  export TARGETS="$TARGETS pc:peerconnection libc++ libc++abi"
fi
if [[ "$(uname)" == "Darwin" ]]; then
  export TARGETS="$TARGETS libc++"
fi

if [ -z "$PARALLELISM" ]; then
  "$NINJA_BIN" $TARGETS
else
  "$NINJA_BIN" $TARGETS -j $PARALLELISM
fi
