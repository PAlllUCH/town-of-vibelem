'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.killPlayer = function (state, playerId, cause) {
    var p = E._byId(state, playerId);
    if (!p || !p.isAlive) return null;
    if (state.phase === 'END' || state.winner) return null;
    E._recordDeath(state, playerId, cause || 'killed by the moderator', false, false);
    E._updateInheritance(state);
    state.logs.push(p.name + ' was killed by the moderator.');
    return E.checkVictory(state);
  };

  E.undoKill = function (state, playerId) {
    var p = E._byId(state, playerId);
    if (!p || p.isAlive) return null;
    var entry = E._latestEntry(state, playerId);
    if (entry) {
      var gi = state.graveyard.lastIndexOf(entry);
      if (gi >= 0) state.graveyard.splice(gi, 1);
    }
    if (state.deathLog) {
      for (var i = state.deathLog.length - 1; i >= 0; i -= 1) {
        if (String(state.deathLog[i].playerId) === String(playerId)) {
          state.deathLog.splice(i, 1);
          break;
        }
      }
    }
    var key = String(playerId);
    if (state.playerLog && state.playerLog[key]) {
      for (var j = state.playerLog[key].length - 1; j >= 0; j -= 1) {
        if (state.playerLog[key][j].kind === 'death') {
          state.playerLog[key].splice(j, 1);
          break;
        }
      }
    }
    p.isAlive = true;
    p.hasGhostVote = false;
    p.nightTarget = null;
    if (state.trial && state.trial.active && String(state.trial.accusedId) === String(playerId)) {
      state.trial.active = false;
      state.trial.stage = null;
      state.trial.dayTrialsDone = Math.max(0, (state.trial.dayTrialsDone || 0) - 1);
    } else if (entry && (entry.deathCause === 'lynched by the town' ||
        (state.trial && String(state.trial.accusedId) === String(playerId)))) {
      state.trial.dayTrialsDone = Math.max(0, (state.trial.dayTrialsDone || 0) - 1);
    }
    if (entry && state.jester && state.jester.haunted &&
        (String(entry.trueRole) === 'jester' || String(entry.trueRole) === 'executioner')) {
      state.jester.haunted = false;
      state.jester.hauntTarget = null;
    }
    if (state.winner) state.winner = null;
    if (state.phase === 'END') state.phase = 'DAY';
    return { revivedId: playerId };
  };

  E.vigilanteShoot = function (state, shooterId, targetId) {
    var shooter = E._byId(state, shooterId);
    var target = E._byId(state, targetId);
    if (!shooter || !target) return null;
    if (shooter.assignedRole !== 'vigilante' || !shooter.isAlive) return null;
    if (!target.isAlive || targetId === shooterId) return null;
    if (shooter.shotsFired >= 3) return null;
    shooter.shotsFired += 1;
    var guilty = E._alignmentOf(state, target) === 'TOWN';
    if (guilty) shooter.guiltPending = true;
    E._recordDeath(state, targetId, 'shot during the day', false, false);
    state.logs.push(target.name + ' was shot during the day.');
    E._logPlayer(state, shooterId, E._logAt(state), 'shot', shooter.name + ' shot ' + target.name + '.');
    E._logPlayer(state, targetId, E._logAt(state), 'shot', 'Was shot during the day.');
    E._updateInheritance(state);
    var victory = E.checkVictory(state);
    return { killedId: targetId, guilty: guilty, victory: victory };
  };

  E.deputyShoot = function (state, deputyId, targetId) {
    var deputy = E._byId(state, deputyId);
    var target = E._byId(state, targetId);
    if (!deputy || !target) return null;
    if (deputy.assignedRole !== 'deputy' || !deputy.isAlive) return null;
    if (deputy.usedOncePerGame) return null;
    if (!target.isAlive || targetId === deputyId) return null;
    deputy.usedOncePerGame = true;
    var guilty = E._alignmentOf(state, target) === 'TOWN';
    if (guilty) deputy.guiltPending = true;
    E._recordDeath(state, targetId, 'shot by the Deputy', false, false);
    state.logs.push('The Deputy publicly shot ' + target.name + '.');
    E._logPlayer(state, deputyId, E._logAt(state), 'shot', deputy.name + ' shot ' + target.name + '.');
    E._logPlayer(state, targetId, E._logAt(state), 'shot', 'Was shot by the Deputy.');
    E._updateInheritance(state);
    var victory = E.checkVictory(state);
    return { killedId: targetId, guilty: guilty, victory: victory };
  };

  E.mayorReveal = function (state, mayorId) {
    var mayor = E._byId(state, mayorId);
    if (!mayor) return null;
    if (mayor.assignedRole !== 'mayor' || !mayor.isAlive || mayor.revealed) return null;
    mayor.revealed = true;
    mayor.usedOncePerGame = true;
    state.logs.push('The Mayor has revealed!');
    E._logPlayer(state, mayorId, E._logAt(state), 'revealed', mayor.name + ' revealed as the Mayor (votes count 3).');
    return { revealed: true };
  };
})(typeof window !== 'undefined' ? window : globalThis);
