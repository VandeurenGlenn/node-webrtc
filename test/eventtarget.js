'use strict';

const test = require('./lib/test');

test('EventTarget batches asynchronous dispatch without changing order', async t => {
  const { default: EventTarget } = await import('../lib/eventtarget.js');
  const target = new EventTarget();
  const calls = [];

  target.addEventListener('message', event => calls.push(event.data));
  target.dispatchEvent({ type: 'message', data: 'first' });
  target.dispatchEvent({ type: 'message', data: 'second' });
  calls.push('sync');
  await new Promise(resolve => process.nextTick(resolve));

  t.deepEqual(calls, ['sync', 'first', 'second']);
  t.end();
});

test('EventTarget keeps one native re-entry boundary per dispatch batch', async t => {
  const { default: EventTarget } = await import('../lib/eventtarget.js');
  const target = new EventTarget();
  target.addEventListener('message', () => {});
  target.dispatchEvent({ type: 'message' });
  target.dispatchEvent({ type: 'message' });
  t.equal(target._pendingEvents.length, 2);
  t.equal(target._eventDispatchScheduled, true);
  await new Promise(resolve => process.nextTick(resolve));
  t.equal(target._pendingEvents.length, 0);
  t.equal(target._eventDispatchScheduled, false);
  t.end();
});
