'use strict';
const fs = require('fs');
const path = require('node:path');

exports.readOverride = pathname => {
  if (!pathname.endsWith('.html')) return undefined;
  const root = path.resolve(__dirname, 'overrides');
  const filename = path.resolve(root, '.' + pathname);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename)) return undefined;
  return fs.readFileSync(filename);
};

const EXPECTED_MANIFEST_VERSION = 6;

exports.getPossibleTestFilePaths = manifest => {
  const testharnessTests = manifest.items.testharness;

  const allPaths = [];
  for (const containerPath of Object.keys(testharnessTests)) {
    const testFilePaths = testharnessTests[containerPath].map(value => value[[0]]);
    for (const testFilePath of testFilePaths) {
      // Globally disable worker tests
      if (testFilePath.endsWith('.worker.html') ||
          testFilePath.endsWith('.serviceworker.html') ||
          testFilePath.endsWith('.sharedworker.html')) {
        continue;
      }

      allPaths.push(exports.stripPrefix(testFilePath, ''));
    }
  }

  return allPaths;
};

exports.stripPrefix = (string, prefix) => string.substring(prefix.length);

exports.readManifest = filename => {
  const manifestString = fs.readFileSync(filename, { encoding: 'utf-8' });
  const manifest = JSON.parse(manifestString);

  if (manifest.version !== EXPECTED_MANIFEST_VERSION) {
    throw new Error(`WPT manifest format mismatch; expected ${EXPECTED_MANIFEST_VERSION} but got ${manifest.version}`);
  }

  return manifest;
};
