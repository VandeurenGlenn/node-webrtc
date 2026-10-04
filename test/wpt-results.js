'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createReport, summarizeResults } = require('./web-platform-tests/result-report');
const { RTCDataChannelEvent, RTCPeerConnection } = require('..');

test('WPT reports actual subtests inside expected-failure files and incomplete runs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrtc-wpt-results-'));
  try {
    const filename = path.join(root, 'results.json');
    const report = createReport(filename, { node: process.version });
    report.plan('mixed.html', 'fail', 'known issue');
    report.plan('skipped.html', 'skip', 'needs a browser');
    report.plan('interrupted.html', 'pass', null);
    report.complete('mixed.html', [0, 1, 2, 3, 99].map(status => ({ name: String(status), status })),
      { status: 1, message: 'harness error' }, [new Error('uncaught')]);
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(saved.files['mixed.html'].expectation, 'fail');
    assert.match(saved.files['mixed.html'].exceptions[0], /uncaught/);
    assert.deepEqual(summarizeResults(saved), {
      completedFiles: 1, pendingFiles: 1, skippedFiles: 1,
      pass: 1, fail: 1, timeout: 1, notRun: 1, unknown: 1, harnessErrors: 1, exceptions: 1
    });
    const summaryFile = path.join(root, 'summary.json');
    const summaryRun = spawnSync(process.execPath,
      [path.resolve(__dirname, '../scripts/summarize-wpt.js'), summaryFile, filename],
      { encoding: 'utf8' });
    assert.equal(summaryRun.status, 0, summaryRun.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(summaryFile, 'utf8')).observed, summarizeResults(saved));
    // A new run must not retain successes from a previous attempt.
    createReport(filename);
    assert.deepEqual(JSON.parse(fs.readFileSync(filename, 'utf8')).files, {});
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('RTCDataChannelEvent requires a genuine channel and exposes it read-only', () => {
  assert.equal(RTCDataChannelEvent.length, 2);
  assert.throws(() => new RTCDataChannelEvent('datachannel'), TypeError);
  for (const channel of [null, undefined, {}, { readyState: 'open' }]) {
    assert.throws(() => new RTCDataChannelEvent('datachannel', { channel }), TypeError);
  }
  const pc = new RTCPeerConnection();
  try {
    const channel = pc.createDataChannel('');
    const event = new RTCDataChannelEvent('datachannel', { channel });
    assert.equal(event.channel, channel);
    assert.throws(() => { event.channel = null; }, TypeError);
    assert.throws(() => RTCDataChannelEvent('datachannel', { channel }), TypeError);
  } finally {
    pc.close();
  }
});
