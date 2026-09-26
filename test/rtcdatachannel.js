'use strict';

const tape = require('./lib/test');
const { JSDOM } = require('jsdom');
const { RTCDataChannel, RTCPeerConnection } = require('..');

tape('.send() normalizes jsdom Blob and cross-realm ArrayBuffer values', t => {
  const { window } = new JSDOM('', { runScripts: 'dangerously' });
  const values = window.eval(`[
    new Blob(['blob']),
    new ArrayBuffer(8)
  ]`);
  const sent = [];
  const channel = {
    _send(value) {
      sent.push(value);
    }
  };

  values.forEach(value => RTCDataChannel.prototype.send.call(channel, value));

  t.equal(Buffer.from(sent[0]).toString(), 'blob', 'Blob bytes are preserved');
  t.equal(sent[1].byteLength, 8, 'ArrayBuffer length is preserved');
  t.ok(sent.every(value => value instanceof Uint8Array), 'values use the Node realm');
  window.close();
  t.end();
});

tape('Calling .send(message) when .readyState is "closed" throws InvalidStateError', t => {
  const pc = new RTCPeerConnection();
  const dc = pc.createDataChannel('hello');
  pc.close();
  t.throws(() => dc.send('world'), /RTCDataChannel.readyState is not 'open'/);
  t.end();
});

tape('.maxPacketLifeTime', t => {
  const pc = new RTCPeerConnection();
  const dc1 = pc.createDataChannel('dc1');
  const dc2 = pc.createDataChannel('dc2', { maxPacketLifeTime: 0 });
  t.equal(dc1.maxPacketLifeTime, 65535);
  t.equal(dc2.maxPacketLifeTime, 0);
  pc.close();
  t.end();
});

tape('.negotiated', t => {
  const pc = new RTCPeerConnection();
  const dc1 = pc.createDataChannel('dc1');
  const dc2 = pc.createDataChannel('dc2', { negotiated: true });
  t.equal(dc1.negotiated, false);
  t.equal(dc2.negotiated, true);
  pc.close();
  t.end();
});
