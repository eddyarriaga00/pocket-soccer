/* Test harness for PocketSoccer. Two ways to run it:
   1. In Node, no browser: `node tools/harness.js [matches] [halfSeconds]` plays computer-v-computer matches with the
      real engine (js/match.js) and prints the per-match averages (goals, shots, passing, corners, fouls...).
   2. In the browser console on a running game: paste this file, then H.matches(10) does the same there, and
      H.season() plays a whole career season on auto.
   Everything steps the engine synchronously, so nothing waits on real time. */
(() => {
  const inNode = typeof window === 'undefined';
  if (inNode) {
    global.window = global;
    const fs = require('fs'), path = require('path'), js = path.join(__dirname, '..', 'js');
    for (const f of ['data.js', 'physics.js', 'sim.js', 'match.js']) (0, eval)(fs.readFileSync(path.join(js, f), 'utf8'));
  }
  const PS = window.PS;
  function matches(n = 10, half = 180) {
    const C = PS.data.CLUBS.filter(c => !c.lg), tot = { goals: 0, shots: 0, onT: 0, passes: 0, passOk: 0, corners: 0, fouls: 0, offsides: 0, saves: 0 }, lines = [];
    for (let i = 0; i < n; i++) {
      const a = C[i % C.length], b = C[(i * 5 + 3) % C.length];
      const G = PS.Match.create({ teams: [a, b], mode: 'team', halfLen: half, auto: true });
      let guard = 0; while (!G.over && guard++ < 1e5) { PS.Match.step(G, 1 / 30); if (G.phase === 'half') PS.Match.resume(G); }
      if (!G.over) throw new Error('match did not finish: ' + a.ab + ' v ' + b.ab);
      const s = G.stats; tot.goals += G.score[0] + G.score[1];
      for (const k of ['shots', 'onT', 'passes', 'passOk', 'corners', 'fouls', 'offsides', 'saves']) tot[k] += s[0][k] + s[1][k];
      lines.push(`${a.ab}(${a.ovr}) ${G.score[0]}-${G.score[1]} ${b.ab}(${b.ovr})`);
    }
    for (const k in tot) tot[k] = +(tot[k] / n).toFixed(1);
    tot.passPct = Math.round(tot.passOk / tot.passes * 100);
    return { perMatch: tot, results: lines };
  }
  function season() {
    const K = PS.career; K.wipe();
    K.create({ name: 'Test Player', nation: 'Spain', pos: 'ST', foot: 'Right', club: 11 });
    let guard = 0;
    while (!K.C.summary && guard++ < 60) {
      const f = K.nextFixture(); if (!f) break;
      const G = PS.Match.create({ teams: [K.club(f.us), K.club(f.opp)], mode: 'player', halfLen: 120, auto: true, me: { name: K.C.name, num: 9, pos: 'ST', a: K.C.a } });
      while (!G.over) { PS.Match.step(G, 1 / 30); if (G.phase === 'half') PS.Match.resume(G); }
      K.finishMatch(Object.assign(PS.Match.result(G), { f, oppIdx: f.opp, home: f.home, round: f.round }));
    }
    return K.C.summary;
  }
  window.H = { matches, season };
  if (inNode && require.main === module) { const r = matches(+(process.argv[2] || 10), +(process.argv[3] || 180)); console.log(r.results.join('\n')); console.log(r.perMatch); }
})();
