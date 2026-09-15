#!/usr/bin/env node

import { chmodSync, existsSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const download = resolve("build/external/libwebrtc/download");
const source = join(download, "src");
const alias = join(download, "webrtc");

if (!existsSync(source)) {
  throw new Error(`WebRTC artifact source tree is missing: ${source}`);
}

if (!existsSync(alias)) {
  symlinkSync(process.platform === "win32" ? source : "src", alias,
    process.platform === "win32" ? "junction" : "dir");
}

if (process.platform === "linux") {
  const linker = join(source, "third_party/llvm-build/Release+Asserts/bin/ld.lld");
  if (!existsSync(linker)) {
    throw new Error(`WebRTC artifact linker is missing: ${linker}`);
  }
  chmodSync(linker, 0o755);
}

console.log(`Prepared WebRTC source alias ${alias}`);
