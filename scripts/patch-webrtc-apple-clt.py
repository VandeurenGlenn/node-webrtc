#!/usr/bin/env python3
"""Make pinned WebRTC build helpers work with Apple Command Line Tools."""

from pathlib import Path
import sys


def replace_once(path, old, new):
    content = path.read_text()
    if new.strip() in content:
        return
    if old not in content:
        raise RuntimeError(f"expected source block not found in {path}")
    path.write_text(content.replace(old, new, 1))
    print(f"Patched {path} for Apple Command Line Tools")


if len(sys.argv) != 2:
    raise SystemExit(f"usage: {Path(sys.argv[0]).name} WEBRTC_SOURCE_DIR")

source_dir = Path(sys.argv[1])

sdk_info = source_dir / "build/config/apple/sdk_info.py"
replace_once(
    sdk_info,
    """  lines = subprocess.check_output(['xcodebuild',
                                   '-version']).decode('UTF-8').splitlines()
  settings['xcode_version'] = FormatVersion(lines[0].split()[-1])
  settings['xcode_version_int'] = int(settings['xcode_version'], 10)
  settings['xcode_build'] = lines[-1].split()[-1]
""",
    """  try:
    lines = subprocess.check_output(
        ['xcodebuild', '-version'], stderr=subprocess.DEVNULL
    ).decode('UTF-8').splitlines()
    version = lines[0].split()[-1]
    build = lines[-1].split()[-1]
  except (OSError, subprocess.CalledProcessError):
    # Command Line Tools installations do not ship xcodebuild. Their SDK
    # metadata is still authoritative for the compiler and SDK in use.
    version = subprocess.check_output(
        ['xcrun', '-sdk', 'macosx', '--show-sdk-version']
    ).decode('UTF-8').strip()
    build = subprocess.check_output(
        ['xcrun', '-sdk', 'macosx', '--show-sdk-build-version']
    ).decode('UTF-8').strip()
  settings['xcode_version'] = FormatVersion(version)
  settings['xcode_version_int'] = int(settings['xcode_version'], 10)
  settings['xcode_build'] = build
""",
)

find_sdk = source_dir / "build/mac/find_sdk.py"
replace_once(
    find_sdk,
    """  sdk_dir = os.path.join(
      dev_dir, 'Platforms/MacOSX.platform/Developer/SDKs')

  if not os.path.isdir(sdk_dir):
    raise SdkError('Install Xcode, launch it, accept the license ' +
      'agreement, and run `sudo xcode-select -s /path/to/Xcode.app` ' +
      'to continue.')
""",
    """  sdk_dirs = [
      os.path.join(dev_dir, 'Platforms/MacOSX.platform/Developer/SDKs'),
      os.path.join(dev_dir, 'SDKs'),
  ]
  sdk_dir = next((path for path in sdk_dirs if os.path.isdir(path)), None)

  if not sdk_dir:
    raise SdkError('Install Xcode or Apple Command Line Tools and select its ' +
      'developer directory with xcode-select.')
    """,
)
replace_once(
    find_sdk,
    """  if options.print_bin_path:
    bin_path = 'Toolchains/XcodeDefault.xctoolchain/usr/bin/'
    print(os.path.join(dev_dir, bin_path))
""",
    """  if options.print_bin_path:
    if sdk_dir == os.path.join(dev_dir, 'SDKs'):
      # Command Line Tools keeps libtool and compatible compiler shims here.
      print('/usr/bin/')
    else:
      bin_path = 'Toolchains/XcodeDefault.xctoolchain/usr/bin/'
      print(os.path.join(dev_dir, bin_path))
""",
)

# setuptools no longer installs pkg_resources by default on modern Python.
# This dependency is only needed when installing Chromium's private hermetic
# Xcode, so keep it out of the normal system-toolchain detection path.
mac_toolchain = source_dir / "build/mac_toolchain.py"
replace_once(
    mac_toolchain,
    "import pkg_resources\n",
    "# pkg_resources is imported lazily for hermetic Xcode only.\n",
)
# Normalize build trees patched by the first revision of this helper, which
# placed the lazy import before the function docstring.
replace_once(
    mac_toolchain,
    """def InstallXcodeBinaries():
  import pkg_resources
  \"\"\"Installs the Xcode binaries needed to build Chrome and accepts the license.
""",
    """def InstallXcodeBinaries():
  \"\"\"Installs the Xcode binaries needed to build Chrome and accepts the license.
""",
)
replace_once(
    mac_toolchain,
    """def InstallXcodeBinaries():
  \"\"\"Installs the Xcode binaries needed to build Chrome and accepts the license.
""",
    """def InstallXcodeBinaries():
  \"\"\"Installs the Xcode binaries needed to build Chrome and accepts the license.
""",
)
replace_once(
    mac_toolchain,
    """  This is the replacement for InstallXcode that installs a trimmed down version
  of Xcode that is OS-version agnostic.
  \"\"\"
""",
    """  This is the replacement for InstallXcode that installs a trimmed down version
  of Xcode that is OS-version agnostic.
  \"\"\"
  import pkg_resources
""",
)
