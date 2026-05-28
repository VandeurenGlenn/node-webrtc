// @ts-nocheck
/**
 * @author mrdoob / http://mrdoob.com/
 * @author Jesús Leganés Combarro "Piranna" <piranna@gmail.com>
 */
function EventTarget() {
    this._listeners = {};
}
EventTarget.prototype.addEventListener = function addEventListener(type, listener) {
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
    if ((!eventListeners || eventListeners.size === 0) &&
        typeof dummyListener !== "function") {
        return;
    }
    process.nextTick(() => {
        for (const listener of eventListeners || []) {
            if (typeof listener === "object" &&
                typeof listener.handleEvent === "function") {
                listener.handleEvent(event);
            }
            else {
                listener.call(this, event);
            }
        }
        if (typeof dummyListener === "function") {
            dummyListener.call(this, event);
        }
    });
};
EventTarget.prototype.removeEventListener = function removeEventListener(type, listener) {
    const listeners = (this._listeners = this._listeners || {});
    if (listeners[type]) {
        listeners[type].delete(listener);
    }
};

export { EventTarget as default };
//# sourceMappingURL=eventtarget.js.map
