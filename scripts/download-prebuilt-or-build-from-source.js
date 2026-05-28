#!/usr/bin/env node
/* eslint no-console:0, no-process-env:0 */

import build from "./build-from-source.js";
import download from "./download-prebuilt.js";

function main() {
  if (!process.env.SKIP_DOWNLOAD) {
    try {
      console.log("Searching for a pre-built wrtc binary");
      download();
      console.log("Installed a pre-built wrtc binary");
      return;
    } catch (error) {
      console.log(
        "Unable to install a pre-built wrtc binary; falling back to ncmake",
      );
    }
  }
  build();
}

main();
