'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const wrtc = require('..');
const { createRTCPeerConnections, negotiate } = require('./lib/pc');
const { createStatsMedia } = require('./web-platform-tests/stats-media');

async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, 'receiver state change must complete');
    await delay(10);
  }
}

for (const kind of ['audio', 'video']) {
  test(`${kind} remote clones share mute events and matching BYE without coupling track stop`,
    { timeout: 15000 }, async t => {
      const [caller, callee] = createRTCPeerConnections();
      const Source = kind === 'audio' ? wrtc.nonstandard.RTCAudioSource : wrtc.nonstandard.RTCVideoSource;
      const sources = [new Source(), new Source()];
      const tracks = sources.map(source => source.createTrack());
      const senders = tracks.map(track => caller.addTransceiver(track));
      const remote = [];
      const clones = [];
      const events = [];
      let timer;
      t.after(() => {
        clearInterval(timer);
        caller.close(); callee.close();
        [...tracks, ...clones].forEach(track => track.stop());
      });
      const watch = track => {
        for (const type of ['mute', 'unmute']) track.addEventListener(type, event => {
          assert.equal(event.target, track);
          assert.equal(track.muted, type === 'mute');
          events.push({ track, type });
        });
      };
      callee.ontrack = ({ track }) => {
        if (remote.includes(track)) return;
        remote.push(track);
        watch(track);
        if (remote.length === 1) {
          const clone = track.clone();
          const nested = clone.clone();
          clones.push(clone, nested);
          clones.forEach(watch);
          assert.ok(clones.every(track => track.muted), 'clones start with source mute state');
          assert.notEqual(clone.id, track.id);
          assert.notEqual(nested.id, clone.id);
        }
      };
      await negotiate(caller, callee);
      const frame = kind === 'audio'
        ? { samples: new Int16Array(480), sampleRate: 48000,
          bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 }
        : { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 3 / 2) };
      timer = setInterval(() => sources.forEach(source => {
        if (kind === 'audio') source.onData(frame);
        else source.onFrame(frame);
      }), kind === 'audio' ? 10 : 20);
      await until(() => [...remote, ...clones].every(track => !track.muted));
      assert.equal(events.filter(({ type }) => type === 'unmute').length, 4);
      remote[0].enabled = false;
      const disabledClone = remote[0].clone();
      clones.push(disabledClone);
      assert.equal(disabledClone.enabled, false, 'clone inherits enabled without sharing it');
      disabledClone.enabled = true;
      assert.equal(remote[0].enabled, false);
      assert.equal(disabledClone.muted, false);
      watch(disabledClone);
      const stopped = clones[0];
      // Reentrant handlers see coherent state and can stop a sibling safely.
      remote[0].onmute = () => {
        assert.ok(clones.every(track => track.muted));
        stopped.stop();
        global.gc?.();
      };
      senders[0].direction = 'inactive';
      await negotiate(caller, callee);
      await until(() => remote[0].muted && clones[1].muted && disabledClone.muted);
      assert.equal(remote[1].muted, false, 'other receiver must not mute');
      assert.equal(stopped.readyState, 'ended');
      assert.equal(events.filter(({ track, type }) => track === stopped && type === 'mute').length, 0);
      const late = clones[1].clone();
      clones.push(late);
      watch(late);
      assert.equal(late.muted, true, 'clone of muted clone inherits source state');
      remote[0].onmute = null;
      // Source notifications must still reach clones after stopping the original.
      remote[0].stop();
      senders[0].direction = 'sendrecv';
      await negotiate(caller, callee);
      const live = [clones[1], disabledClone, late];
      await until(() => live.every(track => !track.muted));
      assert.equal(stopped.muted, true, 'stopped clone freezes its mute state');
      assert.equal(remote[0].readyState, 'ended');
      assert.equal(remote[0].muted, true, 'stopped original freezes its mute state');
      const endedClone = remote[0].clone();
      clones.push(endedClone);
      assert.equal(endedClone.readyState, 'ended');
      assert.equal(endedClone.enabled, false);
      assert.equal(endedClone.muted, true);
      const original = new WeakRef(remote[0]);
      for (let i = events.length - 1; i >= 0; --i) {
        if (events[i].track === remote[0]) events.splice(i, 1);
      }
      remote[0] = null;
      await delay(0);
      global.gc?.();
      assert.ok(original.deref(), 'peer retains stopped receiver-track identity');
      assert.equal(callee.getReceivers()[0].track, original.deref());
      const eventsBeforeBye = events.length;
      senders[0].stop();
      await until(() => live.every(track => track.muted));
      assert.ok(live.every(track => track.readyState === 'live'), 'BYE mutes, not ends, remote sources');
      assert.equal(events.length - eventsBeforeBye, 3, 'one BYE mute per live clone');
      assert.equal(remote[1].muted, false, 'BUNDLE BYE only mutes matching receiver');
      caller.close();
      await until(() => remote[1].muted);
      const eventsBeforeClose = events.length;
      callee.close();
      await until(() => live.every(track => track.readyState === 'ended'));
      await delay(40);
      assert.equal(events.length, eventsBeforeClose, 'no mute/unmute after local close');
    });
}

