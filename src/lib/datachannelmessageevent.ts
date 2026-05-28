// @ts-nocheck
"use strict";

export default function RTCDataChannelMessageEvent(message) {
  this.data = message;
}

RTCDataChannelMessageEvent.prototype.type = "message";
