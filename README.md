# PocketSoccer

<img src="icons/icon-512.png" width="112" align="right" alt="">

**Eleven-a-side soccer for your phone, played upright, right in the browser.** Full 3D matches with FIFA-style
controls, the same pocket players as [PocketBasketball](https://github.com/eddyarriaga00/pocket-basketball), and
**My Career**: one player from a 17-year-old debut to retirement.

**Play:** https://eddyarriaga00.github.io/pocket-soccer/ (add it to your home screen for full screen)

Sister game to [PocketFootball](https://github.com/eddyarriaga00/pocket-football) and PocketBasketball. Plain
JavaScript and three.js, no install, no build step. Every club and player is fictional.

## Modes

- **My Career** (the main mode): create a striker, winger or midfielder (name, nation, foot, skin tone, hair), sign for
  a small club and play every match as your player, FIFA Player Career style: you control only yourself, your
  teammates play around you and pass to you when you call for it. A rating out of 10 after every match with its
  reasons, XP to spend on six attributes, manager trust that decides whether you start, come off the bench or sit,
  a 12-club league over 22 matchdays, the Golden Boot race, awards, transfer offers from bigger clubs, an age curve
  and retirement. Any match can be simulated instead.
- **Kick-off**: any two clubs, a full match, you run the whole team (it switches to the man that matters; Switch to
  change).

## On the pitch

- 11 v 11 in real time: formations (4-3-3, 4-4-2, 4-2-3-1), a defensive shape that shifts with the ball, pressing
  with cover, marking that reads runs a beat late, passing chosen by lane safety and space, runs in behind, crosses,
  headers, keepers who narrow the angle, dive and parry (some round the post), throw-ins, corners, goal kicks, fouls,
  free kicks with a wall, penalties, offside, cards, half time and full time.
- Ball physics with the drag crisis, Magnus curl and spin decay.
- A broadcast camera behind your attack (portrait: you always play up the screen); it drops back when you defend.
- Sound made on the spot: crowd, kicks, whistle, net, post.

## Controls

Left thumb: a floating stick (let go and your player keeps moving on his own). Right thumb: four buttons that change
with the play.

| | Big button | Pass | Through | Small |
|---|---|---|---|---|
| Your ball | Shoot (hold for power, aim with the stick) | Pass (hold = lob / cross) | Through ball (hold = chipped) | Sprint |
| A teammate's (career) | | Call for it | Run in behind | Sprint |
| Theirs | Tackle | Switch (Kick-off) / Press (career, hold) | Slide | Sprint |

Keyboard: arrows or WASD, Space, J, K, Shift, E.

## Docs

- [docs/PLAN.md](docs/PLAN.md): the design and the milestones
- [docs/RESEARCH.md](docs/RESEARCH.md): the research behind it, with sources
- [docs/ROADMAP.md](docs/ROADMAP.md): status, how to test, rollback points

## Run it locally

```
python3 tools/serve.py 48241
```

then open http://localhost:48241. `node tools/harness.js 20` plays twenty computer-v-computer matches with the real
engine and prints the averages.

## Layout

```
index.html          loads three.js, then the game's scripts in order
css/game.css        the look
js/data.js          clubs, names, nations, positions, commentary
js/physics.js       the pitch and the ball
js/model.js         the players' bodies: the pocket player model, the soccer kit shader, animation
js/match.js         a full match: rules, AI, your controls, stats
js/render3d.js      the stadium, the players and the camera in 3D
js/controls.js      the stick and the buttons
js/audio.js         crowd, kicks, whistle
js/sim.js           match plans for the career, quick results for other games
js/career.js        My Career: the save, the league, ratings, growth, transfers
js/ui.js            the screens
models/             the player model and its clips (see models/README.md)
tools/              local server, test harness
```
