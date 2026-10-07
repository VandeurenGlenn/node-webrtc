'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '..');

function runInstaller(t, packages, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wrtc-apt-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  const sources = path.join(directory, 'apt');
  const log = path.join(directory, 'commands.jsonl');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(sources, 'sources.list.d'), { recursive: true });
  const source = path.join(sources, 'sources.list.d', 'ubuntu.sources');
  const mirror = path.join(sources, 'apt-mirrors.txt');
  const sourceBody = options.mirrorList
    ? `URIs: mirror+file:${mirror}\nSuites: noble\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n`
    : 'URIs: http://azure.archive.ubuntu.com/ubuntu\nSuites: noble\n';
  fs.writeFileSync(source, sourceBody);
  if (options.mirrorList) fs.writeFileSync(mirror,
    'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n' +
    'https://archive.ubuntu.com/ubuntu/\tpriority:2\n' +
    'https://security.ubuntu.com/ubuntu/\tpriority:3\n');
  const mock = `#!/usr/bin/env node
    const fs = require('node:fs');
    const path = require('node:path');
    const { spawnSync } = require('node:child_process');
    const command = path.basename(process.argv[1]);
    const args = process.argv.slice(2);
    fs.appendFileSync(process.env.APT_TEST_LOG, JSON.stringify({ command, args }) + '\\n');
    if (command === 'dpkg-query') {
      if (process.env.APT_TEST_INSTALLED.split(',').includes(args.at(-1))) {
        process.stdout.write('installed');
      } else process.exitCode = 1;
    } else if (command === 'sudo' || command === 'timeout') {
      const child = command === 'sudo' ? args : args.slice(3);
      const result = spawnSync(child[0], child.slice(1), { stdio: 'inherit' });
      process.exitCode = result.status ?? 1;
    } else if (command === 'sed') {
      // Execute the real, portable regex transform on a temporary fixture.
      // Only emulate GNU in-place editing, which differs on macOS.
      const result = spawnSync('/usr/bin/sed', ['-E', args[2], args[3]], { encoding: 'utf8' });
      if (result.status === 0) fs.writeFileSync(args[3], result.stdout);
      else { process.stderr.write(result.stderr); process.exitCode = result.status ?? 1; }
    } else if (command === 'apt-get' && args.includes('update') && process.env.APT_TEST_FAIL_UPDATE === '1') {
      process.exitCode = 9;
    }
  `;
  for (const command of ['dpkg-query', 'sudo', 'timeout', 'apt-get', 'sed']) {
    fs.writeFileSync(path.join(bin, command), mock, { mode: 0o755 });
  }
  const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
    APT_SOURCES_DIR: sources, APT_TEST_LOG: log,
    APT_TEST_INSTALLED: options.installed?.join(',') || '',
    APT_TEST_FAIL_UPDATE: options.failUpdate ? '1' : '0' };
  delete env.NODE_OPTIONS;
  const result = spawnSync('bash', ['scripts/install-linux-dependencies.sh', ...packages],
    { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  const commands = fs.existsSync(log)
    ? fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
  return { result, commands, source, mirror, sourceBody };
}

test('Linux installer skips apt when every requested dependency is installed',
  { skip: process.platform === 'win32' }, t => {
    const { result, commands } = runInstaller(t, ['ninja-build', 'libasound2-dev'],
      { installed: ['ninja-build', 'libasound2-dev'] });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skipping apt/);
    assert.ok(commands.every(({ command }) => command === 'dpkg-query'));
  });

test('Linux installer bounds apt operations, replaces Azure sources and installs only missing packages',
  { skip: process.platform === 'win32' }, t => {
    const { result, commands, source } = runInstaller(t, ['ninja-build', 'libasound2-dev'],
      { installed: ['ninja-build'] });
    assert.equal(result.status, 0, result.stderr);
    const rewrite = commands.find(({ command }) => command === 'sed');
    assert.deepEqual(rewrite.args, ['-i', '-E',
      's|https?://azure\\.archive\\.ubuntu\\.com/ubuntu|https://archive.ubuntu.com/ubuntu|g', source]);
    assert.equal(fs.readFileSync(source, 'utf8'), 'URIs: https://archive.ubuntu.com/ubuntu\nSuites: noble\n');
    const bounds = commands.filter(({ command }) => command === 'timeout');
    assert.deepEqual(bounds.map(({ args }) => args.slice(0, 3)), [
      ['--signal=TERM', '--kill-after=15s', '180s'],
      ['--signal=TERM', '--kill-after=15s', '300s']]);
    const apt = commands.filter(({ command }) => command === 'apt-get');
    assert.equal(apt.length, 2);
    for (const { args } of apt) {
      for (const option of ['Acquire::Retries=2', 'Acquire::http::Timeout=20',
        'Acquire::https::Timeout=20', 'DPkg::Lock::Timeout=60', 'APT::Update::Error-Mode=any']) {
        assert.ok(args.includes(option), option);
      }
    }
    assert.equal(apt[0].args.at(-1), 'update');
    assert.deepEqual(apt[1].args.slice(-4), ['install', '-y', '--no-install-recommends', 'libasound2-dev']);
  });

test('Linux installer removes Azure from hosted mirror+file lists without changing source signatures or suites',
  { skip: process.platform === 'win32' }, t => {
    const { result, commands, source, mirror, sourceBody } = runInstaller(t, ['libasound2-dev'], { mirrorList: true });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), sourceBody);
    assert.equal(fs.readFileSync(mirror, 'utf8'),
      'https://archive.ubuntu.com/ubuntu/\tpriority:2\n' +
      'https://security.ubuntu.com/ubuntu/\tpriority:3\n');
    const rewrite = commands.find(({ command, args }) => command === 'sed' && args.at(-1) === mirror);
    assert.deepEqual(rewrite.args, ['-i', '-E', '/azure\\.archive\\.ubuntu\\.com/d', mirror]);
  });

test('Linux installer fails on index refresh errors without continuing to install',
  { skip: process.platform === 'win32' }, t => {
    const { result, commands } = runInstaller(t, ['libasound2-dev'], { failUpdate: true });
    assert.equal(result.status, 9, result.stderr);
    assert.equal(commands.filter(({ command }) => command === 'apt-get').length, 1);
  });

test('Linux installer rejects package options before any privileged operations',
  { skip: process.platform === 'win32' }, t => {
    const { result, commands } = runInstaller(t, ['--allow-unauthenticated']);
    assert.equal(result.status, 2);
    assert.equal(commands.length, 0);
  });

test('CI artifact steps require their prerequisites and do not run on cancellation', () => {
  const workflow = yaml.load(fs.readFileSync(path.join(root, '.github/workflows/cross-platform-source-build.yml'), 'utf8'));
  const steps = workflow.jobs['source-build'].steps;
  const stage = steps.find(step => step.id === 'stage-prebuilt');
  assert.ok(stage.if.includes('!cancelled()'));
  assert.ok(stage.if.includes("steps.compile-native.outcome == 'success'"));
  assert.ok(stage.if.includes("steps.compile-native.outcome == 'failure'"), 'preserve successful WebRTC builds after addon failures');
  const badge = steps.find(step => step.id === 'wpt-badge');
  assert.ok(steps.find(step => step.id === 'wpt').if.includes('!cancelled()'));
  assert.ok(badge.if.includes('!cancelled()'));
  assert.ok(badge.if.includes("steps.test-dependencies.outcome == 'success'"));
  const preserve = steps.find(step => step.name === 'Preserve WPT badge status');
  assert.ok(preserve.if.includes("steps.wpt-badge.outcome == 'success'"));
});
