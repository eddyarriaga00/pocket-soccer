/* PocketSoccer: the career's social media and press. PocketBasketball's social() (followers, hype, one post a match,
   callouts, messages, brand partners) and PocketFootball's media.js (the internet's reaction after every game, louder
   the better you played, lines dealt like cards so nobody says the same thing twice in a week; the podium) written
   for soccer. Every handle, person, brand and outlet is invented.

   What it changes (the fix for the complaint about FC 25's feed, "popularity gains you nothing"):
     hype      a little manager trust each match (above 60 up, under 20 down); bigger clubs come in for you sooner
     followers brand deals (XP to sign and a little every match while the deal lasts)
     callouts  backed up: XP, followers, hype; eaten: trust and hype lost, and the receipts posted
     press     humble answers please the manager, brash ones the internet
   State lives in the career save (C.social, C.fans, C.feed); PS.social draws the page and settles each match. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const D = PS.data;
  const any = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
  const fill = (s, x) => s.replace(/\{(\w+)\}/g, (_, k) => (x[k] == null ? '' : x[k]));
  const K = () => PS.career, C = () => PS.career.C;

  function S() {
    const c = C();
    if (c.fans == null) c.fans = 600 + Math.floor(Math.random() * 400);
    if (!c.feed) c.feed = [];
    if (!c.social) c.social = { hype: 12, posted: -1, callout: null, backed: 0, ate: 0, quotes: [], hist: [c.fans], dms: [], dmKey: -1, deals: [], offer: null, hot: 0 };
    return c.social;
  }
  const gameNo = () => C().totals.apps + C().league.round * 0.001;   // advances every matchday, played or not
  const mdKey = () => C().season * 100 + C().league.round;
  const handle = () => '@' + C().name.toLowerCase().replace(/[^a-z]/g, '') + C().num;
  const clubHandle = cl => '@' + cl.name.toLowerCase().replace(/[^a-z]/g, '');
  const lastName = n => String(n).trim().split(/\s+/).pop();

  /* ---------- who posts ---------- */
  const FANS = ['terrace_tom', 'ultra_ines', 'matchday_mo', 'season_ticket_sal', 'away_end_ade', 'kitbag_kim', 'scarf_sami', 'northstand_nia', 'pie_and_bovril', 'groundhopper_gus', 'yellow_wall_yan', 'chant_leader_cal'];
  const PUNDITS = [['Gary Holloway', 'garyholloway_tv', 'pundit, Matchnight'], ['The Tactics Room', 'tacticsroom', 'film breakdowns'], ['Ines Carvalho', 'ines_on_tape', 'analyst, Pitchside'], ['xG Philosopher', 'xg_philosopher', 'numbers']];
  const PRESS = [['The Touchline Times', 'touchline_times'], ['Pocket Football Wire', 'pfw_news'], ['Matchday Ledger', 'matchday_ledger']];
  const INSIDER = ['Marco Valente', 'marcovalente', 'transfer news · "here it comes"'];
  const BRANDS = [['Striker Energy', 'sports drinks', '#1f8a5b', 'Fuel for ninety minutes.'], ['Volt Mobile', 'phones', '#6b3fd4', 'Never miss a moment.'], ['Northfield Motors', 'cars', '#8a3b3b', 'Built for the long season.'],
    ['Crisp Co.', 'snacks', '#b4531a', 'Matchday tastes better.'], ['Ridgeline Watches', 'watches', '#0f766e', 'Every second counts.'], ['Ironhouse Gym', 'gyms', '#475569', 'Earned, not given.'], ['Bluepeak Insurance', 'insurance', '#1d4ed8', 'Cover you can count on.']];

  /* lines are dealt like cards: within one matchday nobody posts a line somebody else already posted */
  let dealt = new Set();
  const deal = arr => { const f = arr.filter(s => !dealt.has(s)); if (!f.length) return null; const s = any(f); dealt.add(s); return s; };

  const L = {
    fanGreat: ['{N} was on another level tonight. {SL}.', 'Somebody frame {L}’s performance. {SL}.', '{L} is the best thing to happen to {C} in years.', 'Get {L} a new contract. Now.', 'I have watched {C} for twenty years. {L} is special.', '{SL}. Say his name. {LU}.'],
    fanGood: ['Solid from {L} tonight. {SL}.', '{L} keeps getting better. You can see it.', 'Good shift from {L}. Did the work.', 'More of that from {L} please.', '{L} looks at home at this level.'],
    fanMeh: ['Quiet night for {L}. It happens.', '{L} will want more from himself.', 'Not {L}’s best, but he kept going.', 'Bit of a nothing game from {L}.'],
    fanBad: ['Rough one for {L}. Shake it off, lad.', 'Not {L}’s day. Next one.', '{L} looked a yard off it tonight.', 'Get {L} on the training pitch.'],
    fanBench: ['Why is {L} on the bench? Genuine question.', 'Start {L}. That is the post.', 'Give the kid minutes. Free {LU}.'],
    oppFan: ['{L} is not that good. Relax.', 'Our defence made {L} look like Pelé.', 'We will see {C} again. Circle it.', 'Fine. {L} can play. Happy now?', 'Ref gave {C} everything tonight. I said what I said.'],
    pundit: ['Watch {L}’s movement before the goal. Textbook.', '{L} reads the game two seconds ahead of everybody.', 'The numbers on {L} tonight: {SL}. Elite.', 'Not convinced by {L} yet. One good night is one good night.', '{L} has to take more shots. He is too unselfish.', '{L}’s first touch is the best thing about him.'],
    punditBad: ['{L} went missing tonight. Big players turn up in big games.', 'Too many lost balls from {L}. Simplify.', 'I like {L}, but that was a step backwards.'],
    reporter: ['{L} on tonight: "Just doing my job for the lads."', 'Asked {L} about his form. He smiled and said "next question".', 'Postgame: {L} says {C} are "only getting started".', '{L} was the last one off the pitch, signing for the kids.'],
    clubWin: ['FULL TIME: {C} {US}, {O} {THEM}. Three points! 🟢', 'FT | {C} {US}-{THEM} {O}. What a night.'],
    clubLoss: ['FULL TIME: {C} {US}, {O} {THEM}. We go again.', 'FT | {C} {US}-{THEM} {O}. Heads up, lads.'],
    clubDraw: ['FULL TIME: {C} {US}, {O} {THEM}. A point on the road.', 'FT | {C} {US}-{THEM} {O}. Honours even.'],
    clubGoal: ['{LU}! ⚽ What a moment.', 'Get in! {L} with the goal!'],
    mate: ['Told you, {L}. Different level.', 'Proud of this group. {L}, my guy.', 'Recovery, then go again. Big shift, {L}.', 'Assist king. You owe me dinner, {L}.'],
    manager: ['The manager on {L}: "He did what I asked. Pleased."', 'The manager on {L}: "A good player. He can be a top player."', 'The manager on {L}: "He has to do more off the ball."', 'The manager on {L}: "Young. Learning. We are patient."'],
    insider: ['Clubs above {C} are watching {L}. Scouts in the stands again tonight.', '{L} on the shortlist of two bigger clubs. Early days.', 'Understand {L}’s camp is relaxed. No talks yet. Watch this space.'],
    poll: [['Man of the match?', [['{L}', 0.6], ['Someone else', 0.4]]], ['Is {L} the best young player in the league?', [['Yes', 0.55], ['Not yet', 0.45]]], ['Should {L} start every week?', [['Every week', 0.7], ['Rotate him', 0.3]]]],
  };

  function words(ctx) {
    const c = C(), st = ctx.stats, L1 = lastName(c.name);
    const SL = [st.goals ? `${st.goals} goal${st.goals > 1 ? 's' : ''}` : '', st.assists ? `${st.assists} assist${st.assists > 1 ? 's' : ''}` : '', ctx.rating ? `rated ${ctx.rating.toFixed(1)}` : ''].filter(Boolean).join(', ') || `${ctx.mins} minutes`;
    return { N: c.name, L: L1, LU: L1.toUpperCase(), C: ctx.us.name, O: ctx.them.name, US: ctx.score[0], THEM: ctx.score[1], SL };
  }
  const fanH = () => '@' + any(FANS) + (Math.random() < 0.5 ? Math.floor(Math.random() * 99) : '');
  function post(who, text, x, o = {}) { return Object.assign({ who, text: fill(text, x), likes: Math.round((C().fans || 0) * (o.k || 0.01) * (0.5 + Math.random())) + Math.floor(Math.random() * 40) }, o); }

  /* ---------- after every match: the internet ---------- */
  function reaction(ctx) {
    dealt = new Set();
    const c = C(), x = words(ctx), out = [], st = ctx.stats, r = ctx.rating;
    const tier = !ctx.played ? 'bench' : r >= 8 || st.goals >= 2 ? 'great' : r >= 7 ? 'good' : r >= 6 ? 'meh' : 'bad';
    const keep = (who, arr, o) => { const t = deal(arr); if (t) out.push(post(who, t, x, o)); };
    const club = clubHandle(ctx.us);
    keep(club, ctx.score[0] > ctx.score[1] ? L.clubWin : ctx.score[0] < ctx.score[1] ? L.clubLoss : L.clubDraw, { name: ctx.us.name, ver: true, club: ctx.us, k: 0.03 });
    if (st.goals) keep(club, L.clubGoal, { name: ctx.us.name, ver: true, club: ctx.us, k: 0.05 });
    const n = tier === 'great' ? 5 : tier === 'good' ? 3 : 2;
    for (let i = 0; i < n; i++) keep(fanH(), tier === 'great' ? L.fanGreat : tier === 'good' ? L.fanGood : tier === 'meh' ? L.fanMeh : tier === 'bad' ? L.fanBad : L.fanBench, { k: 0.012 });
    if (tier !== 'bench') {
      const pu = any(PUNDITS); keep('@' + pu[1], tier === 'bad' ? L.punditBad : L.pundit, { name: pu[0], ver: true, k: 0.02 });
      const pr = any(PRESS); keep('@' + pr[1], L.reporter, { name: pr[0], ver: true, k: 0.01 });
      keep('@' + ctx.them.name.toLowerCase().replace(/[^a-z]/g, '') + '_fan' + Math.floor(Math.random() * 9), L.oppFan, { k: 0.006 });
      if (Math.random() < 0.6) { const m = mateName(); if (m) keep('@' + lastName(m).toLowerCase() + (2 + Math.floor(Math.random() * 30)), L.mate, { name: m, ver: true, club: ctx.us, k: 0.02 }); }
      keep('@' + any(PRESS)[1], L.manager, { name: 'Matchday Ledger', ver: true, k: 0.01 });
    }
    if (S().hype >= 45 && tier !== 'bench' && Math.random() < 0.5) keep('@' + INSIDER[1], L.insider, { name: INSIDER[0], ver: true, k: 0.05, hot: true });
    if (tier === 'great') {
      const pl = any(L.poll); out.splice(1, 0, { who: '@' + any(PRESS)[1], name: 'Pocket Football Wire', ver: true, text: fill(pl[0], x), poll: { o: pl[1].map(([t, w]) => [fill(t, x), w]), n: Math.round(c.fans * 0.08) + 300, v: null }, likes: 0 });
      out.unshift({ kind: 'trend', text: `#${x.LU.replace(/\s/g, '')}`, sub: `Trending in ${ctx.us.name.split(' ')[0]} · ${short(Math.round(c.fans * 0.3) + 1200)} posts` });
    }
    return out;
  }
  function mateName() { const c = C(), sq = c.squads && c.squads[c.club]; return sq ? any(sq.slice(0, 11)) : null; }

  /* ---------- the match settled: hype, followers, a callout, deals, messages ---------- */
  function after(ctx) {
    const c = C(), so = S(), st = ctx.stats, r = ctx.rating || 0, won = ctx.score[0] > ctx.score[1];
    const was = { fans: c.fans, hype: so.hype, trust: c.trust };
    /* a callout settles */
    const cl = so.callout;
    if (cl && cl.opp === ctx.oppIdx) {
      const ok = cl.kind === 'guarantee' ? won : won && ctx.played && r >= 7;
      if (ok) { so.backed++; c.xp += cl.kind === 'guarantee' ? 120 : 80; c.fans = Math.round(c.fans * (cl.kind === 'guarantee' ? 1.08 : 1.05)) + 300; so.hype = clamp(so.hype + 12, 0, 100);
        c.news.unshift({ s: c.season, r: c.league.round, t: `${c.name} backs up the talk against ${ctx.them.name}.` });
        c.feed.unshift(post(fanH(), `${lastName(c.name)} said it. Then did it.`, {}, { k: 0.02, hot: true }), post('@' + PUNDITS[0][1], `"${cl.quote}" He was right.`, {}, { name: PUNDITS[0][0], ver: true, k: 0.02 })); }
      else { so.ate++; c.trust = clamp(c.trust - 4, 5, 100); so.hype = clamp(so.hype - 14, 0, 100); c.fans = Math.round(c.fans * 0.985);
        c.feed.unshift(post(clubHandle(ctx.them), `"${cl.quote}"`, {}, { name: ctx.them.name, ver: true, club: ctx.them, k: 0.04, hot: true }), post(fanH(), any(['This aged like milk.', 'Maybe do the talking after the match next time.', 'Screenshot was worth it.']), {}, { k: 0.02 })); }
      so.lastCall = { ok, kind: cl.kind, opp: ctx.oppIdx }; so.callout = null;
    } else if (cl && mdKey() - cl.at > 3) so.callout = null;
    /* hype: a big night adds, a poor one costs, it cools every match; a loud following grows faster */
    so.hype = clamp(so.hype + (!ctx.played ? -1 : r >= 8.5 ? 9 : r >= 7.5 ? 5 : r >= 6.8 ? 2 : r < 6 ? -5 : 0) + (st.goals >= 2 ? 4 : 0) + (won ? 1 : 0) - 2, 0, 100);
    c.fans = Math.round(c.fans * (1 + so.hype / 100 * 0.03) + (st.goals || 0) * 120 + (st.assists || 0) * 60 + (ctx.played ? 20 : 0));
    /* what hype does: the manager notices the noise, a little */
    if (so.hype >= 60) c.trust = clamp(c.trust + 1, 5, 100); else if (so.hype < 20 && ctx.played && r < 6.2) c.trust = clamp(c.trust - 1, 5, 100);
    so.hist = (so.hist || []).concat(c.fans).slice(-16);
    /* brand partners */
    for (const d of so.deals) c.xp += 15;
    if (so.deals.length && so.hype < 25) { const d = so.deals.pop(); c.feed.unshift(post('@' + d.name.toLowerCase().replace(/[^a-z]/g, ''), `${d.name} and ${c.name} have parted ways. We wish him well.`, {}, { name: d.name, ver: true, col: d.col })); }
    so.hot = so.hype >= 55 ? so.hot + 1 : 0;
    if (so.offer && ++so.offer.age > 2) so.offer = null;
    if (!so.offer && so.hot >= 2 && so.deals.length < 2 && c.fans >= 3000) { const left = BRANDS.filter(b => !so.deals.some(d => d.name === b[0])), b = any(left); so.offer = { name: b[0], kind: b[1], col: b[2], line: b[3], age: 0, sign: 150 }; }
    /* the reaction */
    const posts = reaction(ctx);
    c.feed = posts.concat(c.feed).slice(0, 40);
    so.lastMd = mdKey();
    return { dFans: c.fans - was.fans, dHype: so.hype - was.hype, posts };
  }

  /* ---------- your own account ---------- */
  function myPost(text, k) { const f = C().fans || 0; return { who: handle(), mine: true, text, likes: Math.round(f * 0.07 * k) + 20 }; }
  function postNow(kind) {
    const c = C(), so = S(); if (so.posted === mdKey()) return false;
    const nx = K().nextFixture(), next = nx ? K().club(nx.opp) : null, last = c.last, won = last && last.score[0] > last.score[1], mate = mateName(), us = K().club();
    const text = kind === 'pic' ? any(['Locked in.', 'Recovery day.', next ? `${next.name} next.` : 'Back to work.', 'Matchday ready.', won ? 'Good day at the office.' : 'Back to it.'])
      : kind === 'fans' ? any([`${us.name.split(' ')[0]}, I hear you every single game. Thank you.`, 'Best fans in the league. Not close.', won ? 'That one was for everybody in the ground.' : 'We owe you a better one. You will get it.'])
      : kind === 'hype' ? any([next ? `${next.name} next. Circle it.` : 'The work does not stop.', next ? `Cannot wait for ${next.name}. Bring the noise.` : 'Pre-season? Already started.', 'Locked in. That is the post.'])
      : mate ? any([`Nobody works like ${mate}. My guy.`, `Shout out ${mate}. Makes my job easy.`, `${mate} does the dirty work every week. Respect it.`]) : 'Love this dressing room.';
    const up = Math.round(c.fans * (kind === 'fans' ? 0.02 : kind === 'pic' ? 0.015 : 0.01)) + (kind === 'fans' ? 40 : 25);
    c.fans += up; so.hype = clamp(so.hype + (kind === 'hype' ? 7 : kind === 'mate' ? 1 : 3), 0, 100);
    if (kind === 'mate') c.trust = clamp(c.trust + 1, 5, 100);
    const replies = [{ who: fanH(), text: any(kind === 'hype' ? ['LET’S GO', 'Kick-off cannot come soon enough.', 'Inject this into my veins.'] : ['We ride with you.', 'Class act.', 'This is why he is my favourite player.']) }];
    if (mate) replies.push({ who: '@' + lastName(mate).toLowerCase() + '9', name: mate, ver: true, club: us, text: any(kind === 'mate' ? ['Right back at you.', 'Appreciate you, brother.'] : ['Facts.', 'Say it louder.', 'Let’s work.']) });
    c.feed.unshift(Object.assign(myPost(text, kind === 'pic' ? 1.4 : 1), { pic: kind === 'pic', replies }));
    c.feed = c.feed.slice(0, 40); so.posted = mdKey(); K().save(); return true;
  }
  function callOut(kind) {
    const c = C(), so = S(), nx = K().nextFixture(); if (!nx || so.callout) return false;
    const o = K().club(nx.opp);
    const quote = kind === 'guarantee' ? any([`We are beating ${o.name}. Write it down.`, `${o.name}? Three points. I guarantee it.`]) : any([`${o.name} have not seen me yet.`, `Tell ${o.name} I am coming.`, `I like our chances against ${o.name}. A lot.`]);
    so.callout = { kind, opp: nx.opp, quote, at: mdKey() }; so.hype = clamp(so.hype + (kind === 'guarantee' ? 9 : 6), 0, 100); c.fans = Math.round(c.fans * 1.015) + 60;
    c.feed.unshift(Object.assign(myPost(quote, 1.8), { hot: true, replies: [{ who: clubHandle(o), name: o.name, ver: true, club: o, text: any(['Noted.', 'See you on the pitch.', 'Dressing-room wall material. Thank you.']) }, { who: fanH(), text: any(['He said WHAT', 'Oh this is going to be good.', 'Bold. I like it.']) }] }));
    so.quotes.unshift({ q: quote, tone: kind === 'guarantee' ? 'guarantee' : 'brash', wk: `Season ${c.season}, before ${o.name}` }); so.quotes = so.quotes.slice(0, 20);
    K().save(); return true;
  }
  function dealAnswer(yes) {
    const c = C(), so = S(), o = so.offer; if (!o) return;
    if (yes) { so.deals.push({ name: o.name, kind: o.kind, col: o.col }); c.xp += o.sign; c.fans = Math.round(c.fans * 1.02) + 200;
      c.feed.unshift(post('@' + o.name.toLowerCase().replace(/[^a-z]/g, ''), `Welcome to the ${o.name} family, ${c.name}. ${o.line}`, {}, { name: o.name, ver: true, col: o.col }), myPost(`Proud to be with ${o.name}.`, 1.2));
      c.news.unshift({ s: c.season, r: c.league.round, t: `${c.name} signs with ${o.name} (+${o.sign} XP, and more every match).` }); }
    so.offer = null; K().save();
  }
  function vote(i, k) { const f = C().feed[i]; if (!f || !f.poll || f.poll.v != null) return; f.poll.v = k; f.poll.n++; K().save(); }

  /* ---------- press, after the match: three questions, three tones ---------- */
  function pressQs(ctx) {
    const c = C(), L1 = lastName(c.name), won = ctx.score[0] > ctx.score[1], st = ctx.stats, o = ctx.them.name;
    const q1 = st.goals ? [`${st.goals > 1 ? 'Two goals' : 'A goal'} tonight. How does it feel?`, [['The lads made it easy. Credit to them.', 2, 1, 0, 'humble'], ['Good. I expect it of myself.', 0, 4, 1, 'confident'], ['Get used to it.', -3, 9, 3, 'brash']]]
      : !ctx.played ? ['You did not get on tonight. Frustrated?', [['The manager picks the team. I keep working.', 3, 0, 0, 'humble'], ['I want to play. Everybody knows that.', 0, 3, 1, 'confident'], ['Ask the manager. Not me.', -4, 7, 2, 'brash']]]
      : [`How would you rate your own game against ${o}?`, [['Room to improve. Always.', 2, 0, 0, 'humble'], ['Solid. I did my job.', 0, 3, 1, 'confident'], ['I was the best player out there.', -2, 8, 3, 'brash']]];
    const q2 = won ? ['Three points. Where can this team go?', [['One game at a time.', 2, 0, 0, 'humble'], ['Top of the table. Why not?', 0, 5, 1, 'confident'], ['We are winning the league. Easy.', -3, 10, 4, 'brash']]]
      : ['A tough result. What went wrong?', [['We stick together and work.', 2, 0, 0, 'humble'], ['Small details. We fix them.', 1, 2, 0, 'confident'], ['Some people need to look at themselves.', -5, 8, 3, 'brash']]];
    const nx = K().nextFixture(), next = nx ? K().club(nx.opp).name : 'the next one';
    const q3 = [`Anything to say before ${next}?`, [['Respect to them. We prepare well.', 1, 1, 0, 'humble'], ['Come early. It will be worth the ticket.', 0, 6, 2, 'confident'], [`${next} should be worried.`, -3, 10, 4, 'brash']]];
    return [q1, q2, q3].map(([q, a]) => [q.replace('{L}', L1), a]);
  }
  /* an answer: [text, trust, hype, followers %, tone] */
  function answer(a) {
    const c = C(), so = S();
    c.trust = clamp(c.trust + a[1], 5, 100); so.hype = clamp(so.hype + a[2], 0, 100); c.fans = Math.round(c.fans * (1 + a[3] / 100));
    so.quotes.unshift({ q: a[0], tone: a[4], wk: `Season ${c.season}, matchday ${c.league.round}` }); so.quotes = so.quotes.slice(0, 20);
    if (a[4] === 'brash') c.feed.unshift(post('@' + PRESS[0][1], `${lastName(c.name)} after the match: "${a[0]}"`, {}, { name: PRESS[0][0], ver: true, k: 0.02, hot: true }));
    K().save();
  }

  /* ---------- messages ---------- */
  function dms() {
    const c = C(), so = S(); if (so.dmKey === mdKey()) return so.dms;
    const last = c.last, mate = mateName(), ag = c.agent || (c.agent = any(D.FIRST) + ' ' + any(D.LAST)), out = [];
    if (last) {
      const won = last.score[0] > last.score[1], r = last.rating ? last.rating.r : 0;
      out.push({ from: 'Mom', text: won ? any(['We watched every minute. Your father shouted at the telly the whole second half. So proud.', 'A win! Call me when you are home. And eat something.']) : any(['Tough one, love. You will get them next time.', 'Chin up. Proud of you whatever happens.']) });
      out.push({ from: ag, role: 'Your agent', text: r >= 7.5 ? any(['Nights like that are how the next contract gets written.', 'My phone has not stopped. Keep this up.']) : r ? any(['Quiet one. Bounce back and nobody remembers.', 'Stay patient. The calls will come.']) : 'Bench again. Keep training hard; I am talking to people.' });
      if (mate) out.push({ from: mate, text: won ? any(['Told you we had them. Recovery at ten, do not be late.', 'That is how it is supposed to look.']) : any(['We are better than that. Extra work tomorrow, you in?', 'On to the next one.']) });
    } else {
      out.push({ from: 'Mom', text: 'Your first season! We will be watching. Drink water.' });
      out.push({ from: ag, role: 'Your agent', text: 'Welcome to the professional game. Make it impossible for them to leave you out.' });
    }
    so.dms = out; so.dmKey = mdKey(); return out;
  }

  /* ---------- drawing ---------- */
  function avatar(p) {
    const c = C();
    if (p.mine) { const u = PS.ui_head && PS.ui_head({ name: c.name, num: c.num, skin: c.skin ?? 3, look: c.look }, K().club(), 96); if (u) return `<span class="pav pic"><img alt="" src="${u}"></span>`; }
    if (p.club) return `<span class="crest" style="--c1:${p.club.c1};--c2:${p.club.c2};width:34px;height:34px"><b>${esc(p.club.ab[0])}</b></span>`;
    let h = 0; for (const ch of p.who) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `<span class="pav" style="background:${p.col || `hsl(${h % 360} 30% 32%)`}">${esc((p.name || p.who.replace('@', ''))[0].toUpperCase())}</span>`;
  }
  function card(p, i, reply) {
    if (p.kind === 'trend') return `<div class="tpost trend"><b>${esc(p.text)}</b><small>${esc(p.sub || '')}</small></div>`;
    const c = C(), mine = p.mine, name = mine ? c.name : p.name || p.who.replace(/^@/, ''), ver = mine ? c.fans >= 10000 : p.ver;
    let poll = '';
    if (p.poll) { const P = p.poll, tot = P.o.reduce((s, o) => s + o[1], 0) || 1;
      poll = P.v == null ? `<div class="poll">${P.o.map((o, k) => `<button data-vote="${i}" data-o="${k}">${esc(o[0])}</button>`).join('')}<small>${short(P.n)} votes · tap to vote</small></div>`
        : `<div class="poll done">${P.o.map((o, k) => `<div class="bar${k === P.v ? ' me' : ''}"><i style="width:${Math.round(o[1] / tot * 100)}%"></i><span>${esc(o[0])}</span><b>${Math.round(o[1] / tot * 100)}%</b></div>`).join('')}<small>${short(P.n)} votes</small></div>`; }
    return `<div class="tpost${reply ? ' re' : ''}${mine ? ' mine' : ''}${p.hot ? ' hot' : ''}">${avatar(p)}<div class="pbody"><div class="phd"><b>${esc(name)}</b>${ver ? '<i class="ver" aria-label="verified"></i>' : ''}<span>${esc(mine ? handle() : p.name ? p.who : '')}</span></div>
      <p>${esc(p.text)}</p>${p.pic ? '<div class="ppic"></div>' : ''}${poll}${p.likes ? `<div class="pmeta">♥ ${short(p.likes)}</div>` : ''}
      ${p.replies && !reply ? `<div class="reps">${p.replies.map(r => card(r, -1, true)).join('')}</div>` : ''}</div></div>`;
  }
  function spark(h) {
    if (!h || h.length < 2) return '';
    const mn = Math.min(...h), mx = Math.max(...h), w = 120, ht = 28, pts = h.map((v, k) => `${(k / (h.length - 1) * w).toFixed(1)},${(ht - (v - mn) / ((mx - mn) || 1) * ht).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2"/></svg>`;
  }
  /* the Social tab */
  function tab(sub) {
    const c = C(), so = S(), nx = K().nextFixture(), opp = nx && K().club(nx.opp), posted = so.posted === mdKey();
    const head = PS.ui_head && PS.ui_head({ name: c.name, num: c.num, skin: c.skin ?? 3, look: c.look }, K().club(), 160);
    const top = `<div class="sprof">${head ? `<img alt="" src="${head}">` : ''}<div><b>${esc(c.name)}${c.fans >= 10000 ? '<i class="ver"></i>' : ''}</b><span>${esc(handle())}</span>
      <div class="snums"><div><b>${short(c.fans)}</b><small>followers</small></div><div><b>${so.hype}</b><small>hype</small></div><div><b>${so.backed}/${so.backed + so.ate}</b><small>callouts backed</small></div></div>${spark(so.hist)}</div></div>
      <div class="hypebar"><i style="width:${so.hype}%"></i></div>`;
    const subs = `<div class="stabs">${[['feed', 'Feed'], ['post', 'Post'], ['dm', 'Messages'], ['what', 'What it does']].map(([k, t]) => `<button data-st="${k}" class="${sub === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    let body = '';
    if (sub === 'post') {
      body = `<p class="mute">One post a matchday. ${posted ? 'You have posted for this one.' : ''}</p>
        <div class="sbtns">${[['fans', 'Thank the fans', '+followers'], ['hype', `Hype the next one${opp ? ` (${opp.ab})` : ''}`, '+hype'], ['mate', 'Shout out a teammate', 'the manager likes it'], ['pic', 'Post a photo', '+followers']].map(([k, t, s]) => `<button class="btn2" data-sp="${k}" ${posted ? 'disabled' : ''}>${t}<small>${s}</small></button>`).join('')}</div>
        <div class="lbl">Call out ${opp ? esc(opp.name) : 'the next opponent'}</div>
        ${so.callout ? `<p class="callout">Open: “${esc(so.callout.quote)}”</p>` : `<div class="sbtns"><button class="btn2" data-co="talk" ${opp ? '' : 'disabled'}>Talk<small>win and play well: +80 XP, followers, hype</small></button><button class="btn2" data-co="guarantee" ${opp ? '' : 'disabled'}>Guarantee the win<small>win: +120 XP; lose: trust and hype gone</small></button></div>`}
        ${so.offer ? `<div class="callout offer"><small>An offer · ${esc(so.offer.kind)}</small><b>${esc(so.offer.name)}</b> wants you. “${esc(so.offer.line)}”<br>+${so.offer.sign} XP to sign, +15 XP every match.<div class="sbtns"><button class="go sm" data-deal="1">Sign</button><button class="btn2 sm" data-deal="0">No thanks</button></div></div>` : ''}
        ${so.deals.length ? `<div class="lbl">Partners</div><p>${so.deals.map(d => `<i class="sw" style="background:${d.col}"></i>${esc(d.name)}`).join(' · ')}</p>` : ''}
        ${so.quotes.length ? `<div class="lbl">On the record</div>${so.quotes.slice(0, 4).map(q => `<p class="q">“${esc(q.q)}” <small>${esc(q.tone)} · ${esc(q.wk)}</small></p>`).join('')}` : ''}`;
    } else if (sub === 'dm') {
      body = dms().map(m => `<div class="dm"><b>${esc(m.from)}</b>${m.role ? `<small>${esc(m.role)}</small>` : ''}<p>${esc(m.text)}</p></div>`).join('');
    } else if (sub === 'what') {
      body = `<ul class="howl"><li><b>Hype</b> rises with big games, posts and callouts you back up, and cools a little every match. Above 60 the manager notices (+1 trust a match); under 20 after poor games he cools on you. Hype also brings bigger clubs to your agent sooner.</li>
        <li><b>Followers</b> grow faster the more hype you have. With 3,000 or more and hype at 55+ for two matches, brands come with offers: XP to sign and XP every match.</li>
        <li><b>Callouts</b>: back them up for XP, followers and hype. Lose, and you lose the manager's trust and your hype, and the internet keeps the receipts.</li>
        <li><b>Press</b>: humble answers please the manager; brash ones please the internet.</li></ul>`;
    } else body = `<div class="feedl">${c.feed.map((p, i) => card(p, i)).join('') || '<p class="mute">Nothing yet. Play a match.</p>'}</div>`;
    return top + subs + body;
  }
  function wire(root, rerender) {
    root.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { postNow(b.dataset.sp); rerender(); });
    root.querySelectorAll('[data-co]').forEach(b => b.onclick = () => { callOut(b.dataset.co); rerender(); });
    root.querySelectorAll('[data-deal]').forEach(b => b.onclick = () => { dealAnswer(b.dataset.deal === '1'); rerender(); });
    root.querySelectorAll('[data-vote]').forEach(b => b.onclick = () => { vote(+b.dataset.vote, +b.dataset.o); rerender(); });
  }

  PS.social = { S, after, reaction, postNow, callOut, dealAnswer, vote, pressQs, answer, dms, tab, wire, card, short, handle };
})();
