"use strict";

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execSync } from "node:child_process";

let wrtc = null;

function createRTCPeerConnections(
  configuration1 = {},
  configuration2 = {},
  options = {},
) {
  options = {
    handleIce: true,
    ...options,
  };
  const pc1 = new wrtc.RTCPeerConnection(configuration1);
  try {
    const pc2 = new wrtc.RTCPeerConnection(configuration2);
    if (options.handleIce) {
      [
        [pc1, pc2],
        [pc2, pc1],
      ].forEach(([pcA, pcB]) => {
        pcA.addEventListener("icecandidate", ({ candidate }) => {
          if (candidate) {
            pcB.addIceCandidate(candidate);
          }
        });
      });
    }
    return [pc1, pc2];
  } catch (error) {
    pc1.close();
    throw error;
  }
}

async function doOffer(offerer, answerer) {
  const offer = await offerer.createOffer();
  await Promise.all([
    offerer.setLocalDescription(offer),
    answerer.setRemoteDescription(offer),
  ]);
}

async function doAnswer(answerer, offerer) {
  const answer = await answerer.createAnswer();
  await Promise.all([
    answerer.setLocalDescription(answer),
    offerer.setRemoteDescription(answer),
  ]);
}

async function negotiate(offerer, answerer) {
  await doOffer(offerer, answerer);
  await doAnswer(answerer, offerer);
}

async function negotiateRTCPeerConnections(options = {}) {
  options = Object.assign(
    {
      configuration: {},
      pc1Configuration: {},
      pc2Configuration: {},
      withPc1() {},
      withPc2() {},
    },
    options,
  );
  const [pc1, pc2] = createRTCPeerConnections(
    Object.assign({}, options.configuration, options.pc1Configuration),
    Object.assign({}, options.configuration, options.pc2Configuration),
  );
  try {
    options.withPc1(pc1);
    options.withPc2(pc2);
    await negotiate(pc1, pc2);
    return [pc1, pc2];
  } catch (error) {
    pc1.close();
    pc2.close();
    throw error;
  }
}

function parseArgs(argv) {
  const options = {
    iterations: 25,
    warmup: 5,
    messages: 100,
    binaryPayloadBytes: 1024,
    output: "",
    baseline: "",
    regressionThreshold: 5,
    failOnRegression: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--iterations" && next) {
      options.iterations = Number.parseInt(next, 10);
      i += 1;
      continue;
    }

    if (arg === "--warmup" && next) {
      options.warmup = Number.parseInt(next, 10);
      i += 1;
      continue;
    }

    if (arg === "--messages" && next) {
      options.messages = Number.parseInt(next, 10);
      i += 1;
      continue;
    }

    if (arg === "--binary-payload-bytes" && next) {
      options.binaryPayloadBytes = Number.parseInt(next, 10);
      i += 1;
      continue;
    }

    if (arg === "--output" && next) {
      options.output = next;
      i += 1;
      continue;
    }

    if (arg === "--baseline" && next) {
      options.baseline = next;
      i += 1;
      continue;
    }

    if (arg === "--regression-threshold" && next) {
      options.regressionThreshold = Number.parseFloat(next);
      i += 1;
      continue;
    }

    if (arg === "--fail-on-regression") {
      options.failOnRegression = true;
    }
  }

  return options;
}

function round(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function mean(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function percentile(values, p) {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function stdDev(values, avg) {
  const variance =
    values.reduce((acc, value) => {
      const delta = value - avg;
      return acc + delta * delta;
    }, 0) / values.length;
  return Math.sqrt(variance);
}

function summarize(samples) {
  const avg = mean(samples);
  return {
    min: round(Math.min.apply(null, samples), 3),
    max: round(Math.max.apply(null, samples), 3),
    mean: round(avg, 3),
    median: round(percentile(samples, 50), 3),
    p95: round(percentile(samples, 95), 3),
    stddev: round(stdDev(samples, avg), 3),
    samples: samples.map((sample) => round(sample, 3)),
  };
}

function waitForChannelOpen(channel) {
  if (channel.readyState === "open") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("DataChannel closed before opening"));
    };
    const cleanup = () => {
      channel.removeEventListener("open", onOpen);
      channel.removeEventListener("close", onClose);
    };
    channel.addEventListener("open", onOpen);
    channel.addEventListener("close", onClose);
  });
}

function getGitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch (error) {
    return "unknown";
  }
}

async function benchmarkPeerConnectionCreateClose() {
  const start = performance.now();
  const pc = new wrtc.RTCPeerConnection({ iceServers: [] });
  pc.close();
  return performance.now() - start;
}

async function benchmarkNegotiationToDataChannelOpen() {
  let localDataChannel = null;
  let remoteDataChannelPromise = null;
  let remoteDataChannel = null;

  const start = performance.now();

  const peers = await negotiateRTCPeerConnections({
    withPc1(pc1) {
      localDataChannel = pc1.createDataChannel("bench-open");
    },
    withPc2(pc2) {
      remoteDataChannelPromise = new Promise((resolve) => {
        pc2.addEventListener("datachannel", (event) => resolve(event.channel));
      });
    },
  });

  const pc1 = peers[0];
  const pc2 = peers[1];

  try {
    remoteDataChannel = await remoteDataChannelPromise;
    await Promise.all([
      waitForChannelOpen(localDataChannel),
      waitForChannelOpen(remoteDataChannel),
    ]);
    return performance.now() - start;
  } finally {
    if (localDataChannel && localDataChannel.readyState !== "closed") {
      localDataChannel.close();
    }
    if (remoteDataChannel && remoteDataChannel.readyState !== "closed") {
      remoteDataChannel.close();
    }
    pc1.close();
    pc2.close();
  }
}

function waitForEcho(localDataChannel, id) {
  return new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.data === id) {
        localDataChannel.removeEventListener("message", onMessage);
        resolve();
      }
    };
    localDataChannel.addEventListener("message", onMessage);
  });
}

function writeMessageId(payload, id) {
  payload[0] = id & 0xff;
  payload[1] = (id >>> 8) & 0xff;
  payload[2] = (id >>> 16) & 0xff;
  payload[3] = (id >>> 24) & 0xff;
}

function readMessageId(payload) {
  return (
    payload[0] | (payload[1] << 8) | (payload[2] << 16) | (payload[3] << 24)
  );
}

function toUint8Array(data) {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("Expected ArrayBuffer or typed array data");
}

function waitForEchoBinary(localDataChannel, id) {
  return new Promise((resolve) => {
    const onMessage = (event) => {
      const payload = toUint8Array(event.data);
      if (payload.byteLength >= 4 && readMessageId(payload) === id) {
        localDataChannel.removeEventListener("message", onMessage);
        resolve();
      }
    };
    localDataChannel.addEventListener("message", onMessage);
  });
}

async function benchmarkDataChannelRtt(options) {
  let localDataChannel = null;
  let remoteDataChannelPromise = null;
  let remoteDataChannel = null;

  const peers = await negotiateRTCPeerConnections({
    withPc1(pc1) {
      localDataChannel = pc1.createDataChannel("bench-rtt", {
        ordered: false,
        maxRetransmits: 0,
      });
    },
    withPc2(pc2) {
      remoteDataChannelPromise = new Promise((resolve) => {
        pc2.addEventListener("datachannel", (event) => resolve(event.channel));
      });
    },
  });

  const pc1 = peers[0];
  const pc2 = peers[1];

  try {
    remoteDataChannel = await remoteDataChannelPromise;

    remoteDataChannel.addEventListener("message", (event) => {
      remoteDataChannel.send(event.data);
    });

    await Promise.all([
      waitForChannelOpen(localDataChannel),
      waitForChannelOpen(remoteDataChannel),
    ]);

    const rtts = [];
    for (let i = 0; i < options.messages; i += 1) {
      const id = "ping-" + i;
      const started = performance.now();
      const echoed = waitForEcho(localDataChannel, id);
      localDataChannel.send(id);
      await echoed;
      rtts.push(performance.now() - started);
    }

    return mean(rtts);
  } finally {
    if (localDataChannel && localDataChannel.readyState !== "closed") {
      localDataChannel.close();
    }
    if (remoteDataChannel && remoteDataChannel.readyState !== "closed") {
      remoteDataChannel.close();
    }
    pc1.close();
    pc2.close();
  }
}