for (const [kind, cached] of [['audio', true], ['audio', false], ['video', true], ['video', false]]) {
  test(`${kind} stopped receiver stats preserve ${cached ? 'cached' : 'pending'} pre-stop requests and other active receivers`,
    { timeout: 15000 }, async t => {
      const [caller, callee] = createRTCPeerConnections();
      const Source = kind === 'audio' ? wrtc.nonstandard.RTCAudioSource : wrtc.nonstandard.RTCVideoSource;
      const sources = [new Source(), new Source()];
      const tracks = sources.map(source => source.createTrack());
      tracks.forEach(track => caller.addTrack(track));
      const frame = kind === 'audio'
        ? { samples: new Int16Array(480), sampleRate: 48000,
          bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 }
        : { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 3 / 2) };
      const timer = setInterval(() => sources.forEach(source => {
        if (kind === 'audio') source.onData(frame);
        else source.onFrame(frame);
      }), kind === 'audio' ? 10 : 20);
      t.after(() => {
        clearInterval(timer);
        caller.close(); callee.close(); tracks.forEach(track => track.stop());
      });
      await negotiate(caller, callee);
      const [stopping, active] = callee.getTransceivers();
      await until(() => !stopping.receiver.track.muted && !active.receiver.track.muted);
      const inbound = report => [...report.values()].filter(stat => stat.type === 'inbound-rtp');
      const primed = await stopping.receiver.getStats();
      assert.equal(inbound(primed).length, 1);
      // Exercise both fresh cached reports and an in-flight uncached collection.
      if (!cached) await delay(100);
      const beforeStop = stopping.receiver.getStats();
      stopping.stop();
      stopping.stop();
      const afterStop = stopping.receiver.getStats();
      const connectionAfterStop = callee.getStats();
      assert.equal(inbound(await beforeStop).length, 1, 'pre-stop snapshot remains available');
      assert.equal(inbound(await afterStop).length, 0, 'post-stop request cannot join stale collection');
      assert.equal(inbound(await stopping.receiver.getStats()).length, 0, 'cache remains stopped');
      assert.equal(inbound(await connectionAfterStop).length, 1, 'other receiver remains in full report');
      assert.equal(inbound(await active.receiver.getStats()).length, 1);
      assert.equal(stopping.receiver.track.readyState, 'ended');
    });
}

