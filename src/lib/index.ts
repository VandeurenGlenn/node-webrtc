// @ts-nocheck
"use strict";

import { inherits } from "util";
import binding from "./binding.js";
import EventTarget from "./eventtarget.js";
import MediaDevices from "./mediadevices.js";
import MediaStreamTrackEvent from "./mediastreamtrackevent.js";
import RTCDataChannelEvent from "./datachannelevent.js";
import RTCIceCandidate from "./icecandidate.js";
import RTCPeerConnection from "./peerconnection.js";
import RTCPeerConnectionIceEvent from "./rtcpeerconnectioniceevent.js";
import RTCSessionDescription from "./sessiondescription.js";
import RTCTrackEvent from "./rtctrackevent.js";

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

const dataChannelSendQueues = new WeakMap();

function enqueueDataChannelSend(channel, task) {
  const previous = dataChannelSendQueues.get(channel) || Promise.resolve();
  const next = previous.then(task);
  dataChannelSendQueues.set(channel, next);
  next.then(
    () => {
      if (dataChannelSendQueues.get(channel) === next) {
        dataChannelSendQueues.delete(channel);
      }
    },
    (error) => {
      if (dataChannelSendQueues.get(channel) === next) {
        dataChannelSendQueues.delete(channel);
      }
      if (typeof channel.dispatchEvent === "function") {
        channel.dispatchEvent({ type: "error", error });
      }
    },
  );
}

function sendDataChannelValue(channel, data) {
  if (dataChannelSendQueues.has(channel)) {
    enqueueDataChannelSend(channel, () => channel._send(data));
  } else {
    channel._send(data);
  }
}

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
      sendDataChannelValue(this, data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      sendDataChannelValue(this, data);
      return;
    }

    if (Object.prototype.toString.call(data) === "[object ArrayBuffer]") {
      sendDataChannelValue(this, new Uint8Array(data));
      return;
    }

    const implementation = Object.getOwnPropertySymbols(data)
      .map((symbol) => data[symbol])
      .find(
        (value) => value && (value._bytes || value._buffer),
      );
    if (implementation) {
      // jsdom <= 29 stored Blob data in _buffer; jsdom 30 uses _bytes.
      // Both are byte views, so extracting them synchronously also preserves the
      // ordering required when a Blob is followed immediately by another send.
      const bytes = implementation._bytes || implementation._buffer;
      sendDataChannelValue(this, Uint8Array.from(bytes));
      return;
    }

    if (typeof data.arrayBuffer === "function") {
      // Blob exposes its bytes asynchronously. Queue subsequent sends behind
      // the conversion to preserve the synchronous call order required by WPT.
      if (this.readyState !== "open") {
        this._send(data);
        return;
      }
      enqueueDataChannelSend(this, async () => {
        const buffer = await data.arrayBuffer();
        this._send(new Uint8Array(buffer));
      });
      return;
    }
  }
  sendDataChannelValue(this, data);
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
  RTCTrackEvent,
  MediaStreamTrackEvent,
  getUserMedia,
  mediaDevices,
  nonstandard,
};