async function benchmarkDataChannelBinaryRtt(options) {
  let localDataChannel = null;
  let remoteDataChannelPromise = null;
  let remoteDataChannel = null;

  const peers = await negotiateRTCPeerConnections({
    withPc1(pc1) {
      localDataChannel = pc1.createDataChannel("bench-rtt-binary", {
        ordered: false,
        maxRetransmits: 0,
      });
    },
    withPc2(pc2) {
      remoteDataChannelPromise = new Promise((resolve) => {
        pc2.addEventListener("datachannel", (event) => resolve(event.channel));
      });
    },
  });

  const pc1 = peers[0];
  const pc2 = peers[1];

  try {
    remoteDataChannel = await remoteDataChannelPromise;

    remoteDataChannel.addEventListener("message", (event) => {
      remoteDataChannel.send(event.data);
    });

    await Promise.all([
      waitForChannelOpen(localDataChannel),
      waitForChannelOpen(remoteDataChannel),
    ]);

    const payload = new Uint8Array(Math.max(4, options.binaryPayloadBytes));
    const rtts = [];
    for (let i = 0; i < options.messages; i += 1) {
      writeMessageId(payload, i);
      const started = performance.now();
      const echoed = waitForEchoBinary(localDataChannel, i);
      localDataChannel.send(payload);
      await echoed;
      rtts.push(performance.now() - started);
    }

    return mean(rtts);
  } finally {
    if (localDataChannel && localDataChannel.readyState !== "closed") {
      localDataChannel.close();
    }
    if (remoteDataChannel && remoteDataChannel.readyState !== "closed") {
      remoteDataChannel.close();
    }
    pc1.close();
    pc2.close();
  }
}

function formatMs(value) {
  return round(value, 3).toFixed(3) + " ms";
}

function computeComparison(result, baseline, threshold) {
  if (!baseline || !baseline.scenarios) {
    return null;
  }

  const comparison = {};
  Object.keys(result.scenarios).forEach((name) => {
    const current = result.scenarios[name];
    const previous = baseline.scenarios[name];

    if (!previous || typeof previous.mean !== "number") {
      comparison[name] = {
        baselineMissing: true,
      };
      return;
    }

    const delta = current.mean - previous.mean;
    const deltaPercent =
      previous.mean === 0 ? 0 : (delta / previous.mean) * 100;

    comparison[name] = {
      baselineMean: round(previous.mean, 3),
      currentMean: round(current.mean, 3),
      deltaMs: round(delta, 3),
      deltaPercent: round(deltaPercent, 2),
      regression: deltaPercent > threshold,
    };
  });

  return comparison;
}

