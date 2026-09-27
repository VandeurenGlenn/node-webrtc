#!/usr/bin/env node

import { spawnSync } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { nativePlatforms } from "./native-platforms.js";

const require = createRequire(import.meta.url);
const rootPackage = require("../package.json");

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function readPositiveInteger(name, fallback) {
  const value = Number(readOption(name, fallback));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function registryPackageUrl(registry, packageName) {
  return `${registry.replace(/\/$/, "")}/${encodeURIComponent(packageName)}`;
}

export async function releaseIsVisible(
  registry,
  packageName,
  version,
  fetchImplementation = fetch,
) {
  const response = await fetchImplementation(
    registryPackageUrl(registry, packageName),
    {
    cache: "no-store",
    headers: { accept: "application/json" },
    },
  );
  if (!response.ok) {
    return false;
  }

  const metadata = await response.json();
  return Boolean(
    metadata.versions?.[version] && metadata["dist-tags"]?.latest === version,
  );
}

export async function waitForRelease({
  packages,
  registry,
  timeoutMs,
  version,
  check = releaseIsVisible,
  now = Date.now,
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
}) {
  const startedAt = now();
  let delayMs = 2_000;
  let pending = packages;

  while (pending.length > 0) {
    const checks = await Promise.all(
      pending.map(async (packageName) => {
        try {
          return {
            packageName,
            visible: await check(registry, packageName, version),
          };
        } catch (error) {
          console.warn(`Could not query ${packageName}: ${error.message}`);
          return { packageName, visible: false };
        }
      }),
    );
    pending = checks
      .filter(({ visible }) => !visible)
      .map(({ packageName }) => packageName);

    if (pending.length === 0) {
      return;
    }

    const elapsedMs = now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new Error(
        `npm did not expose ${version} as latest for: ${pending.join(", ")}`,
      );
    }

    console.log(
      `Waiting for npm (${Math.round(elapsedMs / 1_000)}s): ${pending.join(", ")}`,
    );
    await sleep(Math.min(delayMs, timeoutMs - elapsedMs));
    delayMs = Math.min(delayMs * 2, 15_000);
  }
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status) {
    throw new Error(`${command} ${args[0]} failed`);
  }
}

export async function verifyRegistryInstall({ registry, version }) {
  const directory = await mkdtemp(join(tmpdir(), "wrtc-npm-release-"));
  try {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    run(
      npmCommand,
      [
        "install",
        "--prefix",
        directory,
        "--ignore-scripts=false",
        "--prefer-online",
        "--cache",
        join(directory, "npm-cache"),
        "--registry",
        registry,
        `${rootPackage.name}@${version}`,
      ],
      { cwd: directory },
    );
    run(
      process.execPath,
      [
        "-e",
        "const wrtc=require('@vandeurenglenn/wrtc');" +
          "const pc=new wrtc.RTCPeerConnection();" +
          "pc.close();" +
          "console.log('Public npm release loaded successfully');",
      ],
      { cwd: directory },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const version = readOption("--version", rootPackage.version);
  const registry = readOption(
    "--registry",
    process.env.npm_config_registry || "https://registry.npmjs.org",
  );
  const timeoutMs = readPositiveInteger("--timeout-ms", 10 * 60 * 1_000);
  const packages = [
    rootPackage.name,
    ...nativePlatforms.map(({ packageName }) => packageName),
  ];

  await waitForRelease({ packages, registry, timeoutMs, version });
  console.log(`All npm packages expose ${version} as latest`);
  await verifyRegistryInstall({ registry, version });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
