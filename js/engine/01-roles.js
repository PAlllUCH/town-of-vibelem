'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.ROLES = Object.create(null);
  var roleDefs = {
    jailor: {
      id: 'jailor', name: 'Jailor', team: 'TOWN', category: 'Town Killing',
      blurb: 'Jails a player each night, then EXECUTES (Unstoppable, max 3) or SPARES. Cannot execute on Night 1, cannot jail the same player two nights in a row.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: 3
    },
    undertaker: {
      id: 'undertaker', name: 'Undertaker', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, privately learns the true role of one corpse. Cannot inspect a corpse cleaned by the Janitor, or the same corpse twice.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    medium: {
      id: 'medium', name: 'Medium', team: 'TOWN', category: 'Town Support',
      blurb: 'Alive: reads the Ghost Ledger each night. Dead: whispers with one living player each night.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    doctor: {
      id: 'doctor', name: 'Doctor', team: 'TOWN', category: 'Town Protective',
      blurb: 'Each night, protects one player from the first Basic attack against them. Fails if Drunk or roleblocked.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    sheriff: {
      id: 'sheriff', name: 'Sheriff', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, checks one player: SUSPICIOUS for Mafia (except the Godfather) and the Serial Killer. Result inverts if Drunk.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    deputy: {
      id: 'deputy', name: 'Deputy', team: 'TOWN', category: 'Town Killing',
      blurb: 'Once per game, publicly shoots a player. Dies of guilt at the following night if the victim was Town. Inherits the Sheriff badge when the Sheriff dies.',
      nightAction: false, dayAction: true, oncePerGame: true, maxUses: 1
    },
    tracker: {
      id: 'tracker', name: 'Tracker', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, learns which player, if any, the chosen player targeted with a night action.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    lookout: {
      id: 'lookout', name: 'Lookout', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, learns which players targeted the chosen player with a night action.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    witness: {
      id: 'witness', name: 'Witness', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Each night, chooses two living players and learns whether they share an alignment: Both Town, Both Mafia, Both Neutral, or Different alignments. Inverts if Drunk.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    oracle: {
      id: 'oracle', name: 'Oracle', team: 'TOWN', category: 'Town Investigative',
      blurb: 'Night 1 only: learns whether a player is TOWN or NOT TOWN. Inverts if Drunk. Becomes a plain civilian after Night 1.',
      nightAction: true, dayAction: false, oncePerGame: true, maxUses: 1, n1Only: true
    },
    washerwoman: {
      id: 'washerwoman', name: 'Washerwoman', team: 'TOWN', category: 'Town Support',
      blurb: 'Starts knowing that one of two specified players is a particular Townsfolk role. No night action.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null, startKnowing: true
    },
    chef: {
      id: 'chef', name: 'Chef', team: 'TOWN', category: 'Town Support',
      blurb: 'Starts knowing how many pairs of adjacent evil players sit in the seat circle. No night action.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null, startKnowing: true
    },
    escort: {
      id: 'escort', name: 'Escort', team: 'TOWN', category: 'Town Support',
      blurb: 'Each night, roleblocks one player: their night action fails that night.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    retributionist: {
      id: 'retributionist', name: 'Retributionist', team: 'TOWN', category: 'Town Support',
      blurb: 'Once per game, revives one dead player at the next morning.',
      nightAction: true, dayAction: false, oncePerGame: true, maxUses: 1
    },
    veteran: {
      id: 'veteran', name: 'Veteran', team: 'TOWN', category: 'Town Killing',
      blurb: 'Up to three times, declares ALERT at night: visitors die (Unstoppable) and the Veteran cannot be killed.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: 3
    },
    vigilante: {
      id: 'vigilante', name: 'Vigilante', team: 'TOWN', category: 'Town Killing',
      blurb: 'Up to three times during the day, secretly shoots a player. Dies of guilt at the following night if the victim was Town.',
      nightAction: false, dayAction: true, oncePerGame: false, maxUses: 3
    },
    mayor: {
      id: 'mayor', name: 'Mayor', team: 'TOWN', category: 'Town Support',
      blurb: 'Once per game, publicly reveals: each of the Mayor\'s votes then counts as 3.',
      nightAction: false, dayAction: true, oncePerGame: true, maxUses: 1
    },
    civilian: {
      id: 'civilian', name: 'Civilian', team: 'TOWN', category: 'Town Support',
      blurb: 'No ability. Votes and speaks normally.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    godfather: {
      id: 'godfather', name: 'Godfather', team: 'MAFIA', category: 'Mafia Killing',
      blurb: 'Leads the Mafia kill. Night immune, reads INNOCENT to the Sheriff. Given three Town bluff roles not in the deck at setup.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    mafioso: {
      id: 'mafioso', name: 'Mafioso', team: 'MAFIA', category: 'Mafia Killing',
      blurb: 'Carries out the Mafia kill. Performs it alone if the Godfather is dead or roleblocked. Becomes the new Godfather when the Godfather dies.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    janitor: {
      id: 'janitor', name: 'Janitor', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, cleans one corpse: its true role can never be learned. Fails if Drunk or roleblocked.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    consigliere: {
      id: 'consigliere', name: 'Consigliere', team: 'MAFIA', category: 'Mafia Support',
      blurb: 'Each night, learns the exact role of one player. If Drunk, learns a random role of a different alignment.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    consort: {
      id: 'consort', name: 'Consort', team: 'MAFIA', category: 'Mafia Support',
      blurb: 'Each night, roleblocks one player: their night action fails that night.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    poisoner: {
      id: 'poisoner', name: 'Poisoner', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, poisons one player: they are Drunk for one cycle.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    blackmailer: {
      id: 'blackmailer', name: 'Blackmailer', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, blackmails one player: they cannot speak during the next day. No consecutive-night blackmail.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    framer: {
      id: 'framer', name: 'Framer', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, frames one player: they read SUSPICIOUS to the Sheriff for that night.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    forger: {
      id: 'forger', name: 'Forger', team: 'MAFIA', category: 'Mafia Deception',
      blurb: 'Each night, forges a false last will for one player. If that player dies before the next morning, the moderator reads the forged will from the player\'s card.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    serialkiller: {
      id: 'serialkiller', name: 'Serial Killer', team: 'NEUTRAL', category: 'Neutral Killing',
      blurb: 'Each night, kills one player (Basic attack). Night immune. Reads SUSPICIOUS to the Sheriff. Wins when last standing or holding majority.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    survivor: {
      id: 'survivor', name: 'Survivor', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'No ability. Wins if alive at game end.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    spy: {
      id: 'spy', name: 'Spy', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'Each night, watches one player: learns the team of every player who visited them. Random teams if Drunk. Wins if alive at game end.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null, n1Only: false
    },
    jester: {
      id: 'jester', name: 'Jester', team: 'NEUTRAL', category: 'Neutral Evil',
      blurb: 'No ability. Wins when lynched, becoming a taunting ghost that may haunt one Guilty voter the following night.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    witch: {
      id: 'witch', name: 'Witch', team: 'NEUTRAL', category: 'Neutral Evil',
      blurb: 'Each night, controls one player (except a jailed player) and redirects their action; learns their role. Sides with Mafia by default, Town if declared.',
      nightAction: true, dayAction: false, oncePerGame: false, maxUses: null
    },
    drunk: {
      id: 'drunk', name: 'The Drunk', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'Permanently Drunk: all abilities disabled. No night or day action. Wins if alive at game end.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    },
    amnesiac: {
      id: 'amnesiac', name: 'Amnesiac', team: 'NEUTRAL', category: 'Neutral Benign',
      blurb: 'Once per game, remembers the role of one dead player and permanently becomes it. Wins with that role\'s team.',
      nightAction: true, dayAction: false, oncePerGame: true, maxUses: 1
    },
    executioner: {
      id: 'executioner', name: 'Executioner', team: 'NEUTRAL', category: 'Neutral Evil',
      blurb: 'Wins when the assigned Town target is lynched. If the target dies by any other means, becomes a Jester.',
      nightAction: false, dayAction: false, oncePerGame: false, maxUses: null
    }
  };
  Object.keys(roleDefs).forEach(function (k) { E.ROLES[k] = roleDefs[k]; });

  Object.freeze(E.ROLES);
  Object.keys(E.ROLES).forEach(function (k) { Object.freeze(E.ROLES[k]); });
})(typeof window !== 'undefined' ? window : globalThis);
