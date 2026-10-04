import binding from './binding.js';

// @ts-nocheck
function RTCDataChannelEvent(type, eventInitDict) {
    if (!new.target) {
        throw new TypeError("RTCDataChannelEvent must be constructed with new");
    }
    if (arguments.length < 2 || !(eventInitDict?.channel instanceof binding.RTCDataChannel)) {
        throw new TypeError("RTCDataChannelEvent requires an RTCDataChannel");
    }
    this.type = type;
    Object.defineProperty(this, "channel", {
        value: eventInitDict.channel,
        enumerable: true,
    });
    this.target = eventInitDict.target;
    Object.defineProperty(this, "bubbles", {
        value: false,
    });
    Object.defineProperty(this, "cancelable", {
        value: false,
    });
}

export { RTCDataChannelEvent as default };
//# sourceMappingURL=datachannelevent.js.map
