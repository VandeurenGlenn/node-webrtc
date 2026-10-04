'use strict';

const tape = require('./lib/test');
const { JSDOM } = require('jsdom');
const { RTCDataChannel, RTCPeerConnection } = require('..');
const { createRTCPeerConnections, negotiate } = require('./lib/pc');

tape('closing during binary delivery releases pending message events safely', async t => {
  for (let round = 0; round < 5; round += 1) {
    const [sender, receiver] = createRTCPeerConnections();
    try {
      const outgoing = sender.createDataChannel('close-during-burst');
      const opened = new Promise(resolve => {
        outgoing.onopen = resolve;
      });
      const delivered = new Promise((resolve, reject) => {
        receiver.ondatachannel = ({ channel }) => {
          channel.onmessage = ({ data }) => {
            try {
              t.equal(new Uint8Array(data)[0], round, 'payload survives async delivery');
              receiver.close();
              sender.close();
              resolve();
            } catch (error) {
              reject(error);
            }
          };
        };
      });
      await negotiate(sender, receiver);
      await opened;
      const payload = new Uint8Array(1024).fill(round);
      for (let i = 0; i < 256; i += 1) outgoing.send(payload);
      await delivered;
      await new Promise(resolve => setImmediate(resolve));
    } finally {
      sender.close();
      receiver.close();
    }
  }
  t.end();
});

tape('.send() normalizes jsdom Blob and cross-realm ArrayBuffer values', async t => {
  const { window } = new JSDOM('', { runScripts: 'dangerously' });
  const jsdomBlob = window.eval(`new Blob(['blob'])`);
  const values = [
    {
      size: jsdomBlob.size,
      arrayBuffer: () => jsdomBlob.arrayBuffer()
    },
    window.eval(`new ArrayBuffer(8)`)
  ];
  const sent = [];
  const channel = {
    readyState: 'open',
    _send(value) {
      sent.push(value);
    }
  };

  values.forEach(value => RTCDataChannel.prototype.send.call(channel, value));
  await new Promise(resolve => setImmediate(resolve));

  t.equal(sent.length, 2, 'both values are sent');
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
