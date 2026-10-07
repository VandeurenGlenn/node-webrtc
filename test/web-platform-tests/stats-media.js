'use strict';

// Headless equivalents of the upstream helper's generated noise stream. These
// are real native tracks: samples still pass through encoding, ICE, DTLS and
// RTP. Never substitute stats, receiver state, events or upstream assertions.
exports.createStatsMedia = wrtc => {
  const active = new Set();
  let disposed = false;
  return {
    async getUserMedia(constraints) {
      if (disposed) throw new Error('Stats media fixture is closed');
      if (!constraints?.audio || constraints.video) {
        throw new Error('Stats media fixture supports audio-only constraints');
      }
      const source = new wrtc.nonstandard.RTCAudioSource();
      const track = source.createTrack();
      const samples = new Int16Array(480);
      // Repeatable non-silent samples keep this independent of device access
      // and prevent silence/DTX from delaying the first received RTP packet.
      for (let i = 0; i < samples.length; i++) samples[i] = ((i * 7919) % 16000) - 8000;
      const frame = { samples, sampleRate: 48000, bitsPerSample: 16,
        channelCount: 1, numberOfFrames: 480 };
      const media = { track, timer: null };
      media.timer = setInterval(() => {
        if (track.readyState === 'ended') {
          clearInterval(media.timer);
          active.delete(media);
          return;
        }
        source.onData(frame);
      }, 10);
      active.add(media);
      return new wrtc.MediaStream([track]);
    },
    dispose() {
      disposed = true;
      for (const { track, timer } of active) {
        clearInterval(timer);
        track.stop();
      }
      active.clear();
    }
  };
};
