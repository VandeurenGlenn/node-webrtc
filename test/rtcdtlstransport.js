'use strict';

const test = require('./lib/test');
const { Certificate } = require('@fidm/x509');

const {
  RTCDtlsTransport,
  RTCIceTransport
} = require('..');

const {
  createRTCPeerConnections,
  negotiate,
  waitForStateChange
} = require('./lib/pc');

function createCandidateRelay(source, target) {
  const pendingCandidates = [];
  let started = false;
  let rejectRelay;
  const failed = new Promise((_, reject) => {
    rejectRelay = reject;
  });

  function relay(candidate) {
    if (target.signalingState === 'closed') return;
    target.addIceCandidate(candidate).catch(error => {
      if (target.signalingState !== 'closed') rejectRelay(error);
    });
  }

  source.addEventListener('icecandidate', ({ candidate }) => {
    if (!candidate) return;
    if (started) relay(candidate);
    else pendingCandidates.push(candidate);
  });

  return {
    failed,
    start() {
      started = true;
      pendingCandidates.splice(0).forEach(relay);
    }
  };
}

function rejectAfter(milliseconds, message) {
  let timeout;
  return {
    promise: new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
    clear() {
      clearTimeout(timeout);
    }
  };
}

async function testDtlsTransportAttempt(t, createSenderOrReceiver) {
  const [pc1, pc2] = createRTCPeerConnections({}, {}, { handleIce: false });
  try {
    const senderOrReceiver = createSenderOrReceiver(pc1);
    t.equal(senderOrReceiver.transport, null, 'transport is initially null');

    // Queue trickled candidates until both remote descriptions exist. Waiting
    // for ICE gathering to complete before exchanging anything can stall on
    // virtualized macOS runners even though usable host candidates are ready.
    const relay1 = createCandidateRelay(pc1, pc2);
    const relay2 = createCandidateRelay(pc2, pc1);

    await negotiate(pc1, pc2);

    const { transport } = senderOrReceiver;
    t.ok(transport instanceof RTCDtlsTransport, 'transport is no longer null');
    t.equal(transport.state, 'new', '.state is initially "new"');
    t.ok(transport.iceTransport instanceof RTCIceTransport, '.iceTransport is not null');
    t.equal(transport.iceTransport.state, 'new', '.iceTransport.state is also "new"');
    t.equal(transport.iceTransport.component, 'rtp', '.iceTransport.component is "rtp"');
    t.equal(transport.iceTransport.role, 'controlling', '.iceTransport.role is "controlling"');

    const connectingPromise = waitForStateChange(transport, 'connecting');
    const connectedPromise = waitForStateChange(transport, 'connected');

    relay1.start();
    relay2.start();

    const connectionTimeout = rejectAfter(12000, 'DTLS transport did not connect within 12 seconds');
    try {
      if (transport.state !== 'connecting' && transport.state !== 'connected') {
        await Promise.race([
          connectingPromise,
          relay1.failed,
          relay2.failed,
          connectionTimeout.promise
        ]);
      }
      t.ok(transport.state === 'connecting' || transport.state === 'connected', '.state transitions to "connecting" (or "connected")');
      t.ok(transport.iceTransport.state === 'checking' || transport.iceTransport.state === 'connected', '.state transitions to "checking" (or "connected")');

      await Promise.race([
        connectedPromise,
        relay1.failed,
        relay2.failed,
        connectionTimeout.promise
      ]);
    } finally {
      connectionTimeout.clear();
    }

    t.pass('"statechange" fires in state "connected"');
    t.equal(transport.state, 'connected', '.state is "connected"');
    t.equal(transport.iceTransport.state, 'connected', '.iceTransport.state is also "connected"');

    const remoteCertificates = transport.getRemoteCertificates();
    t.ok(remoteCertificates.length > 0, 'getRemoteCertificates() returns at least one remote certificate');
    remoteCertificates.forEach((derBuffer, i) => {
      t.ok(derBuffer instanceof ArrayBuffer, `remote certificate ${i + 1} is an ArrayBuffer`);
      // NOTE(mroberts): https://stackoverflow.com/a/48309802
      const prefix = '-----BEGIN CERTIFICATE-----\n';
      const postfix = '-----END CERTIFICATE-----';
      const pemText = prefix + Buffer.from(derBuffer).toString('base64').match(/.{0,64}/g).join('\n') + postfix;
      const cert = Certificate.fromPEM(pemText);
      t.equal(cert.issuer.commonName, 'WebRTC', 'Issuer is "WebRTC"');
      t.pass(`parsed remote certificate ${i + 1}`);
    });

    pc1.close();
    pc2.close();

    t.equal(senderOrReceiver.transport, transport, 'transport is still not null');
    t.equal(transport.state, 'closed', '.state is finally "closed"');
    t.ok(transport.iceTransport instanceof RTCIceTransport, '.iceTransport is still not null');
    t.equal(transport.iceTransport.state, 'closed', '.iceTransport.state is "closed"');
    t.equal(transport.iceTransport.component, 'rtp', '.iceTransport.component is still "rtp"');
    t.equal(transport.iceTransport.role, 'controlling', '.iceTransport.role is still "controlling"');
  } finally {
    pc1.close();
    pc2.close();
  }
}

async function testDtlsTransport(t, createSenderOrReceiver) {
  try {
    await testDtlsTransportAttempt(t, createSenderOrReceiver);
  } catch (firstError) {
    console.warn(`Retrying DTLS transport test: ${firstError.message}`);
    await testDtlsTransportAttempt(t, createSenderOrReceiver);
  }
  t.end();
}

test('RTCDtlsTransport accessed via RTCRtpSender .transport', t =>
  testDtlsTransport(t, pc => pc.addTransceiver('audio').sender));

test('RTCDtlsTransport accessed via RTCRtpReceiver .transport', t =>
  testDtlsTransport(t, pc => pc.addTransceiver('audio').receiver));
