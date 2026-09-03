'use strict';
(function (root) {
  var E = root.VillageEngine;

  function finish(state, result) {
    result.survivors = E._livingSharers(state);
    state.winner = result;
    state.phase = 'END';
    state.logs.push(result.winner === 'DRAW'
      ? 'Draw: ' + result.reason
      : result.winner + ' wins: ' + result.reason);
    return result;
  }

  function lynchCount(state) {
    var g = state.graveyard || [];
    var n = 0;
    for (var i = 0; i < g.length; i += 1) {
      if (g[i] && g[i].deathCause === 'lynched by the town') n += 1;
    }
    return n;
  }

  function updateStaleTracking(state) {
    if (!Number.isInteger(state.maxStaleDays) || state.maxStaleDays < 1) state.maxStaleDays = 5;
    if (!Number.isInteger(state.staleDays) || state.staleDays < 0) state.staleDays = 0;
    var lynches = lynchCount(state);
    if (!Number.isInteger(state.staleLynchSeen)) state.staleLynchSeen = lynches;
    if (lynches > state.staleLynchSeen) state.staleDays = 0;
    state.staleLynchSeen = lynches;
    var cycleNight = Number.isInteger(state.night.number) ? state.night.number - 1 : 0;
    if (cycleNight >= 1 && state.phase === 'DAY' && state.morning &&
        Array.isArray(state.morning.deaths) && state.staleNightSeen !== cycleNight) {
      var base = Number.isInteger(state.staleCycleLynches) ? state.staleCycleLynches : null;
      var dayHadLynch = base !== null && lynches > base;
      var nightHadDeath = state.morning.deaths.length > 0;
      if (dayHadLynch || nightHadDeath) state.staleDays = 0;
      else state.staleDays += 1;
      state.staleCycleLynches = lynches;
      state.staleNightSeen = cycleNight;
    }
  }

  E.checkVictory = function (state) {
    if (state.phase === 'END') return state.winner;
    updateStaleTracking(state);
    var living = state.players.filter(function (p) { return p.isAlive; });
    if (living.length === 0) {
      return finish(state, { winner: null, reason: 'No living players remain.' });
    }
    var town = 0, mafia = 0, evil = 0;
    for (var i = 0; i < living.length; i += 1) {
      var a = E._alignmentOf(state, living[i]);
      if (a === 'TOWN') town += 1;
      else if (a === 'MAFIA') mafia += 1;
      else if (a === 'EVIL') evil += 1;
    }
    var sk = living.find(function (p) { return E._isSerialKiller(state, p); });
    var demon = living.find(function (p) { return E._isDemon(state, p); });
    var result = null;
    if (living.length === 1) {
      var last = living[0];
      if (E._isSerialKiller(state, last)) {
        result = { winner: 'SERIAL_KILLER', reason: 'The Serial Killer stands alone.' };
      } else if (E._isDemon(state, last)) {
        result = { winner: 'DEMON', reason: 'The Demon stands alone.' };
      } else if (E._alignmentOf(state, last) === 'MAFIA') {
        result = { winner: 'MAFIA', reason: 'The last survivor is Mafia-aligned.' };
      } else if (E._alignmentOf(state, last) === 'EVIL') {
        result = { winner: 'EVIL', reason: 'The last survivor is Evil-aligned.' };
      } else if (E._alignmentOf(state, last) === 'TOWN') {
        result = { winner: 'TOWN', reason: 'The last survivor is Town-aligned.' };
      }
    } else if (sk && living.length - 1 <= 1) {
      result = { winner: 'SERIAL_KILLER', reason: 'The Serial Killer stands last or holds majority.' };
    } else if (demon && living.length - 1 <= 1) {
      result = { winner: 'DEMON', reason: 'The Demon stands last or holds majority.' };
    } else if (living.length === 2 && evil === 1 && town === 1 && mafia === 0) {
      result = { winner: 'EVIL', reason: 'The last Evil-aligned player outlasts the final Town-aligned player.' };
    } else if (mafia > 0 && mafia >= town) {
      result = { winner: 'MAFIA', reason: 'The Mafia holds majority.' };
    } else if (town === 0 && mafia > 0) {
      result = { winner: 'MAFIA', reason: 'No Town-aligned players remain.' };
    } else if (mafia === 0 && !sk && !demon && town > 0) {
      result = { winner: 'TOWN', reason: 'All Mafia-aligned players and the Serial Killer are dead.' };
    }
    if (result) return finish(state, result);
    if (state.staleDays >= state.maxStaleDays) {
      return finish(state, {
        winner: 'DRAW',
        reason: 'The game ends in a draw after ' + state.staleDays +
          ' consecutive cycles with no lynch and no night deaths.'
      });
    }
    return null;
  };

  E.endGame = function (state) {
    state.phase = 'END';
    if (!state.winner) {
      state.winner = { winner: null, survivors: [], reason: 'The game ended without a declared winner.' };
    }
    var reveal = state.players.map(function (p) {
      var role = E.ROLES[p.assignedRole] || { name: p.assignedRole, team: 'NEUTRAL' };
      return {
        id: p.id, name: p.name, seat: p.seat,
        role: p.assignedRole, roleName: role.name, team: role.team,
        isAlive: p.isAlive, inheritedRole: p.inheritedRole
      };
    });
    state.logs.push('Game over. All roles revealed.');
    return { winner: state.winner, reveal: reveal };
  };
})(globalThis);
