// @ts-nocheck
function RTCPeerConnectionIceEvent(type, eventInitDict) {
    this.type = type;
    this.candidate = eventInitDict.candidate;
    this.target = eventInitDict.target;
}

export { RTCPeerConnectionIceEvent as default };
//# sourceMappingURL=rtcpeerconnectioniceevent.js.map
