"use strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function takeOption(args, name, fallback = "") {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function stddev(values) {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function sampleStddev(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const squaredDifferences = values.reduce(
    (sum, value) => sum + (value - average) ** 2,
    0,
  );
  return Math.sqrt(squaredDifferences / (values.length - 1));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function summarize(results, scenarioName) {
  const scenarios = results.map((result) => result.scenarios[scenarioName]);
  const samples = scenarios.flatMap((scenario) => scenario.samples || [scenario.mean]);
  const average = mean(samples);
  const sorted = samples.slice().sort((a, b) => a - b);
  return {
    min: round(Math.min(...samples)),
    max: round(Math.max(...samples)),
    mean: round(average),
    median: round(median(samples)),
    p95: round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]),
    stddev: round(stddev(samples)),
    samples: samples.map((sample) => round(sample)),
    runs: results.length,
    unit: scenarios[0].unit,
    lowerIsBetter: scenarios[0].lowerIsBetter,
  };
}

// Student's t critical values for a two-sided 95% interval. Three or more
// pairs are required so a single lucky runner sample cannot claim a win.
const tCritical95 = [Infinity, Infinity, 12.706, 4.303, 3.182, 2.776, 2.571];

function compare(candidateResults, baselineResults, scenarioName, threshold) {
  const deltas = candidateResults.map((candidate, index) => {
    const current = candidate.scenarios[scenarioName].mean;
    const baseline = baselineResults[index].scenarios[scenarioName].mean;
    return baseline === 0 ? 0 : ((current - baseline) / baseline) * 100;
  });
  const deltaPercent = mean(deltas);
  const degreesOfFreedom = deltas.length - 1;
  const critical = tCritical95[degreesOfFreedom] || 1.96;
  const margin = critical * sampleStddev(deltas) / Math.sqrt(deltas.length);
  const confidenceLow = deltaPercent - margin;
  const confidenceHigh = deltaPercent + margin;
  const significant = confidenceLow > 0 || confidenceHigh < 0;
  const current = summarize(candidateResults, scenarioName);
  const baseline = summarize(baselineResults, scenarioName);
  const lowerIsBetter = current.lowerIsBetter !== false;
  return {
    baselineMean: baseline.mean,
    currentMean: current.mean,
    deltaMs: round(current.mean - baseline.mean),
    deltaPercent: round(deltaPercent, 2),
    confidenceLowPercent: round(confidenceLow, 2),
    confidenceHighPercent: round(confidenceHigh, 2),
    significanceThresholdPercent: round(margin, 2),
    significant,
    paired: true,
    pairs: deltas.length,
    lowerIsBetter,
    regression: significant && (lowerIsBetter
      ? deltaPercent > threshold
      : deltaPercent < -threshold),
  };
}

const args = process.argv.slice(2);
const baselineAddonOption = takeOption(args, "--baseline-addon");
const baselineAddon = baselineAddonOption
  ? path.resolve(baselineAddonOption)
  : "";
const candidateAddon = path.resolve(
  takeOption(args, "--candidate-addon", "build/Release/wrtc.node"),
);
const outputOption = takeOption(args, "--output");
const output = outputOption ? path.resolve(outputOption) : "";
const pairs = Number.parseInt(takeOption(args, "--pairs", "3"), 10);
const threshold = Number.parseFloat(
  takeOption(args, "--regression-threshold", "5"),
);

if (!baselineAddon || !fs.existsSync(baselineAddon)) {
  throw new Error(`Baseline addon not found: ${baselineAddon}`);
}
if (!fs.existsSync(candidateAddon)) {
  throw new Error(`Candidate addon not found: ${candidateAddon}`);
}
if (!output) throw new Error("--output is required");
if (!Number.isInteger(pairs) || pairs < 3) throw new Error("--pairs must be >= 3");

const activeAddon = path.resolve("build/Release/wrtc.node");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wrtc-paired-"));
const savedCandidate = path.join(temporaryDirectory, "candidate.node");
fs.copyFileSync(candidateAddon, savedCandidate);

const candidateResults = [];
const baselineResults = [];

function runOne(label, addon, pair) {
  fs.mkdirSync(path.dirname(activeAddon), { recursive: true });
  fs.copyFileSync(addon, activeAddon);
  const resultPath = path.join(temporaryDirectory, `${label}-${pair}.json`);
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("benchmarks/run.js"),
      ...args,
      "--compare-runs",
      "1",
      "--output",
      resultPath,
    ],
    { encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] },
  );
  if (child.status !== 0) {
    throw new Error(`${label} benchmark pair ${pair + 1} failed`);
  }
  return JSON.parse(fs.readFileSync(resultPath, "utf8"));
}

try {
  for (let pair = 0; pair < pairs; pair += 1) {
    if (pair % 2 === 0) {
      baselineResults.push(runOne("baseline", baselineAddon, pair));
      candidateResults.push(runOne("candidate", savedCandidate, pair));
    } else {
      candidateResults.push(runOne("candidate", savedCandidate, pair));
      baselineResults.push(runOne("baseline", baselineAddon, pair));
    }
  }
} finally {
  fs.copyFileSync(savedCandidate, activeAddon);
}

const scenarioNames = Object.keys(candidateResults[0].scenarios);
const scenarios = Object.fromEntries(
  scenarioNames.map((name) => [name, summarize(candidateResults, name)]),
);
const comparison = Object.fromEntries(
  scenarioNames.map((name) => [
    name,
    compare(candidateResults, baselineResults, name, threshold),
  ]),
);
const result = {
  meta: {
    ...candidateResults[0].meta,
    timestamp: new Date().toISOString(),
    compareRuns: pairs,
    pairedBaseline: true,
  },
  scenarios,
  comparison,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Saved paired benchmark comparison: ${output}`);
