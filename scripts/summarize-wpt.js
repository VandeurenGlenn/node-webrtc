"use strict";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import jsYaml from "js-yaml";

const require = createRequire(import.meta.url);
const { Minimatch } = require("minimatch");
const { summarizeResults } = require("../test/web-platform-tests/result-report.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wptRoot = path.join(root, "test", "web-platform-tests");
const manifest = JSON.parse(
  fs.readFileSync(path.join(wptRoot, "wpt-manifest.json"), "utf8"),
);
const documents = jsYaml.loadAll(
  fs.readFileSync(path.join(wptRoot, "to-run.yaml"), "utf8"),
);
const skippedReasons = new Set([
  "fail-slow",
  "timeout",
  "flaky",
  "mutates-globals",
]);

const testPaths = Object.values(manifest.items.testharness)
  .flatMap((entries) => entries.map((entry) => entry[0]))
  .filter((testPath) =>
    !testPath.endsWith(".worker.html")
    && !testPath.endsWith(".serviceworker.html")
    && !testPath.endsWith(".sharedworker.html"));

const summary = {
  total: 0,
  expectedPass: 0,
  expectedFail: 0,
  skipped: 0,
  reasons: {},
};

for (const document of documents) {
  const expectations = Object.entries(document)
    .filter(([key]) => key !== "DIR")
    .map(([pattern, value]) => ({
      matcher: new Minimatch(`${document.DIR}/${pattern}`),
      reason: value[0],
    }));

  for (const testPath of testPaths) {
    if (!testPath.startsWith(`${document.DIR}/`)) continue;
    const expectation = expectations.find(({ matcher }) => matcher.match(testPath));
    const reason = expectation?.reason;
    summary.total += 1;
    if (reason === "fail") {
      summary.expectedFail += 1;
    } else if (skippedReasons.has(reason)) {
      summary.skipped += 1;
    } else {
      summary.expectedPass += 1;
    }
    if (reason) {
      summary.reasons[reason] = (summary.reasons[reason] || 0) + 1;
    }
  }
}

if (process.argv[3] && fs.existsSync(process.argv[3])) {
  summary.observed = summarizeResults(JSON.parse(fs.readFileSync(process.argv[3], "utf8")));
}

const output = `${JSON.stringify(summary, null, 2)}\n`;
if (process.argv[2]) {
  fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true });
  fs.writeFileSync(process.argv[2], output);
} else {
  process.stdout.write(output);
}
