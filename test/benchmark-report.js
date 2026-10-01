'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const test = require('./lib/test');

function result(platform, arch, mean) {
  return {
    meta: {
      timestamp: '2026-01-01T00:00:00.000Z',
      node: 'v26.0.0',
      platform,
      arch,
      commit: `${platform}-${arch}-commit`,
      suite: 'platform'
    },
    scenarios: {
      pc_create_close_ms: {
        mean,
        stddev: mean * 0.1,
        unit: 'ms',
        lowerIsBetter: true
      }
    },
    comparison: {
      pc_create_close_ms: {
        baselineMean: mean * 2,
        currentMean: mean,
        deltaPercent: -50,
        significanceThresholdPercent: 28.28,
        significant: true,
        lowerIsBetter: true,
        regression: false
      }
    }
  };
}

test('benchmark report renders a compact platform switcher', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrtc-benchmark-report-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  const history = path.join(root, 'history');
  const wptSummary = path.join(root, 'wpt-summary.json');
  fs.mkdirSync(input);
  fs.mkdirSync(history);
  fs.writeFileSync(path.join(input, 'linux.json'), JSON.stringify(result('linux', 'x64', 1)));
  fs.writeFileSync(path.join(input, 'darwin.json'), JSON.stringify(result('darwin', 'arm64', 2)));
  fs.writeFileSync(wptSummary, JSON.stringify({ expectedPass: 58, expectedFail: 75, skipped: 22 }));

  try {
    const rendered = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../scripts/render-benchmark-report.js'), input, output, history, wptSummary],
      { encoding: 'utf8' }
    );
    t.equal(rendered.status, 0, rendered.stderr);
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    t.ok(html.includes('class="platform-tabs"'));
    t.ok(html.includes('data-target="platform-linux-x64" aria-selected="true"'));
    t.ok(html.includes('id="platform-linux-x64"><header>'));
    t.ok(html.includes('id="platform-darwin-arm64" hidden'));
    t.ok(html.includes('class="scenario-grid"'));
    t.ok(html.includes('<details class="history"><summary>History</summary>'));
    t.ok(html.includes('58 expected pass'));
    t.end();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('benchmark report labels changes inside runner noise as inconclusive', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrtc-benchmark-noise-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  const history = path.join(root, 'history');
  fs.mkdirSync(input);
  fs.mkdirSync(history);
  const noisy = result('linux', 'x64', 1.02);
  noisy.comparison.pc_create_close_ms = {
    baselineMean: 1,
    currentMean: 1.02,
    deltaPercent: 2,
    significanceThresholdPercent: 8.5,
    significant: false,
    lowerIsBetter: true,
    regression: false
  };
  fs.writeFileSync(path.join(input, 'linux.json'), JSON.stringify(noisy));

  try {
    const rendered = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../scripts/render-benchmark-report.js'), input, output, history],
      { encoding: 'utf8' }
    );
    t.equal(rendered.status, 0, rendered.stderr);
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    t.ok(html.includes('2.00% within ±8.50% runner noise'));
    t.end();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('implementation comparison exposes reused-result measurement dates', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrtc-benchmark-implementations-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  const history = path.join(root, 'history');
  fs.mkdirSync(input);
  fs.mkdirSync(history);
  fs.writeFileSync(path.join(input, 'linux.json'), JSON.stringify(result('linux', 'x64', 1)));

  for (const [filename, implementation, timestamp, median] of [
    ['project.json', '@vandeurenglenn/wrtc', '2026-02-03T00:00:00.000Z', 1],
    ['alternative.json', 'werift 0.24.4', '2026-01-26T00:00:00.000Z', 2]
  ]) {
    fs.writeFileSync(path.join(input, filename), JSON.stringify({
      meta: {
        timestamp,
        node: 'v26.0.0',
        platform: 'linux',
        arch: 'x64',
        commit: 'implementation-commit',
        implementation,
        suite: 'implementation-comparison'
      },
      scenarios: {
        pc_create_close_ms: {
          mean: median,
          median,
          unit: 'ms',
          lowerIsBetter: true
        }
      }
    }));
  }

  try {
    const rendered = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../scripts/render-benchmark-report.js'), input, output, history],
      { encoding: 'utf8' }
    );
    t.equal(rendered.status, 0, rendered.stderr);
    const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    t.ok(html.includes('Pinned alternatives are refreshed weekly'));
    t.ok(html.includes('werift 0.24.4<small>Node v26.0.0 · measured 2026-01-26'));
    t.ok(html.includes('@vandeurenglenn/wrtc<small>Node v26.0.0 · measured 2026-02-03'));
    t.end();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
