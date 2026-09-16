"use strict";

import fs from "node:fs";

fs.rmSync(new URL("../test/web-platform-tests/tests", import.meta.url), {
  recursive: true,
  force: true,
});
