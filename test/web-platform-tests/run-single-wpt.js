'use strict';

const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const { it } = require('mocha');
const { inBrowserContext } = require('./util.js');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const wrtc = require('../..');
const { readStatsResource, isStatsDocument } = require('./upstream-stats.js');
const { createStatsMedia } = require('./stats-media.js');
const { readOverride } = require('./wpt-manifest-utils.js');

const reporterPathname = '/resources/testharnessreport.js';

module.exports = (urlPrefixFactory, report) => {
  if (inBrowserContext()) {
    return () => {
      // TODO: browser support for running WPT
    };
  }

  return (testPath, title = testPath, expectFail) => {
    it(title, function() {
      this.timeout(70000);
      this.slow(10000);
      return createJSDOM(urlPrefixFactory(), testPath, expectFail, report);
    });
  };
};

const resourceInterceptor = requestInterceptor(async request => {
  const url = new URL(request.url);
  const upstreamStats = readStatsResource(url.pathname);
  if (upstreamStats) {
    return new Response(upstreamStats.body, {
      headers: { 'Content-Type': upstreamStats.contentType }
    });
  }
  const override = readOverride(url.pathname);
  if (override) {
    return new Response(override, { headers: { 'Content-Type': 'text/html' } });
  }

  if (url.pathname === reporterPathname) {
    return new Response('window.shimTest();', {
      headers: { 'Content-Type': 'application/javascript' }
    });
  } else if (url.pathname.startsWith('/resources/')) {
    // When running to-upstream tests, the server doesn't have a /resources/ directory.
    // So, always go to the one in ./tests.
    // The path replacement accounts for a rewrite performed by the WPT server:
    // https://github.com/w3c/web-platform-tests/blob/master/tools/serve/serve.py#L271
    const filePath = path.resolve(__dirname, 'tests' + url.pathname)
      .replace('/resources/WebIDLParser.js', '/resources/webidl2/lib/webidl2.js');
    const body = await fs.promises.readFile(filePath);
    return new Response(body);
  }

  return undefined;
});

function createJSDOM(urlPrefix, testPath, expectFail, report) {
  const unhandledExceptions = [];

  let allowUnhandledExceptions = false;

  const virtualConsole = new VirtualConsole().forwardTo(console, { jsdomErrors: 'none' });
  virtualConsole.on('jsdomError', e => {
    if (['unhandled exception', 'unhandled-exception'].includes(e.type) && !allowUnhandledExceptions) {
      unhandledExceptions.push(e);

      // Some failing tests make a lot of noise.
      // There's no need to log these messages
      // for errors we're already aware of.
      if (!expectFail) {
        console.error((e.cause || e.detail || e).stack);
      }
    }
  });

  return JSDOM.fromURL(urlPrefix + testPath, {
    runScripts: 'dangerously',
    virtualConsole,
    resources: { interceptors: [resourceInterceptor] },
    pretendToBeVisual: true,
    storageQuota: 100000 // Filling the default quota takes about a minute between two WPTs
  })
    .then(dom => {
      const { window } = dom;

      // NOTE(mroberts): Here is where we inject node-webrtc.
      Object.assign(window, wrtc);

      // node-webrtc values are created in Node's realm. Use its ArrayBuffer
      // constructor in this synthetic browser realm so Web IDL instanceof
      // checks reflect the API's actual return type instead of a realm mismatch.
      window.ArrayBuffer = global.ArrayBuffer;

      const media = isStatsDocument(new URL(window.location.href).pathname) ? createStatsMedia(wrtc) : null;
      window.navigator.mediaDevices = Object.assign({}, window.navigator.mediaDevices, {
        getUserMedia: media ? media.getUserMedia : wrtc.getUserMedia
      });
      if (media) {
        const close = window.close.bind(window);
        window.close = () => { media.dispose(); close(); };
      }

      window.fetch = function safeFetch() {
        const args = [].slice.call(arguments);
        const url = args[0];
        try {
          new window.URL(url);
        } catch (error) {
          args[0] = window.location.protocol + '//' + window.location.host + url;
        }
        return fetch.apply(null, args);
      };

      return new Promise((resolve, reject) => {
        const errors = [];

        window.shimTest = () => {
          const oldSetup = window.setup;
          window.setup = options => {
            if (options.allow_uncaught_exception) {
              allowUnhandledExceptions = true;
            }
            oldSetup(options);
          };

          window.add_result_callback(test => {
            if (test.status === 1) {
              errors.push(`Failed in "${test.name}": \n${test.message}\n\n${test.stack}`);
            } else if (test.status === 2) {
              errors.push(`Timeout in "${test.name}": \n${test.message}\n\n${test.stack}`);
            } else if (test.status === 3) {
              errors.push(`Uncompleted test "${test.name}": \n${test.message}\n\n${test.stack}`);
            }
          });

          window.add_completion_callback((tests, harnessStatus) => {
            report?.complete(testPath, tests.map(test => ({
              name: test.name,
              status: test.status,
              message: test.message || null,
              stack: test.stack || null
            })), {
              status: harnessStatus.status,
              message: harnessStatus.message || null
            }, unhandledExceptions);
            // This needs to be delayed since some tests do things even after calling done().
            process.nextTick(() => {
              window.close();
            });

            if (harnessStatus.status !== 0) {
              errors.push(new Error(`test harness error (${harnessStatus.status}): ${testPath}: ${harnessStatus.message || ''}`));
            }

            errors.push(...unhandledExceptions);

            if (errors.length === 0 && expectFail) {
              reject(new Error(`
            Hey, did you fix a bug? This test used to be failing, but during
            this run there were no errors. If you have fixed the issue covered
            by this test, you can edit the "to-run.yaml" file and remove the line
            containing this test. Thanks!
            `));
            } else if (errors.length === 1 && !expectFail) {
              reject(new Error(errors[0]));
            } else if (errors.length && !expectFail) {
              reject(new Error(`${errors.length} errors in test:\n\n${errors.join('\n')}`));
            } else {
              resolve();
            }
          });
        };
      });
    });
}
