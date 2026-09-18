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

node-webrtc is a Node.js Native Addon that provides bindings to [WebRTC M152, branch-heads/7977](https://chromium.googlesource.com/external/webrtc/+/branch-heads/7977). This project aims for spec-compliance and is tested using the W3C's [web-platform-tests](https://github.com/web-platform-tests/wpt) project. A number of [nonstandard APIs](docs/nonstandard-apis.md) for testing are also included.

Modern source builds are continuously tested with Node.js 24 and 26 on Linux,
macOS, and Windows. WebRTC uses its Chromium Clang toolchain on Linux, Chromium
`clang-cl` on Windows, and its pinned toolchain on macOS. The addon and WebRTC
share each platform's standard C++ library ABI.

Node.js 24.15 or newer is required. The package uses the platform-provided
`DOMException` instead of the deprecated userland polyfill.

Windows source builds use Visual Studio 2022 for CMake and the Node addon;
WebRTC itself is compiled with its bundled `clang-cl`.

---

Install
-------

```sh
npm install @vandeurenglenn/wrtc
```

Installing from NPM downloads a prebuilt binary for your operating system × architecture. Set the `TARGET_ARCH` environment variable to "arm" or "arm64" to download for armv7l or arm64, respectively. Linux and macOS users can also set the `DEBUG` environment variable to download debug builds.

You can also [build from source](docs/build-from-source.md).

Supported Platforms
-------------------

Release `v0.7.0` provides N-API v3 binaries for Linux x64, macOS
x64/arm64, and Windows x64. N-API keeps those binaries ABI-compatible across
supported Node.js versions. Other platform and architecture combinations can
use the [source build](docs/build-from-source.md).

Migration to v0.7
-----------------

The callback-based legacy `RTCPeerConnection#getStats(success, failure)` API
has been removed. Use the standards-based Promise API instead:

```js
const stats = await peerConnection.getStats();
```

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
