#!/usr/bin/env node
/* eslint no-console:0, no-process-env:0 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const args = ["configure"];

const generator =
  process.env.CMAKE_GENERATOR ||
  (process.platform === "win32"
    ? process.env.GITHUB_ACTIONS || process.env.CI
      ? "Ninja"
      : "Visual Studio 16 2019"
    : undefined);

const generatorArg =
  generator && generator.includes(" ") ? `"${generator}"` : generator;

if (process.env.DEBUG) {
  args.push("--debug");
}

if (generatorArg) {
  args.push("-g");
  args.push(generatorArg);
}

function main() {
  console.log("Running ncmake " + args.join(" "));
  let { status } = spawnSync("ncmake", args, {
    shell: true,
    stdio: "inherit",
  });
  if (status) {
    throw new Error("ncmake configure failed for wrtc");
  }

  console.log("Running ncmake build");
  status = spawnSync("ncmake", ["build"], {
    shell: true,
    stdio: "inherit",
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
