/* Test harness for PocketSoccer. Load it in the browser console or a test page:
   await fetch('tools/harness.js?'+Date.now()).then(r=>r.text()).then(t=>(0,eval)(t))      (or a <script> tag)
   Then:
     H.moments('box', 100)        play 100 moments of a kind with a simple bot; returns how they ended
     H.all(60)                    every kind of moment, 60 each
     H.season()                   a whole career season, every moment auto-played; returns the summary
   Everything steps the game synchronously (no waiting on real time) through PS.moment._. */
window.H = (() => {
  const P = Object.assign({ L: PS.phys.PITCH.L }, PS.phys), MO = PS.moment, X = MO._;
  const user = { name: 'Bot', num: 9, pos: 'ST', a: { pac: 72, sho: 72, pas: 70, dri: 70, def: 40, phy: 66 } };
  const clubs = PS.data.CLUBS;

  /* the bot: dribble at goal for a moment, then flick at a corner; or call for the ball and run */
  function bot(M, t) {
    const U = M.U, b = M.ball, T = X.touch;
    const has = b.owner === U || (!b.owner && Math.hypot(b.x - U.x, b.y - U.y) < 1.4 && b.z < 1.8);
    if (M.set) {
      if (t > 0.3 && !M._kicked) { M._kicked = 1; flickAt(M, P.CX + (Math.random() < 0.5 ? -1 : 1) * (P.POST - 0.6), 0.55, M.type === 'fk' ? (b.x > P.CX ? 1 : -1) * 0.12 : 0); }
      return;
    }
    if (has) {
      M._carry = (M._carry || 0) + 1 / 120;
      const gd = Math.hypot(P.CX - U.x, P.L - U.y);
      const press = M.ps.some(o => o.team === 1 && o.role !== 'GK' && Math.hypot(o.x - U.x, o.y - U.y) < 2);
      if (M._carry > 0.4 && (gd < 16 || (press && gd < 24) || M._carry > 6)) {
        T.joy = false; T.jx = T.jy = 0;
        const far = U.x > P.CX ? -1 : 1;   // far post, firm
        flickAt(M, P.CX + far * (P.POST - 0.75), 0.72, 0);
        M._carry = -50;
      } else {
        /* run at goal, bending away from the nearest defender in front */
        let dx = P.CX - U.x, dy = P.L - U.y; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const d = M.ps.filter(o => o.team === 1 && o.role !== 'GK' && o.y > U.y - 0.5).sort((a, c) => Math.hypot(a.x - U.x, a.y - U.y) - Math.hypot(c.x - U.x, c.y - U.y))[0];
        if (d && Math.hypot(d.x - U.x, d.y - U.y) < 5) dx += (d.x > U.x ? -1 : 1) * 0.9;
        const k = Math.hypot(dx, dy); T.joy = true; T.jx = dx / k * 1.1; T.jy = -dy / k * 1.1;
      }
    } else {
      T.joy = false; T.jx = T.jy = 0;
      if (b.owner && b.owner.team === 0 && t > 0.4 && !M._called) { M._called = 1; U.call = 1.4; }
      if (b.owner && b.owner.team === 0 && t > 0.5) { T.joy = true; T.jx = (P.CX - U.x) * 0.02; T.jy = -1.15; }
      if (!b.owner && Math.hypot(b.x - U.x, b.y - U.y) < 8) { const dx = b.x - U.x, dy = b.y - U.y, l = Math.hypot(dx, dy) || 1; T.joy = true; T.jx = dx / l; T.jy = -dy / l; }
    }
  }
  /* a flick from the ball toward a point on the goal line, with power p and bow (curl) */
  function flickAt(M, gx, p, bow) {
    const b = M.ball, s = X.project(b.x, b.y, 0), e = X.project(gx, P.L, 0);
    const dx = e.x - s.x, dy = e.y - s.y, l = Math.hypot(dx, dy);
    X.flick({ x: s.x, y: s.y }, { x: s.x + dx / l * 150, y: s.y + dy / l * 150 }, p, bow);
  }

  function run(type, cfgUser = user) {
    let out = null;
    const us = clubs[2], them = clubs[6];
    MO.start({ type, user: cfgUser, us, them, minute: 50, score: [0, 0] }, r => { out = r; });
    MO.stop && 0;
    const M = MO.M; M.ready = true;
    X.draw();          // sets the camera so project/unproject work
    for (let i = 0; i < 120 * 25 && !out; i++) { const m = MO.M; if (!m) break; if (!m.over) bot(m, m.t); X.update(1 / 120); if (i % 30 === 0 && MO.M) X.draw(); }
    MO.stop();
    return out || { end: 'stuck' };
  }
  function moments(type, n = 50) {
    const tally = {}, g = { goal: 0, assist: 0, shots: 0, onT: 0, xg: 0 };
    for (let i = 0; i < n; i++) {
      const r = run(type);
      tally[r.end] = (tally[r.end] || 0) + 1;
      g.goal += r.goal || 0; g.assist += r.assist || 0; g.shots += r.shots || 0; g.onT += r.onT || 0; g.xg += r.xg || 0;
      if (r.chain) tally['chain:' + r.chain.type] = (tally['chain:' + r.chain.type] || 0) + 1;
    }
    return { type, n, goalPct: Math.round(g.goal / n * 100), assistPct: Math.round(g.assist / n * 100), shotsPer: +(g.shots / n).toFixed(2), onTPct: g.shots ? Math.round(g.onT / g.shots * 100) : 0, xgPer: +(g.xg / n).toFixed(2), tally };
  }
  const all = (n = 40) => ['box', 'through', 'counter', 'wing', 'build', 'fk', 'pen'].map(t => moments(t, n));

  function season() {
    const K = PS.career;
    K.wipe();
    K.create({ name: 'Test Player', nation: 'Spain', pos: 'ST', foot: 'Right', club: 11 });
    let guard = 0;
    while (!K.C.summary && guard++ < 40) {
      const m = K.startMatch();
      while (!m.over) { const mo = PS.sim.tick(m); if (mo) PS.sim.resolve(m, mo, PS.sim.auto(mo, K.C.a, K.C.pos, m)); }
      K.finishMatch(m);
    }
    const t = K.table();
    return { summary: K.C.summary, table: t.map(r => `${clubs[r.i].ab} ${r.pts}`).join(', '), top: K.scorers(5) };
  }
  return { run, moments, all, season, bot };
})();
