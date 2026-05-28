// @ts-nocheck
"use strict";

export default function RTCPeerConnectionIceErrorEvent(type, eventInitDict) {
  this.type = type;
  this.address = eventInitDict.address;
  this.port = eventInitDict.port;
  this.url = eventInitDict.url;
  this.errorCode = eventInitDict.errorCode;
  this.errorText = eventInitDict.errorText;
  this.target = eventInitDict.target;
}
