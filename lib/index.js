import { inherits } from "util";
import binding from "./binding.js";
import EventTarget from "./eventtarget.js";
import MediaDevices from "./mediadevices.js";
export { default as RTCDataChannelEvent } from "./datachannelevent.js";
export { default as RTCIceCandidate } from "./icecandidate.js";
export { default as RTCPeerConnection } from "./peerconnection.js";
export { default as RTCPeerConnectionIceEvent } from "./rtcpeerconnectioniceevent.js";
export { default as RTCSessionDescription } from "./sessiondescription.js";
import DOMException from "domexception";

// @ts-nocheck
const {
  MediaStream,
  MediaStreamTrack,
  RTCAudioSink,
  RTCAudioSource,
  RTCDataChannel,
  RTCDtlsTransport,
  RTCIceTransport,
  RTCRtpReceiver,
  RTCRtpSender,
  RTCRtpTransceiver,
  RTCSctpTransport,
  RTCVideoSink,
  RTCVideoSource,
  getUserMedia,
  i420ToRgba,
  rgbaToI420,
  setDOMException,
} = binding;
inherits(MediaStream, EventTarget);
inherits(MediaStreamTrack, EventTarget);
inherits(RTCAudioSink, EventTarget);
inherits(RTCDataChannel, EventTarget);
inherits(RTCDtlsTransport, EventTarget);
inherits(RTCIceTransport, EventTarget);
inherits(RTCSctpTransport, EventTarget);
inherits(RTCVideoSink, EventTarget);
setDOMException(DOMException);
// NOTE(mroberts): Here's a hack to support jsdom's Blob implementation.
RTCDataChannel.prototype.send = function send(data) {
  if (data !== null && typeof data === "object") {
    if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
      this._send(data);
      return;
    }
    const implSymbol = Object.getOwnPropertySymbols(data).find(
      (symbol) => symbol.toString() === "Symbol(impl)",
    );
    if (implSymbol && data[implSymbol] && data[implSymbol]._buffer) {
      data = data[implSymbol]._buffer;
    }
  }
  this._send(data);
};
const mediaDevices = new MediaDevices();
const nonstandard = {
  i420ToRgba,
  RTCAudioSink,
  RTCAudioSource,
  RTCVideoSink,
  RTCVideoSource,
  rgbaToI420,
};

export {
  MediaStream,
  MediaStreamTrack,
  RTCDataChannel,
  RTCDtlsTransport,
  RTCIceTransport,
  RTCRtpReceiver,
  RTCRtpSender,
  RTCRtpTransceiver,
  RTCSctpTransport,
  getUserMedia,
  mediaDevices,
  nonstandard,
};
//# sourceMappingURL=index.js.map
