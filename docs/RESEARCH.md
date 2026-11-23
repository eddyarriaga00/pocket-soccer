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

## Shooting (2026-11-21, for the shooting rebuild)

**Shot types (EA FC).** Finesse trades power for accuracy and curls toward the corners, best from mid-range; the
power shot is the fastest but has a long wind-up; the chip lifts the ball over a keeper off his line; the low driven
shot is released early (before about 40% of the bar) and kept down, useful through traffic. Timed finishing (a second
press at contact, scored green when right) makes any type more accurate; mistimed is scuffed or wild, and overcharging
costs accuracy. Power should rise with distance.
→ *Six types, chosen on one thumb (below); a sweet spot on the power bar that moves with the distance; a perfect
release has about a third of the error; overhitting adds lift and sends shots over.*
Sources: [Operation Sports: FC 25 shooting accuracy](https://www.operationsports.com/ea-fc-25-how-to-improve-shooting-accuracy-explained),
[VideoGamer: power shot](https://www.videogamer.com/guides/fc-25-how-to-power-shot), [VideoGamer: finesse shot](https://www.videogamer.com/guides/fc-25-how-to-finesse-shot),
[FUT.GG: low driven shot](https://www.fut.gg/news/how-to-do-a-low-driven-shot-master-the-new-playstyle-in-fc-25/),
[EA forums: timed finishing in FC 25](https://forums.ea.com/blog/ea-sports-fc-game-info-hub-en/how-to-use-timed-finishing-in-ea-sports-fc%E2%84%A2-25/12294008),
[EA: FC 24 PlayStyles](https://www.ea.com/games/ea-sports-fc/pitch-notes/news/fc-24-playstyles-deepdive),
[Outsider Gaming: power and overcharging](https://outsidergaming.com/fifa-complete-shooting-guide-controls-tips-and-tricks/).

**One-thumb shooting (EA FC Mobile / FIFA Mobile).** Hold Shoot for power; swipe on the button to pick the shot:
down a finesse, up a chip, sideways a fake. Success comes from the aim, the shot context (position, pressure, shooting
off a dribble or a volley) and the shooting attributes; a power-up near 50% is the most reliable for a power shot.
→ *The same gestures on PocketSoccer's Shoot button; the context factors feed the error cone.*
Sources: [EA: FIFA Mobile gesture controls](https://www.ea.com/news/gameplay-controls-guide-gesture-controls),
[EA: FC Mobile gameplay deep dive](https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive),
[FIFPlay: FC Mobile controls](https://fifplay.com/fc-mobile-controls).

**The keeper's clock.** A struck ball can reach the goal in about half a second, while a dive to a corner takes 0.6 s
or more (up to a second for the top corner); dives to the bottom corners are faster than to the top. Saves depend
mainly on the keeper's reaction time and on ball speed.
→ *Reaction scaled by distance (set and reading the body up close, slower to a strike from range, later through a
crowd); reach shrinks toward the top corner; keepers read curl only in part.*
Sources: [Frontiers: penalty kick timing](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2020.00013/epub),
[Springer: goalkeeper dive study](https://link.springer.com/article/10.1007%2Fs12662-018-0506-3),
[Taking the goalkeeper's side in penalty kicks](https://www.researchgate.net/profile/Sebastian-Tambusso/publication/259968890_Taking_the_goalkeeper%27s_side_in_association_football_penalty_kicks/links/544903cd0cf2f14fb8145b32/Taking-the-goalkeepers-side-in-association-football-penalty-kicks.pdf).

**Placement.** On-target shots into the corners are worth far more than shots down the middle (expected goals on
target); a ball just inside the top corner is close to unsaveable.
→ *Aim into the corners with the stick (a ring shows the spread); the call after a goal names where it went in.*
Sources: [The Analyst: xGOT](https://theanalyst.com/articles/what-are-expected-goals-on-target-xgot/),
[Stats Perform: xGOT](https://www.statsperform.com/resource/enhancing-expected-goals-on-target/),
[Datawrapper: where goals go in](https://www.datawrapper.de/blog/football-goals-analysis).

**Accuracy factors.** The dominant foot is more accurate than the weaker one; balance, clean contact and judging
power matter; volleys hit hard tend to fly.
→ *Weaker foot, shooting across the body, a defender close, a sprint and a ball in the air widen the cone.*
Sources: [Frontiers: dominant vs non-dominant foot shooting](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1348983/pdf),
[Sportmonks: shot accuracy](https://www.sportmonks.com/glossary/shot-accuracy), [Blayze: volleys](https://blayze.io/blog/soccer/expert-tips-for-improving-%20your-soccer-volleys-and-half-volleys).

**Feel.** Hit-stop, coherent sound and camera control shape how hard an impact feels; a motion trail changed players'
perception more than physics tweaks did.
→ *A short hit-stop and camera shake on hard strikes, a ball trail, slow motion as a shot on target reaches the goal,
a net that balloons, a timing call (PERFECT / GOOD / EARLY / OVERHIT), a thump on a perfect strike.*
Sources: [arXiv: impact feel in action games](https://arxiv.org/pdf/2011.09201), [Rutgers: game feel lecture](https://sakai.rutgers.edu/access/content/group/0a4e9ee5-ee55-4b15-b778-52a05786e504/lectures/04_gamefeel.pdf),
[Wikipedia: game feel](https://Www.wikipedia.org/wiki/Game_feel).

## The next build (2026-11-23): models, social, better play

**The sister games, read from their code.** PocketBasketball (`bf1c80f`): the pocket player with a stepped look
builder, face sets for the moment (happy, stern, tired), `R.portrait()` headshots and full bodies, walkout, rival
face-off, cutscenes, three cameras and a radar, replays and a video highlight reel, a two-voice recorded booth;
`social()` (followers, hype, one post a game, callouts, media day, polls and trends, messages, brand partners), a
story for every game, chemistry, abilities, contracts, awards, accounts on Firebase. PocketFootball (`2f097d2`):
`media.js` (post-game reactions from fans of both teams, analysts, reporters, teammates, rival and coach, loudness
from the grade, lines dealt like cards so none repeats in a week, the podium, callouts), weekly events, endorsements,
draft board, contracts, awards night; its own helmeted figures, so the basketball body stays PocketSoccer's.

**FC IQ (EA FC 25).** Player Roles, each with Focuses, decide how every player moves with and without the ball; an
activity map shows each role's zones; players out of a familiar role play worse.
→ *Roles and styles for PocketSoccer's AI (NEXT.md A4).*
Sources: [EA: FC IQ deep dive](https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-fc-iq-deep-dive),
[Dexerto: FC IQ explained](https://dexerto.com/ea-sports-fc/what-is-fc-iq-in-ea-fc-25-new-feature-explained-2822024),
[Charlie Intel: FC IQ tactics](https://charlieintel.com/ea-sports-fc/what-is-fc-iq-in-ea-fc-25-tactics-overhaul-explained-333068).

**Pitch control and space.** Each player's influence on each point of the pitch, modelled as a Gaussian stretched by
his velocity and distance to the ball, gives how much of the pitch each team controls; weighted by the value of each
zone it scores space, and runs can be judged by the value they reach or create (off-ball expected threat).
→ *Off-ball runs and the carrier's choices scored by pitch control × pitch value (NEXT.md A4).*
Sources: [Frontiers: Space and Control in Soccer](https://www.frontiersin.org/articles/10.3389/fspor.2021.676179),
[PMC copy](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8322620/), [Soccermatics: off-ball runs](https://soccermatics.readthedocs.io/en/main/lesson7/OffBallRuns.html),
[arXiv: vision-aware pitch control](https://www.arxiv.org/pdf/2602.18519), [Fernández and Bornn: Wide Open Spaces](https://www.scribd.com/document/536550379/Wide-Open-Spaces).

**Dribbling and defending on a phone (EA FC Mobile).** Turn speed from height and agility; a dribbler slows between
touches so a defender can stay close; skill moves on a tap or swipe of the Sprint & Skill button, each one in a row
slower and looser; face-up dribbling; the stick alone keeps a tactical marking distance, hold to tackle, double tap
to send a second man to press; a hard tackle.
→ *NEXT.md A1, A2, A5.* Sources: [EA: FC Mobile gameplay deep dive](https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive),
[FIFPlay: FC Mobile controls](https://fifplay.com/fc-mobile-controls), [EA: FC Mobile PlayStyles](https://www.ea.com/en/games/ea-sports-fc/fc-mobile/news/playstyles-deep-dive).

**Defending (EA FC 24).** Jockey/contain keeps the defender close and forces errors; a missed standing tackle leaves
a big gap; slides are a last resort; shoulder challenges often end in fouls.
Sources: [VideoGamer: FC 24 defending](https://videogamer.com/guides/fc-24-how-to-defend-like-a-pro),
[Team Gullit: tackling](https://teamgullit.com/ea-sports-fc/tackling), [Prima: advanced defending](https://primagames.com/gaming/how-to-use-advanced-defending-in-ea-sports-fc-24).

**What makes it feel right.** Reviews reward a ball and a player that answer at once and animations that do not lock
you in; first touch (from the pass's pace, spin and the receiver) and player switching decide whether a game feels
precise or random; EA's FC 26 notes target animation lock-in and trapping.
Sources: [EA: FC 26 gameplay deep dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive),
[GamesRadar: FIFA 14 review](https://www.gamesradar.com/uk/fifa-14-review), [Bleacher Report: FIFA 13](https://bleacherreport.com/articles/1345553-fifa-soccer-13-gameplay-review-and-features-for-hit-video-game),
[Game Informer: FC 26](https://www.gameinformer.com/review/ea-sports-fc-26/an-immersive-step-forward).

**Social media in a career (EA FC 25).** EA added a feed reacting to your save (an invented-feeling transfer insider
among it) and restored walk-outs and lineups after players asked. Players called the feed filler: repetitive stock
lines, wrong text, and "popularity on social media gains you nothing"; they asked for media that moves morale, fan
reaction and the board.
→ *Every social number in PocketSoccer moves something in the career (NEXT.md Track C).*
Sources: [GGRecon: FC 25 devs on social media in career](https://www.ggrecon.com/articles/ea-fc-25-devs-talk-the-women-s-game-live-start-points-and-adding-social-media-trolling-to-career-mode/),
[EA forums: player career assessment](https://forums.ea.com/discussions/fc-25-game-modes-en/my-assessment-of-player-career-mode-/7865091),
[EA: FC 25 community update](https://www.ea.com/games/ea-sports-fc/fc-25/news/fc-25-community-update),
[Charlie Intel: FC 25 career features](https://charlieintel.com/ea-sports-fc/all-new-features-in-ea-fc-25-career-mode-333031).
