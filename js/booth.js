/* PocketSoccer: the broadcast booth. PocketBasketball's two voices (and every one of its lines that fits soccer),
   plus soccer's own lines recorded in the same voices by tools/voice.py; audio/vo.pack holds the clips, js/vo.js
   says where each one sits. Ported from PocketBasketball's js/booth.js.
   PS.booth.say(key, o)  a call. o.prio: a higher one cuts in on a lower one already playing; an equal or lower one is
                         dropped (a call must land on its play). o.follow: the chance the analyst adds a line after.
   PS.booth.chat(key)    players shouting on the pitch: quieter, never over each other.
   Lines are not repeated until the others for that call have been heard. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};
  let pack = null, loading = null;
  const decoded = new Map(), recent = {};
  let cur = null, curPrio = 0, busyUntil = 0, followT = 0;
  const A = () => PS.Audio;
  const on = () => PS.booth.enabled !== false && A() && A().on && A().ctx && A().ctx();
  function load() {
    if (pack || loading || !PS.VO || !Object.keys(PS.VO).length) return loading;
    loading = fetch('audio/vo.pack').then(r => r.ok ? r.arrayBuffer() : null).then(b => { pack = b; }).catch(() => { pack = null; });
    return loading;
  }
  function decode(clip) {
    const k = clip[0];
    if (decoded.has(k)) return decoded.get(k);
    const ctx = A().ctx();
    if (!pack || !ctx) return Promise.resolve(null);
    const p = ctx.decodeAudioData(pack.slice(clip[0], clip[0] + clip[1])).catch(() => null);
    decoded.set(k, p);
    return p;
  }
  function pick(key) {
    const list = PS.VO && PS.VO[key];
    if (!list || !list.length) return null;
    const seen = recent[key] || (recent[key] = []);
    let opts = list.filter(c => !seen.includes(c[0]));
    if (!opts.length) { seen.length = 0; opts = list.slice(); }
    const c = opts[Math.floor(Math.random() * opts.length)];
    seen.push(c[0]);
    return c;
  }
  async function play(key, prio) {
    const c = pick(key); if (!c) return false;
    const buf = await decode(c);
    if (!buf || !on()) return false;
    const now = performance.now();
    if (now < busyUntil && prio <= curPrio) return false;
    if (cur) { try { cur.stop(); } catch (e) { /* already done */ } }
    cur = A().voice(buf); curPrio = prio; busyUntil = now + buf.duration * 1000 + 250;
    return buf.duration;
  }
  PS.booth = {
    enabled: true, load,
    busy: () => performance.now() < busyUntil,
    async say(key, o) {
      o = o || {};
      if (!on()) return;
      if (!pack) { load(); return; }
      if (!PS.VO[key]) return;
      const prio = o.prio || 1;
      if (performance.now() < busyUntil && prio <= curPrio) return;
      const d = await play(key, prio);
      if (d && o.follow && Math.random() < o.follow && PS.VO[o.ana || key + '_ana']) {
        const t = ++followT;
        setTimeout(() => { if (t === followT && !PS.booth.busy()) play(o.ana || key + '_ana', 0.5); }, d * 1000 + 450);
      }
    },
    warm() { if (!pack || !PS.VO) return; for (const k of ['intro', 'kickoff', 'goal', 'save', 'miss', 'tackle']) for (const c of (PS.VO[k] || []).slice(0, 3)) decode(c); },
    async chat(key) {
      if (!on() || !pack) return;
      const now = performance.now(); if (now < (PS.booth._chatUntil || 0)) return;
      const c = pick(key); if (!c) return;
      PS.booth._chatUntil = now + 900;
      const buf = await decode(c); if (!buf) return;
      PS.booth._chatUntil = performance.now() + buf.duration * 1000 + 700;
      A().voice(buf, { vol: 0.4, rate: 0.92 + Math.random() * 0.2 });
    },
    stop() { followT++; if (cur) { try { cur.stop(); } catch (e) { /* done */ } } busyUntil = 0; },
    /* a match's events into calls */
    events(G, evs) {
      for (const e of evs) {
        const k = e.k;
        if (k === 'goal') {
          const h = (e.how || '').toLowerCase(), own = e.by && e.by.t !== e.t, d = parseInt((e.how || '').split('·')[1]) || 0;
          const key = own ? 'owngoal' : /chip/.test(h) ? 'goal_chip' : /top corner/.test(h) ? 'goal_top' : /curled/.test(h) ? 'goal_curl' : h === 'header' ? 'goal_head' : G.restart0 === 'pen' || e.pen ? 'goal_pen' : d >= 23 ? 'goal_far' : 'goal';
          PS.booth.say(key, { prio: 5, follow: 0.7, ana: 'goal_ana' });
          if (e.by && e.by.st && e.by.st.g === 3 && !own) setTimeout(() => PS.booth.say('hattrick', { prio: 6 }), 2600);
        }
        else if (k === 'save') PS.booth.say('save', { prio: 3, follow: 0.35 });
        else if (k === 'miss') PS.booth.say('miss', { prio: 3, follow: 0.3 });
        else if (k === 'post') PS.booth.say('post', { prio: 4 });
        else if (k === 'block') PS.booth.say('block', { prio: 2 });
        else if (k === 'tackle' && Math.random() < 0.45) PS.booth.say('tackle', { prio: 2, follow: 0.25 });
        else if (k === 'fake' || k === 'skill') PS.booth.say('skill', { prio: 2 });
        else if (k === 'card') PS.booth.say(e.red ? 'red' : 'yellow', { prio: 4 });
        else if (k === 'pen') PS.booth.say('penalty', { prio: 5 });
        else if (k === 'offside') PS.booth.say('offside', { prio: 2 });
        else if (k === 'corner') PS.booth.say('corner', { prio: 1 });
        else if (k === 'fkrange') PS.booth.say('freekick', { prio: 2 });
        else if (k === 'foul') PS.booth.say('foul', { prio: 1 });
        else if (k === 'half') PS.booth.say('half', { prio: 5, follow: 0.6 });
        else if (k === 'second') PS.booth.say('second', { prio: 3 });
        else if (k === 'late') PS.booth.say('late', { prio: 2 });
        else if (k === 'stoppage') PS.booth.say('stoppage', { prio: 2 });
        else if (k === 'full') PS.booth.say(G.score[0] === G.score[1] ? 'final' : 'final', { prio: 6, follow: 0.8 });
        else if (k === 'call') PS.booth.chat('ch_ball');
        else if (k === 'kickoffWhistle') PS.booth.say('kickoff', { prio: 2 });
        else if (k === 'intro') { PS.booth.say(e.story && PS.VO[e.story] ? e.story : 'intro', { prio: 3, follow: 0.6, ana: 'intro_ana' }); }
      }
    }
  };
})();
