"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { readStatsResource, isStatsDocument } = require("./web-platform-tests/upstream-stats");

test("modern stats WPTs and helper remain byte-for-byte upstream copies", () => {
  const hashes = {
    "webrtc/RTCRtpSender-getStats.https.html": "2fc4f3f17e705c183b26cb65a015a1a237e74cf3ac0208fd28efad8cbf24b99b",
    "webrtc/RTCRtpReceiver-getStats.https.html": "062e5b6c638ab013dc7e325620faceece801bab1d5fd25045adf5e84494066c5",
    "webrtc/stats/RTCPeerConnection-helper.js": "9709abd9c5a024c8bdbedd1cfab8a8f2c47b9358a987905cedc2a770ded69d2d"
  };
  for (const [file, hash] of Object.entries(hashes)) {
    const body = fs.readFileSync(path.join(__dirname, "web-platform-tests/overrides", file));
    assert.equal(createHash("sha256").update(body).digest("hex"), hash, file);
  }
});

test("upstream checksums survive a Windows-style Git checkout", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wrtc-wpt-checkout-"));
  try {
    const files = ["webrtc/RTCRtpSender-getStats.https.html",
      "webrtc/RTCRtpReceiver-getStats.https.html", "webrtc/stats/RTCPeerConnection-helper.js"];
    const prefix = root.replace(/\\/g, "/") + "/";
    const result = spawnSync("git", ["-c", "core.autocrlf=true", "-c", "core.eol=crlf",
      "checkout-index", "--prefix=" + prefix, "--", ...files.map(file => "test/web-platform-tests/overrides/" + file)],
    { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    for (const file of files) {
      const relative = "test/web-platform-tests/overrides/" + file;
      const original = fs.readFileSync(path.resolve(__dirname, "..", relative));
      const checkedOut = fs.readFileSync(path.join(root, relative));
      assert.deepEqual(checkedOut, original, file);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("modern stats resource routing isolates the helper without changing assertions", () => {
  for (const type of ["Sender", "Receiver"]) {
    const filename = "/webrtc/RTCRtp" + type + "-getStats.https.html";
    const resource = readStatsResource(filename);
    assert.equal(isStatsDocument(filename), true);
    const upstream = fs.readFileSync(path.join(__dirname, "web-platform-tests/overrides", filename), "utf8");
    assert.equal(resource.contentType, "text/html");
    assert.equal(resource.body.replace('src="stats/RTCPeerConnection-helper.js"',
      'src="RTCPeerConnection-helper.js"'), upstream);
    assert.equal((resource.body.match(/promise_test\(/g) || []).length, 5);
  }
  assert.equal(readStatsResource("/webrtc/stats/RTCPeerConnection-helper.js").contentType,
    "application/javascript");
  for (const filename of ["/webrtc/RTCPeerConnection-helper.js", "/resources/testharness.js",
    "/webrtc/RTCPeerConnection-getStats.https.html", "/../upstream-stats.js"]) {
    assert.equal(readStatsResource(filename), undefined);
    assert.equal(isStatsDocument(filename), false);
  }
  assert.equal(isStatsDocument('/webrtc/stats/RTCPeerConnection-helper.js'), false);
});
