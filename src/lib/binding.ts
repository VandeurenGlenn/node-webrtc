// @ts-nocheck
"use strict";

import { createRequire } from "module";

const require = createRequire(import.meta.url);

let binding;

try {
  binding = require("../build/Debug/wrtc.node");
} catch (error) {
  binding = require("../build/Release/wrtc.node");
}

export default binding;
