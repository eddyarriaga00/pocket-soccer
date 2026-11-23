# PocketSoccer: the next big build (plan, 2026-11-23)

The owner's brief: *"research the football and basketball game, i want those character models, i want that social
media, i obviously want way better play wise though, work on plan and research first."*

This is the plan. Research and sources are in [RESEARCH.md](RESEARCH.md) (section "The next build"). Nothing in this
file is built yet; the status lives in [ROADMAP.md](ROADMAP.md) as work lands.

---

## 1. What the two sister games have that PocketSoccer does not (yet)

Read from the code on 2026-11-23 (PocketBasketball at `bf1c80f`, PocketFootball at `2f097d2`).

### The character model and looks (PocketBasketball)
PocketSoccer already wears the same body (`models/body.glb`, `models/player.glb`). What it does not have:
- **The look builder**: a stepped creator (Profile, Body, Look) with the player turning on screen; 15 hairstyles in
  8 colours, 5 beards, 8 faces, headband, sleeves, tights; builds that change width (slim, strong, big).
- **Faces that change with the moment**: happy, stern and tired face sets swapped in for a few seconds; blinking;
  an open mouth for a yell.
- **Portraits**: `R.portrait()` renders any player as a headshot or a full body (front or back, any kit) to an image,
  cached, drawn one at a time. Used for social avatars, rosters, lineups, the player card and kit previews.
- **Presentation around the game**: a walkout and lineups with headshots, a rival face-off, cutscenes for the
  story, three cameras (player lock, broadcast, overhead), a radar, replays and a highlight reel (saved as a
  vertical video with sound), comic hit effects, a big screen in the arena.
- **The booth**: two recorded voices (406 lines, cloned from original synthetic voices by `tools/voice.py`) and an
  arena announcer; lines never repeat until the rest of that call has been heard.

PocketFootball's players are its own helmeted figures (built for American football); its portraits work the same
way. **Decision: keep the basketball pocket player for soccer** (no helmet, the look the owner approved), and port
the look builder, the face sets and the portrait renderer.

### Social media
Both games run it; the basketball one is the fuller version, the football one has the better writing engine.
- **Your account**: followers, a verified tick past 10K, a hype score 0-100 that rises with good nights, posts and
  callouts you back up, and cools a little every game. More hype, faster growth.
- **One post a game**, four kinds: thank the fans (followers), hype the next one (hype), shout out a teammate (the
  coach likes it), a picture (followers). Fans and teammates reply under it.
- **The internet reacts after every game** (football `media.js`): fans of both teams, analysts, reporters, the club
  account, teammates, your rival and a quote from your coach, louder the better you played (a "buzz" 0-10 and a
  lean). Lines are dealt like cards, so nobody posts the same thing twice in a week. Big nights get trending posts
  and polls you can vote in.
- **Callouts**: call out the next opponent (talk, or a guarantee). Back it up and it pays (skill points, followers,
  hype); lose and the receipts come out and the coach's trust drops.
- **Press and media day**: three questions, three tones of answer (humble, confident, brash) that move trust, hype
  and followers; your words go on the record and get quoted back at you.
- **Messages**: Mom, your agent, a teammate, your rival before you meet him.
- **Brand partners**: hype above 55 two games running brings an offer (skill points to sign, one a game while it
  lasts); hype under 25 and they walk.
- **Avatars are real headshots** of the players, drawn from the 3D model.

### Career around the games
Both are far ahead of PocketSoccer's career:
- **A story for each game** (basketball): debut off the bench or starting, first start, dropped from the team, back in
  the team, new club, your old club, back from injury, after a career night, on a roll, bounce back, streaks,
  rematch, primetime; it is on the game card, in the feed, in the news and in the booth.
- **The road in** (four paths, combine, draft night, a rival from your class) and a rival you meet twice a season.
- **Coach trust and a role** that sets real minutes; **chemistry** with one teammate; **abilities** bought with skill
  points; **badges** earned by doing the thing; **training camp** drills; **weekly events** with choices (football).
- **The business**: contracts by draft slot, extensions, free agency with offers, trade requests, earnings.
- **The league**: injuries, trades, Player of the Week, an all-star vote, awards night, record book, banners,
  achievements, a shareable player card; **accounts** that keep a career in the cloud (Firebase project
  `blockfootball-a13c9`, already authorised for `eddyarriaga00.github.io`).

---

## 2. Where PocketSoccer's play falls short today

An honest list, from playing it and from the tests:

