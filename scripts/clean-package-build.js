#!/usr/bin/env node

import { rmSync } from "node:fs";

for (const path of ["build/Release/obj.target", "build/Release/.deps"]) {
  rmSync(path, { force: true, recursive: true });
}
