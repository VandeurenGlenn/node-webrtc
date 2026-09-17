/* eslint no-console:0 */
'use strict';

var tape = require('./lib/test');
var wrtc = require('..');
var negotiate = require('./lib/pc').negotiate;

tape('custom ports connect once', async function(t) {
  await connectClientServer({ min: 40000, max: 49999 });
  t.pass('connected with a custom port range');
});

tape('custom ports connect concurrently', async function(t) {
  const n = 2;
  const portRange = { min: 40000, max: 49999 };
  await Promise.all(Array.from({ length: n }, () => connectClientServer(portRange)));
  t.pass('connected concurrently with a custom port range');
});

async function connectClientServer(portRange) {
  const client = new wrtc.RTCPeerConnection({ iceServers: [] });
  const server = new wrtc.RTCPeerConnection({ iceServers: [], portRange });
  client.onicecandidate = ({ candidate }) => candidate && server.addIceCandidate(candidate);
  server.onicecandidate = ({ candidate }) => candidate && client.addIceCandidate(candidate);
  const connected = new Promise(resolve => {
    server.ondatachannel = ({ channel }) => {
      channel.onmessage = resolve;
    };
  });
  const channel = client.createDataChannel('custom-port-test');
  try {
    await negotiate(client, server);
    await new Promise(resolve => { channel.onopen = resolve; });
    channel.send('xyz');
    await connected;
  } finally {
    client.close();
    server.close();
  }
}
