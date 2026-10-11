// @ts-nocheck
// These tracks have externally supplied media, not controllable capture
// devices. Never claim that recording a requested constraint changes media.
const numeric = new Set([
    "width", "height", "aspectRatio", "frameRate", "sampleRate", "sampleSize",
    "latency", "channelCount",
]);
const strings = new Set(["deviceId", "groupId", "facingMode", "resizeMode"]);
const booleans = new Set(["echoCancellation", "autoGainControl", "noiseSuppression"]);
const video = new Set(["width", "height", "aspectRatio", "frameRate"]);
const audio = new Set(["sampleRate", "sampleSize", "latency", "channelCount", ...booleans]);
function dictionary(value) {
    if (value == null)
        return {};
    if (typeof value !== "object" && typeof value !== "function") {
        throw new TypeError("Constraints must be a dictionary");
    }
    return value;
}
function convert(name, value) {
    if (numeric.has(name)) {
        if (typeof value === "bigint")
            throw new TypeError(`${name} cannot be a BigInt`);
        const number = Number(value);
        const double = ["aspectRatio", "frameRate", "latency"].includes(name);
        if (double && !Number.isFinite(number))
            throw new TypeError(`${name} must be finite`);
        // Web IDL unsigned long conversion, not range enforcement.
        return double ? number : (Math.trunc(number) >>> 0);
    }
    if (booleans.has(name))
        return Boolean(value);
    if (typeof value === "symbol")
        throw new TypeError("Cannot convert Symbol to string");
    return String(value);
}
function normalizeSet(value) {
    const input = dictionary(value);
    const result = {};
    for (const name of [...numeric, ...strings, ...booleans]) {
        const entry = input[name];
        if (entry === undefined)
            continue;
        const sequence = item => strings.has(name) && item !== null &&
            (typeof item === "object" || typeof item === "function") &&
            typeof item[Symbol.iterator] === "function";
        const convertValue = item => sequence(item)
            ? Array.from(item, value => convert(name, value)) : convert(name, item);
        if (entry == null || ((typeof entry === "object" || typeof entry === "function") && !sequence(entry))) {
            const parameter = {};
            for (const key of numeric.has(name) ? ["min", "max", "exact", "ideal"] : ["exact", "ideal"]) {
                const value = entry?.[key];
                if (value !== undefined)
                    parameter[key] = convertValue(value);
            }
            result[name] = parameter;
        }
        else {
            result[name] = convertValue(entry);
        }
    }
    return result;
}
function normalize(value) {
    const input = dictionary(value);
    const result = normalizeSet(input);
    const advanced = input.advanced;
    if (advanced !== undefined) {
        if (advanced == null || typeof advanced[Symbol.iterator] !== "function") {
            throw new TypeError("advanced must be a sequence");
        }
        result.advanced = Array.from(advanced, normalizeSet);
    }
    return result;
}
function overconstrained(name) {
    const error = new DOMException(`The source cannot apply ${name}`, "OverconstrainedError");
    Object.defineProperty(error, "constraint", { value: name, enumerable: true });
    return error;
}
function installTrackConstraints(Track) {
    const descriptor = Object.getOwnPropertyDescriptor(Track.prototype, "_remote");
    // Historical release benchmarks can load an older native addon through the
    // current JS wrapper. Do not replace its clone or require new native hooks.
    if (!descriptor?.get || typeof Track.prototype._clone !== "function")
        return;
    const constraints = new WeakMap();
    const remoteGetter = descriptor.get;
    function isRemote(track) {
        try {
            return remoteGetter.call(track);
        }
        catch (cause) {
            // N-API reports a generic Invalid argument error for an unwrapped
            // receiver; Web IDL requires TypeError for an illegal invocation.
            throw new TypeError("Illegal MediaStreamTrack invocation", { cause });
        }
    }
    Track.prototype.getCapabilities = function getCapabilities() {
        // Remote tracks MUST have empty capabilities. Manually fed local sources
        // likewise provide no capture-device controls or stable capability ranges.
        isRemote(this);
        return {};
    };
    Track.prototype.getConstraints = function getConstraints() {
        isRemote(this);
        return structuredClone(constraints.get(this) || {});
    };
    Track.prototype.applyConstraints = async function applyConstraints(value) {
        const remote = isRemote(this);
        const requested = normalize(value);
        if (this.readyState === "ended")
            return;
        if (remote && this.kind === "video") {
            for (const set of [requested, ...(requested.advanced || [])]) {
                for (const name of Object.keys(set)) {
                    if (video.has(name))
                        throw overconstrained(name);
                }
            }
        }
        for (const [name, entry] of Object.entries(requested)) {
            if (name === "advanced")
                continue;
            const applicable = name === "deviceId" || name === "groupId" ||
                (this.kind === "video" ? video.has(name) || ["facingMode", "resizeMode"].includes(name) : audio.has(name));
            if (!remote && applicable && entry && typeof entry === "object" &&
                ["exact", "min", "max"].some(key => key in entry)) {
                // Capture reconfiguration is unavailable; reject required controls
                // instead of reporting success without changing the native source.
                throw overconstrained(name);
            }
        }
        // Unsatisfiable advanced sets are optional and skipped. Preserve the
        // converted request independently from caller-owned objects and clones.
        constraints.set(this, requested);
    };
    Track.prototype.clone = function clone() {
        const track = this._clone();
        constraints.set(track, structuredClone(constraints.get(this) || {}));
        return track;
    };
}

export { installTrackConstraints as default };
//# sourceMappingURL=trackconstraints.js.map
