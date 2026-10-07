'use strict';

var path = require('path');
var spawnSync = require('child_process').spawnSync;
var test = require('./lib/test');

test('closed WebRTC objects exit without a native teardown abort', function(t) {
  var script = [
    'const { RTCPeerConnection } = require(\'./\')',
    'const peer = new RTCPeerConnection()',
    'const channel = peer.createDataChannel(\'exit\')',
    'channel.close()',
    'peer.close()',
    'setTimeout(() => {}, 25)'
  ].join(';');
  var result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  });

  t.equal(result.status, 0, result.stderr || 'process exited cleanly');
  t.end();
});

test('closed stats exit cleanly with retained wrappers, pending requests and garbage collection', function(t) {
  for (const collect of [false, true]) {
    var script = `
      const assert = require('node:assert/strict');
      const { RTCPeerConnection } = require('./');
      (async () => {
        let peer = new RTCPeerConnection();
        let endpoints = peer.addTransceiver('audio');
        const pending = [peer.getStats(), endpoints.sender.getStats(), endpoints.receiver.getStats()];
        peer.close();
        pending.push(peer.getStats(), endpoints.sender.getStats(), endpoints.receiver.getStats());
        if (${collect}) {
          endpoints = null;
          peer = null;
          global.gc();
        }
        const reports = await Promise.all(pending);
        reports.forEach(report => assert.ok(report instanceof Map));
        if (${collect}) {
          endpoints = null;
          peer = null;
          await new Promise(resolve => setImmediate(resolve));
          global.gc();
          await new Promise(resolve => setImmediate(resolve));
          global.gc();
        }
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    var result = spawnSync(process.execPath, ['--expose-gc', '-e', script], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10000
    });
    t.equal(result.status, 0, result.stderr || String(result.error || 'process exited cleanly'));
  }
  t.end();
});
