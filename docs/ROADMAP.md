# PocketSoccer roadmap

Working plan and status. The design is in [PLAN.md](PLAN.md), the research in [RESEARCH.md](RESEARCH.md).
Update this file after every item.

## Ground rules

- **Branch:** commit on `main` and push `main` (as in PocketFootball). Every push redeploys the live GitHub Pages site,
  so run "How to test" before pushing.
- **Rollback points:** before every push to `main`, add a line below with the commit `main` is on and what the push
  brings. To go back: `git revert --no-edit <commit>..main`, then push `main`.
- **Rollback points** (newest first; the commit is the last good `main` before that change):
  - (none yet: the first push is the prototype)

## How to test

1. Serve the folder without caching: `python3 tools/serve.py 48241`, open `http://localhost:48241/`, use a phone-sized
   viewport (390×844). (`.claude/launch.json` has this as a `soccer` config; it is gitignored, recreate it if missing.)
   Opening `index.html` straight from disk also works.
2. Load the harness: `await fetch('tools/harness.js?'+Date.now()).then(r=>r.text()).then(t=>(0,eval)(t))`
3. `H.all(60)` plays 60 of each kind of moment with the test bot and returns how they ended; `H.season()` plays a whole
   career season on auto. Neither should throw, and the numbers should stay near the ones under "Balance" below.
4. Play a career match by hand at phone size: a moment, a free kick, a penalty; check the result screen and the hub.

## Status

### M0 Prototype (2026-11-16) ✅
- [x] Pitch and ball physics: drag crisis, Magnus curl, spin decay, bounce, roll, posts, bar, net, curl-aware aim solver
- [x] Live moments, seven kinds (edge of the box, run in behind, counter, wing, midfield, free kick, penalty)
- [x] One-thumb controls: floating joystick, flick to shoot/pass/through ball, bend to curl, tap teammate, tap the goal, knock-on, call, tackle, slide
- [x] AI: pressing, covering defender, delayed marking (runs can beat it), interceptions, fouls that chain into set pieces, offside, keepers (angle play, reaction, dives, catches, parries, penalty guesses), jumping walls, headers
- [x] Broadcast camera (behind the attack), 2.5D renderer, crowd, boards, nets, slow motion on shots, celebrations
- [x] Match simulation with commentary, moment scheduling by position and minutes, Play it / Sim it
- [x] Ratings out of 10 with their reasons, XP, manager trust (Bench / Rotation / Starter), substitutes
- [x] Career: create a player (name, nation, position, foot, first club), 12-club league, fixtures, table, Golden Boot race, skills, history, honours, news
- [x] Season end: awards, transfer offers from bigger clubs, ageing, retirement
- [x] Quick Moments practice mode, How to play
- [x] PWA (manifest, service worker, icon), test harness

### M1 Feel (next)
- [ ] Play it on a real phone: tune flick speed thresholds, power curve, curl strength, joystick radius
- [ ] Sound: kick, whistle, crowd swell on chances, net ripple, goal roar
- [ ] Goal celebration and an instant replay of goals (record the moment's positions, play them back)
- [ ] Player animation pass (kick, header, tackle, dive, celebration poses)
- [ ] Haptics on Android (`navigator.vibrate`) for kicks and goals
- [ ] Trajectory hint while aiming free kicks and penalties (optional, off on Hard)
- [ ] Difficulty setting (keeper and defender strength)

### M2 Career depth
- [ ] Contracts, wages, release clauses; agent; summer and January windows; loans
- [ ] Domestic cup
- [ ] Injuries
- [ ] Training drills (three mini-games with stars)
- [ ] Press conferences, social feed, a rival

### M3 The world
- [ ] Five leagues, two divisions each, promotion and relegation
- [ ] Continental cup
- [ ] National team, call-ups, World Cup every four seasons
- [ ] Golden Ball, Team of the Season, Hall of Fame, records

### M4 Presentation / M5 Positions / M6 Extras
See PLAN.md section 9.

## Balance (test bot, tools/harness.js)

Keeper only, shots to a corner (gk.js run, 120 shots each): penalties 63–72% in; 14 m 78–83%; 18 m 18–53%;
22 m 3–5%; 28 m about 0–3% (most saved). Full moments, 80 each, bot play: penalty ~69%, free kick ~5%, edge of the box
~3–8%, counter ~43–65% (too easy: the next tuning target), wing ~0–10% (the bot never crosses). Human play is the next calibration.
