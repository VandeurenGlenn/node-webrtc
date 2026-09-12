#!/usr/bin/env python3
"""Patch C++ portability issues in modern pinned WebRTC branches."""

from pathlib import Path
import sys


if len(sys.argv) != 2:
    raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")

header = Path(sys.argv[1]) / "rtc_base/ssl_stream_adapter.h"
if not header.is_file():
    raise SystemExit(f"missing WebRTC header: {header}")

content = header.read_text()
patched = content

if "#include <cstddef>" not in patched:
    include_marker = "#include <stddef.h>\n"
    if include_marker not in patched:
        raise SystemExit(f"expected include marker not found in {header}")
    patched = patched.replace(include_marker, f"{include_marker}\n#include <cstddef>\n", 1)

old_signature = "      nullptr_t /*field_trials*/) {"
new_signature = "      std::nullptr_t /*field_trials*/) {"
if new_signature not in patched:
    if old_signature not in patched:
        raise SystemExit(f"expected nullptr_t signature not found in {header}")
    patched = patched.replace(old_signature, new_signature, 1)

if patched == content:
    print(f"Modern C++ compatibility already applied to {header}")
else:
    header.write_text(patched)
    print(f"Patched {header} for system C++ standard libraries")
