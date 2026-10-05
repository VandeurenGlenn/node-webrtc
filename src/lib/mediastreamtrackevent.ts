// @ts-nocheck
import binding from "./binding.js";

export default class MediaStreamTrackEvent extends Event {
  constructor(type, eventInitDict) {
    if (arguments.length < 2) throw new TypeError("MediaStreamTrackEvent requires two arguments");
    super(type, eventInitDict);
    if (!(eventInitDict?.track instanceof binding.MediaStreamTrack)) {
      throw new TypeError("MediaStreamTrackEvent requires a MediaStreamTrack");
    }
    Object.defineProperty(this, "track", { value: eventInitDict.track, enumerable: true });
  }
}
