"use strict";

import fs from "node:fs";
import path from "node:path";

const [implementation, output, reason = "unsupported"] = process.argv.slice(2);

if (!implementation || !output) {
  throw new Error("Usage: node benchmarks/unsupported-result.js <implementation> <output> [reason]");
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({
  meta: {
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    commit: process.env.GITHUB_SHA || "unknown",
    implementation,
    suite: "implementation-comparison",
  },
  status: "unsupported",
  reason,
  scenarios: {},
}, null, 2)}\n`);
