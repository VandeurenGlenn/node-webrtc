'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const wrtc = require('..');

test('generated browser entry delegates event constructors to the browser', () => {
  const checked = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    globalThis.window = { RTCTrackEvent: class {}, MediaStreamTrackEvent: class {} };
    Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: {} }, configurable: true });
    const browser = await import('./lib/browser.js');
    assert.equal(browser.RTCTrackEvent, window.RTCTrackEvent);
    assert.equal(browser.MediaStreamTrackEvent, window.MediaStreamTrackEvent);
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
});

test('ICE events inherit Event and validate nullable candidate defaults', () => {
  const { RTCPeerConnectionIceEvent: IceEvent, RTCIceCandidate } = wrtc;
  assert.throws(() => new IceEvent(), TypeError);
  for (const init of [undefined, null, {}, { candidate: undefined }, { candidate: null }]) {
    const event = new IceEvent('icecandidate', init);
    assert.ok(event instanceof Event);
    assert.equal(event.candidate, null);
    assert.equal(event.url, null);
    assert.equal(event.target, null);
    assert.equal(event.bubbles, false);
    assert.equal(event.cancelable, false);
  }
  const candidate = new RTCIceCandidate({ candidate: '', sdpMid: '0' });
  const event = new IceEvent('icecandidate', { candidate, url: '\ud800', bubbles: true, cancelable: true });
  assert.equal(event.candidate, candidate);
  assert.equal(event.url, '\ufffd');
  assert.equal(event.bubbles, true);
  event.preventDefault();
  assert.equal(event.defaultPrevented, true);
  assert.throws(() => { event.candidate = null; }, TypeError);
  assert.throws(() => new IceEvent('icecandidate', { candidate: {} }), TypeError);
});

test('track events validate native objects and freeze a copied streams sequence', () => {
  const pc = new wrtc.RTCPeerConnection();
  try {
    const transceiver = pc.addTransceiver('audio');
    const receiver = transceiver.receiver;
    const track = receiver.track;
    const stream = new wrtc.MediaStream([track]);
    const init = { receiver, track, transceiver };
    assert.throws(() => new wrtc.RTCTrackEvent('track'), TypeError);
    for (const key of Object.keys(init)) {
      assert.throws(() => new wrtc.RTCTrackEvent('track', { ...init, [key]: {} }), TypeError);
    }
    for (const streams of [null, {}, 3, [null]]) {
      assert.throws(() => new wrtc.RTCTrackEvent('track', { ...init, streams }), TypeError);
    }
    const streams = [stream];
    const event = new wrtc.RTCTrackEvent('track', { ...init, streams, cancelable: true });
    streams.length = 0;
    assert.ok(event instanceof Event);
    assert.equal(event.receiver, receiver);
    assert.equal(event.track, track);
    assert.equal(event.transceiver, transceiver);
    assert.deepEqual(event.streams, [stream]);
    assert.equal(event.streams, event.streams);
    assert.equal(Object.isFrozen(event.streams), true);
    assert.throws(() => { event.track = null; }, TypeError);
    assert.deepEqual(new wrtc.RTCTrackEvent('track', init).streams, []);
    assert.deepEqual(new wrtc.RTCTrackEvent('track', { ...init, streams: new Set([stream]) }).streams, [stream]);
    const trackEvent = new wrtc.MediaStreamTrackEvent('addtrack', { track });
    assert.ok(trackEvent instanceof Event);
    assert.equal(trackEvent.track, track);
    assert.throws(() => new wrtc.MediaStreamTrackEvent('addtrack', { track: {} }), TypeError);
    assert.throws(() => new wrtc.MediaStreamTrackEvent('addtrack'), TypeError);
  } finally {
    pc.close();
  }
});

test('native track delivery uses RTCTrackEvent and preserves its peer target', async () => {
  const sender = new wrtc.RTCPeerConnection();
  const receiver = new wrtc.RTCPeerConnection();
  try {
    sender.addTransceiver('audio');
    const delivered = new Promise(resolve => { receiver.ontrack = resolve; });
    const offer = await sender.createOffer();
    await sender.setLocalDescription(offer);
    await receiver.setRemoteDescription(offer);
    const event = await delivered;
    assert.ok(event instanceof wrtc.RTCTrackEvent);
    assert.ok(event instanceof Event);
    assert.equal(event.target, receiver);
    assert.equal(event.track, event.receiver.track);
    assert.equal(event.transceiver.receiver, event.receiver);
    assert.equal(Object.isFrozen(event.streams), true);
  } finally {
    sender.close();
    receiver.close();
  }
});
