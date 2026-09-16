# Benchmarking

This repository includes a repeatable benchmark runner for tracking performance changes over time.

## What it measures

- `pc_create_close_ms`: Time to create and close an `RTCPeerConnection`.
- `pc_negotiate_datachannel_open_ms`: Time from start of negotiation to both data channels being open.
- `datachannel_unordered_unreliable_rtt_ms`: Average RTT for unordered/unreliable DataChannel ping/echo.
- `datachannel_unordered_unreliable_binary_rtt_ms`: Average RTT for binary unordered/unreliable DataChannel ping/echo.

All metrics are lower-is-better.

## Commands

The benchmark flow requires Node.js 20 or newer and a built or installed native
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

The first `develop` build for a platform establishes its baseline, so an
earlier pull request can show `baseline pending`.

## Notes

- Benchmark output is written to `benchmarks/results/*.json` (ignored by Git).
- Baseline is `benchmarks/baseline.json` (tracked unless you choose otherwise).
- Run on a quiet machine for less noisy numbers.
