# PocketSoccer: research notes

What was looked at before the plan was written (2026-11-16), what it says, and what the game does about it.

## Mobile soccer games: what works on a phone

**New Star Soccer** (the closest ancestor: one player's career on a phone). Reviewers describe guiding a
16-year-old to world star, with most of the match told in text commentary and only your involvement played.
Praised for the swipe scenarios and light management; criticised because the other players in a scenario stand
still and play stops dead after a pass.
→ *PocketSoccer keeps the "only your moments" structure and fixes both complaints: every player around you moves (runs,
presses, covers, marks) and a moment keeps going after a pass (one-twos, rebounds, a teammate's finish for your assist).*
Sources: [Pocket Gamer](https://www.pocketgamer.com/new-star-soccer/world-cup-month-why-i-love-new-star-soccer/),
[Wikipedia](https://wikipedia.com/wiki/New_Star_Soccer), [Trusted Reviews](https://www.trustedreviews.com/reviews/new-star-soccer-mobile-game),
[Eurogamer via mirror](https://venvegame.netlify.app/host-https-www.eurogamer.net/app-of-the-day-new-star-soccer).

**Score! Hero** (draw the ball's path). One-finger input is loved ("draw a line where you want the ball to go"), but
levels play on rails, difficulty spikes force replays of goals already scored, and monetisation shapes the design.
Players asked to draw dribble paths and teammates' runs.
→ *The flick-with-a-bend borrows the "draw where it goes" feel (curl is solved so the ball still lands where you
aimed), but in live play, not on rails. No forced replays, no paywalls.*
Sources: [Trusted Reviews](https://www.trustedreviews.com/score-hero-review), [Pocket Gamer](https://www.pocketgamer.com/score-hero/review/),
[App Store](https://apps.apple.com/gb/app/score-hero/id847492141).

**Retro Goal** (New Star's arcade sibling). Swipes and flicks, "as pick up and play as you can get", but some find the
controls clunky and lacking depth; you only control the attack when a chance opens.
→ *A short How to Play and a practice mode (Quick Moments); depth comes from curl, weight and timing, not more buttons.*
Sources: [Operation Sports](https://operationsports.com/retro-goal-review-retro-bowls-brother-arrives-on-the-switch),
[148Apps](https://www.148apps.com/reviews/retro-goal-review), [Defector](https://defector.com/this-little-soccer-game-on-my-phone-is-fun-as-hell).

**Swipe-to-shoot games** (Flick Shot Soccer, Swipy Soccer, Real Kick, Touch Soccer, UFL). Touch-drag-release shooting is
the standard one-thumb pattern; swipe direction picks shot type in UFL. One guide warns that portrait crowds buttons
and shrinks the pitch.
→ *No buttons on the pitch at all (gestures only), and the pitch runs up the screen so portrait shows more of it,
not less.* Sources: [Swipy Soccer](https://apps.apple.com/us/app/swipy-soccer/id1077708135),
[UFL controls guide](https://gamingonphone.com/guides/ufl-football-game-2026-the-complete-guide-to-controls/),
[Realistic Street Soccer controls](https://realistic-street-soccer.pages.dev/controls/mobile/).

## Career mode design

**EA FC Player Career.** A manager rating gauges the manager's belief in you; new players start on the bench and earn
minutes by completing match objectives. Player complaints: the rating drains during international breaks, injuries
and late substitute appearances make objectives impossible, keepers lose rating when nothing happens, ratings are
hard to raise, and growth caps out lower than promised.
→ *Trust moves only on match ratings, judged against the minutes you had; it never drains over a break; ratings show
their reasons; the growth ceiling is shown as a cost curve, not a hidden wall.*
Sources: [EA Pitch Notes, FIFA 22 career deep dive](https://www.ea.com/en-gb/playtesting/news/pitch-notes-fifa-22-career-mode-deep-dive),
[EA help: Career Mode guide](https://help.ea.com/help/ea-sports-fc/career-mode-guide),
[EA forums: FC 26 manager goals](https://forums.ea.com/discussions/fc-26-general-discussion-en/manager-goals-and-transfer-logic-in-player-career-mode-is-completely-broken/13531895),
[EA forums: FC 27 player career ratings](https://forums.ea.com/discussions/fc-27-career-mode-en/player-career-match-ratings/13804869),
[KeenGamer FC 25 guide](https://www.keengamer.com/articles/guides/ea-sports-fc-25-player-career-mode-guide-level-up-fast-origin-story-live-start/).

**Age curve (Football Manager community testing).** Most players peak around 24 (range 23–28), decline slowly to 31,
then the drop accelerates; keepers peak later. Development slows after 24; professionalism and environment matter.
→ *Free growth to 23, flat to 30, decline from 31 (pace first), sharper from 34.*
Sources: [sortitoutsi: when do players peak](https://sortitoutsi.net/content/67377/when-do-players-peak-in-football-manager-the-advise-from-si-is-a-lie),
[FourFourTwo FM wonderkid guide](https://www.fourfourtwo.com/features/football-manager-2016-how-nurture-hot-prospect-true-wonderkid).

**Match ratings (Sofascore).** Every player starts at 6.5; each stat adds or subtracts; ratings update through the
match; a perfect 10 is about 1 in 3,000 performances.
→ *PocketSoccer starts at 6.0 (fewer stats are counted, so the base sits lower), lists every adjustment, caps at 10.*
Source: [Sofascore: how the rating works](https://www.sofascore.com/news/sofascore-rating).

## Ball physics

Drag falls from about 0.5 to 0.2 as speed rises through the "drag crisis"; the Magnus (curl) effect weakens at high
speed; spin decays and must be modelled; an average drag value is enough for most trajectories.
→ *physics.js: drag 0.45 → 0.22 between 10 and 18 m/s, Magnus coefficient falling 40% from 18 to 32 m/s, spin decay
over ~5 s, then a solver that finds the launch angle so a curled ball still crosses the line where the player aimed.*
Sources: [Leeds/White Rose paper](https://eprints.whiterose.ac.uk/11156/1/paper_2.pdf),
[COMSOL: modeling the beautiful game](https://www.comsol.com/blogs/modeling-the-beautiful-game-from-ball-design-to-power-trivelas),
[Wooster thesis "Bend it like Magnus"](https://physics.wooster.edu/wp-content/uploads/2021/08/Junior-IS-Thesis-Web_2011_Ahmad.pdf),
[Siemens: Ronaldo's free kick](https://blogs.sw.siemens.com/simcenter/explaining-the-aerodynamics-behind-cristiano-ronaldos-free-kick-with-computer-simulation/).

## Names and licences

Football games have long used invented names to avoid disputes (Football Manager's stand-ins for real clubs); player
names and likenesses are licensed collectively through FIFPRO, and some leagues sell club rights collectively.
→ *Every club, town and player is invented; crests are drawn in code; real nation names only for international play.*
Sources: [Goal: why Man Utd is "Man UFC" in FM22](https://www.goal.com/en/news/why-manchester-united-called-man-ufc-football-manager-2022/1v2ua2jzxcgl51pr9l8p5gt1li),
[GamesIndustry: Sociable Soccer and the FIFPRO licence](https://dcmpx.remotevs.com/biz/gamesindustry/www/SL/sociable-soccers-jon-hare-says-real-player-names-are-vital-as-studio-secures-fifpro-licence).

## From PocketFootball (the owner's own game)

Kept: plain JS classic scripts with one namespace, a no-cache local server, a synchronous test harness, a
network-first service worker, a 62vh-wide portrait column on big screens, Archivo display type, navy neutrals and
one accent, the roadmap with rollback points, and pushing to `main` (GitHub Pages redeploys on every push).
