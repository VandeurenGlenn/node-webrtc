#!/bin/bash

set -e

WEBRTC_BUILD_FILE="$1/BUILD.gn"

if grep -q '"api:enable_media_with_defaults",' "$WEBRTC_BUILD_FILE"; then
  exit 0
fi

python3 - "$WEBRTC_BUILD_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
needle = '      "api:enable_media",\n'
replacement = needle + '      "api:enable_media_with_defaults",\n'

if needle not in source:
    raise SystemExit("Could not find the WebRTC media dependency in BUILD.gn")

path.write_text(source.replace(needle, replacement, 1))
PY
