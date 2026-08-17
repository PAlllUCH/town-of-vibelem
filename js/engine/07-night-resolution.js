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

  function isDemonLike(state, player) {
    if (!player) return false;
    if (player.assignedRole === 'demon') return true;
    if (player.assignedRole === 'imp' && player.inheritedRole === 'demon') return true;
    if (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'demon') return true;
    return false;
  }

  E._isSerialKiller = function (state, player) {
    return player.assignedRole === 'serialkiller' ||
      (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'serialkiller');
  };

  E._isDemon = function (state, player) {
    return isDemonLike(state, player);
  };

  E._hasBasicDefense = function (state, player) {
    return isGodfatherLike(state, player) || E._isSerialKiller(state, player) || isDemonLike(state, player);
  };

  E._sheriffSuspicious = function (state, player) {
    if (isGodfatherLike(state, player)) return false;
    if (isDemonLike(state, player)) return false;
    if (E._isSerialKiller(state, player)) return true;
    var id = player.assignedRole;
    if (id === 'imp' || id === 'possessed' || id === 'succubus' || id === 'necromant' || id === 'outcast') return true;
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

  function promoteMafioso(state) {
    var mafioso = state.players.find(function (pl) {
      return pl.assignedRole === 'mafioso' && pl.isAlive;
    });
    if (!mafioso || mafioso.inheritedRole === 'godfather') return;
    mafioso.inheritedRole = 'godfather';
    state.pendingGodfatherPromotion = mafioso.id;
  }

  function isGodfather(state, player) {
    return player && (
      player.assignedRole === 'godfather' ||
      player.inheritedRole === 'godfather' ||
      (player.assignedRole === 'amnesiac' && state.amnesiac.used &&
        state.amnesiac.rememberedRole === 'godfather')
    );
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
    if (isGodfather(state, p)) promoteMafioso(state);
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
    var gf = state.players.find(function (p) { return isGodfather(state, p); });
    var mafioso = state.players.find(function (p) { return p.assignedRole === 'mafioso'; });
    if (gf && !gf.isAlive && mafioso && mafioso.isAlive) {
      if (mafioso.inheritedRole !== 'godfather') {
        mafioso.inheritedRole = 'godfather';
        state.pendingGodfatherPromotion = mafioso.id;
      }
      if (state.pendingGodfatherPromotion === mafioso.id) {
        state.logs.push('The Mafioso has become the new Godfather.');
        E._logPlayer(state, mafioso.id, E._logAt(state), 'promoted', 'Became the new Godfather.');
        state.pendingGodfatherPromotion = null;
      }
    }
    var demon = state.players.find(function (p) {
      return p.assignedRole === 'demon' && !p.isAlive;
    });
    if (demon) {
      var imp = state.players.find(function (p) {
        return p.assignedRole === 'imp' && p.isAlive && p.inheritedRole !== 'demon';
      });
      if (imp) {
        imp.inheritedRole = 'demon';
        state.pendingDemonSuccession = imp.id;
        state.logs.push('The Imp has become the new Demon.');
        E._logPlayer(state, imp.id, E._logAt(state), 'promoted', 'The Demon has fallen; the Imp becomes the new Demon.');
      }
    }
  };

})(globalThis);
