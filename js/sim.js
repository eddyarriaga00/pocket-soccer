/* PocketSoccer: the simulated match around your moments, the rest of the league's results, and match ratings.
   A match is ninety simulated minutes. The minutes when the ball finds you are picked in advance (how many depends on
   your position and how long you are on the pitch); each one stops the clock and becomes a playable moment. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const D = PS.data;
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const poisson = l => { let k = 0, p = Math.exp(-l), s = p; const u = Math.random(); while (u > s && k < 9) { k++; p *= l / k; s += p; } return k; };

  /* expected goals for a side over 90 minutes, from the two strengths */
  const lam = (a, b, home) => clamp(1.35 * Math.exp((a - b) / 30) * (home ? 1.1 : 0.92), 0.35, 3.0);
  function quick(h, a) { return [poisson(lam(h.ovr, a.ovr, true)), poisson(lam(a.ovr, h.ovr, false))]; }

  /* A squad of names for a club (kept for the season, so the scorers' race has the same names in it) */
  function squad(seed) {
    const r = mulberry(seed), n = [];
    for (let i = 0; i < 16; i++) n.push(D.FIRST[Math.floor(r() * D.FIRST.length)][0] + '. ' + D.LAST[Math.floor(r() * D.LAST.length)]);
    return n;
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* who scores: forwards most often */
  const scorer = sq => sq[pick([9, 9, 9, 10, 10, 11, 11, 7, 8, 6, 5, 4, 3])];

  const MOMENTS = {
    ST: { box: 30, through: 32, counter: 16, wing: 4, build: 4 },
    W: { wing: 42, counter: 20, box: 16, through: 12, build: 6 },
    CM: { build: 48, box: 18, counter: 16, through: 6, wing: 4 }
  };
  function momentType(pos) {
    const r = Math.random();
    if (r < 0.06) return 'fk';
    if (r < 0.085) return 'pen';
    const w = MOMENTS[pos], tot = Object.values(w).reduce((s, v) => s + v, 0);
    let x = rnd(tot);
    for (const [k, v] of Object.entries(w)) { x -= v; if (x <= 0) return k; }
    return 'box';
  }

  /* Plan a match: who is home, when the user is on the pitch, and the minutes of his moments. */
  function plan(o) {
    const { us, them, home, role, pos } = o;
    let on = 0, off = 90;
    if (role === 'bench') { on = Math.random() < 0.75 ? 62 + Math.floor(rnd(20)) : 91; }
    else if (role === 'rotation') { if (Math.random() < 0.5) on = 55 + Math.floor(rnd(15)); else off = 65 + Math.floor(rnd(20)); }
    const mins = Math.max(0, off - on);
    const base = { ST: 4.5, W: 4.5, CM: 4 }[pos] || 4.5;
    const n = mins <= 0 ? 0 : Math.max(1, Math.round(base * mins / 90 + rnd(-0.6, 1.2)));
    const set = new Set();
    let guard = 0;
    while (set.size < n && guard++ < 200) set.add(Math.floor(rnd(Math.max(on, 2), Math.min(off, 89))));
    const moments = [...set].sort((a, c) => a - c).map(minute => ({ minute, type: momentType(pos), done: false }));
    return {
      us, them, home, pos, on, off, minute: 0, score: [0, 0], moments, feed: [], stats: { goals: 0, assists: 0, shots: 0, onT: 0, keyPass: 0, dribbles: 0, lost: 0, offside: 0, xg: 0, moments: 0, played: 0, chances: 0 },
      sq: [o.usSquad, o.themSquad], scorers: [], over: false,
      /* the simulated goals for each side, minus a little for ours since the user's moments make goals too */
      gl: [lam(us.ovr, them.ovr, home) * (mins > 0 ? 0.78 : 1) / 90, lam(them.ovr, us.ovr, !home) / 90]
    };
  }

  const fill = (t, m, side, p) => t.replace('{a}', side ? m.them.name : m.us.name).replace('{d}', side ? m.us.name : m.them.name).replace('{p}', p || '').replace('{g}', m.home ? m.us.ground : m.them.ground);
  function say(m, t, kind) { m.feed.push({ min: m.minute, t, kind: kind || '' }); }

  /* One simulated minute. Returns the moment due this minute, if any (the caller plays it, then calls resolve). */
  function tick(m) {
    if (m.over) return null;
    if (m.minute === 0) say(m, fill(pick(D.LINES.kickoff), m, m.home ? 0 : 1), 'ko');
    m.minute++;
    if (m.minute === m.on && m.on > 0 && m.on <= 90) say(m, `Substitution for ${m.us.name}: on comes ${m.user}.`, 'sub');
    if (m.minute === m.off && m.off < 90) say(m, `${m.user} is substituted.`, 'sub');
    const due = m.moments.find(x => x.minute === m.minute && !x.done);
    if (due) return due;
    for (const s of [0, 1]) {
      if (Math.random() < m.gl[s]) {
        const p = scorer(m.sq[s]);
        m.score[s]++; m.scorers.push({ side: s, name: p, min: m.minute });
        say(m, fill(pick(D.LINES.goal), m, s, p), s ? 'goal-them' : 'goal');
      } else if (Math.random() < m.gl[s] * 2.6) {
        say(m, fill(pick(Math.random() < 0.3 ? D.LINES.save : D.LINES.chance), m, s, scorer(m.sq[s])), 'chance');
      }
    }
    if (Math.random() < 0.05) say(m, fill(pick(D.LINES.build), m, Math.random() < 0.5 ? 0 : 1));
    if (Math.random() < 0.012) say(m, fill(pick(D.LINES.card), m, Math.random() < 0.5 ? 0 : 1, scorer(m.sq[Math.random() < 0.5 ? 0 : 1])), 'card');
    if (m.minute === 45) say(m, `Half time: ${m.us.ab} ${m.score[0]}–${m.score[1]} ${m.them.ab}.`, 'ht');
    if (m.minute >= 90) { m.over = true; say(m, `Full time: ${m.us.ab} ${m.score[0]}–${m.score[1]} ${m.them.ab}.`, 'ft'); }
    return null;
  }

  /* fold a played (or auto-played) moment back into the match */
  function resolve(m, mo, res) {
    mo.done = true; mo.res = res;
    const s = m.stats;
    s.moments++; if (!res.auto) s.played++;
    for (const k of ['goals', 'assists', 'shots', 'onT', 'keyPass', 'dribbles', 'lost', 'offside', 'xg']) s[k] += res[k === 'goals' ? 'goal' : k === 'assists' ? 'assist' : k] || 0;
    if (res.chain) s.chances++;
    const me = m.user;
    if (res.goal) { m.score[0]++; m.scorers.push({ side: 0, name: me, min: m.minute, you: true }); say(m, `GOAL! ${me} scores for ${m.us.name}!`, 'goal you'); }
    else if (res.teamGoal) {
      const p = scorer(m.sq[0]); m.score[0]++; m.scorers.push({ side: 0, name: p, min: m.minute, assist: res.assist });
      say(m, res.assist ? `GOAL! ${p} scores, and ${me} made it!` : `GOAL! ${p} scores for ${m.us.name}.`, 'goal' + (res.assist ? ' you' : ''));
    } else {
      const t = { miss: `${me} shoots… wide.`, lost: `${me} loses the ball.`, offside: `${me} is caught offside.`, out: 'The move breaks down.', time: 'The chance comes to nothing.',
        cleared: 'Cleared by the defence.', foul: `${me} is fouled.` }[res.end] || 'The chance goes.';
      say(m, res.saves && res.end !== 'goal' && res.shots ? `${me} forces a save from the keeper.` : t, 'you');
    }
  }

  /* settle a moment without playing it: an honest coin weighted by the player's ratings and the moment */
  function auto(mo, a, pos, m) {
    const res = { goal: 0, assist: 0, shots: 0, onT: 0, keyPass: 0, dribbles: 0, lost: 0, xg: 0, offside: 0, saves: 0, auto: true, end: 'time' };
    const base = { box: 0.16, through: 0.24, counter: 0.2, wing: 0.08, build: 0.06, fk: 0.07, pen: 0.76 }[mo.type] || 0.14;
    /* a finisher's shooting matters most; a stronger opponent makes everything harder */
    const edge = Math.exp(((m && m.us ? m.us.ovr - m.them.ovr : 0)) / 75);
    const skill = mo.type === 'pen' ? 0.8 + a.sho / 500 : clamp((a.sho - 42) / 50, 0.12, 1.1);
    const g = mo.type === 'pen' ? base * skill : Math.min(0.2, base * skill * edge), as = (mo.type === 'wing' || mo.type === 'build' ? 0.11 : 0.045) * clamp((a.pas - 35) / 50, 0.2, 1.2) * edge;
    const r = Math.random();
    if (r < g) { Object.assign(res, { goal: 1, shots: 1, onT: 1, xg: base, end: 'goal' }); }
    else if (r < g + as) { Object.assign(res, { assist: 1, teamGoal: 1, keyPass: 1, end: 'assist' }); }
    else if (r < g + as + 0.3) { Object.assign(res, { shots: 1, onT: Math.random() < 0.45 ? 1 : 0, xg: base * 0.6, end: 'miss' }); }
    else if (r < g + as + 0.45) Object.assign(res, { lost: 1, end: 'lost' });
    return res;
  }

  /* The match rating, out of ten, starting from 6.0. Returns the number and its reasons for the breakdown. */
  function rating(m) {
    const s = m.stats, why = [];
    let r = 6.0;
    const add = (v, t) => { if (!v) return; r += v; why.push({ v, t }); };
    add(s.goals * 1.15, `${s.goals} goal${s.goals > 1 ? 's' : ''}`);
    add(s.assists * 0.8, `${s.assists} assist${s.assists > 1 ? 's' : ''}`);
    add(Math.max(0, s.onT - s.goals) * 0.2, 'shots on target');
    add(-Math.max(0, s.shots - s.onT) * 0.05, 'shots off target');
    add(s.keyPass * 0.3 - s.assists * 0.3 > 0 ? s.keyPass * 0.3 - s.assists * 0.3 : 0, 'key passes');
    add(s.dribbles * 0.12, 'dribbles past a man');
    add(-s.lost * 0.2, 'times dispossessed');
    add(-s.offside * 0.15, 'offside');
    const missed = s.moments - s.goals - s.assists - Math.max(0, s.onT - s.goals);
    add(-Math.max(0, missed - 2) * 0.08, 'chances that came to nothing');
    const res = m.score[0] > m.score[1] ? 'W' : m.score[0] < m.score[1] ? 'L' : 'D';
    const long = m.off - m.on >= 30;
    add(res === 'W' ? (long ? 0.3 : 0.15) : res === 'L' && long ? -0.25 : 0, res === 'W' ? 'the win' : 'the defeat');
    if (m.off - m.on < 30) r = 6.0 + (r - 6.0) * 0.8;
    return { r: clamp(Math.round(r * 10) / 10, 3, 10), why, res };
  }

  PS.sim = { plan, tick, resolve, auto, rating, quick, squad, lam };
})();
