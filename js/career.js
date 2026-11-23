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

  /* ---------- the world ----------
     Seven leagues play every season, round by round alongside yours (D.LEAGUES; every club in D.CLUBS carries its
     league, lg). A team is named by a ref: a club's index, or 'n:<nation>' for a national team. Around your league
     the calendar (C.cal) puts your country's cup, the Champions Cup (the top two of every league last season), two
     international breaks and, in even summers, a tournament: the World Cup every fourth year, the continental
     championships in between. Knockout draws go to penalties. */
  const T = ref => typeof ref === 'string' ? D.nationTeam(ref.slice(2)) : D.CLUBS[ref];
  const clubsOf = lg => D.CLUBS.map((c, i) => c.lg === lg ? i : -1).filter(i => i >= 0);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
  function fixtures(list) {
    /* the circle method: every club plays every other once, then the same again with home and away swapped */
    const ids = list.slice(), n = ids.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const ro = [];
      for (let i = 0; i < n / 2; i++) { const h = ids[i], a = ids[n - 1 - i]; ro.push(r % 2 ? [a, h] : [h, a]); }
      rounds.push(ro);
      ids.splice(1, 0, ids.pop());
    }
    return rounds.concat(rounds.map(ro => ro.map(([h, a]) => [a, h])));
  }
  const row = i => ({ i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: '' });
  function league(lg) { const ids = clubsOf(lg); return { id: lg, fx: fixtures(ids), round: 0, table: ids.map(row), scorers: {} }; }
  const myLg = () => C.lgs[club().lg];
  /* C.league stays as a name for your league (not saved: it is worked out from your club) */
  const alias = () => Object.defineProperty(C, 'league', { get: () => C.lgs[D.CLUBS[C.club].lg], configurable: true, enumerable: false });
  /* one round of a league, every match simulated except the one your club plays */
  function playRound(Lg, skip) {
    for (const [h, a] of Lg.fx[Lg.round]) {
      if (h === skip || a === skip) continue;
      const [x, y] = PS.sim.quick(T(h), T(a));
      recordResult(Lg, h, a, x, y);
      for (let k = 0; k < x; k++) addScorer(Lg, h, C.squads[h][[9, 9, 10, 11, 7, 8][Math.floor(Math.random() * 6)]]);
      for (let k = 0; k < y; k++) addScorer(Lg, a, C.squads[a][[9, 9, 10, 11, 7, 8][Math.floor(Math.random() * 6)]]);
    }
    Lg.round++;
  }
  /* the other leagues keep pace with yours: after week w of N, each is the same share of the way through */
  function catchUp(w, N) { C.lgs.forEach(Lg => { if (Lg === myLg()) return; const target = Math.min(Lg.fx.length, Math.round(w * Lg.fx.length / N)); while (Lg.round < target) playRound(Lg, -1); }); }

  /* knockouts: the strongest get the byes when the field is not a power of two */
  const STAGE = { 2: 'Final', 4: 'Semi-final', 8: 'Quarter-final', 16: 'Round of 16', 32: 'Round of 32' };
  function ko(name, ids, kind) {
    const seeds = ids.slice().sort((a, b) => T(b).ovr - T(a).ovr);
    let size = 2; while (size < seeds.length) size *= 2;
    const byes = size - seeds.length, pairs = seeds.slice(0, byes).map(t => [t, null]), rest = shuffle(seeds.slice(byes));
    for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);
    return { name, kind, alive: shuffle(pairs).flat(), rounds: [], win: null };
  }
  const koRounds = K => Math.round(Math.log2(K.alive.length)) + K.rounds.length;
  /* play a knockout round; mine is your result when you were in it ({ ref, gf, ga, pens }) */
  function koRound(K, mine) {
    const out = [], res = [];
    for (let i = 0; i < K.alive.length; i += 2) {
      const a = K.alive[i], b = K.alive[i + 1];
      if (a == null || b == null) { out.push(a == null ? b : a); res.push([a, b]); continue; }
      let x, y, p = null;
      if (mine && (a === mine.ref || b === mine.ref)) { [x, y] = a === mine.ref ? [mine.gf, mine.ga] : [mine.ga, mine.gf]; if (x === y) p = mine.pens.won ? mine.ref : a === mine.ref ? b : a; }
      else { [x, y] = PS.sim.quick(T(a), T(b)); if (x === y) p = Math.random() < 0.5 + (T(a).ovr - T(b).ovr) / 60 ? a : b; }
      out.push(p != null ? p : x > y ? a : b); res.push([a, b, x, y, p]);
    }
    K.rounds.push({ st: STAGE[K.alive.length] || 'Round', res }); K.alive = out;
    if (out.length === 1) K.win = out[0];
  }
  const partner = (K, ref) => { const i = K.alive.indexOf(ref); return i < 0 ? undefined : K.alive[i ^ 1]; };

  /* national teams */
  const NAT = () => 'n:' + C.nation;
  const natOvr = () => (D.NATION[C.nation] || [0, 0, 65])[2];
  const called = () => ovr(C.a, C.pos) >= natOvr() - 9;
  const natRole = () => { const d = ovr(C.a, C.pos) - natOvr(); return d >= -2 ? 'starter' : d >= -6 ? 'rotation' : 'bench'; };
  function tournament() {
    const y = C.year + 1; if (y % 2) return null;
    const wc = y % 4 === 2, conf = D.confOf(C.nation);
    const pool = Object.keys(D.NATION).filter(n => n !== C.nation && (wc || D.confOf(n) === conf)).sort((a, b) => D.NATION[b][2] - D.NATION[a][2]);
    let field = shuffle(pool.slice(0, wc ? 14 : 10)).slice(0, 7);
    if (field.length < 7) field = field.concat(shuffle(Object.keys(D.NATION).filter(n => n !== C.nation && !field.includes(n))).slice(0, 7 - field.length));
    return ko(wc ? 'World Cup' : D.CHAMP[conf], [C.nation, ...field].map(n => 'n:' + n), 'tour');
  }
  function calendar() {
    const N = myLg().fx.length, ev = [];
    for (let w = 0; w < N; w++) ev.push({ k: 'lg', w, t: w });
    const R = koRounds(C.cup); for (let j = 0; j < R; j++) ev.push({ k: 'cup', t: N * (j + 1) / (R + 1) - 0.5 });
    const Q = koRounds(C.cl); for (let j = 0; j < Q; j++) ev.push({ k: 'cl', t: N * (j + 0.6) / (Q + 0.4) - 0.3 });
    const others = Object.keys(D.NATION).filter(n => n !== C.nation);
    [1 / 3, 2 / 3].forEach(x => ev.push({ k: 'nat', t: N * x - 0.2, opp: others[Math.floor(Math.random() * others.length)], home: Math.random() < 0.5 }));
    if (C.tour) for (let j = 0; j < 3; j++) ev.push({ k: 'tour', t: N + j });
    return ev.sort((a, b) => a.t - b.t);
  }
  function newSeason() {
    C.squads = D.CLUBS.map((_, i) => PS.sim.squad(C.seed + i * 977 + C.season * 31));
    C.lgs = D.LEAGUES.map(l => league(l.id));
    C.ss = { apps: 0, starts: 0, goals: 0, assists: 0, ratings: [], motm: 0, mins: 0 };
    const lg = club().lg;
    C.cup = ko(D.LEAGUES[lg].cup, clubsOf(lg), 'cup');
    const q = C.qual || D.LEAGUES.flatMap(l => clubsOf(l.id).sort((a, b) => D.CLUBS[b].ovr - D.CLUBS[a].ovr).slice(0, 2));
    C.cl = ko('Champions Cup', q, 'cl');
    C.tour = tournament();
    C.intl = C.intl || { caps: 0, goals: 0, ever: false };
    C.cal = calendar(); C.ci = 0;
  }
  function create(o) {
    const base = { ST: { pac: 62, sho: 60, pas: 48, dri: 56, def: 30, phy: 54 }, W: { pac: 66, sho: 52, pas: 54, dri: 60, def: 32, phy: 46 },
      CM: { pac: 54, sho: 50, pas: 60, dri: 56, def: 48, phy: 52 } }[o.pos];
    const a = {}; for (const k in base) a[k] = clamp(Math.round(base[k] + rnd(-3, 3)), 25, 80);
    C = {
      v: 1, name: o.name.trim() || 'A. Player', nation: o.nation, pos: o.pos, foot: o.foot, skin: o.skin ?? 3, look: o.look || null, num: o.pos === 'ST' ? 9 : o.pos === 'W' ? 11 : 8,
      age: 17, season: 1, year: 2027, club: o.club, a, pot: Math.round(rnd(84, 94)), xp: 150, trust: 34,
      seed: Math.floor(Math.random() * 1e9), wk: 0, totals: { apps: 0, goals: 0, assists: 0 }, history: [], news: [], trophies: [], offers: null, last: null
    };
    alias(); newSeason();
    news(`${C.name} signs a first professional contract with ${club().name}. “A massive day for me and my family.”`);
    save();
    return C;
  }
  const club = (i = C.club) => T(i);
  const squad = ref => typeof ref === 'string' ? PS.sim.squad(hash(ref) + C.season * 31) : C.squads[ref];
  /* your role: the club manager's trust, or for your country how you measure up to its other players */
  function role(f) { if (f && (f.k === 'nat' || f.k === 'tour')) return natRole(); return C.trust >= 62 ? 'starter' : C.trust >= 38 ? 'rotation' : 'bench'; }
  function news(t) { C.news.unshift({ s: C.season, r: C.wk || 0, t }); C.news.length = Math.min(C.news.length, 40); }

  /* is the next calendar event one you play in? */
  function involves(e) {
    if (e.k === 'lg') return true;
    if (e.k === 'cup' || e.k === 'cl') { const K = C[e.k]; return !!K && !K.win && partner(K, C.club) != null; }
    if (e.k === 'nat') return called();
    if (e.k === 'tour') return !!C.tour && !C.tour.win && called() && partner(C.tour, NAT()) != null;
    return false;
  }
  const koName = r => r == null ? 'a bye' : T(r).name;
  /* an event without you: played in the background, with a line in the news when it matters to you */
  function resolve(e) {
    if (e.k === 'cup' || e.k === 'cl' || e.k === 'tour') {
      const K = C[e.k]; if (!K || K.win) return;
      const me = e.k === 'tour' ? NAT() : C.club, was = K.alive.includes(me), bye = was && partner(K, me) == null;
      koRound(K);
      if (bye) news(`${T(me).name} go straight through to the ${STAGE[K.alive.length] || 'next round'} of the ${K.name}.`);
      if (K.win != null) news(e.k === 'tour' ? `${T(K.win).name} win the ${K.name}.` : `${T(K.win).name} win the ${K.name}${e.k === 'cl' ? ` (${D.LEAGUES[T(K.win).lg].country})` : ''}.`);
      else if (e.k === 'tour' && was && !K.alive.includes(me)) news(`${C.nation} are out of the ${K.name}.`);
    } else if (e.k === 'nat' && !C.intl.left) { C.intl.left = true; news(`${C.nation} name their squad: no place for ${C.name} this time.`); }
  }
  /* run the calendar forward to your next match (or to the end of the season) */
  function advance() {
    if (!C.cal) return;
    let moved = false;
    while (C.ci < C.cal.length && !involves(C.cal[C.ci])) { resolve(C.cal[C.ci]); C.ci++; moved = true; }
    if (C.ci >= C.cal.length && !C.summary) { endSeason(); moved = true; }
    if (moved) save();
  }
  function nextFixture() {
    advance();
    if (C.summary || C.ci >= C.cal.length) return null;
    const e = C.cal[C.ci];
    if (e.k === 'lg') {
      const Lg = myLg(), m = Lg.fx[Lg.round].find(([h, a]) => h === C.club || a === C.club), home = m[0] === C.club;
      return { k: 'lg', comp: D.LEAGUES[club().lg].name, stage: `Matchday ${Lg.round + 1} of ${Lg.fx.length}`, home, us: C.club, opp: home ? m[1] : m[0], round: Lg.round };
    }
    if (e.k === 'nat') {
      if (!C.intl.ever) { C.intl.ever = true; news(`CALL-UP: ${C.name} is named in the ${C.nation} squad for the first time.`); }
      return { k: 'nat', comp: 'International friendly', stage: 'International break', home: e.home, us: NAT(), opp: 'n:' + e.opp, round: C.ci };
    }
    const K = C[e.k], me = e.k === 'tour' ? NAT() : C.club, i = K.alive.indexOf(me);
    return { k: e.k, comp: K.name, stage: STAGE[K.alive.length] || 'Round', home: i % 2 === 0, neutral: e.k === 'tour' || K.alive.length === 2, us: me, opp: K.alive[i ^ 1], round: C.ci };
  }
  /* set up the user's next match for the match screen */
  function startMatch() {
    const f = nextFixture(); if (!f) return null;
    const m = PS.sim.plan({ us: club(f.us), them: club(f.opp), home: f.home, role: role(f), pos: C.pos, usSquad: squad(f.us), themSquad: squad(f.opp) });
    m.user = C.name; m.round = f.round; m.oppIdx = f.opp; m.f = f;
    return m;
  }
  function recordResult(Lg, i, j, gi, gj) {
    const a = Lg.table.find(r => r.i === i), b = Lg.table.find(r => r.i === j);
    a.p++; b.p++; a.gf += gi; a.ga += gj; b.gf += gj; b.ga += gi;
    if (gi > gj) { a.w++; b.l++; a.pts += 3; a.form += 'W'; b.form += 'L'; }
    else if (gi < gj) { b.w++; a.l++; b.pts += 3; a.form += 'L'; b.form += 'W'; }
    else { a.d++; b.d++; a.pts++; b.pts++; a.form += 'D'; b.form += 'D'; }
  }
  function addScorer(Lg, ci, name, n = 1) { const k = ci + '|' + name; Lg.scorers[k] = (Lg.scorers[k] || 0) + n; }

  /* after the final whistle: the user's match into the table and his record, the round's other matches simulated */
  /* ---------- the story of each match (PocketBasketball's story(): what this one means for you) ----------
     C.mem remembers what the next match needs: appearances, starts, the role last time, games for this club, the
     club you left, a big night, a run of goals, a drought. Shown on the match card, said by the booth, told in the news. */
  /* neighbours: each club has one local rival in its league (the clubs listed next to each other) */
  const derbyOf = i => { if (typeof i !== 'number' || !D.CLUBS[i]) return -1; const l = clubsOf(D.CLUBS[i].lg), k = l.indexOf(i); return l[k ^ 1] ?? -1; };
  function mem() { return C.mem || (C.mem = { apps: 0, starts: 0, lastRole: null, clubApps: 0, prevClub: null, facedOld: false, high: false, run: 0, dry: 0 }); }
  function story(f) {
    f = f || nextFixture(); if (!f) return null;
    const M = mem(), r = role(), o = club(f.opp), t = table(), myPos = t.findIndex(x => x.i === C.club) + 1, oPos = t.findIndex(x => x.i === f.opp) + 1;
    const S = (k, title, sub) => ({ k, title, sub });
    /* away from the league: your country, the finals, the nights in the Champions Cup */
    if (f.k === 'tour') return S('tour', `${f.comp}: ${f.stage.toLowerCase()}`, f.stage === 'Final' ? `The final. All of ${C.nation} is watching` : `${C.nation} v ${o.name}`);
    if (f.k === 'nat') return !C.intl.caps ? S('cap', 'Your first cap', `Your debut for ${C.nation}, against ${o.name}`) : S('intl', 'International duty', `${C.nation} v ${o.name}`);
    if ((f.k === 'cup' || f.k === 'cl') && f.stage === 'Final') return S('final', `${f.comp} final`, `${club().name} v ${o.name}: one game for the trophy`);
    if (f.k === 'cl') return S('europe', 'Champions Cup night', `${f.stage} against ${o.name} of ${D.LEAGUES[o.lg].country}`);
    if (f.k === 'cup' && f.stage === 'Semi-final') return S('semi', `${f.comp} semi-final`, 'Win and you are in the final');
    const past = (C.results || []).filter(x => x.s === C.season), meet = past.filter(x => x.opp === f.opp).pop();
    const streak = (C.streak || 0);
    if (!M.apps) return r === 'starter' ? S('debut', 'Your debut', 'Your first game as a professional, and you start') : S('debut', 'Your debut', 'On the bench: be ready when your number is called');
    if (M.prevClub != null && !M.clubApps) return S('newclub', 'New club', `Your first game for ${club().name}`);
    if (f.k === 'cup' && !M.cupT) return S('cup', f.comp, `${f.stage}: lose and you are out`);
    if (M.prevClub === f.opp && !M.facedOld) return S('oldclub', 'Your old club', `First time against ${o.name} since you left`);
    if (derbyOf(C.club) === f.opp) return S('derby', 'Derby day', `${club().name} v ${o.name}: the one everybody wants to win`);
    if (r === 'starter' && !M.starts) return S('firststart', 'Your first start', 'The manager puts you in the starting eleven for the first time');
    if (r !== 'starter' && M.lastRole === 'starter') return S('dropped', 'Dropped', 'You lost your place: go and win it back');
    if (r === 'starter' && M.lastRole && M.lastRole !== 'starter') return S('backin', 'Back in the side', 'You start again today');
    if (f.k === 'lg' && f.round === 0 && C.season > 1) return S('opener', 'Opening day', `Season ${C.season} begins`);
    if (M.high) return S('afterhigh', 'After a big night', 'Everybody saw the last one: do it again');
    if (M.run >= 3) return S('run', 'On a scoring run', `Goals in ${M.run} straight games`);
    if (M.dry >= 5 && C.pos === 'ST') return S('drought', 'The drought', `${M.dry} games without a goal`);
    if (f.k === 'lg' && myPos <= 3 && oPos > 0 && oPos <= 3) return S('top', 'Top of the table', `${K_ord(myPos)} v ${K_ord(oPos)}: a big one`);
    if (meet && meet.us < meet.them) return S('rematch', 'Rematch', `${o.name} beat you ${meet.them}-${meet.us} earlier this season`);
    if (streak >= 4) return S('wstreak', 'Winning streak', `${streak} wins in a row for ${club().name}`);
    if (streak <= -4) return S('lstreak', 'Losing streak', `${-streak} defeats in a row: somebody has to stop it`);
    return null;
  }
  const K_ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  /* how the billed story went, for the news */
  function storyNews(st, last) {
    if (!st) return null;
    const n = C.name.split(' ').pop(), g = last.stats.goals, w = last.score[0] > last.score[1] || (last.pens && last.pens.won), line = g ? `${g} goal${g > 1 ? 's' : ''}` : last.rating ? `a ${last.rating.r.toFixed(1)} rating` : 'no minutes', o = club(last.opp).name, cp = last.comp;
    return ({ debut: `${n}'s debut: ${line} against ${o}.`, newclub: `${n}'s first game for ${club().name}: ${line}.`, oldclub: w ? `${n} beats his old club ${o}: ${line}.` : `${n}'s old club ${o} get the better of him.`,
      derby: w ? `Derby day belongs to ${club().name}${g ? `, and ${n} scores` : ''}.` : `${o} take the derby.`, firststart: `A first start for ${n}: ${line}.`, dropped: g ? `Dropped, ${n} answers: ${line}.` : `${n} off the bench after losing his place.`,
      backin: `${n} back in the starting eleven: ${line}.`, opener: `Opening day: ${club().name} ${last.score[0]}-${last.score[1]} ${o}.`, afterhigh: g ? `${n} follows the big night with ${line}.` : `${n} comes back to earth.`,
      run: g ? `${n}'s scoring run goes on.` : `${n}'s scoring run ends.`, drought: g ? `Drought over: ${n} scores again.` : `${n}'s drought goes on.`, top: w ? `${club().name} win the top-of-the-table clash.` : `${o} win the big one at the top.`,
      tour: w ? `${C.nation} through${g ? `, and ${n} scores` : ''}: ${line}.` : `${C.nation} go out of the ${cp}.`, cap: `A first cap for ${n}: ${line} against ${o}.`, intl: `${C.nation} ${w ? 'beat' : last.score[0] === last.score[1] ? 'draw with' : 'lose to'} ${o}${g ? `; ${n} scores` : ''}.`,
      final: w ? `${club().name} win the ${cp}${g ? `, and ${n} scores in the final` : ''}!` : `Heartbreak for ${club().name} in the ${cp} final.`, europe: w ? `A big European night: ${club().name} beat ${o}.` : `${o} knock ${club().name} out of the Champions Cup.`,
      semi: w ? `${club().name} are in the ${cp} final.` : `${club().name} fall in the ${cp} semi-final.`, cup: w ? `${club().name} through in the ${cp}.` : `${club().name} knocked out of the ${cp} by ${o}.`,
      rematch: w ? `Revenge for ${club().name} over ${o}.` : `${o} do it again.`, wstreak: w ? `${club().name} keep winning.` : `${club().name}'s winning run ends against ${o}.`, lstreak: w ? `${club().name} end the losing run.` : `The losing run goes on.` })[st.k] || null;
  }
  function remember(m, last) {
    const M = mem(), s = last.stats, played = !!last.rating;
    if (played) { M.apps++; M.clubApps++; if (m.on === 0) M.starts++; }
    M.lastRole = m.on === 0 ? 'starter' : 'bench';
    if (M.prevClub === m.oppIdx) M.facedOld = true;
    if (m.f && m.f.k === 'cup') M.cupT = true;
    M.high = played && (last.rating.r >= 8.5 || s.goals >= 3);
    M.run = played && s.goals ? M.run + 1 : played ? 0 : M.run;
    M.dry = played && !s.goals ? M.dry + 1 : played ? 0 : M.dry;
    const w = last.score[0] > last.score[1], l = last.score[0] < last.score[1];
    C.streak = w ? Math.max(0, C.streak || 0) + 1 : l ? Math.min(0, C.streak || 0) - 1 : 0;
    (C.results = C.results || []).push({ s: C.season, opp: m.oppIdx, us: last.score[0], them: last.score[1] }); C.results = C.results.slice(-60);
  }
  /* a shoot-out for a knockout draw: you take one, so a goal in the match helps your side's nerve a little */
  function shootout(m, f) {
    const won = Math.random() < 0.5 + (T(f.us).ovr - T(f.opp).ovr) / 60 + (m.stats.goals ? 0.05 : 0);
    const lose = 2 + Math.floor(Math.random() * 3), winS = Math.min(5, lose + 1 + Math.floor(Math.random() * 2));
    return { won, us: won ? winS : lose, them: won ? lose : winS };
  }
  function finishMatch(m) {
    const f = m.f || nextFixture(); if (!f) return null;
    const club_ = f.k === 'lg' || f.k === 'cup' || f.k === 'cl';
    const st0 = story(f);
    const rt = m.rating || PS.sim.rating(m), s = m.stats;
    let pens = null;
    if (f.k === 'lg') {
      const Lg = myLg(), [hi, ai] = f.home ? [C.club, f.opp] : [f.opp, C.club], [hg, ag] = f.home ? m.score : [m.score[1], m.score[0]];
      recordResult(Lg, hi, ai, hg, ag);
      for (const g of m.scorers) addScorer(Lg, g.side ? f.opp : C.club, g.you ? '★ ' + C.name : g.name);
      playRound(Lg, C.club);
      catchUp(Lg.round, Lg.fx.length);
    } else if (f.k !== 'nat') {
      const K = C[f.k];
      if (m.score[0] === m.score[1]) pens = shootout(m, f);
      koRound(K, { ref: f.us, gf: m.score[0], ga: m.score[1], pens: pens || {} });
    }
    const played = m.off > m.on && m.on <= 90;
    const mins = played ? m.off - m.on : 0;
    let xp = 0, dTrust = 0;
    if (played) {
      if (club_) {
        C.ss.apps++; if (m.on === 0) C.ss.starts++;
        C.ss.goals += s.goals; C.ss.assists += s.assists; C.ss.ratings.push(rt.r); C.ss.mins += mins;
        C.totals.apps++; C.totals.goals += s.goals; C.totals.assists += s.assists;
      } else { C.intl.caps++; C.intl.goals += s.goals; }
      /* XP: the rating, what you did, and a little for every minute on the pitch */
      xp = Math.round(Math.max(0, rt.r - 5) * 45 + s.goals * 40 + s.assists * 25 + (s.tackles || 0) * 5 + mins * 0.5 + (rt.res === 'W' ? 20 : 0));
      if (!club_ || f.stage === 'Final') xp = Math.round(xp * 1.25);   // the big stages teach the most
      /* trust: judged against what a player with those minutes could be expected to do, for the role he was given */
      const expect = { bench: 5.9, rotation: 6.25, starter: 6.55 }[role()];
      dTrust = (rt.r - expect) * 10 * (0.5 + 0.5 * Math.min(1, mins / 60));
      if (s.goals >= 2) dTrust += 4;
    } else { xp = 25; }   // training all week still counts for something
    /* and he sees you in training: a player better than the squad around him is pushing for a place */
    dTrust += clamp((ovr(C.a, C.pos) - club().ovr) / 3, -2, 3);
    dTrust = club_ ? Math.round(dTrust) : 0;   // your club manager does not judge you on international duty
    if (rt.r >= 8.3 && played) { if (club_) C.ss.motm++; xp += 30; }
    C.xp += xp;
    C.trust = clamp(C.trust + dTrust, 5, 100);
    const before = role(), us = club(f.us), them = club(f.opp);
    C.last = { k: f.k, comp: f.comp, stage: f.stage, us: f.us, opp: f.opp, home: f.home, s: C.season, score: m.score.slice(), pens, rating: played ? rt : null, xp, dTrust, mins, stats: { ...s }, round: f.round };
    const res = m.score[0] > m.score[1] || (pens && pens.won) ? 'beat' : m.score[0] < m.score[1] || pens ? 'lose to' : 'draw with';
    if (played && s.goals >= 3) news(`HAT-TRICK! ${C.name} takes the match ball home after ${us.ab} ${m.score[0]}–${m.score[1]} ${them.ab}${club_ ? '' : ` for ${C.nation}`}.`);
    else if (played && s.goals) news(`${C.name} on the scoresheet as ${us.name} ${res} ${them.name}${f.k === 'lg' ? '' : ` (${f.comp})`}.`);
    if (pens) news(`${us.name} ${pens.won ? 'win' : 'lose'} ${Math.max(pens.us, pens.them)}–${Math.min(pens.us, pens.them)} on penalties against ${them.name} in the ${f.comp}.`);
    if (f.k !== 'lg' && f.k !== 'nat') { const K = C[f.k]; if (K.win === f.us) { const a = f.k === 'tour' ? `${K.name} winner with ${C.nation}` : `${K.name} winner with ${us.name}`; C.trophies.push({ s: C.season, y: C.year, a }); news(`🏆 ${us.name} WIN THE ${K.name.toUpperCase()}!`); } }
    C.ci++; C.wk = (C.wk || 0) + 1;
    const after = role();
    if (after !== before) news(after === 'starter' ? `The manager: “${C.name.split(' ').pop()} has earned a place in my first eleven.”` :
      before === 'starter' ? `${C.name} drops out of the starting line-up.` : `${C.name} is ${after === 'rotation' ? 'pushing for a start' : 'out of favour'}.`);
    if (club_) remember(Object.assign({}, m, { oppIdx: f.opp }), C.last);
    { const sn = storyNews(st0, C.last); if (sn) news(sn); C.last.story = st0; }
    advance();
    save();
    return C.last;
  }

  function table(lg) {
    return (lg == null ? myLg() : C.lgs[lg]).table.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.i - b.i);
  }
  function scorers(n = 10, lg) {
    return Object.entries((lg == null ? myLg() : C.lgs[lg]).scorers).map(([k, g]) => { const [ci, name] = k.split('|'); return { ci: +ci, name, g }; })
      .sort((a, b) => b.g - a.g).slice(0, n);
  }

  function endSeason() {
    catchUp(1, 1);   // every league to its last round
    const t = table(), pos = t.findIndex(r => r.i === C.club) + 1, ss = C.ss;
    const avg = ss.ratings.length ? ss.ratings.reduce((s, v) => s + v, 0) / ss.ratings.length : 0;
    const top = scorers(1)[0];
    const awards = [];
    if (pos === 1) awards.push(`${D.LEAGUES[club().lg].name} champions with ${club().name}`);
    if (top && top.name.startsWith('★')) awards.push('Golden Boot');
    if (avg >= 7.4 && ss.apps >= 15) awards.push('Player of the Season');
    else if (avg >= 7.0 && ss.apps >= 12 && C.age <= 21) awards.push('Young Player of the Season');
    C.trophies.push(...awards.map(a => ({ s: C.season, y: C.year, a })));
    C.history.push({ s: C.season, y: C.year, club: C.club, lg: club().lg, caps: C.intl ? C.intl.caps : 0, age: C.age, apps: ss.apps, goals: ss.goals, assists: ss.assists, avg: Math.round(avg * 100) / 100, pos, ovr: ovr(C.a, C.pos), awards });
    /* the cups won during the season go in the review with the rest */
    awards.push(...C.trophies.filter(t => t.s === C.season && /winner/.test(t.a)).map(t => t.a));
    C.summary = { pos, avg, awards, ss: { ...ss } };
    /* around the world: every champion, and the top two of each league go into next season's Champions Cup */
    const champs = C.lgs.map(Lg => table(Lg.id)[0].i);
    C.qual = C.lgs.flatMap(Lg => table(Lg.id).slice(0, 2).map(r => r.i));
    news(`Around the world: ${champs.filter(i => i !== C.club).map(i => `${D.CLUBS[i].name} (${D.LEAGUES[D.CLUBS[i].lg].ab})`).join(', ')} are champions.`);
    if (C.qual.includes(C.club)) news(`${club().name} qualify for the Champions Cup.`);
    /* transfer interest: better clubs come for a player who has outgrown his own */
    const me = ovr(C.a, C.pos), offers = [];
    D.CLUBS.forEach((c, i) => {
      if (i === C.club) return;
      if (c.ovr > club().ovr && c.ovr <= me + 14 + (C.social ? Math.floor(C.social.hype / 20) : 0) && avg >= 6.5 && Math.random() < 0.55 + (avg - 6.6) * 0.5 + (C.social ? C.social.hype / 250 : 0)) offers.push({ i, wage: Math.round(c.ovr * 180 + me * 120) });
    });
    C.offers = offers.sort((a, b) => D.CLUBS[b.i].ovr - D.CLUBS[a.i].ovr).slice(0, 3);
    news(`Season ${C.season} over: ${club().name} finish ${ord(pos)}. ${C.name}: ${ss.apps} apps, ${ss.goals} goals, ${ss.assists} assists, average ${avg.toFixed(2)}.`);
  }
  function nextSeason(moveTo) {
    if (moveTo != null && moveTo !== C.club) { news(`TRANSFER: ${C.name} completes a move from ${club().name} to ${club(moveTo).name}.`); mem().prevClub = C.club; mem().clubApps = 0; mem().facedOld = false; C.club = moveTo; C.trust = 40; }
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
    C.offers = null; C.summary = null; if (C.intl) C.intl.left = false;
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

  function save() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { /* private mode: the career lives for this visit */ } if (PS.account) PS.account.saved(); }
  /* a save from before the world (one league, no calendar): its league becomes the Premier Division, the other
     leagues start at the same point of their season, and the cups begin next season */
  function migrate() {
    const old = C.league; delete C.league;
    old.id = 0;
    C.lgs = D.LEAGUES.map(l => l.id === 0 ? old : league(l.id));
    alias();
    C.squads = D.CLUBS.map((_, i) => (C.squads && C.squads[i]) || PS.sim.squad(C.seed + i * 977 + C.season * 31));
    catchUp(old.round, old.fx.length);
    C.cup = C.cl = C.tour = null; C.intl = { caps: 0, goals: 0, ever: false };
    C.cal = old.fx.map((_, w) => ({ k: 'lg', w, t: w })); C.ci = Math.min(old.round, old.fx.length); C.wk = old.round;
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.v === 1 && (s.league || s.lgs) && s.a) {
        C = s;
        if (Array.isArray(C.clubOvr)) C.clubOvr.forEach((v, i) => { if (D.CLUBS[i]) D.CLUBS[i].ovr = v; });
        if (!C.lgs) migrate(); else alias();
      }
    } catch (e) { C = null; }
    return C;
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ } C = null; }

  PS.career = { story, derbyOf, team: T, squad, clubsOf, involves, create, load, save, wipe, get C() { return C; }, ovr, cost: (v, pot) => cost(v, pot, C ? C.age : 20), cap: () => cap(), club, role, nextFixture, startMatch, finishMatch, table, scorers, nextSeason, upgrade, retired, ord };
})();
