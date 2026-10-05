import binding from './binding.js';

// @ts-nocheck
class RTCTrackEvent extends Event {
    constructor(type, eventInitDict) {
        if (arguments.length < 2)
            throw new TypeError("RTCTrackEvent requires two arguments");
        super(type, eventInitDict);
        const { receiver, track, transceiver } = eventInitDict ?? {};
        if (!(receiver instanceof binding.RTCRtpReceiver)
            || !(track instanceof binding.MediaStreamTrack)
            || !(transceiver instanceof binding.RTCRtpTransceiver)) {
            throw new TypeError("RTCTrackEvent requires a receiver, track and transceiver");
        }
        const source = eventInitDict.streams;
        if (source !== undefined && (source == null || typeof source[Symbol.iterator] !== "function")) {
            throw new TypeError("streams must be an iterable sequence");
        }
        const streams = source === undefined ? [] : Array.from(source);
        if (!streams.every(stream => stream instanceof binding.MediaStream)) {
            throw new TypeError("streams must contain MediaStream instances");
        }
        Object.defineProperties(this, {
            receiver: { value: receiver, enumerable: true },
            track: { value: track, enumerable: true },
            transceiver: { value: transceiver, enumerable: true },
            streams: { value: Object.freeze(streams), enumerable: true },
        });
    }
}

export { RTCTrackEvent as default };
//# sourceMappingURL=rtctrackevent.js.map
