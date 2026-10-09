'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

test('stopped stats patch is idempotent and rejects unknown source without partial edits', () => {
  const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', String.raw`
import runpy
import tempfile
from pathlib import Path

module = runpy.run_path('scripts/patch-webrtc-stopped-stats.py')
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    for filename, edits in module['replacements']().items():
        target = root / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('\n'.join(before for before, after in edits))
    module['patch'](root)
    first = {file: (root / file).read_bytes() for file in module['replacements']()}
    module['patch'](root)
    assert first == {file: (root / file).read_bytes() for file in first}
    # The first file is valid, but the second has a changed upstream anchor.
    for filename, edits in module['replacements']().items():
        (root / filename).write_text('\n'.join(before for before, after in edits))
    (root / 'pc/rtc_stats_collector.cc').write_text('unexpected upstream revision')
    before = {file: (root / file).read_bytes() for file in first}
    try:
        module['patch'](root)
    except SystemExit:
        pass
    else:
        raise AssertionError('unknown revision must fail closed')
    assert before == {file: (root / file).read_bytes() for file in first}
`], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || String(result.error || 'patch verification'));
});

test('every WebRTC and native-addon fingerprint includes the stats patch', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/cross-platform-source-build.yml'), 'utf8');
  const fingerprints = workflow.split('\n').filter(line => line.includes('hashFiles(')
    && line.includes('patch-webrtc-modern-cpp.py'));
  assert.equal(fingerprints.length, 4);
  for (const fingerprint of fingerprints) assert.ok(fingerprint.includes('scripts/patch-webrtc-stopped-stats.py'));
  const entry = fs.readFileSync(path.resolve(__dirname, '../scripts/patch-webrtc-base64.sh'), 'utf8');
  assert.ok(entry.includes('"$python_bin" "$script_dir/patch-webrtc-stopped-stats.py" "$1"'));
});
