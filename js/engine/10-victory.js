'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.checkVictory = function (state) {
    var living = state.players.filter(function (p) { return p.isAlive; });
    var town = 0;
    var mafia = 0;
    for (var i = 0; i < living.length; i += 1) {
      var a = E._alignmentOf(state, living[i]);
      if (a === 'TOWN') town += 1;
      else if (a === 'MAFIA') mafia += 1;
    }
    var sk = living.find(function (p) { return E._isSerialKiller(state, p); });
    var result = null;
    if (sk && living.length - 1 <= 1) {
      result = { winner: 'SERIAL_KILLER', reason: 'The Serial Killer stands last or holds majority.' };
    } else if (mafia >= town) {
      result = { winner: 'MAFIA', reason: 'The Mafia holds majority.' };
    } else if (mafia === 0 && !sk) {
      result = { winner: 'TOWN', reason: 'All Mafia-aligned players and the Serial Killer are dead.' };
    }
    if (result) {
      result.survivors = E._livingSharers(state);
      state.winner = result;
      state.phase = 'END';
      state.logs.push(result.winner + ' wins: ' + result.reason);
    }
    return result;
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
})(typeof window !== 'undefined' ? window : globalThis);
