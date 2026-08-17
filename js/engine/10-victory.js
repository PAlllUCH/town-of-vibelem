'use strict';
(function (root) {
  var E = root.VillageEngine;

  function finish(state, result) {
    result.survivors = E._livingSharers(state);
    state.winner = result;
    state.phase = 'END';
    state.logs.push(result.winner + ' wins: ' + result.reason);
    return result;
  }

  E.checkVictory = function (state) {
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
    } else if (mafia >= town + evil) {
      result = { winner: 'MAFIA', reason: 'The Mafia holds majority.' };
    } else if (town === 0 && mafia > 0) {
      result = { winner: 'MAFIA', reason: 'No Town-aligned players remain.' };
    } else if (mafia === 0 && evil === 0 && !sk && !demon) {
      result = { winner: 'TOWN', reason: 'All Mafia-aligned and Evil players are dead.' };
    }
    if (result) return finish(state, result);
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
