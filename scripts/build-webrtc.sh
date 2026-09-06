#!/bin/bash

set -e

set -v

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PYTHONPATH="$SCRIPT_DIR/python-compat${PYTHONPATH:+:$PYTHONPATH}"
NINJA_BIN=$(command -v ninja || true)

export PATH=$DEPOT_TOOLS:$PATH

if [ -z "$NINJA_BIN" ]; then
  NINJA_BIN=$(command -v ninja || true)
fi

if [ -z "$NINJA_BIN" ]; then
  echo "Could not find ninja on PATH" >&2
  exit 1
fi

export TARGETS="webrtc"

if [ -z "$PARALLELISM" ]; then
  "$NINJA_BIN" $TARGETS
else
  "$NINJA_BIN" $TARGETS -j $PARALLELISM
fi
