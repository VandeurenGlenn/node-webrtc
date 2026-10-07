'use strict';

const fs = require('node:fs');
const path = require('node:path');

const documents = new Set([
  '/webrtc/RTCRtpSender-getStats.https.html',
  '/webrtc/RTCRtpReceiver-getStats.https.html'
]);
const helper = '/webrtc/stats/RTCPeerConnection-helper.js';
exports.isStatsDocument = pathname => documents.has(pathname);

exports.readStatsResource = pathname => {
  if (!documents.has(pathname) && pathname !== helper) return undefined;
  const filename = path.join(__dirname, 'overrides', pathname);
  let body = fs.readFileSync(filename, 'utf8');
  if (documents.has(pathname)) {
    // Only relocate the helper URL. The checked-in upstream documents and all
    // their assertions stay byte-for-byte unchanged; old tests keep old helpers.
    body = body.replace('src="RTCPeerConnection-helper.js"',
      'src="stats/RTCPeerConnection-helper.js"');
  }
  return { body, contentType: pathname === helper ? 'application/javascript' : 'text/html' };
};
