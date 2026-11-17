# PocketSoccer: game plan

**A soccer career for your phone. Portrait, one thumb. You are one player, from a 17-year-old debut to retirement.
The match is simulated around you, and every chance that falls to you is yours to play.**

Sister game to [PocketFootball](https://github.com/eddyarriaga00/pocket-football) (American football) and PocketFall:
same family of plain-JavaScript, no-install, phone-first browser games, published on GitHub Pages.

Research behind every decision here: [RESEARCH.md](RESEARCH.md). Working status and test steps: [ROADMAP.md](ROADMAP.md).

---

## 1. Pillars

1. **Portrait, one thumb.** Every action works with the thumb of the hand holding the phone. The pitch runs up the
   screen (you always attack upward), which is the shape of a phone held upright. No virtual buttons on the pitch.
2. **Your moments, not ninety minutes.** A real match takes ninety minutes; a pocket match takes about four. The
   simulation plays the match; when the ball finds you, it stops and you play that moment live, then it carries on.
   This is New Star Soccer's proven idea, done in real time with a full set of players around you instead of a
   static puzzle.
3. **My Career is the main mode.** Everything serves the story of one player: minutes earned from the manager, the
   Golden Boot race, a move to a bigger club, the national team, a Ballon d'Or-style award, retirement.
4. **Honest numbers.** Every match rating shows its working. Trust only moves on what you did. The age curve is the
   real one. No pay-to-win, no energy timers, no forced replays (the three complaints that dog the genre).
5. **A world of its own.** Fictional clubs, towns and players (no licences needed, and nothing to go stale). Real
   nations for international football.

## 2. The core loop

```
Hub ──► Match day ──► (simulated minutes ⇄ your live moments) ──► Full time ──► Hub
 ▲          rating with its reasons, XP, manager trust, news, table                │
 └──── spend XP on ratings ◄── Season end: awards, transfer offers, age +1 ◄──────┘
```

- **Hub:** player card (overall, position, club, trust bar with Bench / Rotation / Starter), next fixture, last
  result, league table and Golden Boot race, skills (spend XP), career history and honours, news.
- **Match day:** a live text feed of the simulated match with a scoreboard (speed 1×/2×/4×, "skip to my moment").
  When your moment comes a card slides up: **Play it** or **Sim it** (decided by your ratings, never forced).
- **Full time:** the score, the scorers, your rating out of 10 starting from 6.0 with every plus and minus listed,
  XP earned, trust change.
- **Season end:** final position, your season line, awards, the transfer window (offers from bigger clubs when you
  have outgrown yours), then a year older.

## 3. Controls (one thumb)

| Gesture | With the ball | Without the ball |
|---|---|---|
| **Drag and hold** (anywhere) | Dribble. A joystick appears under the thumb; push to its edge to sprint | Run (a sprint forward is also a call for the ball) |
| **Flick** | Kick toward the flick. At goal: a shot. At a teammate: a pass. Into space: a through ball. Faster flick = harder and higher | Sliding tackle if a carrier is close |
| **Bend the flick** | Curl. The ball still ends where you aimed (the game solves the launch angle through the spin) | |
| **Tap a teammate** | Pass to his feet | |
| **Tap inside the goal** | Placed side-foot finish to that spot | |
| **Tap anywhere else** | Knock it ahead and burst | Call for it, or a standing tackle if close |

Assists that keep it fair on a small screen: a pass played for you bends your run onto the ball; a loose ball close
by pulls you to it; a moment waits for your first touch ("Touch to play"); the first second of a moment is free of
tackles; shots go to slow motion so you see them land.

## 4. Moments

| Moment | Set-up | Mostly for |
|---|---|---|
| Edge of the box | Ball at your feet 20–25 m out, a midfielder closing, two centre-backs, two runners | ST, CM |
| Run in behind | A teammate on the ball in midfield, a flat back four: time your run, stay onside | ST, W |
| Counter attack | Turnover in your half, two on two | All |
| Down the wing | Wide with a full-back to beat: cross for a header or cut in | W |
| Running the game | Deep in midfield, three runners ahead, a back four and two holding players | CM |
| Free kick | 19–27 m, a jumping wall, the keeper cheating to his side | All (CM most) |
| Penalty | From the spot; the keeper commits as you strike | All |

A foul in a moment chains straight into a free kick or a penalty. Offside is judged when the ball is played (a
yellow ring shows a player who is off). Each match gives 1–7 moments depending on position and minutes.

Measured with the test bot (tools/harness.js, 80 moments each, keeper only, shots to a corner): penalties go in
about 63–78%, 14 m finishes about 65–80%, 18 m about 20–50%, 22 m+ about 3–18%, weak shots from range are saved. These
match real-world conversion rates closely enough to tune from human play next.

## 5. Ratings, growth and trust

- **Attributes:** Pace, Shooting, Passing, Dribbling, Defending, Physical (and Goalkeeping later). Each one drives
  something you can feel in a moment (top speed, shot accuracy and power, pass error, first touch and tackle
  resistance, interceptions, header power).
- **Overall** is weighted by position (a striker's shooting counts 34%, a winger's pace and dribbling 30% each, a
  midfielder's passing 35%).
- **XP** from every match (rating, goals, assists, minutes, a win, Man of the Match). Points get dearer as a rating
  rises and much dearer near the player's hidden ceiling (84–94).
- **Age curve:** free growth to about 23, flat to about 30, then decline from 31 (pace first, then physical), sharper
  from 34. Retirement at 38 at the latest.
- **Manager trust** (0–100): Bench under 38, Rotation to 62, Starter above. It moves only on match ratings, judged
  against the minutes you had. Never drains over a break.

## 6. The full career (what the prototype grows into)

- **Competitions:** a two-division pyramid in each country with promotion and relegation; a domestic cup (one-legged
  knockout, replays never); a continental cup (groups then knockouts) for the top finishers; the national team with
  call-ups, friendlies, qualifiers and a World Cup every four seasons (a continental championship in between).
- **Transfers and contracts:** two windows a season (summer and January). An agent brings offers; you can ask to
  leave. Contracts have length, wage and a release clause; loans for young players stuck on the bench.
- **Awards:** Player and Young Player of the Season, Golden Boot, Team of the Season, Golden Ball (the world's best),
  World Cup Golden Ball, a Hall of Fame and career records.
- **Life around it:** news and social posts that react to what you do, a press conference choice now and then (it
  moves trust and fan mood), a rival at your position, injuries (a knock costs a few rating points for a week, a
  serious one a month), weekly training drills as short mini-games with stars (shooting, finishing, passing).
- **More positions later:** centre-back and full-back (defensive moments: track the runner, block, tackle, intercept),
  and goalkeeper (swipe to dive, punch, distribute).
- **Other modes later:** Quick Moments (exists: endless practice), Exhibition, daily challenge moments, Training Camp.

## 7. The world

- Prototype: one league of twelve fictional clubs (home and away, 22 matchdays).
- Full game: five leagues of 12–16 clubs each, styled loosely on the big European leagues but with invented towns,
  names, crests (code-drawn shields) and colours. Squads of generated names, kept season to season.
- Nations: real country names for international football (no federation crests or kits).
- Anyone can rename clubs on their own device (as in PocketFootball).

## 8. Technology

- **Plain JavaScript classic scripts**, one global namespace (`window.PS`), no build step, no dependencies. The same
  shape as PocketFootball so tools and habits carry over.
- `js/data.js` clubs, names, nations, position weights, commentary lines
- `js/physics.js` pitch geometry and the ball: speed-dependent drag (the drag crisis), Magnus curl that weakens at
  pace, spin decay, bounce and roll, posts, bar, net; a predictor and a curl-aware aim solver
- `js/moment.js` the live moment: players, AI (pressing, cover, delayed marking, keepers, walls), one-thumb input,
  the broadcast camera and the 2.5D canvas renderer, slow motion, celebrations
- `js/sim.js` the simulated match, moment scheduling, auto-play, match ratings
- `js/career.js` the career model: save, fixtures (circle method), table, XP, trust, ageing, awards, transfers
- `js/ui.js` the screens
- **Rendering:** 2D canvas with a perspective camera behind the attack (good on every phone). A three.js renderer
  later, following PocketFootball's (it already ships one).
- **Saves:** localStorage, versioned (`pocketsoccer.career.v1`), validated on load.
- **PWA:** manifest, network-first service worker, home-screen icon, portrait.
- **Tests:** `tools/harness.js` plays hundreds of moments and whole seasons synchronously for balance numbers.

## 9. Milestones

| | Milestone | Done when |
|---|---|---|
| M0 | **Prototype** (this build) | Career → match day → live moments → rating → XP → season end → transfers, all playable on a phone |
| M1 | **Feel** | Human playtests on a phone; flick thresholds, keeper and defender tuning; sound (kick, whistle, crowd, net); goal celebration and an instant replay; player animation pass; haptics where supported |
| M2 | **Career depth** | Contracts and wages, two transfer windows, loans, injuries, training drills, press conferences, social feed, rival |
| M3 | **The world** | Five leagues, promotion and relegation, domestic and continental cups, national team and World Cup, Golden Ball, Hall of Fame |
| M4 | **Presentation** | three.js stadiums and players, commentary, kits, night matches and weather |
| M5 | **More positions** | Defenders and goalkeepers |
| M6 | **Extras** | Exhibition, daily challenge, leaderboards, controller and keyboard, landscape and desktop layouts |

## 10. Open questions for the owner

1. Name: **PocketSoccer** (matches PocketFootball). Alternatives: Pocket Pitch, Pocket Striker.
2. Should real leagues be hinted at (an "English-style" league with a pyramid) or fully invented countries?
3. Goalkeeper career: worth doing (a very different game), or keep to outfield players?
4. Online: a global Quick Moments leaderboard (PocketFootball already has a Firebase chat to reuse)?
