/* PocketSoccer: screens. The menu, Kick-off, a new career and its hub, match day (the 3D match with its scorebug,
   pause menu, half time and full time), the season's end. Menus draw into #screen; a match runs in #game. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const D = PS.data, K = PS.career;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let scr, game, tab = 'home', modelP = null;
  const SKEY = 'pocketsoccer.settings';
  const S = Object.assign({ half: 180, zoom: 1, sound: true }, (() => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) { return {}; } })());
  const saveS = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

  function boot() {
    const app = document.getElementById('app');
    app.innerHTML = `<div id="game" hidden><div id="view"></div>
      <div id="hud"><div class="bug" id="bug"></div><button id="pz" aria-label="Pause"><span></span><span></span></button><div id="toasts"></div><div id="banner"></div></div>
      <div id="ov" hidden></div></div><div id="screen"></div>`;
    scr = $('#screen'); game = $('#game');
    if (PS.R3 && PS.R3.init) { try { PS.R3.init($('#view')); } catch (e) { console.error('PocketSoccer: 3D', e); } }
    PS.Controls.mount(game);
    $('#pz').addEventListener('click', pause);
    PS.R3.zoom = S.zoom; PS.Audio.on = S.sound;
    modelP = PS.Model ? PS.Model.load() : Promise.resolve(null);
    K.load();
    menu();
  }
  const crest = (c, size = 34) => `<span class="crest" style="--c1:${c.c1};--c2:${c.c2};width:${size}px;height:${size}px"><b>${c.ab[0]}</b></span>`;
  function show(html, cls = '') { game.hidden = true; scr.hidden = false; scr.className = cls; scr.innerHTML = html; scr.scrollTop = 0; }
  function on(sel, fn) { scr.querySelectorAll(sel).forEach(el => el.addEventListener('click', fn)); }
  const seg = (k, opts, cur) => `<div class="seg" data-k="${k}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  function segs(st, after) { scr.querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st[s.dataset.k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); after && after(); })); }

  /* ------------------------------------------------------------ menu */
  function menu() {
    const c = K.C;
    show(`<div class="menu">
      <div class="logo"><div class="ball"></div><h1>Pocket<b>Soccer</b></h1><p>11 v 11 in your pocket. Your career.</p></div>
      ${c ? `<button class="go" id="cont">My Career<small>${esc(c.name)} · ${esc(K.club().name)} · Season ${c.season}</small></button>` : ''}
      <button class="${c ? 'btn2' : 'go'}" id="new">${c ? 'New career' : 'My Career'}${c ? '' : '<small>From 17-year-old debut to retirement</small>'}</button>
      <button class="btn2" id="ko">Kick-off<small>A full match, you run the whole team</small></button>
      <div class="row2"><button class="btn2" id="how">How to play</button><button class="btn2" id="set">Settings</button></div>
      <p class="fine">Every club and player is fictional</p></div>`, 'menu-s');
    on('#cont', hub); on('#new', () => c ? confirmNew() : newCareer()); on('#ko', kickoffSetup); on('#how', how); on('#set', settings);
  }
  function confirmNew() {
    show(`<div class="page"><h2>Start again?</h2><p>This replaces ${esc(K.C.name)}’s career on this device.</p>
      <button class="go danger" id="yes">Yes, start a new career</button><button class="btn2" id="no">Keep my career</button></div>`);
    on('#yes', () => { K.wipe(); newCareer(); }); on('#no', menu);
  }
  function settings() {
    const st = { half: S.half, zoom: S.zoom, sound: S.sound ? 1 : 0 };
    show(`<div class="page"><button class="back" id="bk">‹ Menu</button><h2>Settings</h2>
      <div class="lbl">Half length</div>${seg('half', [[120, '2 min'], [180, '3 min'], [240, '4 min'], [360, '6 min']], st.half)}
      <p class="sub">Real minutes a half. The match clock still runs to 90.</p>
      <div class="lbl">Camera</div>${seg('zoom', [[0.85, 'Close'], [1, 'Normal'], [1.2, 'Wide']], st.zoom)}
      <div class="lbl">Sound</div>${seg('sound', [[1, 'On'], [0, 'Off']], st.sound)}
      <button class="go" id="ok">Save</button></div>`);
    segs(st);
    on('#bk', menu);
    on('#ok', () => { S.half = st.half; S.zoom = st.zoom; S.sound = !!st.sound; PS.R3.zoom = S.zoom; PS.Audio.on = S.sound; saveS(); menu(); });
  }

  /* ------------------------------------------------------------ kick-off */
  function kickoffSetup() {
    const st = { a: 0, b: 1, half: S.half };
    const list = k => D.CLUBS.map((c, i) => `<button class="clubc sm ${st[k] === i ? 'on' : ''}" data-k="${k}" data-i="${i}">${crest(c, 26)}<span><b>${c.name}</b><small>rated ${c.ovr}</small></span></button>`).join('');
    const draw = () => {
      show(`<div class="page"><button class="back" id="bk">‹ Menu</button><h2>Kick-off</h2>
        <div class="vs">${crest(D.CLUBS[st.a], 40)}<b>${D.CLUBS[st.a].ab}</b><span>v</span><b>${D.CLUBS[st.b].ab}</b>${crest(D.CLUBS[st.b], 40)}</div>
        <div class="lbl">Half length</div>${seg('half', [[120, '2 min'], [180, '3 min'], [240, '4 min'], [360, '6 min']], st.half)}
        <button class="go" id="play">Kick off</button>
        <div class="two"><div><div class="lbl">Your team</div>${list('a')}</div><div><div class="lbl">Opponent</div>${list('b')}</div></div></div>`);
      segs(st);
      on('#bk', menu);
      on('.clubc', e => { const b = e.currentTarget; st[b.dataset.k] = +b.dataset.i; if (st.a === st.b) st[b.dataset.k === 'a' ? 'b' : 'a'] = (st.a + 1) % D.CLUBS.length; draw(); });
      on('#play', () => playMatch({ teams: [D.CLUBS[st.a], D.CLUBS[st.b]], mode: 'team', halfLen: st.half }, G => kickoffResult(G, st)));
    };
    draw();
  }
  function teamStats(G) {
    const s = G.stats, tp = s[0].poss + s[1].poss || 1;
    const row = (t, a, b) => `<tr><td>${a}</td><td class="l2">${t}</td><td>${b}</td></tr>`;
    return `<table class="tstat"><tbody>
      ${row('Possession', Math.round(s[0].poss / tp * 100) + '%', Math.round(s[1].poss / tp * 100) + '%')}
      ${row('Shots', s[0].shots, s[1].shots)}${row('On target', s[0].onT, s[1].onT)}
      ${row('Passes', `${s[0].passOk}/${s[0].passes}`, `${s[1].passOk}/${s[1].passes}`)}
      ${row('Corners', s[0].corners, s[1].corners)}${row('Fouls', s[0].fouls, s[1].fouls)}${row('Saves', s[0].saves, s[1].saves)}</tbody></table>`;
  }
  const scorerList = G => `<ul class="scorers">${G.scorers.map(s => `<li class="${s.side ? 'them' : ''} ${s.you ? 'you' : ''}">⚽ ${esc(s.name)} ${s.min}'${s.side ? ` (${G.teams[1].club.ab})` : ''}</li>`).join('')}</ul>`;
  function kickoffResult(G, st) {
    const a = G.teams[0].club, b = G.teams[1].club;
    show(`<div class="page result"><div class="lbl">Full time</div>
      <div class="vs big">${crest(a, 44)}<b>${G.score[0]}–${G.score[1]}</b>${crest(b, 44)}</div>
      <p class="center">${a.name} v ${b.name}</p>${scorerList(G)}${teamStats(G)}
      <button class="go" id="again">Play again</button><button class="btn2" id="mn">Menu</button></div>`);
    on('#again', () => playMatch({ teams: [a, b], mode: 'team', halfLen: st.half }, G2 => kickoffResult(G2, st)));
    on('#mn', menu);
  }

  /* ------------------------------------------------------------ the match */
  let M = null;
  async function playMatch(o, onEnd) {
    scr.hidden = true; game.hidden = false;
    const ov = $('#ov');
    ov.hidden = false; ov.innerHTML = '<div class="load"><div class="ball"></div><p>Players walking out…</p></div>';
    PS.R3.resize();
    await modelP;
    const G = PS.Match.create(o);
    M = { G, onEnd, last: performance.now(), acc: 0, paused: false, toasts: [] };
    PS.R3.attach(G); PS.Controls.attach(G);
    if (S.sound) PS.Audio.start();
    ov.hidden = true;
    /* on the bench: the match runs on (not drawn) until you come on */
    if (G.me && G.me.bench) {
      const onMin = G.sub ? G.sub.on : 91;
      ov.hidden = false; ov.innerHTML = `<div class="card"><div class="lbl">On the bench</div><h3>${onMin > 90 ? 'The manager keeps you on the bench today.' : `Warm up: you’re coming on around the ${onMin}th minute.`}</h3><button class="go" id="goon">${onMin > 90 ? 'Watch the result' : 'Get ready'}</button></div>`;
      $('#goon').onclick = () => {
        let guard = 0;
        while (!G.over && G.me.bench && guard++ < 400) PS.Match.fastForward(G, 2);
        G.feed.length = Math.min(G.feed.length, 60); G.events.length = 0;
        ov.hidden = true;
        if (G.over) return finish();
      };
    }
    requestAnimationFrame(loop);
  }
  function loop(now) {
    if (!M) return;
    const G = M.G, dt = Math.min(0.05, (now - M.last) / 1000); M.last = now;
    const ovOpen = !$('#ov').hidden;
    if (!M.paused && !ovOpen && G.phase !== 'half' && !G.over) { M.acc += dt; let n = 0; while (M.acc >= 1 / 60 && n++ < 5) { PS.Match.step(G, 1 / 60); M.acc -= 1 / 60; } if (n >= 5) M.acc = 0; }
    const evs = G.events.splice(0);
    if (S.sound) PS.Audio.events(G, evs);
    for (const e of evs) hudEvent(G, e);
    PS.Audio.tick(G, dt);
    PS.Controls.tick();
    hud(G);
    PS.R3.frame(M.paused || ovOpen ? 0 : dt * (G.slow || 1));
    if (G.phase === 'half' && !M.ht) halfTime();
    if (G.me && G.me.off && !M.offShown && !G.over) subbedOff();
    if (G.over && !M.ending) { M.ending = true; PS.Controls.show(false); setTimeout(finish, 2600); }
    requestAnimationFrame(loop);
  }
  let bugKey = '';
  function hud(G) {
    const t0 = G.teams[0].club, t1 = G.teams[1].club, min = PS.Match.minute(G);
    const k = [G.score[0], G.score[1], min, G.half].join();
    if (k !== bugKey) { bugKey = k; $('#bug').innerHTML = `<i style="background:${t0.c1}"></i><b>${t0.ab}</b><u>${G.score[0]}–${G.score[1]}</u><b>${t1.ab}</b><i style="background:${t1.c1}"></i><em>${Math.min(min, G.half * 45)}'${min > G.half * 45 ? '+' : ''}</em>`; }
    PS.Controls.show(!G.over && G.phase !== 'goal' && !(G.me && (G.me.bench || G.me.off)));
  }
  function hudEvent(G, e) {
    if (e.k === 'goal') {
      const mine = e.t === 0, by = e.by, b = $('#banner');
      b.className = 'show ' + (mine ? 'us' : 'them');
      b.innerHTML = `<b>GOAL!</b><span>${esc(by ? by.name : '')}${e.assist ? ` · assist ${esc(e.assist.name)}` : ''}</span>`;
      setTimeout(() => { b.className = ''; }, 2800);
      if (navigator.vibrate && mine) try { navigator.vibrate([40, 60, 80]); } catch (x) { /* no vibration */ }
    }
    if (e.k === 'say' && e.kind && !/goal|ko/.test(e.kind)) toast(e.t, e.kind);
  }
  function toast(t, kind) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = t;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2300); setTimeout(() => el.remove(), 2800);
  }
  function halfTime() {
    const G = M.G; M.ht = true;
    const ov = $('#ov'); ov.hidden = false;
    ov.innerHTML = `<div class="card"><div class="lbl">Half time</div><div class="vs big">${crest(G.teams[0].club, 36)}<b>${G.score[0]}–${G.score[1]}</b>${crest(G.teams[1].club, 36)}</div>${scorerList(G)}${teamStats(G)}<button class="go" id="h2">Second half</button></div>`;
    $('#h2').onclick = () => { ov.hidden = true; PS.Match.resume(G); M.last = performance.now(); };
  }
  function subbedOff() {
    M.offShown = true;
    const ov = $('#ov'); ov.hidden = false;
    ov.innerHTML = `<div class="card"><div class="lbl">Substituted</div><h3>Your number’s up. Good shift.</h3><button class="go" id="sim">See the result</button><button class="btn2" id="watch">Watch from the bench</button></div>`;
    $('#sim').onclick = () => { ov.hidden = true; simToEnd(); };
    $('#watch').onclick = () => { ov.hidden = true; M.last = performance.now(); };
  }
  function simToEnd() { const G = M.G; let guard = 0; while (!G.over && guard++ < 400) PS.Match.fastForward(G, 4); }
  function pause() {
    if (!M || M.ending) return;
    M.paused = true;
    const G = M.G, ov = $('#ov'); ov.hidden = false;
    const career = G.mode === 'player';
    ov.innerHTML = `<div class="card"><div class="lbl">Paused · ${PS.Match.minute(G)}'</div><div class="vs">${crest(G.teams[0].club, 30)}<b>${G.score[0]}–${G.score[1]}</b>${crest(G.teams[1].club, 30)}</div>
      <button class="go" id="res">Resume</button>
      <div class="lbl">Camera</div>${'<div class="seg" id="zm">' + [[0.85, 'Close'], [1, 'Normal'], [1.2, 'Wide']].map(([v, t]) => `<button data-v="${v}" class="${S.zoom === v ? 'on' : ''}">${t}</button>`).join('') + '</div>'}
      <button class="btn2" id="snd">Sound: ${S.sound ? 'on' : 'off'}</button>
      <button class="btn2" id="sim">Sim to full time</button>
      ${career ? '' : '<button class="btn2" id="quit">Quit match</button>'}</div>`;
    $('#res').onclick = () => { ov.hidden = true; M.paused = false; M.last = performance.now(); };
    ov.querySelectorAll('#zm button').forEach(b => b.onclick = () => { S.zoom = +b.dataset.v; PS.R3.zoom = S.zoom; saveS(); ov.querySelectorAll('#zm button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#snd').onclick = () => { S.sound = !S.sound; PS.Audio.on = S.sound; if (S.sound) PS.Audio.start(); else PS.Audio.stop(); saveS(); $('#snd').textContent = `Sound: ${S.sound ? 'on' : 'off'}`; };
    $('#sim').onclick = () => { ov.hidden = true; M.paused = false; simToEnd(); };
    const q = $('#quit'); if (q) q.onclick = () => { end(); menu(); };
  }
  function end() { if (!M) return; PS.Controls.detach(); PS.R3.detach(); PS.Audio.stop(); M = null; $('#ov').hidden = true; }
  function finish() {
    if (!M) return;
    const G = M.G, cb = M.onEnd; end();
    cb && cb(G);
  }

  /* ------------------------------------------------------------ new career */
  function newCareer() {
    const st = { pos: 'ST', foot: 'Right', nation: 'United States', club: null, skin: 3, hair: 'fade' };
    const weak = D.CLUBS.map((c, i) => ({ c, i })).sort((a, b) => a.c.ovr - b.c.ovr).slice(0, 4);
    st.club = weak[0].i;
    show(`<div class="page">
      <button class="back" id="bk">‹ Menu</button>
      <h2>New career</h2>
      <label>Name<input id="nm" maxlength="22" placeholder="First and last name" autocomplete="off"></label>
      <label>Nation<select id="nat">${D.NATIONS.map(n => `<option${n === st.nation ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="lbl">Position</div>${seg('pos', [['ST', 'Striker'], ['W', 'Winger'], ['CM', 'Midfielder']], st.pos)}
      <p class="sub" id="posd"></p>
      <div class="lbl">Stronger foot</div>${seg('foot', [['Left', 'Left'], ['Right', 'Right']], st.foot)}
      <div class="lbl">Skin tone</div><div class="swatch" data-k="skin">${PS.SKIN.map((c, i) => `<button data-v="${i}" class="${i === st.skin ? 'on' : ''}" style="background:${c}" aria-label="Skin tone ${i + 1}"></button>`).join('')}</div>
      <div class="lbl">Hair</div>${seg('hair', [['fade', 'Fade'], ['short', 'Short'], ['curly', 'Curly'], ['afro', 'Afro'], ['buzz', 'Buzz'], ['locs', 'Locs'], ['long', 'Long'], ['bald', 'Bald']], st.hair)}
      <div class="lbl">Your first club</div>
      <div class="clubs">${weak.map(({ c, i }) => `<button class="clubc ${i === st.club ? 'on' : ''}" data-i="${i}">${crest(c)}<span><b>${c.name}</b><small>${c.ground} · rated ${c.ovr}</small></span></button>`).join('')}</div>
      <button class="go" id="sign">Sign your first contract</button></div>`);
    const desc = { ST: 'Score goals. Runs in behind, finishing, headers, penalties.', W: 'Beat your full-back, cross, cut inside and shoot.', CM: 'Run the game: passing, through balls, shots from range, set pieces.' };
    const upd = () => { $('#posd').textContent = desc[st.pos]; };
    upd(); segs(st, upd);
    scr.querySelectorAll('.swatch button').forEach(b => b.addEventListener('click', () => { st.skin = +b.dataset.v; scr.querySelectorAll('.swatch button').forEach(x => x.classList.toggle('on', x === b)); }));
    on('.clubc', e => { const b = e.currentTarget; st.club = +b.dataset.i; scr.querySelectorAll('.clubc').forEach(x => x.classList.toggle('on', x === b)); });
    on('#bk', menu);
    on('#sign', () => {
      const name = $('#nm').value.trim() || 'Alex Rivera';
      K.create({ name, nation: $('#nat').value, pos: st.pos, foot: st.foot, club: st.club, skin: st.skin, look: { hair: st.hair, hairColor: '#17110d', face: 0 } });
      tab = 'home'; hub();
    });
  }

  /* ------------------------------------------------------------ hub */
  function card() {
    const c = K.C, cl = K.club(), o = K.ovr(c.a, c.pos), r = K.role();
    return `<div class="pcard" style="--c1:${cl.c1};--c2:${cl.c2}">
      <div class="ovr"><b>${o}</b><span>${c.pos}</span></div>
      <div class="who"><h2>${esc(c.name)}</h2><p>${crest(cl, 20)} ${cl.name} · #${c.num}</p><p class="mute">${esc(c.nation)} · age ${c.age} · ${c.foot} foot</p></div>
      <div class="trust"><span>Manager trust · <b class="role ${r}">${{ starter: 'Starter', rotation: 'Rotation', bench: 'Bench' }[r]}</b></span><div class="bar"><i style="width:${c.trust}%"></i><u style="left:38%"></u><u style="left:62%"></u></div></div>
    </div>`;
  }
  function hub() {
    const c = K.C; if (!c) return menu();
    if (c.summary) return seasonEnd();
    const tabs = [['home', 'Home'], ['table', 'League'], ['skills', 'Skills' + (affordable() ? ' •' : '')], ['career', 'Career']];
    const body = tab === 'home' ? homeTab() : tab === 'table' ? tableTab() : tab === 'skills' ? skillsTab() : careerTab();
    show(`<div class="hub"><div class="hubtop"><button class="back" id="mn">‹ Menu</button><span>Season ${c.season} · ${c.year}/${String(c.year + 1).slice(2)}</span></div>
      ${card()}
      <div class="tabs">${tabs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="tabbody">${body}</div></div>`);
    on('#mn', menu);
    on('.tabs button', e => { tab = e.currentTarget.dataset.t; hub(); });
    on('#play', () => matchDay(false));
    on('#simm', () => matchDay(true));
    on('.up', e => { if (K.upgrade(e.currentTarget.dataset.k)) hub(); });
  }
  const affordable = () => Object.keys(K.C.a).some(k => K.C.xp >= K.cost(K.C.a[k], K.C.pot) && K.C.a[k] < K.cap());
  const avg = a => a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : '–';
  const rc = r => r >= 8 ? 'hi' : r >= 7 ? 'good' : r >= 6 ? 'ok' : 'bad';
  function homeTab() {
    const c = K.C, f = K.nextFixture(), L = c.league;
    const opp = f && K.club(f.opp);
    const pos = K.table().findIndex(r => r.i === c.club) + 1;
    const last = c.last && c.last.round === L.round - 1 ? c.last : null;
    const r = K.role();
    return `${f ? `<div class="next">
        <div class="lbl">Matchday ${f.round + 1} of ${L.fx.length} · ${f.home ? 'Home' : 'Away'}</div>
        <div class="vs">${crest(K.club(), 40)}<b>${K.club().ab}</b><span>v</span><b>${opp.ab}</b>${crest(opp, 40)}</div>
        <p>${opp.name} · rated ${opp.ovr} · ${K.ord(K.table().findIndex(x => x.i === f.opp) + 1)} in the table</p>
        <p class="mute">${r === 'starter' ? 'You start.' : r === 'rotation' ? 'You might start, or come off the bench.' : 'You start on the bench. Make your minutes count.'}</p>
        <button class="go" id="play">Play match</button><button class="btn2 sm" id="simm">Sim match</button></div>` : ''}
      ${last ? `<div class="lastr"><div class="lbl">Last match</div><p>${K.club().ab} ${last.score[0]}–${last.score[1]} ${K.club(last.opp).ab}${last.rating ? ` · your rating <b class="rt ${rc(last.rating.r)}">${last.rating.r.toFixed(1)}</b>` : ' · unused sub'}</p></div>` : ''}
      <div class="mini"><div><b>${K.ord(pos)}</b><span>in the league</span></div><div><b>${c.ss.goals}</b><span>goals</span></div><div><b>${c.ss.assists}</b><span>assists</span></div><div><b>${avg(c.ss.ratings)}</b><span>avg rating</span></div></div>
      <div class="lbl">News</div><ul class="news">${c.news.slice(0, 8).map(n => `<li>${esc(n.t)}</li>`).join('')}</ul>`;
  }
  function tableTab() {
    const c = K.C, t = K.table(), sc = K.scorers(8);
    return `<table class="tbl"><thead><tr><th>#</th><th class="l">Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>
      ${t.map((r, i) => `<tr class="${r.i === c.club ? 'me' : ''}"><td>${i + 1}</td><td class="l">${crest(D.CLUBS[r.i], 18)} ${D.CLUBS[r.i].name}</td><td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}
      </tbody></table>
      <div class="lbl">Golden Boot race</div>
      <table class="tbl"><tbody>${sc.length ? sc.map((s, i) => `<tr class="${s.name.startsWith('★') ? 'me' : ''}"><td>${i + 1}</td><td class="l">${esc(s.name.replace('★ ', ''))}<small> ${D.CLUBS[s.ci].ab}</small></td><td><b>${s.g}</b></td></tr>`).join('') : '<tr><td class="l mute">No goals yet.</td></tr>'}</tbody></table>`;
  }
  function skillsTab() {
    const c = K.C;
    return `<div class="xp"><b>${c.xp}</b> XP to spend<small>Earned every match: your rating, goals, assists, tackles and minutes.</small></div>
      ${D.ATTRS.map(at => { const v = c.a[at.k], cost = K.cost(v, c.pot), w = D.POS[c.pos].w[at.k];
        return `<div class="attr"><div><b>${at.name}</b>${w >= 0.2 ? '<em>key</em>' : ''}<small>${at.tip}</small></div><div class="av"><span class="${v >= 80 ? 'hi' : v >= 65 ? 'good' : ''}">${v}</span>
          <button class="up" data-k="${at.k}" ${c.xp < cost || v >= K.cap() ? 'disabled' : ''}>+1<small>${cost}</small></button></div></div>`; }).join('')}
      <p class="mute">Every rating does something on the pitch: Pace is top speed, Shooting is power and accuracy, Passing is how true a pass runs, Dribbling is close control and keeping the ball in a tackle, Defending wins it back, Physical is headers and strength.</p>`;
  }
  function careerTab() {
    const c = K.C;
    return `<div class="mini"><div><b>${c.totals.apps}</b><span>apps</span></div><div><b>${c.totals.goals}</b><span>goals</span></div><div><b>${c.totals.assists}</b><span>assists</span></div><div><b>${c.trophies.length}</b><span>honours</span></div></div>
      <div class="lbl">Seasons</div>
      ${c.history.length ? `<table class="tbl"><thead><tr><th class="l">Season</th><th class="l">Club</th><th>Ap</th><th>G</th><th>A</th><th>Avg</th></tr></thead><tbody>${c.history.map(h => `<tr><td class="l">${h.y}/${String(h.y + 1).slice(2)}</td><td class="l">${D.CLUBS[h.club].ab} (${K.ord(h.pos)})</td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg.toFixed(2)}</td></tr>`).join('')}</tbody></table>` : '<p class="mute">Your first season is under way.</p>'}
      <div class="lbl">Honours</div>
      ${c.trophies.length ? `<ul class="news">${c.trophies.map(t => `<li>🏆 ${t.a} <small>${t.y}/${String(t.y + 1).slice(2)}</small></li>`).join('')}</ul>` : '<p class="mute">None yet. Golden Boot, Player of the Season, the title…</p>'}`;
  }

  /* ------------------------------------------------------------ match day (career) */
  function careerOpts() {
    const c = K.C, f = K.nextFixture(); if (!f) return null;
    const plan = PS.sim.plan({ us: K.club(), them: K.club(f.opp), home: f.home, role: K.role(), pos: c.pos, usSquad: c.squads[c.club], themSquad: c.squads[f.opp] });
    return { f, o: { teams: [K.club(), K.club(f.opp)], names: [c.squads[c.club], c.squads[f.opp]], home: f.home ? 0 : 1, mode: 'player', halfLen: S.half,
      me: { name: c.name, num: c.num, pos: c.pos, a: c.a, skin: c.skin ?? 3, look: c.look || null }, on: plan.on, off: plan.off } };
  }
  function matchDay(sim) {
    const co = careerOpts(); if (!co) return hub();
    const done = G => {
      const res = PS.Match.result(G);
      const m = Object.assign(res, { oppIdx: co.f.opp, home: co.f.home, round: co.f.round, user: K.C.name });
      fullTime(G, K.finishMatch(m));
    };
    if (sim) {
      const G = PS.Match.create(Object.assign({}, co.o, { auto: true }));
      let guard = 0; while (!G.over && guard++ < 400) PS.Match.fastForward(G, 4);
      return done(G);
    }
    playMatch(co.o, done);
  }
  function fullTime(G, last) {
    const r = last.rating, cl = K.club(), op = K.club(last.opp);
    show(`<div class="page result">
      <div class="lbl">Full time · matchday ${last.round + 1}</div>
      <div class="vs big">${crest(cl, 44)}<b>${G.score[0]}–${G.score[1]}</b>${crest(op, 44)}</div>
      <p class="center">${cl.name} v ${op.name}</p>${scorerList(G)}
      ${r ? `<div class="rating ${rc(r.r)}"><b>${r.r.toFixed(1)}</b><span>Match rating${r.r >= 8.3 ? ' · Man of the Match' : ''}</span></div>
      <ul class="why">${['<li><span>Starting point</span><b>6.0</b></li>'].concat(r.why.map(w => `<li><span>${w.t}</span><b class="${w.v > 0 ? 'pos' : 'neg'}">${w.v > 0 ? '+' : ''}${w.v.toFixed(2)}</b></li>`)).join('')}</ul>
      <div class="mini"><div><b>${last.mins}'</b><span>played</span></div><div><b>${last.stats.shots}</b><span>shots</span></div><div><b>${last.stats.passOk || 0}/${last.stats.passes || 0}</b><span>passes</span></div><div><b>${last.stats.tackles || 0}</b><span>tackles</span></div></div>` : '<p class="center mute">You stayed on the bench today.</p>'}
      <div class="gains"><div><b>+${last.xp}</b><span>XP</span></div><div><b class="${last.dTrust >= 0 ? 'pos' : 'neg'}">${last.dTrust >= 0 ? '+' : ''}${last.dTrust}</b><span>manager trust</span></div></div>
      <div class="lbl">Match stats</div>${teamStats(G)}
      <button class="go" id="cont">Continue</button></div>`);
    on('#cont', () => { tab = 'home'; hub(); });
  }

  /* ------------------------------------------------------------ season end */
  function seasonEnd() {
    const c = K.C, s = c.summary;
    if (K.retired()) return retire();
    show(`<div class="page">
      <div class="lbl">Season ${c.season} · ${c.year}/${String(c.year + 1).slice(2)}</div><h2>Season review</h2>
      <div class="mini"><div><b>${K.ord(s.pos)}</b><span>${K.club().ab}</span></div><div><b>${s.ss.goals}</b><span>goals</span></div><div><b>${s.ss.assists}</b><span>assists</span></div><div><b>${s.avg ? s.avg.toFixed(2) : '–'}</b><span>avg rating</span></div></div>
      ${s.awards.length ? `<ul class="news">${s.awards.map(a => `<li>🏆 ${a}</li>`).join('')}</ul>` : ''}
      <div class="lbl">Transfer window</div>
      ${c.offers && c.offers.length ? `<p class="mute">Your agent has offers. Pick one or stay.</p>${c.offers.map(o => `<button class="clubc" data-i="${o.i}">${crest(D.CLUBS[o.i])}<span><b>${D.CLUBS[o.i].name}</b><small>rated ${D.CLUBS[o.i].ovr} · ${o.wage.toLocaleString()} a week</small></span></button>`).join('')}` : '<p class="mute">No offers this summer. Another season to prove yourself.</p>'}
      <button class="go" id="stay">Stay at ${K.club().name}</button></div>`);
    on('.clubc', e => { K.nextSeason(+e.currentTarget.dataset.i); tab = 'home'; hub(); });
    on('#stay', () => { K.nextSeason(null); tab = 'home'; hub(); });
  }
  function retire() {
    const c = K.C;
    show(`<div class="page"><h2>Retirement</h2><p>${esc(c.name)} hangs up the boots at ${c.age}.</p>
      <div class="mini"><div><b>${c.totals.apps}</b><span>apps</span></div><div><b>${c.totals.goals}</b><span>goals</span></div><div><b>${c.totals.assists}</b><span>assists</span></div><div><b>${c.trophies.length}</b><span>honours</span></div></div>
      <button class="go" id="nw">Start a new career</button></div>`);
    on('#nw', () => { K.wipe(); newCareer(); });
  }

  /* ------------------------------------------------------------ how to play */
  function how() {
    show(`<div class="page"><button class="back" id="bk">‹ Menu</button><h2>How to play</h2>
      <p>Eleven against eleven, three minutes a half (change it in Settings). Hold the phone upright: you always attack up the screen.</p>
      <div class="lbl">Moving</div>
      <ul class="howl"><li><b>Left thumb</b>: put it down anywhere on the left half and drag. That’s your stick.</li><li><b>Sprint</b>: hold it while you run.</li></ul>
      <div class="lbl">With the ball</div>
      <ul class="howl"><li><b>Shoot</b>: hold to build power (watch the bar), release to strike. Aim with the stick, or leave it and you go for the far post.</li>
        <li><b>Pass</b>: tap for a pass along the ground toward where the stick points. Hold it for a lofted ball, a cross from out wide.</li>
        <li><b>Through</b>: a ball into space for a runner. Hold it to chip it over.</li></ul>
      <div class="lbl">Without the ball</div>
      <ul class="howl"><li><b>Tackle</b>: get close and tap it. Not from behind!</li><li><b>Slide</b>: a sliding tackle where the stick points. Miss the ball and it’s a foul (maybe a penalty).</li>
        <li><b>Switch</b> (Kick-off): change to the man nearest the ball. It also switches on its own.</li><li><b>Press</b> (My Career): hold to close the man on the ball down.</li>
        <li><b>Call</b> and <b>Run</b> (My Career): ask your teammate for the ball to your feet, or for a ball in behind. Your teammates do pass to you.</li></ul>
      <div class="lbl">Set pieces</div>
      <ul class="howl"><li>Free kicks in range and penalties are yours: aim with the stick, hold Shoot for power.</li><li>Throw-ins and corners: Pass (or Cross).</li></ul>
      <p>Let go of the stick and your player moves on his own, so you never stand still while you think.</p>
      <button class="go" id="try">Play a Kick-off match</button></div>`);
    on('#bk', menu); on('#try', kickoffSetup);
  }

  PS.boot = boot;
  PS.dbg = { get G() { return M && M.G; }, get M() { return M; } };
  PS.ui = { menu, hub };
})();
