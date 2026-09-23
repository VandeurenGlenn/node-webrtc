#!/usr/bin/env node

import { readFileSync } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { spawnSync } from "child_process";
import { nativePlatforms, packageDirectoryName } from "./native-platforms.js";

function runNpm(args, cwd, { allowPublished = false } = {}) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (
    result.status &&
    allowPublished &&
    /cannot publish over (?:the )?previously published versions/i.test(
      `${result.stdout}\n${result.stderr}`,
    )
  ) {
    console.log(`Skipping the already published package in ${cwd}`);
    return;
  }
  if (result.status) {
    throw new Error(`npm ${args[0]} failed in ${cwd}`);
  }
}

function packageAlreadyPublished(packageDirectory) {
  const packageJson = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    command,
    ["view", `${packageJson.name}@${packageJson.version}`, "version", "--json"],
    { stdio: "ignore" },
  );
  if (result.status === 0) {
    console.log(`Skipping published ${packageJson.name}@${packageJson.version}`);
    return true;
  }
  return false;
}

async function main() {
  const packagesIndex = process.argv.indexOf("--packages");
  const packagesDirectory = process.argv[packagesIndex + 1];
  if (packagesIndex === -1 || !packagesDirectory) {
    throw new Error("--packages requires a directory");
  }
  const packIndex = process.argv.indexOf("--pack");
  const packDestination = packIndex === -1 ? null : process.argv[packIndex + 1];
  if (packIndex !== -1 && !packDestination) {
    throw new Error("--pack requires a destination directory");
  }
  if (packDestination) {
    await mkdir(packDestination, { recursive: true });
  }

  for (const target of nativePlatforms) {
    const packageDirectory = join(
      packagesDirectory,
      packageDirectoryName(target.packageName),
    );
    if (packDestination) {
      runNpm(["pack", "--pack-destination", packDestination], packageDirectory);
      continue;
    }
    if (packageAlreadyPublished(packageDirectory)) {
      continue;
    }
    const args = ["publish", "--access", "public"];
    if (process.argv.includes("--provenance")) {
      args.push("--provenance");
    }
    runNpm(args, packageDirectory, { allowPublished: true });
  }
}

main();
