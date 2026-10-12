'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findParentBaseline } = require('../scripts/find-parent-native-baseline.js');
const { summarizeParentPerformance } = require('../scripts/summarize-parent-performance.js');
const parent = 'a'.repeat(40);
const head = 'b'.repeat(40);
const root = 'repos/owner/repo';
const run = sha => ({ id: sha === parent ? 1 : 2, head_sha: sha, status: 'completed', conclusion: 'success' });
const tree = [{ path: 'CMakeLists.txt', sha: '1' }, { path: 'cmake', sha: '2' },
  { path: 'src', sha: '3' }, { path: 'scripts', sha: '4' },
  { path: 'package.json', sha: '5' }, { path: 'package-lock.json', sha: '6' }];

function fixture({ direct = false, changed = false, expired = false, failed = false, truncated = false, noLock = false, headLock = false } = {}) {
  const entries = noLock ? tree.filter(entry => entry.path !== 'package-lock.json') : tree;
  const paths = new Map([
    [`${root}/actions/workflows/cross-platform-source-build.yml/runs?head_sha=${parent}&status=success&per_page=30`, { workflow_runs: [run(parent)] }],
    [`${root}/actions/runs/1/artifacts?per_page=100`, { artifacts: direct ? [{ name: 'wrtc-Linux-X64', expired: false }] : [] }],
    [`${root}/commits/${parent}/pulls?per_page=100`, [{ merged_at: '2026-10-10', merge_commit_sha: parent, head: { sha: head } }]],
    [`${root}/git/commits/${parent}`, { tree: { sha: 'parent-tree' } }],
    [`${root}/git/commits/${head}`, { tree: { sha: 'head-tree' } }],
    [`${root}/git/trees/parent-tree`, { tree: entries, truncated }],
    [`${root}/git/trees/head-tree`, { tree: (headLock ? tree : entries).map(entry => entry.path === 'src' && changed ? { ...entry, sha: 'changed' } : entry), truncated: false }],
    [`${root}/actions/workflows/cross-platform-source-build.yml/runs?head_sha=${head}&status=success&per_page=30`, { workflow_runs: [{ ...run(head), conclusion: failed ? 'failure' : 'success' }] }],
    [`${root}/actions/runs/2/artifacts?per_page=100`, { artifacts: [{ name: 'wrtc-Linux-X64', expired }] }],
  ]);
  return path => {
    assert.ok(paths.has(path), `unexpected API call ${path}`);
    return paths.get(path);
  };
}

test('parent baseline uses an exact successful parent artifact', () => {
  const result = findParentBaseline('owner/repo', parent, fixture({ direct: true }));
  assert.equal(result.runId, 1);
  assert.equal(result.sourceSha, parent);
});
test('merge reuse accepts a successful merged PR only with identical native inputs', () => {
  const result = findParentBaseline('owner/repo', parent, fixture());
  assert.equal(result.runId, 2);
  assert.equal(result.parentSha, parent);
  assert.equal(result.sourceSha, head);
});
test('untracked lockfiles may be absent on both verified revisions', () => {
  assert.equal(findParentBaseline('owner/repo', parent, fixture({ noLock: true })).runId, 2);
  assert.equal(findParentBaseline('owner/repo', parent, fixture({ noLock: true, headLock: true })), null);
});
for (const option of ['changed', 'expired', 'failed']) {
  test(`parent baseline rejects ${option} native evidence without release fallback`, () => {
    assert.equal(findParentBaseline('owner/repo', parent, fixture({ [option]: true })), null);
  });
}
test('truncated trees and API failures are not silently accepted', () => {
  assert.throws(() => findParentBaseline('owner/repo', parent, fixture({ truncated: true })), /truncated/);
  assert.throws(() => findParentBaseline('owner/repo', parent, () => { throw new Error('network'); }), /network/);
  assert.throws(() => findParentBaseline('owner/repo', 'bad', fixture()), /full parent/);
});
test('parent summary distinguishes inconclusive results from even small significant regressions', () => {
  const result = { meta: { baselineRef: parent, compareRuns: 10, pairedBaseline: true }, comparison: {
    throughput: { deltaPercent: 3, confidenceLowPercent: -2, confidenceHighPercent: 8, significant: false, lowerIsBetter: false },
  } };
  assert.match(summarizeParentPerformance(result), /No statistically demonstrated improvement/);
  result.comparison.latency = { deltaPercent: 2, confidenceLowPercent: 1, confidenceHighPercent: 3, significant: true, lowerIsBetter: true, regression: false };
  assert.match(summarizeParentPerformance(result), /statistically significant regression detected/);
  delete result.comparison.latency;
  result.comparison.throughput.significant = true;
  result.comparison.throughput.confidenceLowPercent = 1;
  assert.match(summarizeParentPerformance(result), /Some metrics improve/);
  result.meta.baselineRef = 'v0.7.2';
  assert.throws(() => summarizeParentPerformance(result), /not a release/);
});
