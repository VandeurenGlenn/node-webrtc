'use strict';

const test = require('./lib/test');

test('EventTarget dispatches asynchronously without changing order', async t => {
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

test('EventTarget honors listener removal before asynchronous delivery', async t => {
  const { default: EventTarget } = await import('../lib/eventtarget.js');
  const target = new EventTarget();
  const calls = [];
  const listener = () => calls.push('listener');
  target.addEventListener('message', listener);
  target.dispatchEvent({ type: 'message' });
  target.removeEventListener('message', listener);
  await new Promise(resolve => process.nextTick(resolve));
  t.deepEqual(calls, []);
  t.end();
});
