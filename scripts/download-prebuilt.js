#!/usr/bin/env node
/* eslint no-process-env:0, no-process-exit:0 */

import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

function main(exit) {
  const args = ["install"];

  if (process.env.DEBUG) {
    args.push("--debug");
  }

  if (process.env.TARGET_ARCH) {
    args.push("--target_arch=" + process.env.TARGET_ARCH);
  }

  let { status } = spawnSync("node-pre-gyp", args, {
    shell: true,
    stdio: "inherit",
  });
  if (status) {
    if (!exit) {
      throw new Error(status);
    }

    process.exit(1);
  }
}

export default main;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(true);
}
