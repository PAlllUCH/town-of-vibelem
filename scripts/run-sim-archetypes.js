'use strict';
const engine = require('../js/engine.js');
const fs = require('fs');
const {
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
} = require('./ai-archetypes.js');

const PRESET = process.argv[2] || 'p1';
const PLAYER_COUNT = parseInt(process.argv[3]) || 11;
const NUM_GAMES = parseInt(process.argv[4]) || 50;
const MAX_DAYS = 25;
const OUTPUT_FILE = process.argv[5] || 'sim-result.json';

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr.length ? arr[randInt(arr.length)] : null; }
function living(state) { return state.players.filter(function (p) { return p.isAlive; }); }
function byId(state, id) { return state.players[id - 1] || null; }
function pname(state, id) { const p = byId(state, id); return p ? p.name : 'P' + id; }
function roleName(roleId) { const r = engine.ROLES[roleId]; return r ? r.name : String(roleId); }
function teamOfRole(roleId) { const r = engine.ROLES[roleId]; return r ? r.team : 'NEUTRAL'; }

const KILL_PRIORITY = { jailor: 1, sheriff: 2, doctor: 3, mayor: 4, vigilante: 5, retributionist: 6, medium: 7, undertaker: 8, tracker: 9, lookout: 10, escort: 11 };
const KNOWN_POWER = {};
Object.keys(KILL_PRIORITY).forEach(function (k) { KNOWN_POWER[k] = true; });

function checkAlignment(state, player) {
  if (!player) return 'NEUTRAL';
  if (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole) {
    const r = engine.ROLES[state.amnesiac.rememberedRole];
    return r ? r.team : 'NEUTRAL';
  }
  if (player.assignedRole === 'witch') return state.witchSide === 'TOWN' ? 'TOWN' : 'MAFIA';
  const role = engine.ROLES[player.assignedRole];
  return role ? role.team : 'NEUTRAL';
}

function checkSuspicious(state, player) {
  const gfLike = player.assignedRole === 'godfather' ||
    player.inheritedRole === 'godfather' ||
    (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'godfather');
  if (gfLike) return false;
  const skLike = player.assignedRole === 'serialkiller' ||
    (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'serialkiller');
  if (skLike) return true;
  return checkAlignment(state, player) === 'MAFIA';
}

function townBluffPool(state) {
  const inDeck = {};
  state.players.forEach(function (p) { inDeck[p.assignedRole] = true; });
  const pool = Object.keys(engine.ROLES).filter(function (id) {
    return engine.ROLES[id].team === 'TOWN' && !inDeck[id];
  });
  return pool.length ? pool : Object.keys(engine.ROLES).filter(function (id) { return engine.ROLES[id].team === 'TOWN'; });
}

function makeMemories(state) {
  const memories = {};
  const mafiaIds = {};
  state.players.forEach(function (p) {
    if (engine.ROLES[p.assignedRole].team === 'MAFIA') mafiaIds[p.id] = true;
  });
  state.players.forEach(function (p) {
    const role = engine.ROLES[p.assignedRole];
    const mem = createMemory();
    mem.roleId = p.assignedRole;
    mem.team = role.team;
    mem.isMafia = role.team === 'MAFIA';
    mem.side = p.assignedRole === 'witch' ? (state.witchSide === 'TOWN' ? 'TOWN' : 'MAFIA') : role.team;
    mem.inheritedSheriff = false;
    mem.ownSheriffResults = {};
    mem.sheriffPublic = {};
    mem.consigliereResults = {};
    mem.learnedRoles = {};
    mem.attacked = {};
    mem.avoid = {};
    mem.cleanedCorpses = {};
    mem.inspectedCorpses = {};
    mem.voteHistory = {};
    mem.mafiaMembers = {};
    mem.killTarget = null;
    mem.lastKillTarget = null;
    mem.lastJailed = null;
    mem.lastBlackmail = null;
    mem.lastLynchAccusedId = null;
    mem.lastLynchAccusedKnownSuspicious = false;
    mem.lastLynchAccusedKnownTown = false;
    mem.announced = {};
    if (mem.isMafia) {
      Object.keys(mafiaIds).forEach(function (k) { mem.mafiaMembers[Number(k)] = true; });
    }
    if (role.team !== 'TOWN') mem.bluffPool = townBluffPool(state);
    memories[p.id] = mem;
  });
  return memories;
}

function isTrusted(mem, playerId) {
  return isConfirmedTown(mem, playerId) || mem.sheriffPublic[playerId] === 'INNOCENT';
}

function claimConflict(mem, playerId) {
  if (mem.side !== 'TOWN') return false;
  const myRole = mem.roleId;
  if (!myRole || myRole === 'civilian') return false;
  return mem.claims[playerId] === myRole;
}

function claimCountIn(mem, claim) {
  let n = 0;
  getClaimedPlayers(mem).forEach(function (id) {
    if (mem.claims[id] === claim) n += 1;
  });
  return n;
}

function memSuspicionScore(state, memories, holderId, targetId) {
  const mem = memories[holderId];
  let score = 0;
  if (mem.ownSheriffResults[targetId] === 'SUSPICIOUS') score += 4;
  if (isSuspicious(mem, targetId)) score += 4;
  if (mem.sheriffPublic[targetId] === 'SUSPICIOUS') score += 3;
  if (claimConflict(mem, targetId)) score += 3;
  const claim = mem.claims[targetId];
  if (!claim) score += 1;
  else if (claimCountIn(mem, claim) > 1) score += 1;
  if (mem.voteHistory[targetId] === 'INNOCENT' && mem.lastLynchAccusedKnownSuspicious) score += 2;
  if (mem.voteHistory[targetId] === 'GUILTY' && mem.lastLynchAccusedKnownTown) score += 2;
  return score;
}

