"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

test("RTP stats preserve historical native methods and install only missing methods", () => {
  const moduleURL = pathToFileURL(path.resolve(__dirname, "../lib/rtpstats.js")).href;
  for (const mode of ["legacy", "configurable", "missing"]) {
    const script = `
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const binding = { RTCRtpSender: function Sender() {}, RTCRtpReceiver: function Receiver() {} };
      const mode = ${JSON.stringify(mode)};
      const nativeMethod = function getStats() { return 'native'; };
      for (const Endpoint of Object.values(binding)) {
        if (mode !== 'missing') Object.defineProperty(Endpoint.prototype, 'getStats', {
          value: nativeMethod, configurable: mode === 'configurable'
        });
      }
      const load = Module._load;
      Module._load = function(request, ...args) {
        return request.endsWith('/wrtc.node') ? binding : load.call(this, request, ...args);
      };
      import(${JSON.stringify(moduleURL)}).then(async stats => {
        for (const Endpoint of Object.values(binding)) {
          if (mode !== 'missing') {
            assert.equal(Endpoint.prototype.getStats, nativeMethod);
            assert.equal(new Endpoint().getStats(), 'native');
            assert.equal(Object.getOwnPropertyDescriptor(Endpoint.prototype, 'getStats').configurable,
              mode === 'configurable');
          } else {
            const endpoint = new Endpoint();
            const peer = { getStats(selector) { return Promise.resolve(selector); } };
            stats.associateEndpoint(endpoint, peer);
            assert.equal(await endpoint.getStats(), endpoint);
            await assert.rejects(Endpoint.prototype.getStats.call({}), TypeError);
          }
        }
      }).catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, mode + ": " + result.stderr);
  }
});
