#!/usr/bin/env node

import { spawnSync } from "child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { nativePlatforms } from "./native-platforms.js";

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootPackageJson = require("../package.json");

const githubUrl =
  "https://github.com/VandeurenGlenn/node-webrtc/blob/v" +
  rootPackageJson.version;

const paths = [
  "lib",
  "LICENSE.md",
  "README.md",
  "THIRD_PARTY_LICENSES.md",
];

const jsonFields = [
  "name",
  "description",
  "keywords",
  "type",
  "version",
  "author",
  "homepage",
  "bugs",
  "license",
  "repository",
  "main",
  "types",
  "exports",
  "browser",
  "engines",
];

const relativeLinks = ["docs/build-from-source.md", "docs/nonstandard-apis.md"];

async function main() {
  const { name } = rootPackageJson;
  const packageDirectory = await mkdtemp(
    join(tmpdir(), `${name.replaceAll("/", "-")}-`),
  );

  await Promise.all(
    paths.map(async (path) => {
      const src = join(__dirname, "..", path);
      const dst = join(packageDirectory, path);
      await cp(src, dst, { recursive: true });
    }),
  );

  const packageJson = require("../npm/package.json");
  jsonFields.forEach((jsonField) => {
    packageJson[jsonField] = rootPackageJson[jsonField];
  });
  delete packageJson.bundleDependencies;
  delete packageJson.bundledDependencies;
  packageJson.optionalDependencies = Object.fromEntries(
    nativePlatforms.map(({ packageName }) => [
      packageName,
      rootPackageJson.version,
    ]),
  );
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  const readme = relativeLinks.reduce(
    (readme, relativeLink) => {
      const regexp = new RegExp(
        "(" + relativeLink.replace(/\./g, "\\.") + ")",
        "g",
      );
      return readme.replace(regexp, githubUrl + "/$1");
    },
    (await readFile(join(__dirname, "..", "README.md"))).toString(),
  );

  await writeFile(join(packageDirectory, "README.md"), readme);

  const packIndex = process.argv.indexOf("--pack");
  const packDestination = packIndex === -1 ? null : process.argv[packIndex + 1];
  if (packIndex !== -1 && !packDestination) {
    throw new Error("--pack requires a destination directory");
  }
  const publishArgs = packDestination
    ? ["pack", "--pack-destination", packDestination]
    : ["publish", "--access", "public"];
  if (process.argv.includes("--dry-run")) {
    publishArgs.push("--dry-run");
  }
  if (!packDestination && process.argv.includes("--provenance")) {
    publishArgs.push("--provenance");
  }
  if (packDestination) {
    await mkdir(packDestination, { recursive: true });
  }
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, publishArgs, {
    encoding: "utf8",
    cwd: packageDirectory,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  await rm(packageDirectory, { recursive: true, force: true });
  if (
    result.status &&
    !packDestination &&
    /cannot publish over (?:the )?previously published versions/i.test(
      `${result.stdout}\n${result.stderr}`,
    )
  ) {
    console.log(`${name}@${rootPackageJson.version} is already published`);
    return;
  }
  if (result.status) {
    throw new Error(packDestination ? "npm pack failed" : "npm publish failed");
  }
}

main();
