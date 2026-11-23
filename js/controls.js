/* PocketSoccer: thumbs on the glass. A floating stick on the left half; four buttons on the right whose jobs follow the
   play, FIFA-style:
     your ball:        Shoot (hold to power, release to strike; swipe up a chip, down a finesse, sideways a fake;
                       let go early for a low drive, hold to the end for a power shot)  Pass (tap for a weighted pass, hold for pace; swipe up to loft it; out wide it crosses)  Through (the same)  Sprint
                       after a pass, Through (or Run, in a career) while it travels: a one-two, straight back into your run
     a teammate's (in a career): —  Call (for the pass)  Run (in behind, for a through ball)  Sprint
     theirs:           Tackle  Switch (or Press, in a career: hold to close him down)  Slide  Sprint
   Skill moves on Sprint with the ball: swipe sideways a step-over, back a drag-back, up a roulette; tap a feint, double
   tap a knock-on. Defending: hold Tackle to close him down; double tap Switch / Press for a second man.
   Keys too: arrows or WASD to move, Space = the big button, J / K = the two others, Shift = sprint, E = switch,
   F feint, Z / X step-overs, R roulette, V drag-back, G knock-on. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const C = PS.Controls = {};
  let G = null, root, stick, base, knob, btn = {}, power, pwFill, pwZone, pwType, shint, call, held = {}, labels = '', keys = {};

  C.mount = el => {
    root = el;
    el.insertAdjacentHTML('beforeend', `<div id="stick"><div class="sbase"><div class="knob"></div></div></div>
      <div id="btns"><button class="cb A" data-s="A"><b></b></button><button class="cb B" data-s="B"><b></b></button><button class="cb C" data-s="C"><b></b></button><button class="cb D" data-s="D"><b>Sprint</b></button></div>
      <div id="power" hidden><u class="zone"></u><i></i><b class="ptype"></b></div>
      <div id="shint" hidden><span class="su">\u2191 Chip</span><span class="sd">\u2193 Finesse</span><span class="sl">\u2194 Fake</span></div>
      <div id="shotcall"></div>`);
    stick = el.querySelector('#stick'); base = stick.querySelector('.sbase'); knob = stick.querySelector('.knob');
    for (const b of el.querySelectorAll('.cb')) btn[b.dataset.s] = b;
    power = el.querySelector('#power'); pwFill = power.querySelector('i'); pwZone = power.querySelector('.zone'); pwType = power.querySelector('.ptype'); shint = el.querySelector('#shint'); call = el.querySelector('#shotcall');
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
      b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* a synthetic pointer */ } press(s, e.clientX, e.clientY); });
      /* a swipe while Shoot is held picks the shot: up a chip, down a finesse, sideways a fake */
      b.addEventListener('pointermove', e => { if (s === 'D') return skillSwipe(e); const h = held[s]; if (!h || h.x0 == null) return; const dx = e.clientX - h.x0, dy = e.clientY - h.y0;
        /* Pass or Through held: a swipe up lofts it */
        if (h.k === 'pass' || h.k === 'through') { const lob = dy < -26 && -dy > Math.abs(dx); if (lob !== !!h.lob) { h.lob = lob; if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* none */ } } return; }
        if (h.k !== 'shoot') return;
        const t = dy < -26 && -dy > Math.abs(dx) ? 'chip' : dy > 26 && dy > Math.abs(dx) ? 'finesse' : Math.abs(dx) > 34 ? 'fake' : Math.hypot(dx, dy) < 18 ? 'drive' : h.type;
        if (t !== h.type) { h.type = t; if (G && G.input.charge) G.input.charge.type = t; if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* none */ } } });
      b.addEventListener('pointerup', e => { e.preventDefault(); release(s); });
      b.addEventListener('pointercancel', () => release(s));
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    /* keys: Space shoots (U a chip, I a finesse, hold them like Space), J pass, K through, Shift sprint, E switch */
    const KEYS = { Space: 'A', KeyU: 'A', KeyI: 'A', KeyJ: 'B', KeyK: 'C', ShiftLeft: 'D', ShiftRight: 'D' };
    const SKK = { KeyF: ['feint', 1], KeyZ: ['stepover', -1], KeyX: ['stepover', 1], KeyR: ['roulette', 1], KeyV: ['dragback', 1], KeyG: ['knock', 1] };
    addEventListener('keydown', e => { if (!G || e.repeat) return; const k = e.code; keys[k] = true; if (SKK[k]) { doSkill(...SKK[k]); e.preventDefault(); return; } const s = KEYS[k]; if (s) { press(s); if (k === 'KeyU' || k === 'KeyI') { const h = held.A; if (h && h.k === 'shoot') { h.type = k === 'KeyU' ? 'chip' : 'finesse'; G.input.charge && (G.input.charge.type = h.type); } } e.preventDefault(); } if (k === 'KeyE' && G) G.input.q.push({ k: 'switch', up: false }); keyStick(); });
    addEventListener('keyup', e => { if (!G) return; keys[e.code] = false; const s = KEYS[e.code]; if (s) release(s); keyStick(); });
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
  /* skill moves on the Sprint button while you have the ball: a swipe is a move (sideways a step-over that way, back a
     drag-back, up a roulette), a quick tap a body feint, two quick taps a knock-on */
  let sk = null, lastTapD = 0, lastTapB = 0;
  const onBall = () => G && G.ctl && G.ball.owner === G.ctl;
  const doSkill = (move, side) => { if (!onBall()) return; G.input.q.push({ k: 'skill', move, side }); if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) { /* none */ } };
  function skillSwipe(e) {
    if (!sk || sk.done || !onBall()) return;
    const dx = e.clientX - sk.x, dy = e.clientY - sk.y; if (Math.hypot(dx, dy) < 28) return;
    sk.done = true;
    if (Math.abs(dx) > Math.abs(dy)) doSkill('stepover', dx > 0 ? 1 : -1); else doSkill(dy < 0 ? 'roulette' : 'dragback', dx >= 0 ? 1 : -1);
  }
  function press(s, x, y) {
    if (!G) return;
    if (s === 'D') { G.input.sprint = true; btn.D.classList.add('dn'); sk = { x, y, t0: performance.now(), done: false }; return; }
    /* defending: a double tap on Switch or Press sends a second man to close him down */
    if (s === 'B' && (btn.B.dataset.job === 'Switch' || btn.B.dataset.job === 'Press')) { const now = performance.now(); if (now - lastTapB < 350) G.input.q.push({ k: 'second', up: false }); lastTapB = now; }
    const job = btn[s].dataset.job || ''; if (!job) return;
    const k = KIND[job];
    held[s] = { k, t0: performance.now(), x0: x, y0: y, type: 'drive' };
    btn[s].classList.add('dn');
    if (k === 'press') { G.input.press = true; return; }
    if (k === 'tackle') G.input.press = true;   // hold Tackle: close him down, then the tackle
    if (k === 'tackle' || k === 'switch' || k === 'slide' || k === 'call' || k === 'run') G.input.q.push({ k, up: false });
    if (k === 'shoot') { power.hidden = false; shint.hidden = false; G.input.charge = { t0: held[s].t0, type: 'drive' }; }
    /* passes take their pace from the hold: the bar shows it, a quick tap is the weighted one */
    if (k === 'pass' || k === 'through') { power.hidden = false; pwZone.style.width = '0'; }
    PS.Audio && PS.Audio.tap && PS.Audio.tap();
  }
  function release(s) {
    if (!G) return;
    if (s === 'D') {
      G.input.sprint = false; btn.D.classList.remove('dn');
      const now = performance.now();
      if (sk && !sk.done && now - sk.t0 < 220 && onBall()) { if (now - lastTapD < 380) doSkill('knock', 1); else doSkill('feint', 1); lastTapD = now; }
      sk = null; return;
    }
    btn[s].classList.remove('dn');
    const h = held[s]; held[s] = null; if (!h) return;
    const dur = (performance.now() - h.t0) / 1000;
    if (h.k === 'press' || h.k === 'tackle') { G.input.press = false; if (h.k === 'press') return; }
    if (h.k === 'shoot') {
      /* the strike: how the release was timed against the sweet spot, called out over the button */
      const pv = PS.Match.aimPreview(G);
      G.input.q.push({ k: 'shoot', up: true, dur, type: h.type });
      G.input.charge = null; power.hidden = true; shint.hidden = true;
      if (pv && !pv.fake) shotCall(pv.timing === 'perfect' ? 'PERFECT' : pv.timing === 'good' ? 'GOOD' : pv.timing === 'early' ? 'EARLY' : 'OVERHIT', pv.timing);
      else if (pv && pv.fake) shotCall('FAKE', 'good');
      return;
    }
    if (h.k === 'pass' || h.k === 'through') { power.hidden = true; G.input.q.push({ k: h.k, up: true, dur, pw: Math.min(1, dur / 0.8), lob: !!h.lob || btn[s].dataset.job === 'Cross', long: btn[s].dataset.job === 'Throw long' || btn[s].dataset.job === 'Cross' }); }
  }
  /* every frame: the labels, and the power bar while Shoot is held */
  C.tick = () => {
    if (!G) return;
    const j = jobs(), key = j.A + '|' + j.B + '|' + j.C;
    if (key !== labels) {
      labels = key;
      for (const s of ['A', 'B', 'C']) { const b = btn[s]; b.dataset.job = j[s]; b.querySelector('b').textContent = j[s] || ''; b.classList.toggle('off', !j[s]); b.classList.toggle('def', j.A === 'Tackle'); }
    }
    const hp = held.B || held.C;
    if (hp && (hp.k === 'pass' || hp.k === 'through')) {
      const k = Math.min(1, (performance.now() - hp.t0) / 800);
      pwFill.style.width = k * 100 + '%'; pwFill.className = k > 0.7 ? 'hot' : '';
      pwType.textContent = (hp.lob ? (hp.k === 'through' ? 'LOFTED THROUGH' : 'LOB') : hp.k === 'through' ? 'THROUGH' : 'PASS') + (k > 0.55 ? ' · DRIVEN' : '');
    }
    const h = held.A;
    if (h && h.k === 'shoot') {
      const k = Math.min(1, (performance.now() - h.t0) / 900), pv = PS.Match.aimPreview(G);
      pwFill.style.width = k * 100 + '%';
      if (pv) { pwZone.style.left = (pv.ss.c - pv.ss.w) * 100 + '%'; pwZone.style.width = pv.ss.w * 200 + '%';
        pwFill.className = pv.timing === 'perfect' ? 'ok' : pv.timing === 'over' ? 'hot' : '';
        pwType.textContent = pv.fake ? 'FAKE' : { drive: 'SHOT', low: 'LOW DRIVEN', finesse: 'FINESSE', chip: 'CHIP', power: 'POWER', volley: 'VOLLEY' }[pv.type] || ''; }
      else pwType.textContent = h.type === 'fake' ? 'FAKE' : '';
    }
  };
  function shotCall(t, kind) { call.textContent = t; call.className = 'show ' + kind; clearTimeout(shotCall.tm); shotCall.tm = setTimeout(() => { call.className = ''; }, 900); }
  C.attach = g => { G = g; labels = ''; held = {}; if (g) { g.input.mx = g.input.my = 0; g.input.sprint = false; } C.show(true); };
  C.show = on => { if (root) root.classList.toggle('noctl', !on); };
  C.detach = () => { G = null; };
})();
