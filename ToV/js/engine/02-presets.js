'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.RATIO_TABLE = {
    6: { town: 4, mafia: 2, neutral: 0 },
    7: { town: 5, mafia: 2, neutral: 0 },
    8: { town: 5, mafia: 2, neutral: 1 },
    9: { town: 6, mafia: 2, neutral: 1 },
    10: { town: 6, mafia: 3, neutral: 1 },
    11: { town: 7, mafia: 3, neutral: 1 },
    12: { town: 7, mafia: 3, neutral: 2 },
    13: { town: 8, mafia: 3, neutral: 2 },
    14: { town: 9, mafia: 4, neutral: 1 },
    15: { town: 9, mafia: 4, neutral: 2 }
  };

  E.PRESETS = {
    p1: {
      id: 'p1', name: 'Whispers from the Morgue',
      tagline: 'The town gathers its information from the dead; the Mafia buries the truth.',
      town: ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist'],
      mafia: ['godfather', 'mafioso', 'janitor', 'consigliere'],
      neutral: ['amnesiac', 'jester']
    },
    p2: {
      id: 'p2', name: 'The Poisoned Pint',
      tagline: 'Sabotage: the Mafia cripples the town\'s power roles one drink at a time.',
      town: ['jailor', 'doctor', 'sheriff', 'lookout', 'escort', 'tracker'],
      mafia: ['godfather', 'mafioso', 'poisoner', 'consort'],
      neutral: ['drunk', 'witch']
    },
    p3: {
      id: 'p3', name: 'The Gunpowder Plot',
      tagline: 'Firepower on both sides: town guns and an unsuppressible night killer.',
      town: ['jailor', 'deputy', 'veteran', 'vigilante', 'doctor', 'escort'],
      mafia: ['godfather', 'mafioso', 'consort', 'forger'],
      neutral: ['serialkiller', 'survivor']
    },
    p4: {
      id: 'p4', name: 'The Imposter at the Altar',
      tagline: 'A wedding party where the guest of honor (the Mayor) is a target for both the knife and the noose. The Executioner schemes to hang the guest of honor; the town must shield them.',
      town: ['jailor', 'mayor', 'doctor', 'sheriff', 'lookout', 'tracker'],
      mafia: ['godfather', 'mafioso', 'framer', 'consigliere'],
      neutral: ['jester', 'executioner']
    },
    p5: {
      id: 'p5', name: 'The Widow\'s Vigil',
      tagline: 'Mourning and espionage: the Witch and the Poisoner turn knowledge against the town while the dead keep watching.',
      town: ['jailor', 'sheriff', 'undertaker', 'medium', 'doctor', 'retributionist'],
      mafia: ['godfather', 'mafioso', 'poisoner', 'blackmailer'],
      neutral: ['witch', 'survivor']
    },
    p6: {
      id: 'p6', name: 'The Clock Strikes Thirteen',
      tagline: 'Chaos at midnight: two night killers and heavy town firepower make every night decisive.',
      town: ['jailor', 'vigilante', 'veteran', 'deputy', 'doctor', 'escort'],
      mafia: ['godfather', 'mafioso', 'consort', 'forger'],
      neutral: ['serialkiller', 'drunk']
    }
  };

  E.SEAT_LAYOUTS = ['circle', 'two_rows', 'u_shape', 'rectangular'];

  E.NIGHT_STEPS = [
    {
      position: 0, title: 'Veteran Alert', roles: ['veteran'],
      prompt: 'Veteran, open your eyes. Are you on alert tonight? Signal yes or no.'
    },
    {
      position: 1, title: 'Poisoner', roles: ['poisoner'],
      prompt: 'Poisoner, open your eyes. Point to your target.'
    },
    {
      position: 2, title: 'Witch', roles: ['witch'],
      prompt: 'Witch, open your eyes. Point to the player you control, then point to your target.'
    },
    {
      position: 3, title: 'Jailor', roles: ['jailor'],
      prompt: 'Jailor, open your eyes. Point to your target. Do you EXECUTE, thumbs down, or SPARE, thumbs up?'
    },
    {
      position: 4, title: 'Escort / Consort', roles: ['escort', 'consort'],
      prompt: 'Escort, or Consort, open your eyes. Point to your roleblock target.'
    },
    {
      position: 5, title: 'Doctor', roles: ['doctor'],
      prompt: 'Doctor, open your eyes. Point to the player you protect.'
    },
    {
      position: 6, title: 'Mafia', roles: ['godfather', 'mafioso'],
      prompt: 'Mafia: Godfather and Mafioso, open your eyes. Godfather, point to your kill target.'
    },
    {
      position: 7, title: 'Janitor and Forger', roles: ['janitor', 'forger'],
      prompt: 'Janitor and Forger, open your eyes. Janitor, point to the corpse you clean. Forger, point to the player whose will you forge.'
    },
    {
      position: 8, title: 'Blackmailer', roles: ['blackmailer'],
      prompt: 'Blackmailer, open your eyes. Point to the player you blackmail.'
    },
    {
      position: 9, title: 'Serial Killer', roles: ['serialkiller'],
      prompt: 'Serial Killer, open your eyes. Point to your kill target.'
    },
    {
      position: 10, title: 'Framer', roles: ['framer'],
      prompt: 'Framer, open your eyes. Point to the player you frame.'
    },
    {
      position: 11, title: 'Investigators', roles: ['sheriff', 'deputy', 'tracker', 'lookout', 'consigliere', 'undertaker'],
      prompt: 'Investigators: Sheriff, or inherited Deputy, Tracker, Lookout, Consigliere, and Undertaker, open your eyes.'
    },
    {
      position: 12, title: 'Retributionist', roles: ['retributionist', 'amnesiac'],
      prompt: 'Retributionist, open your eyes. Point to the corpse you revive. Amnesiac, if you choose to remember, point to the corpse whose role you remember.'
    },
    {
      position: 13, title: 'Medium and Ghosts', roles: ['medium'],
      prompt: 'Medium, open your eyes. Ghost Council, open your eyes.'
    },
    {
      position: 14, title: 'Morning', roles: [],
      prompt: 'Everyone, open your eyes. Morning has broken.'
    },
    {
      position: 15, title: 'Last Will Window', roles: [],
      prompt: 'Take 30 seconds to update your Last Wills silently.',
      timerSeconds: 30
    },
    {
      position: 16, title: 'Pencils Down', roles: [],
      prompt: 'Pencils down! Last night, the dead are announced. The day begins.'
    }
  ];

  Object.freeze(E.RATIO_TABLE);
  Object.freeze(E.PRESETS);
  Object.freeze(E.SEAT_LAYOUTS);
  Object.freeze(E.NIGHT_STEPS);
})(typeof window !== 'undefined' ? window : globalThis);
