import binding from './binding.js';

// @ts-nocheck
class MediaStreamTrackEvent extends Event {
    constructor(type, eventInitDict) {
        if (arguments.length < 2)
            throw new TypeError("MediaStreamTrackEvent requires two arguments");
        super(type, eventInitDict);
        if (!(eventInitDict?.track instanceof binding.MediaStreamTrack)) {
            throw new TypeError("MediaStreamTrackEvent requires a MediaStreamTrack");
        }
        Object.defineProperty(this, "track", { value: eventInitDict.track, enumerable: true });
    }
}

export { MediaStreamTrackEvent as default };
//# sourceMappingURL=mediastreamtrackevent.js.map
