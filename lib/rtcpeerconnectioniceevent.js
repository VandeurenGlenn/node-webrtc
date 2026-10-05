import RTCIceCandidate from './icecandidate.js';

// @ts-nocheck
class RTCPeerConnectionIceEvent extends Event {
    constructor(type, eventInitDict = {}) {
        if (arguments.length < 1)
            throw new TypeError("An event type is required");
        eventInitDict = eventInitDict ?? {};
        super(type, eventInitDict);
        const candidate = eventInitDict.candidate ?? null;
        if (candidate !== null && !(candidate instanceof RTCIceCandidate)) {
            throw new TypeError("candidate must be an RTCIceCandidate or null");
        }
        Object.defineProperties(this, {
            candidate: { value: candidate, enumerable: true },
            url: { value: eventInitDict.url == null ? null : String(eventInitDict.url).toWellFormed(), enumerable: true },
        });
    }
}

export { RTCPeerConnectionIceEvent as default };
//# sourceMappingURL=rtcpeerconnectioniceevent.js.map
