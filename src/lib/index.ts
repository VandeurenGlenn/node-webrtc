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

setDOMException(globalThis.DOMException);

// NOTE(mroberts): Here's a hack to support jsdom's Blob implementation.
RTCDataChannel.prototype.send = function send(data) {
  if (data !== null && typeof data === "object") {
    if (ArrayBuffer.isView(data)) {
      // Values created in a vm/jsdom realm are valid BufferSources, but V8's
      // N-API type checks do not consistently recognize their backing store.
      if (!(data.buffer instanceof ArrayBuffer)) {
        data = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        ).slice();
      }
      this._send(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      this._send(data);
      return;
    }

    if (Object.prototype.toString.call(data) === "[object ArrayBuffer]") {
      this._send(new Uint8Array(data));
      return;
    }

    const implSymbol = Object.getOwnPropertySymbols(data).find(
      (symbol) => symbol.toString() === "Symbol(impl)",
    );
    if (implSymbol && data[implSymbol]) {
      // jsdom <= 29 stored Blob data in _buffer; jsdom 30 uses _bytes.
      // Both are byte views, so extracting them synchronously also preserves the
      // ordering required when a Blob is followed immediately by another send.
      const bytes = data[implSymbol]._bytes || data[implSymbol]._buffer;
      if (bytes) {
        this._send(Uint8Array.from(bytes));
        return;
      }
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
