#!/usr/bin/env node

import { existsSync } from "fs";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const root = fileURLToPath(new URL("..", import.meta.url));
const buildDirectory = join(root, "build");
const addon = join(buildDirectory, "Release", "wrtc.node");
const stage = join(buildDirectory, "stage");
const archive = join(
  stage,
  `wrtc-v${packageJson.version}-napi-v3-${process.platform}-${process.arch}.tar.gz`,
);

if (!existsSync(addon)) {
  throw new Error(`Native addon does not exist: ${addon}`);
}

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const result = spawnSync(
  process.platform === "win32" ? "tar.exe" : "tar",
  ["-czf", archive, "-C", buildDirectory, "Release/wrtc.node"],
  { stdio: "inherit" },
);
if (result.status) {
  throw new Error("Could not package the native addon");
}
console.log(archive);
