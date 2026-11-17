/* PocketSoccer: the pitch and the ball.
   Units are metres and seconds. x runs 0..68 across the pitch, y 0..105 along it, z is height. The side the player
   is on always attacks +y, toward the goal at y = 105 (the top of a portrait screen).
   The ball model follows the published aerodynamics of a football, simplified for a game:
   - drag falls from about 0.45 to 0.22 between 10 and 18 m/s (the "drag crisis"), so a struck ball holds its pace
     and a soft one dies;
   - curl is the Magnus force from spin about the vertical axis, weaker at high speed, so a driven shot swerves late;
   - spin decays over a few seconds; on the grass the ball bounces, then rolls with a speed-dependent resistance. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};

  const PITCH = { W: 68, L: 105, GW: 7.32, GH: 2.44, BOXW: 40.32, BOXD: 16.5, SIXW: 18.32, SIXD: 5.5, SPOT: 11, CIRC: 9.15, NET: 2 };
  const CX = PITCH.W / 2, POST = PITCH.GW / 2;
  const G = 9.81, R = 0.11;
  const K = 0.5 * 1.2 * Math.PI * R * R / 0.43;   // 0.5 * air density * area / mass, about 0.053

  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cd = v => 0.45 - 0.23 * smooth(10, 18, v);
  const magnus = v => 0.0042 * (1 - 0.4 * smooth(18, 32, v));   // lateral accel = magnus(v) * spin * v

  function newBall(x = CX, y = PITCH.L / 2) {
    return { x, y, z: R, vx: 0, vy: 0, vz: 0, spin: 0, top: 0, owner: null, last: null, roll: 0, inNet: false };
  }

  /* One fixed step. ev collects what happened: 'goal', 'post', 'bar', 'out', 'bounce'. Returns nothing. */
  function step(b, dt, ev) {
    if (b.owner) return;
    const px = b.x, py = b.y, pz = b.z;
    const hs = Math.hypot(b.vx, b.vy), sp = Math.hypot(hs, b.vz);
    const air = b.z > R + 0.02 || b.vz > 0.05;
    if (air) {
      const d = K * cd(sp) * sp;
      const m = magnus(sp) * b.spin;
      b.vx += (-d * b.vx - m * b.vy) * dt;
      b.vy += (-d * b.vy + m * b.vx) * dt;
      b.vz += (-d * b.vz - G - 0.0025 * b.top * hs) * dt;   // topspin dips the ball, backspin (negative) floats it
      b.spin *= Math.exp(-dt / 5);
      b.top *= Math.exp(-dt / 4);
    } else {
      /* on the grass: rolling resistance plus a little curl that the turf soon kills */
      if (hs > 0.01) {
        const dec = (1.1 + 0.11 * hs) * dt, f = Math.max(0, hs - dec) / hs;
        const m = 0.3 * magnus(hs) * b.spin;
        b.vx = (b.vx - m * b.vy * dt) * f;
        b.vy = (b.vy + m * b.vx * dt) * f;
      } else { b.vx = b.vy = 0; }
      b.spin *= Math.exp(-dt * 2.5);
      b.top = 0;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    b.roll += hs * dt / R;
    if (b.z < R) {
      b.z = R;
      if (b.vz < -1.4) { b.vz = -b.vz * 0.52; b.vx *= 0.86; b.vy *= 0.86; b.spin *= 0.6; ev && ev.push('bounce'); }
      else b.vz = 0;
    }
    if (b.inNet) { netHold(b); return; }
    goalLine(b, px, py, pz, PITCH.L, 1, ev);
    goalLine(b, px, py, pz, 0, -1, ev);
    if (!b.inNet && (b.x < -R || b.x > PITCH.W + R)) ev && ev.push('out');
  }

  /* The ball crossing a goal line (y = gy, travelling in direction s): a goal, the frame, or out of play. */
  function goalLine(b, px, py, pz, gy, s, ev) {
    if ((py - gy) * s > 0 || (b.y - gy) * s < 0) return;  // did not cross this step
    const t = (gy - py) / ((b.y - py) || 1e-6), x = px + (b.x - px) * t, z = pz + (b.z - pz) * t;
    const dx = Math.abs(x - CX);
    const hitPost = Math.abs(dx - POST) < R + 0.06 && z < PITCH.GH + R;
    const hitBar = dx < POST + 0.06 && Math.abs(z - PITCH.GH) < R + 0.06;
    if (hitPost || hitBar) {
      b.y = gy - s * (R + 0.02);
      if (hitPost) { b.vy = -b.vy * 0.55; b.vx += (x > CX ? 1 : -1) * (dx < POST ? -1 : 1) * Math.abs(b.vy) * 0.3; }
      else { b.vz = -Math.abs(b.vz) * 0.5 - 1; b.vy = -b.vy * 0.4; }
      b.spin *= 0.3;
      ev && ev.push(hitPost ? 'post' : 'bar');
      return;
    }
    if (dx < POST && z < PITCH.GH) { b.inNet = s; ev && ev.push(s > 0 ? 'goal' : 'owngoal'); return; }
    ev && ev.push('out');
  }
  function netHold(b) {
    const back = b.inNet > 0 ? PITCH.L + PITCH.NET : -PITCH.NET;
    if ((b.y - back) * b.inNet > 0) { b.y = back; b.vy = -b.vy * 0.15; b.vx *= 0.4; b.vz *= 0.4; b.spin = 0; }
    if (Math.abs(b.x - CX) > POST - R) { b.x = CX + Math.sign(b.x - CX) * (POST - R); b.vx *= -0.3; }
    if (b.z > PITCH.GH - R) { b.z = PITCH.GH - R; b.vz = -Math.abs(b.vz) * 0.3; }
  }

  /* Predict where the ball will be: a copy stepped forward. Used by keepers and by the curl aiming below. */
  function predict(b, until, dt = 1 / 60) {
    const c = { ...b, owner: null, inNet: false };
    const out = [];
    for (let t = 0; t < 3; t += dt) {
      const ev = [];
      step(c, dt, ev);
      out.push({ t, x: c.x, y: c.y, z: c.z });
      if (until && until(c, t)) break;
      if (ev.length && ev[0] !== 'bounce') break;
    }
    return out;
  }

  /* Aim through curl: the initial direction that makes a ball struck at speed v, with lift vz and spin, cross the
     line y = ty at x = tx. A secant search over the launch angle; three or four steps are enough. */
  function solveAim(from, tx, ty, v, vz, spin, top) {
    const cross = ang => {
      const b = { ...newBall(from.x, from.y), z: Math.max(R, from.z || R), vx: Math.sin(ang) * v, vy: Math.cos(ang) * v, vz, spin, top };
      const path = predict(b, c => c.y >= ty || c.y < from.y - 5);
      const last = path[path.length - 1];
      return last ? last.x : from.x;
    };
    let a0 = Math.atan2(tx - from.x, ty - from.y), a1 = a0 + 0.04;
    let e0 = cross(a0) - tx, e1 = cross(a1) - tx;
    for (let i = 0; i < 5 && Math.abs(e1) > 0.05; i++) {
      const a2 = a1 - e1 * (a1 - a0) / ((e1 - e0) || 1e-6);
      a0 = a1; e0 = e1; a1 = Math.max(-1.5, Math.min(1.5, a2)); e1 = cross(a1) - tx;
    }
    return a1;
  }

  PS.phys = { PITCH, CX, POST, R, G, newBall, step, predict, solveAim };
})();
