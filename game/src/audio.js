// audio.js — footsteps and the alarm sting, all synthesized with WebAudio.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let lastStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = cutoff || 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t0);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    step(running, crouching, now) {
      if (!ctx || now - lastStep < (running ? 0.28 : crouching ? 0.55 : 0.42)) return;
      lastStep = now;
      noiseBurst(0.07, running ? 0.5 : crouching ? 0.12 : 0.28, running ? 1400 : 700);
    },
    alarm() {
      // Alarm sting: two rising siren wails.
      tone(620, 0.28, 'square', 0.16, 880);
      setTimeout(() => tone(620, 0.28, 'square', 0.16, 880), 300);
      setTimeout(() => tone(880, 0.4, 'square', 0.14, 620), 620);
    },
    zip() { noiseBurst(0.45, 0.4, 2400); tone(300, 0.4, 'sine', 0.1, 900); },
    pebble() { tone(500, 0.08, 'triangle', 0.2, 300); },
    clink() { tone(1250, 0.12, 'triangle', 0.25, 900); tone(900, 0.1, 'triangle', 0.15, 700); },
    chime() { tone(880, 0.18, 'sine', 0.22); setTimeout(() => tone(1318, 0.25, 'sine', 0.2), 110); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.22), i * 130));
    },
    caught() { tone(220, 0.5, 'sawtooth', 0.22, 110); },
    toggleMute() { muted = !muted; return muted; },
  };
}
