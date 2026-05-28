export declare const MediaStream: {
    new (): MediaStream;
    new (stream: MediaStream): MediaStream;
    new (tracks: MediaStreamTrack[]): MediaStream;
    prototype: MediaStream;
};
export declare const MediaStreamTrack: {
    new (): MediaStreamTrack;
    prototype: MediaStreamTrack;
};
export declare const RTCDataChannel: {
    new (): RTCDataChannel;
    prototype: RTCDataChannel;
};
export declare const RTCDataChannelEvent: {
    new (type: string, eventInitDict: RTCDataChannelEventInit): RTCDataChannelEvent;
    prototype: RTCDataChannelEvent;
};
export declare const RTCDtlsTransport: {
    new (): RTCDtlsTransport;
    prototype: RTCDtlsTransport;
};
export declare const RTCIceCandidate: {
    new (candidateInitDict?: RTCLocalIceCandidateInit): RTCIceCandidate;
    prototype: RTCIceCandidate;
};
export declare const RTCIceTransport: {
    new (): RTCIceTransport;
    prototype: RTCIceTransport;
};
export declare const RTCPeerConnection: {
    new (configuration?: RTCConfiguration): RTCPeerConnection;
    prototype: RTCPeerConnection;
    generateCertificate(keygenAlgorithm: AlgorithmIdentifier): Promise<RTCCertificate>;
};
export declare const RTCPeerConnectionIceEvent: {
    new (type: string, eventInitDict?: RTCPeerConnectionIceEventInit): RTCPeerConnectionIceEvent;
    prototype: RTCPeerConnectionIceEvent;
};
export declare const RTCRtpReceiver: {
    new (): RTCRtpReceiver;
    prototype: RTCRtpReceiver;
    getCapabilities(kind: string): RTCRtpCapabilities | null;
};
export declare const RTCRtpSender: {
    new (): RTCRtpSender;
    prototype: RTCRtpSender;
    getCapabilities(kind: string): RTCRtpCapabilities | null;
};
export declare const RTCRtpTransceiver: {
    new (): RTCRtpTransceiver;
    prototype: RTCRtpTransceiver;
};
export declare const RTCSctpTransport: {
    new (): RTCSctpTransport;
    prototype: RTCSctpTransport;
};
export declare const RTCSessionDescription: {
    new (descriptionInitDict: RTCSessionDescriptionInit): RTCSessionDescription;
    prototype: RTCSessionDescription;
};
export declare const getUserMedia: any;
export declare const mediaDevices: MediaDevices;
