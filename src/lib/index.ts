// @ts-nocheck
"use strict";

import { inherits } from "util";
import binding from "./binding.js";
import EventTarget from "./eventtarget.js";
import MediaDevices from "./mediadevices.js";
import RTCDataChannelEvent from "./datachannelevent.js";
import RTCIceCandidate from "./icecandidate.js";
import RTCPeerConnection from "./peerconnection.js";
import RTCPeerConnectionIceEvent from "./rtcpeerconnectioniceevent.js";
import RTCSessionDescription from "./sessiondescription.js";
import DOMException from "domexception";

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
  RTCDataChannelEvent,
  RTCDtlsTransport,
  RTCIceCandidate,
  RTCIceTransport,
  RTCPeerConnection,
  RTCPeerConnectionIceEvent,
  RTCRtpReceiver,
  RTCRtpSender,
  RTCRtpTransceiver,
  RTCSctpTransport,
  RTCSessionDescription,
  getUserMedia,
  mediaDevices,
  nonstandard,
};
