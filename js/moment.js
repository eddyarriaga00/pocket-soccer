/* PocketSoccer: a "moment", the live, playable piece of a match.
   A match is simulated; when the ball comes to your player the game stops on that moment and you play it, one thumb,
   portrait: a few seconds of real football around you (teammates making runs, defenders pressing, a keeper) until the
   move ends in a goal, a save, a miss, a lost ball, a foul or offside. Then the simulation carries on.

   Controls (one thumb, anywhere on the screen):
     drag and hold      move (a joystick appears where the thumb went down; push it further to sprint)
     flick              kick in the direction of the flick: at goal it is a shot, at a teammate a pass, into space a
                        through ball. A longer, faster flick hits it harder (and higher). Bend the flick and the ball
                        bends the same way (curl), and still finishes where the flick pointed.
     tap a teammate     pass to his feet
     tap inside the goal  a placed, side-foot finish to that spot
     tap anywhere else  with the ball: knock it ahead and burst; without it: call for the ball, or tackle if close
   Coordinates: metres, see physics.js. The camera looks up the pitch (+y), so screen up is always toward goal. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const { PITCH, CX, POST, R } = PS.phys;
  const L = PITCH.L;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot;
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const d2 = (a, b) => hyp(a.x - b.x, a.y - b.y);
  /* distance from point o to the segment a-b */
  const segDist = (o, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1, t = clamp(((o.x - a.x) * vx + (o.y - a.y) * vy) / l2, 0, 1); return hyp(o.x - a.x - vx * t, o.y - a.y - vy * t); };

  const DT = 1 / 120;
  let cv, ctx, W = 1, H = 1, DPR = 1, wrap, hud, M = null, raf = 0, last = 0, acc = 0, done = null;
  const CROWD = [];
  for (let i = 0; i < 900; i++) {  // seats in the stands: three stands round the attacking end and the touchlines
    const side = i % 3, a = Math.random(), b = Math.random();
    if (side === 0) CROWD.push({ x: -8 + a * (PITCH.W + 16), y: L + 6 + b * 14, z: 0.8 + b * 9, c: Math.random() });
    else CROWD.push({ x: side === 1 ? -6 - b * 14 : PITCH.W + 6 + b * 14, y: 20 + a * 90, z: 0.8 + b * 9, c: Math.random() });
  }

  /* ---------------------------------------------------------------- players */
  function mk(team, x, y, a, o = {}) {
    return Object.assign({ team, x, y, vx: 0, vy: 0, face: team ? Math.PI : 0, a, tx: x, ty: y, stun: 0, cd: 0, call: 0,
      jump: 0, dive: 0, diveX: 0, react: 0, phase: Math.random() * 6, num: 2 + Math.floor(Math.random() * 20), role: 'X', burst: 0 }, o);
  }
  const maxSpd = (p, ball) => (5.6 + p.a.pac * 0.035) * (ball ? 0.8 + p.a.dri * 0.0014 : 1) * (p.burst > 0 ? 1.12 : 1);
  const att = (base, spread = 6) => {
    const r = () => clamp(Math.round(base + rnd(-spread, spread)), 30, 99);
    return { pac: r(), sho: r(), pas: r(), dri: r(), def: r(), phy: r(), gk: r() };
  };

  /* ---------------------------------------------------------------- set-ups */
  /* cfg: { type, user: {name, num, pos, a}, us: club, them: club, minute, score:[a,b], side } */
  function build(cfg) {
    const side = cfg.side || (Math.random() < 0.5 ? -1 : 1);
    const usA = cfg.us.ovr, thA = cfg.them.ovr;
    const U = mk(0, 0, 0, cfg.user.a, { user: true, num: cfg.user.num, name: cfg.user.name, role: cfg.user.pos });
    const ps = [U];
    const tm = (x, y, role, o) => { const p = mk(0, x, y, att(usA), Object.assign({ role }, o)); ps.push(p); return p; };
    const op = (x, y, role, o) => { const p = mk(1, x, y, att(thA), Object.assign({ role }, o)); ps.push(p); return p; };
    const gk = op(CX, L - 1.5, 'GK', { num: 1 });
    gk.a.gk = clamp(Math.round(thA + rnd(-4, 6)), 40, 95);
    const b = PS.phys.newBall();
    const m = { cfg, type: cfg.type, ps, U, gk, ball: b, t: 0, tmax: 15, over: 0, end: null, set: false, wall: [],
      res: { goal: 0, assist: 0, shots: 0, onT: 0, keyPass: 0, dribbles: 0, lost: 0, xg: 0, offside: 0, saves: 0, chain: null },
      cam: { x: CX, y: 80 }, msg: '', msgT: 0, slow: 1, slowT: 0, shot: null, lastKick: null, offside: new Set(), assistBy: null,
      celebrate: 0, title: '', hint: '', flash: 0, fx: [], log: [] };
    let carrier = U;
    switch (cfg.type) {
      case 'box': {
        U.x = CX + rnd(-9, 9); U.y = 80 + rnd(0, 4);
        tm(CX - side * 13, 88, 'W'); tm(CX + side * 8, 86, 'ST');
        op(CX - 4, 91, 'CB'); op(CX + 5, 90.5, 'CB'); op(CX + side * 17, 89, 'FB'); op(U.x + rnd(-2, 2), U.y + 6.5, 'DM');
        m.title = 'Edge of the box'; m.hint = 'Flick at goal to shoot, or find a run';
        break;
      }
      case 'through': {
        U.x = CX + rnd(-8, 8); U.y = 69;
        carrier = tm(CX + rnd(-10, 10), 55, 'CM');
        tm(CX - side * 15, 67, 'W');
        for (let i = 0; i < 4; i++) op(CX - 16 + i * 10.5 + rnd(-1, 1), 72.5 + rnd(-1, 1), i % 3 ? 'CB' : 'FB');
        op(carrier.x + side * 7, 62, 'DM');
        m.title = 'Run in behind'; m.hint = 'Sprint forward and he\u2019ll play you in. Stay onside!';
        break;
      }
      case 'counter': {
        U.x = CX + rnd(-6, 6); U.y = 50;
        tm(CX + side * 15, 54, 'W', { burst: 4 });
        op(CX - 5, 67, 'CB'); op(CX + 6, 70, 'CB'); op(CX + rnd(-3, 3), 45, 'CM');
        m.title = 'Counter attack'; m.hint = 'Drive at them. Two on two!'; m.tmax = 17;
        break;
      }
      case 'wing': {
        U.x = side > 0 ? 61 : 7; U.y = 71;
        op(U.x - side * 2, 77, 'FB'); op(CX + side * 3, 90, 'CB'); op(CX - side * 4, 89, 'CB'); op(CX + side * 4, 82, 'DM');
        tm(CX - side * 1, 85, 'ST'); tm(CX - side * 12, 82, 'W');
        m.title = 'Down the wing'; m.hint = 'Beat your man, then cross or cut inside';
        break;
      }
      case 'build': {
        U.x = CX + rnd(-6, 6); U.y = 57;
        tm(CX + 3, 79, 'ST'); tm(CX - 18, 76, 'W'); tm(CX + 18, 75, 'W');
        [-15, -5, 5, 15].forEach(dx => op(CX + dx, 82 + rnd(-1, 1), dx * dx > 100 ? 'FB' : 'CB'));
        op(U.x - 3, 64, 'DM'); op(U.x + 4, 66, 'DM');
        m.title = 'Running the game'; m.hint = 'Thread a pass through, or try your luck from range';
        break;
      }
      case 'fk': {
        const dist = rnd(19, 27), ang = rnd(-0.55, 0.55);
        b.x = CX + Math.sin(ang) * dist; b.y = L - Math.cos(ang) * dist;
        U.x = b.x - Math.sin(ang) * 1.2 - 0.3; U.y = b.y - Math.cos(ang) * 1.2;
        const tx = CX + (b.x > CX ? -1 : 1) * (POST - 0.9), dx = tx - b.x, dy = L - b.y, dl = hyp(dx, dy);
        const wx = b.x + dx / dl * 9.15, wy = b.y + dy / dl * 9.15, n = dist < 22 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * 0.62 + (b.x > CX ? -0.9 : 0.9);
          m.wall.push(op(wx + dy / dl * o, wy - dx / dl * o, 'WALL'));
        }
        op(CX - 5, L - 8, 'CB'); op(CX + 4, L - 9, 'CB');
        tm(CX - 2, L - 10.5, 'ST'); tm(CX + 6, L - 12, 'CB');
        gk.x = CX + (b.x > CX ? 0.9 : -0.9);
        m.set = true; carrier = null; b.owner = null;
        m.title = 'Free kick'; m.hint = 'Curve the flick to bend it round the wall';
        break;
      }
      case 'pen': {
        b.x = CX; b.y = L - PITCH.SPOT; U.x = CX - 0.6; U.y = b.y - 1.6;
        for (let i = 0; i < 3; i++) { tm(CX - 12 + i * 2.2, L - 20, 'X'); op(CX + 6 + i * 2.2, L - 20, 'X'); }
        m.set = true; carrier = null;
        m.title = 'Penalty'; m.hint = 'Flick or tap a corner. The keeper is guessing.';
        break;
      }
    }
    if (carrier) { b.owner = carrier; place(b, carrier); }
    for (const p of ps) { p.tx = p.x; p.ty = p.y; }
    m.cam.x = clamp(U.x, 9, PITCH.W - 9); m.cam.y = U.y + 9;
    U.face = Math.atan2(CX - U.x, L - U.y);
    return m;
  }
  function place(b, p) {
    p.phase = p.phase || 0;
    const r = 0.55 + 0.12 * Math.max(0, Math.sin(p.phase * 0.5));
    b.x = p.x + Math.sin(p.face) * r; b.y = p.y + Math.cos(p.face) * r; b.z = R;
    b.vx = p.vx; b.vy = p.vy; b.vz = 0; b.spin = 0;
  }

  /* ---------------------------------------------------------------- kicking */
  function kick(by, vx, vy, vz, spin, kind, to) {
    const b = M.ball;
    if (b.owner === by && by !== M.U) by.stun = 0;
    b.owner = null; b.vx = vx; b.vy = vy; b.vz = vz; b.spin = spin || 0; b.top = kind === 'shot' ? 6 : 0;
    b.last = by; by.cd = 0.35;
    M.lastKick = { by, kind, t: M.t, to };
    M.log.push(M.t.toFixed(2) + ` kick ${kind} by ${by.user ? 'YOU' : by.role + by.team} v=${hyp(vx, vy, vz).toFixed(1)} from (${M.ball.x.toFixed(1)},${M.ball.y.toFixed(1)})`);
    M.set = false;
    M.wall.forEach(w => w.jump = 0.001);
    if (kind === 'pass' || kind === 'cross') {
      /* offside is judged when the ball is played: anyone beyond the second-last defender and the ball */
      M.offside.clear();
      const ys = M.ps.filter(p => p.team === 1).map(p => p.y).sort((a, c) => c - a);
      const line = Math.max(ys[1] ?? 0, b.y, L / 2);
      M.ps.forEach(p => { if (p.team === 0 && p !== by && p.y > line + 0.3) M.offside.add(p); });
    }
    if (kind === 'shot') {
      M.shot = { by, t: M.t, reacted: false };
      if (by === M.U) { M.res.shots++; M.res.xg += xg(by); }
      M.slow = 0.45; M.slowT = 1.1;
    }
  }
  function xg(p) {
    const d = hyp(p.x - CX, L - p.y), ang = Math.atan2(Math.abs(p.x - CX), L - p.y);
    const press = M.ps.some(o => o.team === 1 && o.role !== 'GK' && d2(o, p) < 1.6) ? 0.6 : 1;
    return clamp(0.9 * Math.exp(-d / 9) * Math.cos(ang) * press, 0.01, 0.8);
  }
  /* aim a shot at (tx, tz) in the goal mouth; p is the power 0..1, curl the spin; err from the shooter and pressure */
  function shoot(by, tx, p, curl, place) {
    const b = M.ball, a = by.a;
    const v = place ? 17 + a.sho * 0.04 : 14 + 17 * p + a.sho * 0.05;
    const press = M.ps.some(o => o.team === 1 && o.role !== 'GK' && d2(o, by) < 1.6) ? 1.6 : 1;
    const sd = (0.05 - a.sho * 0.00038) * (place ? 0.7 : 1 + p * 0.9) * press * (by.user ? 1 : 1.3);
    const dist = hyp(tx - b.x, L - b.y);
    let vz = place ? 0.9 + dist * 0.02 : 0.4 + 5.2 * p * p + dist * 0.035;
    vz += gauss() * 0.5 * p;
    const spin = clamp(curl, -48, 48) + (place ? (tx > b.x ? 10 : -10) * 0 : 0);
    const ang = PS.phys.solveAim(b, tx, L, v, vz, spin, 6) + gauss() * sd;
    kick(by, Math.sin(ang) * v, Math.cos(ang) * v, vz, spin, 'shot');
  }
  /* a pass to a teammate (lead him if he is running) or into space toward a point */
  function pass(by, to, pt, p, curl, lofted, arrive = 6) {
    const b = M.ball, a = by.a;
    let tx, ty;
    if (to) {
      const dd = d2(b, to), tt = dd / 14;
      tx = to.x + to.vx * tt * 0.9; ty = to.y + to.vy * tt * 0.9;
    } else { tx = pt.x; ty = pt.y; }
    tx = clamp(tx, 1, PITCH.W - 1); ty = Math.min(ty, L - 1);
    const d = hyp(tx - b.x, ty - b.y);
    const sd = 0.012 + 0.04 * (1 - a.pas / 100) * (lofted ? 1.4 : 1);
    let ang = Math.atan2(tx - b.x, ty - b.y);
    if (lofted || d > 30) {
      const t = 0.9 + d / 24, vh = d / t * 1.12, vz = 0.5 * 9.81 * t * 0.92;
      if (curl) ang = PS.phys.solveAim(b, tx, ty, vh, vz, curl, 0);
      ang += gauss() * sd;
      kick(by, Math.sin(ang) * vh, Math.cos(ang) * vh, vz, curl || 0, by.y > L - 34 && Math.abs(tx - CX) < 12 ? 'cross' : 'pass', to);
    } else {
      let v = Math.sqrt(arrive * arrive + 2 * 2.3 * d) * (1 + gauss() * 0.07 * (1 - a.pas / 100)) * lerp(0.92, 1.12, p ?? 0.5);
      ang += gauss() * sd;
      kick(by, Math.sin(ang) * v, Math.cos(ang) * v, 0, curl ? curl * 0.4 : 0, 'pass', to);
    }
    if (by === M.U && to) M.assistBy = { to, t: M.t };
  }

  /* ---------------------------------------------------------------- the user's input */
  const touch = { id: null, sx: 0, sy: 0, x: 0, y: 0, t0: 0, path: [], joy: false, jx: 0, jy: 0, trail: [] };
  function down(e) {
    if (!M || M.over) return;
    if (!M.ready) { M.ready = true; M.t = 0; }
    if (touch.id !== null) return;
    const r = cv.getBoundingClientRect();
    touch.id = e.pointerId; touch.sx = touch.x = e.clientX - r.left; touch.sy = touch.y = e.clientY - r.top;
    touch.t0 = performance.now(); touch.path = [{ x: touch.x, y: touch.y, t: touch.t0 }]; touch.joy = false; touch.jx = touch.jy = 0;
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (e.pointerId !== touch.id) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
    touch.x = x; touch.y = y; touch.path.push({ x, y, t: now });
    if (touch.path.length > 60) touch.path.shift();
    const dx = x - touch.sx, dy = y - touch.sy, l = hyp(dx, dy);
    if (l > 10) touch.joy = true;
    const R0 = 64;
    if (l > R0 * 1.25) { touch.sx = x - dx / l * R0 * 1.25; touch.sy = y - dy / l * R0 * 1.25; }  // the stick follows the thumb
    touch.jx = clamp(dx / R0, -1.25, 1.25); touch.jy = clamp(dy / R0, -1.25, 1.25);
  }
  function up(e) {
    if (e.pointerId !== touch.id) return;
    const now = performance.now(), path = touch.path;
    touch.id = null; touch.joy = false; touch.jx = touch.jy = 0;
    if (!M || M.over) return;
    const dur = now - touch.t0, first = path[0], lastP = path[path.length - 1];
    const moved = hyp(lastP.x - first.x, lastP.y - first.y);
    if (dur < 260 && moved < 14) { tap(lastP.x, lastP.y); return; }
    /* a flick: the part of the stroke drawn in the last 240 ms, if it was fast */
    const seg = path.filter(q => now - q.t < 240);
    if (seg.length < 3) return;
    const s = seg[0], f = seg[seg.length - 1];
    const cl = hyp(f.x - s.x, f.y - s.y), spd = cl / Math.max(30, f.t - s.t) * 1000;
    if (spd < 650 || cl < 28) return;
    let bow = 0;   // how far the stroke bulged to the left (+) or right (-) of its chord, as a share of its length
    for (const q of seg) {
      const c = ((f.x - s.x) * (s.y - q.y) - (s.y - f.y) * (q.x - s.x)) / (cl * cl);
      if (Math.abs(c) > Math.abs(bow)) bow = c;
    }
    const p = clamp((spd / H - 0.9) / 3.6, 0.05, 1);
    touch.trail = seg.map(q => ({ x: q.x, y: q.y, t: now }));
    flick(s, f, p, bow);
  }
  function flick(s, f, p, bow) {
    const U = M.U, b = M.ball;
    const A = unproject(s.x, s.y), B = unproject(f.x, f.y);
    let dx = B.x - A.x, dy = B.y - A.y; const l = hyp(dx, dy) || 1; dx /= l; dy /= l;
    if (!isFinite(dx + dy)) return;
    const curl = clamp(-bow * 160, -46, 46) * (0.6 + U.a.sho * 0.004);
    const canKick = b.owner === U || (!b.owner && d2(b, U) < 1.5 && b.z < 1.9) || (M.set && d2(b, U) < 2.5);
    if (!canKick) {
      /* no ball: a sliding tackle toward the flick if a carrier is close */
      const c = b.owner;
      if (c && c.team === 1 && d2(c, U) < 3.2) slide(U, c, dx, dy);
      else { U.burst = 0.6; U.vx += dx * 3; U.vy += dy * 3; }
      return;
    }
    if (M.set && b.owner !== U) b.owner = null;
    U.face = Math.atan2(dx, dy);
    /* at goal? where the flick's line crosses the goal line */
    const tcross = dy > 0.05 ? (L - b.y) / dy : Infinity, gx = b.x + dx * tcross;
    const toGoal = tcross < 40 && Math.abs(gx - CX) < POST + 7;
    const mate = bestMate(dx, dy, toGoal ? 0.09 : 0.42);
    if (toGoal && !(mate && p < 0.45 && hyp(mate.x - b.x, mate.y - b.y) < tcross * 0.7 && M.type !== 'pen' && M.type !== 'fk')) {
      shoot(U, clamp(gx, CX - POST - 3, CX + POST + 3), p, curl, false);
      say(p > 0.85 ? 'Hit with everything!' : curl && Math.abs(curl) > 18 ? 'Curled…' : 'Shot!');
      return;
    }
    if (mate) { pass(U, mate, null, p, curl * 0.6, p > 0.72 && hyp(mate.x - b.x, mate.y - b.y) > 16); return; }
    const reach = 8 + p * 32;
    pass(U, null, { x: b.x + dx * reach, y: b.y + dy * reach }, p, curl * 0.6, p > 0.8);
  }
  function bestMate(dx, dy, cone) {
    let best = null, bs = 1e9;
    for (const q of M.ps) {
      if (q.team !== 0 || q === M.U) continue;
      const ox = q.x - M.ball.x, oy = q.y - M.ball.y, ol = hyp(ox, oy);
      if (ol < 3 || ol > 50) continue;
      const ang = Math.acos(clamp((ox * dx + oy * dy) / ol, -1, 1));
      if (ang > cone) continue;
      const s = ang * 30 + ol * 0.15;
      if (s < bs) { bs = s; best = q; }
    }
    return best;
  }
  function tap(x, y) {
    const U = M.U, b = M.ball;
    /* a teammate under the thumb? */
    let mate = null, md = 46;
    for (const q of M.ps) {
      if (q.team !== 0 || q === U) continue;
      const s = project(q.x, q.y, 0.9); const dd = hyp(s.x - x, s.y - y);
      if (dd < md) { md = dd; mate = q; }
    }
    const has = b.owner === U || (!b.owner && d2(b, U) < 1.5 && b.z < 1.9) || (M.set && d2(b, U) < 2.5);
    if (has) {
      if (M.set) b.owner = null;
      if (mate && M.type !== 'pen') { pass(U, mate, null, 0.5, 0, false); return; }
      const g = rayGoal(x, y);
      if (g && hyp(CX - b.x, L - b.y) < 34) { shoot(U, g.x, 0.5, 0, true); say('Side-foot…'); return; }
      if (M.set) return;
      /* knock it ahead and go */
      U.burst = 0.9; b.owner = null;
      const sp = Math.max(7.5, hyp(U.vx, U.vy) + 3.5);
      b.vx = Math.sin(U.face) * sp; b.vy = Math.cos(U.face) * sp; b.vz = 0; b.last = U; U.cd = 0.25;
      return;
    }
    const c = b.owner;
    if (c && c.team === 1 && d2(c, U) < 1.9) { tackle(U, c, 1.25); return; }
    if (c && c.team === 0) { U.call = 1.4; say('Call for it!', 0.8); return; }
  }
  /* the screen point's ray through the goal mouth (the plane y = L), or null */
  function rayGoal(sx, sy) {
    const r = ray(sx, sy); if (r.dy <= 0) return null;
    const t = (L - r.oy) / r.dy, x = r.ox + r.dx * t, z = r.oz + r.dz * t;
    return Math.abs(x - CX) < POST + 0.8 && z > -0.6 && z < PITCH.GH + 0.8 ? { x: clamp(x, CX - POST + 0.25, CX + POST - 0.25), z } : null;
  }

  /* ---------------------------------------------------------------- tackles */
  function tackle(by, c, bonus = 1) {
    if (by.cd > 0) return false;
    by.cd = 0.8;
    const pr = clamp(0.32 * Math.pow((by.a.def + 10) / (c.a.dri + 10), 1.6) * bonus * (c.burst > 0 ? 0.6 : 1), 0.08, 0.9);
    if (Math.random() < pr) { steal(by, c); return true; }
    if (by.team === 1 && c.team === 0 && Math.random() < 0.1) foul(c);
    return false;
  }
  function slide(by, c, dx, dy) {
    by.cd = 1.2; by.vx = dx * 9; by.vy = dy * 9; by.stun = 0.7;
    if (d2(by, c) < 2.8 && Math.random() < 0.35 + by.a.def * 0.004) steal(by, c);
    else if (Math.random() < 0.25) foul(c);
  }
  function steal(by, c) {
    const b = M.ball;
    b.owner = null; b.last = by; c.stun = 0.55; M.log.push(M.t.toFixed(2) + ` steal by ${by.role}${by.team}`);
    const a = by.face + rnd(-0.6, 0.6);
    b.vx = Math.sin(a) * rnd(3, 6); b.vy = Math.cos(a) * rnd(3, 6); b.vz = 0;
    if (c === M.U) { M.res.lost++; say('Dispossessed!'); }
    if (by === M.U) { say('Won it back!'); }
  }
  function foul(c) {
    if (M.over || c.team !== 0) return;
    const inBox = c.y > L - PITCH.BOXD && Math.abs(c.x - CX) < PITCH.BOXW / 2;
    if (inBox) { M.res.chain = { type: 'pen' }; finish('foul', 'PENALTY! Brought down in the box.', 1.6); }
    else if (c.y > L - 34) { M.res.chain = { type: 'fk' }; finish('foul', 'Free kick! Fouled on the edge.', 1.4); }
    else finish('foul', 'Foul. Free kick, moment over.', 1.2);
  }

  /* ---------------------------------------------------------------- AI */
  function secondLast() { const ys = M.ps.filter(p => p.team === 1).map(p => p.y).sort((a, c) => c - a); return ys[1] ?? L - 10; }
  function ai(p, dt) {
    const b = M.ball, U = M.U, own = b.owner;
    if (p === U) return;
    if (M.set && p.role !== 'GK') { p.tx = p.x; p.ty = p.y; return; }
    if (p.role === 'GK') return keeper(p, dt);
    if (p.role === 'WALL' && M.t - (M.lastKick?.t ?? 1e9) < 1.2) { p.tx = p.x; p.ty = p.y; return; }
    if (p.team === 1) {
      /* the nearest defender presses the ball; the rest track a man or hold the line goal-side */
      const target = own ? own : b;
      const presser = nearest(1, target, q => q.role !== 'GK');
      if (p === presser) {
        const gx = CX - target.x, gy = L - target.y, gl = hyp(gx, gy) || 1;
        const close = own && own.team === 0 ? 0.9 : 0;
        p.tx = target.x + gx / gl * close; p.ty = target.y + gy / gl * close;
        if (!own) { const pr = PS.phys.predict(b, (c, t) => t > 0.4); const e = pr[pr.length - 1]; if (e) { p.tx = e.x; p.ty = e.y; } }
        if (own && own.team === 0 && M.t > 1.1 && d2(p, own) < 1.3 && p.cd <= 0 && Math.random() < dt * (L - own.y < 30 ? 1.7 : 1.1)) tackle(p, own);
      } else if (own && own.team === 0 && L - own.y < 32 && p === coverMan(presser, own)) {
        /* the cover: between the ball and the goal, a few metres off, ready for the dribble past his mate */
        const gx = CX - own.x, gy = L - own.y, gl = hyp(gx, gy) || 1, k = Math.min(5, gl * 0.35);
        p.tx = own.x + gx / gl * k; p.ty = own.y + gy / gl * k;
        if (d2(p, own) < 1.3 && p.cd <= 0 && M.t > 1.1 && Math.random() < dt * 1.4) tackle(p, own);
      } else {
        let mark = null, md = 1e9;
        for (const q of M.ps) if (q.team === 0 && q !== own) { const dd = d2(q, p) + (M.ps.some(o => o !== p && o.team === 1 && o.markOf === q) ? 12 : 0); if (dd < md) { md = dd; mark = q; } }
        p.markOf = mark;
        if (mark) {
          /* a defender reads a run a beat late (better defenders sooner): he tracks where his man was, not where he is */
          if (!p.seen || p.seenOf !== mark) { p.seen = { x: mark.x, y: mark.y }; p.seenOf = mark; }
          const rk = 1 - Math.exp(-dt * (2.2 + p.a.def * 0.035));
          p.seen.x += (mark.x - p.seen.x) * rk; p.seen.y += (mark.y - p.seen.y) * rk;
          const mx = p.seen.x, my = p.seen.y;
          const gx = CX - mx, gy = L - my, gl = hyp(gx, gy) || 1, k = 1.6 + (p.role === 'FB' ? 0.6 : 0);
          p.tx = mx + gx / gl * k + (b.x - mx) * 0.12; p.ty = my + gy / gl * k;
          p.ty = Math.max(p.ty, Math.min(b.y + 2, L - 6));
        }
      }
      return;
    }
    /* teammates */
    if (own === p) return carry(p, dt);
    const line = secondLast();
    const runIdx = M.ps.filter(q => q.team === 0 && q !== U).indexOf(p);
    const lane = runIdx % 2 ? -1 : 1;
    if (own && own.team === 0) {
      const ahead = Math.min(own.y + 14, line - 0.6, L - 7);
      p.tx = clamp(own.x + lane * (12 + runIdx * 4) * (own.x > CX ? -0.6 : 1), 6, PITCH.W - 6);
      p.ty = Math.max(p.y, ahead);
      if (p.role === 'ST') { p.tx = clamp(CX + lane * 4, 8, PITCH.W - 8); p.ty = Math.min(line - 0.4, L - 8); }
    } else if (!own) {
      if (nearest(0, b, q => q !== U) === p && d2(p, b) < 12) { p.tx = b.x; p.ty = b.y; }
      else { p.tx = p.x; p.ty = p.y; }
    } else { p.tx = p.x; p.ty = Math.max(p.y - 3, b.y - 6); }
  }
  function coverMan(presser, own) { let best = null, bd = 1e9; for (const q of M.ps) if (q.team === 1 && q !== presser && q.role !== 'GK' && q.role !== 'WALL' && q.y > own.y - 2) { const dd = d2(q, own); if (dd < bd) { bd = dd; best = q; } } return best; }
  function nearest(team, t, f) { let best = null, bd = 1e9; for (const q of M.ps) if (q.team === team && (!f || f(q))) { const dd = d2(q, t); if (dd < bd) { bd = dd; best = q; } } return best; }
  /* a teammate on the ball: keep it a moment, then find the user (the moment is about him), or finish it himself */
  function carry(p, dt) {
    const U = M.U, b = M.ball;
    p.hold = (p.hold || 0) + dt;
    const press = M.ps.some(o => o.team === 1 && o.role !== 'GK' && d2(o, p) < 2.2);
    const dist = hyp(CX - p.x, L - p.y);
    p.tx = lerp(p.x, CX, 0.3); p.ty = p.y + 6;
    const uOpen = !M.ps.some(o => o.team === 1 && o.role !== 'GK' && d2(o, U) < 2.2);
    if (dist < 17 && p.hold > 0.35 && (!uOpen || p.hold > 1.6)) { shoot(p, CX + rnd(-POST + 0.5, POST - 0.5), rnd(0.4, 0.8), rnd(-14, 14)); say(`${p.num} shoots…`); return; }
    const running = U.vy > 3.5, line = secondLast();
    /* a forward run is a call for the ball in itself (one thumb cannot drag and tap at once) */
    if (((U.call > 0 || running) && p.hold > 0.35 && (running || U.y < line - 4)) || (uOpen && p.hold > 1.6) || (press && p.hold > 0.9) || p.hold > 2.8) {
      const through = U.y > p.y + 8 && U.y > line - 5 && running;
      if (through) {
        /* in behind: aim at the space the runner is heading for, past the last man */
        const tx = clamp(U.x + U.vx * 0.9, 6, PITCH.W - 6), ty = Math.min(L - 9, Math.max(line + 5, U.y + U.vy * 1.1));
        pass(p, null, { x: tx, y: ty }, 0.6, 0, M.ps.some(o => o.team === 1 && o.role !== 'GK' && segDist(o, p, { x: tx, y: ty }) < 2.8), 9);
        M.lastKick.to = U;
      } else pass(p, U, null, 0.55, 0, false);
      U.call = 0;
    }
  }
  function keeper(g, dt) {
    const b = M.ball, s = M.shot;
    const ref = g.a.gk;
    if (s && !g.dive && b.vy > 2 && !b.owner) {
      if (!s.reacted) { s.reacted = true; g.react = 0.12 + (90 - ref) * 0.003 + rnd(0, 0.08); if (M.type === 'pen') g.react = 0.02; }
      if (g.react > 0) g.react -= dt;
      else {
        const path = PS.phys.predict(b, c => c.y >= g.y);
        const e = path[path.length - 1];
        if (e && e.y >= g.y - 0.3) {
          if (M.type === 'pen') {
            /* a penalty: the keeper commits as it is struck. He reads it now and then; otherwise he guesses a side
               (or, one time in seven, stays big in the middle) */
            const read = Math.random() < 0.12 + ref * 0.002, r = Math.random();
            g.diveX = read ? CX + clamp(e.x - CX, -2.3, 2.3) : r < 0.14 ? CX : CX + (r < 0.57 ? -2.3 : 2.3);
          } else g.diveX = e.x;
          g.diveZ = e.z; g.dive = 0.001;
        }
      }
    }
    if (g.dive) {
      g.dive += dt;
      if (g.dive > 1.3) { g.dive = 0; g.vx = 0; }
      const sp = 2.3 + ref * 0.012;
      const dx = g.diveX - g.x;
      g.vx = clamp(dx * 9, -sp, sp); g.vy = 0;
      g.tx = g.x; g.ty = g.y;
      return;
    }
    /* positioning: on the line between the ball and the middle of the goal, coming off it to narrow the angle */
    const bx = b.x, by = b.y, dd = hyp(CX - bx, L - by);
    const off = M.type === 'pen' && M.set ? 0.3 : clamp(dd * 0.17, 1, 5.5);
    g.tx = CX + (bx - CX) / dd * off; g.ty = L - (L - by) / dd * off;
    const own = b.owner;
    const inBox = by > L - PITCH.BOXD && Math.abs(bx - CX) < PITCH.BOXW / 2;
    if (own && own.team === 0 && inBox && dd < 11) { g.tx = bx; g.ty = by; if (d2(g, own) < 1.2 && g.cd <= 0) { g.cd = 0.7; if (Math.random() < 0.3 + ref * 0.003) { steal(g, own); } } }
    if (!own && inBox && hyp(b.vx, b.vy) < 9 && nearest(1, b) === g) { g.tx = b.x; g.ty = b.y; }
  }

  /* ---------------------------------------------------------------- simulation step */
  function update(dt) {
    const m = M, b = m.ball, U = m.U;
    m.t += dt;
    if (m.msgT > 0) m.msgT -= dt;
    if (m.slowT > 0) { m.slowT -= dt / Math.max(m.slow, 0.3); if (m.slowT <= 0) m.slow = 1; }
    if (m.over) { m.over -= dt; if (m.celebrate) celebrate(dt); stepBall(dt); if (m.over <= 0) close(); return; }
    /* the user's movement from the stick */
    if (!m.set || m.type === 'none') {
      const jl = hyp(touch.jx, touch.jy);
      if (touch.joy && jl > 0.12) {
        const mag = clamp(jl, 0, 1.25), sprint = mag > 1.05;
        const sp = maxSpd(U, b.owner === U) * (sprint ? 1 : 0.62 + 0.38 * Math.min(1, mag));
        U.tx = U.x + touch.jx / jl * sp; U.ty = U.y - touch.jy / jl * sp;
        U.want = sp;
      } else { U.tx = U.x; U.ty = U.y; U.want = 0; }
      /* a loose ball close by pulls the user to it */
      if (!b.owner && !touch.joy && d2(U, b) < 3 && b.z < 1.2) { U.tx = b.x; U.ty = b.y; U.want = maxSpd(U) * 0.7; }
      /* a pass played for the user: his run bends onto the ball (where it will be when he gets there) */
      if (!b.owner && m.lastKick && m.lastKick.to === U && m.lastKick.by !== U && m.t - m.lastKick.t < 3) {
        const pr = PS.phys.predict(b, (c, t) => t > clamp(d2(U, b) / 8, 0.2, 1.6)); const e = pr[pr.length - 1];
        if (e) { const w = touch.joy ? 0.65 : 1; U.tx = lerp(U.tx, e.x, w); U.ty = lerp(U.ty, e.y, w); U.want = Math.max(U.want || 0, maxSpd(U) * (touch.joy ? 1 : 0.85)); }
      }
    }
    for (const p of m.ps) {
      if (p.stun > 0) p.stun -= dt;
      if (p.cd > 0) p.cd -= dt;
      if (p.call > 0) p.call -= dt;
      if (p.burst > 0) p.burst -= dt;
      if (p.jump > 0) p.jump += dt;
      ai(p, dt);
      if (p.dive) { p.x += p.vx * dt; continue; }
      if (p.stun > 0 && p !== U) { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx * dt; p.y += p.vy * dt; continue; }
      let dx = p.tx - p.x, dy = p.ty - p.y; const dl = hyp(dx, dy);
      const top = p === U ? (U.want || 0) : maxSpd(p, b.owner === p) * (p.team === 1 ? 0.92 : 0.88);
      const want = dl < 0.15 ? 0 : Math.min(top, dl * 3);
      const wx = dl ? dx / dl * want : 0, wy = dl ? dy / dl * want : 0;
      const accl = (p.stun > 0 ? 3 : 10) * dt;
      p.vx += clamp(wx - p.vx, -accl, accl); p.vy += clamp(wy - p.vy, -accl, accl);
      p.x = clamp(p.x + p.vx * dt, -2, PITCH.W + 2); p.y = clamp(p.y + p.vy * dt, 0, L + 0.5);
      const v = hyp(p.vx, p.vy);
      if (v > 0.6) p.face = Math.atan2(p.vx, p.vy);
      else if (p.team === 1) p.face = Math.atan2(b.x - p.x, b.y - p.y);
      p.phase += v * dt * 2.2;
    }
    /* keep players from standing inside each other */
    for (let i = 0; i < m.ps.length; i++) for (let j = i + 1; j < m.ps.length; j++) {
      const a = m.ps[i], c = m.ps[j], dx = c.x - a.x, dy = c.y - a.y, dd = hyp(dx, dy);
      if (dd < 0.7 && dd > 0) { const k = (0.7 - dd) / dd * 0.5; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
    }
    if (b.owner) {
      const o = b.owner;
      place(b, o);
      if (o.team === 1) { o.secure = (o.secure || 0) + dt; if (o.secure > 0.45) return finish(o.role === 'GK' ? 'saved' : 'lost', o.role === 'GK' ? 'The keeper gathers.' : 'Possession lost.'); }
      if (o === U && touch.joy) {
        /* beating a man: count a dribble when the user goes past a defender who was in front */
        for (const q of m.ps) if (q.team === 1 && q.role !== 'GK') {
          const was = q.inFront, now = q.y > U.y && d2(q, U) < 2.6;
          if (was && q.y < U.y - 0.6 && d2(q, U) < 3) { m.res.dribbles++; q.inFront = false; say('Skinned him!', 0.9); }
          else if (now) q.inFront = true;
        }
      }
    } else stepBall(dt);
    /* the moment runs out */
    if (m.t > m.tmax && !m.over) finish('time', 'The chance is gone.');
  }
  function stepBall(dt) {
    const m = M, b = m.ball, ev = [];
    const py = b.y;
    PS.phys.step(b, dt, ev);
    if (m.over) return;
    for (const e of ev) {
      if (e === 'goal') return scored();
      if (e === 'post' || e === 'bar') { say(e === 'post' ? 'OFF THE POST!' : 'Crossbar!'); m.flash = 0.3; }
      if (e === 'out' || e === 'owngoal') {
        if (m.lastKick?.kind === 'shot' && m.lastKick.by.team === 0) return finish('miss', b.y > L - 1 ? 'Wide!' : 'Out of play.');
        return finish('out', 'Out of play.');
      }
    }
    /* the keeper's hands */
    const g = m.gk;
    if (m.shot && b.vy > 0 && py < g.y && b.y >= g.y - 0.1) {
      const reach = (M.type === 'pen' ? 0.35 : 0.6) + (g.dive ? clamp(g.dive * 3, 0, 1.1) : 0) + g.a.gk * 0.002, dxk = Math.abs(b.x - g.x);
      /* at full stretch it is a fingertip: sometimes it goes in anyway */
      const e = clamp((dxk / reach - 0.45) / 0.55, 0, 1), hands = 0.97 - (M.type === 'pen' ? 0.62 : 0.55) * e * e * (3 - 2 * e) - Math.max(0, hyp(b.vx, b.vy) - 24) * 0.012;
      if (dxk < reach && b.z < 2.3 + g.a.gk * 0.002 && Math.random() < hands) {
        const sp = hyp(b.vx, b.vy, b.vz);
        const byUser = m.shot.by === m.U;
        if (byUser) m.res.onT++;
        if (sp < 17 && dxk < 0.55 && b.z < 1.9) { b.owner = g; m.res.saves++; m.shot = null; return finish('saved', 'Saved! Held by the keeper.'); }
        b.vy = -Math.abs(b.vy) * 0.3; b.vx = (b.x > g.x ? 1 : -1) * rnd(3, 7); b.vz = rnd(1, 3); b.spin = 0; b.last = g;
        m.res.saves++; m.shot = null; m.parried = 1; say('Great save! Parried…'); m.flash = 0.25;
      }
    }
    /* bodies in the way: walls and defenders block, players control or head the ball */
    for (const p of m.ps) {
      if (p === m.lastKick?.by && m.t - m.lastKick.t < 0.25) continue;
      if (p.role === 'GK' || p.stun > 0 || p.cd > 0) continue;
      const dd = d2(p, b), jumpH = p.jump ? Math.max(0, Math.sin(Math.min(1, p.jump / 0.5) * Math.PI)) * 0.5 : 0;
      const sp = hyp(b.vx, b.vy);
      if (p.team === 1 && dd < 0.45 && b.z < 1.85 + jumpH && sp > 9) {
        b.vy = -Math.abs(b.vy) * rnd(0.15, 0.4); b.vx = rnd(-5, 5); b.vz = rnd(0.5, 3); b.spin = 0; b.last = p; m.shot = null;
        say(p.role === 'WALL' ? 'Blocked by the wall!' : 'Blocked!'); return;
      }
      const reach = p === m.U ? 1.0 : 0.8;
      if (dd < reach && b.z < 1.0) {
        const rel = hyp(b.vx - p.vx, b.vy - p.vy), ctrl = 11 + p.a.dri * 0.13 + (p.team === 1 ? -2 : 0);
        if (p.team === 1 && sp > 6) {
          const kid = m.lastKick ? m.lastKick.t : 0;
          if (p.rollFor !== kid) { p.rollFor = kid; p.rollOk = Math.random() < clamp(0.72 - sp * 0.03 + p.a.def * 0.003, 0.12, 0.75); }
          if (!p.rollOk) continue;
        }
        if (rel < ctrl) {
          if (m.offside.has(p)) { m.res.offside = p === m.U ? 1 : 0; return finish('offside', 'Flag up! Offside.'); }
          m.offside.clear();
          if (m.assistBy && p !== m.U && m.assistBy.to !== p) m.assistBy = null;
          b.owner = p; p.hold = 0; p.secure = 0; m.shot = null; m.log.push(m.t.toFixed(2) + ` control ${p.user ? 'YOU' : p.role + p.team}`);
          if (p.team === 0 && p !== m.U && m.lastKick?.by === m.U) { const lk = m.lastKick; if (p.y > L - 30) m.res.keyPass = 1; }
          return;
        }
        b.vx = (b.vx - p.vx) * -0.25 + p.vx; b.vy = (b.vy - p.vy) * -0.25 + p.vy; b.last = p;
      }
      /* a header: in the air, at head height, near the goal */
      if (dd < 1.1 && b.z > 1.3 && b.z < 2.6 && p.cd <= 0) {
        if (p.team === 0 && p.y > L - 20) {
          const tx = CX + (p.x > CX ? -1 : 1) * rnd(0.5, POST - 0.4);
          const a = Math.atan2(tx - b.x, L - b.y) + gauss() * (0.08 - p.a.phy * 0.0005), v = 11 + p.a.phy * 0.05;
          kick(p, Math.sin(a) * v, Math.cos(a) * v, -1.2 + rnd(0, 1.6), 0, 'shot');
          say(p === m.U ? 'HEADER!' : `Header from ${p.num}!`);
          if (p === m.U) { /* counted in kick */ }
          return;
        }
        if (p.team === 1) {
          const a = p.face + rnd(-0.8, 0.8);
          kick(p, Math.sin(a) * -8 + rnd(-4, 4), -Math.abs(Math.cos(a) * 12), 5, 0, 'clear');
          say('Headed clear.');
          setTimeout(() => M && !M.over && finish('cleared', 'Cleared.'), 700);
          return;
        }
      }
    }
  }
  function scored() {
    const m = M, k = m.lastKick, by = k ? k.by : m.ball.last;
    if (by && by.team === 1) return finish('out', 'Own goal… by them! Counts for you.', 2.4, true);
    if (by === m.U) { m.res.goal = 1; if (k && k.kind === 'shot') m.res.onT++; else m.res.shots++, m.res.onT++; finish('goal', 'GOAL!', 3.2, true); }
    else {
      if (m.assistBy && m.assistBy.to === by) { m.res.assist = 1; finish('assist', 'GOAL! And you set it up.', 3.2, true); }
      else finish('goal-team', 'GOAL! ' + (by ? by.num : '') + ' finishes it.', 3.0, true);
    }
  }
  function finish(kind, text, hold = 1.5, cele = false) {
    if (M.over) return;
    if (M.parried && (kind === 'lost' || kind === 'out' && !cele || kind === 'cleared' || kind === 'time')) { kind = 'saved'; text = text === 'Out of play.' ? 'Saved, and out for a corner.' : 'Saved! ' + text; }
    M.end = kind; M.endText = text; M.over = hold; M.celebrate = cele ? 1 : 0;
    M.slow = 1; M.slowT = 0;
    if (cele) { M.flash = 0.5; burst(M.ball.x, Math.min(M.ball.y, L), 0); }
    banner(text, kind);
    if (kind === 'goal-team' || kind === 'assist' || (kind === 'out' && cele)) M.res.teamGoal = 1;
  }
  function celebrate(dt) {
    const U = M.U;
    if (M.end === 'goal') { U.tx = clamp(U.x + (U.x > CX ? 1 : -1) * 6, 2, PITCH.W - 2); U.ty = Math.min(L - 2, U.y + 3); U.want = 6;
      const dx = U.tx - U.x, dy = U.ty - U.y, l = hyp(dx, dy) || 1; U.x += dx / l * Math.min(l, 6 * dt); U.y += dy / l * Math.min(l, 6 * dt); U.phase += 6 * dt * 2.2; }
    for (const f of M.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= 9.8 * dt * 0.3; f.life -= dt; }
  }
  function burst(x, y, z) { for (let i = 0; i < 70; i++) M.fx.push({ x, y, z: z + 1, vx: rnd(-4, 4), vy: rnd(-4, 4), vz: rnd(2, 9), life: rnd(1.2, 2.6), c: pick(['#ffffff', 'var', '#ffd23f']) }); }
  function close() {
    const res = M.res, cb = done;
    res.end = M.end; res.text = M.endText; res.log = M.log.concat(M.t.toFixed(2) + ' END ' + M.end);
    M = null; done = null;
    cancelAnimationFrame(raf); raf = 0;
    hud.innerHTML = '';
    if (cb) cb(res);
  }
  function say(t, s = 1.2) { if (!M) return; M.msg = t; M.msgT = s; M.log.push(Math.round(M.t * 100) / 100 + ' ' + t); }
  function banner(t, kind) {
    const el = document.createElement('div');
    el.className = 'mbanner ' + (kind === 'goal' || kind === 'assist' || kind === 'goal-team' ? 'gold' : kind === 'foul' ? 'warn' : '');
    el.textContent = t; hud.appendChild(el);
  }

  /* ---------------------------------------------------------------- camera and projection */
  const CAM = { pitch: 52 * Math.PI / 180, h: 17, f: 1, cy: 0.42 };
  let C = { x: 0, y: 0, z: 0, cs: 0, sn: 0 };
  function setCam() {
    const m = M, U = m.U, b = m.ball;
    let tx = lerp(b.x, U.x, 0.4), ty = lerp(b.y, U.y, 0.4) + 8;
    tx = lerp(tx, CX, clamp((34 - (L - b.y)) / 24, 0, 0.55));   // near goal, pull the goal into the frame
    tx = clamp(tx, 9, PITCH.W - 9); ty = clamp(ty, 20, L - 11);
    const k = 1 - Math.exp(-acc0 * 3.5);
    m.cam.x += (tx - m.cam.x) * k; m.cam.y += (ty - m.cam.y) * k;
    CAM.f = Math.min(W * 1.08, H * 0.54);
    const cs = Math.cos(CAM.pitch), sn = Math.sin(CAM.pitch);
    C = { x: m.cam.x, y: m.cam.y - CAM.h / Math.tan(CAM.pitch), z: CAM.h, cs, sn };
  }
  let acc0 = 0.016, ACC = '#3ee08f', lastHud = '';
  function project(x, y, z) {
    const dx = x - C.x, dy = y - C.y, dz = z - C.z;
    const zc = dy * C.cs - dz * C.sn, yc = dy * C.sn + dz * C.cs;
    const s = CAM.f / Math.max(zc, 0.5);
    return { x: W / 2 + dx * s, y: H * CAM.cy - yc * s, s, zc };
  }
  function ray(sx, sy) {
    const xc = (sx - W / 2) / CAM.f, yc = (H * CAM.cy - sy) / CAM.f;
    return { ox: C.x, oy: C.y, oz: C.z, dx: xc, dy: yc * C.sn + C.cs, dz: yc * C.cs - C.sn };
  }
  function unproject(sx, sy) {
    const r = ray(sx, sy), t = r.dz < -0.02 ? -r.oz / r.dz : 400;
    return { x: r.ox + r.dx * t, y: r.oy + r.dy * t };
  }

  /* ---------------------------------------------------------------- drawing */
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => { const s = project(p[0], p[1], p[2] || 0); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function line3(pts, w) {   // a pitch marking: width in metres, so it thins with distance
    ctx.beginPath();
    pts.forEach((p, i) => { const s = project(p[0], p[1], 0); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.stroke();
  }
  const arc = (cx, cy, r, a0, a1, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.sin(a) * r, cy + Math.cos(a) * r]; });
  function drawPitch() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.4);
    g.addColorStop(0, '#05080f'); g.addColorStop(1, '#0d1626');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* the stands: a dark bowl with a crowd of coloured dots */
    poly([[-30, L + 5], [PITCH.W + 30, L + 5], [PITCH.W + 30, L + 22, 11], [-30, L + 22, 11]], '#111a2b');
    poly([[-5, 0], [-5, L + 5], [-24, L + 22, 11], [-24, 0, 11]], '#0f1726');
    poly([[PITCH.W + 5, 0], [PITCH.W + 5, L + 5], [PITCH.W + 24, L + 22, 11], [PITCH.W + 24, 0, 11]], '#0f1726');
    const cols = [M.cfg.us.c1, M.cfg.us.c2, '#cbd5e1', '#64748b', M.cfg.them.c1];
    for (const c of CROWD) {
      const s = project(c.x, c.y, c.z); if (s.zc < 1 || s.y < -4 || s.y > H) continue;
      ctx.fillStyle = cols[Math.floor(c.c * cols.length)]; ctx.globalAlpha = 0.38;
      const r = Math.max(0.6, s.s * 0.17); ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2.4);
    }
    ctx.globalAlpha = 1;
    /* grass: a margin round the pitch, then mown stripes */
    poly([[-5, -5], [PITCH.W + 5, -5], [PITCH.W + 5, L + 5], [-5, L + 5]], '#246b37');
    const y0 = Math.max(0, C.y - 2), stripe = L / 20;
    for (let i = Math.floor(y0 / stripe); i < 20; i++) poly([[0, i * stripe], [PITCH.W, i * stripe], [PITCH.W, (i + 1) * stripe], [0, (i + 1) * stripe]], i % 2 ? '#2f8a47' : '#2a7e40');
    /* advertising boards behind the goal and down the touchlines */
    const ad = ['#0b1f44', M.cfg.us.c1, '#111827', M.cfg.them.c1];
    for (let i = 0; i < 8; i++) poly([[i * 9.2 - 3, L + 3.5, 0], [i * 9.2 + 6, L + 3.5, 0], [i * 9.2 + 6, L + 3.5, 0.9], [i * 9.2 - 3, L + 3.5, 0.9]], ad[i % 4]);
    for (let i = 0; i < 11; i++) for (const x of [-3, PITCH.W + 3]) poly([[x, i * 10, 0], [x, i * 10 + 9.5, 0], [x, i * 10 + 9.5, 0.9], [x, i * 10, 0.9]], ad[(i + (x > 0 ? 1 : 0)) % 4]);
    /* markings */
    ctx.strokeStyle = 'rgba(255,255,255,.86)'; ctx.lineWidth = Math.max(1, CAM.f / 260); ctx.lineJoin = 'round';
    line3([[0, 0], [PITCH.W, 0], [PITCH.W, L], [0, L], [0, 0]]);
    line3([[0, L / 2], [PITCH.W, L / 2]]);
    line3(arc(CX, L / 2, PITCH.CIRC, 0, Math.PI * 2, 48));
    const box = (y, s) => {
      const bw = PITCH.BOXW / 2, sw = PITCH.SIXW / 2;
      line3([[CX - bw, y], [CX - bw, y - s * PITCH.BOXD], [CX + bw, y - s * PITCH.BOXD], [CX + bw, y]]);
      line3([[CX - sw, y], [CX - sw, y - s * PITCH.SIXD], [CX + sw, y - s * PITCH.SIXD], [CX + sw, y]]);
      const sp = y - s * PITCH.SPOT, a = Math.acos((PITCH.BOXD - PITCH.SPOT) / PITCH.CIRC);
      line3(s > 0 ? arc(CX, sp, PITCH.CIRC, Math.PI - a, Math.PI + a) : arc(CX, sp, PITCH.CIRC, -a, a));
      const q = project(CX, sp, 0); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, q.s * 0.12), 0, 7); ctx.fill();
    };
    box(L, 1); box(0, -1);
    for (const [x, y, a0] of [[0, L, Math.PI / 2], [PITCH.W, L, Math.PI], [0, 0, 0], [PITCH.W, 0, -Math.PI / 2]]) line3(arc(x, y, 1, a0, a0 + Math.PI / 2, 6));
  }
  function drawGoal(front) {
    const x0 = CX - POST, x1 = CX + POST, gh = PITCH.GH, n = PITCH.NET;
    if (!front) {
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) { const x = lerp(x0, x1, i / 12); poly([[x, L + n, 0], [x, L + n, gh * 0.8], [x, L, gh]], null, 'rgba(255,255,255,.25)', 1); }
      for (let i = 0; i <= 6; i++) { const z = gh * 0.8 * i / 6; poly([[x0, L + n, z], [x1, L + n, z]], null, 'rgba(255,255,255,.22)', 1); }
      for (let i = 0; i <= 6; i++) { const y = L + n * i / 6, z = lerp(gh, gh * 0.8, i / 6); poly([[x0, y, z], [x1, y, z]], null, 'rgba(255,255,255,.22)', 1); }
      for (const x of [x0, x1]) for (let i = 0; i <= 4; i++) poly([[x, L, gh * i / 4], [x, L + n, gh * 0.8 * i / 4]], null, 'rgba(255,255,255,.2)', 1);
      return;
    }
    const s = project(CX, L, 0);
    ctx.lineWidth = Math.max(2, s.s * 0.12); ctx.strokeStyle = '#f8fafc'; ctx.lineCap = 'round';
    poly([[x0, L, 0], [x0, L, gh], [x1, L, gh], [x1, L, 0]], null, '#f8fafc', Math.max(2, s.s * 0.12));
  }
  const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#5c3a21', '#ffdbac'];
  function drawPlayer(p) {
    const s = project(p.x, p.y, 0); if (s.zc < 1) return;
    const k = s.s, us = p.team === 0, club = us ? M.cfg.us : M.cfg.them;
    const gk = p.role === 'GK';
    const shirt = gk ? (us ? '#22d3ee' : '#d9f99d') : club.c1, shorts = gk ? '#111827' : club.c2;
    const v = hyp(p.vx, p.vy), run = Math.min(1, v / 6), ph = p.phase * 2;
    const lift = (p.jump ? Math.max(0, Math.sin(Math.min(1, p.jump / 0.5) * Math.PI)) * 0.45 : 0);
    const diveLean = p.dive ? clamp((p.diveX - CX) * 0.3, -1.2, 1.2) * Math.min(1, p.dive * 4) : 0;
    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, k * 0.42, k * 0.17, 0, 0, 7); ctx.fill();
    if (p.user) {
      ctx.strokeStyle = ACC;
      ctx.lineWidth = Math.max(2, k * 0.09); ctx.beginPath(); ctx.ellipse(s.x, s.y, k * 0.62, k * 0.25, 0, 0, 7); ctx.stroke();
    }
    if (M.offside.has(p) && M.ball && !M.ball.owner) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(s.x, s.y, k * 0.5, k * 0.2, 0, 0, 7); ctx.stroke(); }
    const P = z => project(p.x + diveLean * z * 0.5, p.y, z + lift);
    const hip = P(0.92), sh = P(1.42), hd = P(1.66);
    /* legs */
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, k * 0.15);
    for (const sgn of [-1, 1]) {
      const sw = Math.sin(ph + (sgn > 0 ? 0 : Math.PI)) * run;
      const fx = s.x + sgn * k * 0.13 + Math.sin(p.face) * sw * k * 0.3, fy = s.y - Math.max(0, sw) * k * 0.18 - lift * k * 0.9;
      ctx.strokeStyle = SKIN[p.num % SKIN.length]; ctx.beginPath(); ctx.moveTo(hip.x + sgn * k * 0.1, hip.y); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = '#0b0f17'; ctx.lineWidth = Math.max(2, k * 0.17); ctx.beginPath(); ctx.moveTo(fx, fy - k * 0.12); ctx.lineTo(fx, fy); ctx.stroke(); ctx.lineWidth = Math.max(2, k * 0.15);
    }
    /* shorts and shirt */
    ctx.fillStyle = shorts; rrect(hip.x - k * 0.25, hip.y - k * 0.2, k * 0.5, k * 0.26, k * 0.06);
    ctx.fillStyle = shirt; rrect(sh.x - k * 0.27, sh.y - k * 0.02, k * 0.54, (hip.y - sh.y) + k * 0.06, k * 0.1);
    /* arms */
    ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(2, k * 0.13);
    const armsUp = p.dive || (M.celebrate && p.team === 0 && M.over) ? 1 : 0;
    for (const sgn of [-1, 1]) {
      const sw = Math.sin(ph + (sgn > 0 ? Math.PI : 0)) * run;
      ctx.beginPath(); ctx.moveTo(sh.x + sgn * k * 0.25, sh.y + k * 0.05);
      ctx.lineTo(sh.x + sgn * k * (0.33 + armsUp * 0.15), sh.y + k * (0.42 - armsUp * 0.85) + sw * k * 0.08); ctx.stroke();
    }
    /* number on the back (the camera is behind our players) */
    if (k > 14) { ctx.fillStyle = shorts; ctx.font = `800 ${Math.round(k * 0.26)}px Archivo, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.num, sh.x, (sh.y + hip.y) / 2); }
    /* head */
    ctx.fillStyle = SKIN[p.num % SKIN.length]; ctx.beginPath(); ctx.arc(hd.x, hd.y, k * 0.13, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a120b'; ctx.beginPath(); ctx.arc(hd.x, hd.y - k * 0.03, k * 0.13, Math.PI, 0); ctx.fill();
    if (p.user) {
      const t = performance.now() / 300;
      ctx.fillStyle = ACC;
      const ay = hd.y - k * 0.45 - Math.sin(t) * 2;
      ctx.beginPath(); ctx.moveTo(hd.x - 6, ay - 7); ctx.lineTo(hd.x + 6, ay - 7); ctx.lineTo(hd.x, ay); ctx.closePath(); ctx.fill();
    }
    if (p.call > 0 && p.user) { ctx.fillStyle = '#fff'; ctx.font = '800 12px Archivo'; ctx.textAlign = 'center'; ctx.fillText('HERE!', hd.x, hd.y - k * 0.75); }
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }
  function drawBall() {
    const b = M.ball, sh = project(b.x, b.y, 0), s = project(b.x, b.y, b.z);
    if (s.zc < 1) return;
    const r = Math.max(2.6, s.s * R * 1.25);
    ctx.fillStyle = `rgba(0,0,0,${clamp(0.35 - b.z * 0.04, 0.08, 0.35)})`; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * 1.1, r * 0.45, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(s.x - r * 0.35, s.y - r * 0.35, r * 0.1, s.x, s.y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#111827';
    for (let i = 0; i < 3; i++) { const a = b.roll + i * 2.1; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * r * 0.5, s.y + Math.sin(a) * r * 0.45, r * 0.24, 0, 7); ctx.fill(); }
    /* when the user can kick it: a soft glow */
    if (!b.owner && d2(b, M.U) < 1.5 && b.z < 1.9) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x, s.y, r + 4, 0, 7); ctx.stroke(); }
  }
  function drawInput() {
    const acc = ACC;
    if (touch.id !== null && touch.joy) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(touch.sx, touch.sy, 64, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(touch.sx + touch.jx * 64, touch.sy + touch.jy * 64, 24, 0, 7); ctx.fill();
      if (hyp(touch.jx, touch.jy) > 1.05) { ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(touch.sx, touch.sy, 70, 0, 7); ctx.stroke(); }
    }
    const now = performance.now();
    if (touch.trail.length && now - touch.trail[0].t < 350) {
      const a = 1 - (now - touch.trail[0].t) / 350;
      ctx.strokeStyle = acc; ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); touch.trail.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  function draw() {
    setCam();
    drawPitch();
    drawGoal(false);
    const objs = M.ps.slice().sort((a, c) => c.y - a.y);
    const b = M.ball;
    let drawn = false;
    for (const p of objs) {
      if (!drawn && p.y < b.y) { drawBall(); drawn = true; }
      drawPlayer(p);
    }
    if (!drawn) drawBall();
    drawGoal(true);
    for (const f of M.fx) if (f.life > 0) { const s = project(f.x, f.y, f.z); ctx.fillStyle = f.c === 'var' ? M.cfg.us.c1 : f.c; ctx.globalAlpha = Math.min(1, f.life); ctx.fillRect(s.x - 2, s.y - 2, 4, 5); }
    ctx.globalAlpha = 1;
    if (M.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${M.flash * 0.5})`; ctx.fillRect(0, 0, W, H); M.flash -= acc0; }
    drawInput();
    /* the scorebug and the moment's title */
    const c = M.cfg;
    const hs = `<div class="mbug"><i style="background:${c.us.c1}"></i><b>${c.us.ab}</b><u>${c.score[0]}–${c.score[1]}</u><b>${c.them.ab}</b><i style="background:${c.them.c1}"></i><em>${c.minute}'</em></div>` +
      `<div class="mtitle">${M.title}</div>` + (M.t < 3.2 && !M.over ? `<div class="mhint">${M.hint}</div>` : '') + (!M.ready ? '<div class="mready">Touch to play</div>' : '') +
      `<div class="mtime"><i style="width:${Math.round(clamp(100 - M.t / M.tmax * 100, 0, 100))}%"></i></div>`;
    if (hs !== lastHud) { hudTop.innerHTML = hs; lastHud = hs; }
    hudMsg.textContent = M.msgT > 0 ? M.msg : '';
    hudMsg.style.opacity = M.msgT > 0 ? Math.min(1, M.msgT * 3) : 0;
  }

  /* ---------------------------------------------------------------- loop */
  function frame(now) {
    if (!M) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; acc0 = dt;
    acc += M.ready ? dt * (M.slow || 1) : 0;
    while (acc >= DT && M) { update(DT); acc -= DT; }
    if (!M) return;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function resize() {
    if (!cv) return;
    const r = wrap.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  let hudTop, hudMsg;
  function mount(el) {
    wrap = el;
    el.innerHTML = '<canvas class="mcv"></canvas><div class="mhud"><div class="mtop"></div><div class="mmsg"></div><div class="mends"></div></div>';
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d');
    hudTop = el.querySelector('.mtop'); hudMsg = el.querySelector('.mmsg'); hud = el.querySelector('.mends');
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    addEventListener('resize', resize);
    resize();
  }
  function start(cfg, cb) {
    resize();
    ACC = (getComputedStyle(document.documentElement).getPropertyValue('--acc') || '').trim() || '#3ee08f';
    lastHud = '';
    M = build(cfg); done = cb; acc = 0; last = performance.now();
    touch.id = null; touch.trail = [];
    hud.innerHTML = '';
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop() { M = null; done = null; cancelAnimationFrame(raf); raf = 0; }

  PS.moment = { mount, start, stop, resize, get M() { return M; }, _: { project, unproject, flick, tap, update, kick, shoot, touch, draw } };
})();
