/* Dribble lab: `node tools/dribblelab.js [reps]`. One attacker with the ball runs at one defender from 5 m, does a
   move (or nothing) as the defender closes, and we count how often he gets past him with the ball within 3 seconds.
   Then the other side: a defender who contains first against one who dives straight in, tackles won.
   Dribbling 75 against Defending 70 unless noted. Uses the real engine (js/match.js), no browser. */
global.window = global;
const fs = require('fs'), path = require('path'), js = path.join(__dirname, '..', 'js');
for (const f of ['data.js', 'physics.js', 'sim.js', 'match.js']) (0, eval)(fs.readFileSync(path.join(js, f), 'utf8'));
const M = PS.Match, N = +(process.argv[2] || 200), C = PS.data.CLUBS;
function setup() {
  const G = M.create({ teams: [C[0], C[1]], mode: 'team', halfLen: 9999, auto: true });
  G.phase = 'play'; G.restart = null;
  const a = G.ps.find(p => p.t === 0 && p.role === 'ST'), d = G.ps.find(p => p.t === 1 && p.role === 'CB');
  for (const p of G.ps) if (p !== a && p !== d) { p.off = true; }
  const up = G.side[0] > 0 ? 1 : -1;
  Object.assign(a, { x: 34, y: 52 - up * 10, vx: 0, vy: up * 5, face: up > 0 ? 0 : Math.PI, cd: 0, act: null, stun: 0 }); a.a = Object.assign({}, a.a, { dri: 75, pac: 75, phy: 65 });
  Object.assign(d, { x: 34, y: 52 - up * 5, vx: 0, vy: 0, face: up > 0 ? Math.PI : 0, cd: 0, act: null, stun: 0 }); d.a = Object.assign({}, d.a, { def: 70, pac: 70, phy: 70 });
  G.ball.owner = a; a.tch = null; G.ctl = null; G.userOn = false;
  return { G, a, d, up };
}
function attack(move) {
  let won = 0;
  for (let i = 0; i < N; i++) {
    const { G, a, d, up } = setup();
    let did = false, past = false;
    for (let k = 0; k < 90; k++) {
      a.tx = a.x; a.ty = a.y + up * 6; a.want = 7; a.next = 9;   // he just runs at goal
      if (!did && move && Math.hypot(a.x - d.x, a.y - d.y) < 2.4) { did = M.skill(G, a, move, Math.random() < 0.5 ? -1 : 1); }
      M.step(G, 1 / 30);
      if (G.ball.owner !== a && !(G.ball.owner == null && Math.hypot(G.ball.x - a.x, G.ball.y - a.y) < 2.5)) break;
      if ((a.y - d.y) * up > 1.2 && G.ball.owner === a) { past = true; break; }
    }
    if (past) won++;
  }
  return Math.round(won / N * 100);
}
console.log('Getting past one defender (%), by move:');
for (const m of [null, 'feint', 'stepover', 'roulette', 'dragback', 'knock']) console.log(`  ${(m || 'no move').padEnd(9)} ${attack(m)}%`);
/* defending: contain-then-tackle against a dive-in */
function defend(contain) {
  let won = 0, tries = 0;
  for (let i = 0; i < N; i++) {
    const { G, a, d, up } = setup();
    a.y = d.y - up * 3; d.contain = 0;
    for (let k = 0; k < 90; k++) {
      a.tx = a.x + Math.sin(k / 8) * 3; a.ty = a.y + up * 3; a.want = 4.5; a.next = 9;
      const dd = Math.hypot(a.x - d.x, a.y - d.y);
      if (contain) { d.contain = dd < 3.2 && dd > 0.9 ? (d.contain || 0) + 1 / 30 : d.contain; if (d.contain > 0.6 && dd < 1.6 && d.cd <= 0) { M._tackle(G, d, a); tries++; break; } }
      else if (dd < 1.6 && d.cd <= 0) { d.vx = (a.x - d.x) * 4; d.vy = (a.y - d.y) * 4; d.contain = 0; M._tackle(G, d, a, true); tries++; break; }
      M.step(G, 1 / 30);
    }
    if (G.ball.owner === d || (G.ball.owner == null && G.phase === 'play')) won++;
  }
  return `${Math.round(won / N * 100)}% (${tries} tackles)`;
}
console.log('Winning it in a 1 v 1 (ball won or knocked loose):');
console.log('  contain first  ', defend(true));
console.log('  dive in        ', defend(false));
