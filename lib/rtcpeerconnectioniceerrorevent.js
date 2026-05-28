// @ts-nocheck
function RTCPeerConnectionIceErrorEvent(type, eventInitDict) {
    this.type = type;
    this.address = eventInitDict.address;
    this.port = eventInitDict.port;
    this.url = eventInitDict.url;
    this.errorCode = eventInitDict.errorCode;
    this.errorText = eventInitDict.errorText;
    this.target = eventInitDict.target;
}

export { RTCPeerConnectionIceErrorEvent as default };
//# sourceMappingURL=rtcpeerconnectioniceerrorevent.js.map
