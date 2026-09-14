#!/usr/bin/env python3

from pathlib import Path
import sys


if len(sys.argv) != 2:
    raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")

build_file = Path(sys.argv[1]) / "third_party" / "boringssl" / "BUILD.gn"
text = build_file.read_text(encoding="utf-8")
prefix = "BORINGSSL_PREFIX=node_webrtc"

if prefix in text:
    raise SystemExit(0)

text = text.replace(
    'config("external_config") {\n  include_dirs = [ "src/include" ]\n',
    'config("external_config") {\n  include_dirs = [ "src/include" ]\n'
    f'  defines = [ "{prefix}" ]\n',
    1,
)
text = text.replace(
    '    defines = [ "BORINGSSL_SHARED_LIBRARY" ]',
    '    defines += [ "BORINGSSL_SHARED_LIBRARY" ]',
    1,
)
text = text.replace(
    '  defines = [ "BORINGSSL_IMPLEMENTATION" ]',
    f'  defines = [ "BORINGSSL_IMPLEMENTATION", "{prefix}" ]',
    1,
)
text = text.replace(
    '  nasm_assemble("boringssl_asm") {\n    visibility = [ ":*" ]\n',
    '  nasm_assemble("boringssl_asm") {\n    visibility = [ ":*" ]\n'
    f'    defines = [ "{prefix}" ]\n',
    1,
)

if text.count(prefix) != 3:
    raise SystemExit("Could not patch all BoringSSL prefix build locations")

build_file.write_text(text, encoding="utf-8")
print(f"Prefixed bundled BoringSSL symbols in {build_file}")
