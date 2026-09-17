/* eslint no-console:0 */
'use strict';

var tape = require('./lib/test');
var wrtc = require('..');
var gatherCandidates = require('./lib/pc').gatherCandidates;

tape('custom ports connect once', async function(t) {
  const portRange = { min: 40000, max: 49999 };
  const candidates = await gatherCandidatesInRange(portRange);
  t.ok(candidates.length > 0, 'gathered candidates');
  t.ok(candidates.every(candidate => isValidCandidate(candidate.candidate, portRange)),
    'all candidates use the custom port range');
});

tape('custom ports connect concurrently', async function(t) {
  const n = 2;
  const portRange = { min: 40000, max: 49999 };
  const results = await Promise.all(
    Array.from({ length: n }, () => gatherCandidatesInRange(portRange))
  );
  t.ok(results.every(candidates => candidates.length > 0),
    'all peer connections gathered candidates');
  t.ok(results.flat().every(candidate => isValidCandidate(candidate.candidate, portRange)),
    'all concurrent candidates use the custom port range');
});

async function gatherCandidatesInRange(portRange) {
  const pc = new wrtc.RTCPeerConnection({ iceServers: [], portRange });
  try {
    pc.createDataChannel('custom-port-test');
    const candidatesPromise = gatherCandidates(pc);
    await pc.setLocalDescription(await pc.createOffer());
    return await candidatesPromise;
  } finally {
    pc.close();
  }
}

function isValidCandidate(candidate, portRange) {
  const fields = candidate.trim().split(/\s+/);
  const protocol = fields[2].toLowerCase();
  const port = Number(fields[5]);
  // Active TCP candidates use the ICE discard port sentinel rather than a
  // locally bound allocator port (RFC 6544, section 4.5).
  if (protocol === 'tcp' && port === 9 && fields.includes('active')) {
    return true;
  }
  return Number.isInteger(port) && port >= portRange.min && port <= portRange.max;
}
