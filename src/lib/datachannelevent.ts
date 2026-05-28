// @ts-nocheck
"use strict";

export default function RTCDataChannelEvent(type, eventInitDict) {
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
