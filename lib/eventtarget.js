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
    const pendingEvents = (this._pendingEvents = this._pendingEvents || []);
    pendingEvents.push(() => {
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
    if (this._eventDispatchScheduled) {
        return;
    }
    this._eventDispatchScheduled = true;
    process.nextTick(() => {
        const queuedEvents = this._pendingEvents;
        this._pendingEvents = [];
        this._eventDispatchScheduled = false;
        for (const dispatch of queuedEvents) {
            dispatch();
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
