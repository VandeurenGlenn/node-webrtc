#!/usr/bin/env python3
"""Patch C++ portability issues in modern pinned WebRTC branches."""

from pathlib import Path
import os
import sys


if len(sys.argv) != 2:
    raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")

source_root = Path(sys.argv[1])
header = source_root / "rtc_base/ssl_stream_adapter.h"
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

if os.environ.get("TARGET_ARCH") in {"arm", "arm64"}:
    # Chromium's Bullseye ARM sysroot uses a libstdc++ version from before
    # std::make_unique_for_overwrite. Keep the original uninitialized allocation
    # semantics without requiring Chromium's bundled libc++ in the Node addon.
    buffer_source = source_root / "rtc_base/copy_on_write_buffer.cc"
    if not buffer_source.is_file():
        raise SystemExit(f"missing WebRTC source: {buffer_source}")

    content = buffer_source.read_text()
    old_allocation = "std::make_unique_for_overwrite<uint8_t[]>(size)"
    compatible_allocation = "std::unique_ptr<uint8_t[]>(new uint8_t[size])"

    if compatible_allocation in content:
        print(f"ARM sysroot compatibility already applied to {buffer_source}")
    elif old_allocation in content:
        buffer_source.write_text(
            content.replace(old_allocation, compatible_allocation, 1)
        )
        print(f"Patched {buffer_source} for the ARM sysroot C++ standard library")
    else:
        raise SystemExit(f"expected overwrite allocation not found in {buffer_source}")
