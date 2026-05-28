#!/bin/bash

set -e

set -v

export PATH=$DEPOT_TOOLS:$PATH

gclient config --unmanaged --spec 'solutions=[{"name":"src","url":"https://webrtc.googlesource.com/src.git"}]'

gclient sync --shallow --no-history --nohooks --with_branch_heads -r ${WEBRTC_REVISION} -R

PYTHON_BIN=python
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
	PYTHON_BIN=python3
fi

"$PYTHON_BIN" src/tools/clang/scripts/update.py

rm -f webrtc

ln -s src webrtc
