// @ts-nocheck
"use strict";

/**
 * @author mrdoob / http://mrdoob.com/
 * @author Jesús Leganés Combarro "Piranna" <piranna@gmail.com>
 */

export default function EventTarget() {
  this._listeners = {};
}

function deliverEvent(target, event, eventListeners, dummyListener) {
  for (const listener of eventListeners || []) {
    if (
      typeof listener === "object" &&
      typeof listener.handleEvent === "function"
    ) {
      listener.handleEvent(event);
    } else {
      listener.call(target, event);
    }
  }

  if (typeof dummyListener === "function") {
    dummyListener.call(target, event);
  }
}

EventTarget.prototype.addEventListener = function addEventListener(
  type,
  listener,
) {
  const listeners = (this._listeners = this._listeners || {});

  if (!listeners[type]) {
    listeners[type] = new Set();
  }

  listeners[type].add(listener);
};

EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
  const listeners = (this._listeners = this._listeners || {});
  const eventListeners = listeners[event.type];
  const dummyListener = this["on" + event.type];

  if (
    (!eventListeners || eventListeners.size === 0) &&
    typeof dummyListener !== "function"
  ) {
    return;
  }

  process.nextTick(() => deliverEvent(this, event, eventListeners, dummyListener));
};

// Native events have already crossed onto Node's event loop. Delivering them
// directly avoids scheduling one redundant nextTick for every received message.
EventTarget.prototype._dispatchEvent = function _dispatchEvent(event) {
  const listeners = (this._listeners = this._listeners || {});
  const eventListeners = listeners[event.type];
  const dummyListener = this["on" + event.type];

  if (
    (!eventListeners || eventListeners.size === 0) &&
    typeof dummyListener !== "function"
  ) {
    return;
  }

  deliverEvent(this, event, eventListeners, dummyListener);
};

EventTarget.prototype.removeEventListener = function removeEventListener(
  type,
  listener,
) {
  const listeners = (this._listeners = this._listeners || {});
  if (listeners[type]) {
    listeners[type].delete(listener);
  }
};
