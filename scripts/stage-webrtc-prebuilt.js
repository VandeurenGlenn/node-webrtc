#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const source = join(root, "build/external/libwebrtc/download/src");
const output = join(root, ".webrtc-prebuilt");
const build = join(root, "build/external/libwebrtc/build/Release");
const headerExtensions = new Set([
  "", ".def", ".h", ".hh", ".hpp", ".inc", ".inl", ".ipp", ".tcc",
]);

function copyFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { dereference: true });
}

function copyHeaders(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const from = join(directory, entry.name);
    if (entry.isDirectory()) {
      copyHeaders(from);
    } else if (entry.isFile() && headerExtensions.has(extname(entry.name))) {
      copyFile(from, join(output, "download/src", relative(source, from)));
    }
  }
}

if (!existsSync(source) || !existsSync(build)) {
  throw new Error("WebRTC source or Release build output is missing");
}

copyHeaders(source);

const generated = join(build, "gen");
if (existsSync(generated)) {
  const copyGenerated = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const from = join(directory, entry.name);
      if (entry.isDirectory()) copyGenerated(from);
      else if (entry.isFile() && headerExtensions.has(extname(entry.name))) {
        copyFile(from, join(output, "build/Release/gen", relative(generated, from)));
      }
    }
  };
  copyGenerated(generated);
}

const outputs = process.platform === "win32"
  ? ["obj/webrtc.lib", "obj/node_webrtc_extras.lib"]
  : [
      "obj/libwebrtc.a",
      "obj/api/video/adapted_video_track_source/adapted_video_track_source.o",
      "obj/api/video_codecs/builtin_video_decoder_factory/builtin_video_decoder_factory.o",
      "obj/api/video_codecs/builtin_video_encoder_factory/builtin_video_encoder_factory.o",
    ];

for (const item of outputs) {
  const from = join(build, item);
  if (!existsSync(from) || !statSync(from).isFile()) {
    throw new Error(`Required WebRTC output is missing: ${item}`);
  }
  copyFile(from, join(output, "build/Release", item));
}

if (process.platform === "linux") {
  const linker = join(source, "third_party/llvm-build/Release+Asserts/bin/ld.lld");
  if (!existsSync(linker)) {
    throw new Error("Required Chromium linker is missing: third_party/llvm-build/Release+Asserts/bin/ld.lld");
  }
  copyFile(
    linker,
    join(output, "download/src/third_party/llvm-build/Release+Asserts/bin/ld.lld"),
  );
}

console.log(`Staged WebRTC prebuilt files in ${output}`);
