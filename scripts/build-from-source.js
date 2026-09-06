#!/usr/bin/env node
/* eslint no-console:0, no-process-env:0 */

import { spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const args = ["configure"];
const require = createRequire(import.meta.url);
const ncmake = require.resolve("node-cmake/lib/ncmake.js");

const generator =
  process.env.CMAKE_GENERATOR ||
  (process.platform === "win32"
    ? process.env.GITHUB_ACTIONS || process.env.CI
      ? "Ninja"
      : "Visual Studio 16 2019"
    : undefined);

if (process.env.DEBUG) {
  args.push("--debug");
}

if (generator) {
  args.push("-g");
  args.push(generator);
}

const buildEnv = { ...process.env };
if (process.platform === "linux") {
  const disableAvailability = "-D_LIBCPP_DISABLE_AVAILABILITY";
  const cxxflags = buildEnv.CXXFLAGS || "";
  if (!cxxflags.includes(disableAvailability)) {
    buildEnv.CXXFLAGS = cxxflags
      ? cxxflags + " " + disableAvailability
      : disableAvailability;
  }
}

function main() {
  console.log("Running ncmake " + args.join(" "));
  let { status } = spawnSync(process.execPath, [ncmake, ...args], {
    stdio: "inherit",
    env: buildEnv,
  });
  if (status) {
    throw new Error("ncmake configure failed for wrtc");
  }

  console.log("Running ncmake build");
  status = spawnSync(process.execPath, [ncmake, "build"], {
    stdio: "inherit",
    env: buildEnv,
  }).status;
  if (status) {
    throw new Error("ncmake build failed for wrtc");
  }

  console.log("Built wrtc");
}

export default main;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
