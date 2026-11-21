/* PocketSoccer: My Career, the main mode. One player from a 17-year-old debut to retirement.
   This file is the model (the save, the season, progression); ui.js draws it.
   Design notes from the research (docs/RESEARCH.md):
   - Manager trust decides minutes, and it only moves on what you do: no drain over breaks, and a sub's rating is
     judged on the minutes he had (the two loudest complaints about the big console career mode).
   - Growth follows the real age curve: quick to about 24, flat to about 29, falling after 31.
   - Every rating has a visible breakdown, so a 6.4 is never a mystery. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const D = PS.data;
  const KEY = 'pocketsoccer.career.v1';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

  let C = null;

  const ovr = (a, pos) => Math.round(Object.entries(D.POS[pos].w).reduce((s, [k, w]) => s + a[k] * w, 0));
  /* the cost in XP of the next point in an attribute: dearer as it rises, dearer still near the player's ceiling */
  const cost = (v, pot, age = 20) => Math.round((60 + Math.max(0, v - 40) * 9 + Math.max(0, v - pot + 8) * 70) * (age >= 31 ? 1.8 : 1));

  function fixtures(n) {
    /* the circle method: every club plays every other once, then the same again with home and away swapped */
    const ids = [...Array(n).keys()], rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const ro = [];
      for (let i = 0; i < n / 2; i++) { const h = ids[i], a = ids[n - 1 - i]; ro.push(r % 2 ? [a, h] : [h, a]); }
      rounds.push(ro);
      ids.splice(1, 0, ids.pop());
    }
    return rounds.concat(rounds.map(ro => ro.map(([h, a]) => [a, h])));
  }
  function newSeason() {
    const n = D.CLUBS.length;
    C.league = {
      fx: fixtures(n), round: 0,
      table: D.CLUBS.map((_, i) => ({ i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: '' })),
      scorers: {}
    };
    C.ss = { apps: 0, starts: 0, goals: 0, assists: 0, ratings: [], motm: 0, mins: 0 };
    C.squads = D.CLUBS.map((_, i) => PS.sim.squad(C.seed + i * 977 + C.season * 31));
  }
  function create(o) {
    const base = { ST: { pac: 62, sho: 60, pas: 48, dri: 56, def: 30, phy: 54 }, W: { pac: 66, sho: 52, pas: 54, dri: 60, def: 32, phy: 46 },
      CM: { pac: 54, sho: 50, pas: 60, dri: 56, def: 48, phy: 52 } }[o.pos];
    const a = {}; for (const k in base) a[k] = clamp(Math.round(base[k] + rnd(-3, 3)), 25, 80);
    C = {
      v: 1, name: o.name.trim() || 'A. Player', nation: o.nation, pos: o.pos, foot: o.foot, skin: o.skin ?? 3, look: o.look || null, num: o.pos === 'ST' ? 9 : o.pos === 'W' ? 11 : 8,
      age: 17, season: 1, year: 2027, club: o.club, a, pot: Math.round(rnd(84, 94)), xp: 150, trust: 34,
      seed: Math.floor(Math.random() * 1e9), totals: { apps: 0, goals: 0, assists: 0 }, history: [], news: [], trophies: [], offers: null, last: null
    };
    newSeason();
    news(`${C.name} signs a first professional contract with ${club().name}. “A massive day for me and my family.”`);
    save();
    return C;
  }
  const club = (i = C.club) => D.CLUBS[i];
  function role() { return C.trust >= 62 ? 'starter' : C.trust >= 38 ? 'rotation' : 'bench'; }
  function news(t) { C.news.unshift({ s: C.season, r: C.league ? C.league.round : 0, t }); C.news.length = Math.min(C.news.length, 40); }

  function nextFixture() {
    const L = C.league; if (L.round >= L.fx.length) return null;
    const m = L.fx[L.round].find(([h, a]) => h === C.club || a === C.club);
    const home = m[0] === C.club;
    return { home, opp: home ? m[1] : m[0], round: L.round };
  }
  /* set up the user's next match for the match screen */
  function startMatch() {
    const f = nextFixture(); if (!f) return null;
    const us = club(), them = club(f.opp);
    const m = PS.sim.plan({ us, them, home: f.home, role: role(), pos: C.pos, usSquad: C.squads[C.club], themSquad: C.squads[f.opp] });
    m.user = C.name; m.round = f.round; m.oppIdx = f.opp;
    return m;
  }
  function recordResult(i, j, gi, gj) {
    const t = C.league.table, a = t[i], b = t[j];
    a.p++; b.p++; a.gf += gi; a.ga += gj; b.gf += gj; b.ga += gi;
    if (gi > gj) { a.w++; b.l++; a.pts += 3; a.form += 'W'; b.form += 'L'; }
    else if (gi < gj) { b.w++; a.l++; b.pts += 3; a.form += 'L'; b.form += 'W'; }
    else { a.d++; b.d++; a.pts++; b.pts++; a.form += 'D'; b.form += 'D'; }
  }
  function addScorer(ci, name, n = 1) { const k = ci + '|' + name; C.league.scorers[k] = (C.league.scorers[k] || 0) + n; }

  /* after the final whistle: the user's match into the table and his record, the round's other matches simulated */
  function finishMatch(m) {
    const L = C.league, rt = m.rating || PS.sim.rating(m), s = m.stats;
    const [hi, ai] = m.home ? [C.club, m.oppIdx] : [m.oppIdx, C.club];
    const [hg, ag] = m.home ? m.score : [m.score[1], m.score[0]];
    recordResult(hi, ai, hg, ag);
    for (const g of m.scorers) addScorer(g.side ? m.oppIdx : C.club, g.you ? '★ ' + C.name : g.name);
    for (const [h, a] of L.fx[L.round]) {
      if (h === C.club || a === C.club) continue;
      const [x, y] = PS.sim.quick(club(h), club(a));
      recordResult(h, a, x, y);
      for (let k = 0; k < x; k++) addScorer(h, C.squads[h][[9, 9, 10, 11, 7, 8][Math.floor(Math.random() * 6)]]);
      for (let k = 0; k < y; k++) addScorer(a, C.squads[a][[9, 9, 10, 11, 7, 8][Math.floor(Math.random() * 6)]]);
    }
    const played = m.off > m.on && m.on <= 90;
    const mins = played ? m.off - m.on : 0;
    let xp = 0, dTrust = 0;
    if (played) {
      C.ss.apps++; if (m.on === 0) C.ss.starts++;
      C.ss.goals += s.goals; C.ss.assists += s.assists; C.ss.ratings.push(rt.r); C.ss.mins += mins;
      C.totals.apps++; C.totals.goals += s.goals; C.totals.assists += s.assists;
      /* XP: the rating, what you did, and a little for every minute on the pitch */
      xp = Math.round(Math.max(0, rt.r - 5) * 45 + s.goals * 40 + s.assists * 25 + (s.tackles || 0) * 5 + mins * 0.5 + (rt.res === 'W' ? 20 : 0));
      /* trust: judged against what a player with those minutes could be expected to do */
      /* what the manager expects depends on the role he gave you */
      const expect = { bench: 5.9, rotation: 6.25, starter: 6.55 }[role()];
      dTrust = (rt.r - expect) * 10 * (0.5 + 0.5 * Math.min(1, mins / 60));
      if (s.goals >= 2) dTrust += 4;
    } else { xp = 25; }   // training all week still counts for something
    /* and he sees you in training: a player better than the squad around him is pushing for a place */
    dTrust += clamp((ovr(C.a, C.pos) - club().ovr) / 3, -2, 3);
    dTrust = Math.round(dTrust);
    if (rt.r >= 8.3 && played) { C.ss.motm++; xp += 30; }
    C.xp += xp;
    C.trust = clamp(C.trust + dTrust, 5, 100);
    const before = role();
    C.last = { opp: m.oppIdx, home: m.home, score: m.score.slice(), rating: played ? rt : null, xp, dTrust, mins, stats: { ...s }, round: L.round };
    if (played && s.goals >= 3) news(`HAT-TRICK! ${C.name} takes the match ball home after ${club().ab} ${m.score[0]}–${m.score[1]} ${club(m.oppIdx).ab}.`);
    else if (played && s.goals) news(`${C.name} on the scoresheet as ${club().name} ${rt.res === 'W' ? 'beat' : rt.res === 'D' ? 'draw with' : 'lose to'} ${club(m.oppIdx).name}.`);
    L.round++;
    const after = role();
    if (after !== before) news(after === 'starter' ? `The manager: “${C.name.split(' ').pop()} has earned a place in my first eleven.”` :
      before === 'starter' ? `${C.name} drops out of the starting line-up.` : `${C.name} is ${after === 'rotation' ? 'pushing for a start' : 'out of favour'}.`);
    if (L.round >= L.fx.length) endSeason();
    save();
    return C.last;
  }

  function table() {
    return C.league.table.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.i - b.i);
  }
  function scorers(n = 10) {
    return Object.entries(C.league.scorers).map(([k, g]) => { const [ci, name] = k.split('|'); return { ci: +ci, name, g }; })
      .sort((a, b) => b.g - a.g).slice(0, n);
  }

  function endSeason() {
    const t = table(), pos = t.findIndex(r => r.i === C.club) + 1, ss = C.ss;
    const avg = ss.ratings.length ? ss.ratings.reduce((s, v) => s + v, 0) / ss.ratings.length : 0;
    const top = scorers(1)[0];
    const awards = [];
    if (pos === 1) awards.push(`League champions with ${club().name}`);
    if (top && top.name.startsWith('★')) awards.push('Golden Boot');
    if (avg >= 7.4 && ss.apps >= 15) awards.push('Player of the Season');
    else if (avg >= 7.0 && ss.apps >= 12 && C.age <= 21) awards.push('Young Player of the Season');
    C.trophies.push(...awards.map(a => ({ s: C.season, y: C.year, a })));
    C.history.push({ s: C.season, y: C.year, club: C.club, age: C.age, apps: ss.apps, goals: ss.goals, assists: ss.assists, avg: Math.round(avg * 100) / 100, pos, ovr: ovr(C.a, C.pos), awards });
    C.summary = { pos, avg, awards, ss: { ...ss } };
    /* transfer interest: better clubs come for a player who has outgrown his own */
    const me = ovr(C.a, C.pos), offers = [];
    D.CLUBS.forEach((c, i) => {
      if (i === C.club) return;
      if (c.ovr > club().ovr && c.ovr <= me + 14 && avg >= 6.6 && Math.random() < 0.55 + (avg - 6.6) * 0.5) offers.push({ i, wage: Math.round(c.ovr * 180 + me * 120) });
    });
    C.offers = offers.sort((a, b) => D.CLUBS[b.i].ovr - D.CLUBS[a.i].ovr).slice(0, 3);
    news(`Season ${C.season} over: ${club().name} finish ${ord(pos)}. ${C.name}: ${ss.apps} apps, ${ss.goals} goals, ${ss.assists} assists, average ${avg.toFixed(2)}.`);
  }
  function nextSeason(moveTo) {
    if (moveTo != null && moveTo !== C.club) { news(`TRANSFER: ${C.name} completes a move from ${club().name} to ${club(moveTo).name}.`); C.club = moveTo; C.trust = 40; }
    C.age++; C.season++; C.year++;
    /* the age curve: young players grow on their own a little, old ones lose pace first */
    for (const k in C.a) {
      let d = 0;
      if (C.age <= 23) d = rnd(0, 2.2);
      else if (C.age >= 31) d = -rnd(0.5, k === 'pac' ? 3.5 : k === 'phy' ? 2.5 : 1.4) * (C.age >= 34 ? 1.8 : 1);
      C.a[k] = clamp(Math.round(C.a[k] + d), 20, 99);
    }
    /* the clubs move a little too */
    D.CLUBS.forEach(c => { c.ovr = clamp(Math.round(c.ovr + rnd(-2, 2)), 50, 90); });
    C.clubOvr = D.CLUBS.map(c => c.ovr);
    C.offers = null; C.summary = null;
    newSeason();
    save();
  }
  const retired = () => C && C.age >= 38;
  /* nobody trains past his ceiling by much: three points over it is the hard limit */
  const cap = () => Math.min(99, C.pot + 3);
  function upgrade(k) {
    const c = cost(C.a[k], C.pot, C.age);
    if (C.xp < c || C.a[k] >= cap()) return false;
    C.xp -= c; C.a[k]++; save(); return true;
  }
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  function save() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { /* private mode: the career lives for this visit */ } }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1 && s.league && s.a) { C = s; if (Array.isArray(C.clubOvr)) C.clubOvr.forEach((v, i) => { if (D.CLUBS[i]) D.CLUBS[i].ovr = v; }); } } catch (e) { C = null; }
    return C;
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ } C = null; }

  PS.career = { create, load, save, wipe, get C() { return C; }, ovr, cost: (v, pot) => cost(v, pot, C ? C.age : 20), cap: () => cap(), club, role, nextFixture, startMatch, finishMatch, table, scorers, nextSeason, upgrade, retired, ord };
})();
