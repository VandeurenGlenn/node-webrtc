export const nativePlatforms = [
  {
    platform: "darwin",
    arch: "arm64",
    packageName: "@vandeurenglenn/wrtc-darwin-arm64",
  },
  {
    platform: "darwin",
    arch: "x64",
    packageName: "@vandeurenglenn/wrtc-darwin-x64",
  },
  {
    platform: "linux",
    arch: "x64",
    packageName: "@vandeurenglenn/wrtc-linux-x64",
  },
  {
    platform: "win32",
    arch: "x64",
    packageName: "@vandeurenglenn/wrtc-win32-x64",
  },
];

export function packageDirectoryName(packageName) {
  return packageName.replace("@vandeurenglenn/", "");
}
