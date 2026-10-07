"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
const wrtc = require("..");
const { createRTCPeerConnections, negotiate } = require("./lib/pc");

test("null and omitted ICE candidates return promises instead of throwing", async t => {
  const pc = new wrtc.RTCPeerConnection();
  const remote = new wrtc.RTCPeerConnection();
  t.after(() => { pc.close(); remote.close(); });
  await assert.rejects(pc.addIceCandidate(null), { name: "InvalidStateError" });
  await assert.rejects(pc.addIceCandidate(), { name: "InvalidStateError" });
  remote.addTransceiver("audio");
  await pc.setRemoteDescription(await remote.createOffer());
  await pc.addIceCandidate(null);
  await pc.addIceCandidate();
  pc.close();
  await assert.rejects(pc.addIceCandidate(null), { name: "InvalidStateError" });
});

test("RTP stats reject invalid receivers and track selectors", async t => {
  const pc = new wrtc.RTCPeerConnection();
  const source = new wrtc.nonstandard.RTCAudioSource();
  const track = source.createTrack();
  t.after(() => { pc.close(); track.stop(); });
  await assert.rejects(pc.getStats({}), TypeError);
  await assert.rejects(pc.getStats(track), { name: "InvalidAccessError" });
  for (const Endpoint of [wrtc.RTCRtpSender, wrtc.RTCRtpReceiver]) {
    await assert.rejects(Endpoint.prototype.getStats.call({}), TypeError);
    await assert.rejects(Endpoint.prototype.getStats.call(Object.create(Endpoint.prototype)), TypeError);
    await assert.rejects(pc._pc.getStats(Object.create(Endpoint.prototype)), TypeError);
  }
  assert.ok(await pc.getStats() instanceof Map);
  assert.ok(await pc.getStats(null) instanceof Map);
});

test("RTP endpoint stats are available from every transceiver access path", async t => {
  const pc = new wrtc.RTCPeerConnection();
  t.after(() => pc.close());
  const transceiver = pc.addTransceiver("audio");
  const endpoints = [transceiver.sender, transceiver.receiver,
    ...pc.getSenders(), ...pc.getReceivers(),
    pc.getTransceivers()[0].sender, pc.getTransceivers()[0].receiver];
  for (const endpoint of endpoints) {
    assert.ok(await endpoint.getStats() instanceof Map);
  }
});

test("RTP stats reject ambiguous and foreign selectors", async t => {
  const pc = new wrtc.RTCPeerConnection();
  const other = new wrtc.RTCPeerConnection();
  const source = new wrtc.nonstandard.RTCAudioSource();
  const track = source.createTrack();
  t.after(() => { pc.close(); other.close(); track.stop(); });
  pc.addTransceiver(track);
  pc.addTransceiver(track);
  await assert.rejects(pc.getStats(track), { name: "InvalidAccessError" });
  await assert.rejects(other.getStats(track), { name: "InvalidAccessError" });
  await assert.rejects(other._pc.getStats(pc.getSenders()[0]), TypeError);
  await assert.rejects(other._pc.getStats(pc.getReceivers()[0]), TypeError);
  const transceiver = pc.addTransceiver("audio");
  pc.addTransceiver(transceiver.receiver.track);
  await assert.rejects(pc.getStats(transceiver.receiver.track), { name: "InvalidAccessError" });
});

test("closed peer stats settle independently of its stopped event loop", { timeout: 5000 }, async t => {
  const pc = new wrtc.RTCPeerConnection();
  const other = new wrtc.RTCPeerConnection();
  t.after(() => { pc.close(); other.close(); });
  const { sender, receiver } = pc.addTransceiver("audio");
  const pending = [pc.getStats(), sender.getStats(), receiver.getStats()];
  pc.close();
  pc.close();
  other.close();
  for (const report of await Promise.all(pending)) assert.ok(report instanceof Map);
  for (let round = 0; round < 3; round++) {
    for (const report of await Promise.all([pc.getStats(), sender.getStats(), receiver.getStats()])) {
      assert.ok(report instanceof Map);
      assert.ok(![...report.values()].some(stat => /^(inbound|outbound)-rtp$/.test(stat.type)));
    }
  }
  await assert.rejects(other._pc.getStats(sender), TypeError);
  await assert.rejects(other._pc.getStats(receiver), TypeError);
  await assert.rejects(pc._pc.getStats({}), TypeError);
});

test("RTP stats filter real outbound and inbound audio streams", { timeout: 15000 }, async t => {
  const [caller, callee] = createRTCPeerConnections();
  const sources = [new wrtc.nonstandard.RTCAudioSource(), new wrtc.nonstandard.RTCAudioSource()];
  const tracks = sources.map(source => source.createTrack());
  const senders = [caller.addTrack(tracks[0]), caller.addTransceiver(tracks[1]).sender];
  const receivers = [];
  const eventReports = [];
  callee.ontrack = event => {
    receivers.push(event.receiver);
    // This must work before getReceivers() performs any bookkeeping.
    eventReports.push(event.receiver.getStats());
  };
  let timer;
  t.after(() => {
    clearInterval(timer);
    caller.close(); callee.close(); tracks.forEach(track => track.stop());
  });
  await negotiate(caller, callee);
  const frame = { samples: new Int16Array(480), sampleRate: 48000,
    bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 };
  timer = setInterval(() => sources.forEach(source => source.onData(frame)), 10);
  const until = Date.now() + 10000;
  let inbound;
  do {
    inbound = await Promise.all(receivers.map(receiver => receiver.getStats()));
    if (inbound.length === 2 && inbound.every(report => [...report.values()]
      .some(stat => stat.type === "inbound-rtp" && stat.packetsReceived > 0))) break;
    await delay(20);
  } while (Date.now() < until);
  assert.equal(inbound.length, 2);
  assert.ok(inbound.every(report => [...report.values()]
    .some(stat => stat.type === "inbound-rtp" && stat.packetsReceived > 0)));
  await Promise.all(eventReports);
  for (const [endpoints, peer, type] of [[senders, caller, "outbound-rtp"], [receivers, callee, "inbound-rtp"]]) {
    const selectedIds = [];
    for (const endpoint of endpoints) {
      const report = await endpoint.getStats();
      const rtp = [...report.values()].filter(stat => stat.type === type);
      assert.equal(rtp.length, 1, "only the selected RTP stream is returned");
      selectedIds.push(rtp[0].id);
      const trackReport = await peer.getStats(endpoint.track);
      assert.deepEqual([...trackReport.keys()].sort(), [...report.keys()].sort());
      for (const stat of report.values()) {
        if (stat.transportId) assert.ok(report.has(stat.transportId));
        if (stat.codecId) assert.ok(report.has(stat.codecId));
      }
    }
    assert.notEqual(selectedIds[0], selectedIds[1]);
    assert.equal([... (await peer.getStats()).values()].filter(stat => stat.type === type).length, 2);
  }
  const pending = [...senders, ...receivers].map(endpoint => endpoint.getStats());
  clearInterval(timer);
  caller.close(); callee.close();
  await Promise.all(pending);
  for (const endpoint of [...senders, ...receivers]) {
    const report = await endpoint.getStats();
    assert.ok(report instanceof Map);
    assert.ok(![...report.values()].some(stat => /^(inbound|outbound)-rtp$/.test(stat.type)),
      "closed endpoints must not reuse active RTP stats");
  }
});
