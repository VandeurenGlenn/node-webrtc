<h1 align="center">
  <img height="120px" src="https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img height="120px" src="https://webrtc.github.io/webrtc-org/assets/images/webrtc-logo-vert-retro-dist.svg" />
</h1>

[![npm version](https://img.shields.io/npm/v/%40vandeurenglenn%2Fwrtc.svg)](https://www.npmjs.com/package/@vandeurenglenn/wrtc)
[![npm downloads](https://img.shields.io/npm/dm/%40vandeurenglenn%2Fwrtc.svg)](https://www.npmjs.com/package/@vandeurenglenn/wrtc)
[![Node.js](https://img.shields.io/node/v/%40vandeurenglenn%2Fwrtc.svg?logo=node.js&logoColor=white)](package.json)
[![license](https://img.shields.io/npm/l/%40vandeurenglenn%2Fwrtc.svg)](LICENSE.md)
[![GitHub release](https://img.shields.io/github/v/release/VandeurenGlenn/node-webrtc)](https://github.com/VandeurenGlenn/node-webrtc/releases/latest)
[![Cross Platform Source Build](https://github.com/VandeurenGlenn/node-webrtc/actions/workflows/cross-platform-source-build.yml/badge.svg?branch=develop)](https://github.com/VandeurenGlenn/node-webrtc/actions/workflows/cross-platform-source-build.yml)
[![WPT](https://img.shields.io/endpoint?url=https%3A%2F%2Fvandeurenglenn.github.io%2Fnode-webrtc%2Fwpt-badge.json)](https://github.com/VandeurenGlenn/node-webrtc/actions/workflows/cross-platform-source-build.yml)
[![benchmarks](https://img.shields.io/badge/benchmarks-dashboard-a371f7)](https://vandeurenglenn.github.io/node-webrtc/)

node-webrtc is a Node.js Native Addon that provides bindings to [WebRTC M154, branch-heads/8037](https://chromium.googlesource.com/external/webrtc/+/branch-heads/8037). This project aims for spec-compliance and is tested using the W3C's [web-platform-tests](https://github.com/web-platform-tests/wpt) project. A number of [nonstandard APIs](docs/nonstandard-apis.md) for testing are also included.

Modern source builds are continuously tested with Node.js 24 and 26 on Linux,
macOS, and Windows. WebRTC uses its Chromium Clang toolchain on Linux, Chromium
`clang-cl` on Windows, and its pinned toolchain on macOS. The addon and WebRTC
share each platform's standard C++ library ABI.

The WPT badge reports actual subtest passes, failures (including expected
failures), and timeouts, plus the number of skipped files. A green CI job means
the recorded expectations matched; it does **not** mean every WPT passed.
Download the `wpt-status` Actions artifact for `wpt-results.json`, including
individual failure names/messages, harness errors, and pending files if a run
was interrupted. The current suite uses a pinned legacy WPT snapshot and a
jsdom harness, not a full browser; browser-only skips are not evidence of native
WebRTC conformance. Snapshot modernization is a separate follow-up.

Node.js 24.15 or newer is required. The package uses the platform-provided
`DOMException` instead of the deprecated userland polyfill.

Windows source builds use Visual Studio 2022 and Windows SDK 10.0.28000 for
CMake and the Node addon; WebRTC itself is compiled with its bundled
`clang-cl`.

---

Install
-------

```sh
npm install @vandeurenglenn/wrtc
```

The package manager selects a small optional native package for the current
operating system and architecture. Installation does not execute a downloader
or build script.

You can also [build from source](docs/build-from-source.md).

Supported Platforms
-------------------

Release `v0.7.1` provides N-API v3 binaries for Linux x64, macOS
x64/arm64, and Windows x64. N-API keeps those binaries ABI-compatible across
supported Node.js versions. Other platform and architecture combinations can
use the [source build](docs/build-from-source.md).

The next release also provides Linux ARM64 binaries for native ARM servers,
containers, and single-board computers.

Migration to v0.7
-----------------

The callback-based legacy `RTCPeerConnection#getStats(success, failure)` API
has been removed. Use the standards-based Promise API instead:

```js
const stats = await peerConnection.getStats();
```

Targeted reports are also available through `sender.getStats()`,
`receiver.getStats()`, and `peerConnection.getStats(track)`. WebRTC filters these
reports to the selected RTP stream and its referenced stats, rather than
returning the entire connection report. A track selector must match exactly
one sender or receiver; missing or ambiguous matches reject with
`InvalidAccessError`.

The WPT runner uses unchanged modern upstream sender/receiver stats tests with
an isolated helper. Remaining failures (including closed-peer stats and remote
track readiness) stay visible in the `wpt-results.json` Actions artifact. A green
WPT job means the recorded expectations matched, not that every subtest passed.

Examples
--------

See [node-webrtc/node-webrtc-examples](https://github.com/node-webrtc/node-webrtc-examples).

Contributing
------------

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the local
build, test, and pull-request workflow.

Benchmarking
------------

A repeatable benchmark harness is available to detect performance regressions while improving the library.

See [docs/benchmarking.md](docs/benchmarking.md) for usage and workflow.
