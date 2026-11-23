/* PocketSoccer: the match in 3D (three.js). A floodlit stadium, the pocket players (model.js), the ball, and a
   broadcast camera that sits behind your team's attack, so in portrait you always play up the screen (it swings round
   at half time when the ends change). World axes: X = pitch x - 34, Z = pitch y - 52.5, Y up; one unit is a metre. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const T = window.THREE;
  if (!T) return;
  const { PITCH, CX, POST } = PS.phys;
  const W = PITCH.W, L = PITCH.L;
  const X = x => x - W / 2, Z = y => y - L / 2;
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const R = PS.R3 = { zoom: 1 };
  let renderer, scene, camera, wrap, stadium, ballM, ballS, ring, arrow, star, rigs = new Map(), G = null, netMats = [], camPos = new T.Vector3(), camLook = new T.Vector3(), camInit = false, dprCap = 2, slowFrames = 0;
  let reticle, trail, trailPts = [], nets = {}, bulge = null;

  function init(el) {
    wrap = el;
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    renderer.domElement.className = 'gl';
    scene = new T.Scene();
    scene.background = new T.Color('#0a1222');
    scene.fog = new T.Fog('#0a1222', 120, 260);
    camera = new T.PerspectiveCamera(55, 1, 0.5, 400);
    scene.add(new T.HemisphereLight(0xe8f0ff, 0x2b4a2a, 1.15));
    const sun = new T.DirectionalLight(0xffffff, 1.35); sun.position.set(30, 60, -20); scene.add(sun);
    const fill = new T.DirectionalLight(0xbcd2ff, 0.45); fill.position.set(-40, 30, 50); scene.add(fill);
    stadium = buildStadium(); scene.add(stadium);
    /* the ball and its shadow */
    ballM = new T.Mesh(new T.SphereGeometry(PS.phys.R, 20, 14), new T.MeshLambertMaterial({ map: ballTex() }));
    ballS = new T.Mesh(new T.CircleGeometry(0.17, 16), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
    ballS.rotation.x = -Math.PI / 2; scene.add(ballM, ballS);
    /* who you are: a ring at your feet, an arrow over your head (a star over your own player in a career) */
    ring = new T.Mesh(new T.RingGeometry(0.55, 0.72, 32), new T.MeshBasicMaterial({ color: 0x3ee08f, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; scene.add(ring);
    const ag = new T.ConeGeometry(0.22, 0.4, 3); ag.rotateX(Math.PI);
    arrow = new T.Mesh(ag, new T.MeshBasicMaterial({ color: 0x3ee08f })); scene.add(arrow);
    star = new T.Mesh(new T.OctahedronGeometry(0.16), new T.MeshBasicMaterial({ color: 0xffd23f })); scene.add(star);
    /* the aim: a ring in the goal mouth while Shoot is held (its size is the error cone), a dot at its middle */
    reticle = new T.Group();
    const rr = new T.Mesh(new T.RingGeometry(0.86, 1, 40), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
    const rd = new T.Mesh(new T.CircleGeometry(0.12, 16), new T.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: T.DoubleSide }));
    rr.renderOrder = rd.renderOrder = 10; reticle.add(rr, rd); reticle.userData = { ring: rr, dot: rd }; reticle.visible = false; scene.add(reticle);
    /* a trail behind a struck ball */
    trail = new T.InstancedMesh(new T.SphereGeometry(0.1, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }), 18);
    trail.count = 0; trail.frustumCulled = false; scene.add(trail);
    addEventListener('resize', resize); resize();
  }
  function resize() {
    if (!renderer) return;
    const r = wrap.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------ the stadium */
  function canvasTex(w, h, draw, rep) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function ballTex() {
    return canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#16181d';
      for (let i = 0; i < 12; i++) { const x = (i % 6) * w / 6 + (i < 6 ? 0 : w / 12), y = i < 6 ? h * 0.3 : h * 0.72; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 16); } g.fill(); }
      g.fillStyle = '#3ee08f'; g.fillRect(0, h * 0.48, w, 4);
    });
  }
  function buildStadium() {
    const S = new T.Group();
    /* grass: mown stripes across the pitch, a darker surround */
    const grass = canvasTex(64, 1024, (g, w, h) => {
      for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? '#3f9a4f' : '#378c46'; g.fillRect(0, i * h / 20, w, h / 20 + 1); }
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2); }
    });
    const pitch = new T.Mesh(new T.PlaneGeometry(W + 8, L + 8), new T.MeshLambertMaterial({ map: grass }));
    pitch.rotation.x = -Math.PI / 2; S.add(pitch);
    const around = new T.Mesh(new T.PlaneGeometry(W + 70, L + 70), new T.MeshLambertMaterial({ color: '#2a6a35' }));
    around.rotation.x = -Math.PI / 2; around.position.y = -0.02; S.add(around);
    /* the markings: thin quads laid on the grass, one mesh */
    const pos = [], lw = 0.12;
    const seg = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * lw / 2, ny = dx / l * lw / 2;
      const a = [X(x0 + nx), Z(y0 + ny)], b = [X(x1 + nx), Z(y1 + ny)], c = [X(x1 - nx), Z(y1 - ny)], d = [X(x0 - nx), Z(y0 - ny)];
      pos.push(a[0], 0.01, a[1], b[0], 0.01, b[1], c[0], 0.01, c[1], a[0], 0.01, a[1], c[0], 0.01, c[1], d[0], 0.01, d[1]); };
    const poly = pts => { for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); };
    const arc = (cx, cy, r, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.sin(a) * r, cy + Math.cos(a) * r]; });
    poly([[0, 0], [W, 0], [W, L], [0, L], [0, 0]]);
    poly([[0, L / 2], [W, L / 2]]);
    poly(arc(CX, L / 2, PITCH.CIRC, 0, Math.PI * 2, 64));
    for (const [y, s] of [[0, 1], [L, -1]]) {
      const bw = PITCH.BOXW / 2, sw = PITCH.SIXW / 2;
      poly([[CX - bw, y], [CX - bw, y + s * PITCH.BOXD], [CX + bw, y + s * PITCH.BOXD], [CX + bw, y]]);
      poly([[CX - sw, y], [CX - sw, y + s * PITCH.SIXD], [CX + sw, y + s * PITCH.SIXD], [CX + sw, y]]);
      const sp = y + s * PITCH.SPOT, a = Math.acos((PITCH.BOXD - PITCH.SPOT) / PITCH.CIRC);
      poly(s > 0 ? arc(CX, sp, PITCH.CIRC, -a, a, 20) : arc(CX, sp, PITCH.CIRC, Math.PI - a, Math.PI + a, 20));
      poly(arc(CX, sp, 0.12, 0, Math.PI * 2, 8));
    }
    for (const [x, y, a0] of [[0, 0, 0], [W, 0, -Math.PI / 2], [0, L, Math.PI / 2], [W, L, Math.PI]]) poly(arc(x, y, 1, a0, a0 + Math.PI / 2, 8));
    poly(arc(CX, L / 2, 0.15, 0, Math.PI * 2, 8));
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); lg.computeVertexNormals();
    S.add(new T.Mesh(lg, new T.MeshBasicMaterial({ color: 0xf4f7f2 })));
    /* the goals */
    const white = new T.MeshLambertMaterial({ color: 0xffffff });
    const net = canvasTex(64, 64, (g) => { g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }, [1, 1]);
    for (const end of [0, L]) {
      const s = end ? 1 : -1, gz = Z(end), d = PITCH.NET, h = PITCH.GH, hw = POST;
      const post = (x, y, len, rot) => { const m = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, len, 10), white); m.position.set(x, y, gz); if (rot) m.rotation.z = Math.PI / 2; S.add(m); };
      post(-hw, h / 2, h); post(hw, h / 2, h); post(0, h, hw * 2 + 0.12, true);
      const nm = new T.MeshBasicMaterial({ map: net.clone(), transparent: true, side: T.DoubleSide, depthWrite: false }); nm.map.needsUpdate = true; nm.map.repeat.set(hw * 2 / 0.6, h / 0.6); nm.map.wrapS = nm.map.wrapT = T.RepeatWrapping; netMats.push(nm);
      const back = new T.Mesh(new T.PlaneGeometry(hw * 2, h, 18, 8), nm); back.position.set(0, h / 2, gz + s * d); S.add(back);
      nets[end] = { mesh: back, base: back.geometry.attributes.position.array.slice(), s };
      const top = new T.Mesh(new T.PlaneGeometry(hw * 2, d), nm); top.rotation.x = Math.PI / 2; top.position.set(0, h, gz + s * d / 2); S.add(top);
      for (const sx of [-1, 1]) { const side = new T.Mesh(new T.PlaneGeometry(d, h), nm); side.rotation.y = Math.PI / 2; side.position.set(sx * hw, h / 2, gz + s * d / 2); S.add(side); }
      /* the frame behind */
      for (const sx of [-1, 1]) { const m = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, d, 6), white); m.rotation.x = Math.PI / 2; m.position.set(sx * hw, h, gz + s * d / 2); S.add(m); }
    }
    /* corner flags */
    for (const [x, y] of [[0, 0], [W, 0], [0, L], [W, L]]) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.5, 6), white); pole.position.set(X(x), 0.75, Z(y)); S.add(pole);
      const fl = new T.Mesh(new T.PlaneGeometry(0.45, 0.32), new T.MeshLambertMaterial({ color: 0xff4f6b, side: T.DoubleSide })); fl.position.set(X(x) + 0.22, 1.35, Z(y)); S.add(fl);
    }
    /* advertising boards round the pitch */
    const ads = ['POCKETSOCCER', 'KICK-OFF', 'PLAY ON', 'ONE THUMB', 'GOAL!', 'PORTRAIT FC'];
    const adMats = ads.map((t, i) => new T.MeshBasicMaterial({ map: canvasTex(512, 64, (g, w, h) => { g.fillStyle = ['#0b1f44', '#111827', '#1d4ed8', '#7a1f3d', '#0f766e', '#111827'][i]; g.fillRect(0, 0, w, h); g.font = '900 40px Archivo, Arial'; g.fillStyle = i % 2 ? '#3ee08f' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 2); }) }));
    let k = 0;
    const board = (x, z, ry, len) => { const m = new T.Mesh(new T.BoxGeometry(len, 0.9, 0.15), [adMats[0], adMats[0], adMats[0], adMats[0], adMats[k++ % ads.length], adMats[0]]); m.position.set(x, 0.45, z); m.rotation.y = ry; S.add(m); };
    for (let i = 0; i < 8; i++) { board(-W / 2 + 4.25 + i * 8.5, -L / 2 - 4, Math.PI, 8.4); board(-W / 2 + 4.25 + i * 8.5, L / 2 + 4, 0, 8.4); }
    for (let i = 0; i < 12; i++) { board(-W / 2 - 4, -L / 2 + 4.4 + i * 8.8, -Math.PI / 2, 8.7); board(W / 2 + 4, -L / 2 + 4.4 + i * 8.8, Math.PI / 2, 8.7); }
    /* the stands: steep banks of seats full of people, a roof edge, floodlights */
    const crowd = canvasTex(512, 256, (g, w, h) => {
      /* rows of seats, people as soft rounded shapes: a head over shoulders, colors muted by the night */
      g.fillStyle = '#121a29'; g.fillRect(0, 0, w, h);
      const cols = ['#6b7180', '#7a2a36', '#33508a', '#7d7350', '#2f3440', '#8a909c', '#3f5f50', '#a8aab0', '#2e5e5e', '#7f5a40'];
      for (let r = 0; r < 16; r++) {
        g.fillStyle = r % 2 ? '#18212f' : '#141c2a'; g.fillRect(0, r * 16, w, 16);
        for (let i = 0; i < 64; i++) { if (Math.random() < 0.12) continue; const x = i * 8 + (r % 2) * 4 + Math.random() * 2, y = r * 16 + 4;
          g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.beginPath(); g.ellipse(x + 3.5, y + 8, 3.6, 4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#c69c7a'; g.globalAlpha = 0.55; g.beginPath(); g.arc(x + 3.5, y + 2.5, 2, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
      }
    }, [9, 4]);
    const standMat = new T.MeshLambertMaterial({ map: crowd, color: 0x9aa3b5 });   // dimmed: the crowd sits back behind the pitch
    const stand = (w, d, x, z, ry) => {
      const g = new T.Group(); const rows = new T.Mesh(new T.PlaneGeometry(w, Math.hypot(d, d * 0.62)), standMat);
      rows.rotation.x = -Math.atan2(d * 0.62, d); rows.position.set(0, d * 0.31 + 1.2, -d / 2); g.add(rows);
      const roof = new T.Mesh(new T.BoxGeometry(w, 0.6, 5), new T.MeshLambertMaterial({ color: '#0d1422' })); roof.position.set(0, d * 0.62 + 4, -d - 1); g.add(roof);
      const wall = new T.Mesh(new T.BoxGeometry(w, 1.2, 0.3), new T.MeshLambertMaterial({ color: '#141c2c' })); wall.position.set(0, 0.6, 0); g.add(wall);
      g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
    };
    stand(W + 30, 26, 0, -L / 2 - 8, 0); stand(W + 30, 26, 0, L / 2 + 8, Math.PI);
    stand(L + 16, 24, -W / 2 - 8, 0, Math.PI / 2); stand(L + 16, 24, W / 2 + 8, 0, -Math.PI / 2);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tw = new T.Mesh(new T.BoxGeometry(1, 34, 1), new T.MeshLambertMaterial({ color: '#1c2433' })); tw.position.set(x * (W / 2 + 26), 17, z * (L / 2 + 26)); S.add(tw);
      const lamp = new T.Mesh(new T.BoxGeometry(6, 3, 0.5), new T.MeshBasicMaterial({ color: '#fffbe8' })); lamp.position.set(x * (W / 2 + 25.5), 34, z * (L / 2 + 25.5)); lamp.lookAt(0, 0, 0); S.add(lamp);
    }
    return S;
  }

  /* ------------------------------------------------------------ players */
  /* kits: the away side changes when the shirts are too alike; the two keepers always differ from both teams and
     from each other */
  const rgb = c => { const n = parseInt(String(c).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const near = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 120; };
  function chooseKits() {
    const h = G.teams[0].kit, a = G.teams[1].kit;
    G.teams[0].kitUse = h;
    let away = a;
    if (near(h.c1, a.c1)) {
      const alt = !near(a.c2, h.c1) ? a.c2 : near(h.c1, '#f2f2f2') ? '#141414' : '#f2f2f2';
      away = Object.assign({}, a, { c1: alt, c2: a.c1, trim: a.c1, alt: a.c1, shorts: alt, sock: alt, pat: 0 });
    }
    G.teams[1].kitUse = away;
    const gks = ['#d9f99d', '#f97316', '#22d3ee', '#e879f9'].filter(c => !near(c, h.c1) && !near(c, away.c1));
    G.gkCols = [gks[0] || '#d9f99d', gks[1] || '#22d3ee'];
  }
  function kitOf(team, gk, t) {
    const k = team.kitUse || team.kit;
    if (gk) { const c = G.gkCols ? G.gkCols[t] : '#d9f99d'; return { c1: c, c2: '#111111', shorts: '#111111', sock: c, trim: '#111111', alt: '#111111', pat: 0, ab: k.ab, name: k.name }; }
    return k;
  }
  function attach(g) {
    G = g;
    for (const [, r] of rigs) scene.remove(r.root);
    rigs.clear();
    const ok = PS.Model && PS.Model.ready();
    chooseKits();
    if (refRig) scene.remove(refRig.root);
    refRig = ok ? PS.Model.player({ name: 'Referee', num: null, skin: 2, ref: true, ht: 1.78 }, { c1: '#141414', c2: '#f2f2f2', shorts: '#141414', sock: '#141414', trim: '#f2f2f2', alt: '#f2f2f2', pat: 0 }) : null;
    if (refRig) { scene.add(refRig.root); ref.x = W / 2 + 8; ref.y = L / 2; }
    for (const p of G.ps) {
      const team = G.teams[p.t], kit = kitOf(team, p.role === 'GK', p.t);
      let rig;
      if (ok) { rig = PS.Model.player({ name: p.name, num: p.num, skin: p.skin, look: p.look, gk: p.role === 'GK', ht: p.role === 'GK' ? 1.9 : 1.8 + ((p.num * 7) % 9 - 4) * 0.012 }, kit); rig.kind = 'skin'; }
      else rig = simplePlayer(kit);
      scene.add(rig.root); rigs.set(p, rig);
    }
    camInit = false;
  }
  /* no model (it failed to load): a capsule in the team's colors, so the game still plays */
  function simplePlayer(kit) {
    const root = new T.Group();
    const body = new T.Mesh(new T.CapsuleGeometry(0.28, 0.9, 4, 10), new T.MeshLambertMaterial({ color: kit.c1 })); body.position.y = 1.0; root.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), new T.MeshLambertMaterial({ color: '#c68e63' })); head.position.y = 1.7; root.add(head);
    return { root, kind: 'simple' };
  }

  /* ------------------------------------------------------------ the camera */
  function cameraTick(dt) {
    const b = G.ball, s = G.side[0];   // behind your team's attack
    const focus = G.mode === 'player' && G.me && !G.me.bench && !G.me.off ? G.me : null;
    const goalCam = G.phase === 'goal' && G.events.length >= 0 ? G.ps.find(p => p.goalie) : null;
    let fx = b.x, fy = b.y;
    /* three cameras: 'broadcast' (behind your attack, the ball in the middle), 'lock' (close behind your own man, the
       basketball game's player lock), 'tele' (high and wide, the whole shape) */
    const mode = R.cam || 'broadcast', me = focus || (G.ctl && !G.ctl.bench && !G.ctl.off ? G.ctl : null);
    if (mode === 'lock' && me) { fx = lerp(b.x, me.x, 0.72); fy = lerp(b.y, me.y, 0.72); }
    else if (focus) { fx = lerp(b.x, focus.x, 0.42); fy = lerp(b.y, focus.y, 0.42); }
    else if (G.ctl && !G.ctl.bench) { fx = lerp(b.x, G.ctl.x, mode === 'tele' ? 0.1 : 0.22); fy = lerp(b.y, G.ctl.y, mode === 'tele' ? 0.1 : 0.22); }
    /* defending: the camera drops back so the ball sits higher and you see the space behind it, toward your goal */
    const def = PS.Match.possTeam(G) === 1 ? 1 : 0;
    R.def = (R.def || 0) + (def - (R.def || 0)) * Math.min(1, dt * 1.5);
    fy -= s * 11 * R.def;
    if (goalCam) { fx = lerp(fx, goalCam.x, 0.7); fy = lerp(fy, goalCam.y, 0.7); }
    const z = R.zoom * (goalCam ? 0.75 : 1);
    const CAMS = { broadcast: [21, 18, 5], lock: [12.5, 9.5, 9], tele: [32, 33, 3] }, cp = CAMS[mode] || CAMS.broadcast;
    const back = cp[0] * z, up = cp[1] * z, ahead = cp[2] * z;
    const tx = X(clamp(fx, 8, W - 8)) * (mode === 'lock' ? 0.95 : mode === 'tele' ? 0.6 : 0.82), tz = Z(fy);
    const want = new T.Vector3(tx, up, tz - s * back), look = new T.Vector3(tx, 0.5, tz + s * ahead);
    if (!camInit) { camPos.copy(want); camLook.copy(look); camInit = true; }
    const k = 1 - Math.exp(-dt * 3.2);
    camPos.lerp(want, k); camLook.lerp(look, k);
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (R.shake > 0.002) { camera.position.x += (Math.random() - 0.5) * R.shake; camera.position.y += (Math.random() - 0.5) * R.shake; R.shake *= Math.exp(-dt * 9); }
    if (R.studio) { camera.position.set(...R.studio[0]); camera.lookAt(...R.studio[1]); }   /* tests: a fixed camera */
    G.cam.fx = 0; G.cam.fy = s;
  }

  /* ------------------------------------------------------------ a frame */
  const _v = { x: 0, z: 0, y: 0, face: 0, vx: 0, vz: 0, act: null, ht: 1.8, sad: false, hold: false, ready: false };
  function frame(dt) {
    if (!G || !renderer) return;
    cameraTick(dt);
    for (const p of G.ps) {
      const rig = rigs.get(p); if (!rig) continue;
      const vis = !p.bench && !p.off; rig.root.visible = vis; if (!vis) continue;
      if (rig.kind === 'skin') {
        /* the face for the moment */
        let mood = null;
        if (G.phase === 'goal') mood = p.goalie ? 'yell' : p.sad ? 'stern' : 'happy';
        else if (p.moodT > G.t) mood = p.mood2;
        else if (G.half === 2 && (p.stamina ?? 1) < 0.55) mood = 'tired';
        _v.mood = mood;
        _v.x = X(p.x); _v.z = Z(p.y); _v.y = 0; _v.face = p.face; _v.vx = p.vx; _v.vz = p.vy; _v.act = p.act; _v.sad = !!p.sad; _v.hold = !!(p.caught && G.ball.owner === p); _v.ready = false; _v.ht = 1.8;
        PS.Model.update(rig, _v, dt);
      } else { rig.root.position.set(X(p.x), 0, Z(p.y)); rig.root.rotation.y = p.face; }
    }
    const b = G.ball;
    ballM.position.set(X(b.x), b.z, Z(b.y));
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0.05) { const ax = new T.Vector3(b.vy, 0, -b.vx).normalize(); ballM.rotateOnWorldAxis(new T.Vector3(ax.x, 0, -ax.z).normalize(), sp * dt / PS.phys.R); }
    ballS.position.set(X(b.x), 0.015, Z(b.y)); ballS.scale.setScalar(clamp(1 - b.z * 0.08, 0.4, 1)); ballS.material.opacity = clamp(0.38 - b.z * 0.03, 0.1, 0.38);
    /* markers */
    const c = G.ctl && !G.ctl.bench && !G.ctl.off ? G.ctl : null;
    ring.visible = !!c && G.phase !== 'goal'; arrow.visible = ring.visible;
    if (c) { ring.position.set(X(c.x), 0.03, Z(c.y)); arrow.position.set(X(c.x), 2.45 + Math.sin(performance.now() / 220) * 0.08, Z(c.y)); arrow.rotation.y += dt * 2; }
    star.visible = false;
    refTick(dt);
    aimTick();
    trailTick(dt);
    netTick(dt);
    renderer.render(scene, camera);
    /* adapt: a phone that cannot keep up draws fewer pixels */
    radar();
    if (dt > 0.045) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 40 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1)); resize(); slowFrames = 0; }
  }
  /* a still picture for menus: the stadium, players at kick-off, the camera high behind one end */
  function showcase() { if (!renderer) return; camera.position.set(18, 24, -L / 2 - 14); camera.lookAt(0, 0, 0); renderer.render(scene, camera); }
  const COLS = { perfect: 0x3ee08f, good: 0xffffff, early: 0x9aa6bd, over: 0xff5a6b };
  function aimTick() {
    const pv = G.input && G.input.charge ? PS.Match.aimPreview(G) : null;
    reticle.visible = !!pv && !pv.fake;
    if (!reticle.visible) return;
    const s = pv.gy > L / 2 ? 1 : -1;
    reticle.position.set(X(pv.tx), pv.tz, Z(pv.gy) - s * 0.05);
    reticle.userData.ring.scale.setScalar(pv.r); reticle.userData.ring.material.color.setHex(COLS[pv.timing] || 0xffffff);
    reticle.userData.dot.material.color.setHex(COLS[pv.timing] || 0xffffff);
  }
  const _m = new T.Matrix4(), _p = new T.Vector3(), _q = new T.Quaternion(), _s = new T.Vector3();
  function trailTick(dt) {
    const b = G.ball, now = performance.now(), sp = Math.hypot(b.vx, b.vy, b.vz);
    if (!b.owner && (G.shot || sp > 19)) trailPts.push({ x: X(b.x), y: b.z, z: Z(b.y), t: now });
    trailPts = trailPts.filter(q => now - q.t < 260);
    trail.count = Math.min(18, trailPts.length);
    for (let i = 0; i < trail.count; i++) { const q = trailPts[trailPts.length - 1 - i], k = 1 - (now - q.t) / 260; _p.set(q.x, q.y, q.z); _s.setScalar(Math.max(0.05, k) * 1.1); _m.compose(_p, _q, _s); trail.setMatrixAt(i, _m); }
    trail.instanceMatrix.needsUpdate = true;
  }
  /* the net: where the ball hits, the mesh balloons out and settles in a few wobbles */
  R.goal = (endY, x, z) => { const n = nets[endY]; if (n) bulge = { n, x: X(x), y: z, t: 0 }; };
  function netTick(dt) {
    if (!bulge) return;
    bulge.t += dt;
    const n = bulge.n, pos = n.mesh.geometry.attributes.position, a = pos.array, b0 = n.base, amp = 0.55 * Math.exp(-bulge.t * 2.4) * Math.cos(bulge.t * 11);
    for (let i = 0; i < pos.count; i++) { const x = b0[i * 3], y = b0[i * 3 + 1] + PITCH.GH / 2, d2 = (x - bulge.x) ** 2 + (y - bulge.y) ** 2; a[i * 3 + 2] = b0[i * 3 + 2] + n.s * amp * Math.exp(-d2 / 0.9); }
    pos.needsUpdate = true;
    if (bulge.t > 2) { a.set(b0); pos.needsUpdate = true; bulge = null; }
  }
  /* the referee: never in the way, a little behind the play and off to one side, at a jog */
  let refRig = null; const ref = { x: W / 2 + 8, y: L / 2, vx: 0, vy: 0, face: 0 };
  function refTick(dt) {
    if (!refRig || dt <= 0) { if (refRig) refRig.root.visible = !!G; return; }
    const b = G.ball, side = G.side[0], tx = clamp(b.x + (b.x < W / 2 ? 10 : -10), 4, W - 4), ty = clamp(b.y - side * 7, 4, L - 4);
    const dx = tx - ref.x, dy = ty - ref.y, d = Math.hypot(dx, dy), sp = Math.min(6.2, d * 1.2);
    const wx = d ? dx / d * sp : 0, wy = d ? dy / d * sp : 0, k = Math.min(1, dt * 3);
    ref.vx += (wx - ref.vx) * k; ref.vy += (wy - ref.vy) * k; ref.x += ref.vx * dt; ref.y += ref.vy * dt;
    const v = Math.hypot(ref.vx, ref.vy); ref.face = v > 0.6 ? Math.atan2(ref.vx, ref.vy) : Math.atan2(b.x - ref.x, b.y - ref.y);
    PS.Model.update(refRig, { x: X(ref.x), z: Z(ref.y), y: 0, face: ref.face, vx: ref.vx, vz: ref.vy, act: null }, dt);
  }
  /* the radar: the whole pitch in a corner, your attack always up, your team in your colour, the ball white */
  let rcv = null, rctx = null;
  function radar() {
    if (!rcv) { rcv = document.getElementById('radar'); if (!rcv) return; rctx = rcv.getContext('2d'); }
    if (R.radarOff) { rcv.hidden = true; return; } rcv.hidden = false;
    const w = rcv.width, h = rcv.height, g = rctx, up = G.side[0] > 0;
    const px = x => (up ? x : W - x) / W * (w - 4) + 2, py = y => (up ? L - y : y) / L * (h - 4) + 2;
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(20,60,32,.78)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5); g.beginPath(); g.moveTo(2, h / 2); g.lineTo(w - 2, h / 2); g.stroke();
    g.strokeRect(w / 2 - 9, 2.5, 18, 8); g.strokeRect(w / 2 - 9, h - 10.5, 18, 8);
    const c0 = (G.teams[0].kitUse || G.teams[0].kit).c1, c1 = (G.teams[1].kitUse || G.teams[1].kit).c1;
    for (const p of G.ps) { if (p.bench || p.off) continue; g.fillStyle = p.t ? c1 : c0; g.beginPath(); g.arc(px(p.x), py(p.y), p === G.ctl ? 3.4 : 2.3, 0, 7); g.fill();
      if (p === G.ctl) { g.strokeStyle = '#3ee08f'; g.lineWidth = 1.5; g.stroke(); } else { g.strokeStyle = p.t === 0 ? 'rgba(255,255,255,.75)' : 'rgba(255,190,60,.9)'; g.lineWidth = 0.8; g.stroke(); } }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px(G.ball.x), py(G.ball.y), 1.8, 0, 7); g.fill();
  }
  function detach() { if (refRig) { scene.remove(refRig.root); refRig = null; } G = null; for (const [, r] of rigs) scene.remove(r.root); rigs.clear(); }

  R.init = init; R.attach = attach; R.frame = frame; R.resize = resize; R.showcase = showcase; R.detach = detach;
  R.project = (x, y, z) => { const v = new T.Vector3(X(x), z || 0, Z(y)).project(camera); const r = wrap.getBoundingClientRect(); return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height }; };
})();
