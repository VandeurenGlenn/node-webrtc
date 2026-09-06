#!/usr/bin/env python3
"""Allow modern WebRTC release branches to build with Apple CLT only."""

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
  version_verbatim = lines[0].split()[-1]
  settings['xcode_version'] = FormatVersion(version_verbatim)
  settings['xcode_version_int'] = int(settings['xcode_version'], 10)
  settings['xcode_version_verbatim'] = version_verbatim
  settings['xcode_build'] = lines[-1].split()[-1]
""",
    """  try:
    lines = subprocess.check_output(
        ['xcodebuild', '-version'], stderr=subprocess.DEVNULL
    ).decode('UTF-8').splitlines()
    version_verbatim = lines[0].split()[-1]
    xcode_build = lines[-1].split()[-1]
  except (OSError, subprocess.CalledProcessError):
    version_verbatim = subprocess.check_output(
        ['xcrun', '-sdk', 'macosx', '--show-sdk-version']
    ).decode('UTF-8').strip()
    xcode_build = subprocess.check_output(
        ['xcrun', '-sdk', 'macosx', '--show-sdk-build-version']
    ).decode('UTF-8').strip()
  settings['xcode_version'] = FormatVersion(version_verbatim)
  settings['xcode_version_int'] = int(settings['xcode_version'], 10)
  settings['xcode_version_verbatim'] = version_verbatim
  settings['xcode_build'] = xcode_build
""",
)
replace_once(
    sdk_info,
    """  settings['sdk_platform_path'] = subprocess.check_output(
      ['xcrun', '-sdk', platform,
       '--show-sdk-platform-path']).decode('UTF-8').strip()
""",
    """  try:
    settings['sdk_platform_path'] = subprocess.check_output(
        ['xcrun', '-sdk', platform, '--show-sdk-platform-path'],
        stderr=subprocess.DEVNULL).decode('UTF-8').strip()
  except subprocess.CalledProcessError:
    settings['sdk_platform_path'] = subprocess.check_output(
        ['xcode-select', '-print-path']).decode('UTF-8').strip()
""",
)
replace_once(
    sdk_info,
    """  settings['toolchains_path'] = os.path.join(
      subprocess.check_output(['xcode-select',
                               '-print-path']).decode('UTF-8').strip(),
      'Toolchains/XcodeDefault.xctoolchain')
""",
    """  developer_path = subprocess.check_output(
      ['xcode-select', '-print-path']).decode('UTF-8').strip()
  xcode_toolchain = os.path.join(
      developer_path, 'Toolchains/XcodeDefault.xctoolchain')
  settings['toolchains_path'] = (
      xcode_toolchain if os.path.isdir(xcode_toolchain) else developer_path)
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
      print('/usr/bin/')
    else:
      bin_path = 'Toolchains/XcodeDefault.xctoolchain/usr/bin/'
      print(os.path.join(dev_dir, bin_path))
""",
)