function mostSuspiciousMem(state, memories, holderId, excludeIds) {
  const mem = memories[holderId];
  const ex = excludeIds || [];
  const cands = living(state).filter(function (p) {
    return p.id !== holderId && ex.indexOf(p.id) === -1 && !isTrusted(mem, p.id);
  });
  if (!cands.length) return null;
  let best = [];
  let bestS = -1;
  cands.forEach(function (p) {
    const s = memSuspicionScore(state, memories, holderId, p.id);
    if (s > bestS) { bestS = s; best = [p]; } else if (s === bestS) { best.push(p); }
  });
  return pick(best);
}

function publicSuspicionScore(state, memories, targetId) {
  const alive = living(state);
  if (!alive.length) return 0;
  const mem = memories[alive[0].id];
  let score = 0;
  if (mem.sheriffPublic[targetId] === 'SUSPICIOUS') score += 3;
  const claim = mem.claims[targetId];
  if (!claim) score += 1;
  else if (claimCountIn(mem, claim) > 1) score += 1;
  return score;
}

function publicTrusted(state, memories, targetId) {
  const alive = living(state);
  if (!alive.length) return false;
  return isTrusted(memories[alive[0].id], targetId);
}

function rec(state, action, recorded, notes, note) {
  if (!engine.recordNightAction(state, action)) throw new Error('recordNightAction rejected ' + JSON.stringify(action));
  recorded.push(action);
  if (note) notes.push(typeof note === 'string' ? { pos: action.position, text: note } : note);
}

function mafiaKillTarget(state, memories, archetypes) {
  const leader = engine.mafiaKillActor(state);
  if (!leader) return null;
  const mem = memories[leader.id];
  const arch = archetypes[leader.id];
  const cands = living(state).filter(function (p) {
    return !mem.mafiaMembers[p.id] && !mem.avoid[p.id];
  });
  if (!cands.length) return null;
  let best = [];
  let bestS = 99;
  cands.forEach(function (p) {
    let s = 5;
    const known = mem.consigliereResults[p.id];
    if (known && KNOWN_POWER[known]) s -= 2;
    else if (known && teamOfRole(known) === 'TOWN') s -= 1;
    const claim = mem.claims[p.id];
    if (claim && KNOWN_POWER[claim] && Math.random() < arch.targeting.targetClaimers) s -= 1.5;
    if (!claim && Math.random() < arch.targeting.targetUnknown) s -= 1;
    s = addNoise(s, arch.targeting.random);
    if (s < bestS) { bestS = s; best = [p]; } else if (s === bestS) { best.push(p); }
  });
  return pick(best);
}

function pickBestCorpse(state, gy) {
  let best = null, bs = 99;
  gy.forEach(function (e) {
    if (e.wasCleaned) return;
    const s = 5;
    if (s < bs) { bs = s; best = e; }
  });
  return best;
}

function witchAction(state, memories, actor, recorded, notes, archetypes) {
  const mem = memories[actor.id];
  const arch = archetypes[actor.id];
  const randomness = arch.targeting.random || 0.25;
  let controlTarget = null;
  let redirect = null;
  const knownKillers = Object.keys(mem.learnedRoles).map(Number).filter(function (id) {
    const p = byId(state, id);
    return p && p.isAlive && (mem.learnedRoles[id] === 'godfather' || mem.learnedRoles[id] === 'serialkiller');
  });
  if (mem.side === 'MAFIA' && knownKillers.length && Math.random() > randomness) {
    controlTarget = byId(state, knownKillers[0]);
    const claimers = living(state).filter(function (p) {
      return p.id !== controlTarget.id && p.id !== actor.id && mem.claims[p.id] && KNOWN_POWER[mem.claims[p.id]];
    });
    redirect = pick(claimers);
  }
  if (!controlTarget) {
    const cands = living(state).filter(function (p) {
      return p.id !== actor.id && !mem.learnedRoles[p.id];
    });
    controlTarget = pick(cands) || pick(living(state).filter(function (p) { return p.id !== actor.id; }));
  }
  if (controlTarget) {
    rec(state, {
      position: 2, roleId: 'witch', playerId: actor.id, targetId: controlTarget.id,
      extra: redirect ? { controlRedirect: redirect.id } : {}
    }, recorded, notes,
      actor.name + ' (Witch) controlled ' + controlTarget.name + (redirect ? ' (kill redirected to ' + redirect.name + ')' : ''));
  }
}

function jailorAction(state, memories, actor, recorded, notes, archetypes) {
  const mem = memories[actor.id];
  const ex = [actor.id];
  if (mem.lastJailed != null) ex.push(mem.lastJailed);
  const target = mostSuspiciousMem(state, memories, actor.id, ex);
  if (!target) return;
  const arch = archetypes[actor.id];
  const score = memSuspicionScore(state, memories, actor.id, target.id);
  const canExecute = state.night.number > 1 && actor.executionsUsed < 3;
  let decision = 'SPARE';
  if (canExecute) {
    if (score >= 3 || Math.random() < addNoise(0.4, arch.nightAction.random)) {
      decision = 'EXECUTE';
    }
  }
  rec(state, { position: 3, roleId: 'jailor', playerId: actor.id, targetId: target.id, extra: { jailorDecision: decision } }, recorded, notes,
    actor.name + ' (Jailor) jailed ' + target.name + ', ' + decision.toLowerCase());
}

