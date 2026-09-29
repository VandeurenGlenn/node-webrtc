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
        unit: 'ms',
        lowerIsBetter: true
      }
    },
    comparison: {
      pc_create_close_ms: {
        baselineMean: mean * 2,
        currentMean: mean,
        deltaPercent: -50,
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
  fs.mkdirSync(input);
  fs.mkdirSync(history);
  fs.writeFileSync(path.join(input, 'linux.json'), JSON.stringify(result('linux', 'x64', 1)));
  fs.writeFileSync(path.join(input, 'darwin.json'), JSON.stringify(result('darwin', 'arm64', 2)));

  try {
    const rendered = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../scripts/render-benchmark-report.js'), input, output, history],
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
    t.end();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
