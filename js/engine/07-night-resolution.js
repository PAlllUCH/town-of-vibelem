'use strict';
(function (root) {
  var E = root.VillageEngine;

  E._alignmentOf = function (state, player) {
    if (!player) return 'NEUTRAL';
    if (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole) {
      var r = E.ROLES[state.amnesiac.rememberedRole];
      return r ? r.team : 'NEUTRAL';
    }
    if (player.assignedRole === 'witch') {
      return state.witchSide === 'TOWN' ? 'TOWN' : 'MAFIA';
    }
    var role = E.ROLES[player.assignedRole];
    return role ? role.team : 'NEUTRAL';
  };

  function isGodfatherLike(state, player) {
    return player.assignedRole === 'godfather' ||
      player.inheritedRole === 'godfather' ||
      (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'godfather');
  }

  E._isSerialKiller = function (state, player) {
    return player.assignedRole === 'serialkiller' ||
      (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'serialkiller');
  };

  E._hasBasicDefense = function (state, player) {
    return isGodfatherLike(state, player) || E._isSerialKiller(state, player);
  };

  E._sheriffSuspicious = function (state, player) {
    if (isGodfatherLike(state, player)) return false;
    if (E._isSerialKiller(state, player)) return true;
    return E._alignmentOf(state, player) === 'MAFIA';
  }

  E._latestEntry = function (state, pid) {
    for (var i = state.graveyard.length - 1; i >= 0; i -= 1) {
      if (state.graveyard[i].playerId === pid) return state.graveyard[i];
    }
    return null;
  }

  function convertExecutioner(state, cause) {
    if (state.executionerConverted || !state.executionerTarget) return;
    var p = E._byId(state, state.executionerTarget);
    state.executionerConverted = true;
    state.logs.push('The Executioner\'s target ' + (p ? p.name : String(state.executionerTarget)) +
      ' died (' + cause + '); the Executioner becomes a Jester.');
    var exe = state.players.find(function (pl) { return pl.assignedRole === 'executioner'; });
    if (exe) E._logPlayer(state, exe.id, E._logAt(state), 'converted', 'Became a Jester: the target died (' + cause + ').');
  }

  E._recordDeath = function (state, pid, cause, byLynch, skipToken) {
    var p = E._byId(state, pid);
    if (!p || !p.isAlive) return null;
    p.isAlive = false;
    var firstDeath = !p.diedBefore;
    if (firstDeath && !skipToken) p.hasGhostVote = true;
    p.diedBefore = true;
    var entry = {
      playerId: pid,
      name: p.name,
      trueRole: p.assignedRole,
      inspectedByUndertaker: false,
      wasCleaned: false,
      deathCause: cause
    };
    state.graveyard.push(entry);
    if (!state.deathLog) state.deathLog = [];
    var shownRole = E.ROLES[p.assignedRole] ? E.ROLES[p.assignedRole].name : String(p.assignedRole);
    state.deathLog.push({
      night: state.phase === 'NIGHT' ? 'N' + state.night.number : 'Day ' + (state.dayNumber || 1),
      playerId: pid,
      name: p.name,
      roleShown: shownRole,
      cause: cause
    });
    E._logPlayer(state, pid, E._logAt(state), 'death', p.name + ' died: ' + cause + '.');
    if (!byLynch && state.executionerTarget === pid) convertExecutioner(state, cause);
    return entry;
  };

  E._livingSharers = function (state) {
    return state.players.filter(function (p) {
      if (!p.isAlive) return false;
      var r = p.assignedRole;
      return r === 'survivor' || r === 'drunk' || r === 'spy' || (r === 'amnesiac' && !state.amnesiac.used);
    }).map(function (p) { return p.id; });
  };

  E._updateInheritance = function (state) {
    var sheriff = state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    var deputy = state.players.find(function (p) { return p.assignedRole === 'deputy'; });
    if (sheriff && !sheriff.isAlive && deputy && deputy.isAlive && deputy.inheritedRole !== 'sheriff') {
      deputy.inheritedRole = 'sheriff';
      state.pendingInheritanceNote = 'The Deputy has inherited the Sheriff\'s badge.';
      state.logs.push('The Deputy has inherited the Sheriff\'s badge.');
      E._logPlayer(state, deputy.id, E._logAt(state), 'inherited', 'Inherited the Sheriff\'s badge.');
    }
    var gf = state.players.find(function (p) { return p.assignedRole === 'godfather'; });
    var mafioso = state.players.find(function (p) { return p.assignedRole === 'mafioso'; });
    if (gf && !gf.isAlive && mafioso && mafioso.isAlive && mafioso.inheritedRole !== 'godfather') {
      mafioso.inheritedRole = 'godfather';
      state.logs.push('The Mafioso has become the new Godfather.');
      E._logPlayer(state, mafioso.id, E._logAt(state), 'promoted', 'Became the new Godfather.');
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
