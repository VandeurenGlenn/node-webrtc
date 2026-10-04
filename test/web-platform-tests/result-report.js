'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Keep partial results on disk: a process crash must not look like a passing run.
exports.createReport = (filename, metadata = {}) => {
  const report = { version: 1, metadata, files: {} };
  function save() {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
  }
  save();
  return {
    plan(testPath, expectation, reason) {
      report.files[testPath] = { expectation, reason, status: expectation === 'skip' ? 'skipped' : 'pending', subtests: [] };
      save();
    },
    complete(testPath, subtests, harness, exceptions) {
      const file = report.files[testPath];
      Object.assign(file, {
        status: 'completed',
        subtests,
        harness,
        exceptions: exceptions.map(error => String(error.stack || error))
      });
      save();
    }
  };
};

exports.summarizeResults = report => {
  const result = { completedFiles: 0, pendingFiles: 0, skippedFiles: 0, pass: 0, fail: 0, timeout: 0, notRun: 0, unknown: 0, harnessErrors: 0, exceptions: 0 };
  for (const file of Object.values(report.files)) {
    if (file.status === 'skipped') result.skippedFiles += 1;
    else if (file.status === 'pending') result.pendingFiles += 1;
    else result.completedFiles += 1;
    for (const test of file.subtests) {
      const key = ['pass', 'fail', 'timeout', 'notRun'][test.status] || 'unknown';
      result[key] += 1;
    }
    if (file.harness && file.harness.status !== 0) result.harnessErrors += 1;
    result.exceptions += file.exceptions?.length || 0;
  }
  return result;
};
