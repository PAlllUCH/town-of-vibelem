'use strict';
const engine = require('../js/engine.js');

function createMemory() {
  return {
    suspicions: {},
    confirmedTown: {},
    confirmedMafia: {},
    deadRoles: {},
    visitedBy: {},
    trackedTargets: {},
    lookoutVisitors: {},
    lastLynchTarget: null,
    lastLynchVotes: null,
    dayCount: 0,
    claims: {}
  };
}

const ARCHETYPES = {
  town: [
    {
      id: 'sheriff_main',
      name: 'Sheriff Focused',
      description: 'Prioritizes sheriff checks, pushes confirmed suspicious',
      voting: { pressureWeight: 0.8, suspicionWeight: 0.9, randomWeight: 0.1 },
      targeting: { checkSuspicious: true, checkUnknown: 0.3, random: 0.1 },
      nightAction: { protectConfirmed: 0.7, protectSelf: 0.2, random: 0.1 }
    },
    {
      id: 'bodyguard',
      name: 'Protective',
      description: 'Protects confirmed town, plays safe',
      voting: { pressureWeight: 0.4, suspicionWeight: 0.6, randomWeight: 0.2 },
      targeting: { checkSuspicious: 0.5, checkUnknown: 0.5, random: 0.1 },
      nightAction: { protectConfirmed: 0.9, protectSelf: 0.3, random: 0.05 }
    },
    {
      id: 'voter',
      name: 'Social Deduction',
      description: 'Focuses on voting patterns, lynches based on behavior',
      voting: { pressureWeight: 0.9, suspicionWeight: 0.5, randomWeight: 0.15 },
      targeting: { checkSuspicious: 0.4, checkUnknown: 0.6, random: 0.1 },
      nightAction: { protectConfirmed: 0.5, protectSelf: 0.4, random: 0.1 }
    },
    {
      id: 'investigator',
      name: 'Investigator',
      description: 'Checks unknown players, builds info network',
      voting: { pressureWeight: 0.5, suspicionWeight: 0.7, randomWeight: 0.15 },
      targeting: { checkSuspicious: 0.3, checkUnknown: 0.7, random: 0.05 },
      nightAction: { protectConfirmed: 0.6, protectSelf: 0.3, random: 0.1 }
    },
    {
      id: 'aggressive',
      name: 'Aggressive',
      description: 'Pushes hard for lynches, takes risks',
      voting: { pressureWeight: 0.95, suspicionWeight: 0.6, randomWeight: 0.2 },
      targeting: { checkSuspicious: 0.6, checkUnknown: 0.3, random: 0.15 },
      nightAction: { protectConfirmed: 0.4, protectSelf: 0.5, random: 0.15 }
    }
  ],
  mafia: [
    {
      id: 'killer',
      name: 'Killer',
      description: 'Targets power roles, aggressive play',
      voting: { defendMafia: 0.7, frameTown: 0.5, randomWeight: 0.1 },
      targeting: { targetClaimers: 0.8, targetUnknown: 0.5, random: 0.15 },
      nightAction: { killClaimer: 0.9, killUnknown: 0.5, random: 0.1 }
    },
    {
      id: 'strategist',
      name: 'Strategist',
      description: 'Plays safe, lets town kill each other',
      voting: { defendMafia: 0.9, frameTown: 0.3, randomWeight: 0.1 },
      targeting: { targetClaimers: 0.5, targetUnknown: 0.7, random: 0.1 },
      nightAction: { killClaimer: 0.5, killUnknown: 0.7, random: 0.1 }
    },
    {
      id: 'chaos',
      name: 'Chaos',
      description: 'Unpredictable, confuses town',
      voting: { defendMafia: 0.6, frameTown: 0.4, randomWeight: 0.3 },
      targeting: { targetClaimers: 0.4, targetUnknown: 0.4, random: 0.4 },
      nightAction: { killClaimer: 0.4, killUnknown: 0.4, random: 0.3 }
    }
  ],
  neutral: [
    {
      id: 'hider',
      name: 'Hider',
      description: 'Stays under radar, kills quietly',
      voting: { survivalWeight: 0.9, chaosWeight: 0.1, randomWeight: 0.1 },
      targeting: { targetSuspicious: 0.3, targetRandom: 0.7 },
      nightAction: { killQuiet: 0.8, killRandom: 0.2 }
    },
    {
      id: 'predator',
      name: 'Predator',
      description: 'Targets power roles, takes risks',
      voting: { survivalWeight: 0.6, chaosWeight: 0.4, randomWeight: 0.15 },
      targeting: { targetSuspicious: 0.7, targetRandom: 0.3 },
      nightAction: { killQuiet: 0.4, killRandom: 0.6 }
    }
  ]
};

function assignArchetypes(state) {
  const archetypes = {};
  state.players.forEach(function (p) {
    const team = engine.ROLES[p.assignedRole].team;
    if (team === 'TOWN') {
      archetypes[p.id] = ARCHETYPES.town[Math.floor(Math.random() * ARCHETYPES.town.length)];
    } else if (team === 'MAFIA') {
      archetypes[p.id] = ARCHETYPES.mafia[Math.floor(Math.random() * ARCHETYPES.mafia.length)];
    } else {
      archetypes[p.id] = ARCHETYPES.neutral[Math.floor(Math.random() * ARCHETYPES.neutral.length)];
    }
  });
  return archetypes;
}

function addNoise(value, noiseLevel) {
  const noise = (Math.random() - 0.5) * 2 * noiseLevel;
  return Math.max(0, Math.min(1, value + noise));
}

function getWeightedChoice(options, weights) {
  const total = weights.reduce(function (sum, w) { return sum + w; }, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

function isSuspicious(memory, playerId) {
  return memory.suspicions[playerId] === 'SUSPICIOUS' ||
    memory.confirmedMafia[playerId] === true;
}

function isConfirmedTown(memory, playerId) {
  return memory.confirmedTown[playerId] === true;
}

function getAlivePlayers(state) {
  return state.players.filter(function (p) { return p.isAlive; });
}

function getUnclaimedPlayers(state, memory) {
  return getAlivePlayers(state).filter(function (p) {
    return !memory.claims[p.id];
  });
}

function getClaimedPlayers(memory) {
  return Object.keys(memory.claims).map(Number);
}

function getSuspiciousPlayers(memory, excludeIds) {
  const ex = excludeIds || [];
  return Object.keys(memory.suspicions).filter(function (id) {
    const pid = Number(id);
    return memory.suspicions[id] === 'SUSPICIOUS' && ex.indexOf(pid) === -1;
  }).map(Number);
}

module.exports = {
  ARCHETYPES,
  createMemory,
  assignArchetypes,
  addNoise,
  getWeightedChoice,
  isSuspicious,
  isConfirmedTown,
  getAlivePlayers,
  getUnclaimedPlayers,
  getClaimedPlayers,
  getSuspiciousPlayers
};
