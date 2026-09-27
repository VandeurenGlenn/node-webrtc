"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

test("npm release verification encodes scoped package names", async () => {
  const { registryPackageUrl } = await import(
    "../scripts/verify-npm-release.js"
  );
  assert.equal(
    registryPackageUrl(
      "https://registry.npmjs.org/",
      "@vandeurenglenn/wrtc",
    ),
    "https://registry.npmjs.org/%40vandeurenglenn%2Fwrtc",
  );
});

test("npm release verification retries only pending packages", async () => {
  const { waitForRelease } = await import("../scripts/verify-npm-release.js");
  const attempts = new Map();
  let clock = 0;

  await waitForRelease({
    packages: ["ready", "delayed"],
    registry: "https://registry.example",
    timeoutMs: 10_000,
    version: "1.2.3",
    check: async (_registry, packageName, version) => {
      assert.equal(version, "1.2.3");
      const attempt = (attempts.get(packageName) || 0) + 1;
      attempts.set(packageName, attempt);
      return packageName === "ready" || attempt === 2;
    },
    now: () => clock,
    sleep: async (delayMs) => {
      clock += delayMs;
    },
  });

  assert.equal(attempts.get("ready"), 1);
  assert.equal(attempts.get("delayed"), 2);
});

test("npm release verification times out with pending package names", async () => {
  const { waitForRelease } = await import("../scripts/verify-npm-release.js");
  let clock = 0;

  await assert.rejects(
    waitForRelease({
      packages: ["missing"],
      registry: "https://registry.example",
      timeoutMs: 1,
      version: "1.2.3",
      check: async () => false,
      now: () => clock,
      sleep: async (delayMs) => {
        clock += delayMs;
      },
    }),
    /npm did not expose 1\.2\.3 as latest for: missing/,
  );
});
