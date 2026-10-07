Targeted upstream stats tests
============================

The two RTP endpoint stats documents and their isolated peerconnection helper
are copied unchanged from upstream revision
`e9b7718c7db0682db8f2d0ee0e30e49b2e391a66`:

- https://github.com/web-platform-tests/wpt/blob/e9b7718c7db0682db8f2d0ee0e30e49b2e391a66/webrtc/RTCRtpSender-getStats.https.html
- https://github.com/web-platform-tests/wpt/blob/e9b7718c7db0682db8f2d0ee0e30e49b2e391a66/webrtc/RTCRtpReceiver-getStats.https.html
- https://github.com/web-platform-tests/wpt/blob/e9b7718c7db0682db8f2d0ee0e30e49b2e391a66/webrtc/RTCPeerConnection-helper.js

`upstream-stats.js` relocates only the helper script URL when serving these
documents. Other WPT documents retain the pinned helper. No test assertion or
test selection is changed. The receiver document's no-query URL runs both
upstream variant groups. These tests cover active, stopped, and closed endpoint
reports and referenced ICE candidate stats (10 subtests total).

For these two documents only, the headless runner supplies generated audio via
`stats-media.js` instead of device capture. The tracks, encoders, transports,
received RTP, stats and events are all real native objects; the fixture changes
only media input and cleans up sources/timers when the window closes. It does
not implement or override receiver readiness or stats assertions.

These files are covered by the upstream WPT license in the submodule's
`LICENSE.md`. The full snapshot and harness migration remains separate.
