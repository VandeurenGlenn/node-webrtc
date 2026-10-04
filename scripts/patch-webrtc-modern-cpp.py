#!/usr/bin/env python3
"""Patch C++ portability issues in modern pinned WebRTC branches."""

from pathlib import Path
import os
import subprocess
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
    # GCC 13 cannot compare heterogeneous std::pair keys. Materialize the
    # URI as the map's string key for the two RTP extension lookups.
    picker = source_root / "call/payload_type_picker.cc"
    content = picker.read_text()
    old_lookup = "uri_to_id_.find(std::pair{uri, encrypt})"
    new_lookup = "uri_to_id_.find(std::pair{std::string(uri), encrypt})"
    if content.count(old_lookup) == 2:
        picker.write_text(content.replace(old_lookup, new_lookup))
        print(f"Patched {picker} for GCC 13 pair comparisons")
    elif content.count(new_lookup) != 2 or old_lookup in content:
        raise SystemExit(f"expected two RTP extension lookups in {picker}")

    # Use the addon's cross-GCC C++ headers instead of Bullseye's GCC 10
    # headers, which lack C++20 library features required by M154. Keep the
    # Chromium sysroot for C headers and libraries, and leave host tools alone.
    arch = os.environ["TARGET_ARCH"]
    triple = "aarch64-linux-gnu" if arch == "arm64" else "arm-linux-gnueabihf"
    tools = Path(os.environ.get("ARM_TOOLS_PATH", "/usr"))
    compiler = tools / "bin" / f"{triple}-g++"
    version = subprocess.check_output(
        [str(compiler), "-dumpversion"], text=True
    ).strip()
    includes = tools / triple / "include" / "c++" / version
    include_dirs = [includes, includes / triple, includes / "backward"]
    for directory in include_dirs:
        if not directory.is_dir():
            raise SystemExit(f"missing cross-GCC C++ headers: {directory}")

    config = source_root / "build/config/compiler/BUILD.gn"
    content = config.read_text()
    marker = "  # node-webrtc cross-GCC C++ headers"
    if marker not in content:
        anchor = 'config("compiler") {\n'
        start = content.index(anchor)
        position = content.index("  cflags_cc = []\n", start)
        position += len("  cflags_cc = []\n")
        flags = ["-nostdinc++"]
        for directory in include_dirs:
            flags.extend(["-isystem", directory.as_posix()])
        flag_lines = "\n".join(f'      "{flag}",' for flag in flags)
        addition = (
            f'{marker}\n  if (is_linux && current_cpu == "{arch}" && '
            f'!use_custom_libcxx) {{\n    cflags_cc += [\n{flag_lines}\n'
            '    ]\n  }\n'
        )
        config.write_text(content[:position] + addition + content[position:])
        print(f"Patched {config} to use cross-GCC {version} C++ headers")
    else:
        print(f"Cross-GCC C++ headers already configured in {config}")
