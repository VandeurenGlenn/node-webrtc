'use strict';

var path = require('path');
var spawnSync = require('child_process').spawnSync;
var test = require('tape');

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
