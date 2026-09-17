'use strict';

const assert = require('node:assert/strict');
const { test: nodeTest } = require('node:test');

const DEFAULT_TIMEOUT = Number(process.env.WRTC_TEST_TIMEOUT || 30000);

async function runLegacyTest(fn, nativeContext) {
  let assertionCount = 0;
  let plannedAssertions = null;
  let settled = false;
  let resolveCompletion;
  let rejectCompletion;
  const subtests = [];
  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  function settle(error) {
    if (settled) return;
    settled = true;
    if (error) rejectCompletion(error);
    else resolveCompletion();
  }

  // node:test aborts the test context when its timeout expires. Propagate
  // that cancellation to the compatibility promise; otherwise the promise
  // remains pending and native WebRTC handles keep the process alive.
  nativeContext.signal.addEventListener('abort', () => {
    settle(nativeContext.signal.reason || new Error('Test aborted'));
  }, { once: true });

  function record(assertion) {
    if (settled) return;
    try {
      assertion();
      assertionCount += 1;
      if (plannedAssertions !== null) {
        if (assertionCount > plannedAssertions) {
          settle(new Error(`plan != count (${plannedAssertions} != ${assertionCount})`));
        } else if (assertionCount === plannedAssertions) {
          settle();
        }
      }
    } catch (error) {
      settle(error);
    }
  }

  function assertWithOptionalMessage(assertion, actual, expected, message) {
    if (message === undefined) assertion(actual, expected);
    else assertion(actual, expected, message);
  }

  const context = {
    test(name, childFn) {
      subtests.push(nativeContext.test(
        name,
        { timeout: DEFAULT_TIMEOUT },
        childContext => runLegacyTest(childFn, childContext),
      ));
    },
    plan(count) {
      plannedAssertions = count;
      if (count === 0) settle();
    },
    end(error) {
      if (error) settle(error);
      else if (plannedAssertions !== null && assertionCount !== plannedAssertions) {
        settle(new Error(`plan != count (${plannedAssertions} != ${assertionCount})`));
      } else settle();
    },
    equal(actual, expected, message) {
      record(() => assertWithOptionalMessage(assert.equal, actual, expected, message));
    },
    notEqual(actual, expected, message) {
      record(() => assertWithOptionalMessage(assert.notEqual, actual, expected, message));
    },
    deepEqual(actual, expected, message) {
      record(() => assertWithOptionalMessage(assert.deepEqual, actual, expected, message));
    },
    ok(value, message) {
      record(() => assert.ok(value, message));
    },
    pass(message) {
      record(() => assert.ok(true, message));
    },
    fail(message) {
      record(() => assert.fail(message));
    },
    ifError(error, message) {
      record(() => assert.ifError(error, message));
    },
    error(error, message) {
      record(() => assert.ifError(error, message));
    },
    throws(block, expected, message) {
      record(() => assert.throws(block, expected, message));
    }
  };

  try {
    const result = fn(context);
    const returnsPromise = result && typeof result.then === 'function';
    if (returnsPromise) await result;
    if (subtests.length) await Promise.all(subtests);
    // Tape-style callback tests return synchronously and finish later through
    // t.plan() or t.end(). Do not finish those tests when their callback
    // returns: node:test would close the parent while native callbacks are
    // still pending. Promise and subtest-based tests can be completed here.
    if (!settled && (returnsPromise || subtests.length)) {
      if (plannedAssertions !== null && assertionCount !== plannedAssertions) {
        settle(new Error(`plan != count (${plannedAssertions} != ${assertionCount})`));
      } else settle();
    }
  } catch (error) {
    settle(error);
  }

  await completion;
}

function test(name, fn) {
  return nodeTest(
    name,
    { timeout: DEFAULT_TIMEOUT },
    nativeContext => runLegacyTest(fn, nativeContext),
  );
}

test.skip = function skip(name) {
  return nodeTest(name, { skip: true });
};

module.exports = test;
