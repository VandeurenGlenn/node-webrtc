# Build from Source

Pull-request CI reuses platform-specific, pinned libwebrtc artifacts when the
WebRTC revision and build inputs are unchanged. Changes to CMake or the WebRTC
download, configure, build, or patch scripts automatically force a full rebuild.
Documentation-only pull requests skip the native build matrix. Set
`WEBRTC_PREBUILT=1` only when the matching tree is already present below
`build/external/libwebrtc`; normal local builds should leave it unset.

node-webrtc builds the pinned WebRTC M152 (`branch-heads/7977`) checkout with
[node-cmake](https://github.com/cjntaylor/node-cmake).

## Prerequisites

All platforms require Git, CMake, Node.js, and npm. In addition, install:

* Linux: Ninja and the standard C++ development packages.
* macOS: Xcode Command Line Tools and Ninja.
* Windows: Microsoft Visual Studio 2022 with the Desktop development with C++
  workload. CI compiles the addon with `clang-cl` and links with `lld-link`,
  matching the LLVM archive format produced by WebRTC M152.

The build downloads the matching Chromium `depot_tools`, WebRTC source, and
WebRTC compiler toolchain automatically. The first build is consequently much
slower than subsequent builds.

## Build

Clone this repository, install package dependencies without running the package
install hook, and start the source build:

```sh
git clone https://github.com/VandeurenGlenn/node-webrtc.git
cd node-webrtc
npm install --ignore-scripts
npm run build
```

Use `npm run build` again for subsequent incremental builds. The WebRTC checkout
below `build/external/libwebrtc/download` is reused when its pinned revision and
build inputs have not changed.

Set `DEBUG=1` for a debug build. `TARGET_ARCH=arm` and `TARGET_ARCH=arm64` select
the corresponding Linux cross-build targets.

## Platform toolchains

### Linux

WebRTC is compiled with Chromium's pinned Clang. WebRTC and the Node addon both
use the system `libstdc++`, preventing C++ ABI mismatches at their boundary.

For Linux cross-builds, install the appropriate cross compiler, set
`TARGET_ARCH` to `arm` or `arm64`, and set `ARM_TOOLS_PATH` to its root.

### macOS

WebRTC uses its pinned Clang toolchain and the addon uses Xcode Clang. Both use
the platform libc++ ABI. The minimum supported SDK is selected automatically.

### Windows

Visual Studio 2022 configures and builds the Node addon. WebRTC itself uses its
bundled Chromium `clang-cl`; both sides use the Microsoft standard library ABI.
Run the build from a Visual Studio Developer PowerShell or another shell in
which the Visual Studio C++ environment is available.

Long paths may need to be enabled before checking out WebRTC:

```powershell
git config --global core.longpaths true
```

## Tests

Run the native unit and integration tests with:

```sh
npm test
```

Run the Web Platform Tests with:

```sh
npm run wpt:init
npm run wpt:test
```

The browser-facing test suite can be run with:

```sh
npm run test:browsers
```

For benchmark instructions, see [benchmarking.md](benchmarking.md).
