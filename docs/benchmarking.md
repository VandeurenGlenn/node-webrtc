# Benchmarking

This repository includes a repeatable benchmark runner for tracking performance changes over time.

## What it measures

- `pc_create_close_ms`: Time to create and close an `RTCPeerConnection`.
- `pc_negotiate_datachannel_open_ms`: Time from start of negotiation to both data channels being open.
- `datachannel_unordered_unreliable_rtt_ms`: Average RTT for unordered/unreliable DataChannel ping/echo.
- `datachannel_unordered_unreliable_binary_rtt_ms`: Average RTT for binary unordered/unreliable DataChannel ping/echo.

All metrics are lower-is-better.

## Commands

The benchmark flow requires Node.js 24.15 or newer and a built or installed native
addon.

Run a benchmark and store timestamped results:

```bash
npm run bench
```

Create/update a baseline snapshot:

```bash
npm run bench:baseline
```

Compare current run against baseline and fail if any metric regresses by more than 5%:

```bash
npm run bench:compare
```

## Useful flags

You can tune runtime and sensitivity:

```bash
node benchmarks/run.js --iterations 40 --warmup 10 --messages 150
node benchmarks/run.js --baseline benchmarks/baseline.json --regression-threshold 3 --fail-on-regression
```

## Suggested workflow

1. Build the branch in release mode.
2. Run `npm run bench:baseline` on a known-good revision.
3. While iterating, run `npm run bench` to gather timestamped snapshots.
4. Before merging, run `npm run bench:compare`.
5. Treat regressions as a prompt to investigate, rerun, and confirm.

## CI reports

Pull requests run a stable benchmark on Linux, macOS, and Windows. Each result
is compared with the latest successful `develop` run from the same operating
system and architecture. This avoids invalid comparisons between different
GitHub runner types.

Open the **Visual benchmark report** job in GitHub Actions to see the combined
comparison table. The same job publishes a `benchmark-dashboard` artifact with
a self-contained HTML report. Individual platform JSON results are retained as
workflow artifacts for 90 days and become the baseline for subsequent pull
requests after they land on `develop`.

Successful `develop` builds also publish the report at
[vandeurenglenn.github.io/node-webrtc](https://vandeurenglenn.github.io/node-webrtc/).
The dashboard includes a per-scenario timeline built from up to 20 successful
`develop` workflow runs. Hover a point to see its commit and mean duration.
It also runs the shared DataChannel scenarios on Linux against Koush's legacy
`wrtc`, `@roamhq/wrtc`, and `werift`. Implementations that cannot install or
load on the current Node.js release are shown as unsupported instead of making
the primary build fail.

Koush `wrtc@0.4.7` is run separately on Node.js 14.21.3, its final supported
Node.js release line. The dashboard labels its runtime explicitly; that result
is a legacy reference and is not treated as a runtime-equivalent comparison
with the implementations benchmarked on Node.js 26.

The implementation comparison ranks median duration and shows each result's
distance from the fastest implementation. Read the scenarios together:
creating and immediately closing a peer can favor implementations that defer
ICE, DTLS, SCTP, or native initialization until negotiation. Small differences
on shared GitHub runners should be confirmed over multiple runs before they
are treated as optimization targets.

The overall winner uses the geometric mean of normalized scenario ratios. Each
scenario therefore has equal weight regardless of its millisecond scale. Only
implementations measured on the same Node.js version as this project are
eligible; legacy-runtime results remain visible but do not affect the title.

The suite measures both latency and sustained delivery. Latency scenarios are
reported in milliseconds (lower is better). Text throughput is messages per
second and binary throughput is MiB per second (higher is better). Throughput
uses an already-open, ordered DataChannel so setup time does not distort steady
state delivery. All warmups and samples in one comparison pass reuse that
connection; teardown happens after the pass and outside the measured interval.
`pc_create_close_ms` covers the lightweight lifecycle, while
`pc_negotiate_datachannel_open_ms` covers the full connection path through an
open SCTP DataChannel.

For native profiling, use `npm run bench:profile:linux` with `perf` or
`npm run bench:profile:macos` with Instruments' Time Profiler. Release addon
builds can opt into link-time optimization with
`cmake -DWRTC_ENABLE_LTO=ON`; it remains opt-in because compiler and linker
support must match on every release platform.

Pass `--scenario <name>` one or more times to restrict a local run or profiler
capture to specific scenarios. CI stores the Linux binary-throughput
`perf.data`, a text report, and the corresponding benchmark JSON as
downloadable artifacts. Its bounded workload measures ten batches of 5,000
binary messages at 499 Hz, yielding enough samples for native hotspot
attribution without an open-ended profiling job.

Pull requests compare against the latest verified benchmark artifact whose Git
tree matches `develop`. Merging does not rerun builds, tests, WPT, sanitizers,
or benchmarks: the lightweight `develop` workflow publishes the already
verified PR dashboard. Each reused artifact requires its producer job to have
succeeded, so an unrelated external-service failure cannot discard valid
results or admit output from a failed platform job. An earlier pull request can
show `baseline pending` until a matching verified result exists.

## Notes

- Benchmark output is written to `benchmarks/results/*.json` (ignored by Git).
- Baseline is `benchmarks/baseline.json` (tracked unless you choose otherwise).
- Run on a quiet machine for less noisy numbers.
