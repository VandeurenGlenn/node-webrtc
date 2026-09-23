#!/usr/bin/env node

import { closeSync, openSync } from "fs";
import { cp, mkdir, readdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { nativePlatforms, packageDirectoryName } from "./native-platforms.js";

const require = createRequire(import.meta.url);
const rootPackage = require("../package.json");

async function findArchive(root, expectedName) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const entry = entries.find(
    (candidate) => candidate.isFile() && candidate.name === expectedName,
  );
  if (!entry) {
    throw new Error(`Missing native archive: ${expectedName}`);
  }
  return join(entry.parentPath, entry.name);
}

function extractAddon(archive, destination) {
  const output = openSync(destination, "w");
  const result = spawnSync("tar", ["-xOf", archive, "Release/wrtc.node"], {
    stdio: ["ignore", output, "inherit"],
  });
  closeSync(output);
  if (result.status) {
    throw new Error(`Could not extract Release/wrtc.node from ${archive}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const [assetsDirectory, outputDirectory] = args;
  const versionIndex = args.indexOf("--version");
  const version =
    versionIndex === -1 ? rootPackage.version : args[versionIndex + 1];
  if (!assetsDirectory || !outputDirectory) {
    throw new Error(
      `usage: ${basename(process.argv[1])} RELEASE_ASSETS OUTPUT_DIRECTORY`,
    );
  }
  if (!version) {
    throw new Error("--version requires a version");
  }

  await mkdir(outputDirectory, { recursive: true });
  for (const target of nativePlatforms) {
    const archiveName =
      `wrtc-v${version}-napi-v3-` +
      `${target.platform}-${target.arch}.tar.gz`;
    const archive = await findArchive(assetsDirectory, archiveName);
    const packageDirectory = join(
      outputDirectory,
      packageDirectoryName(target.packageName),
    );
    await mkdir(packageDirectory, { recursive: true });
    extractAddon(archive, join(packageDirectory, "wrtc.node"));
    await cp("LICENSE.md", join(packageDirectory, "LICENSE.md"));
    await writeFile(
      join(packageDirectory, "README.md"),
      `# ${target.packageName}\n\n` +
        `Native ${target.platform}/${target.arch} binary for ` +
        `[@vandeurenglenn/wrtc](https://www.npmjs.com/package/@vandeurenglenn/wrtc).\n`,
    );
    await writeFile(
      join(packageDirectory, "package.json"),
      `${JSON.stringify(
        {
          name: target.packageName,
          version,
          description: `Native ${target.platform}/${target.arch} binary for @vandeurenglenn/wrtc`,
          license: rootPackage.license,
          repository: rootPackage.repository,
          engines: rootPackage.engines,
          os: [target.platform],
          cpu: [target.arch],
          main: "./wrtc.node",
          files: ["wrtc.node", "LICENSE.md", "README.md"],
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Prepared ${target.packageName}@${version}`);
  }
}

main();
