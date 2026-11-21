# PocketSoccer roadmap

Working plan and status. The design is in [PLAN.md](PLAN.md), the research in [RESEARCH.md](RESEARCH.md).
Update this file after every item.

## Ground rules

- **Branch:** commit on `main` and push `main` (as in PocketFootball). Every push redeploys the live GitHub Pages site,
  so run "How to test" before pushing.
- **Rollback points:** before every push to `main`, add a line below with the commit `main` is on and what the push
  brings. To go back: `git revert --no-edit <commit>..main`, then push `main`.
- **Rollback points** (newest first; the commit is the last good `main` before that change):
  - `dfc55bc`, before the shooting rebuild: shot types, timed finishing, aim reticle, new keeper rules (2026-11-21).
  - `36f6243`, before the 3D rebuild: full 11 v 11 matches, the pocket player models, FIFA-style controls (2026-11-21). That commit is the one-thumb "moments" prototype.

## How to test

1. `node tools/harness.js 20`: twenty computer-v-computer matches with the real engine, no browser. Every match must
   finish; the averages should stay near "Balance" below.
2. Serve the folder: `python3 tools/serve.py 48241`, open `http://localhost:48241/` at phone size (390×844). (The
   models and the modules need http; `file://` does not work any more.)
3. Play a Kick-off match: move, pass, shoot, tackle, pause, sim to full time. Then a career match day, and Sim match.
4. Headless checks that worked: playwright-core 1.58 with WebKit (`webkit.launch()`, iPhone 13 device) for real-GPU
   frame times (60 fps measured on an M1) and real pointer input; Chromium headless shell with
   `--use-angle=swiftshader --enable-unsafe-swiftshader` for screenshots.

## Status

### M0.5 The 3D game (2026-11-21) ✅
- [x] Full 11 v 11 real-time engine (js/match.js): formations, shape, pressing and cover, marking with a reaction
      delay, pass choice by lane safety and space, through balls, crosses, headers, dribbling, clearances
- [x] Every restart: kick-off, throw-in, corner, goal kick, free kick (wall), penalty; fouls, cards, offside, halves
- [x] Keepers: angle play, reaction, dives, catches, parries (rebounds, round the post for corners), distribution
- [x] The pocket player from PocketBasketball (models/), dressed by a soccer kit shader: short sleeves and collar,
      long socks, boots, club designs (stripes, hoops, sash, band, yokes, halves), long-sleeved keepers
- [x] Running from the clips placed on the ground; kicks, headers, slides, dives, throw-ins, falls and five
      celebrations posed in code
- [x] Stadium: striped pitch, markings, goals with nets, corner flags, ad boards, stands, floodlights
- [x] FIFA-style controls (stick + four context buttons, hold-to-power shots, lobs, through balls, switch, press,
      call and run), keyboard
- [x] My Career plays real matches (you control only your player, bench and substitutions included), Sim match;
      Kick-off mode; pause menu (camera, sound, sim to full time); half time and full time with team stats
- [x] Sound synthesized in the browser
- [x] 60 fps on an iPhone-sized WebKit page (M1), about 0.9 s to simulate a whole match headless

### M0.6 Shooting (2026-11-21) ✅
- [x] Six shot types: drive, low driven (let go early), finesse (swipe down), chip (swipe up), power (full bar),
      volley (a ball in the air); a fake shot (swipe sideways) that defenders can buy
- [x] Timed finishing: a sweet spot on the power bar that moves with the distance; perfect / good / early / overhit
- [x] Error cone from shooting rating, pace, pressure, body angle, weaker foot (career foot), a ball in the air, a sprint
- [x] Aim solver for every type (curl and dip still land on the aimed spot); keeper reaction by distance, unsighted
      through traffic, top corners hardest, curl only partly read, chips beat a keeper off his line (one on it
      back-pedals)
- [x] Aim reticle in the goal, power bar with the sweet spot and the shot type, timing call, ball trail, hit-stop,
      camera shake, slow motion at the line, rippling net, goal call (where, distance, km/h), miss calls
- [x] tools/shotlab.js: goal / saved / off target by type, timing and distance

### M1 Feel (next)
- [ ] Play it on a real phone: stick size, button spacing, shot power curve, pass assist cone
- [ ] Skill moves (a button for a step-over / roulette), first-time shots and volleys on demand
- [ ] Instant replay of goals; a goal celebration camera that circles
- [ ] Off-screen teammate markers at the screen edge
- [ ] More throw-ins and offsides (the AI keeps the ball in and stays onside a little too well)
- [ ] Difficulty (opponent AI and keeper level)

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

## Shooting lab (node tools/shotlab.js 150: shooting 75, keeper only, aimed at corners)

goal / saved / off target %   6 m   11 m   16 m   20 m   25 m   30 m
drive, good                   99     87     36     21      8      7
drive, perfect               100     97     60     25      7      7
drive, overhit                94     69     33     15      6      1   (off target 21-84%)
finesse, perfect              99     95     73     29      7      3
power, good                   99     85     48     24      8      5
chip v keeper 7 m out          0      1     80     76     73     62   (v a keeper on his line: 2-7%)

## Balance (node tools/harness.js, 48 matches of 3-minute halves)

Per match: 2.2 goals, 14 shots (8.8 on target), about 155 passes at 75%, 0.8 corners, 2.6 fouls, 0.4 penalties,
6.6 saves. Possession lands near 50/50 between even sides; stronger clubs win more but not always.