- **The ball is glued to the feet.** No touches, no heavy first touch, no knock-on when sprinting, no shielding: a
  dribble feels like holding the ball, not running with it.
- **No skill moves**, no way to beat a man except running round him.
- **Passing is one speed.** No power on a pass, receivers do not come to the ball, no one-twos, no driven passes.
- **The attacking AI is a shape plus random runs.** No overlaps, no third-man runs, no width and half-spaces, no
  change of tempo; crosses go to whoever is nearest.
- **The defending AI presses one man and guesses.** No compact block, no line held together, no offside trap (so
  offsides almost never happen), no press triggers; tackling is a dice roll.
- **Defending as the user** is tackle or slide; no jockey/contain, no calling a second man to press.
- **Set pieces are one routine each**; throw-ins almost never happen; no penalty shootouts.
- **The match has no fatigue, substitutions, injuries, red cards or advantage.**
- **One camera**, no radar, no replays, no commentary voice, no walkout.

---

## 3. What the research says good play needs

(Full notes and links in RESEARCH.md.)

- **Responsiveness first.** Reviews of every FIFA reward a ball and player that answer the stick at once and
  animations that never lock you in; first touch and player switching are where a game feels precise or random.
  EA's own FC 26 notes say the same (shorter animation lock-in, better trapping).
- **Dribbling on a phone (FC Mobile):** turn speed from height and agility; the dribbler *slows between touches* so a
  defender can stay with him; skill moves on a tap or swipe of the Sprint button, each one in a row slower and
  looser than the last; a face-up dribble (side-to-side) on a double tap.
- **Defending on a phone:** the stick alone keeps you at a tactical distance (contain) without diving in; hold to
  tackle; double tap to send a second man to press; a hard tackle as a risk.
