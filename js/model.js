/* PocketSoccer: the players' bodies. The pocket player from PocketBasketball (models/body.glb, its hair, beards and
   faces as tagged parts) on Quaternius's CC0 skeleton and movement clips (models/player.glb), dressed for soccer by a
   kit shader: a short-sleeved shirt with a collar, shorts, socks to the knee over shin pads, boots; long sleeves for
   keepers. Running is the clips blended by speed and placed on the ground stride by stride (PocketBasketball's
   gait code, in metres here); kicks, headers, slides, dives, throw-ins and celebrations are set on the bones in code.
   Exposes PS.Model: load(), ready(), player(d, kit) → a rig, update(rig, p, dt). */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const T = window.THREE;
  if (!T) return;
  const V3 = (x, y, z) => new T.Vector3(x, y, z), Q4 = () => new T.Quaternion();
  const bk = n => n.replace(/[.\[\]:/]/g, '');
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const FT = 3.281;   // the gait numbers below were measured in feet (PocketBasketball): speeds go in as feet a second

  const SKIN = ['#f1d1b5', '#e0b48f', '#c68e63', '#a26a42', '#7a4a2a', '#4f2f1c'];
  PS.SKIN = SKIN;

  let TPL = null, loading = null;
  function load() {
    const A = window.THREE_ADDONS;
    if (TPL || !A) return Promise.resolve(TPL);
    if (!loading) loading = Promise.all([new A.GLTFLoader().loadAsync('models/player.glb'), new A.GLTFLoader().loadAsync('models/body.glb')])
      .then(([g, gb]) => (TPL = template(g, gb))).catch(e => { console.error('PocketSoccer: player model', e); return null; });
    return loading;
  }

  function template(g, gb) {
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    const meshes = []; scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    /* the body stands on this skeleton with longer legs: the skeleton takes the model's rest pose first */
    const src = {}; gb.scene.updateMatrixWorld(true); gb.scene.traverse(o => { if (o.isBone) src[bk(o.name)] = o; });
    const th = meshes[0].skeleton.bones.find(b => bk(b.name) === 'DEF-thighL'), y0 = th.getWorldPosition(V3()).y;
    for (const b of meshes[0].skeleton.bones) { const q = src[bk(b.name)]; if (q) b.position.copy(q.position); }
    scene.updateMatrixWorld(true);
    for (const m of meshes) m.skeleton.calculateInverses();
    const legK = th.getWorldPosition(V3()).y / y0;
    for (const c of g.animations) for (const tr of c.tracks) if (/DEF-hips\.position$/.test(tr.name)) {
      const v = tr.values, r0 = [v[0], v[1], v[2]], hb = meshes[0].skeleton.bones.find(b => bk(b.name) === 'DEF-hips');
      for (let i = 0; i < v.length; i += 3) { v[i] = hb.position.x + (v[i] - r0[0]); v[i + 1] = hb.position.y + (v[i + 1] - r0[1]) * legK; v[i + 2] = hb.position.z + (v[i + 2] - r0[2]); }
    }
    let model = null; gb.scene.traverse(o => { if (o.isSkinnedMesh && !model) model = o; });
    for (const m of meshes) m.skeleton.update();
    const bones = {}; meshes[0].skeleton.bones.forEach(b => { bones[bk(b.name)] = b; });
    const at = n => bones[bk(n)].getWorldPosition(V3());
    const box = new T.Box3();
    for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); }
    const H = box.max.y - box.min.y;
    const sk = meshes[0].skeleton, m0 = meshes[0];
    const idxOf = n => sk.bones.findIndex(b => bk(b.name) === bk(n));
    const local = (bone, worldPos, worldQuat) => ({ pos: bone.worldToLocal(worldPos.clone()), quat: bone.getWorldQuaternion(Q4()).invert().multiply(worldQuat) });
    const spine = bones[bk('DEF-spine.003')], chestY = at('DEF-spine.003').y;
    const backQ = new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI);
    const put2 = (y, front, q, x = 0) => local(spine, V3(x, y, front ? 0.166 : -0.162), q);
    const decals = {
      back: put2(chestY - H * 0.02, false, backQ), nameBack: put2(chestY + H * 0.052, false, backQ),
      crest: put2(chestY + H * 0.03, true, new T.Quaternion(), -0.07 * (Math.sign(at('DEF-hand.L').x) || 1)),
      front: put2(chestY - H * 0.01, true, new T.Quaternion())
    };
    /* The model's vertices carry their layer as a color (red = region / 8: 0 skin, 1 jersey, 2 shorts, 3 shoe, 4 sock,
       5 hair, 6 the whites of the eyes, 7 the dark of the face). The body goes to the kit shader; hair and face are
       their own small mesh, colored per player (green and blue say which hairstyle, beard or face a part is). */
    const g0 = model.geometry, p = g0.attributes.position, nr = g0.attributes.normal, col = g0.attributes.color, sj = g0.attributes.skinIndex, sw = g0.attributes.skinWeight, ix = g0.index.array;
    const map = model.skeleton.bones.map(b => Math.max(0, idxOf(b.name)));
    const Mx = m0.matrixWorld.clone().invert().multiply(model.matrixWorld), nm = new T.Matrix3().getNormalMatrix(Mx), Wm = model.matrixWorld, v = V3(), n = V3(), w = V3();
    const A = { P: [], N: [], SI: [], SW: [], RA: [], RB: [], KP: [], IX: [], id: new Int32Array(p.count).fill(-1) }, F = { P: [], N: [], SI: [], SW: [], KC: [], IX: [], TV: [], id: new Int32Array(p.count).fill(-1) };
    let top = -1e9, bot = 1e9; const reg = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) { reg[i] = Math.round(col.getX(i) * 8); w.fromBufferAttribute(p, i).applyMatrix4(Wm); if (w.y > top) top = w.y; if (w.y < bot) bot = w.y; }
    /* how far down an arm a skin vertex sits (shoulder 0, wrist 1), signed by the arm: sleeves are painted from it */
    const bw = nmn => { const b = model.skeleton.bones.find(b => b.name === nmn || b.name === nmn.replace('.', '')); return b ? b.getWorldPosition(V3()) : null; };
    const ARM = ['R', 'L'].map(S => ({ a: bw('DEF-upper_arm.' + S), b: bw('DEF-hand.' + S), ids: model.skeleton.bones.map((b, k) => /upper_arm|forearm|hand|f_|thumb|palm/.test(b.name) && new RegExp('[._]?' + S + '(\\.\\d+)?$').test(b.name) ? k : -1).filter(k => k >= 0) }));
    const armRaw = (i, w) => { for (let s = 0; s < 2; s++) { const Aa = ARM[s]; if (!Aa.a || !Aa.b) continue; let ws = 0; for (let c = 0; c < 4; c++) if (Aa.ids.includes(sj.getComponent(i, c))) ws += sw.getComponent(i, c);
      if (ws > 0.5) { const dx = Aa.b.x - Aa.a.x, dy = Aa.b.y - Aa.a.y, dz = Aa.b.z - Aa.a.z; return [s, ((w.x - Aa.a.x) * dx + (w.y - Aa.a.y) * dy + (w.z - Aa.a.z) * dz) / (dx * dx + dy * dy + dz * dz)]; } } return null; };
    const ext = [[1e9, -1e9], [1e9, -1e9]];
    for (let i = 0; i < p.count; i++) if (reg[i] === 0) { w.fromBufferAttribute(p, i).applyMatrix4(Wm); const r = armRaw(i, w); if (r) { if (r[1] < ext[r[0]][0]) ext[r[0]][0] = r[1]; if (r[1] > ext[r[0]][1]) ext[r[0]][1] = r[1]; } }
    const armT = (i, w) => { const r = armRaw(i, w); if (!r) return 0; const e = ext[r[0]]; return (r[0] ? -1 : 1) * (0.05 + Math.max(0, Math.min(1, (r[1] - e[0]) / ((e[1] - e[0]) || 1)))); };
    const push = (D, i) => { if (D.id[i] >= 0) return D.id[i]; const k = D.P.length / 3; D.id[i] = k;
      v.fromBufferAttribute(p, i).applyMatrix4(Mx); n.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize(); w.fromBufferAttribute(p, i).applyMatrix4(Wm);
      D.P.push(v.x, v.y, v.z); D.N.push(n.x, n.y, n.z);
      let ws = 0; for (let c = 0; c < 4; c++) ws += sw.getComponent(i, c);
      for (let c = 0; c < 4; c++) { D.SI.push(map[sj.getComponent(i, c)] || 0); D.SW.push(ws > 0 ? sw.getComponent(i, c) / ws : c ? 0 : 1); }
      if (D === A) { const r = reg[i]; for (let c = 0; c < 4; c++) D.RA.push(r === c ? 1 : 0); D.RB.push(r === 4 ? 1 : 0, r === 0 ? armT(i, w) : 0, 0, 1); D.KP.push(w.x / H, (w.y - box.min.y) / H, w.z / H); }
      else D.KC.push(reg[i] - 5);
      return k; };
    for (let t = 0; t < ix.length; t += 3) { const D = reg[ix[t]] >= 5 ? F : A; D.IX.push(push(D, ix[t]), push(D, ix[t + 1]), push(D, ix[t + 2])); if (D === F) F.TV.push(Math.round(col.getY(ix[t]) * 32) + 32 * Math.round(col.getZ(ix[t]) * 8)); }
    { const lead = new Set(); for (let k = 0; k < A.SI.length; k += 4) { let b = 0; for (let c = 1; c < 4; c++) if (A.SW[k + c] > A.SW[k + b]) b = c; lead.add(A.SI[k + b]); }
      if (lead.size < 12) throw new Error('models/body.glb is badly rigged (' + lead.size + ' bones move the body)'); }
    const mk = D => { const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(D.P, 3)); gg.setAttribute('normal', new T.Float32BufferAttribute(D.N, 3));
      gg.setAttribute('skinIndex', new T.Uint16BufferAttribute(D.SI, 4)); gg.setAttribute('skinWeight', new T.Float32BufferAttribute(D.SW, 4)); gg.setIndex(D.IX); return gg; };
    const body = mk(A); body.setAttribute('rA', new T.Float32BufferAttribute(A.RA, 4)); body.setAttribute('rB', new T.Float32BufferAttribute(A.RB, 4)); body.setAttribute('kpos', new T.Float32BufferAttribute(A.KP, 3));
    const face = mk(F); face.setAttribute('kc', new T.Float32BufferAttribute(F.KC, 1)); face.userData.tv = F.TV; face.userData.sets = {};
    const clips = {}; for (const c of g.animations) clips[c.name] = c;
    return { scene, clips, H, decals, body, face, Hs: top - bot, sideR: Math.sign(at('DEF-hand.R').x - at('DEF-hips').x) || -1 };
  }

  /* The kit, by body region. Designs (pat): 0 plain, 1 side panels, 2 pinstripes, 3 a chest band, 4 a fade,
     5 shoulder yokes, 6 a sash, 7 stripes, 8 hoops, 9 halves. sl: 0 short sleeves, 1 long (keepers). ref: a referee. */
  const MATS = {};
  function kitMaterial(c) {
    const key = [c.skin, c.jersey, c.shorts, c.sock, c.boot, c.trim, c.alt, c.pat, c.sl].join();
    if (MATS[key]) return MATS[key];
    const m = new T.MeshLambertMaterial({ color: 0xffffff });
    const u = { cSkin: { value: new T.Color(c.skin) }, cJersey: { value: new T.Color(c.jersey) }, cShorts: { value: new T.Color(c.shorts) }, cBoot: { value: new T.Color(c.boot) },
      cSock: { value: new T.Color(c.sock) }, cTrim: { value: new T.Color(c.trim) }, cAlt: { value: new T.Color(c.alt) }, kPat: { value: c.pat || 0 }, kSl: { value: c.sl || 0 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'attribute vec4 rA;\nattribute vec4 rB;\nattribute vec3 kpos;\nvarying vec4 vRA;\nvarying vec4 vRB;\nvarying vec3 vK;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRA = rA; vRB = rB; vK = kpos;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  { vec3 vd = normalize(vViewPosition); float rim = pow(1.0 - clamp(abs(dot(normalize(vNormal), vd)), 0.0, 1.0), 3.0); gl_FragColor.rgb += rim * 0.22; }');
      sh.fragmentShader = 'uniform vec3 cSkin;\nuniform vec3 cJersey;\nuniform vec3 cShorts;\nuniform vec3 cBoot;\nuniform vec3 cSock;\nuniform vec3 cTrim;\nuniform vec3 cAlt;\nuniform float kPat;\nuniform float kSl;\nvarying vec4 vRA;\nvarying vec4 vRB;\nvarying vec3 vK;\n' +
        sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  float vRegion = 0.0, rbest = vRA.x;
  if (vRA.y > rbest) { rbest = vRA.y; vRegion = 1.0; } if (vRA.z > rbest) { rbest = vRA.z; vRegion = 2.0; } if (vRA.w > rbest) { rbest = vRA.w; vRegion = 3.0; }
  if (vRB.x > rbest) { rbest = vRB.x; vRegion = 4.0; }
  bool arm = vRegion < 0.5 && abs(vRB.y) > 0.05;
  float at = abs(vRB.y) - 0.05;
  bool cuff = false;
  /* a soccer shirt over the tank-top model: sleeves down the upper arm (to the wrist for a keeper), the chest and
     shoulders filled in, a collar round the neck */
  if (arm) { float slv = kSl > 0.5 ? 0.86 : 0.36; if (at < slv) { vRegion = 1.0; cuff = at > slv - 0.045; } }
  else if (vRegion < 0.5 && vK.y > 0.95 && vK.y < 1.392) { vRegion = 1.0; }
  bool collar = vRegion > 0.5 && vRegion < 1.5 && !arm && vK.y > 1.372 && abs(vK.x) < 0.05;
  /* socks to just under the knee, over shin pads */
  if (vRegion < 0.5 && !arm && vK.y < 0.772) { vRegion = 4.0; }
  vec3 rc = vRegion < 0.5 ? cSkin : vRegion < 1.5 ? cJersey : vRegion < 2.5 ? cShorts : vRegion < 3.5 ? cBoot : cSock;
  bool top = vRegion > 0.5 && vRegion < 1.5, bot = vRegion > 1.5 && vRegion < 2.5;
  float ax = abs(vK.x);
  if (top && !arm) {
    if (kPat > 0.5 && kPat < 1.5 && ax > 0.07) rc = cAlt;
    else if (kPat > 1.5 && kPat < 2.5 && fract(vK.x * 70.0) < 0.13) rc = mix(rc, cAlt, 0.7);
    else if (kPat > 2.5 && kPat < 3.5 && vK.y > 1.19 && vK.y < 1.235) rc = cAlt;
    else if (kPat > 3.5 && kPat < 4.5) rc = rc * mix(0.55, 1.0, smoothstep(0.95, 1.3, vK.y));
    else if (kPat > 4.5 && kPat < 5.5 && vK.y > 1.30) rc = cAlt;
    else if (kPat > 5.5 && kPat < 6.5 && abs(vK.x + (vK.y - 1.18) * 0.85) < 0.022) rc = cAlt;
    else if (kPat > 6.5 && kPat < 7.5 && fract(vK.x * 22.0 + 0.25) < 0.5) rc = cAlt;
    else if (kPat > 7.5 && kPat < 8.5 && fract(vK.y * 24.0) < 0.5) rc = cAlt;
    else if (kPat > 8.5 && vK.x > 0.0) rc = cAlt;
  }
  if (top && arm && kPat > 8.5 && vRB.y < 0.0) rc = cAlt;
  if (top && arm && kPat > 6.5 && kPat < 7.5) rc = cAlt;
  if (cuff || collar) rc = cTrim;
  if (bot && (kPat < 0.5 || kPat > 2.5) && ax > 0.074) rc = cTrim;            // a stripe down the shorts
  /* socks: a band at the top, the boot's color low */
  if (vRegion > 3.5 && vK.y > 0.742) rc = cTrim;
  /* boots: a stud plate dark, a stripe in the trim, a lighter toe */
  if (vRegion > 2.5 && vRegion < 3.5) {
    float side = abs(abs(vK.x) - 0.0473), yy = vK.y - 0.5;
    if (side > 0.026 && abs(yy - 0.03 + vK.z * 0.22) < 0.009 && vK.z > -0.04 && vK.z < 0.075) rc = cTrim;
    if (vK.y < 0.512) rc = vec3(0.12);
  }
  if (top) rc *= mix(0.86, 1.04, smoothstep(1.0, 1.28, vK.y)) * (arm ? 1.0 : 1.0 - 0.12 * smoothstep(0.055, 0.095, ax));
  if (bot) rc *= mix(0.84, 1.0, smoothstep(0.86, 0.98, vK.y));
  vec4 diffuseColor = vec4( rc, opacity );`);
    };
    m.customProgramCacheKey = () => 'ps-kit4';
    return (MATS[key] = m);
  }

  function wordTex(word, color, edge) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '900 42px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const wd = g.measureText(word.toUpperCase()).width, sc = Math.min(1, 236 / Math.max(1, wd));
    g.save(); g.translate(128, 34); g.scale(sc, 1);
    if (edge) { g.lineWidth = 6; g.strokeStyle = edge; g.strokeText(word.toUpperCase(), 0, 0); }
    g.fillStyle = color; g.fillText(word.toUpperCase(), 0, 0); g.restore();
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  const NUMS = {};
  function numberTex(num, ink, edge) {
    const key = [num, ink, edge].join(); if (NUMS[key]) return NUMS[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.font = '900 80px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = edge ? 10 : 7; g.strokeStyle = edge || 'rgba(0,0,0,.35)'; g.strokeText(String(num), 64, 70);
    g.fillStyle = ink; g.fillText(String(num), 64, 70);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    return (NUMS[key] = new T.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  }
  const CRESTS = {};
  function crestMat(kit) {
    if (CRESTS[kit.ab]) return CRESTS[kit.ab];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    g.beginPath(); g.moveTo(8, 6); g.lineTo(56, 6); g.lineTo(56, 34); g.quadraticCurveTo(56, 54, 32, 60); g.quadraticCurveTo(8, 54, 8, 34); g.closePath();
    g.fillStyle = kit.trim || '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#111'; g.stroke();
    g.fillStyle = kit.c1; g.font = '900 30px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((kit.ab || '?')[0], 32, 33);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    return (CRESTS[kit.ab] = new T.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  }

  /* looks for everyone the user did not design: picked once from his name, so the pitch is not 22 identical heads */
  const HAIRS = ['short', 'short', 'high', 'afro', 'buzz', 'bald', 'buzz', 'short', 'twists', 'short', 'fade', 'fade', 'cornrows', 'bun', 'locs', 'fade', 'mohawk', 'curly', 'curly', 'ponytail', 'long', 'braids', 'spiky'];
  const HAIRC = ['#17110d', '#17110d', '#2b1d12', '#17110d', '#4a3020', '#c9a46a', '#17110d', '#6b4a2b'];
  function autoLook(d) {
    let h = 0; const id = String(d.name || d.num || 'x'); for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const sk = d.skin;
    let hair = HAIRS[h % HAIRS.length], hairColor = HAIRC[(h >> 3) % HAIRC.length];
    if (sk >= 3 && hairColor !== '#17110d' && hairColor !== '#2b1d12') hairColor = '#17110d';
    if (sk <= 1 && (hair === 'afro' || hair === 'twists' || hair === 'cornrows' || hair === 'locs')) hair = 'short';
    if (sk >= 4 && (hair === 'long' || hair === 'ponytail' || hair === 'spiky')) hair = 'curly';
    if (sk <= 1 && hair === 'braids') hair = 'spiky';
    return { hair, hairColor, beard: [null, null, null, 'full', 'stubble', 'goatee', null, null, 'mustache', 'chinstrap', null][(h >> 12) % 11], face: (h >> 24) % 8, band: (h >> 6) % 13 === 0 ? '#f2f2f2' : null };
  }

  /* a player: d = { name, num, skin, look, gk, ref }, kit = { c1, c2, shorts, sock, boot, trim, alt, pat, ab, name } */
  function player(d, kit) {
    const A = window.THREE_ADDONS;
    const root = new T.Group(), body = A.SkeletonUtils.clone(TPL.scene);
    const lk = d.look || autoLook(d);
    /* the build (the look builder's slim, regular, strong) widens the body as in PocketBasketball */
    const sc = (d.ht || 1.82) / TPL.Hs, wide = { slim: 0.97, regular: 1.04, strong: 1.12 }[lk.build] || 1.04;
    body.scale.set(sc * wide, sc, sc * wide);
    root.add(body);
    const skin = SKIN[d.skin == null ? 3 : d.skin] || SKIN[3];
    const gk = !!d.gk;
    const mat = kitMaterial({ skin, jersey: kit.c1, shorts: kit.shorts || kit.c1, sock: kit.sock || kit.c1, boot: lk.boot || d.boot || kit.boot || '#151515', trim: kit.trim || kit.c2, alt: kit.alt || kit.c2, pat: kit.pat || 0, sl: gk || lk.sleeves === 'long' ? 1 : 0 });
    const bones = {};
    let bodyMesh = null;
    body.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = false; if (!bodyMesh) bodyMesh = o; else o.visible = false; } if (o.isBone) bones[bk(o.name)] = o; });
    const sb = new T.SkinnedMesh(TPL.body, mat); sb.frustumCulled = false; bodyMesh.parent.add(sb);
    sb.position.copy(bodyMesh.position); sb.quaternion.copy(bodyMesh.quaternion); sb.scale.copy(bodyMesh.scale); sb.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    bodyMesh.visible = false;
    /* hair, beard and face: the parts this player's look asks for, in his colors */
    const F0 = TPL.face, tv = F0.userData.tv;
    const HV = { short: 1, buzz: 2, high: 3, afro: 4, twists: 5, fade: 6, cornrows: 7, bun: 8, mohawk: 9, locs: 10, curly: 14, ponytail: 15, long: 22, spiky: 34, braids: 35 }, BV = { stubble: 11, goatee: 12, full: 13, mustache: 32, chinstrap: 33 };
    const fN = +lk.face || 0, eyeV = fN < 5 ? 16 + fN : 31 + fN, mouthV = fN < 5 ? 26 + fN : 41 + fN;
    const base = [HV[lk.hair] || 0, lk.hair === 'cornrows' ? 21 : 0, BV[lk.beard] || 0, mouthV, lk.band ? 24 : 0].filter(Boolean);
    const setOf = want => { const key = want.join(','); let ixs = F0.userData.sets[key];
      if (!ixs) { const s = F0.index.array, out = []; for (let t = 0; t < tv.length; t++) if (want.includes(tv[t])) out.push(s[t * 3], s[t * 3 + 1], s[t * 3 + 2]); ixs = F0.userData.sets[key] = F0.attributes.position.count > 65535 ? new T.Uint32BufferAttribute(out, 1) : new T.Uint16BufferAttribute(out, 1); }
      return ixs; };
    const fg = new T.BufferGeometry(); for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) fg.setAttribute(a, F0.attributes[a]); fg.setIndex(setOf(base.concat(eyeV)));
    const hairC = new T.Color(lk.hairColor || '#17110d'), skinC = new T.Color(skin);
    const cOf = { 2: hairC.clone().lerp(skinC, 0.32), 7: hairC.clone().lerp(skinC, 0.5), 11: hairC.clone().lerp(skinC, 0.55), 24: new T.Color(lk.band || '#f2f2f2') }, white = new T.Color('#f4f4f4'), dark = new T.Color('#141011');
    const kc = F0.attributes.kc, vv = new Uint8Array(kc.count), s3 = F0.index.array; for (let t = 0; t < tv.length; t++) { vv[s3[t * 3]] = tv[t]; vv[s3[t * 3 + 1]] = tv[t]; vv[s3[t * 3 + 2]] = tv[t]; }
    const cl = new Float32Array(kc.count * 3);
    for (let i = 0; i < kc.count; i++) { const r = kc.getX(i), c = cOf[vv[i]] || (r < 0.5 ? hairC : r < 1.5 ? white : dark); cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; }
    fg.setAttribute('color', new T.BufferAttribute(cl, 3));
    const fm = new T.SkinnedMesh(fg, new T.MeshLambertMaterial({ vertexColors: true })); fm.frustumCulled = false; bodyMesh.parent.add(fm);
    /* the faces for the moment (the model's own parts, as PocketBasketball wears them): eyes shut for a blink, a yell,
       a grin, a scowl, heavy eyes */
    { const rest = base.filter(v => v !== mouthV);
      fm.userData.sets = { open: fg.index, shut: setOf(base.concat(31)), yell: setOf(base.concat(eyeV, 23)), happy: setOf(rest.concat(46, 36)), stern: setOf(rest.concat(47, 37)), tired: setOf(rest.concat(48, 38)) }; }
    fm.position.copy(bodyMesh.position); fm.quaternion.copy(bodyMesh.quaternion); fm.scale.copy(bodyMesh.scale); fm.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
    /* the number and name on the back, a crest and a small number on the front */
    const lum = c => { const x = parseInt(String(c).slice(1), 16); return (x >> 16) * 0.3 + ((x >> 8) & 255) * 0.59 + (x & 255) * 0.11; };
    const light = lum(kit.c1) > 165, ink = light ? (lum(kit.trim || kit.c2) < 140 ? kit.trim || kit.c2 : '#111111') : '#ffffff', edge = light ? null : '#0c0c0e';
    const H = TPL.H, sp = bones[bk('DEF-spine.003')];
    const put = (dc, obj) => { obj.position.copy(dc.pos); obj.quaternion.copy(dc.quat); sp.add(obj); };
    if (d.num != null) {
      put(TPL.decals.back, new T.Mesh(new T.PlaneGeometry(H * 0.12, H * 0.12), numberTex(d.num, ink, edge)));
      put(TPL.decals.front, new T.Mesh(new T.PlaneGeometry(H * 0.05, H * 0.05), numberTex(d.num, ink, edge)));
    }
    if (d.name && !d.ref) put(TPL.decals.nameBack, new T.Mesh(new T.PlaneGeometry(H * 0.12, H * 0.03), new T.MeshLambertMaterial({ map: wordTex(String(d.name).split(' ').pop(), ink, edge), transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    if (kit.ab && !d.ref) put(TPL.decals.crest, new T.Mesh(new T.PlaneGeometry(H * 0.035, H * 0.035), crestMat(kit)));
    const mixer = new T.AnimationMixer(body), act = {};
    for (const nmn of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Loop', 'Dance_Loop', 'Crouch_Idle_Loop']) {
      const c = TPL.clips[nmn]; if (!c) continue;
      const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); a.time = Math.random() * c.duration; act[nmn] = a;
    }
    act.Idle_Loop.setEffectiveWeight(1);
    const B = n => bones[bk(n)];
    const leg = s => ({ th: B(`DEF-thigh.${s}`), sh: B(`DEF-shin.${s}`), ft: B(`DEF-foot.${s}`), toe: B(`DEF-toe.${s}`) });
    const arm = s => ({ up: B(`DEF-upper_arm.${s}`), fore: B(`DEF-forearm.${s}`), hand: B(`DEF-hand.${s}`) });
    return { root, body, mixer, act, bones, sc, face: fm, blink: 2 + Math.random() * 4, L: leg('L'), R: leg('R'), aL: arm('L'), aR: arm('R'), spine: B('DEF-spine.002'), head: B('DEF-head'), hips: B('DEF-hips'), gph: Math.random() };
  }

  /* ---------- per frame ---------- */
  const _a = V3(), _b = V3(), _q = Q4(), _qw = Q4(), _qp = Q4(), _d = V3();
  /* turn a bone so the segment from it to `tip` points along `dir` (world), by `w` of the way */
  function aim(bone, tip, dir, w) {
    if (!bone || !tip || w <= 0) return;
    bone.getWorldPosition(_a); tip.getWorldPosition(_b);
    _b.sub(_a).normalize();
    _q.setFromUnitVectors(_b, dir);
    bone.getWorldQuaternion(_qw);
    _q.multiply(_qw);
    bone.parent.getWorldQuaternion(_qp).invert().multiply(_q);
    bone.quaternion.slerp(_qp, Math.min(1, w));
    bone.updateMatrixWorld(true);
  }
  /* a direction in the player's own frame (x to his right, y up, z ahead) into the world */
  function dirOf(face, x, y, z) {
    const fx = Math.sin(face), fz = Math.cos(face);
    return _d.set(-fz * x + fx * z, y, fx * x + fz * z).normalize();   // his right is (-fz, 0, fx) when he faces (fx, 0, fz)
  }
  const LOCO = [['Idle_Loop', 0], ['Walk_Loop', 3.4], ['Jog_Fwd_Loop', 9.5], ['Sprint_Loop', 18]];
  const GAIT = [['Jog_Fwd_Loop', [0, 0.18, 0.5, 0.68], 2.65], ['Sprint_Loop', [0.07, 0.2, 0.595, 0.745], 2.5]];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* p: { x, z (world), y (off the ground), face, vx, vz (m/s), act: what he is doing }
     act kinds: kick {t, T, foot, k (how hard 0..1), lob}, head {t, T}, slide {t, T}, dive {t, T, side, h},
     throw {t, T}, catch {t, T}, cele {t, k: 'arms'|'knee'|'slide'|'point'}, sad, fall {t, T}, hold (keeper with ball) */
  function update(m, p, dt) {
    m.root.position.set(p.x, 0, p.z);
    m.root.rotation.y = p.face;
    if (m.face && m.face.userData.sets) {
      m.blink -= dt; const S = m.face.userData.sets;
      let want = p.mood && S[p.mood] ? p.mood : 'open';
      if (want === 'open' && m.blink < 0.12) want = 'shut';
      if (m.blink < 0) m.blink = 2.5 + Math.random() * 4;
      if (m.faceNow !== want) { m.face.geometry.setIndex(S[want]); m.faceNow = want; }
    }
    const a = p.act || null, k = a ? Math.min(1, a.t / a.T) : 0;
    let lean = 0, bank = 0, y = p.y || 0, roll = 0, drop = 0;
    if (dt > 0) {
      const ax = (p.vx - (m.pvx ?? p.vx)) / dt, az = (p.vz - (m.pvz ?? p.vz)) / dt, f = p.face; m.pvx = p.vx; m.pvz = p.vz;
      const run = smooth(2.5, 6, Math.hypot(p.vx, p.vz)), fw = ax * Math.sin(f) + az * Math.cos(f), lat = ax * -Math.cos(f) + az * Math.sin(f);
      m.bank = (m.bank || 0) + (Math.max(-0.22, Math.min(0.22, lat * 0.03)) * run - (m.bank || 0)) * Math.min(1, dt * 5);
      m.pitch = (m.pitch || 0) + (Math.max(-0.12, Math.min(0.16, fw * 0.022)) * Math.max(run, 0.4) - (m.pitch || 0)) * Math.min(1, dt * 5);
    }
    if (a && a.k === 'slide') { const s = smooth(0, 0.18, k) * (1 - smooth(0.78, 1, k)); lean = -1.05 * s; y = 0.06 * s; roll = 0.18 * s; }
    if (a && a.k === 'dive') { const s = Math.sin(Math.PI * Math.min(1, k * 1.3)); bank = (a.side || 1) * -1.3 * smooth(0, 0.3, k) * (1 - smooth(0.8, 1, k)); y = Math.max(y, 0.3 + (a.h || 0.5) * s); if (k > 0.75) y *= 1 - smooth(0.75, 1, k); }
    if (a && a.k === 'fall') { const f = smooth(0, 0.25, k) * (1 - smooth(0.75, 1, k)); lean = -1.35 * f; y = Math.max(y, 0.16 * f); }
    if (a && a.k === 'kick') lean = (a.lob ? -0.18 : 0.08) * Math.sin(Math.PI * k);
    if (a && a.k === 'head') { y = Math.max(y, 0.45 * Math.sin(Math.PI * k)); lean = 0.3 * Math.sin(Math.PI * Math.min(1, k * 1.4)) - 0.12; }
    if (a && a.k === 'cele' && a.c === 'knee') { drop = 0.45 * smooth(0, 0.3, k); lean = -0.35; }
    if (p.sad) lean = 0.32;
    m.lean = (m.lean || 0) + (lean - (m.lean || 0)) * Math.min(1, dt * 12 || 1);
    m.body.rotation.x = m.lean + (m.pitch || 0);
    m.body.rotation.z = ((m.bank || 0) + bank) * (TPL.sideR < 0 ? 1 : -1) + roll * 0;
    m.body.position.y = y - drop;
    if (roll) m.body.rotation.z += roll * (TPL.sideR < 0 ? 1 : -1);
    /* legs from the clips, blended by speed, the stride fitted to the ground */
    const sp = Math.min(Math.hypot(p.vx, p.vz), 11) * FT;
    const ws = {};
    for (let i = 0; i < LOCO.length; i++) {
      const [n, v] = LOCO[i], lo = i ? LOCO[i - 1][1] : -1, hi = i < LOCO.length - 1 ? LOCO[i + 1][1] : 1e9;
      ws[n] = sp <= v ? (i ? smooth(lo, v, sp) : 1 - smooth(v, hi, sp)) : (i < LOCO.length - 1 ? 1 - smooth(v, hi, sp) : 1);
    }
    const air = (a && (a.k === 'head' || a.k === 'dive')) || y > 0.25;
    const dance = a && a.k === 'cele' && a.c === 'dance' ? 1 : 0;
    const crouch = p.ready ? 0.55 : a && a.k === 'cele' && a.c === 'knee' ? 1 : 0;
    const rest = Math.max(0, 1 - (air ? 1 : 0) - dance);
    const kk = dt ? Math.min(1, dt * 10) : 1;
    const set = (n, wt) => { const ac = m.act[n]; if (!ac) return; ac.weight = (ac.weight || 0) + (wt - (ac.weight || 0)) * kk; ac.setEffectiveWeight(ac.weight); };
    m.crouch = (m.crouch || 0) + (crouch - (m.crouch || 0)) * Math.min(1, dt * 8 || 1);
    for (const [n] of LOCO) set(n, ws[n] * rest * (1 - m.crouch));
    set('Crouch_Idle_Loop', rest * m.crouch); set('Jump_Loop', air ? 1 : 0); set('Dance_Loop', dance);
    { const scl = (d => d)(((p.ht || 1.82) * FT) / 6.1), vN = sp / scl, cad = vN < 3.3 ? Math.max(0.9, 0.6 * vN) : vN < 11 ? 1.98 + (vN - 3.3) * 0.1 : Math.min(4.3, 2.75 + (vN - 11) * 0.121);
      const hv = Math.hypot(p.vx, p.vz), back = hv > 1 && (p.vx * Math.sin(p.face) + p.vz * Math.cos(p.face)) / hv < -0.35 ? -1 : 1;
      m.gph = (m.gph + back * dt * cad / 2 + 1) % 1; const ph = m.gph, Tc = 2 / cad;
      const place = (ac, t) => { if (!ac) return; ac.timeScale = 0; ac.time = (((t % 1) + 1) % 1) * ac.getClip().duration; };
      place(m.act.Walk_Loop, 0.99 + ph);
      for (const [n, K, travel] of GAIT) { const s = Math.min(0.45, Math.max(0.16, travel / Math.max(vN, 3) / Tc)), q = ph < 0.5 ? ph : ph - 0.5, a0 = ph < 0.5 ? K[0] : K[2], a1 = ph < 0.5 ? K[1] : K[3], a2 = ph < 0.5 ? K[2] : K[0] + 1;
        place(m.act[n], q < s ? a0 + (a1 - a0) * q / s : a1 + (a2 - a1) * (q - s) / (0.5 - s)); } }
    m.mixer.update(Math.max(dt, 1e-4));   // (a zero step does not reapply the clips: a paused frame would keep the last pose set in code)
    if (!a && !p.hold && !p.sad && !p.ready) return;
    m.root.updateMatrixWorld(true);
    const f = p.face;
    /* the kicking leg: back, then through the ball and up; the knee bends on the way back and snaps straight */
    if (a && a.k === 'kick') {
      const L = a.foot === 'L' ? m.L : m.R, ph = k;
      const back = smooth(0, 0.38, ph) * (1 - smooth(0.38, 0.56, ph)), thru = smooth(0.4, 0.62, ph) * (1 - smooth(0.85, 1, ph));
      const swing = -0.55 * back + (a.lob ? 1.15 : 0.95) * thru * (0.7 + 0.3 * (a.p || 0.6));
      const side = (a.foot === 'L' ? -1 : 1) * 0.12;
      aim(L.th, L.sh, dirOf(f, side, -Math.cos(swing), Math.sin(swing)), 0.95);
      const kneeA = swing - 1.2 * back - 0.2 * thru;
      aim(L.sh, L.ft, dirOf(f, side, -Math.cos(kneeA), Math.sin(kneeA)), 0.9);
      /* arms out for balance, the other one swinging across */
      const o = a.foot === 'L' ? m.aR : m.aL, s2 = a.foot === 'L' ? m.aL : m.aR, ow = a.foot === 'L' ? 1 : -1;
      aim(o.up, o.fore, dirOf(f, ow * 0.9, -0.25, -0.2 + 0.4 * thru), 0.8 * Math.sin(Math.PI * ph));
      aim(s2.up, s2.fore, dirOf(f, -ow * 0.5, -0.6, 0.5 * thru), 0.6 * Math.sin(Math.PI * ph));
    }
    if (a && a.k === 'head') { const s = Math.sin(Math.PI * k); for (const [ar, sd] of [[m.aL, -1], [m.aR, 1]]) aim(ar.up, ar.fore, dirOf(f, sd * 0.8, 0.1, 0.4), 0.7 * s); }
    if (a && a.k === 'slide') {
      /* down on the hip, the leading leg straight out along the grass, the other tucked under, a hand down behind */
      const s = smooth(0, 0.18, k) * (1 - smooth(0.78, 1, k));
      aim(m.R.th, m.R.sh, dirOf(f, 0.08, -0.12, 1), 0.95 * s); aim(m.R.sh, m.R.ft, dirOf(f, 0.08, -0.1, 1), 0.95 * s);
      aim(m.L.th, m.L.sh, dirOf(f, -0.15, -0.25, 0.95), 0.9 * s); aim(m.L.sh, m.L.ft, dirOf(f, -0.1, -0.35, -0.9), 0.9 * s);
      aim(m.aL.up, m.aL.fore, dirOf(f, -0.6, -0.75, -0.3), 0.9 * s); aim(m.aR.up, m.aR.fore, dirOf(f, 0.7, 0.2, 0.3), 0.6 * s);
    }
    if (a && a.k === 'dive') {
      const s = smooth(0, 0.3, k) * (1 - smooth(0.85, 1, k)), sd = a.side || 1;
      for (const ar of [m.aL, m.aR]) { aim(ar.up, ar.fore, dirOf(f, sd * 0.85, 0.5, 0.15), 0.95 * s); aim(ar.fore, ar.hand, dirOf(f, sd * 0.85, 0.5, 0.15), 0.95 * s); }
    }
    if ((a && (a.k === 'throw' || a.k === 'catch')) || p.hold) {
      const ph = a ? k : 0.5, up = a && a.k === 'throw' ? (ph < 0.5 ? 1 : 1 - smooth(0.5, 0.8, ph)) : 0;
      for (const [ar, sd] of [[m.aL, -1], [m.aR, 1]]) {
        if (up) aim(ar.up, ar.fore, dirOf(f, sd * 0.2, 0.9, -0.35 + 0.9 * (1 - up)), 0.95);
        else { aim(ar.up, ar.fore, dirOf(f, sd * 0.25, -0.35, 0.9), 0.9); aim(ar.fore, ar.hand, dirOf(f, -sd * 0.3, 0.1, 0.9), 0.8); }
      }
    }
    if (a && a.k === 'cele') {
      const s = smooth(0, 0.2, k);
      const both = (x, y, z) => { for (const [ar, sd] of [[m.aL, -1], [m.aR, 1]]) { aim(ar.up, ar.fore, dirOf(f, sd * x, y, z), 0.95 * s); aim(ar.fore, ar.hand, dirOf(f, sd * x, y, z), 0.9 * s); } };
      if (a.c === 'arms' || a.c === 'knee') both(0.55, 0.85, 0.1);
      if (a.c === 'point') { aim(m.aR.up, m.aR.fore, dirOf(f, 0.25, 0.97, 0.1), 0.95 * s); aim(m.aR.fore, m.aR.hand, dirOf(f, 0.25, 0.97, 0.1), 0.95 * s); aim(m.aL.up, m.aL.fore, dirOf(f, -0.25, 0.97, 0.1), 0.95 * s); aim(m.aL.fore, m.aL.hand, dirOf(f, -0.25, 0.97, 0.1), 0.95 * s); }
      if (a.c === 'plane') both(1, -0.05, 0);
    }
    if (p.sad) for (const [ar, sd] of [[m.aL, -1], [m.aR, 1]]) aim(ar.up, ar.fore, dirOf(f, sd * 0.4, 0.5, 0.6), 0.6);
  }

  /* A picture of a player from the 3D model (PocketBasketball's R.portrait, in metres): a headshot (o.close) or the
     whole body (o.body, o.back for the back of the shirt), any kit, on a transparent background, as a data URL. One
     off-screen renderer draws every picture (a squad of headshots would run out of WebGL contexts otherwise), and
     each picture is kept, so a face is drawn once. */
  let PR = null; const PICS = new Map();
  function portrait(d, kit, size, o) {
    if (!TPL) return null;
    o = o || {};
    const key = [d.name, d.num, d.skin, JSON.stringify(d.look || ''), kit.c1, kit.c2, kit.pat, size, o.body ? 1 : 0, o.back ? 1 : 0, o.mood || '', o.yaw || 0].join('|');
    if (PICS.has(key)) return PICS.get(key);
    try {
      const Wd = size || 160, Hh = o.body ? Math.round(Wd * 1.6) : Wd;
      if (!PR) { const cv = document.createElement('canvas'); PR = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: true }); PR.setPixelRatio(1); PR.outputColorSpace = T.SRGBColorSpace; }
      PR.setSize(Wd, Hh, false); PR.setClearColor(0x000000, 0);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x303034, 1.2)); const k = new T.DirectionalLight(0xffffff, 0.9); k.position.set(2, 4, o.back ? -6 : 6); sc.add(k);
      const rim = new T.DirectionalLight(0xffffff, 0.35); rim.position.set(-3, 2, o.back ? 5 : -5); sc.add(rim);
      const m = player(d, kit); sc.add(m.root);
      if (o.mood && m.face && m.face.userData.sets[o.mood]) m.face.geometry.setIndex(m.face.userData.sets[o.mood]);
      if (o.yaw) m.root.rotation.y = o.yaw;
      m.act.Idle_Loop.time = 0.5; m.mixer.update(0.3); m.root.updateMatrixWorld(true);
      const H = d.ht || 1.82, c = new T.PerspectiveCamera(28, Wd / Hh, 0.05, 40);
      if (o.body) { const z = o.back ? -1 : 1; c.position.set(0.45 * z, H * 0.55, 4.6 * z); c.lookAt(0, H * 0.5, 0); }
      else { const hp = m.head.getWorldPosition(new T.Vector3()); hp.y += 0.11; c.position.set(hp.x + 0.08, hp.y + 0.04, hp.z + (o.wide ? 1.35 : 1.05)); c.lookAt(hp); }
      PR.render(sc, c);
      const url = PR.domElement.toDataURL('image/png');
      if (m.face) m.face.geometry.dispose();
      if (PICS.size > 200) PICS.clear();
      PICS.set(key, url);
      return url;
    } catch (e) { console.warn('portrait', e); return null; }
  }
  PS.Model = { load, ready: () => !!TPL, player, update, autoLook, portrait, tpl: () => TPL };
})();
