'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

test('dashboard reuse compares the tested merge and rejects changed benchmark inputs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrtc-provenance-'));
  const workflow = yaml.load(fs.readFileSync(path.resolve(__dirname, '../.github/workflows/cross-platform-source-build.yml'), 'utf8'));
  const step = workflow.jobs['deploy-benchmark-pages'].steps.find(step => step.name === 'Download compatible PR benchmark results');
  const selection = step.run.split(/^\s*artifact_count=/m)[0];
  function git(...args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  try {
    git('init', '-b', 'develop');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Test');
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/native.cc'), 'base');
    git('add', '.');
    git('commit', '-m', 'base');
    git('switch', '-c', 'feature');
    fs.writeFileSync(path.join(root, 'README.md'), 'feature');
    git('add', '.');
    git('commit', '-m', 'feature');
    const head = git('rev-parse', 'HEAD');
    git('switch', 'develop');
    fs.writeFileSync(path.join(root, 'src/native.cc'), 'updated base');
    git('add', '.');
    git('commit', '-m', 'update base');
    git('merge', '--no-edit', 'feature');
    const tested = git('rev-parse', 'HEAD');
    git('commit', '--allow-empty', '-m', 'final merge equivalent');
    const provenance = path.join(root, 'tested-commit.txt');
    function select(commit) {
      fs.writeFileSync(provenance, commit + '\n');
      const mock = `gh() {
        if [ "$1" = api ]; then echo success; return; fi
        while [ "$1" != --dir ]; do shift; done
        cp "$PROVENANCE_FILE" "$2/tested-commit.txt"
      }\n`;
      const script = mock + selection + `echo MATCH\ndone <<< $'1\\t${head}'\n`;
      const result = spawnSync('bash', ['-e', '-o', 'pipefail'], {
        input: script, cwd: root, encoding: 'utf8',
        env: { ...process.env, RUNNER_TEMP: root, PROVENANCE_FILE: provenance, GITHUB_REPOSITORY: 'test/repo' }
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.includes('MATCH');
    }
    assert.equal(select(tested), true, 'tested merge is compatible even when PR head is not');
    assert.equal(select(head), false, 'PR-head inputs differ from the final tree');
    assert.equal(select('not-a-commit'), false, 'invalid provenance is rejected');
    fs.writeFileSync(path.join(root, 'src/native.cc'), 'another change');
    git('add', '.');
    git('commit', '-m', 'changed inputs');
    assert.equal(select(tested), false, 'genuine native changes invalidate reuse');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
