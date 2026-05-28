// @ts-nocheck
"use strict";

export default function RTCSessionDescription(descriptionInitDict) {
  if (descriptionInitDict) {
    this.type = descriptionInitDict.type;
    this.sdp = descriptionInitDict.sdp;
  }
}
