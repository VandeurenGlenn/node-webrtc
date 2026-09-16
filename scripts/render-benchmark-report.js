"use strict";

import fs from "node:fs";
import path from "node:path";

const inputDirectory = process.argv[2] || "benchmark-artifacts";
const outputDirectory = process.argv[3] || "benchmark-report";

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
  const sign = comparison.deltaPercent > 0 ? "+" : "";
  return {
    icon: comparison.regression ? "🔴" : "🟢",
    text: `${sign}${comparison.deltaPercent.toFixed(2)}%`,
    className: comparison.regression ? "regression" : "improvement",
  };
}

const results = findJsonFiles(inputDirectory)
  .map((file) => JSON.parse(fs.readFileSync(file, "utf8")))
  .sort((a, b) => `${a.meta.platform}-${a.meta.arch}`.localeCompare(`${b.meta.platform}-${b.meta.arch}`));

if (results.length === 0) {
  throw new Error(`No benchmark JSON files found under ${inputDirectory}`);
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
    const comparison = result.comparison?.[name];
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
    const comparison = result.comparison?.[name];
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
    </section>`;
  }).join("\n");
  return `<article class="card"><h2>${escapeHtml(result.meta.platform)} / ${escapeHtml(result.meta.arch)}</h2><p>Node ${escapeHtml(result.meta.node)} · commit ${escapeHtml(result.meta.commit)}</p>${rows}</article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>node-webrtc benchmarks</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#0d1117;color:#e6edf3}body{max-width:1200px;margin:auto;padding:40px 20px}h1{margin-bottom:4px}.intro{color:#8b949e;margin-top:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px}.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px}.card>p{color:#8b949e}.scenario{border-top:1px solid #30363d;padding:14px 0}.scenario h3{font-size:14px}.bar-row{display:grid;grid-template-columns:65px 1fr 82px;gap:8px;align-items:center;font-size:12px;margin:7px 0}.track{height:10px;background:#21262d;border-radius:5px;overflow:hidden}.track i{display:block;height:100%;border-radius:5px}.current{background:#58a6ff}.baseline{background:#8b949e}.bar-row strong{text-align:right}.delta{margin:6px 0 0;font-weight:700}.improvement{color:#3fb950}.regression{color:#f85149}.pending{color:#8b949e}footer{color:#8b949e;margin-top:24px}
</style></head><body><h1>node-webrtc benchmarks</h1><p class="intro">Lower is better. Current commit compared with the latest successful develop build on identical runner architecture.</p><main class="grid">${cards}</main><footer>Generated ${escapeHtml(new Date().toISOString())}</footer></body></html>`;

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "summary.md"), `${markdown.join("\n")}\n`);
fs.writeFileSync(path.join(outputDirectory, "index.html"), html);
console.log(markdown.join("\n"));
