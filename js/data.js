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

  /* The world: seven leagues in seven countries. Clubs are the game's own (invented names, colours and grounds); the
     countries are real, for the national teams. CLUBS is one list for every league (each club carries its league,
     lg); the first twelve are the Premier Division, as before, so older saves keep their club. */
  const LEAGUES = [
    { id: 0, name: 'Premier Division', country: 'England', ab: 'ENG', cup: 'Albion Cup', c: '#c8102e' },
    { id: 1, name: 'Liga Primera', country: 'Spain', ab: 'ESP', cup: 'Copa del Sol', c: '#f2c14e' },
    { id: 2, name: 'Serie Prima', country: 'Italy', ab: 'ITA', cup: 'Coppa Tricolore', c: '#1d4ed8' },
    { id: 3, name: 'Erste Liga', country: 'Germany', ab: 'GER', cup: 'Pokal', c: '#111827' },
    { id: 4, name: 'Ligue Premier', country: 'France', ab: 'FRA', cup: 'Coupe Nationale', c: '#1e3a8a' },
    { id: 5, name: 'S\u00e9rie Ouro', country: 'Brazil', ab: 'BRA', cup: 'Copa Verde', c: '#16a34a' },
    { id: 6, name: 'Pocket Soccer League', country: 'United States', ab: 'USA', cup: 'Open Cup', c: '#0f172a' }
  ];
  const X = (lg, list) => list.map(([name, ab, c1, c2, ovr, ground]) => Object.assign(C(name, ab, c1, c2, ovr, ground), { lg }));
  CLUBS.forEach(c => { c.lg = 0; });
  CLUBS.push(...X(1, [['Real Montesol', 'RMS', '#f8fafc', '#7c3aed', 86, 'Estadio del Sol'], ['CD Villaroja', 'VLR', '#b91c1c', '#facc15', 83, 'Campo Rojo'], ['Atl\u00e9tico Sierra Norte', 'ASN', '#dc2626', '#1e3a8a', 79, 'La Sierra'],
    ['Puerto Azul CF', 'PAZ', '#0ea5e9', '#ffffff', 75, 'El Puerto'], ['UD Campoalto', 'UDC', '#15803d', '#ffffff', 71, 'Campoalto'], ['SD Rioseco', 'SDR', '#f97316', '#111827', 68, 'Ribera'],
    ['CF Torrelinda', 'TLD', '#7c2d12', '#fde68a', 65, 'La Torre'], ['Deportivo Altamar', 'DAL', '#1e40af', '#fbbf24', 63, 'Altamar'], ['Racing Valdeluz', 'RVL', '#16a34a', '#f8fafc', 60, 'Valdeluz'], ['UD Pe\u00f1ablanca', 'UPB', '#e5e7eb', '#065f46', 57, 'La Pe\u00f1a']]));
  CLUBS.push(...X(2, [['AC Montefiore', 'ACM', '#111827', '#dc2626', 84, 'San Fiore'], ['US Valdoro', 'VAL', '#facc15', '#1e3a8a', 82, 'Stadio d\u2019Oro'], ['Sporting Lagonero', 'SLN', '#111827', '#f8fafc', 78, 'Il Lago'],
    ['FC Castelrosa', 'CAS', '#db2777', '#111827', 74, 'Castello'], ['AS Portofiume', 'APF', '#0369a1', '#facc15', 71, 'Il Porto'], ['Virtus Collina', 'VIR', '#7c3aed', '#f8fafc', 68, 'La Collina'],
    ['Atletico Sanvento', 'ASV', '#b91c1c', '#f8fafc', 65, 'Sanvento'], ['Unione Borgonuovo', 'UBN', '#166534', '#fde68a', 62, 'Il Borgo'], ['Calcio Torrebianca', 'CTB', '#f8fafc', '#1e3a8a', 59, 'Torrebianca'], ['FC Pietralta', 'PTA', '#78350f', '#f8fafc', 56, 'Pietralta']]));
  CLUBS.push(...X(3, [['FC Steinbach', 'FCS', '#dc2626', '#f8fafc', 85, 'Steinpark'], ['SV Rheinau', 'SVR', '#facc15', '#111827', 82, 'Rheinstadion'], ['TSV Eichenfeld', 'TSV', '#16a34a', '#f8fafc', 77, 'Eichenpark'],
    ['SC Lindenberg', 'SCL', '#1d4ed8', '#f8fafc', 74, 'Lindenarena'], ['Union Hafenstadt', 'UHS', '#7f1d1d', '#f8fafc', 71, 'Am Hafen'], ['VfB Morgenthal', 'VFB', '#f8fafc', '#dc2626', 68, 'Morgenthal'],
    ['FV Bergstadt', 'FVB', '#0f766e', '#f8fafc', 65, 'Bergblick'], ['Eintracht Kaltbrunn', 'EKB', '#111827', '#dc2626', 62, 'Kaltbrunn'], ['SpVgg Talheim', 'SPV', '#7c3aed', '#facc15', 59, 'Talheim'], ['1. FC Wolkenau', 'FCW', '#0ea5e9', '#111827', 56, 'Wolkenau']]));
  CLUBS.push(...X(4, [['Olympique Valmont', 'OVM', '#1e3a8a', '#f8fafc', 84, 'Le Val'], ['AS Rivebelle', 'ASR', '#dc2626', '#facc15', 80, 'Rivebelle'], ['FC Montclair', 'FCM', '#f8fafc', '#1e40af', 76, 'Montclair'],
    ['Stade Lacroix', 'SLX', '#0ea5e9', '#111827', 73, 'Stade Lacroix'], ['Racing Saint-Aubert', 'RSA', '#7c3aed', '#f8fafc', 70, 'Saint-Aubert'], ['US C\u00f4te-d\u2019Argent', 'UCA', '#facc15', '#111827', 67, 'La C\u00f4te'],
    ['SC Bellerive', 'SCB', '#16a34a', '#f8fafc', 64, 'Bellerive'], ['AJ Fontaine', 'AJF', '#b91c1c', '#f8fafc', 61, 'La Fontaine'], ['\u00c9toile de Marsac', 'EDM', '#111827', '#facc15', 58, 'Marsac'], ['En Avant Vermont', 'EAV', '#f97316', '#111827', 55, 'Vermont']]));
  CLUBS.push(...X(5, [['Uni\u00e3o Praiana', 'UPR', '#16a34a', '#facc15', 82, 'Est\u00e1dio da Praia'], ['Atl\u00e9tico Vale Dourado', 'AVD', '#facc15', '#111827', 80, 'Vale Dourado'], ['Clube Lagoa Azul', 'CLA', '#0ea5e9', '#f8fafc', 76, 'A Lagoa'],
    ['Esporte Mata Alta', 'EMA', '#15803d', '#f8fafc', 73, 'Mata Alta'], ['Sport Recanto', 'SRC', '#dc2626', '#111827', 70, 'Recanto'], ['Clube Areia Branca', 'CAB', '#f8fafc', '#dc2626', 67, 'Areia Branca'],
    ['Ferrovi\u00e1ria Planalto', 'FPL', '#7c2d12', '#f8fafc', 64, 'O Planalto'], ['Ipiranga Sertanejo', 'IPS', '#1d4ed8', '#facc15', 61, 'Sert\u00e3o'], ['Mar\u00e9 Alta FC', 'MAF', '#0f766e', '#f8fafc', 58, 'Mar\u00e9 Alta'], ['Esporte Serra Fria', 'ESF', '#6b7280', '#f8fafc', 55, 'Serra Fria']]));
  CLUBS.push(...X(6, [['Bay City FC', 'BAY', '#0f172a', '#38bdf8', 77, 'Bayfront Park'], ['Lone Star United', 'LSU', '#b91c1c', '#f8fafc', 75, 'Star Field'], ['Pacific Tide', 'PTD', '#0e7490', '#fde68a', 73, 'Tide Stadium'],
    ['Capital City SC', 'CCS', '#1e3a8a', '#dc2626', 71, 'Capitol Field'], ['Desert Sun SC', 'DSS', '#f97316', '#111827', 69, 'Sun Bowl'], ['Harbor United', 'HBU', '#111827', '#facc15', 67, 'Harborside'],
    ['Mountain Rapids', 'MTR', '#166534', '#f8fafc', 65, 'Rapids Park'], ['Gulf Coast FC', 'GCF', '#0ea5e9', '#f97316', 63, 'Gulf Field'], ['Twin Rivers SC', 'TRS', '#7c3aed', '#f8fafc', 60, 'Riverside'], ['Northwoods FC', 'NWF', '#14532d', '#fde68a', 57, 'The Woods']]));

  /* national teams: colours and strength (out of 99) for the nations a player can come from */
  const NATION = { 'Brazil': ['#facc15', '#16a34a', 87], 'France': ['#1e3a8a', '#f8fafc', 87], 'Argentina': ['#7dd3fc', '#f8fafc', 87], 'England': ['#f8fafc', '#1e3a8a', 85], 'Spain': ['#dc2626', '#facc15', 86],
    'Germany': ['#f8fafc', '#111827', 84], 'Portugal': ['#b91c1c', '#16a34a', 84], 'Netherlands': ['#f97316', '#f8fafc', 83], 'Italy': ['#1d4ed8', '#f8fafc', 82], 'Belgium': ['#dc2626', '#111827', 81],
    'Croatia': ['#f8fafc', '#dc2626', 80], 'Uruguay': ['#38bdf8', '#111827', 79], 'Colombia': ['#facc15', '#1e3a8a', 78], 'Morocco': ['#b91c1c', '#15803d', 78], 'United States': ['#f8fafc', '#1e3a8a', 77],
    'Mexico': ['#15803d', '#f8fafc', 77], 'Denmark': ['#dc2626', '#f8fafc', 77], 'Switzerland': ['#dc2626', '#f8fafc', 76], 'Japan': ['#1e3a8a', '#f8fafc', 76], 'Senegal': ['#f8fafc', '#15803d', 76],
    'Serbia': ['#b91c1c', '#1e3a8a', 74], 'Poland': ['#f8fafc', '#dc2626', 74], 'Austria': ['#dc2626', '#f8fafc', 73], 'Sweden': ['#facc15', '#1d4ed8', 73], 'South Korea': ['#dc2626', '#111827', 74],
    'Ecuador': ['#facc15', '#1e3a8a', 73], 'Nigeria': ['#16a34a', '#f8fafc', 74], 'Turkey': ['#dc2626', '#f8fafc', 73], 'Norway': ['#dc2626', '#1e3a8a', 73], 'Wales': ['#dc2626', '#16a34a', 71],
    'Scotland': ['#1e3a8a', '#f8fafc', 71], 'Ivory Coast': ['#f97316', '#16a34a', 73], 'Cameroon': ['#16a34a', '#dc2626', 71], 'Ghana': ['#f8fafc', '#111827', 70], 'Egypt': ['#dc2626', '#f8fafc', 70],
    'Australia': ['#facc15', '#14532d', 70], 'Canada': ['#dc2626', '#f8fafc', 71], 'Chile': ['#dc2626', '#1e3a8a', 70], 'Peru': ['#f8fafc', '#dc2626', 69], 'Paraguay': ['#dc2626', '#f8fafc', 68],
    'Ireland': ['#16a34a', '#f8fafc', 69], 'Costa Rica': ['#dc2626', '#1e3a8a', 67], 'Jamaica': ['#facc15', '#16a34a', 64], 'Honduras': ['#1e3a8a', '#f8fafc', 62], 'Guatemala': ['#1d4ed8', '#f8fafc', 60], 'El Salvador': ['#1d4ed8', '#f8fafc', 59] };
  /* the confederation each nation plays its summer championship in (the World Cup, every fourth summer, takes everyone) */
  const CONF = { Europe: ['England', 'Scotland', 'Wales', 'Ireland', 'France', 'Spain', 'Portugal', 'Italy', 'Germany', 'Netherlands', 'Belgium', 'Croatia', 'Serbia', 'Poland', 'Denmark', 'Sweden', 'Norway', 'Switzerland', 'Austria', 'Turkey'],
    'South America': ['Brazil', 'Argentina', 'Colombia', 'Uruguay', 'Chile', 'Ecuador', 'Peru', 'Paraguay'],
    'North America': ['United States', 'Mexico', 'Canada', 'El Salvador', 'Guatemala', 'Honduras', 'Costa Rica', 'Jamaica'],
    Africa: ['Morocco', 'Senegal', 'Nigeria', 'Ghana', 'Ivory Coast', 'Cameroon', 'Egypt'], Asia: ['Japan', 'South Korea', 'Australia'] };
  const CHAMP = { Europe: 'European Championship', 'South America': 'Copa Continental', 'North America': 'Gold Cup', Africa: 'African Nations Cup', Asia: 'Asian Cup' };
  const confOf = n => Object.keys(CONF).find(k => CONF[k].includes(n)) || 'Europe';
  const NAB = { 'United States': 'USA', 'South Korea': 'KOR', 'Ivory Coast': 'CIV', 'Costa Rica': 'CRC', 'El Salvador': 'SLV', 'Netherlands': 'NED', 'Germany': 'GER', 'Switzerland': 'SUI', 'Portugal': 'POR', 'Croatia': 'CRO', 'Denmark': 'DEN', 'Paraguay': 'PAR', 'Uruguay': 'URU', 'Nigeria': 'NGA', 'Morocco': 'MAR', 'Japan': 'JPN', 'Ireland': 'IRL', 'Jamaica': 'JAM', 'Honduras': 'HON', 'Guatemala': 'GUA', 'Chile': 'CHI', 'Spain': 'ESP', 'Serbia': 'SRB', 'Austria': 'AUT', 'Wales': 'WAL', 'Scotland': 'SCO' };
  const nationTeam = n => { const v = NATION[n] || ['#64748b', '#f8fafc', 65]; const ab = NAB[n] || n.slice(0, 3).toUpperCase(); return { name: n, ab, c1: v[0], c2: v[1], ovr: v[2], ground: 'the national stadium', nation: true }; };

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

  PS.data = { CLUBS, LEAGUES, NATION, nationTeam, CONF, CHAMP, confOf, POS, ATTRS, NATIONS, FIRST, LAST, LINES };
})();
