// @ts-nocheck
"use strict";

export default function RTCPeerConnectionIceEvent(type, eventInitDict) {
  this.type = type;
  this.candidate = eventInitDict.candidate;
  this.target = eventInitDict.target;
}
