"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

test("native package matrix includes each supported target once", async () => {
  const { nativePlatforms } = await import("../scripts/native-platforms.js");
  const targets = nativePlatforms.map(({ platform, arch }) => `${platform}-${arch}`);
  const packages = nativePlatforms.map(({ packageName }) => packageName);

  assert.deepEqual(targets, [
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-x64",
  ]);
  assert.equal(new Set(targets).size, targets.length);
  assert.equal(new Set(packages).size, packages.length);
  assert.ok(packages.includes("@vandeurenglenn/wrtc-linux-arm64"));
});
