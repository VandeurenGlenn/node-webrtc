#!/usr/bin/env node

import { spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const copy = require("recursive-copy");
const temp = require("temp");
const rootPackageJson = require("../package.json");

temp.track();

const githubUrl =
  "https://github.com/VandeurenGlenn/node-webrtc/blob/v" +
  rootPackageJson.version;

const paths = [
  "lib",
  "scripts/download-prebuilt.js",
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
  "browser",
  "binary",
  "engines",
  "dependencies",
  "optionalDependencies",
  "bundledDependencies",
];

const relativeLinks = ["docs/build-from-source.md", "docs/nonstandard-apis.md"];

function mkTmpDir(dir) {
  return new Promise((resolve, reject) => {
    temp.mkdir(dir, (error, dir) => {
      if (error) {
        reject(error);
      } else {
        resolve(dir);
      }
    });
  });
}

async function main() {
  const { name } = rootPackageJson;
  const tmpDir = await mkTmpDir(name);

  await Promise.all(
    paths.map(async (path) => {
      const src = join(__dirname, "..", path);
      const dst = join(tmpDir, path);
      await copy(src, dst);
    }),
  );

  const packageJson = require("../npm/package.json");
  jsonFields.forEach((jsonField) => {
    packageJson[jsonField] = rootPackageJson[jsonField];
  });
  writeFileSync(
    join(tmpDir, "package.json"),
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
    readFileSync(join(__dirname, "..", "README.md")).toString(),
  );

  writeFileSync(join(tmpDir, "README.md"), readme);

  const publishArgs = ["publish", "--access", "public"];
  if (process.argv.includes("--dry-run")) {
    publishArgs.push("--dry-run");
  }
  const { status } = spawnSync("npm", publishArgs, {
    shell: true,
    stdio: "inherit",
    cwd: tmpDir,
  });
  if (status) {
    throw new Error("npm publish failed");
  }
}

main();
