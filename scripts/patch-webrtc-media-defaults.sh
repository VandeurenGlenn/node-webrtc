#!/bin/bash

set -e

WEBRTC_BUILD_FILE="$1/BUILD.gn"
python_bin="${PYTHON_BIN:-python}"
if ! command -v "$python_bin" >/dev/null 2>&1; then
  python_bin=python3
fi

"$python_bin" - "$WEBRTC_BUILD_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
if '"api:enable_media_with_defaults",' not in source:
    needle = '      "api:enable_media",\n'
    replacement = needle + '      "api:enable_media_with_defaults",\n'
    if needle not in source:
        raise SystemExit("Could not find the WebRTC media dependency in BUILD.gn")
    source = source.replace(needle, replacement, 1)

target = '''

# Complete archive for Node's Windows linker. GN's regular static libraries are
# thin archives and cannot be consumed directly by link.exe.
if (is_win) {
  static_library("node_webrtc_extras") {
    complete_static_lib = true
    deps = [
      "//api/video:adapted_video_track_source",
      "//api/video_codecs:builtin_video_decoder_factory",
      "//api/video_codecs:builtin_video_encoder_factory",
    ]
  }
}
'''
if 'static_library("node_webrtc_extras")' not in source:
    source += target

path.write_text(source)
PY
