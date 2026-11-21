/* Shot lab: the real engine, one shooter (shooting 75) and the keeper, shots from a set of distances for every type
   and timing. Prints goal / saved / off-target percentages. node tools/shotlab.js [shots per cell] */
global.window = global;
const fs = require('fs'), path = require('path'), js = path.join(__dirname, '..', 'js');
for (const f of ['data.js', 'physics.js', 'sim.js', 'match.js']) (0, eval)(fs.readFileSync(path.join(js, f), 'utf8'));
const N = +(process.argv[2] || 150), C = PS.data.CLUBS, L = 105, CX = 34;
function trial(dist, type, timing, keeperOff, sho = 75, angle) {
  const G = PS.Match.create({ teams: [C[2], C[6]], mode: 'team', halfLen: 9999, auto: true });
  G.phase = 'play'; G.restart = null; G.side = [1, -1];
  const p = G.ps.find(q => q.t === 0 && q.role === 'ST'), gk = G.ps.find(q => q.t === 1 && q.role === 'GK');
  for (const q of G.ps) if (q !== p && q !== gk) { q.off = true; }
  const a = angle ?? (Math.random() - 0.5) * 0.7;
  p.x = CX + Math.sin(a) * dist; p.y = L - Math.cos(a) * dist; p.face = Math.atan2(CX - p.x, L - p.y); p.vx = p.vy = 0; p.a.sho = sho;
  const b = G.ball; Object.assign(b, PS.phys.newBall(p.x + Math.sin(p.face) * 0.5, p.y + Math.cos(p.face) * 0.5)); b.owner = p;
  const off = keeperOff ?? Math.min(3, 0.8 + dist * 0.1);
  gk.x = CX + (p.x - CX) / dist * off; gk.y = L - (L - p.y) / dist * off;
  const ss = PS.Match._shot.sweet(G, p), pw = timing === 'perfect' ? ss.c : timing === 'good' ? ss.c + (Math.random() < 0.5 ? -1 : 1) * ss.w * 1.6 : timing === 'over' ? Math.min(1, ss.c + ss.w * 3) : type === 'low' ? 0.2 : type === 'power' ? 0.97 : ss.c;
  const across = (p.x > CX ? -1 : 1) * (type === 'finesse' ? 0.75 + Math.random() * 0.25 : 0.6 + Math.random() * 0.35);
  PS.Match._shot.shoot(G, p, { type, pw, across: type === 'chip' ? 0 : across, timing });
  let saves0 = G.stats[1].saves;
  for (let i = 0; i < 30 * 5; i++) {
    PS.Match.step(G, 1 / 30);
    if (G.phase === 'goal') return 'goal';
    if (G.stats[1].saves > saves0 || b.owner === gk) return 'saved';
    if (G.phase === 'restart') return 'off';
  }
  return 'off';
}
const cells = [['drive', 'good'], ['drive', 'perfect'], ['drive', 'over'], ['low', 'good'], ['finesse', 'good'], ['finesse', 'perfect'], ['power', 'good']];
const dists = [6, 11, 16, 20, 25, 30];
console.log('type/timing        ' + dists.map(d => (d + 'm').padStart(12)).join(''));
for (const [type, timing] of cells) {
  let row = `${type}/${timing}`.padEnd(19);
  for (const d of dists) { const t = { goal: 0, saved: 0, off: 0 }; for (let i = 0; i < N; i++) t[trial(d, type, timing)]++; row += `${Math.round(t.goal / N * 100)}/${Math.round(t.saved / N * 100)}/${Math.round(t.off / N * 100)}`.padStart(12); }
  console.log(row);
}
/* the chip, against a keeper off his line and one on it */
for (const off of [1.5, 7]) { let row = `chip keeper ${off}m out`.padEnd(19); for (const d of dists) { const t = { goal: 0, saved: 0, off: 0 }; for (let i = 0; i < N; i++) t[trial(d, 'chip', 'good', Math.min(off, d - 2))]++; row += `${Math.round(t.goal / N * 100)}/${Math.round(t.saved / N * 100)}/${Math.round(t.off / N * 100)}`.padStart(12); } console.log(row); }
console.log('(goal/saved/off target %)');
