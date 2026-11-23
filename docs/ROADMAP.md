# PocketSoccer roadmap

Working plan and status. The design is in [PLAN.md](PLAN.md), the research in [RESEARCH.md](RESEARCH.md).
Update this file after every item.

## Ground rules

- **Branch:** commit on `main` and push `main` (as in PocketFootball). Every push redeploys the live GitHub Pages site,
  so run "How to test" before pushing.
- **Rollback points:** before every push to `main`, add a line below with the commit `main` is on and what the push
  brings. To go back: `git revert --no-edit <commit>..main`, then push `main`.
- **Rollback points** (newest first; the commit is the last good `main` before that change):
  - `81354af`, before the ball at the feet: touches, close control, first touch, half-turn, turning, shielding (2026-11-23).
  - `8dbdbd2`, before the passing work: pace from the hold, lob swipe, open-man assist, one-twos, chest control, computer shot tuning (2026-11-23).
  - `d6d6175`, before the look builder (2026-11-23).
  - `88a4296`, before the story: the road in, a rival, cutscenes, the walkout and the face-off (2026-11-23).
  - `60d65a1`, before the world: seven leagues, domestic cups, the Champions Cup, national teams and tournaments (2026-11-23).
  - `dfc55bc`, before the shooting rebuild: shot types, timed finishing, aim reticle, new keeper rules (2026-11-21).
  - `36f6243`, before the 3D rebuild: full 11 v 11 matches, the pocket player models, FIFA-style controls (2026-11-21). That commit is the one-thumb "moments" prototype.

## How to test

0. `node tools/world.js 6`: six career seasons on quick results; every league, cup and tournament must finish, the
   save must round-trip and an old one-league save must load.
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

**The next big build is planned in [NEXT.md](NEXT.md)** (2026-11-23: the sister games' models and social media, and far better play). Its milestones replace M1 below.

### M1 Feel (next)
- [ ] Play it on a real phone: stick size, button spacing, shot power curve, pass assist cone
- [ ] Skill moves (a button for a step-over / roulette), first-time shots and volleys on demand
- [ ] Instant replay of goals; a goal celebration camera that circles
- [ ] Off-screen teammate markers at the screen edge
- [ ] More throw-ins and offsides (the AI keeps the ball in and stays onside a little too well)
- [ ] Difficulty (opponent AI and keeper level)

### M2 Career depth
- [ ] Contracts, wages, release clauses; agent; summer and January windows; loans
- [x] Domestic cup (every league's own; knockout with byes, draws to penalties)
- [ ] Injuries
- [ ] Training drills (three mini-games with stars)
- [x] Press conferences, social feed; a rival still to come

### The story (2026-11-23)
- [x] The road in: academy graduate, released at sixteen and rebuilt, or the wonderkid a big club paid for
- [x] A rival from your academy year at your position: in the other shirt when your clubs meet, in the scorers' race, moves clubs as he grows, posts about you, head to head on the Career tab and in the season review
- [x] Cutscenes between matches: the road in, the first call-up, a transfer, a trophy, a title
- [x] The walkout: both sides in a line at halfway, the camera down the line with names, then you and your rival face to face; skippable
- [x] The look builder: hair (16 styles), colour, headband, skin, face, beard, boot colour, sleeves, build, celebration; a turning preview; from New career and the Career tab


### Passing (2026-11-23)
- [x] Pace from the hold (a tap is weighted, a full bar driven), swipe up to loft, crosses from wide on a held pass
- [x] The assist prefers an open man with a clear lane among those the stick points at
- [x] One-twos: pass, then Through (Run or Call in a career) while it travels; he runs and gets it back first time
- [x] Receivers chest and thigh down lofted passes; computer passing 79-80% (target 78-85%)

### The ball at the feet (2026-11-23)
- [x] Dribbling as touches: pushed ahead along the line he faced, free between touches (0.6-1.9 m at a sprint), further and less often at a sprint and for a poor dribbler; a stride lost on each touch
- [x] Close control with the stick let go (under the sole); a sharp turn costs a touch and a moment; turning speed from Pace and Dribbling
- [x] First touch: hard or bouncing balls and poor dribblers let it get away a metre or two; receiving on the half-turn with the stick pointing on
- [x] Tackles win 37% between touches against 27% at the feet (harness); a strong man shields from behind

### M3 The world
- [x] Seven leagues in seven countries (England, Spain, Italy, Germany, France, Brazil, USA), 72 invented clubs, all
      simulated round by round alongside yours; transfers from any of them (2026-11-23)
- [ ] Second divisions, promotion and relegation
- [x] Champions Cup: the top two of every league, knockout
- [x] National team: call-ups by rating, two international breaks a season, the World Cup every fourth summer and
      the continental championships in between; caps and international goals
- [x] Old saves carry over (the one league becomes the Premier Division; cups start next season). Check: `node tools/world.js 6`
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

Per match (after the passing work, 2026-11-23, Premier Division clubs): about 3 goals (2.7 to 3.6 between runs), 15 shots
(10 on target), about 170 passes at 79-80%, 1.2 corners, 2.6 fouls, 7 saves. Before it: 2.2 goals, 14 shots, 155
passes at 75%. Lofted passes are chested down by the man they are for; the computer only lofts to a man with room. Possession lands near 50/50 between even sides; stronger clubs win more but not always.
