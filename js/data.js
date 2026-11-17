/* PocketSoccer: data tables. Clubs, names, nations, positions and how each position's overall is weighted.
   Loaded first; everything else reads PS.data. Nothing in here has behaviour.
   Every club, town and player name is the game's own invention: no real club's name, crest or colours. */
(() => {
  'use strict';
  const PS = window.PS = window.PS || {};

  /* The prototype league: twelve clubs, home and away (22 matchdays). ovr is the club's starting strength
     (55 weak .. 85 strong); c1 the shirt, c2 the shorts and trim. Their order is the order saves use. */
  const C = (name, ab, c1, c2, ovr, ground) => ({ name, ab, c1, c2, ovr, ground });
  const CLUBS = [
    C('Ashvale Albion', 'ASH', '#c8102e', '#ffffff', 82, 'The Vale'),
    C('Brookmere Rovers', 'BRK', '#1d4ed8', '#ffffff', 79, 'Mere Park'),
    C('Calderport', 'CAL', '#0b1f44', '#facc15', 77, 'Harbour Road'),
    C('Dunmore Athletic', 'DUN', '#15803d', '#f8fafc', 74, 'Kilns Lane'),
    C('Elmstead United', 'ELM', '#7a1f3d', '#7dd3fc', 72, 'Elm Park'),
    C('Fairhaven City', 'FHC', '#38bdf8', '#0f172a', 70, 'Seafront Stadium'),
    C('Greywick Wanderers', 'GRW', '#111827', '#e5e7eb', 68, 'The Wick'),
    C('Hollinsgate Forest', 'HOL', '#166534', '#fde68a', 66, 'Forest Lodge'),
    C('Ironbridge Town', 'IRB', '#ea580c', '#1c1917', 63, 'Foundry Field'),
    C('Kestrel Park Rangers', 'KPR', '#0f766e', '#ffffff', 61, 'Kestrel Park'),
    C('Lowmoor Saints', 'LOW', '#b91c1c', '#000000', 58, 'St Anne’s'),
    C('Marchfield Villa', 'MAR', '#6d28d9', '#fef3c7', 56, 'Villa Meadow')
  ];

  /* Positions in the career. The weights make the overall: each row sums to 1. */
  const POS = {
    ST: { name: 'Striker', short: 'ST', w: { sho: .34, pac: .2, dri: .2, phy: .16, pas: .1, def: 0 } },
    W:  { name: 'Winger', short: 'W', w: { pac: .3, dri: .3, pas: .2, sho: .15, phy: .05, def: 0 } },
    CM: { name: 'Midfielder', short: 'CM', w: { pas: .35, dri: .2, def: .15, phy: .15, sho: .1, pac: .05 } }
  };
  const ATTRS = [
    { k: 'pac', name: 'Pace', tip: 'Top speed and acceleration' },
    { k: 'sho', name: 'Shooting', tip: 'Shot power and how close shots go to where you flick' },
    { k: 'pas', name: 'Passing', tip: 'Pass accuracy and weight, through balls and crosses' },
    { k: 'dri', name: 'Dribbling', tip: 'Close control, first touch, beating a tackle' },
    { k: 'def', name: 'Defending', tip: 'Winning the ball back' },
    { k: 'phy', name: 'Physical', tip: 'Strength in a challenge, headers, stamina' }
  ];

  const NATIONS = ['United States', 'Mexico', 'Canada', 'Brazil', 'Argentina', 'Colombia', 'Uruguay', 'Chile', 'Ecuador',
    'England', 'Scotland', 'Wales', 'Ireland', 'France', 'Spain', 'Portugal', 'Italy', 'Germany', 'Netherlands', 'Belgium',
    'Croatia', 'Serbia', 'Poland', 'Denmark', 'Sweden', 'Norway', 'Switzerland', 'Austria', 'Turkey', 'Morocco', 'Senegal',
    'Nigeria', 'Ghana', 'Ivory Coast', 'Cameroon', 'Egypt', 'Japan', 'South Korea', 'Australia', 'El Salvador', 'Guatemala',
    'Honduras', 'Costa Rica', 'Jamaica', 'Peru', 'Paraguay'];

  const FIRST = ['Leo', 'Mateo', 'Jonah', 'Rafael', 'Ilias', 'Kai', 'Tomas', 'Aaron', 'Noah', 'Diego', 'Kofi', 'Yusuf', 'Luca',
    'Elias', 'Marco', 'Samir', 'Owen', 'Bruno', 'Felix', 'Jamal', 'Callum', 'Nico', 'Andre', 'Hugo', 'Emre', 'Joel', 'Ruben',
    'Theo', 'Sami', 'Dario', 'Kenji', 'Milo', 'Adrian', 'Ollie', 'Cesar', 'Malik', 'Ivan', 'Pablo', 'Reece', 'Tariq', 'Jude',
    'Alexis', 'Victor', 'Moussa', 'Ezra', 'Lucas', 'Iker', 'Ryo', 'Femi', 'Arlo'];
  const LAST = ['Okafor', 'Varela', 'Lindqvist', 'Moreau', 'Castellano', 'Brandt', 'Achterberg', 'Kowalczyk', 'Ferreira',
    'Haddad', 'Nakamura', 'Duarte', 'Asante', 'Whitlock', 'Rinaldi', 'Sorensen', 'Calloway', 'Benitez', 'Okonkwo', 'Mercer',
    'Petrovic', 'Lacroix', 'Hartmann', 'Quintero', 'Abernathy', 'Diallo', 'Esposito', 'Fairbairn', 'Gallardo', 'Holm',
    'Ibrahim', 'Jansen', 'Kessler', 'Lombardi', 'Mbeki', 'Novak', 'Oduya', 'Pereira', 'Rourke', 'Salazar', 'Toure',
    'Ulloa', 'Vidal', 'Wexford', 'Yilmaz', 'Zielinski', 'Arenas', 'Brook', 'Cardoso', 'Delacroix'];

  /* Commentary for the simulated parts of a match. {a} the attacking club, {d} the defending one, {p} a player. */
  const LINES = {
    kickoff: ['And we’re under way at {g}.', 'The referee blows, and {a} get us going.'],
    build: ['{a} keep the ball, patient through midfield.', '{a} probing down the left.', 'Neat triangles from {a} on the right.',
      '{d} sit deep and let {a} have it.', 'Long ball from {a}, headed clear.', '{a} switch the play.'],
    chance: ['Big chance for {a}! {p} drags it wide.', '{p} shoots for {a} — straight at the keeper.', 'Header from {p}, over the bar.',
      '{p} curls one from distance for {a}, just past the post.', 'Corner to {a}. Cleared by {d}.'],
    save: ['Great save! The {d} keeper tips {p}’s effort round the post.', 'Strong hands from the {d} keeper to keep out {p}.'],
    goal: ['GOAL! {p} scores for {a}!', 'GOAL for {a}! {p} finishes it off.', 'It’s in! {p} for {a}!'],
    card: ['Yellow card for {p} of {d}, a cynical foul.', 'Booking for {p} ({d}) after a late tackle.'],
    half: ['Half time.'],
    full: ['Full time.']
  };

  PS.data = { CLUBS, POS, ATTRS, NATIONS, FIRST, LAST, LINES };
})();
