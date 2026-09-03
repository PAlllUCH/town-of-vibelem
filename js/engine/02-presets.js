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
    blank: {
      id: 'blank',
      name: { en: 'Blank Slate', pl: 'Czysta Tablica' },
      tagline: { en: 'A lean core: Jailor, Doctor, Sheriff vs Godfather and Mafioso, plus a Jester. Everything else is Civilians until you add roles.', pl: 'Szczupły rdzeń: Więziennik, Lekarz i Szeryf przeciw Ojcu Chrzestnemu z Mafioso, plus Błazen. Reszta to Mieszkańcy, dopóki nie dodasz własnych ról.' },
      town: ['jailor', 'doctor', 'sheriff'],
      mafia: ['godfather', 'mafioso'],
      neutral: ['jester']
    },
    p1: {
      id: 'p1',
      name: { en: 'Whispers from the Morgue', pl: 'Szepty z Kostnicy' },
      tagline: { en: 'The town gathers its information from the dead; the Mafia buries the truth.', pl: 'Miasto czerpie wiedzę od zmarłych; Mafia grzebie prawdę.' },
      town: ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'janitor', 'consigliere'],
      neutral: ['amnesiac', 'jester', 'spy']
    },
    p2: {
      id: 'p2',
      name: { en: 'The Poisoned Pint', pl: 'Zatruta Pinta' },
      tagline: { en: 'Sabotage: the Mafia cripples the town\'s power roles one drink at a time.', pl: 'Sabotaż: Mafia wyłącza potężne role miasta po kolei, przy każdym drinku.' },
      town: ['jailor', 'doctor', 'sheriff', 'lookout', 'escort', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef', 'innkeeper'],
      mafia: ['godfather', 'mafioso', 'poisoner', 'consort'],
      neutral: ['drunk', 'witch', 'spy']
    },
    p3: {
      id: 'p3',
      name: { en: 'The Gunpowder Plot', pl: 'Spisek Prochowy' },
      tagline: { en: 'Firepower on both sides: town guns and an unsuppressible night killer.', pl: 'Ognista siła obu stron: miejskie strzelby i nie do powstrzymania zabójca w nocy.' },
      town: ['jailor', 'deputy', 'veteran', 'vigilante', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef', 'innkeeper'],
      mafia: ['godfather', 'mafioso', 'consort', 'forger'],
      neutral: ['serialkiller', 'survivor', 'spy']
    },
    p4: {
      id: 'p4',
      name: { en: 'The Imposter at the Altar', pl: 'Upiór przy Ołtarzu' },
      tagline: { en: 'A wedding party where the guest of honor (the Mayor) is a target for both the knife and the noose. The Executioner schemes to hang the guest of honor; the town must shield them.', pl: 'Weselny wiwat, gdzie gość honorowy (Burmistrz) jest celem noża i stryczka. Egzekutor knuje jego powieszenie, a miasto musi go osłonić.' },
      town: ['jailor', 'mayor', 'doctor', 'sheriff', 'lookout', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'framer', 'consigliere'],
      neutral: ['jester', 'executioner', 'spy']
    },
    p5: {
      id: 'p5',
      name: { en: 'The Widow\'s Vigil', pl: 'Warta Wdowy' },
      tagline: { en: 'Mourning and espionage: the Witch and the Poisoner turn knowledge against the town while the dead keep watching.', pl: 'Żałoba i szpiegostwo: Wiedźma i Truciciel obracają wiedzę przeciw miastu, a zmarli wciąż obserwują.' },
      town: ['jailor', 'sheriff', 'undertaker', 'medium', 'doctor', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef'],
      mafia: ['godfather', 'mafioso', 'poisoner', 'blackmailer'],
      neutral: ['witch', 'survivor', 'spy']
    },
    p6: {
      id: 'p6',
      name: { en: 'The Clock Strikes Thirteen', pl: 'Zegar Wybija Trzynastą' },
      tagline: { en: 'Chaos at midnight: two night killers and heavy town firepower make every night decisive.', pl: 'Chaos o północy: dwóch nocnych zabójców i potężna broń miasta czyni każdą noc rozstrzygającą.' },
      town: ['jailor', 'vigilante', 'veteran', 'deputy', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef', 'innkeeper'],
      mafia: ['godfather', 'mafioso', 'consort', 'forger'],
      neutral: ['serialkiller', 'drunk', 'spy']
    }
  };

  E.SEAT_LAYOUTS = ['circle', 'u_shape'];

  E.NIGHT_ZERO_STEPS = [
    {
      position: 0,
      title: 'Night Zero — Washerwoman',
      roles: ['washerwoman'],
      prompt: 'Wake the Washerwoman. Relay their starting info.'
    },
    {
      position: 1,
      title: 'Night Zero — Chef',
      roles: ['chef'],
      prompt: 'Wake the Chef. Relay their starting info.'
    },
    {
      position: 2,
      title: 'Morning',
      roles: [],
      prompt: 'Night Zero is complete. Everyone, prepare for Day 1.'
    }
  ];

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
      position: 4, title: 'Innkeeper', roles: ['innkeeper'],
      prompt: 'Innkeeper, open your eyes. Point to the player drinking with you tonight.'
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
      position: 9, title: 'Demon', roles: ['demon'],
      prompt: 'Demon, open your eyes. Point to your kill target.'
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
      position: 11, title: 'Succubus', roles: ['succubus'],
      prompt: 'Succubus, open your eyes. Point to the player you enchant tonight.'
    },
    {
      position: 12, title: 'Necromant', roles: ['necromant'],
      prompt: 'Necromant, open your eyes. Point to the corpse whose power you borrow tonight.'
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
  Object.freeze(E.NIGHT_ZERO_STEPS);
  Object.freeze(E.NIGHT_STEPS);
})(typeof window !== 'undefined' ? window : globalThis);
