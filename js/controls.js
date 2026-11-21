/* PocketSoccer: thumbs on the glass. A floating stick on the left half; four buttons on the right whose jobs follow the
   play, FIFA-style:
     your ball:        Shoot (hold to power, release to strike)  Pass (tap; hold = lob or cross)  Through  Sprint
     a teammate's (in a career): —  Call (for the pass)  Run (in behind, for a through ball)  Sprint
     theirs:           Tackle  Switch (or Press, in a career: hold to close him down)  Slide  Sprint
   Keys too: arrows or WASD to move, Space = the big button, J / K = the two others, Shift = sprint, E = switch. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const C = PS.Controls = {};
  let G = null, root, stick, base, knob, btn = {}, power, pwFill, held = {}, labels = '', keys = {};

  C.mount = el => {
    root = el;
    el.insertAdjacentHTML('beforeend', `<div id="stick"><div class="sbase"><div class="knob"></div></div></div>
      <div id="btns"><button class="cb A" data-s="A"><b></b></button><button class="cb B" data-s="B"><b></b></button><button class="cb C" data-s="C"><b></b></button><button class="cb D" data-s="D"><b>Sprint</b></button></div>
      <div id="power" hidden><i></i></div>`);
    stick = el.querySelector('#stick'); base = stick.querySelector('.sbase'); knob = stick.querySelector('.knob');
    for (const b of el.querySelectorAll('.cb')) btn[b.dataset.s] = b;
    power = el.querySelector('#power'); pwFill = power.querySelector('i');
    /* the stick: wherever the thumb lands in the left half; it follows a thumb that runs past its edge */
    let sid = null, sx = 0, sy = 0;
    const R = 52;
    stick.addEventListener('pointerdown', e => { if (sid !== null) return; sid = e.pointerId; const r = stick.getBoundingClientRect(); sx = e.clientX - r.left; sy = e.clientY - r.top; base.style.left = sx + 'px'; base.style.top = sy + 'px'; stick.classList.add("on"); try { stick.setPointerCapture(e.pointerId); } catch (x) { /* a synthetic pointer */ } move(e); });
    const move = e => { if (e.pointerId !== sid) return; const r = stick.getBoundingClientRect(); let dx = e.clientX - r.left - sx, dy = e.clientY - r.top - sy; const l = Math.hypot(dx, dy);
      if (l > R) { sx += dx / l * (l - R); sy += dy / l * (l - R); base.style.left = sx + 'px'; base.style.top = sy + 'px'; dx = dx / l * R; dy = dy / l * R; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; if (G) { G.input.mx = dx / R; G.input.my = dy / R; } };
    const end = e => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; stick.classList.remove('on'); if (G) { G.input.mx = 0; G.input.my = 0; } };
    stick.addEventListener('pointermove', move); stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    for (const s of ['A', 'B', 'C', 'D']) {
      const b = btn[s];
      b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* a synthetic pointer */ } press(s); });
      b.addEventListener('pointerup', e => { e.preventDefault(); release(s); });
      b.addEventListener('pointercancel', () => release(s));
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    addEventListener('keydown', e => { if (!G || e.repeat) return; const k = e.code; keys[k] = true; const s = { Space: 'A', KeyJ: 'B', KeyK: 'C', ShiftLeft: 'D', ShiftRight: 'D' }[k]; if (s) { press(s); e.preventDefault(); } if (k === 'KeyE' && G) G.input.q.push({ k: 'switch', up: false }); keyStick(); });
    addEventListener('keyup', e => { if (!G) return; keys[e.code] = false; const s = { Space: 'A', KeyJ: 'B', KeyK: 'C', ShiftLeft: 'D', ShiftRight: 'D' }[e.code]; if (s) release(s); keyStick(); });
  };
  function keyStick() {
    const x = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), y = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0), l = Math.hypot(x, y) || 1;
    G.input.mx = x / l; G.input.my = y / l;
  }
  /* what each button does right now */
  function jobs() {
    if (!G || !G.ctl) return { A: '', B: '', C: '' };
    const p = G.ctl, b = G.ball, mine = PS.Match.possTeam(G) === p.t;
    const r = G.phase === 'restart' && G.restart;
    if (r && r.taker === p) return r.k === 'throw' ? { A: '', B: 'Throw', C: 'Throw long' } : r.k === 'kickoff' ? { A: '', B: 'Pass', C: 'Through' } : { A: r.k === 'corner' || r.k === 'goalkick' ? '' : 'Shoot', B: r.k === 'corner' ? 'Cross' : 'Pass', C: 'Through' };
    if (b.owner === p || (!b.owner && PS.Match.d2(b, p) < 1.6 && b.z < 2.2)) return { A: 'Shoot', B: 'Pass', C: 'Through' };
    if (mine) return G.mode === 'player' ? { A: '', B: 'Call', C: 'Run' } : { A: 'Shoot', B: 'Pass', C: 'Through' };
    return { A: 'Tackle', B: G.mode === 'team' ? 'Switch' : 'Press', C: 'Slide' };
  }
  const KIND = { Shoot: 'shoot', Pass: 'pass', Throw: 'pass', 'Throw long': 'through', Cross: 'pass', Through: 'through', Call: 'call', Run: 'run', Tackle: 'tackle', Switch: 'switch', Slide: 'slide', Press: 'press' };
  function press(s) {
    if (!G) return;
    if (s === 'D') { G.input.sprint = true; btn.D.classList.add('dn'); return; }
    const job = btn[s].dataset.job || ''; if (!job) return;
    const k = KIND[job];
    held[s] = { k, t0: performance.now() };
    btn[s].classList.add('dn');
    if (k === 'press') { G.input.press = true; return; }
    if (k === 'tackle' || k === 'switch' || k === 'slide' || k === 'call' || k === 'run') G.input.q.push({ k, up: false });
    if (k === 'shoot') { power.hidden = false; }
    PS.Audio && PS.Audio.tap && PS.Audio.tap();
  }
  function release(s) {
    if (!G) return;
    if (s === 'D') { G.input.sprint = false; btn.D.classList.remove('dn'); return; }
    btn[s].classList.remove('dn');
    const h = held[s]; held[s] = null; if (!h) return;
    const dur = (performance.now() - h.t0) / 1000;
    if (h.k === 'press') { G.input.press = false; return; }
    if (h.k === 'shoot' || h.k === 'pass' || h.k === 'through') G.input.q.push({ k: h.k, up: true, dur, long: (h.k === 'pass' || h.k === 'through') && (dur > 0.3 || btn[s].dataset.job === 'Cross' || btn[s].dataset.job === 'Throw long') });
    if (h.k === 'shoot') power.hidden = true;
  }
  /* every frame: the labels, and the power bar while Shoot is held */
  C.tick = () => {
    if (!G) return;
    const j = jobs(), key = j.A + '|' + j.B + '|' + j.C;
    if (key !== labels) {
      labels = key;
      for (const s of ['A', 'B', 'C']) { const b = btn[s]; b.dataset.job = j[s]; b.querySelector('b').textContent = j[s] || ''; b.classList.toggle('off', !j[s]); b.classList.toggle('def', j.A === 'Tackle'); }
    }
    const h = held.A;
    if (h && h.k === 'shoot') { const k = Math.min(1, (performance.now() - h.t0) / 900); pwFill.style.width = k * 100 + '%'; pwFill.classList.toggle('hot', k > 0.92); }
  };
  C.attach = g => { G = g; labels = ''; held = {}; if (g) { g.input.mx = g.input.my = 0; g.input.sprint = false; } C.show(true); };
  C.show = on => { if (root) root.classList.toggle('noctl', !on); };
  C.detach = () => { G = null; };
})();
