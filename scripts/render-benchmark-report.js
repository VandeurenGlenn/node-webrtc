"use strict";

import fs from "node:fs";
import path from "node:path";

const inputDirectory = process.argv[2] || "benchmark-artifacts";
const outputDirectory = process.argv[3] || "benchmark-report";
const historyDirectory = process.argv[4] || "benchmark-history";

function findJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findJsonFiles(entryPath);
    }
    return entry.name.endsWith(".json") ? [entryPath] : [];
  });
}

function loadBenchmarkResults(directory) {
  return findJsonFiles(directory)
    .map((file) => JSON.parse(fs.readFileSync(file, "utf8")))
    .filter((result) => result?.meta?.platform
      && result.meta.arch
      && result.scenarios
      && typeof result.scenarios === "object");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function labelScenario(name) {
  return name
    .replace(/_ms$/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deltaDisplay(comparison) {
  if (!comparison || comparison.baselineMissing) {
    return { icon: "⚪", text: "baseline pending", className: "pending" };
  }
  const magnitude = Math.abs(comparison.deltaPercent).toFixed(2);
  if (Math.abs(comparison.deltaPercent) < 0.5) {
    return { icon: "●", text: `${magnitude}% unchanged`, className: "pending" };
  }
  const slower = comparison.deltaPercent > 0;
  return {
    icon: slower ? "↑" : "↓",
    text: `${magnitude}% ${slower ? "slower" : "faster"}`,
    className: slower ? "regression" : "improvement",
  };
}

function comparisonFor(result, scenarioName) {
  if (result.comparison?.[scenarioName]) {
    return result.comparison[scenarioName];
  }
  const previous = history.filter((candidate) =>
    candidate.meta.platform === result.meta.platform
    && candidate.meta.arch === result.meta.arch
    && candidate.meta.commit !== result.meta.commit
    && typeof candidate.scenarios?.[scenarioName]?.mean === "number")
    .at(-1);
  if (!previous) return null;
  const baselineMean = previous.scenarios[scenarioName].mean;
  const currentMean = result.scenarios[scenarioName].mean;
  const deltaPercent = baselineMean === 0 ? 0 : ((currentMean - baselineMean) / baselineMean) * 100;
  return {
    baselineMean,
    currentMean,
    deltaPercent,
    regression: deltaPercent > 5,
  };
}

const currentResults = loadBenchmarkResults(inputDirectory)
  .sort((a, b) => `${a.meta.platform}-${a.meta.arch}`.localeCompare(`${b.meta.platform}-${b.meta.arch}`));
const results = currentResults.filter((result) => result.meta.suite !== "implementation-comparison");
const implementationResults = currentResults.filter((result) => result.meta.suite === "implementation-comparison");

if (results.length === 0) {
  throw new Error(`No benchmark JSON files found under ${inputDirectory}`);
}

const history = [...loadBenchmarkResults(historyDirectory), ...loadBenchmarkResults(inputDirectory)]
  .filter((result) => result.meta.suite !== "implementation-comparison")
  .filter((result, index, all) => all.findIndex((candidate) =>
    candidate.meta.platform === result.meta.platform
    && candidate.meta.arch === result.meta.arch
    && candidate.meta.commit === result.meta.commit) === index)
  .sort((a, b) => new Date(a.meta.timestamp) - new Date(b.meta.timestamp));

function renderTimeline(result, scenarioName) {
  const points = history.filter((item) => item.meta.platform === result.meta.platform
    && item.meta.arch === result.meta.arch
    && typeof item.scenarios?.[scenarioName]?.mean === "number");
  if (points.length < 2) {
    return '<p class="history-pending">History appears after two successful develop runs.</p>';
  }
  const width = 440;
  const height = 120;
  const padding = 18;
  const values = points.map((point) => point.scenarios[scenarioName].mean);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(maximum - minimum, maximum * 0.05, 0.001);
  const coordinates = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minimum) / range) * (height - padding * 2);
    return { x, y, value, point: points[index] };
  });
  const polyline = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dots = coordinates.map(({ x, y, value, point }) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"><title>${escapeHtml(point.meta.commit.slice(0, 8))}: ${value.toFixed(3)} ms</title></circle>`).join("");
  return `<svg class="timeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Benchmark history"><polyline points="${polyline}"></polyline>${dots}</svg>
    <div class="timeline-labels"><span>${escapeHtml(points[0].meta.commit.slice(0, 8))}</span><span>${points.length} runs</span><span>${escapeHtml(points.at(-1).meta.commit.slice(0, 8))}</span></div>`;
}

const markdown = [
  "## WebRTC benchmark comparison",
  "",
  "Lower values are better. Baselines are taken from the latest successful `develop` run on the same platform and architecture.",
  "",
];