test('closing during native receiver creation detaches observers and exits cleanly', () => {
  const result = spawnSync(process.execPath, ['--expose-gc', '-e', `
    const assert = require('node:assert/strict');
    const wrtc = require('./');
    (async () => {
      for (let i = 0; i < 5; i++) {
        const caller = new wrtc.RTCPeerConnection();
        const callee = new wrtc.RTCPeerConnection();
        const source = new wrtc.nonstandard.RTCAudioSource();
        const track = source.createTrack();
        caller.addTrack(track);
        let delivered = 0;
        callee.ontrack = () => delivered++;
        const offer = await caller.createOffer();
        await caller.setLocalDescription(offer);
        // The SDP promise intentionally need not settle after immediate close.
        callee.setRemoteDescription(offer);
        callee.close(); caller.close(); track.stop();
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(delivered, 0, 'no track events after close');
      }
      global.gc();
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || String(result.error || 'clean exit'));
});

test('local tracks remain unmuted and new receiver tracks start muted', t => {
  const source = new wrtc.nonstandard.RTCAudioSource();
  const local = source.createTrack();
  const pc = new wrtc.RTCPeerConnection();
  t.after(() => { local.stop(); pc.close(); });
  assert.equal(local.muted, false);
  local.enabled = false;
  assert.equal(local.muted, false, 'disabled is not muted');
  const receiver = pc.addTransceiver('audio').receiver;
  assert.equal(receiver.track.muted, true);
  assert.equal(receiver.track.readyState, 'live');
  pc.close();
  pc.close();
  assert.equal(receiver.track.readyState, 'ended');
});

test('stats media fixture generates actual samples and disposes tracks and timers', async t => {
  const media = createStatsMedia(wrtc);
  const stream = await media.getUserMedia({ audio: true });
  const [track] = stream.getTracks();
  const sink = new wrtc.nonstandard.RTCAudioSink(track);
  t.after(() => { sink.stop(); media.dispose(); });
  const frames = [];
  sink.ondata = frame => frames.push(frame);
  await until(() => frames.length > 0);
  assert.equal(frames[0].sampleRate, 48000);
  assert.equal(frames[0].numberOfFrames, 480);
  assert.ok(frames[0].samples.some(sample => sample !== 0));
  media.dispose();
  media.dispose();
  assert.equal(track.readyState, 'ended');
  await delay(30);
  const count = frames.length;
  await delay(30);
  assert.equal(frames.length, count);
  await assert.rejects(media.getUserMedia({ audio: true }), /closed/);
});

test('video receiver readiness follows actual RTP and remains ended after stop',
  { timeout: 10000 }, async t => {
    const [caller, callee] = createRTCPeerConnections();
    const source = new wrtc.nonstandard.RTCVideoSource();
    const local = source.createTrack();
    caller.addTrack(local);
    let remote;
    let initial;
    const events = [];
    let timer;
    t.after(() => {
      clearInterval(timer);
      caller.close(); callee.close(); local.stop();
    });
    callee.ontrack = ({ track }) => {
      remote = track;
      initial = track.muted;
      track.onunmute = event => events.push(event);
    };
    await negotiate(caller, callee);
    assert.equal(initial, true);
    const frame = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 3 / 2) };
    timer = setInterval(() => source.onFrame(frame), 20);
    await until(() => remote.muted === false);
    assert.equal(events.length, 1);
    assert.equal(events[0].target, remote);
    assert.ok(events[0] instanceof Event);
    remote.stop();
    remote.stop();
    await delay(40);
    assert.equal(remote.readyState, 'ended');
    assert.equal(events.length, 1);
  });

test('RTP unmutes only the receiving track, then remote removal mutes it and resume unmutes it',
  { timeout: 15000 }, async t => {
    const [caller, callee] = createRTCPeerConnections();
    const sources = [new wrtc.nonstandard.RTCAudioSource(), new wrtc.nonstandard.RTCAudioSource()];
    const locals = sources.map(source => source.createTrack());
    const transceivers = locals.map(track => caller.addTransceiver(track));
    const remote = [];
    const initial = [];
    const events = [];
    let timer;
    t.after(() => {
      clearInterval(timer);
      caller.close(); callee.close(); locals.forEach(track => track.stop());
    });
    callee.ontrack = ({ track }) => {
      if (remote.includes(track)) return;
      initial.push(track.muted);
      remote.push(track);
      for (const type of ['mute', 'unmute']) track.addEventListener(type, event => {
        events.push({ track, event, muted: track.muted });
      });
    };
    const frame = { samples: new Int16Array(480), sampleRate: 48000,
      bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 };
    // Generate media before negotiation completes, covering first packets
    // arriving before the queued JS ontrack callback is delivered.
    timer = setInterval(() => sources[0].onData(frame), 10);
    await negotiate(caller, callee);
    assert.equal(remote.length, 2);
    assert.deepEqual(initial, [true, true], 'ontrack precedes unmute');
    await until(() => remote[0].muted === false);
    await delay(100);
    assert.equal(remote[1].muted, true, 'another audio receiver must not unmute without RTP');
    assert.equal(events.length, 1, 'continued packets do not repeat unmute');
    assert.equal(events[0].track, remote[0]);
    assert.equal(events[0].event.type, 'unmute');
    assert.ok(events[0].event instanceof Event);
    assert.equal(events[0].event.target, remote[0]);
    assert.equal(events[0].muted, false);
    const report = await callee.getReceivers()[0].getStats();
    assert.ok([...report.values()].some(stat => stat.type === 'inbound-rtp' && stat.packetsReceived > 0));
    transceivers[0].direction = 'inactive';
    await negotiate(caller, callee);
    await until(() => remote[0].muted === true);
    assert.equal(events.at(-1).event.type, 'mute');
    assert.equal(events.at(-1).muted, true);
    assert.equal(remote[0].readyState, 'live');
    transceivers[0].direction = 'sendrecv';
    await negotiate(caller, callee);
    await until(() => remote[0].muted === false);
    assert.deepEqual(events.map(({ event }) => event.type), ['unmute', 'mute', 'unmute']);
    clearInterval(timer);
    callee.close();
    await delay(20);
    assert.equal(remote[0].readyState, 'ended');
    assert.equal(events.length, 3, 'close must not dispatch queued unmute events');
  });
