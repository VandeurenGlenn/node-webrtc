#!/usr/bin/env bash
# Patch WebRTC base64.h and base64.cc to add #include <cstdint> if missing
set -e
webrtc_dir="$1/rtc_base/third_party/base64"
for f in base64.h base64.cc; do
  file="$webrtc_dir/$f"
  if ! grep -q "#include <cstdint>" "$file"; then
    tmpfile=$(mktemp)
    echo "#include <cstdint>" > "$tmpfile"
    cat "$file" >> "$tmpfile"
    mv "$tmpfile" "$file"
    echo "Patched $file with #include <cstdint>"
  fi
done