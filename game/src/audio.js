// Every sound is synthesised with WebAudio — no audio files. The engine hums while
// the player drives, the nearest police car wails, horns complain in traffic, and
// small blips mark cash, shots and success. The context is created lazily on the
// first user gesture (browsers refuse it sooner), and M mutes the whole mix.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  /** Continuous engine note; call every frame with the throttle state. */
  function engine(on, ratio) {
    if (!ctx) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      const target = on && !muted ? 0.05 + ratio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + ratio * 130, ctx.currentTime, 0.06);
    }
  }

  /** Continuous two-tone siren; volume follows the nearest police car. */
  function siren(strength) {
    if (!ctx) return;
    if (strength > 0.02 && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    }
    if (sirenOsc) {
      sirenFlip += 1;
      if (sirenFlip % 22 === 0) sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 920;
      sirenGain.gain.setTargetAtTime(muted ? 0 : strength * 0.055, ctx.currentTime, 0.1);
    }
  }

  return {
    unlock,
    engine,
    siren,
    shot() { noise(0.13, 0.5, 900); tone(140, 0.1, 'square', 0.12, 60); },
    punch() { noise(0.07, 0.3, 500); },
    horn() { tone(340, 0.16, 'square', 0.1); tone(428, 0.16, 'square', 0.07); },
    cash() { tone(880, 0.08, 'sine', 0.16); setTimeout(() => tone(1320, 0.12, 'sine', 0.16), 55); },
    hurt() { tone(110, 0.16, 'sawtooth', 0.18, 55); },
    crash() { noise(0.22, 0.4, 420); },
    door() { tone(190, 0.07, 'sine', 0.14, 120); },
    jingle() {
      if (!ctx || muted) return;
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.16), i * 95));
    },
    alarm() {
      if (!ctx || muted) return;
      [392, 392, 311].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.12), i * 170));
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
