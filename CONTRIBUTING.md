# Contributing

Development targets the WebRTC revision pinned in `CMakeLists.txt`. Avoid
updating WebRTC and unrelated addon behavior in the same pull request.

## Local workflow

1. Install the prerequisites in [docs/build-from-source.md](docs/build-from-source.md).
2. Run `npm install --ignore-scripts`.
3. Build with `npm run build`.
4. Run `npm test` and, for performance-sensitive changes, `npm run bench`.

The first source build downloads WebRTC and its toolchain. Preserve
`build/external` between builds so later verification remains incremental.

## Pull requests

Describe the affected platforms and include the verification you ran. The
cross-platform source-build workflow validates Linux, macOS, and Windows before
merge. Keep generated build output out of commits.
