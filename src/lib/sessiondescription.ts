// @ts-nocheck
"use strict";

export default function RTCSessionDescription(descriptionInitDict) {
  if (!new.target) {
    throw new TypeError("RTCSessionDescription must be constructed with new");
  }
  const type = `${descriptionInitDict?.type}`;
  if (!["offer", "answer", "pranswer", "rollback"].includes(type)) {
    throw new TypeError("RTCSessionDescription requires a valid SDP type");
  }
  this.type = type;
  const sdp = descriptionInitDict.sdp;
  this.sdp = sdp === undefined ? "" : `${sdp}`;
}