function printResult(result) {
  console.log("Benchmark run complete");
  console.log("Node: " + result.meta.node);
  console.log("Platform: " + result.meta.platform + " " + result.meta.arch);
  console.log("Commit: " + result.meta.commit);
  console.log(
    "Iterations: " +
      result.meta.iterations +
      " (warmup " +
      result.meta.warmup +
      ")",
  );
  console.log("");

  Object.keys(result.scenarios).forEach((name) => {
    const scenario = result.scenarios[name];
    console.log(name + ":");
    console.log("  mean   : " + formatMs(scenario.mean));
    console.log("  median : " + formatMs(scenario.median));
    console.log("  p95    : " + formatMs(scenario.p95));
    console.log(
      "  min/max: " + formatMs(scenario.min) + " / " + formatMs(scenario.max),
    );
    console.log("  stddev : " + formatMs(scenario.stddev));
    console.log("");
  });

  if (result.comparison) {
    console.log("Comparison:");
    Object.keys(result.comparison).forEach((name) => {
      const value = result.comparison[name];
      if (value.baselineMissing) {
        console.log("  " + name + ": baseline missing");
        return;
      }
      const sign = value.deltaPercent > 0 ? "+" : "";
      const status = value.regression ? "REGRESSION" : "ok";
      console.log(
        "  " +
          name +
          ": " +
          sign +
          value.deltaPercent +
          "% (" +
          sign +
          value.deltaMs +
          " ms) [" +
          status +
          "]",
      );
    });
  }
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

async function run() {
  try {
    wrtc = await import("../lib/index.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      console.error(
        "Unable to load native module. Build or install node-webrtc first.",
      );
      console.error("Try: npm install");
      console.error("Or for source build: SKIP_DOWNLOAD=true npm install");
      process.exit(1);
    }
    throw error;
  }

  const options = parseArgs(process.argv.slice(2));

  if (!Number.isFinite(options.iterations) || options.iterations <= 0) {
    throw new Error("--iterations must be > 0");
  }
  if (!Number.isFinite(options.warmup) || options.warmup < 0) {
    throw new Error("--warmup must be >= 0");
  }
  if (!Number.isFinite(options.messages) || options.messages <= 0) {
    throw new Error("--messages must be > 0");
  }
  if (
    !Number.isFinite(options.binaryPayloadBytes) ||
    options.binaryPayloadBytes <= 0
  ) {
    throw new Error("--binary-payload-bytes must be > 0");
  }

  const scenarios = [
    {
      name: "pc_create_close_ms",
      run: benchmarkPeerConnectionCreateClose,
    },
    {
      name: "pc_negotiate_datachannel_open_ms",
      run: benchmarkNegotiationToDataChannelOpen,
    },
    {
      name: "datachannel_unordered_unreliable_rtt_ms",
      run: () => benchmarkDataChannelRtt(options),
    },
    {
      name: "datachannel_unordered_unreliable_binary_rtt_ms",
      run: () => benchmarkDataChannelBinaryRtt(options),
    },
  ];

  const scenarioResults = {};

  for (let s = 0; s < scenarios.length; s += 1) {
    const scenario = scenarios[s];

    for (let warmup = 0; warmup < options.warmup; warmup += 1) {
      await scenario.run();
    }

    const samples = [];
    for (let i = 0; i < options.iterations; i += 1) {
      const sample = await scenario.run();
      samples.push(sample);
    }

    scenarioResults[scenario.name] = summarize(samples);
  }

  const now = new Date();
  const defaultOutput = path.join(
    "benchmarks",
    "results",
    now.toISOString().replace(/[:.]/g, "-") + ".json",
  );

  const outputPath = options.output || defaultOutput;

  let baseline = null;
  if (options.baseline) {
    baseline = JSON.parse(fs.readFileSync(options.baseline, "utf8"));
  }

  const result = {
    meta: {
      timestamp: now.toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      commit: getGitCommit(),
      iterations: options.iterations,
      warmup: options.warmup,
      messagesPerIteration: options.messages,
      binaryPayloadBytes: options.binaryPayloadBytes,
    },
    scenarios: scenarioResults,
    comparison: computeComparison(
      { scenarios: scenarioResults },
      baseline,
      options.regressionThreshold,
    ),
  };

  ensureParentDir(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");

  printResult(result);
  console.log("Saved: " + outputPath);

  let exitCode = 0;
  if (options.failOnRegression && result.comparison) {
    const names = Object.keys(result.comparison);
    const hasRegression = names.some(
      (name) => result.comparison[name].regression,
    );
    if (hasRegression) {
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