- **Team AI (EA's FC IQ):** every player has a role and a focus that decide where he goes with and without the ball
  (a target man stays high, an inside forward drifts into the half-space, an overlapping full-back runs past his
  winger, a box-to-box midfielder arrives late in the box); an activity map shows the zones.
- **Where to run (sports science):** *pitch control*, each player's influence over each point of the pitch as a
  Gaussian stretched by his speed and direction, weighted by a *pitch value* surface (how dangerous each zone is),
  is the standard way to score space. Off-ball runs are judged by the value of the space they reach or create.
- **Social that matters:** EA added a social feed to FC 25's career and players called it filler ("popularity
  gains you nothing", repetitive, stock lines). What they asked for: a feed that changes morale, fan reaction and
  the board's confidence. **So every number on PocketSoccer's social page must move something in the career.**
- **Presentation:** EA restored walk-outs and lineups in career after players asked for them.

---

## 4. The plan

Five tracks, played in this order: **Play** first (it is what the owner asked for most), then **The player** (the
models and looks), then **Social**, then **Career**, with **Quality** running under all of it. Each item has a "done
when" that a test or a screenshot can prove.

### Track A: Play ("way better play wise")

**A1. The ball at the feet** (the biggest single change)
- Dribbling as touches: the ball is pushed ahead and travels free between touches; a touch every 0.3-0.6 s, longer
  touches at a sprint and for low Dribbling; the player slows a little between touches (FC Mobile's rule), so a
  defender can stay with him.
- First touch: its quality from the pass's pace and height and the receiver's Dribbling; a poor one bounces off a
  metre or two (a chance for the defender); receiving on the half-turn when the stick points forward.
- Close control when the stick is let go (the ball stops under the sole); shielding with a defender behind.
- Turning speed from Pace/Dribbling and height (shorter and nimbler turns quicker).
- *Done when:* the ball is visibly separate from the feet at a run (screenshot sequence), tackles win the ball
  between touches more than on a touch (harness), and 60 fps holds.

**A2. Skill moves and beating a man**
- On the Sprint button: tap = a body feint, swipe = a step-over the way you swipe, swipe back = a drag-back,
  hold-and-circle (or swipe up) = a roulette; double tap = a knock-on burst into space.
- Each move a short animation that moves the ball and unsettles a defender who is close (he leans or stops);
  chained moves get slower and looser (FC Mobile); Dribbling decides how clean.
- *Done when:* a defender beaten by a move is measurable in a lab (like tools/shotlab.js: `tools/dribblelab.js`),
  and each move has a frame sheet (tools/frames.js, as in basketball).

**A3. Passing that feels like FIFA**
- Pass power from the hold (a tap is soft and short, a hold is driven); the assist picks the man the stick points
  at, weighted by how open he is; lofted and driven passes; a through ball weighted into the runner's path.
- Receivers come to the ball; one-twos (pass, then hold Through to get it straight back as you run).
- *Done when:* pass completion in computer games sits at 78-85% (real leagues), and a one-two works from the input
  test.

**A4. Team AI with roles and space** (FC IQ-lite plus pitch control)
- Roles per slot with an activity zone: keeper, centre-back, full-back (overlapping / inverted), holding midfielder,
  box-to-box, playmaker, winger (wide / inside forward), striker (target man / runner). Clubs get a style
  (possession, counter, direct, high press).
- Off-ball movement chosen by **pitch control × pitch value**: each attacker scores a handful of candidate spots
  near his zone (how much of it his team controls, how dangerous it is, whether it is onside) and goes to the best
  one; runners time runs in behind for when the carrier looks up; overlaps and third-man runs.
- The carrier uses the same surfaces: pass to the best-valued open man, carry into space, cross to whoever has won
  the space in the box.
- *Done when:* the harness reports realistic per-90 numbers scaled to the match length (shots 12-16 a side,
  passing 78-85%, crosses, offsides 1-3, corners 4-6) and possession swings with style.

**A5. Defending: the team and you**
- A compact block: the back four holds one line (with an offside trap: it steps up on a back pass), midfield screens,
  the shape slides as one with the ball; press triggers (a back pass, a bad touch, a man facing his own goal, the
  touchline).
- You: the stick alone contains (jockey at a distance, facing the ball); hold Tackle to close and tackle; tap for a
  standing tackle; Slide as now; a double tap calls a second man to press (FC Mobile); shoulder challenges.
- Fouls from contact and timing, not dice; yellow and red cards; advantage played on.
- *Done when:* tackles won, interceptions and fouls per game sit near real numbers; a contain-then-tackle beats a
  dive-in in a lab.

**A6. The match**
- Stamina by sprinting; substitutions (computer at dead balls; yours from the pause menu); injuries now and then;
  stoppage time shown; set-piece routines (near post, far post, short corner, a long throw); a penalty shootout for
  cup ties.
- *Done when:* a full match runs with subs and cards in the harness without a stuck state (invariants checked every
  tick, as basketball's tools/invariants.js does).

**A7. Seeing the game**
- Three cameras: Broadcast (behind your attack, as now), **Player lock** for the career (behind you, the 2K-style
  view the owner picked for basketball), and **Tele** (higher and wider); a radar (as basketball's).
- Instant replay of goals, a highlight reel after the match (basketball's reel, and its vertical video export).
- *Done when:* each camera is picked in Settings and screenshots show all three.

### Track B: The player (the character models)

**B1. The look builder**: port basketball's stepped creator (Profile, Body, Look) with the turning player: hair,
colour, beard, face, headband; boots and their colour; sleeves (long or short), socks up or down, tape. Builds
(slim, regular, strong) change the body's width as in basketball.
**B2. Faces with the moment**: the happy / stern / tired face sets and the blink, worn after a goal, a miss, a
loss, late in a match.
**B3. Portraits**: port `R.portrait()` (headshot, full body, front and back, any kit), cached and drawn one at a time,
for the hub, rosters, lineups, the player card and the social avatars.
**B4. Kits**: home, away and third for every club, keeper kits that never clash, the club crest on the chest, the
name and number on the back (done), sponsor text, captain's armband.
**B5. Presentation**: the walkout (both teams out of the tunnel, lineups with headshots), the rival face-off before a
rival game, celebrations you choose (signature celebration in the builder), a referee in black.
**B6. The booth**: two commentators recorded the basketball way (`tools/voice.py`, original synthetic voices cloned
with Chatterbox), soccer lines (goals by type and distance, saves, near misses, cards, the story of the night), and
a crowd that sings and groans.
*Done when:* a frame sheet of the builder at three phone sizes, every portrait type rendered, and a match with the
walkout and commentary passing the smoke test.

### Track C: Social (the football and basketball system, made to matter)

Port the basketball `social()` state and the football `media.js` writing engine, rewritten for soccer:
- Profile (headshot, handle, followers, hype, verified at 10K, the follower line), one post a match (fans, hype,
  teammate, picture), replies.
- The reaction after every match from the real stat line: fans of both clubs, pundits, reporters, the club account,
  teammates, your rival, the manager's quote; an invented transfer insider ("Here we go" style, never a real
  person) whose rumours are **the real offers your agent will bring**.
- Callouts with stakes, press after the match and media day before derbies (trust, hype, followers, quotes on the
  record), polls and trends after big nights, messages (Mom, agent, a teammate, your rival), brand partners.
- **What it changes** (the fix for FC 25's "filler" complaint): hype moves manager trust a little, transfer interest
  and wages, the national team call-up and the fan vote for awards; followers bring brand deals and skill points.
*Done when:* every number on the social page has a visible effect somewhere else (listed on the page itself), and
40 simulated matches produce no repeated line within a week (a test, as football's deal() guarantees).

### Track D: Career (the rest of what the sister games do)

- **A story for every match**: debut, first start, dropped, back in the side, new club, old club, derby, cup final,
  back from injury, after a hat-trick, on a scoring run, a drought, rematch; on the match card, in the feed, in the
  news, in the booth.
- **The road in**: academy graduate, released and rebuilt in a lower league, or a wonderkid signing; a rival from
  your academy year.
- **Manager trust and minutes** (done), **chemistry** with one teammate (passes between you land more, he looks for
  you), **PlayStyles** bought with skill points (finesse+, power shot+, rapid, press proven, whipped cross...) and
  **badges** earned by doing the thing.
- **The business**: contracts with wage and length, an agent, two transfer windows with rumours that come true or
  do not, loans, a release clause, career earnings.
- **More football**: a domestic cup, a continental cup, the national team with call-ups and a World Cup every four
  seasons, Team of the Week, awards night (Golden Boot, Golden Ball), a record book, achievements, a shareable player
  card, injuries.
- **Training** between matches: three short drills (finishing with the shot types, free kicks, dribbling gates).
- **Saves**: several careers on a device, backups to a file, and **accounts** on the existing Firebase project
  (a new `pocketsoccer` path in its rules) so a career follows you to any phone.

### Track E: Quality (under all of it)

- Tests the basketball way: smoke, taps with real touches (WebKit), an invariants check every tick of computer
  games, a monkey test of random input, a long career run, text screens read for undefined/NaN, frame sheets for
  every animation; the harness and shot lab kept green.
- 60 fps on an iPhone-sized WebKit page with 22 players; a lighter mode for slow phones (as basketball's adaptive
  quality).
- Version 1.0 hardening as basketball did: a content-security policy, saves checked on load, test hooks off the
  live site, a 404 page, share tags.

---

## 5. Order of work (the owner, 2026-11-23: "easiest to hardest")

The owner's answers: reuse basketball's commentary voices and every line that fits; share the Firebase accounts with
football and basketball; the world grows to many leagues, international, with a story like the other games.

| # | Step | From | Proof |
|---|---|---|---|
| 1 | **The booth**: basketball's two voices and every line that fits soccer, plus new soccer lines recorded in the same voices (tools/voice.py, shared clip cache) | B6 | the pack builds, calls fire in a match |
| 2 | **Cameras and radar**: Broadcast, Player lock, Tele; a radar | A7 | screenshots of each |
| 3 | **Match details**: stoppage time, red cards, an away kit when colours clash, a referee | A5, A6, B4 | harness, screenshots |
| 4 | **Faces and celebrations**: faces for the moment, a signature celebration | B2, B5 | frame sheet |
| 5 | **Portraits**: headshots and full bodies from the 3D model | B3 | portrait sheet |
| 6 | **Social media** in full | C | no-repeat test, effects table |
| 7 | **A story for every match** and the news | D | long career run |
| 8 | **Accounts** on the shared Firebase project | D | sign-in test |
| 9 | **The world**: many leagues in many countries, a domestic cup, a continental cup, the national team and tournaments, transfers between leagues | D | season sims |
| 10 | **The road in and the story**: paths into the game, a rival, cutscenes, the walkout | B5, D | screens |
| 11 | **The look builder** | B1 | builder sheets at 3 sizes |
| 12 | **Passing**: power, receivers who come to the ball, one-twos | A3 | pass %, input test |
| 13 | **The ball at the feet**: touches, first touch, shielding, turning | A1 | screenshot sequence, tackle lab |
| 14 | **Skill moves and defending**: moves, contain, second man, fouls from contact | A2, A5 | dribble and tackle labs |
| 15 | **Team AI**: roles and styles, pitch-control runs, a back line with an offside trap, set-piece routines, stamina and subs | A4, A5, A6 | per-90 numbers, invariants |

Every step ends with a push to `main` and a rollback point in ROADMAP.md.

## 6. Answered (2026-11-23)

1. **Commentary**: reuse basketball's voices and lines; record soccer's own lines in the same voices.
2. **Accounts**: shared with football and basketball (one sign-in).
3. **The world**: many leagues, international, with a story like the other games.
