<h1 align="center">
  <img height="120px" src="https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg" />&nbsp;&nbsp;&nbsp;&nbsp;
  <img height="120px" src="https://webrtc.github.io/webrtc-org/assets/images/webrtc-logo-vert-retro-dist.svg" />
</h1>

[![NPM](https://img.shields.io/npm/v/%40vandeurenglenn%2Fwrtc.svg)](https://www.npmjs.com/package/@vandeurenglenn/wrtc) [![Cross Platform Source Build](https://github.com/VandeurenGlenn/node-webrtc/actions/workflows/cross-platform-source-build.yml/badge.svg?branch=develop)](https://github.com/VandeurenGlenn/node-webrtc/actions/workflows/cross-platform-source-build.yml)

node-webrtc is a Node.js Native Addon that provides bindings to [WebRTC M152, branch-heads/7977](https://chromium.googlesource.com/external/webrtc/+/branch-heads/7977). This project aims for spec-compliance and is tested using the W3C's [web-platform-tests](https://github.com/web-platform-tests/wpt) project. A number of [nonstandard APIs](docs/nonstandard-apis.md) for testing are also included.

Modern source builds are continuously tested with Node.js 26 on Linux, macOS,
and Windows. WebRTC uses its Chromium Clang toolchain on Linux, Chromium
`clang-cl` on Windows, and its pinned toolchain on macOS. The addon and WebRTC
share each platform's standard C++ library ABI.

Node.js 20 or newer is required. The package uses the platform-provided
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

Release `v0.5.5` provides N-API v3 binaries for Linux x64, macOS arm64, and
Windows x64. N-API keeps those binaries ABI-compatible across supported Node.js
versions, including the Node 26 jobs used by CI. Other platform and architecture
combinations can use the [source build](docs/build-from-source.md).

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
