'use strict';
(function (root) {
  var engine = root.VillageEngine;
  if (!engine && typeof require === 'function') {
    engine = require('../engine.js');
    root.VillageEngine = engine;
  }
  if (!engine) throw new Error('feature-extractor: VillageEngine not found');

  var PHASES = ['SETUP', 'SEATS', 'NIGHT', 'MORNING', 'DAY', 'END'];
  var TEAMS = ['TOWN', 'MAFIA', 'NEUTRAL'];
  var MAX_DAYS = 25;

  function getRoleList() {
    return Object.keys(engine.ROLES);
  }

  function playerCountOf(state) {
    return (state && state.playerCount) || (state && state.players ? state.players.length : 0);
  }

  function getFeatureDimension(state) {
    var n = playerCountOf(state);
    var r = getRoleList().length;
    return 16 + r + n * (3 * r + 5);
  }

  function getCandidateDimension(state) {
    return 3 * getRoleList().length + 8;
  }

  function getVoteDimension(state) {
    return getFeatureDimension(state) + getCandidateDimension(state);
  }

  function getNightDimension(state) {
    return getFeatureDimension(state) + getCandidateDimension(state);
  }

  function getClaimDimension(state) {
    return getFeatureDimension(state);
  }

  function oneHot(roleList, roleId, out) {
    var idx = roleList.indexOf(roleId);
    for (var i = 0; i < roleList.length; i += 1) out.push(idx === i ? 1 : 0);
  }

  function pushRoleBlock(roleList, roleId, out) {
    oneHot(roleList, roleId, out);
    out.push(roleId == null ? 1 : 0);
  }

  function pushSheriffSlot(memories, pid, target, out) {
    var self = memories[pid] || {};
    var res;
    if (self.ownSheriffResults && self.ownSheriffResults[target] !== undefined) {
      res = self.ownSheriffResults[target];
    } else if (self.sheriffPublic && self.sheriffPublic[target] !== undefined) {
      res = self.sheriffPublic[target];
    }
    if (res === 'INNOCENT') out.push(0, 1, 0);
    else if (res === 'SUSPICIOUS') out.push(0, 0, 1);
    else out.push(1, 0, 0);
  }

  function pushConsigliereSlot(roleList, memories, pid, target, out) {
    var self = memories[pid] || {};
    var res = self.consigliereResults ? self.consigliereResults[target] : undefined;
    var idx = res === undefined || res === null ? -1 : roleList.indexOf(res);
    for (var i = 0; i < roleList.length; i += 1) out.push(idx === i ? 1 : 0);
  }

  function pushDeadSlot(roleList, state, memories, pid, target, out) {
    var self = memories[pid] || {};
    var known = self.deadRoles ? self.deadRoles[target] : undefined;
    if (known !== undefined && known !== null) {
      pushRoleBlock(roleList, known, out);
      return;
    }
    var entry = null;
    var graveyard = state.graveyard || [];
    for (var i = graveyard.length - 1; i >= 0; i -= 1) {
      if (graveyard[i].playerId === target) {
        entry = graveyard[i];
        break;
      }
    }
    if (!entry) {
      for (var j = 0; j <= roleList.length; j += 1) out.push(0);
      return;
    }
    if (entry.wasCleaned) {
      pushRoleBlock(roleList, null, out);
      return;
    }
    pushRoleBlock(roleList, entry.trueRole, out);
  }

  function extract(state, memories, playerId) {
    memories = memories || {};
    var roleList = getRoleList();
    var players = state.players || [];
    var n = playerCountOf(state);
    var self = memories[playerId] || {};
    var out = [];

    var phaseIdx = PHASES.indexOf(state.phase);
    for (var i = 0; i < PHASES.length; i += 1) out.push(phaseIdx === i ? 1 : 0);
    out.push((state.dayNumber || 0) / MAX_DAYS);
    var nightNumber = state.night && state.night.number !== undefined ? state.night.number : 1;
    out.push(nightNumber / MAX_DAYS);

    var alive = 0;
    players.forEach(function (p) { if (p.isAlive) alive += 1; });
    out.push(alive / n);

    var counts = { TOWN: 0, MAFIA: 0, NEUTRAL: 0 };
    players.forEach(function (p) {
      var role = engine.ROLES[p.assignedRole];
      var team = role ? role.team : 'NEUTRAL';
      if (counts[team] === undefined) team = 'NEUTRAL';
      counts[team] += 1;
    });
    out.push(counts.TOWN / n);
    out.push(counts.MAFIA / n);
    out.push(counts.NEUTRAL / n);

    oneHot(roleList, self.roleId, out);

    var selfTeam = self.side || self.team || 'NEUTRAL';
    for (var t = 0; t < TEAMS.length; t += 1) out.push(selfTeam === TEAMS[t] ? 1 : 0);
    out.push(players[playerId - 1] && players[playerId - 1].isAlive ? 1 : 0);

    players.forEach(function (p) {
      pushSheriffSlot(memories, playerId, p.id, out);
      pushConsigliereSlot(roleList, memories, playerId, p.id, out);
      pushRoleBlock(roleList, self.claims ? self.claims[p.id] : undefined, out);
      pushDeadSlot(roleList, state, memories, playerId, p.id, out);
    });

    return out;
  }

  function candidate(state, memories, playerId, candidateId) {
    var roleList = getRoleList();
    var players = state.players || [];
    var cand = players[candidateId - 1];
    var self = memories[playerId] || {};
    var out = [];
    out.push(cand && cand.isAlive ? 1 : 0);
    out.push(candidateId === playerId ? 1 : 0);
    out.push(self.mafiaMembers && self.mafiaMembers[candidateId] ? 1 : 0);
    pushSheriffSlot(memories, playerId, candidateId, out);
    pushConsigliereSlot(roleList, memories, playerId, candidateId, out);
    pushRoleBlock(roleList, self.claims ? self.claims[candidateId] : undefined, out);
    pushDeadSlot(roleList, state, memories, playerId, candidateId, out);
    return out;
  }

  root.FeatureExtractor = {
    PHASES: PHASES,
    TEAMS: TEAMS,
    MAX_DAYS: MAX_DAYS,
    getRoleList: getRoleList,
    getFeatureDimension: getFeatureDimension,
    getCandidateDimension: getCandidateDimension,
    getVoteDimension: getVoteDimension,
    getNightDimension: getNightDimension,
    getClaimDimension: getClaimDimension,
    extract: extract,
    candidate: candidate
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.FeatureExtractor;
  }
})(typeof window !== 'undefined' ? window : globalThis);
