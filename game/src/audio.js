// Nightshade: tiny WebAudio synth for sound effects. No audio files — every
// sound is an oscillator/noise envelope built at runtime. The context is
// created lazily on the first user gesture so browsers allow it.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let humNodes = null;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopHum();
      return muted;
    },
    step(sneak) {
      if (sneak) noiseBurst(0.05, 0.02, 500);
      else noiseBurst(0.07, 0.05, 900);
    },
    coin() { tone(1900, 0.09, 'triangle', 0.1, 1400); setTimeout(() => tone(2400, 0.12, 'triangle', 0.09), 70); },
    clink() { tone(2600, 0.15, 'square', 0.05, 1800); },
    pickup() { tone(660, 0.1, 'sine', 0.12); setTimeout(() => tone(990, 0.16, 'sine', 0.12), 90); },
    unlockExit() { tone(523, 0.12, 'sine', 0.1); setTimeout(() => tone(659, 0.12, 'sine', 0.1), 110); setTimeout(() => tone(784, 0.22, 'sine', 0.12), 220); },
    alert() { tone(220, 0.35, 'sawtooth', 0.14, 440); setTimeout(() => tone(330, 0.3, 'sawtooth', 0.12, 520), 120); },
    spotted() { tone(180, 0.5, 'sawtooth', 0.16, 90); },
    caught() { tone(320, 0.25, 'square', 0.12, 160); setTimeout(() => tone(210, 0.4, 'square', 0.12, 90), 200); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.12), i * 130)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 150)); },
    startHum() {
      if (muted || humNodes) return;
      const c = ensure();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 52;
      gain.gain.value = 0.018;
      osc.connect(gain).connect(c.destination);
      osc.start();
      humNodes = { osc, gain };
    },
    stopHum() {
      if (!humNodes) return;
      try { humNodes.osc.stop(); } catch { /* already stopped */ }
      humNodes = null;
    },
  };
}