function doctorAction(state, memories, actor, recorded, notes, archetypes) {
  const mem = memories[actor.id];
  const arch = archetypes[actor.id];
  let target = null;
  if (Math.random() < arch.nightAction.protectSelf) {
    target = actor;
  } else {
    const trusted = living(state).filter(function (p) {
      return p.id !== actor.id && isTrusted(mem, p.id);
    });
    if (trusted.length && Math.random() < arch.nightAction.protectConfirmed) target = pick(trusted);
  }
  if (!target) {
    const cands = living(state).filter(function (p) {
      return p.id !== actor.id && !isTrusted(mem, p.id);
    });
    if (cands.length && Math.random() < 0.4) target = pick(cands);
  }
  if (!target) target = actor;
  rec(state, { position: 5, roleId: 'doctor', playerId: actor.id, targetId: target.id }, recorded, notes,
    actor.name + ' (Doctor) protected ' + target.name + (target.id === actor.id ? ' (self)' : ''));
}

function janitorAction(state, memories, actor, recorded, notes) {
  if (!state.graveyard.length) return;
  const mem = memories[actor.id];
  let target = null;
  if (mem.lastKillTarget != null && state.graveyard[state.graveyard.length - 1].playerId === mem.lastKillTarget) {
    target = state.graveyard[state.graveyard.length - 1];
  }
  if (!target) target = pickBestCorpse(state, state.graveyard);
  if (target) {
    rec(state, { position: 7, roleId: 'janitor', playerId: actor.id, targetId: target.playerId }, recorded, notes,
      actor.name + ' (Janitor) cleaned ' + target.name + '\'s corpse');
  }
}

function forgerAction(state, memories, actor, recorded, notes) {
  const mem = memories[actor.id];
  let target = mem.killTarget != null ? byId(state, mem.killTarget) : null;
  if (!target || !target.isAlive) {
    target = pick(living(state).filter(function (p) { return p.id !== actor.id && !mem.mafiaMembers[p.id]; }));
  }
  if (target) {
    rec(state, { position: 7, roleId: 'forger', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Forger) forged ' + target.name + '\'s will');
  }
}

function blackmailerAction(state, memories, actor, recorded, notes) {
  const mem = memories[actor.id];
  const cands = living(state).filter(function (p) {
    return p.id !== actor.id && !mem.mafiaMembers[p.id] &&
      p.id !== mem.lastBlackmail && mem.claims[p.id] && KNOWN_POWER[mem.claims[p.id]];
  });
  let target = pick(cands);
  if (!target) {
    target = living(state).find(function (p) {
      return p.id !== actor.id && !mem.mafiaMembers[p.id] && p.id !== mem.lastBlackmail;
    }) || null;
  }
  if (target) {
    rec(state, { position: 8, roleId: 'blackmailer', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Blackmailer) blackmailed ' + target.name);
  }
}

function skAction(state, memories, actor, recorded, notes, archetypes) {
  const mem = memories[actor.id];
  const arch = archetypes[actor.id];
  let target = null;
  const mode = getWeightedChoice(['suspicious', 'random'], [arch.targeting.targetSuspicious, arch.targeting.targetRandom]);
  if (mode === 'suspicious') {
    const sus = getSuspiciousPlayers(mem).map(function (id) { return byId(state, id); })
      .filter(function (p) { return p && p.isAlive && p.id !== actor.id; });
    if (sus.length) target = pick(sus);
  }
  if (!target) {
    const claimers = living(state).filter(function (p) {
      return p.id !== actor.id && !mem.attacked[p.id] && mem.claims[p.id] && KNOWN_POWER[mem.claims[p.id]];
    });
    if (claimers.length) target = pick(claimers);
  }
  if (!target) {
    const cands = getAlivePlayers(state).filter(function (p) { return p.id !== actor.id; });
    if (cands.length) target = pick(cands);
  }
  if (target) {
    rec(state, { position: 9, roleId: 'serialkiller', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Serial Killer) attacked ' + target.name);
  }
}

function framerAction(state, memories, actor, recorded, notes) {
  const mem = memories[actor.id];
  const target = pick(living(state).filter(function (p) {
    return p.id !== actor.id && !mem.mafiaMembers[p.id];
  }));
  if (target) {
    rec(state, { position: 10, roleId: 'framer', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Framer) framed ' + target.name);
  }
}

function invActor(state, memories, role, actor, recorded, notes, archetypes) {
  const arch = archetypes[actor.id];
  const mem = memories[actor.id];
  const emit = function (targetId, kind, text) {
    rec(state, { position: 11, roleId: role, playerId: actor.id, targetId: targetId }, recorded, notes,
      { pos: 11, kind: kind, playerId: actor.id, targetId: targetId, text: text });
  };

  if (role === 'sheriff' || (role === 'deputy' && mem.inheritedSheriff)) {
    const checked = Object.keys(mem.ownSheriffResults).map(Number);
    const ex = [actor.id].concat(checked);
    let target = null;
    if (Math.random() < arch.targeting.checkSuspicious) {
      target = mostSuspiciousMem(state, memories, actor.id, ex);
    }
    if (!target) {
      const unclaimed = getUnclaimedPlayers(state, mem).filter(function (p) {
        return p.id !== actor.id && checked.indexOf(p.id) === -1;
      });
      if (unclaimed.length && Math.random() < arch.targeting.checkUnknown) target = pick(unclaimed);
    }
    if (!target) {
      const cands = living(state).filter(function (p) {
        return p.id !== actor.id && checked.indexOf(p.id) === -1 && !isTrusted(mem, p.id);
      });
      if (cands.length) target = pick(cands);
    }
    if (target) emit(target.id, 'sheriff', actor.name + ' (' + (role === 'deputy' ? 'Deputy' : 'Sheriff') + ') checked ' + target.name + ':');
    return;
  }

  if (role === 'tracker') {
    const target = mostSuspiciousMem(state, memories, actor.id, [actor.id]);
    if (target) emit(target.id, 'tracker', actor.name + ' (Tracker) tracked ' + target.name);
    return;
  }

  if (role === 'lookout') {
    let target = null;
    const sheriffClaim = living(state).find(function (p) {
      return p.id !== actor.id && mem.claims[p.id] === 'sheriff';
    });
    if (sheriffClaim) target = sheriffClaim;
    if (!target) {
      target = living(state).find(function (p) {
        return p.id !== actor.id && isTrusted(mem, p.id);
      }) || null;
    }
    if (!target) target = pick(living(state).filter(function (p) { return p.id !== actor.id; }));
    if (target) emit(target.id, 'lookout', actor.name + ' (Lookout) watched ' + target.name);
    return;
  }

  if (role === 'consigliere') {
    const known = mem.consigliereResults;
    let target = null;
    const claimers = living(state).filter(function (p) {
      return p.id !== actor.id && !mem.mafiaMembers[p.id] && !known[p.id] && mem.claims[p.id] && KNOWN_POWER[mem.claims[p.id]];
    });
    if (claimers.length) target = pick(claimers);
    if (!target) {
      target = pick(living(state).filter(function (p) {
        return p.id !== actor.id && !mem.mafiaMembers[p.id] && !known[p.id];
      }));
    }
    if (target) emit(target.id, 'consigliere', actor.name + ' (Consigliere) inspected ' + target.name + ':');
    return;
  }

  if (role === 'undertaker') {
    let target = null;
    for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
      const e = state.graveyard[i];
      if (e.wasCleaned || mem.cleanedCorpses[e.playerId] || mem.inspectedCorpses[e.playerId]) continue;
      target = e;
      break;
    }
    if (target) emit(target.playerId, 'undertaker', actor.name + ' (Undertaker) inspected ' + target.name + '\'s corpse:');
  }
}

function retributionistAction(state, memories, actor, recorded, notes) {
  if (actor.usedOncePerGame) return;
  const mem = memories[actor.id];
  let target = null;
  ['jailor', 'sheriff', 'mayor', 'doctor', 'vigilante'].forEach(function (r) {
    if (target) return;
    const p = state.players.find(function (x) {
      return !x.isAlive && mem.deadRoles[x.id] === r;
    });
    if (p) target = p;
  });
  if (!target) {
    for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
      const e = state.graveyard[i];
      if (mem.deadRoles[e.playerId] && teamOfRole(mem.deadRoles[e.playerId]) === 'TOWN') {
        target = byId(state, e.playerId);
        break;
      }
    }
  }
  if (target) rec(state, { position: 12, roleId: 'retributionist', playerId: actor.id, targetId: target.id }, recorded, notes,
    actor.name + ' (Retributionist) will revive ' + target.name + ' (' + roleName(mem.deadRoles[target.id]) + ')');
}

function amnesiacAction(state, memories, actor, recorded, notes) {
  if (state.amnesiac.used) return;
  const mem = memories[actor.id];
  let target = null;
  ['jailor', 'sheriff', 'doctor'].forEach(function (r) {
    if (target) return;
    const p = state.players.find(function (x) {
      return !x.isAlive && mem.deadRoles[x.id] === r;
    });
    if (p) target = p;
  });
  if (!target) {
    for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
      const e = state.graveyard[i];
      if (mem.deadRoles[e.playerId]) {
        target = byId(state, e.playerId);
        break;
      }
    }
  }
  if (target) rec(state, { position: 12, roleId: 'amnesiac', playerId: actor.id, targetId: target.id }, recorded, notes,
    actor.name + ' (Amnesiac) remembered ' + roleName(mem.deadRoles[target.id]) + ' from ' + target.name);
}

