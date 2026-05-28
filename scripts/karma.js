#!/usr/bin/env node
/* eslint no-console:0, no-process-env:0, no-process-exit:0 */

import { fork, spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("Starting server");
let server = fork(join(__dirname, "..", "karma", "server.js"));
console.log("Server PID is " + server.pid);

server.once("error", function (error) {
  console.error("Failed to start server: " + error.stack);
  exit(error.code);
});

server.once("exit", function (code) {
  if (code) {
    console.error("Server closed in error");
    exit(code);
  }
});

const configFile = join(__dirname, "..", "karma", "karma.conf.js");

console.log("Starting Karma");
let karma = spawn(
  join(__dirname, "..", "node_modules", ".bin", "karma"),
  ["start", configFile],
  {
    env: Object.assign(
      {
        FILE: join(__dirname, "..", "karma", "client.js"),
      },
      process.env,
    ),
    shell: true,
    stdio: "inherit",
  },
);
console.log("Karma PID is " + karma.pid);

karma.once("error", function (error) {
  console.error("Failed to start Karma: " + error.stack);
  exit(1);
});

karma.once("exit", function (code) {
  if (code) {
    console.error("Karma closed in error");
    exit(code);
  } else {
    console.log("Karma succeeded");
    exit(0);
  }
});

process.once("exit", exit);
process.once("SIGINT", exit);
process.once("SIGUSR1", exit);
process.once("SIGUSR2", exit);
process.once("uncaughtException", exit);

function exit(code) {
  if (server) {
    server.kill();
    server = null;
  }

  if (karma) {
    karma.kill();
    karma = null;
  }

  process.exit(code);
}
