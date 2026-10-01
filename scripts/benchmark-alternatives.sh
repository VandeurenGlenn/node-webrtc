#!/usr/bin/env bash

set -euo pipefail

benchmark_implementation() {
  label="$1"
  package_spec="$2"
  package_name="$3"
  output_name="$4"
  install_dir="$RUNNER_TEMP/webrtc-implementations/$output_name"
  output="benchmarks/implementations/$output_name.json"
  mkdir -p "$install_dir"
  if npm install --prefix "$install_dir" --no-package-lock "$package_spec"; then
    module_path="$(node -e 'console.log(require.resolve(process.argv[1], { paths: [process.argv[2]] }))' "$package_name" "$install_dir")"
    if node benchmarks/run.js \
      --suite implementation-comparison \
      --implementation "$label" \
      --module "$module_path" \
      --iterations 5 \
      --warmup 1 \
      --compare-runs 3 \
      --messages 10 \
      --output "$output"; then
      return
    fi
    reason="installed but benchmark API is incompatible"
  else
    reason="package is unavailable on Node $(node --version)"
  fi
  node benchmarks/unsupported-result.js "$label" "$output" "$reason"
}

case "${1:-}" in
  legacy)
    benchmark_implementation 'Koush wrtc 0.4.7' 'wrtc@0.4.7' 'wrtc' 'koush-wrtc'
    ;;
  current)
    benchmark_implementation '@roamhq/wrtc 0.10.0' '@roamhq/wrtc@0.10.0' '@roamhq/wrtc' 'roamhq-wrtc'
    benchmark_implementation 'werift 0.24.4' 'werift@0.24.4' 'werift' 'werift'
    ;;
  *)
    echo "Usage: $0 <legacy|current>" >&2
    exit 2
    ;;
esac
