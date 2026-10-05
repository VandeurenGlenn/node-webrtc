'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RTCPeerConnection, RTCSessionDescription } = require('..');

test('RTCSessionDescription requires a valid type and defaults its SDP to empty', () => {
  for (const init of [undefined, null, {}, { sdp: 'v=0' }, { type: 'invalid' }]) {
    assert.throws(() => new RTCSessionDescription(init), TypeError);
  }
  assert.equal(new RTCSessionDescription({ type: 'offer' }).sdp, '');
  assert.throws(() => RTCSessionDescription({ type: 'offer' }), TypeError);
});

test('setLocalDescription accepts absent, nullable and empty dictionaries', async () => {
  const variants = [[], [undefined], [null], [{}], [{ sdp: '' }], [{ type: undefined, sdp: '' }]];
  for (const args of variants) {
    const pc = new RTCPeerConnection();
    try {
      const transceiver = pc.addTransceiver('audio');
      await pc.setLocalDescription(...args);
      assert.equal(pc.signalingState, 'have-local-offer');
      assert.equal(pc.pendingLocalDescription.type, 'offer');
      assert.match(pc.pendingLocalDescription.sdp, /^v=0/);
      assert.notEqual(transceiver.mid, null);
    } finally {
      pc.close();
    }
  }
});

test('implicit native offer and answer complete an SDP exchange', async () => {
  const offerer = new RTCPeerConnection();
  const answerer = new RTCPeerConnection();
  try {
    offerer.addTransceiver('audio');
    await offerer.setLocalDescription();
    await answerer.setRemoteDescription(offerer.localDescription);
    await answerer.setLocalDescription();
    assert.equal(answerer.signalingState, 'stable');
    assert.equal(answerer.currentLocalDescription.type, 'answer');
    await offerer.setRemoteDescription(answerer.localDescription);
    assert.equal(offerer.signalingState, 'stable');
    assert.equal(offerer.pendingLocalDescription, null);
    assert.equal(offerer.currentLocalDescription.type, 'offer');
  } finally {
    offerer.close();
    answerer.close();
  }
});

test('implicit setLocalDescription preserves a still-valid created offer', async () => {
  const pc = new RTCPeerConnection();
  try {
    pc.addTransceiver('audio');
    const offer = await pc.createOffer();
    await pc.setLocalDescription();
    assert.equal(pc.localDescription.sdp, offer.sdp);
  } finally {
    pc.close();
  }
});

test('explicit local descriptions read dictionary getters only once', async () => {
  const pc = new RTCPeerConnection();
  try {
    pc.addTransceiver('audio');
    const offer = await pc.createOffer();
    let types = 0;
    let sdps = 0;
    await pc.setLocalDescription({
      get type() { types += 1; return offer.type; },
      get sdp() { sdps += 1; return offer.sdp; }
    });
    assert.equal(types, 1);
    assert.equal(sdps, 1);
  } finally {
    pc.close();
  }
});

test('implicit descriptions reject closed peers with InvalidStateError', async () => {
  const pc = new RTCPeerConnection();
  pc.close();
  for (const args of [[], [{}], [null]]) {
    await assert.rejects(pc.setLocalDescription(...args), { name: 'InvalidStateError' });
  }
});

test('closing during an implicit description leaves the pending operation unsettled', async () => {
  for (let round = 0; round < 5; round += 1) {
    const pc = new RTCPeerConnection();
    const pending = pc.setLocalDescription();
    pc.close();
    const outcome = await Promise.race([
      pending.then(() => 'resolved', () => 'rejected'),
      new Promise(resolve => setTimeout(() => resolve('pending'), 20))
    ]);
    assert.equal(outcome, 'pending');
  }
});