function mediumAction(state, memories, actor, recorded, notes) {
  if (actor.isAlive) {
    rec(state, { position: 13, roleId: 'medium', playerId: actor.id }, recorded, notes, actor.name + ' (Medium) read the Ghost Ledger');
    return;
  }
  const mem = memories[actor.id];
  let target = null;
  const claimers = living(state).filter(function (p) {
    return p.id !== actor.id && (mem.claims[p.id] === 'sheriff' || mem.claims[p.id] === 'jailor');
  });
  if (claimers.length) target = pick(claimers);
  if (!target) target = pick(getAlivePlayers(state).filter(function (p) { return p.id !== actor.id; }));
  if (target) {
    rec(state, { position: 13, roleId: 'medium', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Medium) whispered to ' + target.name);
  }
}

function nightActor(state, memories, pos, role, actor, recorded, notes, archetypes) {
  if (pos === 0 && role === 'veteran') {
    const arch = archetypes[actor.id];
    if (actor.alertsUsed < 3) {
      const alertChance = arch.nightAction.random > 0.3 ? 0.4 : 0.2;
      const alert = Math.random() < alertChance;
      rec(state, { position: 0, roleId: 'veteran', playerId: actor.id, extra: { alert: alert } }, recorded, notes,
        alert ? actor.name + ' (Veteran) went on alert' : null);
    }
    return;
  }
  if (pos === 0 && role === 'jester') {
    const target = pick((state.trial.votes || []).filter(function (v) { return v.verdict === 'GUILTY' && byId(state, v.voterId) && byId(state, v.voterId).isAlive; }).map(function (v) { return v.voterId; }));
    if (target) rec(state, { position: 0, roleId: 'jester', playerId: actor.id, targetId: target }, recorded, notes, null);
    return;
  }
  if (pos === 1 && role === 'poisoner') {
    const mem = memories[actor.id];
    const cands = living(state).filter(function (p) {
      return p.id !== actor.id && !mem.mafiaMembers[p.id] && mem.claims[p.id] && KNOWN_POWER[mem.claims[p.id]];
    });
    let target = pick(cands);
    if (!target) {
      target = pick(living(state).filter(function (p) { return p.id !== actor.id && !mem.mafiaMembers[p.id]; }));
    }
    if (target) rec(state, { position: 1, roleId: 'poisoner', playerId: actor.id, targetId: target.id }, recorded, notes, actor.name + ' (Poisoner) poisoned ' + target.name);
    return;
  }
  if (pos === 2 && role === 'witch') { witchAction(state, memories, actor, recorded, notes, archetypes); return; }
  if (pos === 3 && role === 'jailor') { jailorAction(state, memories, actor, recorded, notes, archetypes); return; }
  if (pos === 4) {
    if (role === 'escort') {
      const target = mostSuspiciousMem(state, memories, actor.id, [actor.id]);
      if (target) rec(state, { position: 4, roleId: role, playerId: actor.id, targetId: target.id }, recorded, notes, actor.name + ' (Escort) roleblocked ' + target.name);
    } else {
      const mem = memories[actor.id];
      const claimers = living(state).filter(function (p) {
        return p.id !== actor.id && !mem.mafiaMembers[p.id] && mem.claims[p.id] && KNOWN_POWER[mem.claims[p.id]];
      });
      const target = pick(claimers) || pick(living(state).filter(function (p) { return p.id !== actor.id && !mem.mafiaMembers[p.id]; }));
      if (target) rec(state, { position: 4, roleId: role, playerId: actor.id, targetId: target.id }, recorded, notes, actor.name + ' (Consort) roleblocked ' + target.name);
    }
    return;
  }
  if (pos === 5 && role === 'doctor') { doctorAction(state, memories, actor, recorded, notes, archetypes); return; }
  if (pos === 7 && role === 'janitor') { janitorAction(state, memories, actor, recorded, notes); return; }
  if (pos === 7 && role === 'forger') { forgerAction(state, memories, actor, recorded, notes); return; }
  if (pos === 8 && role === 'blackmailer') { blackmailerAction(state, memories, actor, recorded, notes); return; }
  if (pos === 9 && role === 'serialkiller') { skAction(state, memories, actor, recorded, notes, archetypes); return; }
  if (pos === 10 && role === 'framer') { framerAction(state, memories, actor, recorded, notes); return; }
  if (pos === 11) { invActor(state, memories, role, actor, recorded, notes, archetypes); return; }
  if (pos === 12 && role === 'retributionist') { retributionistAction(state, memories, actor, recorded, notes); return; }
  if (pos === 12 && role === 'amnesiac') { amnesiacAction(state, memories, actor, recorded, notes); return; }
  if (pos === 13 && role === 'medium') { mediumAction(state, memories, actor, recorded, notes); }
}

function runNight(state, memories, recorded, notes, archetypes) {
  state.players.forEach(function (p) {
    const mem = memories[p.id];
    if (mem.isMafia) {
      mem.lastKillTarget = mem.killTarget;
      mem.killTarget = null;
    }
  });
  const steps = engine.getNightSteps(state);
  for (const step of steps) {
    const pos = step.position;
    if (pos >= 14) continue;
    if (pos === 6) {
      const leader = engine.mafiaKillActor(state);
      const target = leader ? mafiaKillTarget(state, memories, archetypes) : null;
      if (leader && target) {
        rec(state, { position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: target.id }, recorded, notes,
          'Mafia killed ' + target.name + ' (' + roleName(memories[target.id].roleId) + ')');
        state.players.forEach(function (p) {
          const mem = memories[p.id];
          if (mem.isMafia) mem.killTarget = target.id;
        });
      }
      continue;
    }
    for (const role of step.roles) {
      const actors = state.players.filter(function (p) {
        if (p.assignedRole !== role) return false;
        if (pos === 0 && role === 'jester') return !p.isAlive && state.jester.haunted && state.jester.hauntTarget === null;
        if (pos === 13 && role === 'medium') return true;
        return p.isAlive;
      });
      for (const actor of actors) nightActor(state, memories, pos, role, actor, recorded, notes, archetypes);
    }
  }
}

function morningUpdate(state, memories, recorded, notes) {
  const strip = function (note) { if (note) note.text = note.text.replace(/:$/, ''); };

  const effTargets = [];
  const voided = [];
  recorded.forEach(function (a) {
    if (a.position === 0 && a.roleId === 'veteran' && a.extra && a.extra.alert) {
      recorded.forEach(function (x) {
        if (x.targetId === a.playerId && x.position !== 0) voided.push(x.playerId);
      });
    }
  });

  const witchAction = recorded.find(function (a) { return a.position === 2 && a.roleId === 'witch'; });
  const witchControl = witchAction && witchAction.extra && witchAction.extra.controlRedirect ? {
    controlledId: witchAction.targetId,
    redirect: witchAction.extra.controlRedirect
  } : null;

  recorded.forEach(function (a) {
    if (a.position === 13) return;
    const actor = byId(state, a.playerId);
    if (!actor || !actor.isAlive || actor.isRoleblocked || actor.jailed) return;
    if (voided.indexOf(a.playerId) !== -1) return;
    const target = a.targetId != null ? byId(state, a.targetId) : null;
    if (!target || !target.isAlive) return;
    let effTid = a.targetId;
    if (witchControl && a.playerId === witchControl.controlledId) {
      effTid = witchControl.redirect;
    } else if (a.extra && a.extra.controlRedirect) {
      effTid = a.extra.controlRedirect;
    }
    effTargets.push({ playerId: a.playerId, targetId: effTid });
  });
  const getEff = function (pid) {
    for (let i = 0; i < effTargets.length; i += 1) {
      if (effTargets[i].playerId === pid) return effTargets[i].targetId;
    }
    return null;
  };

  if (witchAction) {
    const witch = byId(state, witchAction.playerId);
    const controlled = witchAction.targetId != null ? byId(state, witchAction.targetId) : null;
    const controlValid = !!witch && witch.isAlive && !witch.isRoleblocked && !witch.jailed &&
      voided.indexOf(witch.id) === -1 && !!controlled && controlled.isAlive && !controlled.jailed;
    if (controlValid) memories[witch.id].learnedRoles[controlled.id] = controlled.assignedRole;
  }

  recorded.forEach(function (a) {
    if (a.position !== 11) return;
    const actor = byId(state, a.playerId);
    const t = a.targetId != null ? byId(state, a.targetId) : null;
    const note = notes.find(function (n) { return n.kind && n.playerId === a.playerId && n.targetId === a.targetId; });
    const acted = !!actor && actor.isAlive && !!t && t.isAlive && !actor.isRoleblocked && !actor.jailed;
    const amem = memories[a.playerId];
    if (!amem) return;
    const isSheriffLike = amem.roleId === 'sheriff' || amem.inheritedSheriff;
    if (isSheriffLike && (a.roleId === 'sheriff' || a.roleId === 'deputy')) {
      if (acted) {
        let r = t.framed ? 'SUSPICIOUS' : (checkSuspicious(state, t) ? 'SUSPICIOUS' : 'INNOCENT');
        if (actor.isDrunk) r = r === 'SUSPICIOUS' ? 'INNOCENT' : 'SUSPICIOUS';
        amem.ownSheriffResults[a.targetId] = r;
        if (note) note.text += ' ' + r;
      } else strip(note);
    } else if (a.roleId === 'consigliere') {
      if (acted) {
        let learned = t.assignedRole;
        if (actor.isDrunk) {
          const aligned = checkAlignment(state, t);
          const pool = Object.keys(engine.ROLES).filter(function (id) { return engine.ROLES[id].team !== aligned; });
          learned = pool[randInt(pool.length)];
        }
        state.players.forEach(function (p) {
          const pm = memories[p.id];
          if (pm && pm.isMafia) pm.consigliereResults[a.targetId] = learned;
        });
        if (note) note.text += ' ' + roleName(learned);
      } else strip(note);
    } else if (a.roleId === 'undertaker') {
      const entry = state.graveyard.find(function (e) { return e.playerId === a.targetId; });
      if (entry && entry.inspectedByUndertaker && !amem.inspectedCorpses[a.targetId]) {
        amem.inspectedCorpses[a.targetId] = true;
        amem.deadRoles[a.targetId] = entry.trueRole;
        if (note) note.text += ' ' + roleName(entry.trueRole);
      } else strip(note);
    } else if (a.roleId === 'tracker') {
      if (acted) {
        const eff = getEff(a.targetId);
        amem.trackedTargets[a.targetId] = eff;
        const m = state.morning || { deaths: [] };
        if (eff != null && m.deaths.some(function (d) { return d.playerId === eff; })) {
          amem.suspicions[a.targetId] = 'SUSPICIOUS';
        }
        if (note) note.text += eff != null ? ': visited ' + pname(state, eff) : ': visited no one';
      } else strip(note);
    } else if (a.roleId === 'lookout') {
      if (acted) {
        const visitors = effTargets.filter(function (x) {
          return x.targetId === a.targetId && x.playerId !== a.playerId;
        }).map(function (x) { return x.playerId; });
        amem.lookoutVisitors[a.targetId] = visitors;
        if (note) note.text += visitors.length ? ': ' + visitors.map(function (x) { return pname(state, x); }).join(', ') + ' visited' : ': no visitors';
      } else strip(note);
    }
  });

  recorded.forEach(function (a) {
    if (a.position !== 9 || a.roleId !== 'serialkiller') return;
    const sk = byId(state, a.playerId);
    if (!sk || !sk.isAlive) return;
    const sm = memories[sk.id];
    const target = a.targetId != null ? byId(state, a.targetId) : null;
    if (!target || !sm) return;
    sm.attacked[target.id] = true;
    if (target.isAlive) sm.suspicions[target.id] = 'SUSPICIOUS';
  });

  const m = state.morning || { deaths: [], revivals: [] };
  (m.deaths || []).forEach(function (d) {
    state.players.forEach(function (p) {
      const pm = memories[p.id];
      if (d.wasCleaned) pm.cleanedCorpses[d.playerId] = true;
      else pm.deadRoles[d.playerId] = d.trueRole;
    });
  });
  (m.revivals || []).forEach(function (id) {
    state.players.forEach(function (p) { memories[p.id].confirmedTown[id] = true; });
  });

  state.players.forEach(function (p) {
    const pm = memories[p.id];
    if (!pm.isMafia) return;
    if (pm.killTarget != null) {
      const victim = byId(state, pm.killTarget);
      if (victim && victim.isAlive) pm.avoid[pm.killTarget] = true;
    }
  });

  if (m.inheritanceNote) {
    const dep = state.players.find(function (p) { return p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff'; });
    if (dep && memories[dep.id]) memories[dep.id].inheritedSheriff = true;
  }
  if (state.amnesiac && state.amnesiac.used && state.amnesiac.rememberedRole) {
    const amn = state.players.find(function (p) { return memories[p.id] && memories[p.id].roleId === 'amnesiac'; });
    if (amn) {
      memories[amn.id].roleId = state.amnesiac.rememberedRole;
      memories[amn.id].team = teamOfRole(state.amnesiac.rememberedRole);
      memories[amn.id].side = memories[amn.id].team;
      memories[amn.id].bluffPool = null;
    }
  }
}

function dayClaims(state, memories) {
  state.players.forEach(function (p) {
    if (!p.isAlive) return;
    const mem = memories[p.id];
    let claim;
    if (mem.team === 'TOWN') claim = mem.roleId;
    else if (mem.bluffPool && mem.bluffPool.length) claim = mem.bluffPool[randInt(mem.bluffPool.length)];
    else claim = 'civilian';
    mem.claims[p.id] = claim;
    state.players.forEach(function (q) { memories[q.id].claims[p.id] = claim; });
  });
}

function sheriffReport(state, memories) {
  state.players.forEach(function (p) {
    const mem = memories[p.id];
    const isSheriff = mem.roleId === 'sheriff' || mem.inheritedSheriff;
    if (!p.isAlive || !isSheriff) return;
    Object.keys(mem.ownSheriffResults).forEach(function (k) {
      const tid = Number(k);
      if (mem.announced[tid]) return;
      mem.announced[tid] = true;
      const res = mem.ownSheriffResults[k];
      state.players.forEach(function (q) { memories[q.id].sheriffPublic[tid] = res; });
    });
  });
}

function learnDayDeath(state, memories, playerId) {
  const role = memories[playerId] ? memories[playerId].roleId : null;
  if (!role) return;
  state.players.forEach(function (p) {
    memories[p.id].deadRoles[playerId] = role;
  });
}

function vigilanteTarget(state, memories, shooter) {
  const mem = memories[shooter.id];
  const cands = living(state).filter(function (p) {
    return p.id !== shooter.id &&
      (mem.ownSheriffResults[p.id] === 'SUSPICIOUS' || mem.sheriffPublic[p.id] === 'SUSPICIOUS');
  });
  return pick(cands);
}

function townVote(mem, accused, arch) {
  const v = arch.voting;
  if (mem.ownSheriffResults[accused.id] === 'SUSPICIOUS' &&
      Math.random() < addNoise(v.suspicionWeight, 0.1)) return 'GUILTY';
  if (mem.sheriffPublic[accused.id] === 'SUSPICIOUS' &&
      Math.random() < addNoise(v.suspicionWeight, 0.1)) return 'GUILTY';
  if (isTrusted(mem, accused.id)) return 'INNOCENT';
  if (claimConflict(mem, accused.id)) return 'GUILTY';
  if (mem.voteHistory[accused.id] === 'INNOCENT' && mem.lastLynchAccusedKnownSuspicious &&
      Math.random() < addNoise(v.suspicionWeight, 0.1)) return 'GUILTY';
  if (mem.voteHistory[accused.id] === 'GUILTY' && mem.lastLynchAccusedKnownTown &&
      Math.random() < addNoise(v.suspicionWeight * 0.7, 0.1)) return 'GUILTY';
  if (Math.random() < addNoise(v.pressureWeight, v.randomWeight)) return 'GUILTY';
  return 'ABSTAIN';
}

function mafiaVote(mem, accused, arch) {
  if (mem.mafiaMembers[accused.id]) return 'INNOCENT';
  const known = mem.consigliereResults[accused.id];
  if (known && KNOWN_POWER[known]) return 'GUILTY';
  if (arch.voting.frameTown && Math.random() < arch.voting.frameTown) return 'GUILTY';
  if (Math.random() < (arch.voting.randomWeight || 0.1)) return 'GUILTY';
  return 'ABSTAIN';
}

function skVote(state, memories, voter, accused, arch) {
  const mem = memories[voter.id];
  if (isSuspicious(mem, accused.id)) return 'GUILTY';
  if (mem.lastLynchAccusedId === voter.id && mem.voteHistory[accused.id] === 'GUILTY') return 'GUILTY';
  return 'ABSTAIN';
}

function livingVote(state, memories, voter, accused, archetypes) {
  const mem = memories[voter.id];
  const arch = archetypes[voter.id];
  if (mem.side === 'TOWN') return townVote(mem, accused, arch);
  if (mem.side === 'MAFIA') return mafiaVote(mem, accused, arch);
  return skVote(state, memories, voter, accused, arch);
}

function ghostVote(mem, accused) {
  if (mem.ownSheriffResults[accused.id] === 'SUSPICIOUS') return 'GUILTY';
  if (mem.sheriffPublic[accused.id] === 'SUSPICIOUS') return 'GUILTY';
  if (isTrusted(mem, accused.id)) return 'INNOCENT';
  if (claimConflict(mem, accused.id)) return 'GUILTY';
  return null;
}

function runTrial(state, memories, archetypes) {
  const townAlive = living(state).filter(function (p) {
    return memories[p.id].side === 'TOWN';
  });
  const sheriff = townAlive.find(function (p) {
    const m = memories[p.id];
    return m.roleId === 'sheriff' || m.inheritedSheriff;
  });
  const nominator = sheriff || pick(townAlive);
  if (!nominator) return null;
  const accused = mostSuspiciousMem(state, memories, nominator.id, [nominator.id]);
  if (!accused || !engine.startTrial(state, accused.id, nominator.id)) return null;
  state.players.forEach(function (p) {
    if (p.isAlive) {
      const v = livingVote(state, memories, p, accused, archetypes);
      if (v) engine.castVote(state, { voterId: p.id, verdict: v, ghostToken: false });
    } else if (p.hasGhostVote && !p.ghostVoteSpent) {
      const g = ghostVote(memories[p.id], accused);
      if (g) engine.castVote(state, { voterId: p.id, verdict: g, ghostToken: true });
    }
  });
  const res = engine.resolveTrial(state);
  const accusedSusp = publicSuspicionScore(state, memories, accused.id) >= 2;
  const accusedTrusted = publicTrusted(state, memories, accused.id);
  state.players.forEach(function (p) {
    const m = memories[p.id];
    const vote = (state.trial.votes || []).find(function (v) { return v.voterId === p.id; });
    m.voteHistory[p.id] = vote ? vote.verdict : 'ABSTAIN';
    m.lastLynchAccusedId = accused.id;
    m.lastLynchAccusedKnownSuspicious = accusedSusp;
    m.lastLynchAccusedKnownTown = accusedTrusted;
  });
  let g = 0, o = 0;
  (state.trial.votes || []).forEach(function (v) {
    const voter = byId(state, v.voterId);
    const w = voter && voter.isAlive && voter.revealed && memories[voter.id].roleId === 'mayor' ? 3 : 1;
    if (v.verdict === 'GUILTY') g += w; else o += w;
  });
  let line = '=== Day ' + state.dayNumber + ': ' + accused.name + ' accused by ' + nominator.name +
    '; votes ' + g + '-' + o + (res.lynchedId ? ' GUILTY' : ' no-lynch') + '; ';
  if (res.lynchedId) {
    const lynched = byId(state, res.lynchedId);
    line += lynched.name + ' lynched (' + roleName(memories[lynched.id].roleId) + ')';
    learnDayDeath(state, memories, lynched.id);
    if (res.jesterWin) line += ' - Jester wins!';
    if (res.executionerWin) line += ' - Executioner wins!';
  } else line += accused.name + ' survived';
  return line + ' ===';
}

function runDay(state, memories, dayInfo, archetypes) {
  const lines = [];
  if (!dayInfo.claimsDone) {
    dayClaims(state, memories);
    dayInfo.claimsDone = true;
  }
  sheriffReport(state, memories);
  const mayor = state.players.find(function (p) {
    return p.isAlive && memories[p.id].roleId === 'mayor' && !p.revealed;
  });
  if (mayor && state.dayNumber >= 2) {
    engine.mayorReveal(state, mayor.id);
    state.players.forEach(function (p) { memories[p.id].confirmedTown[mayor.id] = true; });
    lines.push(mayor.name + ' (Mayor) revealed');
  }
  const vig = state.players.find(function (p) {
    return p.isAlive && memories[p.id].roleId === 'vigilante' && p.shotsFired < 3;
  });
  const vt = vig ? vigilanteTarget(state, memories, vig) : null;
  if (vig && vt && engine.vigilanteShoot(state, vig.id, vt.id)) {
    lines.push(vig.name + ' (Vigilante) shot ' + vt.name);
    learnDayDeath(state, memories, vt.id);
  }
  if (state.phase === 'END') return lines;
  const dep = state.players.find(function (p) {
    return p.isAlive && memories[p.id].roleId === 'deputy' && !p.usedOncePerGame;
  });
  const dt = dep ? vigilanteTarget(state, memories, dep) : null;
  if (dep && dt && engine.deputyShoot(state, dep.id, dt.id)) {
    lines.push(dep.name + ' (Deputy) shot ' + dt.name);
    learnDayDeath(state, memories, dt.id);
  }
  if (state.phase === 'END') return lines;
  const trialLine = runTrial(state, memories, archetypes);
  if (trialLine) lines.push(trialLine);
  return lines;
}

function main() {
  const results = { preset: PRESET, playerCount: PLAYER_COUNT, games: NUM_GAMES, wins: { TOWN: 0, MAFIA: 0, NEUTRAL: 0, nobody: 0 }, details: [] };

  for (let i = 0; i < NUM_GAMES; i += 1) {
    const state = engine.createGame({ playerCount: PLAYER_COUNT, presetId: PRESET });
    const names = [];
    for (let s = 1; s <= PLAYER_COUNT; s += 1) names.push({ seat: s, name: 'P' + s });
    engine.setPlayerNames(state, names);
    engine.dealRoles(state);
    const archetypes = assignArchetypes(state);
    const memories = makeMemories(state);
    const dayInfo = { claimsDone: false };
    let days = 0;
    while (state.phase !== 'END' && days < MAX_DAYS) {
      if (state.phase !== 'NIGHT') state.phase = 'NIGHT';
      const recorded = [], notes = [];
      runNight(state, memories, recorded, notes, archetypes);
      engine.resolveNight(state);
      state.players.forEach(function (p) {
        const m = memories[p.id];
        if (m.roleId === 'jailor') m.lastJailed = state.night.lastJailTarget;
        if (m.roleId === 'blackmailer') m.lastBlackmail = state.night.lastBlackmailTarget;
      });
      if (state.jester.hauntTarget) {
        notes.push({ pos: 0, text: 'Jester haunted ' + pname(state, state.jester.hauntTarget) });
      }
      morningUpdate(state, memories, recorded, notes);
      engine.beginDay(state);
      if (state.phase === 'END') break;
      runDay(state, memories, dayInfo, archetypes);
      if (state.phase === 'END') break;
      days += 1;
    }
    if (state.phase !== 'END') engine.endGame(state);

    const winner = state.winner ? state.winner.winner : 'nobody';
    if (winner === 'TOWN') results.wins.TOWN += 1;
    else if (winner === 'MAFIA') results.wins.MAFIA += 1;
    else if (winner === 'SERIAL_KILLER' || winner === 'EXECUTIONER' || winner === 'JESTER') results.wins.NEUTRAL += 1;
    else results.wins.nobody += 1;

    results.details.push({
      game: i + 1,
      winner: winner,
      reason: state.winner ? state.winner.reason : 'max days',
      days: days,
      townDeaths: state.graveyard.filter(function (e) { return teamOfRole(e.trueRole) === 'TOWN'; }).length,
      mafiaDeaths: state.graveyard.filter(function (e) { return teamOfRole(e.trueRole) === 'MAFIA'; }).length,
      neutralDeaths: state.graveyard.filter(function (e) { return teamOfRole(e.trueRole) === 'NEUTRAL'; }).length
    });
  }

  results.townWinRate = (results.wins.TOWN / NUM_GAMES * 100).toFixed(1) + '%';
  results.mafiaWinRate = (results.wins.MAFIA / NUM_GAMES * 100).toFixed(1) + '%';
  results.neutralWinRate = (results.wins.NEUTRAL / NUM_GAMES * 100).toFixed(1) + '%';

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
