'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const wrtc = require('..');

for (const kind of ['audio', 'video']) {
  test(`${kind} track constraints have independent snapshots and truthful errors`, async t => {
    const Source = kind === 'audio' ? wrtc.nonstandard.RTCAudioSource : wrtc.nonstandard.RTCVideoSource;
    const source = new Source();
    const track = source.createTrack();
    const clones = [];
    t.after(() => { track.stop(); clones.forEach(clone => clone.stop()); });
    assert.deepEqual(track.getCapabilities(), {});
    assert.deepEqual(track.getConstraints(), {});
    assert.deepEqual(track.getSettings(), {});
    const input = { width: { ideal: 320 }, unknown: { exact: true }, advanced: [{ height: 240 }] };
    assert.equal(await track.applyConstraints(input), undefined);
    input.width.ideal = 640;
    const expected = { width: { ideal: 320 }, advanced: [{ height: 240 }] };
    assert.deepEqual(track.getConstraints(), expected);
    const snapshot = track.getConstraints();
    snapshot.advanced[0].height = 999;
    assert.deepEqual(track.getConstraints(), expected);
    const clone = track.clone();
    clones.push(clone);
    assert.deepEqual(clone.getConstraints(), expected);
    track.enabled = false;
    const streamClone = new wrtc.MediaStream([track]).clone();
    const [streamTrack] = streamClone.getTracks();
    clones.push(streamTrack);
    assert.deepEqual(streamTrack.getConstraints(), expected);
    assert.equal(streamTrack.enabled, false);
    assert.notEqual(streamTrack.id, track.id);
    await clone.applyConstraints({ height: 160 });
    assert.deepEqual(track.getConstraints(), expected);
    const required = kind === 'audio' ? 'sampleRate' : 'width';
    await assert.rejects(track.applyConstraints({ [required]: { exact: 320 } }), error =>
      error instanceof DOMException && error.name === 'OverconstrainedError' && error.constraint === required);
    assert.deepEqual(track.getConstraints(), expected, 'failure leaves constraints unchanged');
    const otherKind = kind === 'audio' ? 'width' : 'sampleRate';
    await track.applyConstraints({ [otherKind]: { exact: 320 } });
    assert.deepEqual(track.getConstraints(), { [otherKind]: { exact: 320 } });
    await track.applyConstraints({ deviceId: new Set(['a', 'b']), frameRate: null });
    assert.deepEqual(track.getConstraints(), { deviceId: ['a', 'b'], frameRate: {} });
    await track.applyConstraints({ width: { ideal: Infinity } });
    assert.deepEqual(track.getConstraints(), { width: { ideal: 0 } });
    for (const input of [42, { frameRate: NaN }, { frameRate: { ideal: Infinity } }, { width: 1n }, { advanced: {} }]) {
      await assert.rejects(track.applyConstraints(input), TypeError);
    }
    await track.applyConstraints();
    assert.deepEqual(track.getConstraints(), {});
    let ended = 0;
    track.onended = () => ended++;
    track.stop(); track.stop();
    await track.applyConstraints({ width: { exact: 640 } });
    assert.deepEqual(track.getConstraints(), {});
    assert.deepEqual(track.getSettings(), {});
    const stoppedClone = track.clone();
    clones.push(stoppedClone);
    assert.equal(stoppedClone.readyState, 'ended');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ended, 0, 'explicit stop does not fire ended');
    assert.throws(() => track.getCapabilities.call({}), TypeError);
    assert.throws(() => track.getConstraints.call({}), TypeError);
    await assert.rejects(track.applyConstraints.call({}, {}), TypeError);
  });
}

test('video settings reflect actual frame dimensions and clone metadata', t => {
  const source = new wrtc.nonstandard.RTCVideoSource();
  const track = source.createTrack();
  const clones = [];
  t.after(() => { track.stop(); clones.forEach(clone => clone.stop()); });
  source.onFrame({ width: 32, height: 16, data: new Uint8ClampedArray(32 * 16 * 3 / 2) });
  assert.equal(track.getSettings().width, 32);
  assert.equal(track.getSettings().height, 16);
  assert.equal(track.getSettings().aspectRatio, 2);
  const clone = track.clone();
  clones.push(clone);
  assert.deepEqual(clone.getSettings(), track.getSettings());
  const snapshot = track.getSettings();
  snapshot.width = 999;
  source.onFrame({ width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 3 / 2) });
  assert.equal(track.getSettings().width, 16);
  assert.equal(clone.getSettings().width, 16);
  assert.ok(track.getSettings().frameRate > 0);
});

test('constraint installation preserves historical native addon APIs', () => {
  const install = require('../lib/trackconstraints.js').default;
  function OldTrack() {}
  const clone = () => 'legacy clone';
  Object.defineProperty(OldTrack.prototype, 'clone', { value: clone });
  install(OldTrack);
  assert.equal(OldTrack.prototype.clone, clone);
  assert.equal(new OldTrack().clone(), 'legacy clone');
});
