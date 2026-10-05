import binding from './binding.js';

// @ts-nocheck
// An endpoint keeps its native peer alive, without a global strong registry or
// an unsafe native owner pointer. Transceiver getters return cached wrappers.
const owners = new WeakMap();
function associateEndpoint(endpoint, peer) {
    owners.set(endpoint, peer);
    return endpoint;
}
function associateTransceiver(transceiver, peer) {
    associateEndpoint(transceiver.sender, peer);
    associateEndpoint(transceiver.receiver, peer);
    return transceiver;
}
for (const Endpoint of [binding.RTCRtpSender, binding.RTCRtpReceiver]) {
    Object.defineProperty(Endpoint.prototype, "getStats", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function getStats() {
            const peer = owners.get(this);
            if (!peer || !(this instanceof Endpoint)) {
                return Promise.reject(new TypeError("Illegal invocation"));
            }
            return peer.getStats(this);
        },
    });
}

export { associateEndpoint, associateTransceiver };
//# sourceMappingURL=rtpstats.js.map