for (const result of results) {
  markdown.push(
    `### ${result.meta.platform} / ${result.meta.arch}`,
    "",
    "| Scenario | Baseline mean | Current mean | Change |",
    "|---|---:|---:|---:|",
  );
  for (const [name, scenario] of Object.entries(result.scenarios)) {
    const comparison = comparisonFor(result, name);
    const delta = deltaDisplay(comparison);
    const baseline = comparison?.baselineMean ?? "—";
    markdown.push(
      `| ${labelScenario(name)} | ${baseline === "—" ? baseline : `${baseline.toFixed(3)} ms`} | ${scenario.mean.toFixed(3)} ms | ${delta.icon} ${delta.text} |`,
    );
  }
  markdown.push("");
}

const cards = results.map((result) => {
  const rows = Object.entries(result.scenarios).map(([name, scenario]) => {
    const comparison = comparisonFor(result, name);
    const delta = deltaDisplay(comparison);
    const baseline = comparison?.baselineMean;
    const maximum = Math.max(scenario.mean, baseline || 0, 0.001);
    const currentWidth = Math.max(2, (scenario.mean / maximum) * 100);
    const baselineWidth = baseline == null ? 0 : Math.max(2, (baseline / maximum) * 100);
    return `<section class="scenario">
      <h3>${escapeHtml(labelScenario(name))}</h3>
      <div class="bar-row"><span>Current</span><div class="track"><i class="current" style="width:${currentWidth}%"></i></div><strong>${scenario.mean.toFixed(3)} ms</strong></div>
      ${baseline == null ? "" : `<div class="bar-row"><span>Baseline</span><div class="track"><i class="baseline" style="width:${baselineWidth}%"></i></div><strong>${baseline.toFixed(3)} ms</strong></div>`}
      <p class="delta ${delta.className}">${delta.icon} ${escapeHtml(delta.text)}</p>
      ${renderTimeline(result, name)}
    </section>`;
  }).join("\n");
  return `<article class="card"><h2>${escapeHtml(result.meta.platform)} / ${escapeHtml(result.meta.arch)}</h2><p>Node ${escapeHtml(result.meta.node)} · commit ${escapeHtml(result.meta.commit)}</p>${rows}</article>`;
}).join("\n");

const supportedImplementations = implementationResults.filter((result) => result.status !== "unsupported");
const implementationScenarioNames = [...new Set(supportedImplementations.flatMap((result) => Object.keys(result.scenarios)))];
const projectResult = supportedImplementations.find((result) => result.meta.implementation === "@vandeurenglenn/wrtc");
const comparableImplementations = supportedImplementations.filter((result) =>
  result.meta.node === projectResult?.meta.node
  && implementationScenarioNames.every((name) => typeof result.scenarios[name]?.median === "number"));
const scenarioFastest = Object.fromEntries(implementationScenarioNames.map((name) => [
  name,
  Math.min(...comparableImplementations.map((result) => result.scenarios[name].median)),
]));
const overallRanking = comparableImplementations.map((result) => {
  const ratios = implementationScenarioNames.map((name) =>
    result.scenarios[name].median / scenarioFastest[name]);
  return {
    label: result.meta.implementation,
    node: result.meta.node,
    score: Math.exp(ratios.reduce((sum, ratio) => sum + Math.log(ratio), 0) / ratios.length),
  };
}).sort((a, b) => a.score - b.score);
const winningScore = overallRanking[0]?.score || 1;
const overallRows = overallRanking.map((entry, index) => {
  const relativeScore = entry.score / winningScore;
  const projectClass = entry.label === "@vandeurenglenn/wrtc" ? " project" : "";
  return `<div class="overall-row${projectClass}"><span>${index === 0 ? "🏆" : `#${index + 1}`} ${escapeHtml(entry.label)}<small>Node ${escapeHtml(entry.node)}</small></span><strong>${relativeScore.toFixed(2)}×<small>${index === 0 ? "overall winner" : "normalized cost"}</small></strong></div>`;
}).join("");
const overallWinner = overallRanking[0]?.label;
let projectWins = 0;
const implementationCharts = implementationScenarioNames.map((name) => {
  const entries = supportedImplementations
    .filter((result) => typeof result.scenarios[name]?.mean === "number")
    .map((result) => ({
      label: result.meta.implementation,
      node: result.meta.node,
      value: result.scenarios[name].median,
    }))
    .sort((a, b) => a.value - b.value);
  if (entries[0]?.label === "@vandeurenglenn/wrtc") projectWins += 1;
  const maximum = Math.max(...entries.map((entry) => entry.value), 0.001);
  const fastest = entries[0]?.value || 0;
  const rows = entries.map((entry, index) => {
    const slower = fastest === 0 ? 0 : ((entry.value - fastest) / fastest) * 100;
    const status = index === 0 ? "fastest" : `+${slower.toFixed(1)}%`;
    const projectClass = entry.label === "@vandeurenglenn/wrtc" ? " project" : "";
    return `<div class="implementation-row${projectClass}"><span><b>#${index + 1}</b> ${escapeHtml(entry.label)}<small>Node ${escapeHtml(entry.node)}</small></span><div class="track"><i class="implementation${index === 0 ? " winner" : ""}" style="width:${Math.max(2, (entry.value / maximum) * 100)}%"></i></div><strong>${entry.value.toFixed(3)} ms<small>${status}</small></strong></div>`;
  }).join("");
  return `<section class="implementation-scenario"><h3>${escapeHtml(labelScenario(name))}</h3>${rows}</section>`;
}).join("\n");
const unsupportedImplementations = implementationResults
  .filter((result) => result.status === "unsupported")
  .map((result) => `<li><strong>${escapeHtml(result.meta.implementation)}</strong>: ${escapeHtml(result.reason)}</li>`)
  .join("");
