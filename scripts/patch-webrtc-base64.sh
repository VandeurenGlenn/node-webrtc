#!/usr/bin/env bash
# Apply compatibility patches required by older pinned WebRTC revisions.
set -e
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
webrtc_dir="$1/rtc_base/third_party/base64"
if [ ! -d "$webrtc_dir" ]; then
  echo "Modern WebRTC source layout detected; skipping legacy compatibility patches"
  python_bin=python
  if ! command -v "$python_bin" >/dev/null 2>&1; then
    python_bin=python3
  fi
  "$python_bin" "$script_dir/patch-webrtc-modern-cpp.py" "$1"
  PYTHON_BIN="$python_bin" "$script_dir/patch-webrtc-media-defaults.sh" "$1"
  if [ "$(uname -s)" = "Darwin" ]; then
    "$python_bin" "$script_dir/patch-webrtc-apple-clt-modern.py" "$1"
  fi
  case "$(uname -s)" in
    CYGWIN*|MINGW*|MSYS*)
      "$python_bin" "$script_dir/patch-webrtc-boringssl-prefix.py" "$1"
      ;;
  esac
  exit 0
fi

for f in base64.h base64.cc; do
  file="$webrtc_dir/$f"
  if [ ! -f "$file" ]; then
    continue
  fi
  if ! grep -q "#include <cstdint>" "$file"; then
    tmpfile=$(mktemp)
    echo "#include <cstdint>" > "$tmpfile"
    cat "$file" >> "$tmpfile"
    mv "$tmpfile" "$file"
    echo "Patched $file with #include <cstdint>"
  fi
done

case "$(uname -s)" in
  Darwin)
    python3 "$script_dir/patch-webrtc-apple-clt.py" "$1"
    ;;
  CYGWIN*|MINGW*|MSYS*)
    python "$script_dir/patch-webrtc-windows.py" "$1"
    ;;
esac
