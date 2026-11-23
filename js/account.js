/* PocketSoccer: accounts. One email and password for all the pocket games: the same Firebase project as PocketFootball
   and PocketBasketball (blockfootball-a13c9), so an account made in either works here. Signed in, your PocketSoccer
   save is kept at soccer/<your id> (its own place: basketball's save is at saves/<id> and is never touched), going up
   a few seconds after the game saves and when the app goes to the background; a new phone picks it up. Only you can
   read or write it, and only signed in with your password (docs/firebase-rules.json). Nothing touches the network
   until you open the Account page or an account is already signed in on this phone. Ported, smaller, from
   PocketBasketball's js/account.js. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } };
  const KEY = 'pocketsoccer.acct', DEV = 'pocketsoccer.dev', SAVE = 'pocketsoccer.career.v1';
  const dev = () => { let d = load(DEV, null); if (!d) { d = Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); keep(DEV, d); } return d; };
  /* the project's public web configuration (it is meant to be in a web page; the rules protect the data) */
  const CFG = { apiKey: 'AIzaSyC1TuSiIplRT4FeNyIZ3EoHzAJ4PM1dFxY', authDomain: 'blockfootball-a13c9.firebaseapp.com', databaseURL: 'https://blockfootball-a13c9-default-rtdb.firebaseio.com',
    projectId: 'blockfootball-a13c9', storageBucket: 'blockfootball-a13c9.firebasestorage.app', messagingSenderId: '884284719107', appId: '1:884284719107:web:ebc6b62de8d3392f974e36' };
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const LIBS = [['firebase/13.3.0/firebase-app-compat.min.js', 'sha512-oHf9Mxpj4w5nAfX1hYuR7S/0Lej2ss39sFE1Xf24qW3sv8S7/4zEM+OyHehoTi1WgvRFNiDcsAyw6RUVHAksVw=='],
    ['firebase/13.3.0/firebase-auth-compat.min.js', 'sha512-8vw8IBHALgT6QTxD2B51SnqO3SvxZHyhkBQjFlJno/anAWikb6/9qHg3OvuIXbSPNLFT/r0FunXFllMMYlUfSA=='],
    ['firebase/13.3.0/firebase-database-compat.min.js', 'sha512-SC1sn3CB7/UoeTW2YolbaA3c1yW739R1jbHLsiLIrvSadZKgUa8ZaOKU3Qqczs4ctuKXVr3zozZ/k1Hi5MhfZg==']];
  let libsP = null, app = null, auth = null, db = null, user = null, conflict = null, msg = '', back = null, pushT = 0;
  const script = ([f, sri]) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = CDN + f; s.integrity = sri; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const libs = () => (libsP = libsP || LIBS.reduce((p, f) => p.then(() => script(f)), Promise.resolve()).catch(e => { libsP = null; throw e; }));
  const U = u => u && !u.isAnonymous ? { uid: u.uid, email: u.email || '', name: u.displayName || '' } : null;
  async function init() {
    if (auth) return user;
    await libs();
    const F = window.firebase;
    app = F.apps.find(a => a.name === 'ps') || F.initializeApp(CFG, 'ps'); auth = app.auth(); db = app.database();
    user = await new Promise(r => { const off = auth.onAuthStateChanged(x => { off(); r(U(x)); }); });
    return user;
  }
  const A = () => load(KEY, {});
  const local = () => { try { return localStorage.getItem(SAVE); } catch (e) { return null; } };
  const localAt = () => A().changed || 0;

  /* ---------- the copy in the cloud ---------- */
  async function pull() { const s = await db.ref('soccer/' + user.uid).once('value'); return s.val(); }
  async function upload() {
    const data = local(); if (!data || !user) return;
    const at = Date.now(), C = PS.career.C;
    await db.ref('soccer/' + user.uid).set({ at, dev: dev(), z: 0, data, name: C ? String(C.name).slice(0, 24) : '' });
    keep(KEY, Object.assign(A(), { synced: at, changed: Math.max(localAt(), at) }));
  }
  function take(rec) {
    let o = null; try { o = JSON.parse(rec.data); } catch (e) { o = null; }
    if (!o || o.v !== 1 || !o.league || !o.a) { msg = 'The save in your account could not be read.'; return false; }
    try { localStorage.setItem(SAVE, rec.data); } catch (e) { msg = 'This phone ran out of room for your save.'; return false; }
    keep(KEY, Object.assign(A(), { synced: rec.at, changed: rec.at })); PS.career.load(); return true;
  }
  /* bring the two into line: newer wins when only one side moved; both moved, the player chooses */
  async function sync() {
    if (!user) return;
    try {
      const rec = await pull(), a = A(), mine = local();
      if (!rec) { if (mine) await upload(); return; }
      if (!mine) { take(rec); return; }
      if (rec.data === mine) { keep(KEY, Object.assign(a, { synced: rec.at })); return; }
      const cloudMoved = rec.at > (a.synced || 0), localMoved = localAt() > (a.synced || 0);
      if (cloudMoved && localMoved) conflict = rec;
      else if (cloudMoved) take(rec);
      else await upload();
    } catch (e) { msg = /permission/i.test(String(e && (e.code || e.message))) ? 'The account service is not open to PocketSoccer yet.' : 'Could not reach your account. Try again later.'; }
  }
  /* the career saved: note it, and send it up a few seconds later */
  function saved() { keep(KEY, Object.assign(A(), { changed: Date.now() })); if (!user) return; clearTimeout(pushT); pushT = setTimeout(() => upload().catch(() => {}), 4000); }
  document.addEventListener('visibilitychange', () => { if (document.hidden && user && localAt() > (A().synced || 0)) upload().catch(() => {}); });

  /* ---------- the page ---------- */
  const ERR = { 'auth/invalid-email': 'That email address does not look right.', 'auth/email-already-in-use': 'That email already has an account: sign in instead.', 'auth/weak-password': 'Pick a longer password (6 characters or more).',
    'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email.', 'auth/too-many-requests': 'Too many tries. Wait a minute.', 'auth/network-request-failed': 'No connection.' };
  const errText = e => ERR[e && e.code] || 'Something went wrong. Try again.';
  function page(html) { const s = $('#screen'); s.className = ''; s.innerHTML = `<div class="page acct"><button class="back" id="bk">‹ Back</button>${html}</div>`; s.hidden = false; s.scrollTop = 0; $('#bk').onclick = () => back && back(); }
  async function open(from) {
    back = from; page('<h2>Account</h2><p class="mute">Connecting…</p>');
    try { await init(); if (user) await sync(); } catch (e) { msg = 'Could not reach the account service.'; }
    draw();
  }
  function draw() {
    if (conflict) {
      const c = conflict;
      return page(`<h2>Two saves</h2><p>This phone and your account were both played since they last agreed. Which one do you keep?</p>
        <button class="go" id="kcloud">Keep the account's save<small>${esc(c.name || 'your career')} · saved ${new Date(c.at).toLocaleString()}</small></button>
        <button class="btn2" id="klocal">Keep this phone's save<small>${esc(PS.career.C ? PS.career.C.name : '')}</small></button>`), wireC();
    }
    if (user) {
      page(`<h2>Account</h2><p>Signed in as <b>${esc(user.name || user.email)}</b><br><span class="mute">${esc(user.email)}</span></p>
        <p class="mute">One account for PocketSoccer, PocketBasketball and PocketFootball. Your PocketSoccer career is kept in it and comes back on any phone you sign in on.</p>
        ${msg ? `<p class="callout">${esc(msg)}</p>` : `<p class="mute">Last copied: ${A().synced ? new Date(A().synced).toLocaleString() : 'not yet'}</p>`}
        <button class="go" id="upnow">Save to my account now</button><button class="btn2" id="out">Sign out</button>`);
      $('#upnow').onclick = async () => { msg = ''; try { await upload(); } catch (e) { msg = errText(e); } draw(); };
      $('#out').onclick = async () => { await auth.signOut(); user = null; draw(); };
      return;
    }
    page(`<h2>Account</h2><p class="mute">Sign in to keep your career in the cloud and play it on any phone. The same account works in PocketBasketball and PocketFootball. You can play without one.</p>
      ${msg ? `<p class="callout">${esc(msg)}</p>` : ''}
      <label>Name<input id="an" maxlength="24" autocomplete="nickname" placeholder="Only for a new account"></label>
      <label>Email<input id="ae" type="email" autocomplete="email"></label><label>Password<input id="ap" type="password" autocomplete="current-password"></label>
      <button class="go" id="ain">Sign in</button><button class="btn2" id="aup">Create an account</button><button class="btn2 sm" id="arst">Forgot password</button>`);
    const v = id => ($(id).value || '').trim();
    $('#ain').onclick = async () => { msg = ''; try { user = U((await auth.signInWithEmailAndPassword(v('#ae'), $('#ap').value)).user); await sync(); } catch (e) { msg = errText(e); } draw(); };
    $('#aup').onclick = async () => { msg = ''; try { const r = await auth.createUserWithEmailAndPassword(v('#ae'), $('#ap').value); await r.user.updateProfile({ displayName: v('#an') || 'Player' }); r.user.sendEmailVerification().catch(() => {}); user = U(r.user); await sync(); } catch (e) { msg = errText(e); } draw(); };
    $('#arst').onclick = async () => { msg = ''; try { await auth.sendPasswordResetEmail(v('#ae')); msg = 'A reset link is on its way to that email.'; } catch (e) { msg = errText(e); } draw(); };
  }
  function wireC() {
    $('#kcloud').onclick = () => { take(conflict); conflict = null; draw(); };
    $('#klocal').onclick = async () => { conflict = null; try { await upload(); } catch (e) { msg = errText(e); } draw(); };
  }
  /* on start: if this phone was signed in before, quietly sync */
  function start() { if (A().was) init().then(u => { if (u) return sync(); }).catch(() => {}); }
  const mark = () => { if (user) keep(KEY, Object.assign(A(), { was: true })); };
  setInterval(mark, 5000);
  PS.account = { open, saved, start, signedIn: () => !!user };
})();
