// @ts-nocheck
"use strict";

import { inherits } from "util";

import binding from "./binding.js";

import EventTarget from "./eventtarget.js";

const { getDisplayMedia, getUserMedia } = binding;

export default function MediaDevices() {}

inherits(MediaDevices, EventTarget);

MediaDevices.prototype.enumerateDevices = function enumerateDevices() {
  throw new Error(
    "Not yet implemented; file a feature request against node-webrtc",
  );
};

MediaDevices.prototype.getSupportedConstraints =
  function getSupportedConstraints() {
    throw new Error(
      "Not yet implemented; file a feature request against node-webrtc",
    );
  };

MediaDevices.prototype.getDisplayMedia = getDisplayMedia;
MediaDevices.prototype.getUserMedia = getUserMedia;
