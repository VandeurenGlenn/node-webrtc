Targeted upstream WPT updates
============================

These files replace matching documents in the legacy pinned snapshot when the
jsdom harness loads them. Assertions are copied unchanged from upstream, not
relaxed to match this implementation. Shared testharness/helper resources still
come from the pinned snapshot; the full snapshot migration remains separate.

`webrtc/RTCPeerConnection-setLocalDescription-parameterless.https.html`:

- Source: https://github.com/web-platform-tests/wpt/blob/e9b7718c7db0682db8f2d0ee0e30e49b2e391a66/webrtc/RTCPeerConnection-setLocalDescription-parameterless.https.html
- Revision: `e9b7718c7db0682db8f2d0ee0e30e49b2e391a66`.
- Corrects the obsolete already-closed-peer expectation and includes both
  upstream variants (the no-query URL executes both groups).
- Covered by the upstream WPT license in the submodule's `LICENSE.md`.
