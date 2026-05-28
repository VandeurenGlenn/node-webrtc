import RTCDataChannelEvent from "./datachannelevent.js";
import RTCIceCandidate from "./icecandidate.js";
import RTCPeerConnection from "./peerconnection.js";
import RTCPeerConnectionIceEvent from "./rtcpeerconnectioniceevent.js";
import RTCSessionDescription from "./sessiondescription.js";
declare const MediaStream: any, MediaStreamTrack: any, RTCDataChannel: any, RTCDtlsTransport: any, RTCIceTransport: any, RTCRtpReceiver: any, RTCRtpSender: any, RTCRtpTransceiver: any, RTCSctpTransport: any, getUserMedia: any;
declare const mediaDevices: any;
declare const nonstandard: {
    i420ToRgba: any;
    RTCAudioSink: any;
    RTCAudioSource: any;
    RTCVideoSink: any;
    RTCVideoSource: any;
    rgbaToI420: any;
};
export { MediaStream, MediaStreamTrack, RTCDataChannel, RTCDataChannelEvent, RTCDtlsTransport, RTCIceCandidate, RTCIceTransport, RTCPeerConnection, RTCPeerConnectionIceEvent, RTCRtpReceiver, RTCRtpSender, RTCRtpTransceiver, RTCSctpTransport, RTCSessionDescription, getUserMedia, mediaDevices, nonstandard, };
