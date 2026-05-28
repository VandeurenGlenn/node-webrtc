#!/usr/bin/env node
/* eslint no-console:0, no-process-env:0 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const args = ["configure"];

if (process.env.DEBUG) {
  args.push("--debug");
}

if (process.platform === "win32") {
  args.push("-g");
  args.push('"Visual Studio 16 2019"');
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
