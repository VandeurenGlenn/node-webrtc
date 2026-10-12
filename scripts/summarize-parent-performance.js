import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function summarizeParentPerformance(result) {
  if (!/^[a-f0-9]{40}$/.test(result.meta.baselineRef) || result.meta.pairedBaseline !== true) {
    throw new Error("Parent summary requires paired results against a full parent SHA, not a release baseline");
  }
  const rows = ["## Paired Linux performance versus direct parent", "",
    `Parent: ${result.meta.baselineRef}. Same runner and Node version; ${result.meta.compareRuns} alternating pairs.`, "",
    "Positive throughput / negative latency changes are favorable. Intervals crossing zero are inconclusive.", "",
    "| Metric | Change | 95% interval | Evidence |", "| --- | ---: | ---: | --- |"];
  let improvement = false;
  let regression = false;
  for (const [name, metric] of Object.entries(result.comparison)) {
    const favorable = metric.lowerIsBetter ? metric.deltaPercent < 0 : metric.deltaPercent > 0;
    const evidence = !metric.significant ? "Inconclusive" : favorable ? "Improvement" : "Regression";
    improvement ||= metric.significant && favorable;
    regression ||= metric.significant && !favorable;
    rows.push(`| ${name} | ${metric.deltaPercent}% | ${metric.confidenceLowPercent}% to ${metric.confidenceHighPercent}% | ${evidence} |`);
  }
  rows.push("", regression ? "Do not promote: statistically significant regression detected." :
    improvement ? "Some metrics improve; inconclusive metrics do not prove non-regression. Review before promotion." :
      "No statistically demonstrated improvement. Do not promote as a speedup.");
  return rows.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = summarizeParentPerformance(JSON.parse(readFileSync(process.argv[2], "utf8")));
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
