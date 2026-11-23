/* PocketSoccer: a full match. Eleven against eleven in real time, the way a FIFA-style game plays it, sized for a phone.
   Pitch coordinates in metres (physics.js): x 0..68 across, y 0..105 along. Each team attacks along its `side`
   (+1 toward y = 105, -1 toward y = 0); ends change at half time.
   Two ways to play (o.mode): 'team' you control whichever of your players matters (the ball carrier, the receiver of
   your pass, the closest man on defense; Switch to change), and 'player' (the career) you are one player, your
   teammates play around you and pass to you when you call for it.
   The engine knows nothing of the screen: render3d.js draws G, controls.js feeds G.input. PS.Match.create(o) → G,
   PS.Match.step(G, dt). It can also run headless, many steps a frame, to fast-forward or to test. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const { PITCH, CX, POST, R } = PS.phys;
  const W = PITCH.W, L = PITCH.L;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, hyp = Math.hypot;
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const d2 = (a, b) => hyp(a.x - b.x, a.y - b.y);
  const segDist = (o, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1, t = clamp(((o.x - a.x) * vx + (o.y - a.y) * vy) / l2, 0, 1); return hyp(o.x - a.x - vx * t, o.y - a.y - vy * t); };
  const segT = (o, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1; return clamp(((o.x - a.x) * vx + (o.y - a.y) * vy) / l2, 0, 1); };

  /* formations: slots across (fx, 0 one touchline .. 1 the other) and up (fy, 0 own goal .. 1 theirs), for a team
     attacking +y. */
  const FORMS = {
    '4-3-3': [['GK', .5, .03], ['LB', .13, .24], ['CB', .37, .19], ['CB', .63, .19], ['RB', .87, .24], ['CM', .3, .43], ['DM', .5, .35], ['CM', .7, .43], ['LW', .15, .67], ['ST', .5, .71], ['RW', .85, .67]],
    '4-4-2': [['GK', .5, .03], ['LB', .13, .24], ['CB', .37, .19], ['CB', .63, .19], ['RB', .87, .24], ['LM', .14, .47], ['CM', .39, .42], ['CM', .61, .42], ['RM', .86, .47], ['ST', .4, .7], ['ST', .6, .7]],
    '4-2-3-1': [['GK', .5, .03], ['LB', .13, .24], ['CB', .37, .19], ['CB', .63, .19], ['RB', .87, .24], ['DM', .38, .37], ['DM', .62, .37], ['LW', .16, .6], ['AM', .5, .56], ['RW', .84, .6], ['ST', .5, .72]]
  };
  const DEF = r => r === 'CB' || r === 'LB' || r === 'RB', FWD = r => r === 'ST' || r === 'LW' || r === 'RW';

  /* ------------------------------------------------------------------ set-up */
  function attrsFor(role, ovr) {
    const r = (b, s = 5) => clamp(Math.round(ovr + b + rnd(-s, s)), 25, 97);
    const fw = FWD(role), df = DEF(role), gk = role === 'GK';
    return { pac: r(fw ? 3 : df ? -2 : 0), sho: r(fw ? 4 : df ? -14 : -4), pas: r(fw ? -2 : df ? -4 : 3), dri: r(fw ? 3 : df ? -8 : 1), def: r(df ? 5 : fw ? -22 : -3), phy: r(df ? 3 : 0), gk: gk ? r(3, 4) : 20 };
  }
  function hashSkin(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 6; }

  /* o: { teams: [clubA, clubB] (A is the user's side), names: [[16], [16]], home: 0|1, mode, me: {name,num,pos,a,skin,look},
       halfLen (real seconds a half), on, off (career minutes on the pitch), form: [f0, f1], seed } */
  function create(o) {
    const G = { o, t: 0, half: 1, htime: 0, halfLen: o.halfLen || 180, phase: 'kickoff', phaseT: 0, side: [1, -1], score: [0, 0],
      ball: PS.phys.newBall(), ps: [], teams: [], feed: [], events: [], offside: new Set(), pass: null, shot: null, restart: null,
      input: { mx: 0, my: 0, sprint: false, q: [] }, cam: { fx: 0, fy: 1 }, mode: o.mode || 'team', ctl: null, me: null,
      scorers: [], stats: [blank(), blank()], kickTeam: 0, rng: 0, ff: false, over: false, slow: 1, slowT: 0, lastTouch: null, hold: 0 };
    for (let t = 0; t < 2; t++) {
      const club = o.teams[t], form = FORMS[(o.form && o.form[t]) || (t ? ['4-3-3', '4-4-2', '4-2-3-1'][Math.floor(Math.random() * 3)] : '4-3-3')];
      const names = (o.names && o.names[t]) || PS.sim.squad(Math.floor(Math.random() * 1e9));
      const kit = Object.assign({ ab: club.ab, name: club.name }, club.kit || { c1: club.c1, c2: club.c2 });
      G.teams.push({ club, kit, form, ovr: club.ovr });
      form.forEach(([role, fx, fy], i) => {
        const nm = names[(i + 5) % names.length] || ('Player ' + (i + 1));
        const p = { t, i, role, fx, fy, x: 0, y: 0, vx: 0, vy: 0, face: 0, a: attrsFor(role, club.ovr), name: nm, num: i === 0 ? 1 : [0, 3, 5, 4, 2, 8, 6, 10, 11, 9, 7][i] || i + 1,
          skin: hashSkin(nm), act: null, cd: 0, stun: 0, tx: 0, ty: 0, want: 0, sprint: false, next: Math.random() * 0.3, st: { g: 0, as: 0, sh: 0, ot: 0, ps: 0, pc: 0, kp: 0, tk: 0, dr: 0, it: 0, lost: 0, sv: 0 }, hold: 0 };
        G.ps.push(p);
      });
    }
    /* the user's own player in a career takes the slot of his position */
    if (o.me) {
      const want = { ST: ['ST'], W: ['LW', 'RW', 'LM', 'RM'], CM: ['CM', 'AM', 'DM'] }[o.me.pos] || ['ST'];
      const mine = G.ps.filter(p => p.t === 0);
      const slot = mine.find(p => want.includes(p.role)) || mine[9];
      const mine2 = { name: o.me.name, num: o.me.num, a: Object.assign({ gk: 20 }, o.me.a), skin: o.me.skin ?? slot.skin, look: o.me.look, foot: o.me.foot || 'Right', me: true };
      if (o.on > 0) {
        /* on the bench: he waits off the pitch, and comes on for the man in his slot */
        const me = Object.assign({}, slot, mine2, { st: { g: 0, as: 0, sh: 0, ot: 0, ps: 0, pc: 0, kp: 0, tk: 0, dr: 0, it: 0, lost: 0, sv: 0 }, bench: true, x: -6, y: L / 2 });
        G.ps.push(me); G.me = me; G.sub = { on: o.on, role: slot.role, slot };
      } else { Object.assign(slot, mine2); G.me = slot; }
    }
    G.kickTeam = Math.random() < 0.5 ? 0 : 1;
    kickoff(G, G.kickTeam);
    G.ctl = G.mode === 'player' ? G.me : G.ps.find(p => p.t === 0 && p.role === 'ST');
    say(G, `Kick-off at ${(o.home ? o.teams[1] : o.teams[0]).ground || 'the stadium'}.`, 'ko');
    return G;
  }
  function blank() { return { shots: 0, onT: 0, poss: 0, passes: 0, passOk: 0, corners: 0, fouls: 0, offsides: 0, saves: 0, yellows: 0, xg: 0 }; }
  const teamOf = (G, t) => G.on ? G.on[t] : G.ps.filter(p => p.t === t && !p.bench && !p.off);
  function refresh(G) { G.on = [0, 1].map(t => G.ps.filter(p => p.t === t && !p.bench && !p.off)); G.lines = [offLineRaw(G, 0), offLineRaw(G, 1)]; }
  const opp = t => 1 - t;
  const goalY = (G, t) => G.side[t] > 0 ? L : 0;          // the goal team t attacks
  const ownY = (G, t) => G.side[t] > 0 ? 0 : L;
  const depth = (G, t, y) => G.side[t] > 0 ? y : L - y;    // how far up the pitch, for team t
  const fromDepth = (G, t, d) => G.side[t] > 0 ? d : L - d;
  const slotX = (G, t, fx) => G.side[t] > 0 ? fx * W : W - fx * W;
  function say(G, t, kind) { G.feed.push({ min: minute(G), t, kind: kind || '' }); if (G.feed.length > 60) G.feed.shift(); G.events.push({ k: 'say', t, kind }); }
  function minute(G) { return Math.floor((G.half - 1) * 45 + G.htime / G.halfLen * 45) + 1; }
  /* the clock as it is shown: 45+2' in stoppage time */
  function clock(G) { const m = minute(G), end = G.half * 45; return m > end ? `${end}+${m - end}'` : `${m}'`; }

  /* ------------------------------------------------------------------ positions */
  /* where a player should be: his slot, moved with the ball (up and across, tighter without the ball) */
  function shape(G, p) {
    const t = p.t, b = G.ball, bd = depth(G, t, b.y), has = possTeam(G) === t;
    const bxF = G.side[t] > 0 ? b.x : W - b.x;   // the ball across, in this team's frame
    let fx = p.fx, fy = p.fy;
    let x, dy;
    if (has) {
      dy = fy * L * 0.92 + clamp(bd - 40, -12, 42) * 0.62;
      x = W / 2 + (fx * W - W / 2) * 1.08 + (bxF - W / 2) * 0.18;
      if (FWD(p.role)) dy = Math.max(dy, Math.min(bd + 14, L * 0.84));
    } else {
      dy = fy * L * 0.88 + clamp(bd - 55, -30, 28) * 0.7;
      x = W / 2 + (fx * W - W / 2) * 0.78 + (bxF - W / 2) * 0.3;
      if (DEF(p.role)) dy = Math.min(dy, Math.max(bd - 4, 14));
      if (FWD(p.role)) dy = Math.max(dy, L * 0.42);
    }
    if (p.role === 'GK') { dy = 2; x = W / 2; }
    /* forwards stay onside while the ball is behind them */
    if (has && p.role !== 'GK') { const line = offLine(G, t); dy = Math.min(dy, Math.max(line - 0.6, bd)); }
    dy = clamp(dy, 1, L - 3);
    x = clamp(x, 2, W - 2);
    return { x: G.side[t] > 0 ? x : W - x, y: fromDepth(G, t, dy) };
  }
  /* the offside line for team t's attackers: the second-last opponent's depth (in t's frame), never short of halfway */
  function offLine(G, t) { return G.lines ? G.lines[t] : offLineRaw(G, t); }
  function offLineRaw(G, t) {
    const ds = teamOf(G, opp(t)).map(q => depth(G, t, q.y)).sort((a, c) => c - a);
    return Math.max(ds[1] ?? L / 2, L / 2, depth(G, t, G.ball.y));
  }
  function possTeam(G) { const o = G.ball.owner; if (o) return o.t; if (G.pass) return G.pass.from.t; return G.lastTouch ? G.lastTouch.t : -1; }

  /* ------------------------------------------------------------------ restarts */
  function placeFormation(G, t, kicking) {
    for (const p of teamOf(G, t)) {
      let dy = p.fy * L * 0.85; if (p.role !== 'GK') dy = Math.min(dy, L / 2 - 1.5); else dy = 1.5;
      let x = p.fx * W;
      if (kicking && p.role === 'ST') { dy = L / 2 - 0.3; x = W / 2 + (p.fx < 0.5 ? -0.8 : 0.8); }
      if (!kicking && p.role !== 'GK') dy = Math.min(dy, L / 2 - PITCH.CIRC - 0.5);
      p.x = G.side[t] > 0 ? x : W - x; p.y = fromDepth(G, t, dy); p.vx = p.vy = 0; p.act = null; p.stun = 0;
      p.face = G.side[t] > 0 ? 0 : Math.PI;
    }
  }
  function kickoff(G, t) {
    placeFormation(G, 0, t === 0); placeFormation(G, 1, t === 1);
    const b = G.ball; Object.assign(b, PS.phys.newBall(CX, L / 2));
    const k = teamOf(G, t).filter(p => p.role === 'ST' || FWD(p.role)).sort((a, c) => d2(a, b) - d2(c, b))[0];
    k.x = CX + 0.4; k.y = L / 2 - G.side[t] * 0.6; k.face = G.side[t] > 0 ? 0 : Math.PI;
    for (const q of G.ps) { q.dive = 0; q.react = 0; q.slideV = null; q.caught = false; }
    G.restart = { k: 'kickoff', team: t, x: CX, y: L / 2, taker: k, t0: G.t };
    G.phase = 'restart'; G.pass = null; G.shot = null; G.offside.clear();
    b.owner = k; k.hold = 0;
  }
  /* a stoppage: team t restarts with kind k at (x, y) */
  function stop(G, k, t, x, y, text) {
    const b = G.ball;
    G.pass = null; G.shot = null; G.offside.clear();
    for (const q of G.ps) { q.dive = 0; q.react = 0; q.slideV = null; q.caught = false; if (q.act && q.act.k !== 'fall') q.act = null; }
    b.owner = null; b.vx = b.vy = b.vz = 0; b.spin = 0; b.inNet = false;
    x = clamp(x, 0, W); y = clamp(y, 0, L);
    if (k === 'goalkick') { x = CX + (x > CX ? 1 : -1) * 6; y = fromDepth(G, t, 5.5); }
    if (k === 'corner') { x = x > CX ? W - 0.5 : 0.5; y = goalY(G, t) === L ? L - 0.5 : 0.5; G.stats[t].corners++; }
    if (k === 'pen') { x = CX; y = goalY(G, t) === L ? L - PITCH.SPOT : PITCH.SPOT; }
    if (k === 'throw') x = x < CX ? 0 : W;
    b.x = x; b.y = y; b.z = R;
    /* who takes it: the keeper a goal kick; otherwise the nearest outfielder (in a career, set pieces in range are yours) */
    const mates = teamOf(G, t).filter(p => p.role !== 'GK');
    let taker = k === 'goalkick' ? teamOf(G, t).find(p => p.role === 'GK') : mates.sort((a, c) => hyp(a.x - x, a.y - y) - hyp(c.x - x, c.y - y))[0];
    const me = G.me && !G.me.bench && !G.me.off && G.me.t === t ? G.me : null;
    if (me && (k === 'pen' || (k === 'fk' && depth(G, t, y) > L - 36) || k === 'corner' && G.mode === 'player' && me.role !== 'ST')) taker = me;
    if (G.mode === 'team' && t === 0 && (k === 'pen' || k === 'fk')) { const best = mates.slice().sort((a, c) => c.a.sho - a.a.sho)[0]; if (k === 'pen' || depth(G, t, y) > L - 34) taker = best; }
    G.restart = { k, team: t, x, y, taker, t0: G.t };
    G.phase = 'restart'; G.phaseT = 0;
    if (text) say(G, text, k);
    G.events.push({ k: 'whistle', short: k !== 'goal' });
    if (k === 'corner') G.events.push({ k: 'corner' });
    if (k === 'fk' && depth(G, t, y) > L - 32 && Math.abs(x - CX) < 22) G.events.push({ k: 'fkrange' });
    if (G.mode === 'team' && t === 0) G.ctl = taker;
  }
  /* during a restart: everyone walks to a sensible place; the taker stands over the ball */
  function restartPositions(G, dt) {
    const r = G.restart, b = G.ball;
    for (const p of G.ps) {
      if (p.bench || p.off) continue;
      if (p === r.taker) { const back = r.k === 'throw' ? 0.4 : 0.7, a = Math.atan2(CX - r.x, (r.k === 'corner' || r.k === 'fk' || r.k === 'pen' ? goalY(G, r.team) : fromDepth(G, r.team, depth(G, r.team, r.y) + 10)) - r.y);
        p.tx = r.x - Math.sin(a) * back; p.ty = r.y - Math.cos(a) * back; p.want = 7; continue; }
      let s = shape(G, p);
      if (r.k === 'corner' || (r.k === 'fk' && depth(G, r.team, r.y) > L - 32)) {
        const gy = goalY(G, r.team), inb = s2 => ({ x: CX + s2[0], y: gy - (gy === L ? 1 : -1) * s2[1] });
        if (p.t === r.team && !DEF(p.role) && p.role !== 'GK') { const k = (p.i * 7) % 5; s = inb([[-3, 6], [3, 6], [0, 10], [-6, 9], [6, 11]][k]); }
        else if (p.t !== r.team && p.role !== 'GK') { const k = (p.i * 5) % 6; s = inb([[-2, 4], [2, 4], [0, 7], [-5, 6], [5, 7], [0, 12]][k]); }
        if (r.k === 'fk' && p.t !== r.team && (p.role === 'CB' || p.role === 'DM') && p.i < 5) {
          /* a wall of three on the line from the ball to the near post, 9.15 m out */
          const tx = CX + (r.x > CX ? 1 : -1) * 2, dx = tx - r.x, dy2 = gy - r.y, dl = hyp(dx, dy2) || 1, o = (p.i - 3) * 0.65;
          s = { x: r.x + dx / dl * 9.15 + dy2 / dl * o, y: r.y + dy2 / dl * 9.15 - dx / dl * o }; p.wall = true;
        }
      }
      if (r.k === 'pen' && p.role !== 'GK') { s = { x: CX + (p.i - 5) * 2.2, y: fromDepth(G, r.team, L - 21) }; }
      if (r.k === 'kickoff') { s = { x: p.x, y: p.y }; }
      p.tx = s.x; p.ty = s.y; p.want = 5;
    }
  }
  function takeRestart(G, how) {
    const r = G.restart, p = r.taker, b = G.ball;
    if (!p) return;
    G.phase = 'play'; G.restart = null; G.penNext = r.k === 'pen';
    if (r.k === 'kickoff' && G.t > 1) G.events.push({ k: 'kickoffWhistle' });
    for (const q of G.ps) q.wall = false;
    b.x = r.x; b.y = r.y; b.z = R;
    b.owner = p; p.hold = 0; G.lastTouch = p;
    G.events.push({ k: 'whistle', short: true });
    if (how) return how(p);
    aiOnBall(G, p, true);
  }

  /* ------------------------------------------------------------------ kicking */
  function kickNow(G, p, vx, vy, vz, spin, kind, to) {
    const b = G.ball;
    b.owner = null; b.vx = vx; b.vy = vy; b.vz = vz; b.spin = spin || 0; b.top = kind === 'shot' ? 5 : 0;
    b.x = p.x + Math.sin(p.face) * 0.45; b.y = p.y + Math.cos(p.face) * 0.45; b.z = Math.max(R, b.z);
    b.last = p; G.lastTouch = p; p.cd = 0.3; p.hold = 0; p.caught = false;
    G.events.push({ k: 'kick', p: hyp(vx, vy, vz) });
    G.pass = null; G.shot = null;
    if (kind === 'pass' || kind === 'cross' || kind === 'through') {
      G.pass = { from: p, to, t: G.t, kind };
      G.stats[p.t].passes++; p.st.ps++;
      G.offside.clear();
      const line = offLine(G, p.t);
      for (const q of teamOf(G, p.t)) if (q !== p && depth(G, p.t, q.y) > line + 0.3 && depth(G, p.t, q.y) > depth(G, p.t, b.y)) G.offside.add(q);
    }
    if (kind === 'shot') {
      G.shot = { by: p, t: G.t, pen: !!G.penNext }; G.penNext = false;
      G.stats[p.t].shots++; p.st.sh++;
      const x = xg(G, p); G.stats[p.t].xg += x;
      if (G.lastPassTo === p && G.lastPassFrom && G.lastPassFrom.t === p.t) G.lastPassFrom.st.kp++;
    }
    if (kind === 'clear') G.pass = null;
  }
  /* the kick waits for the foot: a short wind-up, then the ball goes */
  function kick(G, p, fn, opts = {}) {
    if (p.act && p.act.k === 'kick') return;
    const T = opts.T || 0.32;
    p.act = { k: 'kick', t: 0, T, foot: opts.foot || (Math.random() < 0.8 ? 'R' : 'L'), p: opts.power ?? 0.6, lob: !!opts.lob, fire: fn, at: T * 0.42 };
  }
  function xg(G, p) {
    const gy = goalY(G, p.t), d = hyp(p.x - CX, gy - p.y), ang = Math.atan2(Math.abs(p.x - CX), Math.abs(gy - p.y));
    const press = teamOf(G, opp(p.t)).some(o => o.role !== 'GK' && d2(o, p) < 1.8) ? 0.6 : 1;
    return clamp(0.9 * Math.exp(-d / 9) * Math.cos(ang) * press, 0.01, 0.85);
  }
  /* aim through curl at any goal: the launch angle that makes the ball cross y = ty at x = tx */
  function solveAim(from, tx, ty, v, vz, spin, top) {
    const s = Math.sign(ty - from.y) || 1;
    const cross = ang => {
      const b = Object.assign(PS.phys.newBall(from.x, from.y), { z: Math.max(R, from.z || R), vx: Math.sin(ang) * v, vy: Math.cos(ang) * v, vz, spin, top });
      const path = PS.phys.predict(b, c => (c.y - ty) * s >= 0 || (c.y - from.y) * s < -5);
      const e = path[path.length - 1]; return e ? e.x : from.x;
    };
    let a0 = Math.atan2(tx - from.x, ty - from.y), a1 = a0 + 0.04, e0 = cross(a0) - tx, e1 = cross(a1) - tx;
    for (let i = 0; i < 4 && Math.abs(e1) > 0.06; i++) { const a2 = a1 - e1 * (a1 - a0) / ((e1 - e0) || 1e-6); a0 = a1; e0 = e1; a1 = a2; e1 = cross(a1) - tx; }
    return isFinite(a1) ? a1 : Math.atan2(tx - from.x, ty - from.y);
  }
  /* ------------------------------------------------------------------ shooting
     Shot types (the Shoot button: hold for power; swipe while holding to choose, see controls.js):
       drive    the standard strike: power sets the pace and the height (low early, rising late)
       low      low driven: let go early, kept down, quick to get off
       finesse  inside of the foot, curled in toward the far corner: placement over pace
       chip     lifted over a keeper who has come off his line
       power    everything into it: the longest wind-up, the most pace, the most risk
       volley   struck first time out of the air
     Timing: the power bar has a sweet spot that moves with the distance (low near goal, higher from range). Let go
     inside it and the strike is clean ('perfect', about a third of the error); just outside, 'good'; well short,
     'early' (it stays down and soft); well past, 'over' (it climbs, and can fly over the bar).
     Error: a cone round the aim, wider for a poor finisher, widened by pace, a defender close, shooting across the
     body, the weaker foot, a ball in the air and a sprint. The keeper is the last word (saves(), keeper()). */
  const SHOT = { drive: { T: 0.3, v: [14, 18], err: 1 }, low: { T: 0.22, v: [18, 10], err: 0.85 }, finesse: { T: 0.32, v: [17, 10], err: 0.7 },
    chip: { T: 0.3, v: [0, 0], err: 0.85 }, power: { T: 0.44, v: [21, 12], err: 1.35 }, volley: { T: 0.18, v: [15, 15], err: 1.45 } };
  const angD = (a, c) => { let d = a - c; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function sweet(G, p) {
    const gy = goalY(G, p.t), d = hyp(CX - G.ball.x, gy - G.ball.y);
    return { c: clamp(0.3 + d * 0.014, 0.36, 0.78), w: 0.05 + p.a.sho * 0.0006, d };
  }
  function timingOf(pw, ss) { const e = Math.abs(pw - ss.c); return e <= ss.w ? 'perfect' : e <= ss.w * 2.3 ? 'good' : pw < ss.c ? 'early' : 'over'; }
  /* is this strike on his weaker foot? Shooting hard toward his stronger side means opening up on the other foot */
  function weakFoot(p, shotA) {
    const strong = p.foot || (p.num % 5 === 0 ? 'Left' : 'Right'), rel = angD(shotA, p.face);
    return strong === 'Right' ? rel < -0.45 : rel > 0.45;
  }
  /* everything about a shot before it is struck: where it is aimed, its pace, curl, and how wide the error cone is.
     o: { type, pw (0..1), across (-1..1 across the goal, null = the far post), timing } */
  function shotPlan(G, p, o) {
    const b = G.ball, a = p.a, gy = goalY(G, p.t), dist = hyp(CX - b.x, gy - b.y), pw = clamp(o.pw, 0.05, 1);
    let type = o.type || 'drive';
    if (type === 'drive' && b.z > 0.5) type = 'volley';
    if (type === 'drive' && pw < 0.32) type = 'low';
    if (type === 'drive' && pw > 0.9) type = 'power';
    const S = SHOT[type], farS = b.x > CX ? -1 : 1;
    /* finesse can be aimed tighter to the post: the curl brings it back in */
    const tx = o.across != null ? CX + clamp(o.across, -1, 1) * (POST - (type === 'finesse' ? 0.22 : 0.35)) : CX + farS * (POST - (type === 'finesse' ? 0.3 : 0.7));
    let tz = type === 'low' ? 0.2 : type === 'chip' ? 1.75 : type === 'finesse' ? 0.8 + 0.9 * pw : type === 'power' ? 0.5 + 1.2 * pw * pw : type === 'volley' ? 0.4 + 1.3 * pw : 0.25 + 1.95 * pw * pw;
    tz = clamp(tz, 0.15, 2.2);
    const v = S.v[0] + S.v[1] * pw + a.sho * 0.045 + (o.timing === 'perfect' ? 1.2 : 0);
    const dirY = Math.sign(gy - b.y) || 1, sideS = Math.sign(tx - b.x) || farS;
    const spin = type === 'finesse' ? -dirY * sideS * (16 + a.sho * 0.14) * clamp(18 / dist, 0.45, 1) : type === 'chip' ? 0 : -dirY * sideS * rnd(0, 5);
    /* the cone */
    const opps = teamOf(G, opp(p.t)), press = opps.reduce((m, q) => q.role === 'GK' ? m : Math.min(m, d2(q, p)), 99);
    const pressK = press < 1.2 ? 1.55 : press < 2.2 ? 1.28 : 1;
    const shotA = Math.atan2(tx - b.x, gy - b.y), body = Math.abs(angD(shotA, p.face));
    const bodyK = 1 + Math.max(0, body - 0.6) * 0.55, weak = weakFoot(p, shotA), footK = weak ? 1.25 + (p.me ? 0 : 0) : 1;
    const airK = b.z > 0.45 ? 1.35 : 1, runK = hyp(p.vx, p.vy) > 6.4 ? 1.15 : 1;
    const tK = { perfect: 0.36, good: 0.75, early: 1, over: 1.2 }[o.timing || 'good'];
    const base = 0.075 - a.sho * 0.0005;   // radians: shooting 50 about 3.4°, 75 about 2.1°, 90 about 1.7° before the factors
    const sdH = base * S.err * (0.75 + 0.5 * pw) * pressK * bodyK * footK * airK * runK * tK * (p.ctl ? 1 : 1.12);
    const sdV = (0.3 + 0.9 * pw) * S.err * pressK * airK * tK * (type === 'low' ? 0.45 : 1);
    const over = o.timing === 'over' ? 1.1 + Math.max(0, pw - 0.8) * 5 : 0;
    return { type, pw, tx, tz, gy, v, spin, top: type === 'low' ? 4 : type === 'power' ? 2 : type === 'chip' ? 3 : 0, sdH, sdV, over, dist, timing: o.timing || 'good', weak, press, foot: weak ? (p.foot === 'Left' ? 'R' : 'L') : (p.foot === 'Left' ? 'L' : 'R') };
  }
  /* the launch that puts the ball through (tx, tz) on the goal line: yaw by secant on x, then the lift (or, for a
     chip, the pace) by secant on the height at the line */
  function crossing(b, ang, v, vz, spin, top, gy) {
    const s = Math.sign(gy - b.y) || 1;
    const c = Object.assign(PS.phys.newBall(b.x, b.y), { z: Math.max(R, b.z), vx: Math.sin(ang) * v, vy: Math.cos(ang) * v, vz, spin, top });
    const path = PS.phys.predict(c, q => (q.y - gy) * s >= 0 || (q.y - b.y) * s < -5, 1 / 90);
    const e = path[path.length - 1], f = path[path.length - 2] || { x: b.x, y: b.y, z: b.z };
    if (!e) return { x: b.x, z: 0 };
    const k = (e.y - f.y) ? clamp((gy - f.y) / (e.y - f.y), 0, 1) : 1;
    return { x: f.x + (e.x - f.x) * k, z: f.z + (e.z - f.z) * k, t: e.t };
  }
  function solveShot(b, P) {
    const chip = P.type === 'chip';
    let v = chip ? 7 + P.dist * 0.3 : P.v, vz = chip ? 6.2 + P.dist * 0.11 : 0.6 + P.tz * 0.9 + P.dist * 0.035, ang = Math.atan2(P.tx - b.x, P.gy - b.y);
    for (let it = 0; it < 3; it++) {
      let a0 = ang, a1 = ang + 0.03, e0 = crossing(b, a0, v, vz, P.spin, P.top, P.gy).x - P.tx, e1 = crossing(b, a1, v, vz, P.spin, P.top, P.gy).x - P.tx;
      for (let k = 0; k < 3 && Math.abs(e1) > 0.05; k++) { const a2 = a1 - e1 * (a1 - a0) / ((e1 - e0) || 1e-6); a0 = a1; e0 = e1; a1 = a2; e1 = crossing(b, a1, v, vz, P.spin, P.top, P.gy).x - P.tx; }
      if (isFinite(a1)) ang = a1;
      if (chip) {
        /* a lob: the pace that brings it down through tz on the way down, found by bisection near the drag-free
           answer (faster is higher at the line on the falling half, so the search stays on that half) */
        const T0 = (vz + Math.sqrt(Math.max(0, vz * vz - 2 * 9.81 * P.tz))) / 9.81, v0 = P.dist / T0 * 1.1;
        let lo = v0 * 0.7, hi = v0 * 1.35;
        for (let k = 0; k < 9; k++) { const m = (lo + hi) / 2, z = crossing(b, ang, m, vz, P.spin, P.top, P.gy).z; if (z > P.tz) hi = m; else lo = m; }
        v = (lo + hi) / 2;
        continue;
      }
      /* the height: the lift that brings it through tz */
      const q = x => crossing(b, ang, v, x, P.spin, P.top, P.gy).z - P.tz;
      let x0 = vz, x1 = x0 + 0.4, z0 = q(x0), z1 = q(x1);
      for (let k = 0; k < 3 && Math.abs(z1) > 0.06; k++) { const x2 = x1 - z1 * (x1 - x0) / ((z1 - z0) || 1e-6); x0 = x1; z0 = z1; x1 = x2; z1 = q(x1); }
      if (isFinite(x1)) vz = clamp(x1, -2, 12);
    }
    return { ang, v, vz };
  }
  /* strike it: o as for shotPlan */
  function shoot(G, p, o) {
    const P0 = shotPlan(G, p, o);
    p.face = Math.atan2(P0.tx - p.x, P0.gy - p.y);
    kick(G, p, () => {
      const b = G.ball, P = shotPlan(G, p, o);   // again at contact: the ball and the pressure have moved
      const sol = solveShot(b, P);
      const ang = sol.ang + gauss() * P.sdH, v = (P.type === 'chip' ? sol.v : sol.v) * (1 + gauss() * 0.03);
      const vz = sol.vz + gauss() * P.sdV * (P.type === 'chip' ? 1.5 : 1) + P.over;
      const screen = G.ps.some(q => q !== p && q.role !== 'GK' && !q.bench && !q.off && segDist(q, b, { x: P.tx, y: P.gy }) < 0.8 && segT(q, b, { x: P.tx, y: P.gy }) > 0.35 && segT(q, b, { x: P.tx, y: P.gy }) < 0.93);
      kickNow(G, p, Math.sin(ang) * v, Math.cos(ang) * v, vz, P.spin, 'shot');
      if (G.shot) Object.assign(G.shot, { type: P.type, timing: P.timing, dist: P.dist, kmh: Math.round(hyp(Math.sin(ang) * v, Math.cos(ang) * v, vz) * 3.6), screen, chip: P.type === 'chip', from: { x: b.x, y: b.y } });
      G.events.push({ k: 'strike', v: hyp(v, vz), timing: P.timing, type: P.type, ctl: !!p.ctl });
    }, { power: P0.pw, T: SHOT[P0.type].T, foot: P0.foot, lob: P0.type === 'chip' });
  }
  /* the shot the user would get if he let go now: for the aim marker and the power bar */
  function aimPreview(G) {
    const p = G.ctl, i = G.input, c = i.charge; if (!p || !c) return null;
    const b = G.ball; if (!(b.owner === p || (!b.owner && d2(b, p) < 2.6))) return null;
    const pw = clamp((performance.now() - c.t0) / 900, 0.05, 1), ss = sweet(G, p);
    const st = stickWorld(G), across = st.m > 0.3 ? acrossOf(G, p, st) : null;
    const P = shotPlan(G, p, { type: c.type === 'fake' ? 'drive' : c.type, pw, across, timing: timingOf(pw, ss) });
    return { gy: P.gy, tx: P.tx, tz: P.tz, r: clamp(P.dist * Math.tan(P.sdH * 1.6), 0.2, 3), ss, pw, type: P.type, timing: P.timing, fake: c.type === 'fake' };
  }
  /* the stick's part across the goal mouth, -1..1, as the camera sees it */
  function acrossOf(G, p, st) { const gy = goalY(G, p.t), s = Math.sign(gy - p.y) || 1; return clamp((st.x / (st.m || 1)) * 1.25, -1, 1) * (s > 0 ? 1 : 1); }
  /* a fake shot: the wind-up and no strike; defenders close by may buy it */
  function fakeShot(G, p) {
    p.act = { k: 'kick', t: 0, T: 0.3, foot: 'R', p: 0.5, fake: true };
    for (const q of teamOf(G, opp(p.t))) if (q.role !== 'GK' && d2(q, p) < 3.2 && Math.random() < 0.65 - q.a.def * 0.004) { q.stun = 0.5; q.act = { k: 'slide', t: 0, T: 0.6 }; q.slideV = { x: Math.sin(q.face) * 2, y: Math.cos(q.face) * 2 }; q.slideHit = true; }
    G.events.push({ k: 'fake' });
  }
  /* a pass to a teammate (led if he is running) or into space toward pt */
  function pass(G, p, to, pt, opts = {}) {
    const b = G.ball, a = p.a;
    let tx, ty;
    if (to) { const dd = d2(b, to), tt = dd / 15; tx = to.x + to.vx * tt * 0.85; ty = to.y + to.vy * tt * 0.85; }
    else { tx = pt.x; ty = pt.y; }
    tx = clamp(tx, 1, W - 1); ty = clamp(ty, 1, L - 1);
    p.face = Math.atan2(tx - p.x, ty - p.y);
    const lofted = opts.lob, through = opts.through;
    kick(G, p, () => {
      const d = hyp(tx - b.x, ty - b.y), sd = 0.012 + 0.045 * (1 - a.pas / 100) * (lofted ? 1.3 : 1) * (p.ctl ? 0.8 : 1);
      let ang = Math.atan2(tx - b.x, ty - b.y) + gauss() * sd;
      if (lofted) {
        const t = 0.8 + d / 26, vh = d / t * 1.1, vz = 0.5 * 9.81 * t * 0.9;
        kickNow(G, p, Math.sin(ang) * vh, Math.cos(ang) * vh, vz, 0, opts.cross ? 'cross' : 'pass', to);
      } else {
        const arrive = through ? 8.5 : 6;
        const v = Math.sqrt(arrive * arrive + 2 * 2.4 * d) * (1 + gauss() * 0.06 * (1 - a.pas / 100));
        kickNow(G, p, Math.sin(ang) * v, Math.cos(ang) * v, 0, 0, through ? 'through' : 'pass', to);
      }
      to = to || opts.to;
      if (to) { G.lastPassFrom = p; G.lastPassTo = to; G.lastPassT = G.t; if (G.pass) G.pass.to = to; }
      if (G.mode === 'team' && p.t === 0 && to && !G.ff) G.ctl = to;
    }, { power: 0.5, lob: lofted, T: lofted ? 0.36 : 0.28 });
  }

  /* ------------------------------------------------------------------ AI on the ball */
  function aiOnBall(G, p, restart) {
    const b = G.ball, t = p.t, gy = goalY(G, t), opps = teamOf(G, opp(t)), mates = teamOf(G, t).filter(q => q !== p);
    const near = opps.reduce((m, o) => Math.min(m, d2(o, p)), 99);
    const dG = hyp(CX - p.x, gy - p.y), dep = depth(G, t, p.y);
    const r = restart ? G.restart && G.restart.k : null;
    /* shoot? */
    if (!restart || r === 'fk' || r === 'pen') {
      const ang = Math.atan2(Math.abs(p.x - CX), Math.abs(gy - p.y));
      const lane = opps.filter(o => o.role !== 'GK' && segDist(o, p, { x: CX, y: gy }) < 1.1 && segT(o, p, { x: CX, y: gy }) > 0.05).length;
      const want = r === 'pen' || (r === 'fk' && dG < 30 && ang < 0.9) || (dG < 24 && ang < 1.0 && (dG < 13 || lane === 0) && (xg(G, p) > 0.06 || (near < 2 && dG < 20)));
      if (want && Math.random() < (r ? 1 : 0.85)) {
        shoot(G, p, aiShot(G, p, r, dG, ang));
        return true;
      }
    }
    /* the best pass */
    let best = null, bs = -1e9;
    for (const q of mates) {
      if (q.role === 'GK' && dep > 30) continue;
      const dd = d2(p, q); if (dd < 4 || dd > 48) continue;
      const prog = depth(G, t, q.y) - dep;
      const open = Math.min(9, opps.reduce((m, o) => Math.min(m, d2(o, q)), 99));
      let risk = 0; for (const o of opps) { const sd = segDist(o, p, q), st = segT(o, p, q); if (st > 0.1 && st < 0.96) risk = Math.max(risk, clamp((2.6 - sd) / 2.6, 0, 1) * (1 - st * 0.4)); }
      const lob = risk > 0.4 && dd > 14;
      let s = prog * 0.12 + open * 0.35 - (lob ? risk * 1.2 : risk * 4.5) - dd * 0.03 - (G.offside.has(q) ? 9 : 0) + (q.me && G.call && G.call.t > G.t ? 6 : 0) + (q.me ? 0.6 : 0);
      if (depth(G, t, q.y) > offLine(G, t) + 0.2) s -= 8;
      if (s > bs) { bs = s; best = { q, lob, s }; }
    }
    /* a through ball for a forward on the move */
    let thru = null;
    for (const q of mates) {
      if (!FWD(q.role) && !q.me) continue;
      const qd = depth(G, t, q.y), line = offLine(G, t);
      if (qd < line - 7 || qd > line + 0.2) continue;
      const tx = clamp(q.x + q.vx * 0.6, 6, W - 6), tyD = Math.min(L - 9, line + rnd(5, 9));
      const pt = { x: tx, y: fromDepth(G, t, tyD) };
      let risk = 0; for (const o of opps) { if (o.role === 'GK') continue; const sd = segDist(o, p, pt); risk = Math.max(risk, clamp((2.4 - sd) / 2.4, 0, 1)); }
      const keeper = opps.find(o => o.role === 'GK'), kd = keeper ? d2(keeper, pt) : 20;
      const s = 3 + (tyD - dep) * 0.09 - risk * 4 - (kd < 8 ? 3 : 0) + (q.me && G.call && G.call.run && G.call.t > G.t ? 7 : 0);
      if (s > (thru ? thru.s : 1.2)) thru = { q, pt, s };
    }
    /* a cross from wide in the final third */
    const wide = Math.abs(p.x - CX) > 18 && dep > L - 30;
    if (wide && (!restart || r === 'corner')) {
      const box = mates.filter(q => depth(G, t, q.y) > L - 18 && Math.abs(q.x - CX) < 12);
      if (box.length && (near < 4 || dep > L - 18 || r === 'corner' || Math.random() < 0.5)) {
        const q = box[Math.floor(Math.random() * box.length)];
        pass(G, p, null, { x: q.x + rnd(-1.5, 1.5), y: q.y + G.side[t] * rnd(-1, 1.5) }, { lob: true, cross: true, to: q });
        return true;
      }
    }
    if (thru && (!best || thru.s > best.s) && !restart) { pass(G, p, null, thru.pt, { through: true, to: thru.q }); thru.q.run = G.t + 2.5; return true; }
    const space = near > 5.5 && !restart;
    /* dribble on when there is room, or hold it a moment; pass when pressed or the pass is good */
    const goodPass = best && (best.s > 2.2 || (best.s > 0.3 && near < 2.6) || restart || p.role === 'GK');
    if (goodPass && (!space || best.s > 3.2 || p.hold > 2.5 || p.role === 'GK')) {
      pass(G, p, best.q, null, { lob: best.lob || (p.role === 'GK' && d2(p, best.q) > 25) });
      return true;
    }
    if (restart && best) { pass(G, p, best.q, null, { lob: best.lob }); return true; }
    if (restart) { pass(G, p, null, { x: CX, y: fromDepth(G, t, dep + 25) }, { lob: true }); return true; }
    if (near < 2 && Math.random() < 0.4 && dep < L * 0.35) {   // under pressure deep: clear it, toward the touchline
      kick(G, p, () => { const side = p.x > CX ? 1 : -1, a = Math.atan2(side * rnd(8, 30) + rnd(-6, 6), (gy - p.y)); kickNow(G, p, Math.sin(a) * 22, Math.cos(a) * 22, 9, 0, 'clear'); }, { lob: true, power: 0.9 });
      return true;
    }
    return false;
  }
  /* how the computer shoots: the type for the situation, a corner, a power near the sweet spot */
  function aiShot(G, p, r, dG, ang) {
    const keep = teamOf(G, opp(p.t)).find(q => q.role === 'GK'), off = keep ? Math.abs(keep.y - goalY(G, p.t)) : 0;
    const far = p.x > CX ? -1 : 1;
    let type = 'drive', across = far * rnd(0.55, 0.95);
    if (r === 'pen') { across = (Math.random() < 0.5 ? -1 : 1) * rnd(0.45, 0.9); }
    else if (r === 'fk') type = 'finesse';
    else if (off > 5 && dG > 11 && dG < 26 && Math.random() < 0.45) { type = 'chip'; across = rnd(-0.3, 0.3); }
    else if (dG < 10) type = 'low';
    else if (ang > 0.3 && dG < 23 && Math.random() < 0.5) type = 'finesse';
    else if (dG > 22 && Math.random() < 0.35) type = 'power';
    const ss = sweet(G, p);
    let pw = type === 'low' ? rnd(0.15, 0.3) : type === 'power' ? rnd(0.92, 1) : type === 'chip' ? 0.5 : clamp(ss.c + gauss() * 0.12, 0.33, 0.88);
    const roll = Math.random(), timing = type === 'power' ? (roll < 0.5 ? 'good' : 'over') : roll < 0.12 + p.a.sho / 240 ? 'perfect' : roll < 0.78 ? 'good' : roll < 0.9 ? 'early' : 'over';
    if (timing === 'perfect') pw = ss.c;
    return { type, pw, across, timing };
  }
  /* where an AI carrier runs with the ball: at goal, bending away from whoever is in front */
  function dribbleTarget(G, p) {
    const t = p.t, gy = goalY(G, t), opps = teamOf(G, opp(t));
    let dx = (CX - p.x) * (depth(G, t, p.y) > L - 35 ? 0.06 : 0.01), dy = Math.sign(gy - p.y) || 1;
    for (const o of opps) {
      const ox = o.x - p.x, oy = o.y - p.y, od = hyp(ox, oy);
      if (od < 7 && (oy * dy) > -1) { dx -= ox / od * (7 - od) * 0.22; }
    }
    const l = hyp(dx, dy) || 1;
    return { x: p.x + dx / l * 6, y: p.y + dy / l * 6 };
  }

  /* ------------------------------------------------------------------ AI off the ball */
  function aiThink(G, p, dt) {
    const b = G.ball, own = b.owner, t = p.t, me = p === G.ctl && G.userOn;
    if (p.role === 'GK') return keeper(G, p, dt);
    /* the ball carrier */
    if (own === p) {
      p.hold += dt;
      if (me) return;
      if (p.next <= 0) { p.next = 0.18 + Math.random() * 0.14; if (p.hold > 0.22 && !p.act && aiOnBall(G, p)) return; }
      const tg = dribbleTarget(G, p); p.tx = tg.x; p.ty = tg.y; p.want = maxSpd(p) * 0.86;
      return;
    }
    if (me && !G.assist) return;
    const has = possTeam(G);
    /* a pass on its way to him: go and meet it */
    if (G.pass && G.pass.to === p && !own) {
      const e = meetPoint(G, p); p.tx = e.x; p.ty = e.y; p.want = maxSpd(p); return;
    }
    /* a loose ball: the quickest of each team goes for it */
    if (!own && (!G.pass || G.pass.from.t !== t || !G.pass.to)) {
      const mates = teamOf(G, t).filter(q => q.role !== 'GK');
      let best = null, bt = 1e9; for (const q of mates) { const tt = d2(q, b) / maxSpd(q); if (tt < bt) { bt = tt; best = q; } }
      if (best === p) { const e = meetPoint(G, p); p.tx = e.x; p.ty = e.y; p.want = maxSpd(p); return; }
    }
    if (!own && G.pass && G.pass.from.t !== t) {
      /* intercept a pass that comes near */
      const e = meetPoint(G, p);
      if (d2(p, e) < 6) { p.tx = e.x; p.ty = e.y; p.want = maxSpd(p); return; }
    }
    if (has === t) {
      /* attacking: shape, with runs; a forward with a run on goes in behind */
      const s = shape(G, p);
      p.tx = s.x; p.ty = s.y; p.want = maxSpd(p) * 0.7;
      if (p.run && p.run > G.t) { const line = offLine(G, t); p.ty = fromDepth(G, t, Math.min(L - 8, line + 8)); p.want = maxSpd(p); }
      else if (FWD(p.role) && own && Math.random() < dt * 0.25 && depth(G, t, own.y) > L * 0.35) p.run = G.t + rnd(1.5, 2.5);
      /* find space: step away from the nearest marker */
      const mk = teamOf(G, opp(t)).reduce((m, o) => (!m || d2(o, p) < d2(m, p)) ? o : m, null);
      if (mk && d2(mk, p) < 3.5) { const dx = p.x - mk.x, dy = p.y - mk.y, l = hyp(dx, dy) || 1; p.tx += dx / l * 3; p.ty += dy / l * 2; }
      /* support: one man shows for the ball near the carrier */
      if (own && own.t === t && d2(p, own) < 14 && !FWD(p.role)) { const ang = Math.atan2(p.x - own.x, p.y - own.y); p.tx = lerp(p.tx, own.x + Math.sin(ang) * 9, 0.5); p.ty = lerp(p.ty, own.y + Math.cos(ang) * 9, 0.5); }
      return;
    }
    /* defending: the nearest presses the ball, the next covers, the rest hold the shape and mark */
    const target = own || b;
    const def = teamOf(G, t).filter(q => q.role !== 'GK').sort((a, c) => d2(a, target) - d2(c, target));
    const gy = ownY(G, t);
    if (def[0] === p) {
      const gx = CX - target.x, g2 = gy - target.y, gl = hyp(gx, g2) || 1, close = own ? 1.1 : 0;
      p.tx = target.x + gx / gl * close; p.ty = target.y + g2 / gl * close; p.want = maxSpd(p) * (own ? 0.95 : 1);
      if (own && own.t !== t && d2(p, own) < 1.4 && p.cd <= 0 && G.phase === 'play' && Math.random() < dt * (depth(G, t, own.y) < 35 ? 1.9 : 1.2)) tackle(G, p, own);
      return;
    }
    if (def[1] === p && own && depth(G, t, own.y) < 45) {
      const gx = CX - own.x, g2 = gy - own.y, gl = hyp(gx, g2) || 1, k = Math.min(5, gl * 0.3);
      p.tx = own.x + gx / gl * k; p.ty = own.y + g2 / gl * k; p.want = maxSpd(p) * 0.9;
      if (d2(p, own) < 1.4 && p.cd <= 0 && Math.random() < dt * 1.2) tackle(G, p, own);
      return;
    }
    const s = shape(G, p);
    /* mark the most dangerous man near my slot, goal-side and a beat late */
    let mk = null, md = 13;
    for (const o of teamOf(G, opp(t))) { if (o.role === 'GK' || o === own) continue; const dd = hyp(o.x - s.x, o.y - s.y); if (dd < md) { md = dd; mk = o; } }
    if (mk) {
      if (!p.seen || p.seenOf !== mk) { p.seen = { x: mk.x, y: mk.y }; p.seenOf = mk; }
      const rk = 1 - Math.exp(-dt * (2 + p.a.def * 0.035)); p.seen.x += (mk.x - p.seen.x) * rk; p.seen.y += (mk.y - p.seen.y) * rk;
      const gx = CX - p.seen.x, g2 = gy - p.seen.y, gl = hyp(gx, g2) || 1;
      const mx = p.seen.x + gx / gl * 1.6, my = p.seen.y + g2 / gl * 1.6, w = DEF(p.role) ? 0.65 : 0.45;
      p.tx = lerp(s.x, mx, w); p.ty = lerp(s.y, my, w);
    } else { p.tx = s.x; p.ty = s.y; }
    p.want = maxSpd(p) * 0.82;
  }
  /* where p can get to the ball: the first point on its path he reaches in time */
  function meetPoint(G, p) {
    const b = G.ball;
    if (b.owner) return { x: b.owner.x, y: b.owner.y };
    const path = PS.phys.predict(b, (c, t) => t > 2.2 || (c.z < 1.4 && hyp(c.x - p.x, c.y - p.y) / maxSpd(p) < t + 0.05), 1 / 30);
    const e = path[path.length - 1];
    return e ? { x: clamp(e.x, -1, W + 1), y: clamp(e.y, -1, L + 1) } : { x: b.x, y: b.y };
  }
  const maxSpd = p => (5.3 + p.a.pac * 0.036) * (p.stamina === undefined ? 1 : 0.85 + 0.15 * p.stamina);

  /* ------------------------------------------------------------------ keepers */
  function keeper(G, g, dt) {
    const b = G.ball, t = g.t, gy = ownY(G, t), s = G.side[t];   // s: +1 his goal at y = 0, the ball comes toward -y
    const toward = -s;   // the direction a shot at him travels in y
    if (b.owner === g) {
      g.hold += dt; g.tx = g.x; g.ty = g.y;
      if (g.hold > 1.4 && !g.act) {
        const mates = teamOf(G, t).filter(q => q !== g), opps = teamOf(G, opp(t));
        const open = mates.filter(q => opps.every(o => d2(o, q) > 6)).sort((a, c) => depth(G, t, c.y) - depth(G, t, a.y));
        const q = open.find(q => d2(q, g) < 40) || mates.sort((a, c) => d2(a, g) - d2(c, g))[2];
        if (d2(q, g) < 28) pass(G, g, q, null, {}); else pass(G, g, q, null, { lob: true });
      }
      return;
    }
    const sh = G.shot;
    if (sh && sh.by.t !== t && !b.owner && b.vy * toward > 2) {
      /* set for a shot from close (he reads the body), slower to a strike from range; later through a crowd */
      if (!g.react) g.react = G.t + 0.05 + Math.min(30, sh.dist || 15) * 0.0065 + (90 - g.a.gk) * 0.003 + rnd(0, 0.06) - (sh.pen ? 0.1 : 0) + (sh.screen ? 0.15 : 0) + (sh.timing === 'perfect' ? 0.04 : 0);
      if (sh.chip && Math.abs(g.y - gy) < 4.5 && !g.dive) {
        /* a chip over a keeper who is near his line: back-pedal to it, under the ball */
        const path = PS.phys.predict(b, c => (c.y - gy) * toward >= -0.3);
        const e = path[path.length - 1];
        if (e) { g.tx = clamp(e.x, CX - POST, CX + POST); g.ty = gy - toward * 0.4; g.want = 5.5 + g.a.gk * 0.01; }
        return;
      }
      if (G.t >= g.react && !g.dive) {
        /* he reads the bend only in part: a curling shot ends up nearer the post than he dives for */
        const path = PS.phys.predict(Object.assign({}, b, { spin: b.spin * (0.1 + g.a.gk * 0.004) }), c => (c.y - g.y) * toward >= 0);
        const e = path[path.length - 1];
        if (e && (e.y - g.y) * toward >= -0.4) {
          let x = e.x;
          if (sh.pen) { const read = Math.random() < 0.12 + g.a.gk * 0.002, r = Math.random(); x = read ? CX + clamp(e.x - CX, -2.3, 2.3) : r < 0.14 ? CX : CX + (r < 0.57 ? -2.3 : 2.3); }
          g.diveX = x; g.dive = G.t; g.diveH = clamp(e.z, 0.2, 2.3);
          const side = Math.sign(x - g.x) * (s > 0 ? 1 : -1);
          if (Math.abs(x - g.x) > 0.7) g.act = { k: 'dive', t: 0, T: 1.1, side: side || 1, h: clamp(e.z * 0.4, 0.1, 0.8) };
          else g.act = { k: 'catch', t: 0, T: 0.6 };
        }
      }
    } else if (!sh) { g.react = 0; if (g.dive && G.t - g.dive > 1.2) g.dive = 0; }
    if (g.dive) {
      const sp = 1.75 + g.a.gk * 0.01, dx = g.diveX - g.x;
      g.vx = clamp(dx * 9, -sp, sp); g.vy = 0; g.tx = g.x + g.vx * 0.1; g.ty = g.y; g.want = sp; return;
    }
    /* on the line between the ball and the middle of the goal, off it to narrow the angle */
    const dd = hyp(CX - b.x, gy - b.y) || 1, off = G.restart && G.restart.k === 'pen' ? 0.3 : clamp(0.8 + dd * 0.1, 0.8, 3.0);   // a few metres off his line, never so far a dipping shot goes over him
    g.tx = CX + (b.x - CX) / dd * off; g.ty = gy + (b.y - gy) / dd * off; g.want = 6;
    const own = b.owner, inBox = Math.abs(b.y - gy) < PITCH.BOXD && Math.abs(b.x - CX) < PITCH.BOXW / 2;
    if (own && own.t !== t && inBox && dd < 11 && G.phase === 'play') { g.tx = b.x; g.ty = b.y; g.want = 7; if (d2(g, own) < 1.3 && g.cd <= 0) { g.cd = 0.7; if (Math.random() < 0.28 + g.a.gk * 0.003) win(G, g, own, true); } }
    if (!own && inBox && hyp(b.vx, b.vy) < 10 && (b.z < 2.6) && G.phase === 'play') {
      const near = G.ps.filter(q => !q.bench && !q.off).sort((a, c) => d2(a, b) - d2(c, b))[0];
      if (near === g || d2(g, b) < 5) { g.tx = b.x; g.ty = b.y; g.want = 7; }
    }
  }

  /* ------------------------------------------------------------------ tackles and fouls */
  function tackle(G, p, c, lunge) {
    if (p.cd > 0 || !c) return;
    p.cd = 0.9; p.act = { k: 'kick', t: 0, T: 0.3, foot: 'R', p: 0.3 };
    const behind = ((c.x - p.x) * Math.sin(c.face) + (c.y - p.y) * Math.cos(c.face)) > 0.3;   // coming from behind him
    const pr = clamp(0.42 * Math.pow((p.a.def + 10) / (c.a.dri + 10), 1.6) * (lunge ? 1.25 : 1) * (c.sprint ? 0.85 : 1) * (behind ? 0.6 : 1), 0.08, 0.88);
    if (d2(p, c) < 1.7 && Math.random() < pr) { win(G, p, c); p.st.tk++; return; }
    if (Math.random() < (behind ? 0.3 : 0.08)) foul(G, p, c);
  }
  function slide(G, p, dx, dy) {
    if (p.cd > 0) return;
    p.cd = 1.3; p.act = { k: 'slide', t: 0, T: 0.9 }; p.face = Math.atan2(dx, dy);
    p.vx = dx * 8.5; p.vy = dy * 8.5; p.slideV = { x: dx * 8.5, y: dy * 8.5 };
    p.slideHit = false;
  }
  function win(G, p, c, keeper) {
    const b = G.ball;
    c.stun = 0.55; c.hold = 0;
    if (c.me || c === G.ctl) c.st.lost++;
    if (keeper) { b.owner = p; p.hold = 0; G.lastTouch = p; say(G, `The ${G.teams[p.t].club.ab} keeper smothers it.`); return; }
    if (d2(p, c) < 1.2 && Math.random() < 0.55) { b.owner = p; p.hold = 0; G.lastTouch = p; }
    else { b.owner = null; const a = p.face + rnd(-0.7, 0.7); b.vx = Math.sin(a) * rnd(3, 7); b.vy = Math.cos(a) * rnd(3, 7); b.vz = 0; b.last = p; G.lastTouch = p; }
    G.pass = null;
    G.events.push({ k: 'tackle' });
    if (G.mode === 'team' && p.t === 0) G.ctl = p;
  }
  function foul(G, p, c, hard) {
    if (G.phase !== 'play') return;
    G.stats[p.t].fouls++;
    const t = c.t, inBox = Math.abs(c.y - goalY(G, t)) < PITCH.BOXD && Math.abs(c.x - CX) < PITCH.BOXW / 2;
    /* a clear chance denied: the man fouled near goal with nobody but the keeper between him and it */
    const gyc = goalY(G, t), dg = hyp(CX - c.x, gyc - c.y), last = dg < 30 && !teamOf(G, p.t).some(q => q !== p && q.role !== 'GK' && Math.abs(q.y - gyc) < Math.abs(c.y - gyc) - 0.5 && hyp(q.x - c.x, q.y - c.y) < 18);
    if (last && hard && !inBox) sendOff(G, p, `Straight red for ${p.name}! A clear chance denied.`);
    else if (hard && Math.random() < 0.45) { G.stats[p.t].yellows++; p.yellow = (p.yellow || 0) + 1;
      if (p.yellow >= 2) sendOff(G, p, `Second yellow for ${p.name}. He's off!`);
      else { say(G, `Yellow card for ${p.name} (${G.teams[p.t].club.ab}).`, 'card'); G.events.push({ k: 'card' }); } }
    c.act = { k: 'fall', t: 0, T: 1.1 };
    if (inBox) { stop(G, 'pen', t, CX, 0, `PENALTY to ${G.teams[t].club.name}! ${c.name} is brought down.`); G.events.push({ k: 'pen' }); }
    else { G.events.push({ k: 'foul' }); stop(G, 'fk', t, c.x, c.y, `Free kick to ${G.teams[t].club.ab}: ${p.name} fouls ${c.name}.`); }
  }

  function sendOff(G, p, text) {
    p.red = true; p.off = true; G.stats[p.t].reds = (G.stats[p.t].reds || 0) + 1;
    say(G, text, 'card'); G.events.push({ k: 'card', red: true, p });
    if (G.ball.owner === p) G.ball.owner = null;
    if (G.ctl === p) { const n = teamOf(G, p.t).filter(q => q !== p && q.role !== 'GK')[0]; if (G.mode === 'team' && n) G.ctl = n; }
    refresh(G);
  }
  /* ------------------------------------------------------------------ the user */
  function stickWorld(G) {
    const i = G.input, f = G.cam;   // camera forward on the pitch (fx, fy); its right is (-fy, fx)
    const rx = -f.fy, ry = f.fx;
    const x = rx * i.mx + f.fx * -i.my, y = ry * i.mx + f.fy * -i.my, m = hyp(i.mx, i.my);
    return { x, y, m: Math.min(1, m) };
  }
  function userControl(G, dt) {
    const p = G.ctl; if (!p || p.bench || p.off) { G.input.q.length = 0; return; }
    p.ctl = true;
    const st = stickWorld(G), i = G.input, b = G.ball;
    p.sprint = !!i.sprint;
    const steering = st.m > 0.15;
    G.assist = !steering && G.idleT > 0.45;
    G.idleT = steering ? 0 : (G.idleT || 0) + dt;
    if (steering && !(p.act && (p.act.k === 'slide' || p.act.k === 'fall'))) {
      const sp = maxSpd(p) * (p.sprint ? 1 : 0.76) * Math.max(0.35, st.m);
      p.tx = p.x + st.x / st.m * 3; p.ty = p.y + st.y / st.m * 3; p.want = sp;
    } else if (!G.assist) { p.tx = p.x; p.ty = p.y; p.want = 0; }
    /* Press (held): close down the man on the ball and nick it when near */
    if (i.press && !steering && b.owner && b.owner.t !== p.t) {
      const c = b.owner, gy = ownY(G, p.t), gx = CX - c.x, g2 = gy - c.y, gl = hyp(gx, g2) || 1;
      p.tx = c.x + gx / gl * 0.9; p.ty = c.y + g2 / gl * 0.9; p.want = maxSpd(p) * (p.sprint ? 1 : 0.9); G.assist = false;
      if (d2(p, c) < 1.4 && p.cd <= 0 && Math.random() < dt * 2) tackle(G, p, c);
    }
    const has = b.owner === p, near = !b.owner && d2(b, p) < 2.0 && b.z < 2.2;
    const myTeamHas = possTeam(G) === p.t;
    const dir = steering ? { x: st.x / st.m, y: st.y / st.m } : { x: Math.sin(p.face), y: Math.cos(p.face) };
    /* restarts: the taker waits for the user */
    const r = G.restart;
    while (i.q.length) {
      const e = i.q.shift();
      if (G.phase === 'restart' && r && r.taker === p) {
        if (e.k === 'pass' || e.k === 'through' || (e.k === 'shoot' && e.up)) {
          if (r.k === 'throw') takeRestart(G, q => throwIn(G, q, dir));
          else takeRestart(G, () => userKick(G, p, e, dir, true));
        }
        continue;
      }
      if (G.phase !== 'play') continue;
      if (has || (near && (e.k === 'shoot' || e.k === 'pass' || e.k === 'through'))) { userKick(G, p, e, dir); continue; }
      if (e.k === 'tackle' && !e.up) { const c = b.owner; if (c && c.t !== p.t && d2(c, p) < 2.4) { p.face = Math.atan2(c.x - p.x, c.y - p.y); tackle(G, p, c, true); } else { p.act = { k: 'kick', t: 0, T: 0.3, foot: 'R', p: 0.3 }; } }
      if (e.k === 'slide' && !e.up) slide(G, p, dir.x, dir.y);
      if (e.k === 'switch' && !e.up && G.mode === 'team') switchPlayer(G);
      if ((e.k === 'call' || e.k === 'run') && !e.up && myTeamHas) { G.call = { t: G.t + 1.6, run: e.k === 'run' }; p.callT = G.t; G.events.push({ k: 'call' }); }
      if (e.k === 'shoot' && e.up && near) userKick(G, p, e, dir);
    }
  }
  function userKick(G, p, e, dir, setPiece) {
    const b = G.ball, gy = goalY(G, p.t);
    if (e.k === 'shoot') {
      if (!e.up) return;   // shots fire on release, with the power of the hold
      if (e.type === 'fake') return fakeShot(G, p);
      const pw = clamp(e.dur / 0.9, 0.05, 1), ss = sweet(G, p);
      /* aim: the stick's part across the goal picks the spot; none, the far post */
      const st = stickWorld(G);
      shoot(G, p, { type: e.type || 'drive', pw, across: st.m > 0.3 ? acrossOf(G, p, st) : null, timing: timingOf(pw, ss) });
      return;
    }
    if (e.k === 'pass' || e.k === 'through') {
      const mates = teamOf(G, p.t).filter(q => q !== p);
      let best = null, bs = 1e9;
      for (const q of mates) {
        const ox = q.x - p.x, oy = q.y - p.y, ol = hyp(ox, oy); if (ol < 3 || ol > 55) continue;
        const ang = Math.acos(clamp((ox * dir.x + oy * dir.y) / ol, -1, 1));
        if (ang > 0.7) continue;
        const s = ang * 26 + ol * 0.18 - (e.k === 'through' && FWD(q.role) ? 4 : 0);
        if (s < bs) { bs = s; best = q; }
      }
      const lob = !!e.long;
      const wide = Math.abs(p.x - CX) > 16 && depth(G, p.t, p.y) > L - 32;
      if (e.k === 'through') {
        const q = best || mates.filter(q => FWD(q.role)).sort((a, c) => d2(a, p) - d2(c, p))[0];
        const line = offLine(G, p.t), aheadD = Math.min(L - 8, Math.max(depth(G, p.t, q.y) + 7, Math.min(line + 6, depth(G, p.t, q.y) + 12)));
        const pt = { x: clamp(q.x + dir.x * 3, 5, W - 5), y: fromDepth(G, p.t, aheadD) };
        q.run = G.t + 2.5;
        pass(G, p, null, pt, { through: true, lob, to: q });
        G.pendingTo = q;
        return;
      }
      if (lob && wide && !setPiece) {
        const box = mates.filter(q => depth(G, p.t, q.y) > L - 20 && Math.abs(q.x - CX) < 13);
        const q = box.sort((a, c) => d2(a, { x: CX, y: gy }) - d2(c, { x: CX, y: gy }))[0];
        if (q) { pass(G, p, null, { x: q.x, y: q.y + G.side[p.t] * 1 }, { lob: true, cross: true, to: q }); G.pendingTo = q; return; }
      }
      if (best) pass(G, p, best, null, { lob });
      else pass(G, p, null, { x: p.x + dir.x * 16, y: p.y + dir.y * 16 }, { lob });
    }
  }
  function switchPlayer(G) {
    const b = G.ball, mine = teamOf(G, 0).filter(q => q.role !== 'GK' && q !== G.ctl);
    const target = b.owner || b;
    mine.sort((a, c) => d2(a, target) - d2(c, target));
    if (mine[0]) { if (G.ctl) G.ctl.ctl = false; G.ctl = mine[0]; G.events.push({ k: 'switch' }); }
  }
  function autoSwitch(G) {
    if (G.mode !== 'team') return;
    const b = G.ball, cur = G.ctl;
    if (b.owner && b.owner.t === 0) { if (b.owner !== cur) { if (cur) cur.ctl = false; G.ctl = b.owner; } return; }
    if (G.pass && G.pass.from.t === 0) { const to = G.pass.to || G.pendingTo; if (to && to !== cur) { if (cur) cur.ctl = false; G.ctl = to; } return; }
    /* defending (or a loose ball): the closest man, unless the current one is about as close */
    const target = b.owner || b, mine = teamOf(G, 0).filter(q => q.role !== 'GK');
    const best = mine.reduce((m, q) => !m || d2(q, target) < d2(m, target) ? q : m, null);
    if (best && cur !== best && (!cur || d2(cur, target) > d2(best, target) + ((G.idleT || 0) > 0.25 ? 4 : 11))) { if (cur) cur.ctl = false; G.ctl = best; }
  }

  /* ------------------------------------------------------------------ the step */
  function step(G, dt) {
    if (G.over) return;
    if (G.slowT > 0) { G.slowT -= dt; if (G.slowT <= 0) G.slow = 1; }
    dt *= G.ff ? 1 : (G.slow || 1);
    G.t += dt; G.phaseT += dt;
    G.userOn = !!G.ctl && !G.ff && !G.o.auto && !(G.ctl.bench || G.ctl.off);
    refresh(G);
    /* the clock runs in play and at restarts, stops for goals and the break */
    if (G.phase === 'play' || G.phase === 'restart') {
      G.htime += dt;
      const pt = possTeam(G); if (pt >= 0) G.stats[pt].poss += dt;
      if (G.sub && !G.subDone && minute(G) >= G.sub.on) subOn(G);
      if (G.half === 2 && !G.lateSaid && minute(G) >= 84) { G.lateSaid = true; G.events.push({ k: 'late' }); }
      if (G.o.off && G.me && !G.me.off && minute(G) >= G.o.off && !G.me.bench) subOff(G);
      if (G.htime >= G.halfLen && G.added == null) { G.added = G.half === 1 ? 1 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 4); say(G, `${G.added} minute${G.added > 1 ? 's' : ''} of stoppage time.`, 'stoppage'); G.events.push({ k: 'stoppage', n: G.added }); }
      if (G.added != null && G.htime >= G.halfLen * (1 + G.added / 45) && G.phase === 'play' && !(G.shot && G.t - G.shot.t < 2)) return endHalf(G);
    }
    if (G.phase === 'goal') {
      for (const p of G.ps) if (p.act) { p.act.t += dt; if (p.act.t >= p.act.T && p.act.k !== 'cele') p.act = null; }
      for (const p of G.ps) { if (p.act && p.act.k === 'cele') { p.tx = p.x + Math.sin(p.face) * 2; p.ty = p.y + Math.cos(p.face) * 2; p.want = p.goalie ? 6 : 1.5; } else { p.tx = p.x; p.ty = p.y; p.want = 0; } }
      move(G, dt); stepBall(G, dt, true);
      if (G.phaseT > (G.ff ? 0 : 3.2)) { for (const p of G.ps) { p.act = null; p.sad = false; p.goalie = false; } kickoff(G, G.concede); }
      return;
    }
    if (G.phase === 'half' || G.phase === 'full') return;
    if (G.phase === 'restart') {
      for (const p of G.ps) if (p.act && !p.act.fire) { p.act.t += dt; if (p.act.t >= p.act.T) p.act = null; }
      restartPositions(G, dt);
      const r = G.restart, tk = r.taker, b = G.ball;
      if (tk) { b.x = r.x; b.y = r.y; b.z = R; b.vx = b.vy = b.vz = 0; }
      const ready = tk && hyp(tk.x - tk.tx, tk.y - tk.ty) < 0.8 && G.phaseT > (G.ff ? 0.3 : r.k === 'kickoff' ? 0.9 : 1.3);
      if (ready) {
        tk.face = Math.atan2(CX - tk.x, (r.k === 'throw' ? fromDepth(G, r.team, depth(G, r.team, tk.y) + 5) : goalY(G, r.team)) - tk.y);
        if (r.k === 'throw' && tk.t === 0 && G.userOn && tk === G.ctl) tk.act = tk.act || null;
        const userTakes = G.userOn && tk === G.ctl;
        if (!userTakes || G.phaseT > 12) takeRestart(G, r.k === 'throw' ? p => throwIn(G, p) : r.k === 'kickoff' ? p => kickoffPass(G, p) : null);
        else if (r.k === 'throw') tk.hold = 1;
      }
      if (G.userOn) userControl(G, dt);
      for (const p of G.ps) if (p.role === 'GK' && !(G.restart && G.restart.taker === p)) keeper(G, p, dt);
      move(G, dt);
      return;
    }
    /* play */
    autoSwitch(G);
    if (G.userOn) userControl(G, dt);
    for (const p of G.ps) {
      if (p.bench || p.off) continue;
      if (p.cd > 0) p.cd -= dt;
      if (p.stun > 0) p.stun -= dt;
      p.next -= dt;
      if (p.act) { p.act.t += dt; if (p.act.fire && p.act.t >= p.act.at) { const f = p.act.fire; p.act.fire = null; if (G.ball.owner === p || (!G.ball.owner && d2(G.ball, p) < 2.2)) f(); } if (p.act.t >= p.act.T) { if (p.act.k === 'slide') p.slideV = null; p.act = null; } }
      p.think = (p.think ?? Math.random() * 0.08) - dt;
      const urgent = p.role === 'GK' || G.ball.owner === p || (G.pass && G.pass.to === p);
      if ((!(p === G.ctl && G.userOn && !G.assist) || p.role === 'GK') && (urgent || p.think <= 0)) { aiThink(G, p, urgent ? dt : 0.083); if (p.think <= 0) p.think += 0.083; }
      else if (p === G.ctl && G.ball.owner === p) p.hold += dt;
      p.ctl = p === G.ctl && G.userOn;
    }
    move(G, dt);
    stepBall(G, dt);
  }
  function throwIn(G, p, dir) {
    const mates = teamOf(G, p.t).filter(q => q !== p && q.role !== 'GK').sort((a, c) => d2(a, p) - d2(c, p));
    let q = mates[Math.floor(Math.random() * Math.min(3, mates.length))];
    if (dir) { const c = mates.filter(m => d2(m, p) < 30).map(m => ({ m, s: Math.acos(clamp(((m.x - p.x) * dir.x + (m.y - p.y) * dir.y) / (d2(m, p) || 1), -1, 1)) * 20 + d2(m, p) * 0.2 })).sort((a, c) => a.s - c.s)[0]; if (c) q = c.m; }
    p.act = { k: 'throw', t: 0, T: 0.6 };
    const b = G.ball, d = d2(p, q), v = Math.min(14, 5 + d * 0.6), a = Math.atan2(q.x - p.x, q.y - p.y);
    b.owner = null; b.z = 2; b.vx = Math.sin(a) * v; b.vy = Math.cos(a) * v; b.vz = 2.5; b.last = p; G.lastTouch = p;
    G.pass = { from: p, to: q, t: G.t, kind: 'throw' }; p.cd = 0.5;
    if (G.mode === 'team' && p.t === 0) G.ctl = q;
  }
  function kickoffPass(G, p) {
    const q = teamOf(G, p.t).filter(q => q !== p && !DEF(q.role) && q.role !== 'GK' && depth(G, p.t, q.y) < depth(G, p.t, p.y)).sort((a, c) => d2(a, p) - d2(c, p))[0];
    if (q) pass(G, p, q, null, {});
  }

  /* ------------------------------------------------------------------ movement */
  function move(G, dt) {
    for (const p of G.ps) {
      if (p.bench || p.off) continue;
      if (p.act && p.act.k === 'slide') { const k = Math.max(0, 1 - p.act.t / p.act.T); p.x += p.slideV.x * k * dt; p.y += p.slideV.y * k * dt; p.vx = p.slideV.x * k; p.vy = p.slideV.y * k; slideContact(G, p); continue; }
      if (p.act && p.act.k === 'fall') { p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx * dt; p.y += p.vy * dt; continue; }
      if (p.dive) { p.x += p.vx * dt; continue; }
      const kickWind = p.act && p.act.k === 'kick' && p.act.t < p.act.T * 0.6;
      let dx = p.tx - p.x, dy = p.ty - p.y; const dl = hyp(dx, dy);
      let top = Math.min(p.want || 0, maxSpd(p) * (G.ball.owner === p ? 0.86 + p.a.dri * 0.0012 : 1)) * (p.stun > 0 ? 0.4 : 1) * (kickWind ? 0.35 : 1);
      if (p.sprint && p.ctl) top = Math.min(maxSpd(p) * (G.ball.owner === p ? 0.95 : 1), Math.max(top, maxSpd(p) * 0.6));
      const want = dl < 0.12 ? 0 : Math.min(top, dl * 2.6);
      const wx = dl ? dx / dl * want : 0, wy = dl ? dy / dl * want : 0;
      const acc = (p.stun > 0 ? 3 : 7.5 + p.a.pac * 0.03) * dt;
      const ex = wx - p.vx, ey = wy - p.vy, el = hyp(ex, ey);
      if (el > acc) { p.vx += ex / el * acc; p.vy += ey / el * acc; } else { p.vx = wx; p.vy = wy; }
      p.x = clamp(p.x + p.vx * dt, -3, W + 3); p.y = clamp(p.y + p.vy * dt, -2, L + 2);
      const v = hyp(p.vx, p.vy);
      /* face where he is going; standing, face the ball (a carrier faces his run) */
      let fa = null;
      if (v > 0.8) fa = Math.atan2(p.vx, p.vy);
      else if (G.ball.owner !== p) fa = Math.atan2(G.ball.x - p.x, G.ball.y - p.y);
      if (fa !== null && !(p.act && p.act.k === 'kick')) { let df = fa - p.face; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; p.face += df * Math.min(1, dt * (v > 0.8 ? 9 : 4)); }
      if (p.sprint && v > 6) p.stamina = Math.max(0, (p.stamina ?? 1) - dt * 0.02); else p.stamina = Math.min(1, (p.stamina ?? 1) + dt * 0.01);
    }
    /* bodies keep apart */
    const ps = G.ps;
    for (let i = 0; i < ps.length; i++) { const a = ps[i]; if (a.bench || a.off) continue;
      for (let j = i + 1; j < ps.length; j++) { const c = ps[j]; if (c.bench || c.off) continue; const dx = c.x - a.x, dy = c.y - a.y, dd = dx * dx + dy * dy;
        if (dd < 0.5 && dd > 1e-6) { const d = Math.sqrt(dd), k = (0.71 - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; } } }
  }
  function slideContact(G, p) {
    if (p.slideHit) return;
    const b = G.ball, c = b.owner;
    const feet = { x: p.x + Math.sin(p.face) * 0.8, y: p.y + Math.cos(p.face) * 0.8 };
    if (!c && d2(feet, b) < 1.0 && b.z < 0.6) { p.slideHit = true; const a = p.face + rnd(-0.4, 0.4); b.vx = Math.sin(a) * 9; b.vy = Math.cos(a) * 9; b.vz = 0.5; b.last = p; G.lastTouch = p; G.pass = null; p.st.tk++; return; }
    if (c && c.t !== p.t && d2(feet, b) < 1.0) { p.slideHit = true; const ok = Math.random() < 0.55 + (p.a.def - c.a.dri) * 0.006; if (ok) { win(G, p, c); b.owner = null; p.st.tk++; } else foul(G, p, c, true); return; }
    if (c && c.t !== p.t && d2(feet, c) < 0.9) { p.slideHit = true; foul(G, p, c, true); }
  }

  /* ------------------------------------------------------------------ the ball */
  function stepBall(G, dt, quiet) {
    const b = G.ball;
    if (b.owner) {
      const o = b.owner;
      if (o.act && o.act.k === 'throw') return;
      if (o.caught) { b.x = o.x + Math.sin(o.face) * 0.35; b.y = o.y + Math.cos(o.face) * 0.35; b.z = 1.0; b.vx = b.vy = b.vz = 0; return; }
      /* at his feet: a touch ahead in the direction he runs, the further the faster */
      const v = hyp(o.vx, o.vy), r = 0.42 + Math.min(0.9, v * 0.09) + 0.1 * Math.max(0, Math.sin(o.phaseB = (o.phaseB || 0) + v * dt * 1.6));
      const tx = o.x + Math.sin(o.face) * r, ty = o.y + Math.cos(o.face) * r;
      b.vx = (tx - b.x) / Math.max(dt, 1e-3) * 0.5; b.vy = (ty - b.y) / Math.max(dt, 1e-3) * 0.5;
      b.x = lerp(b.x, tx, Math.min(1, dt * 14)); b.y = lerp(b.y, ty, Math.min(1, dt * 14)); b.z = R; b.vz = 0; b.spin = 0;
      b.roll += v * dt / R;
      if (o.t >= 0) G.lastTouch = o;
      return;
    }
    if (G.pass && (G.t - G.pass.t > 3 || (G.t - G.pass.t > 0.4 && hyp(b.vx, b.vy) < 2.5 && b.z < 0.3))) G.pass = null;
    const n = 2, h = dt / n;
    for (let s = 0; s < n; s++) {
      const ev = [], py = b.y;
      PS.phys.step(b, h, ev);
      if (quiet) continue;
      for (const e of ev) {
        if (e === 'goal' || e === 'owngoal') return scored(G, e === 'goal' ? L : 0);
        if (e === 'post' || e === 'bar') { G.events.push({ k: 'post' }); say(G, e === 'post' ? 'Off the post!' : 'Off the bar!', 'chance'); }
        if (e === 'bounce') G.events.push({ k: 'bounce', v: Math.abs(b.vz) });
        if (e === 'out') return outOfPlay(G);
      }
      if (b.x < -R * 2 || b.x > W + R * 2) return outOfPlay(G);
      saves(G, py);
      if (G.shot && !G.shot.slowed && !G.ff && G.shot.by.ctl !== undefined) {
        const gy = goalY(G, G.shot.by.t), dl = Math.abs(gy - b.y), toward = (gy - b.y) * b.vy > 0;
        if (toward && dl < 7 && Math.abs(b.x - CX) < POST + 1.5 && b.z < PITCH.GH + 1) { G.shot.slowed = true; G.slow = 0.35; G.slowT = 0.35; }
      }
      touches(G);
      if (b.owner) return;
    }
  }
  function outOfPlay(G) {
    const b = G.ball, last = G.lastTouch, lt = last ? last.t : 0;
    if (G.phase !== 'play') return;
    if (b.x < 0 || b.x > W) return stop(G, 'throw', opp(lt), b.x, clamp(b.y, 1, L - 1), `Throw-in, ${G.teams[opp(lt)].club.ab}.`);
    /* over a goal line: whose end? */
    const endY = b.y > L / 2 ? L : 0;
    const defending = [0, 1].find(t => ownY(G, t) === endY);
    if (G.shot && G.shot.by.t !== defending) {
      const sh = G.shot, over = b.z > PITCH.GH - 0.1 && Math.abs(b.x - CX) < POST + 1, near = Math.abs(Math.abs(b.x - CX) - POST) < 1.2;
      const what = over ? (b.z < PITCH.GH + 0.8 ? 'Just over the bar!' : 'Over the bar.') : near ? 'Inches wide!' : 'Wide.';
      say(G, `${sh.by.name}: ${what}`, 'miss'); G.events.push({ k: 'miss', what, ctl: !!sh.by.ctl, timing: sh.timing });
      sh.by.mood2 = 'stern'; sh.by.moodT = G.t + 2.5;
    }
    if (lt === defending) stop(G, 'corner', opp(defending), b.x, endY, `Corner to ${G.teams[opp(defending)].club.ab}.`);
    else stop(G, 'goalkick', defending, b.x, endY, '');
  }
  function saves(G, py) {
    const b = G.ball, sh = G.shot; if (!sh) return;
    const t = opp(sh.by.t), g = teamOf(G, t).find(p => p.role === 'GK'); if (!g) return;
    const toward = -G.side[t];
    if (!((py - g.y) * toward < 0 && (b.y - g.y) * toward >= -0.1)) return;
    /* how far he can get to: standing reach, then the dive as it unfolds; the top corner is the last place a keeper
       gets to (dives up take longer than dives low), and a chip that is over his head is gone */
    const dz = Math.max(0, b.z - 1.7), reach = ((sh.pen ? 0.35 : 1.0) + (g.dive ? clamp((G.t - g.dive) * 2.1, 0, 0.95) : 0) + g.a.gk * 0.002) * (1 - dz * 0.42), dxk = Math.abs(b.x - g.x);
    const offLine = Math.abs(g.y - ownY(G, t)), maxH = 2.3 + g.a.gk * 0.002 - (offLine > 4 && sh.chip ? 0.2 : 0);
    const e = clamp((dxk / reach - 0.45) / 0.55, 0, 1), hands = 0.97 - (sh.pen ? 0.62 : 0.55) * e * e * (3 - 2 * e) - Math.max(0, hyp(b.vx, b.vy) - 24) * 0.012;
    if (dxk < reach && b.z < maxH && Math.random() < hands) {
      const sp = hyp(b.vx, b.vy, b.vz);
      G.stats[sh.by.t].onT++; sh.by.st.ot++; g.st.sv++; G.stats[t].saves++;
      G.events.push({ k: 'save' });
      if (sp < 17 && dxk < 0.55 && b.z < 1.9) { b.owner = g; g.caught = true; g.hold = 0; G.lastTouch = g; b.vx = b.vy = b.vz = 0; G.shot = null; say(G, `Saved! ${g.name} holds ${sh.by.name}'s shot.`, 'save'); return; }
      /* parried: back into play, or (a firm one at full stretch) tipped round the post for a corner */
      if (dxk > reach * 0.4 && sp > 13 && Math.random() < 0.6) {
        /* out past the post before it reaches the line: sideways fast enough for the distance left */
        const gyL = ownY(G, t), dl = Math.max(0.3, Math.abs(gyL - b.y)), vyo = Math.sign(gyL - b.y) * rnd(3, 5), tt = dl / Math.abs(vyo), sx = b.x > CX ? 1 : -1;
        b.vy = vyo; b.vx = sx * Math.max(5, (POST + 1.2 - Math.abs(b.x - CX)) / tt + 1.5); b.vz = rnd(1.5, 3);
      }
      else { b.vy = -b.vy * rnd(0.2, 0.35); b.vx = (b.x > g.x ? 1 : -1) * rnd(3, 7); b.vz = rnd(1, 3); }
      b.spin = 0; b.last = g; G.lastTouch = g; g.cd = 0.7;   // (he cannot gather his own parry in the same breath)
      G.shot = null; say(G, `Great save from ${g.name}!`, 'save');
    }
  }
  function touches(G) {
    const b = G.ball, sp = hyp(b.vx, b.vy);
    for (const p of G.ps) {
      if (p.bench || p.off || p.stun > 0) continue;
      if (p.cd > 0 && b.last === p) continue;
      if (p.role === 'GK' && G.shot && G.shot.by.t !== p.t) continue;
      const dd = d2(p, b);
      if (dd > 1.25) continue;
      const kp = G.pass ? G.pass.kind : null;
      /* a keeper claims a ball in the air in his box */
      if (p.role === 'GK' && b.z < 2.7 && dd < 1.1 && Math.abs(b.y - ownY(G, p.t)) < PITCH.BOXD && Math.abs(b.x - CX) < PITCH.BOXW / 2) {
        if (G.pass && G.pass.from.t === p.t && kp !== 'cross') { /* a back pass: feet */ }
        else { b.owner = p; p.caught = true; p.hold = 0; G.lastTouch = p; G.pass = null; G.shot = null; return; }
      }
      /* blocks: a shot hitting a body */
      if (G.shot && G.shot.by.t !== p.t && dd < 0.5 && b.z < 1.85 && sp > 9 && p.role !== 'GK') {
        b.vy = -b.vy * rnd(0.15, 0.4); b.vx = rnd(-5, 5); b.vz = rnd(0.5, 3); b.spin = 0; b.last = p; G.lastTouch = p; G.shot = null;
        say(G, `Blocked by ${p.name}!`, 'chance'); G.events.push({ k: 'block' }); return;
      }
      /* headers */
      if (b.z > 1.25 && b.z < 2.6 && dd < 1.1 && p.cd <= 0) {
        const gy = goalY(G, p.t), inBox = Math.abs(b.y - gy) < 18 && Math.abs(b.x - CX) < 14;
        p.act = { k: 'head', t: 0, T: 0.55 }; p.cd = 0.5;
        if (inBox) {
          const tx = CX + (p.x > CX ? -1 : 1) * rnd(0.4, POST - 0.4), a = Math.atan2(tx - b.x, gy - b.y) + gauss() * (0.09 - p.a.phy * 0.0005), v = 10 + p.a.phy * 0.06;
          b.vx = Math.sin(a) * v; b.vy = Math.cos(a) * v; b.vz = -1 + rnd(0, 1.8); b.spin = 0; b.last = p; G.lastTouch = p;
          G.shot = { by: p, t: G.t }; G.stats[p.t].shots++; p.st.sh++; G.pass = null; say(G, `Header from ${p.name}!`, 'chance');
          if (G.lastPassFrom && G.lastPassFrom.t === p.t) G.lastPassFrom.st.kp++;
        } else {
          const toward = Math.sign(goalY(G, p.t) - p.y) || 1, a = rnd(-0.5, 0.5);
          b.vx = Math.sin(a) * 9; b.vy = toward * Math.cos(a) * 9; b.vz = 3; b.last = p; G.lastTouch = p; G.pass = null; G.shot = null;
        }
        G.events.push({ k: 'head' });
        return;
      }
      if (b.z > 1.0) continue;
      const reach = p.ctl ? 1.0 : 0.85;
      if (dd > reach) continue;
      /* interceptions: one chance per man per pass, harder when it is struck hard */
      if (G.pass && G.pass.from.t !== p.t && sp > 6 && G.pass.to !== p) {
        const kid = G.pass.t;
        if (p.rollFor !== kid) { p.rollFor = kid; p.rollOk = Math.random() < clamp(0.7 - sp * 0.028 + p.a.def * 0.003, 0.12, 0.75); }
        if (!p.rollOk) continue;
        p.st.it++;
      }
      const rel = hyp(b.vx - p.vx, b.vy - p.vy), ctrl = 11 + p.a.dri * 0.12;
      if (rel < ctrl) {
        if (G.offside.has(p)) { G.stats[p.t].offsides++; G.events.push({ k: 'offside' }); return stop(G, 'fk', opp(p.t), p.x, p.y, `Offside: ${p.name}.`); }
        G.offside.clear();
        if (G.pass && G.pass.from.t === p.t && G.pass.from !== p) { G.stats[p.t].passOk++; G.pass.from.st.pc++; }
        b.owner = p; p.hold = 0; p.caught = p.role === 'GK' ? false : undefined; G.lastTouch = p; G.pass = null; G.shot = null; G.pendingTo = null;
        G.events.push({ k: 'touch' });
        return;
      }
      b.vx = (b.vx - p.vx) * -0.25 + p.vx; b.vy = (b.vy - p.vy) * -0.25 + p.vy; b.last = p; G.lastTouch = p;
    }
  }
  function scored(G, endY) {
    const b = G.ball, t = [0, 1].find(t => goalY(G, t) === endY);
    const by = G.shot ? G.shot.by : b.last || G.lastTouch, own = by && by.t !== t;
    G.score[t]++;
    const assist = !own && G.lastPassFrom && G.lastPassFrom.t === t && G.lastPassTo === by && G.t - G.lastPassT < 8 ? G.lastPassFrom : null;
    if (by && !own) { by.st.g++; if (G.shot) { by.st.ot++; G.stats[t].onT++; } }
    if (assist) assist.st.as++;
    G.scorers.push({ side: t, name: own ? (by ? by.name + ' (o.g.)' : 'Own goal') : by ? by.name : '?', min: minute(G), you: !!(by && by.me && !own), assist: !!(assist && assist.me), p: by });
    say(G, own ? `OWN GOAL! ${by ? by.name : ''} turns it into his own net.` : `GOAL! ${by ? by.name : ''} scores for ${G.teams[t].club.name}!` + (assist ? ` (${assist.name})` : ''), 'goal' + (t === 0 ? '' : ' them'));
    /* where it went in, for the call: the corner, the pace, the distance */
    let how = '';
    if (G.shot && !own) {
      const sh = G.shot, ax = Math.abs(b.x - CX), hi = b.z > 1.6, lo = b.z < 0.6, corner = ax > POST - 1.3;
      how = sh.type === 'chip' ? 'Chipped' : corner && hi ? 'Top corner' : corner && lo ? 'Bottom corner' : sh.type === 'finesse' ? 'Curled in' : sh.type === 'volley' ? 'On the volley' : hi ? 'Into the roof of the net' : ax < 1 && lo ? 'Through the middle' : 'Finished';
      how += ` \u00b7 ${Math.round(sh.dist || 0)} m \u00b7 ${sh.kmh || 0} km/h` + (sh.timing === 'perfect' ? ' \u00b7 perfect strike' : '');
    } else if (by && !G.shot && !own) how = 'Header';
    G.events.push({ k: 'goal', t, by, assist, how, x: b.x, z: b.z, endY });
    G.phase = 'goal'; G.phaseT = 0; G.concede = opp(t); G.shot = null; G.pass = null;
    /* the celebration: the scorer wheels away, his teammates follow; the other side's heads drop */
    if (by && !own) { by.act = { k: 'cele', t: 0, T: 3.2, c: by.me && G.o.me && G.o.me.cele ? G.o.me.cele : ['arms', 'knee', 'point', 'plane', 'dance'][Math.floor(Math.random() * 5)] }; by.face = Math.atan2(CX - by.x, (L / 2 - by.y) * 0.3 + (by.x > CX ? 1 : -1)); by.goalie = true; }
    for (const p of G.ps) if (p.t !== t) p.sad = true;
  }
  function endHalf(G) {
    if (G.half === 1) {
      G.phase = 'half'; G.half = 2; G.htime = 0; G.added = null; say(G, `Half time: ${G.teams[0].club.ab} ${G.score[0]}–${G.score[1]} ${G.teams[1].club.ab}.`, 'ht');
      G.events.push({ k: 'half' });
      G.side = [-G.side[0], -G.side[1]];
      if (G.ff) resume(G);
    } else { G.phase = 'full'; G.over = true; say(G, `Full time: ${G.teams[0].club.ab} ${G.score[0]}–${G.score[1]} ${G.teams[1].club.ab}.`, 'ft'); G.events.push({ k: 'full' }); }
  }
  function resume(G) { if (G.phase !== 'half') return; kickoff(G, opp(G.kickTeam)); G.events.push({ k: 'second' }); }
  function subOn(G) {
    G.subDone = true; const me = G.me; if (!me) return;
    const out = G.sub.slot && !G.sub.slot.off ? G.sub.slot : teamOf(G, 0).filter(p => p !== me && p.role !== 'GK')[9];
    if (out) { me.x = out.x; me.y = out.y; me.fx = out.fx; me.fy = out.fy; me.role = out.role; out.off = true; }
    me.bench = false; G.ctl = me;
    say(G, `Substitution for ${G.teams[0].club.ab}: on comes ${me.name}.`, 'sub'); G.events.push({ k: 'subon' });
  }
  function subOff(G) {
    const me = G.me; me.off = true; if (G.ball.owner === me) G.ball.owner = null;
    say(G, `${me.name} is substituted.`, 'sub'); G.events.push({ k: 'suboff' });
  }

  /* ------------------------------------------------------------------ the result, for the career */
  function rating(G, p) {
    const s = p.st, why = [];
    let r = 6.0;
    const add = (v, t) => { if (!v) return; r += v; why.push({ v, t }); };
    add(s.g * 1.0, `${s.g} goal${s.g > 1 ? 's' : ''}`);
    add(s.as * 0.7, `${s.as} assist${s.as > 1 ? 's' : ''}`);
    add(Math.max(0, s.ot - s.g) * 0.15, 'shots on target');
    add(-Math.max(0, s.sh - s.ot - 2) * 0.05, 'wayward shooting');
    add(s.kp * 0.18, 'chances created');
    add(s.tk * 0.15, 'tackles won');
    add(s.it * 0.08, 'interceptions');
    if (s.ps >= 5) add(Math.round(((s.pc / s.ps) - 0.75) * 2 * 100) / 100, `passing (${s.pc}/${s.ps})`);
    add(-s.lost * 0.1, 'times dispossessed');
    if (p.red) add(-1.5, 'sent off');
    const res = G.score[0] > G.score[1] ? 'W' : G.score[0] < G.score[1] ? 'L' : 'D';
    add(res === 'W' ? 0.3 : res === 'L' ? -0.25 : 0, res === 'W' ? 'the win' : 'the defeat');
    return { r: clamp(Math.round(r * 10) / 10, 3, 10), why, res };
  }
  function result(G) {
    const me = G.me, s = me ? me.st : {};
    const on = G.o.on || 0, off = G.o.off || 90;
    return {
      score: G.score.slice(), scorers: G.scorers.map(x => ({ side: x.side, name: x.name, min: x.min, you: x.you, assist: x.assist })),
      stats: { goals: s.g || 0, assists: s.as || 0, shots: s.sh || 0, onT: s.ot || 0, keyPass: s.kp || 0, dribbles: s.dr || 0, lost: s.lost || 0, offside: 0, xg: 0, moments: 0, played: 1, passes: s.ps || 0, passOk: s.pc || 0, tackles: s.tk || 0 },
      rating: me && !(me.bench && !G.subDone) ? rating(G, me) : null, on: me && me.bench && !G.subDone ? 91 : on, off, team: G.stats, feed: G.feed
    };
  }
  /* run the rest of the match without drawing: n seconds of game time a call (the caller loops) */
  function fastForward(G, seconds) {
    const was = G.ff; G.ff = true;
    const dt = 1 / 30;
    for (let s = 0; s < seconds && !G.over; s += dt) { step(G, dt); if (G.phase === 'half') resume(G); }
    G.ff = was;
  }

  PS.Match = { create, step, resume, result, fastForward, rating, minute, clock, FORMS, possTeam, goalY, depth, d2, aimPreview, _shot: { shotPlan, sweet, timingOf, shoot } };
})();
