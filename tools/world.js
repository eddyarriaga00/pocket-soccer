/* World check: `node tools/world.js [seasons]` runs a career through whole seasons with quick simulated results (no
   match engine) and prints each season's calendar, cups, call-ups and champions, then checks the save round-trips
   and that a save from before the world (one league) loads. */
global.window = global;
const fs = require('fs'), path = require('path'), js = path.join(__dirname, '..', 'js');
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
for (const f of ['data.js', 'sim.js', 'career.js']) (0, eval)(fs.readFileSync(path.join(js, f), 'utf8'));
const { career: K, data: D, sim } = PS;
const N = +(process.argv[2] || 6);
const fake = f => {
  const [a, b] = sim.quick(K.team(f.us), K.team(f.opp)), g = Math.random() < 0.3 ? 1 : 0;
  const score = [Math.max(a, g), b], r = 6 + Math.random() * 2.5;
  return { f, score, stats: { goals: Math.min(g, score[0]), assists: 0, shots: 2, onT: 1 }, scorers: [], on: 0, off: 90, rating: { r, res: score[0] > score[1] ? 'W' : score[0] < score[1] ? 'L' : 'D', why: [] } };
};
const fail = m => { console.error('FAIL', m); process.exitCode = 1; };
K.wipe(); K.create({ name: 'Test Player', nation: 'United States', pos: 'ST', foot: 'Right', club: 11 });
for (let s = 0; s < N; s++) {
  if (s === 2) for (const k in K.C.a) K.C.a[k] = 80;   // good enough for a call-up from season 3
  const kinds = {}; let guard = 0, f;
  while ((f = K.nextFixture()) && guard++ < 80) { kinds[f.k] = (kinds[f.k] || 0) + 1; if (!K.team(f.opp)) fail('no opponent ' + JSON.stringify(f)); K.finishMatch(fake(f)); }
  const C = K.C;
  if (!C.summary) fail('season did not end');
  const lg = C.lgs.map(L => `${D.LEAGUES[L.id].ab} ${L.round}/${L.fx.length} → ${D.CLUBS[K.table(L.id)[0].i].ab}`).join(' · ');
  console.log(`S${C.season} ${C.year} ${K.club().ab} (${D.LEAGUES[K.club().lg].ab}) played`, kinds, `| cup: ${C.cup ? K.team(C.cup.win).ab : '-'} | CC: ${C.cl ? K.team(C.cl.win).ab : '-'} | ${C.tour ? C.tour.name + ': ' + K.team(C.tour.win).name : 'no tournament'} | caps ${C.intl.caps}`);
  console.log('   ', lg);
  console.log('    rival:', K.C.rival.name, K.team(K.C.rival.club).ab, 'ovr', K.C.rival.ovr, 'goals', K.C.rival.ss.g, 'in', K.C.rival.ss.apps, 'h2h', K.C.rival.h2h.join('-'));
  console.log('    awards:', C.summary.awards.join('; ') || '-', '| offers:', (C.offers || []).map(o => D.CLUBS[o.i].ab + '/' + D.LEAGUES[D.CLUBS[o.i].lg].ab).join(' '));
  if (C.lgs.some(L => L.round !== L.fx.length)) fail('a league did not finish');
  if (C.cup && C.cup.win == null) fail('cup unfinished');
  if (C.cl && C.cl.win == null) fail('champions cup unfinished');
  if (C.tour && C.tour.win == null) fail('tournament unfinished');
  K.nextSeason(C.offers && C.offers.length && s === 1 ? C.offers[0].i : null);
}
/* round trip */
const before = JSON.stringify(K.C); K.load(); if (JSON.stringify(K.C) !== before) fail('save round trip differs'); if (!K.C.league || K.C.league !== K.C.lgs[K.club().lg]) fail('league alias');
if (/"league"/.test(localStorage.getItem('pocketsoccer.career.v1'))) fail('alias leaked into the save');
/* an old save */
const old = JSON.parse(localStorage.getItem('pocketsoccer.career.v1'));
old.league = old.lgs[0]; old.league.round = 5; delete old.lgs; delete old.cal; delete old.ci; delete old.cup; delete old.cl; delete old.tour; delete old.intl; old.club = 3; old.summary = null;
localStorage.setItem('pocketsoccer.career.v1', JSON.stringify(old)); K.load();
const f2 = K.nextFixture();
if (!f2 || f2.k !== 'lg' || f2.round !== 5) fail('old save next fixture ' + JSON.stringify(f2)); else console.log('old save migrates: next is', f2.stage, 'v', K.team(f2.opp).name, '; Liga round', K.C.lgs[1].round);
console.log(process.exitCode ? 'FAILED' : 'world ok');
