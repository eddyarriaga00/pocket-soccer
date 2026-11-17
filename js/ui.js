/* PocketSoccer: screens. The menu, a new career, the career hub, match day, the season's end, Quick Moments.
   Everything is drawn into #screen; a live moment takes over #pitch. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  const D = PS.data, K = PS.career;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let app, scr, pitch, tab = 'home';

  function boot() {
    app = document.getElementById('app');
    app.innerHTML = '<div id="pitch" hidden></div><div id="screen"></div>';
    scr = $('#screen'); pitch = $('#pitch');
    PS.moment.mount(pitch);
    K.load();
    menu();
  }
  const crest = (c, size = 34) => `<span class="crest" style="--c1:${c.c1};--c2:${c.c2};width:${size}px;height:${size}px"><b>${c.ab[0]}</b></span>`;
  function show(html, cls = '') { pitch.hidden = true; scr.hidden = false; scr.className = cls; scr.innerHTML = html; scr.scrollTop = 0; }
  function on(sel, fn, ev = 'click') { scr.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn)); }

  /* ------------------------------------------------------------ menu */
  function menu() {
    const c = K.C;
    show(`<div class="menu">
      <div class="logo"><div class="ball"></div><h1>Pocket<b>Soccer</b></h1><p>Your career. One thumb. Portrait.</p></div>
      ${c ? `<button class="go" id="cont">Continue career<small>${esc(c.name)} · ${esc(K.club().name)} · Season ${c.season}</small></button>` : ''}
      <button class="${c ? 'btn2' : 'go'}" id="new">New career</button>
      <button class="btn2" id="quick">Quick Moments<small>Practice: endless chances, no career</small></button>
      <button class="btn2" id="how">How to play</button>
      <p class="fine">Prototype build · every club and player is fictional</p></div>`, 'menu-s');
    on('#cont', hub); on('#new', () => c ? confirmNew() : newCareer()); on('#quick', quick); on('#how', how);
  }
  function confirmNew() {
    show(`<div class="page"><h2>Start again?</h2><p>This replaces ${esc(K.C.name)}’s career on this device.</p>
      <button class="go danger" id="yes">Yes, start a new career</button><button class="btn2" id="no">Keep my career</button></div>`);
    on('#yes', () => { K.wipe(); newCareer(); }); on('#no', menu);
  }

  /* ------------------------------------------------------------ new career */
  function newCareer() {
    const st = { pos: 'ST', foot: 'Right', nation: 'United States', club: null };
    const weak = D.CLUBS.map((c, i) => ({ c, i })).sort((a, b) => a.c.ovr - b.c.ovr).slice(0, 4);
    st.club = weak[0].i;
    const seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, t]) => `<button data-v="${v}" class="${st[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    show(`<div class="page">
      <button class="back" id="bk">‹ Menu</button>
      <h2>New career</h2>
      <label>Name<input id="nm" maxlength="22" placeholder="First and last name" autocomplete="off"></label>
      <label>Nation<select id="nat">${D.NATIONS.map(n => `<option${n === st.nation ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="lbl">Position</div>${seg('pos', [['ST', 'Striker'], ['W', 'Winger'], ['CM', 'Midfielder']])}
      <p class="sub" id="posd"></p>
      <div class="lbl">Stronger foot</div>${seg('foot', [['Left', 'Left'], ['Right', 'Right']])}
      <div class="lbl">Your first club</div>
      <div class="clubs">${weak.map(({ c, i }) => `<button class="clubc ${i === st.club ? 'on' : ''}" data-i="${i}">${crest(c)}<span><b>${c.name}</b><small>${c.ground} · rated ${c.ovr}</small></span></button>`).join('')}</div>
      <button class="go" id="sign">Sign your first contract</button></div>`);
    const desc = { ST: 'Finish chances. Runs in behind, the edge of the box, penalties.', W: 'Beat your full-back, cross, cut inside. Lots of space, lots of the ball.', CM: 'Run the game: through balls, long shots, set pieces.' };
    const upd = () => { $('#posd').textContent = desc[st.pos]; };
    upd();
    scr.querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      st[s.dataset.k] = b.dataset.v; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); upd();
    }));
    on('.clubc', e => { const b = e.currentTarget; st.club = +b.dataset.i; scr.querySelectorAll('.clubc').forEach(x => x.classList.toggle('on', x === b)); });
    on('#bk', menu);
    on('#sign', () => {
      const name = $('#nm').value.trim() || 'Alex Rivera';
      K.create({ name, nation: $('#nat').value, pos: st.pos, foot: st.foot, club: st.club });
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
    let body = '';
    if (tab === 'home') body = homeTab(); else if (tab === 'table') body = tableTab(); else if (tab === 'skills') body = skillsTab(); else body = careerTab();
    show(`<div class="hub"><div class="hubtop"><button class="back" id="mn">‹ Menu</button><span>Season ${c.season} · ${c.year}/${String(c.year + 1).slice(2)}</span></div>
      ${card()}
      <div class="tabs">${tabs.map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="tabbody">${body}</div></div>`);
    on('#mn', menu);
    on('.tabs button', e => { tab = e.currentTarget.dataset.t; hub(); });
    on('#play', () => matchDay());
    on('.up', e => { if (K.upgrade(e.currentTarget.dataset.k)) hub(); });
  }
  const affordable = () => Object.keys(K.C.a).some(k => K.C.xp >= K.cost(K.C.a[k], K.C.pot) && K.C.a[k] < K.cap());
  function homeTab() {
    const c = K.C, f = K.nextFixture(), L = c.league;
    const opp = f && K.club(f.opp);
    const pos = K.table().findIndex(r => r.i === c.club) + 1;
    const last = c.last && c.last.round === L.round - 1 ? c.last : null;
    return `${f ? `<div class="next">
        <div class="lbl">Matchday ${f.round + 1} of ${L.fx.length} · ${f.home ? 'Home' : 'Away'}</div>
        <div class="vs">${crest(K.club(), 40)}<b>${K.club().ab}</b><span>v</span><b>${opp.ab}</b>${crest(opp, 40)}</div>
        <p>${opp.name} · rated ${opp.ovr} · ${K.ord(K.table().findIndex(r => r.i === f.opp) + 1)} in the table</p>
        <p class="mute">${roleLine()}</p>
        <button class="go" id="play">Play match</button></div>` : ''}
      ${last ? `<div class="lastr"><div class="lbl">Last match</div><p>${K.club().ab} ${last.score[0]}–${last.score[1]} ${K.club(last.opp).ab}${last.rating ? ` · your rating <b class="rt ${rc(last.rating.r)}">${last.rating.r.toFixed(1)}</b>` : ' · unused sub'}</p></div>` : ''}
      <div class="mini"><div><b>${K.ord(pos)}</b><span>in the league</span></div><div><b>${c.ss.goals}</b><span>goals</span></div><div><b>${c.ss.assists}</b><span>assists</span></div><div><b>${avg(c.ss.ratings)}</b><span>avg rating</span></div></div>
      <div class="lbl">News</div><ul class="news">${c.news.slice(0, 8).map(n => `<li>${esc(n.t)}</li>`).join('')}</ul>`;
  }
  function roleLine() {
    const r = K.role();
    return r === 'starter' ? 'You start. Play well and stay in the side.' : r === 'rotation' ? 'You might start, or come off the bench. Big moments get you in the team.' : 'You start on the bench. Make your minutes count.';
  }
  const avg = a => a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : '–';
  const rc = r => r >= 8 ? 'hi' : r >= 7 ? 'good' : r >= 6 ? 'ok' : 'bad';
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
    return `<div class="xp"><b>${c.xp}</b> XP to spend<small>Earned in every match: your rating, goals, assists and minutes.</small></div>
      ${D.ATTRS.map(at => { const v = c.a[at.k], cost = K.cost(v, c.pot), w = D.POS[c.pos].w[at.k];
        return `<div class="attr"><div><b>${at.name}</b>${w >= 0.2 ? '<em>key</em>' : ''}<small>${at.tip}</small></div><div class="av"><span class="${v >= 80 ? 'hi' : v >= 65 ? 'good' : ''}">${v}</span>
          <button class="up" data-k="${at.k}" ${c.xp < cost || v >= K.cap() ? 'disabled' : ''}>+1<small>${cost}</small></button></div></div>`; }).join('')}
      <p class="mute">Overall is weighted by position: as a ${D.POS[c.pos].name.toLowerCase()} the “key” ratings count most. Points get dearer as you rise, and much dearer near your ceiling.</p>`;
  }
  function careerTab() {
    const c = K.C;
    return `<div class="mini"><div><b>${c.totals.apps}</b><span>apps</span></div><div><b>${c.totals.goals}</b><span>goals</span></div><div><b>${c.totals.assists}</b><span>assists</span></div><div><b>${c.trophies.length}</b><span>honours</span></div></div>
      <div class="lbl">Seasons</div>
      ${c.history.length ? `<table class="tbl"><thead><tr><th class="l">Season</th><th class="l">Club</th><th>Ap</th><th>G</th><th>A</th><th>Avg</th></tr></thead><tbody>${c.history.map(h => `<tr><td class="l">${h.y}/${String(h.y + 1).slice(2)}</td><td class="l">${D.CLUBS[h.club].ab} (${K.ord(h.pos)})</td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg.toFixed(2)}</td></tr>`).join('')}</tbody></table>` : '<p class="mute">Your first season is under way.</p>'}
      <div class="lbl">Honours</div>
      ${c.trophies.length ? `<ul class="news">${c.trophies.map(t => `<li>🏆 ${t.a} <small>${t.y}/${String(t.y + 1).slice(2)}</small></li>`).join('')}</ul>` : '<p class="mute">None yet. Golden Boot, Player of the Season, the title…</p>'}`;
  }

  /* ------------------------------------------------------------ match day */
  let MT = null;
  function matchDay(quickCfg) {
    const m = K.startMatch(); if (!m) return hub();
    MT = { m, speed: 1, acc: 0, last: performance.now(), wait: null, raf: 0 };
    show(`<div class="match">
      <div class="sb"><div>${crest(m.us, 30)}<b>${m.us.ab}</b></div><div class="sc"><b id="sc">0–0</b><span id="mi">0'</span></div><div><b>${m.them.ab}</b>${crest(m.them, 30)}</div></div>
      <div class="mstat" id="mst"></div>
      <ul class="feed" id="feed"></ul>
      <div class="mctl"><button class="btn2 sm" id="spd">Speed 1×</button><button class="btn2 sm" id="skip">Skip to my moment ›</button></div>
      <div class="prompt" id="prm" hidden></div></div>`, 'match-s');
    on('#spd', () => { MT.speed = MT.speed === 1 ? 2 : MT.speed === 2 ? 4 : 1; $('#spd').textContent = `Speed ${MT.speed}×`; });
    on('#skip', () => { MT.skip = true; });
    roleNote(m);
    MT.raf = requestAnimationFrame(matchLoop);
  }
  function roleNote(m) {
    const t = m.on > 0 ? (m.on > 90 ? 'You are on the bench today.' : `You start on the bench. Be ready around the ${m.on}th minute.`) : m.off < 90 ? 'You start today.' : 'You start today.';
    $('#mst').textContent = `${t} ${m.moments.length ? m.moments.length + ' moment' + (m.moments.length > 1 ? 's' : '') + ' should come your way.' : ''}`;
  }
  function matchLoop(now) {
    if (!MT || MT.wait) return;
    const dt = Math.min(0.1, (now - MT.last) / 1000); MT.last = now;
    const perMin = MT.skip ? 0.004 : 0.32 / MT.speed;
    MT.acc += dt;
    while (MT.acc >= perMin && !MT.wait) {
      MT.acc -= perMin;
      const mo = PS.sim.tick(MT.m);
      renderFeed();
      if (mo) { MT.skip = false; MT.wait = mo; momentPrompt(mo); return; }
      if (MT.m.over) { MT.skip = false; return setTimeout(fullTime, 900); }
      if (MT.skip && !MT.m.moments.some(x => !x.done)) MT.skip = false;
    }
    MT.raf = requestAnimationFrame(matchLoop);
  }
  function renderFeed() {
    const m = MT.m;
    $('#sc').textContent = `${m.score[0]}–${m.score[1]}`; $('#mi').textContent = `${m.minute}'`;
    const f = $('#feed');
    while (f.children.length < m.feed.length) {
      const e = m.feed[f.children.length], li = document.createElement('li');
      li.className = e.kind; li.innerHTML = `<i>${e.min}'</i>${esc(e.t)}`; f.prepend(li);
    }
  }
  const MT_TEXT = { box: 'The ball drops to you on the edge of the box.', through: 'Space opens up in behind. Make the run!', counter: 'Turnover! You’re away on the break.',
    wing: 'You pick it up wide with a full-back to beat.', build: 'You get it in the middle with time to look up.', fk: 'Free kick in shooting range. You’re on it.', pen: 'Penalty! You’ve got the ball.' };
  function momentPrompt(mo) {
    const p = $('#prm'), m = MT.m;
    p.hidden = false;
    p.innerHTML = `<div class="pin"><div class="lbl">${m.minute}' · your moment</div><h3>${MT_TEXT[mo.type]}</h3>
      <button class="go" id="pl">Play it</button><button class="btn2" id="au">Sim it<small>Decided by your ratings</small></button></div>`;
    $('#pl').onclick = () => { p.hidden = true; playMoment(mo); };
    $('#au').onclick = () => { p.hidden = true; afterMoment(mo, PS.sim.auto(mo, K.C.a, K.C.pos, MT.m)); };
  }
  function playMoment(mo, chainType) {
    const c = K.C, m = MT.m;
    scr.hidden = true; pitch.hidden = false;
    PS.moment.start({ type: chainType || mo.type, user: { name: c.name, num: c.num, pos: c.pos, a: c.a }, us: m.us, them: m.them, minute: m.minute, score: m.score.slice() }, res => {
      if (res.chain && !chainType) {
        /* a foul that gave a penalty or a free kick in range: that becomes the next moment, straight away */
        mergeChain(mo, res);
        return setTimeout(() => playMoment(mo, res.chain.type), 350);
      }
      if (chainType && mo._first) res = combine(mo._first, res);
      afterMoment(mo, res);
    });
  }
  function mergeChain(mo, res) { mo._first = res; }
  function combine(a, b) { const o = { ...b }; for (const k of ['shots', 'onT', 'keyPass', 'dribbles', 'lost', 'xg', 'saves']) o[k] = (a[k] || 0) + (b[k] || 0); return o; }
  function afterMoment(mo, res) {
    PS.sim.resolve(MT.m, mo, res);
    pitch.hidden = true; scr.hidden = false;
    MT.wait = null; MT.last = performance.now();
    renderFeed();
    MT.raf = requestAnimationFrame(matchLoop);
  }
  function fullTime() {
    const m = MT.m; MT = null;
    const last = K.finishMatch(m);
    const r = last.rating, cl = K.club(), op = K.club(last.opp);
    show(`<div class="page result">
      <div class="lbl">Full time · matchday ${last.round + 1}</div>
      <div class="vs big">${crest(cl, 44)}<b>${m.score[0]}–${m.score[1]}</b>${crest(op, 44)}</div>
      <p class="center">${cl.name} v ${op.name}</p>
      <ul class="scorers">${m.scorers.filter(s => s.side === 0).map(s => `<li class="${s.you ? 'you' : ''}">⚽ ${esc(s.name)} ${s.min}'${s.assist ? ' (your assist)' : ''}</li>`).join('')}${m.scorers.filter(s => s.side === 1).map(s => `<li class="them">⚽ ${esc(s.name)} ${s.min}' (${op.ab})</li>`).join('')}</ul>
      ${r ? `<div class="rating ${rc(r.r)}"><b>${r.r.toFixed(1)}</b><span>Match rating${r.r >= 8.3 ? ' · Man of the Match' : ''}</span></div>
      <ul class="why">${['<li><span>Starting point</span><b>6.0</b></li>'].concat(r.why.map(w => `<li><span>${w.t}</span><b class="${w.v > 0 ? 'pos' : 'neg'}">${w.v > 0 ? '+' : ''}${w.v.toFixed(2)}</b></li>`)).join('')}</ul>
      <div class="mini"><div><b>${last.mins}'</b><span>played</span></div><div><b>${last.stats.shots}</b><span>shots</span></div><div><b>${last.stats.onT}</b><span>on target</span></div><div><b>${last.stats.dribbles}</b><span>dribbles</span></div></div>` : '<p class="center mute">You stayed on the bench today.</p>'}
      <div class="gains"><div><b>+${last.xp}</b><span>XP</span></div><div><b class="${last.dTrust >= 0 ? 'pos' : 'neg'}">${last.dTrust >= 0 ? '+' : ''}${last.dTrust}</b><span>manager trust</span></div></div>
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

  /* ------------------------------------------------------------ quick moments */
  function quick() {
    const st = { n: 0, goals: 0, assists: 0 };
    const user = { name: 'You', num: 10, pos: 'ST', a: { pac: 74, sho: 74, pas: 70, dri: 72, def: 40, phy: 66 } };
    const types = ['box', 'through', 'counter', 'wing', 'build', 'fk', 'pen'];
    const next = (forced) => {
      const us = D.CLUBS[Math.floor(Math.random() * 4)], them = D.CLUBS[4 + Math.floor(Math.random() * 8)];
      const type = forced || types[st.n % types.length];
      scr.hidden = true; pitch.hidden = false;
      PS.moment.start({ type, user, us, them, minute: 1 + Math.floor(Math.random() * 89), score: [st.goals + st.assists, 0] }, res => {
        st.n++; st.goals += res.goal || 0; st.assists += res.assist || 0;
        if (res.chain) return setTimeout(() => next(res.chain.type), 350);
        show(`<div class="page center"><div class="lbl">Quick Moments</div><h2>${esc(res.text || '')}</h2>
          <div class="mini"><div><b>${st.n}</b><span>moments</span></div><div><b>${st.goals}</b><span>goals</span></div><div><b>${st.assists}</b><span>assists</span></div></div>
          <button class="go" id="nx">Next moment</button><button class="btn2" id="mn">Menu</button></div>`);
        on('#nx', () => next()); on('#mn', menu);
      });
    };
    next();
  }

  /* ------------------------------------------------------------ how to play */
  function how() {
    show(`<div class="page"><button class="back" id="bk">‹ Menu</button><h2>How to play</h2>
      <p>A match is simulated. When the ball finds you, the game stops on <b>your moment</b> and you play it with one thumb.</p>
      <ul class="howl">
        <li><b>Drag and hold</b> anywhere to run. Push the stick to its edge to sprint.</li>
        <li><b>Flick</b> to kick. At the goal it’s a shot, at a teammate it’s a pass, into space a through ball. Faster flicks hit harder (and higher).</li>
        <li><b>Bend your flick</b> to curl the ball. It still ends up where you aimed. Free kicks love this.</li>
        <li><b>Tap a teammate</b> to pass to his feet.</li>
        <li><b>Tap inside the goal</b> for a placed side-foot finish.</li>
        <li><b>Tap anywhere else</b>: with the ball, knock it ahead and burst away. Without it, call for the ball, or tackle if you’re close.</li>
      </ul>
      <p>Stay onside: a yellow ring means you’re offside right now. Defenders tackle, keepers dive, walls jump.</p>
      <p>Play well and the manager trusts you: bench, rotation, then starter. Spend XP on your ratings, win the Golden Boot, earn a move to a bigger club.</p>
      <button class="go" id="try">Try Quick Moments</button></div>`);
    on('#bk', menu); on('#try', quick);
  }

  PS.boot = boot;
  PS.ui = { menu, hub, quick };
})();
