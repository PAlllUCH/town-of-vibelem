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
      town: ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'janitor', 'consigliere'],
      neutral: ['amnesiac', 'jester', 'spy']
    },
    p2: {
      id: 'p2', name: 'The Poisoned Pint',
      tagline: 'Sabotage: the Mafia cripples the town\'s power roles one drink at a time.',
      town: ['jailor', 'doctor', 'sheriff', 'lookout', 'escort', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'poisoner', 'consort'],
      neutral: ['drunk', 'witch', 'spy']
    },
    p3: {
      id: 'p3', name: 'The Gunpowder Plot',
      tagline: 'Firepower on both sides: town guns and an unsuppressible night killer.',
      town: ['jailor', 'deputy', 'veteran', 'vigilante', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'consort', 'forger'],
      neutral: ['serialkiller', 'survivor', 'spy']
    },
    p4: {
      id: 'p4', name: 'The Imposter at the Altar',
      tagline: 'A wedding party where the guest of honor (the Mayor) is a target for both the knife and the noose. The Executioner schemes to hang the guest of honor; the town must shield them.',
      town: ['jailor', 'mayor', 'doctor', 'sheriff', 'lookout', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'framer', 'consigliere'],
      neutral: ['jester', 'executioner', 'spy']
    },
    p5: {
      id: 'p5', name: 'The Widow\'s Vigil',
      tagline: 'Mourning and espionage: the Witch and the Poisoner turn knowledge against the town while the dead keep watching.',
      town: ['jailor', 'sheriff', 'undertaker', 'medium', 'doctor', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'poisoner', 'blackmailer'],
      neutral: ['witch', 'survivor', 'spy']
    },
    p6: {
      id: 'p6', name: 'The Clock Strikes Thirteen',
      tagline: 'Chaos at midnight: two night killers and heavy town firepower make every night decisive.',
      town: ['jailor', 'vigilante', 'veteran', 'deputy', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'consort', 'forger'],
      neutral: ['serialkiller', 'drunk', 'spy']
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
      position: 4, title: 'Escort', roles: ['escort'],
      prompt: 'Escort, open your eyes. Point to your roleblock target.'
    },
    {
      position: 4, title: 'Consort', roles: ['consort'],
      prompt: 'Consort, open your eyes. Point to your roleblock target.'
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
      position: 7, title: 'Janitor', roles: ['janitor'],
      prompt: 'Janitor, open your eyes. Point to the corpse you clean.'
    },
    {
      position: 7, title: 'Forger', roles: ['forger'],
      prompt: 'Forger, open your eyes. Point to the player whose will you forge.'
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
      position: 11, title: 'Sheriff', roles: ['sheriff'],
      prompt: 'Sheriff, open your eyes. Point to the player you check.'
    },
    {
      position: 11, title: 'Tracker', roles: ['tracker'],
      prompt: 'Tracker, open your eyes. Point to the player you follow.'
    },
    {
      position: 11, title: 'Lookout', roles: ['lookout'],
      prompt: 'Lookout, open your eyes. Point to the player you watch.'
    },
    {
      position: 11, title: 'Witness', roles: ['witness'],
      prompt: 'Witness, open your eyes. Point to the first player you compare, then point to the second.'
    },
    {
      position: 11, title: 'Consigliere', roles: ['consigliere'],
      prompt: 'Consigliere, open your eyes. Point to the player you inspect.'
    },
    {
      position: 11, title: 'Undertaker', roles: ['undertaker'],
      prompt: 'Undertaker, open your eyes. Point to the corpse you inspect.'
    },
    {
      position: 11, title: 'Spy', roles: ['spy'],
      prompt: 'Spy, open your eyes. Point to the player you watch.'
    },
    {
      position: 11, title: 'Oracle', roles: ['oracle'],
      prompt: 'Oracle, open your eyes. Point to the player you read.'
    },
    {
      position: 12, title: 'Retributionist', roles: ['retributionist'],
      prompt: 'Retributionist, open your eyes. Point to the corpse you revive.'
    },
    {
      position: 12, title: 'Amnesiac', roles: ['amnesiac'],
      prompt: 'Amnesiac, if you choose to remember, open your eyes. Point to the corpse whose role you remember.'
    },
    {
      position: 13, title: 'Medium and Ghosts', roles: ['medium'],
      prompt: 'Medium, open your eyes. Ghost Council, open your eyes.'
    },
    {
      position: 14, title: 'Morning', roles: [],
      prompt: 'Everyone, open your eyes. Morning has broken.'
    }
  ];

  Object.freeze(E.RATIO_TABLE);
  Object.freeze(E.PRESETS);
  Object.freeze(E.SEAT_LAYOUTS);
  Object.freeze(E.NIGHT_STEPS);
})(typeof window !== 'undefined' ? window : globalThis);
