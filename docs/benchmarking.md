# Benchmarking

This repository includes a repeatable benchmark runner for tracking performance changes over time.

## What it measures

- `pc_create_close_ms`: Time to create and close an `RTCPeerConnection`.
- `pc_negotiate_datachannel_open_ms`: Time from start of negotiation to both data channels being open.
- `datachannel_unordered_unreliable_rtt_ms`: Average RTT for unordered/unreliable DataChannel ping/echo.

All metrics are lower-is-better.

## Commands

The benchmark flow is validated on Node 16 (`v16.20.2`).

If you are on a newer Node version without a matching prebuilt binary, switch first:

```bash
nvm use 16.20.2
```

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

## Notes

- Benchmark output is written to `benchmarks/results/*.json` (ignored by Git).
- Baseline is `benchmarks/baseline.json` (tracked unless you choose otherwise).
- Run on a quiet machine for less noisy numbers.