const implementationSection = implementationResults.length === 0 ? "" : `<section class="comparison"><h2>Node WebRTC implementation comparison</h2><p>Identical DataChannel scenarios on one Linux x64 runner. Lower is better; rankings use the median to reduce outlier bias.</p>${overallWinner ? `<div class="overall"><h3>Overall winner: ${escapeHtml(overallWinner)} 🏆</h3><p>Geometric mean of each implementation's ratio to the fastest result per scenario. A score of 1.00× is best.</p>${overallRows}</div>` : ""}<p class="score"><strong>@vandeurenglenn/wrtc wins ${projectWins} of ${implementationScenarioNames.length} individual scenarios.</strong> It is highlighted in blue; each row shows its rank and distance from the fastest implementation.</p><p class="method-note">Only implementations on Node ${escapeHtml(projectResult?.meta.node || "26")} are eligible for the overall title. Koush wrtc 0.4.7 is measured on legacy Node 14.21.3 because it does not load on Node 26; its result is a historical reference, not a strictly equivalent runtime comparison. Create/close alone is not an end-to-end score: implementations may defer ICE, DTLS, SCTP, or native initialization until negotiation. Shared GitHub runners also introduce noise, so small single-run differences should be confirmed across history before optimization.</p>${implementationCharts}${unsupportedImplementations ? `<h3>Unsupported</h3><ul>${unsupportedImplementations}</ul>` : ""}</section>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>node-webrtc benchmarks</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#0d1117;color:#e6edf3}body{max-width:1200px;margin:auto;padding:40px 20px}h1{margin-bottom:4px}.intro{color:#8b949e;margin-top:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}.card,.comparison{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px}.card>p,.comparison>p{color:#8b949e}.scenario,.implementation-scenario{border-top:1px solid #30363d;padding:14px 0}.scenario h3,.implementation-scenario h3{font-size:14px}.bar-row{display:grid;grid-template-columns:65px 1fr 82px;gap:8px;align-items:center;font-size:12px;margin:7px 0}.track{height:10px;background:#21262d;border-radius:5px;overflow:hidden}.track i{display:block;height:100%;border-radius:5px}.current{background:#58a6ff}.baseline{background:#8b949e}.implementation{background:#a371f7}.implementation.winner{background:#3fb950}.bar-row strong{text-align:right}.delta{margin:6px 0 0;font-weight:700}.improvement{color:#3fb950}.regression{color:#f85149}.pending,.history-pending{color:#8b949e}.timeline{display:block;width:100%;height:auto;margin-top:12px;background:#0d1117;border-radius:6px}.timeline polyline{fill:none;stroke:#58a6ff;stroke-width:2}.timeline circle{fill:#58a6ff;stroke:#0d1117;stroke-width:2}.timeline-labels{display:flex;justify-content:space-between;color:#8b949e;font-size:10px;margin-top:3px}.comparison{margin-top:24px}.overall{padding:16px;border:1px solid #3fb950;border-radius:10px;background:#0d1117}.overall h3{color:#3fb950;margin-top:0}.overall>p{color:#8b949e;font-size:13px}.overall-row{display:flex;justify-content:space-between;gap:20px;padding:8px;border-top:1px solid #21262d}.overall-row.project{color:#58a6ff}.overall-row small{display:block;color:#8b949e;font-weight:400}.overall-row strong{text-align:right}.score{padding:12px;border-radius:8px;background:#0d1117}.score strong{color:#58a6ff}.method-note{font-size:13px;border-left:3px solid #d29922;padding-left:10px}.implementation-row{display:grid;grid-template-columns:minmax(180px,250px) 1fr 105px;gap:10px;align-items:center;font-size:12px;margin:9px 0;padding:4px}.implementation-row.project{background:#1f2937;border-radius:6px}.implementation-row.project span{color:#58a6ff}.implementation-row span b{color:#8b949e}.implementation-row span small{display:block;color:#8b949e;margin-left:24px}.implementation-row strong{text-align:right}.implementation-row strong small{display:block;color:#8b949e;font-weight:400}footer{color:#8b949e;margin-top:24px}
</style></head><body><h1>node-webrtc benchmarks</h1><p class="intro">Lower is better. Current commit compared with the latest successful develop build on identical runner architecture.</p><main class="grid">${cards}</main>${implementationSection}<footer>Generated ${escapeHtml(new Date().toISOString())}</footer></body></html>`;

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "summary.md"), `${markdown.join("\n")}\n`);
fs.writeFileSync(path.join(outputDirectory, "index.html"), html);
console.log(markdown.join("\n"));
