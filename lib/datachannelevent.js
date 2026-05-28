// @ts-nocheck
function RTCDataChannelEvent(type, eventInitDict) {
    this.type = type;
    this.channel = eventInitDict.channel;
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
