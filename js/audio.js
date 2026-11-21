/* PocketSoccer: sound, made on the spot with Web Audio (no files): a crowd that swells with the danger, the thump of a
   kick (louder the harder), the referee's whistle, the net, the post, a roar for a goal. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const A = PS.Audio = { on: true };
  let ac = null, master, crowdG, crowdF, noise, level = 0.12, target = 0.12;
  function ctx() {
    if (ac || !A.on) return ac;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ac = new C(); master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    /* noise, shared */
    const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99 * b0 + w * 0.05; b1 = 0.9 * b1 + w * 0.3; d[i] = b0 + b1 * 0.4; }
    noise = buf;
    /* the crowd: brown-ish noise through a band, its level following the play */
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    crowdF = ac.createBiquadFilter(); crowdF.type = 'bandpass'; crowdF.frequency.value = 700; crowdF.Q.value = 0.6;
    crowdG = ac.createGain(); crowdG.gain.value = 0;
    src.connect(crowdF); crowdF.connect(crowdG); crowdG.connect(master); src.start();
    return ac;
  }
  A.start = () => { const c = ctx(); if (c && c.state === 'suspended') c.resume(); };
  A.stop = () => { if (crowdG) crowdG.gain.setTargetAtTime(0, ac.currentTime, 0.3); };
  function burst(dur, f, q, gain, type = 'lowpass') {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = noise; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(f, dur, gain, type = 'sine', f2) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  A.kick = p => { const k = Math.min(1, (p || 10) / 30); tone(120, 0.12, 0.35 + 0.4 * k, 'sine', 50); burst(0.06, 1800, 0.7, 0.18 + 0.25 * k); };
  A.whistle = long => {
    if (!ac) return;
    const blow = (at, dur) => { const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(), t = ac.currentTime + at;
      o.frequency.value = 2900; o2.frequency.value = 3150; lfo.frequency.value = 38; lg.gain.value = 160; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); o2.connect(g); g.connect(master); for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.02); } };
    if (long === 'end') { blow(0, 0.35); blow(0.45, 0.35); blow(0.9, 0.9); } else if (long) blow(0, 0.7); else blow(0, 0.22);
  };
  A.net = () => burst(0.5, 900, 0.5, 0.35, 'bandpass');
  A.post = () => { tone(520, 0.4, 0.25, 'triangle'); tone(790, 0.35, 0.12, 'triangle'); };
  A.tap = () => {};
  A.roar = () => { level = Math.max(level, 1); };
  A.gasp = () => { level = Math.max(level, 0.6); };
  /* the crowd follows the ball: louder near a goal, a swell on a chance, settling back */
  A.tick = (G, dt) => {
    if (!ac || !crowdG) return;
    const b = G.ball, near = Math.min(Math.abs(b.y), Math.abs(105 - b.y));
    target = 0.1 + 0.12 * Math.max(0, 1 - near / 30);
    level += (target - level) * Math.min(1, dt * 0.6);
    crowdG.gain.setTargetAtTime(A.on ? level * 0.55 : 0, ac.currentTime, 0.2);
    crowdF.frequency.setTargetAtTime(600 + level * 700, ac.currentTime, 0.3);
  };
  A.events = (G, evs) => {
    for (const e of evs) {
      if (e.k === 'kick') A.kick(e.p);
      else if (e.k === 'whistle') A.whistle(!e.short);
      else if (e.k === 'half' || e.k === 'full') A.whistle('end');
      else if (e.k === 'goal') { A.net(); A.roar(); setTimeout(() => A.whistle(false), 900); }
      else if (e.k === 'post') { A.post(); A.gasp(); }
      else if (e.k === 'save') A.gasp();
      else if (e.k === 'head') A.kick(8);
      else if (e.k === 'pen') A.whistle(true);
    }
  };
})();
