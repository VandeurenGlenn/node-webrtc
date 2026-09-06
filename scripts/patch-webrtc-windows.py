#!/usr/bin/env python3
"""Make the pinned WebRTC build helpers support modern Windows hosts."""

from pathlib import Path
import sys


def replace_once(path, old, new):
    content = path.read_text()
    if new.strip() in content:
        return
    if old not in content:
        raise RuntimeError(f"expected source block not found in {path}")
    path.write_text(content.replace(old, new, 1))
    print(f"Patched {path} for modern Windows toolchains")


if len(sys.argv) != 2:
    raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")

source_dir = Path(sys.argv[1])
vs_toolchain = source_dir / "build/vs_toolchain.py"

# pipes.quote was moved to shlex and pipes was removed in Python 3.13.
replace_once(vs_toolchain, "import pipes\n", "import shlex as pipes\n")

replace_once(
    vs_toolchain,
    """MSVS_VERSIONS = collections.OrderedDict([
  ('2019', '16.0'),
  ('2017', '15.0'),
])
""",
    """MSVS_VERSIONS = collections.OrderedDict([
  ('2022', '17.0'),
  ('2019', '16.0'),
  ('2017', '15.0'),
])
""",
)

replace_once(
    vs_toolchain,
    """MSVC_TOOLSET_VERSION = {
   '2019' : 'VC142',
   '2017' : 'VC141',
}
""",
    """MSVC_TOOLSET_VERSION = {
   '2022' : 'VC143',
   '2019' : 'VC142',
   '2017' : 'VC141',
}
""",
)
