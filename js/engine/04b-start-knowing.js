'use strict';
(function (root) {
  var E = root.VillageEngine;

  E._computeStartKnowing = function (state) {
    var chef = state.players.find(function (p) { return p.assignedRole === 'chef'; });
    if (chef) {
      var n = state.playerCount;
      var evil = function (p) {
        return E._alignmentOf(state, p) === 'MAFIA' || E._isSerialKiller(state, p);
      };
      var evilPairs = 0;
      for (var s = 1; s <= n; s += 1) {
        var a = E._byId(state, s);
        var b = E._byId(state, (s % n) + 1);
        if (evil(a) && evil(b)) evilPairs += 1;
      }
      var chefText = evilPairs === 0 ? 'Chef: no adjacent pairs of evil players.'
        : evilPairs === 1 ? 'Chef: 1 adjacent pair of evil players.'
        : 'Chef: ' + evilPairs + ' adjacent pairs of evil players.';
      E._logPlayer(state, chef.id, 'SETUP', 'info', chefText);
    }
    var ww = state.players.find(function (p) { return p.assignedRole === 'washerwoman'; });
    if (ww) {
      var candidates = Object.keys(E.ROLES).filter(function (id) {
        return E.ROLES[id].team === 'TOWN' && id !== 'civilian' && id !== 'washerwoman' &&
          state.deck.indexOf(id) !== -1;
      });
      var pairA = null;
      var pairB = null;
      var claimRoleId = null;
      if (candidates.length > 0) {
        claimRoleId = candidates[E._randInt(candidates.length)];
        pairA = state.players.find(function (p) { return p.assignedRole === claimRoleId; }) || ww;
        var others = state.players.filter(function (p) { return p.id !== pairA.id; });
        pairB = others[E._randInt(others.length)];
      } else {
        var townPlayers = state.players.filter(function (p) {
          return E.ROLES[p.assignedRole] && E.ROLES[p.assignedRole].team === 'TOWN' &&
            p.assignedRole !== 'civilian';
        });
        pairA = townPlayers.length > 0
          ? townPlayers[0]
          : state.players[0];
        var rest2 = state.players.filter(function (p) { return p.id !== pairA.id; });
        pairB = rest2[E._randInt(rest2.length)];
        var namedTown = Object.keys(E.ROLES).filter(function (id) {
          return E.ROLES[id].team === 'TOWN' && id !== 'civilian' && id !== 'washerwoman' &&
            state.deck.indexOf(id) !== -1;
        });
        var distinctClaim = namedTown.filter(function (id) { return id !== pairA.assignedRole; });
        var claimPool = distinctClaim.length > 0 ? distinctClaim : namedTown;
        claimRoleId = claimPool.length > 0 ? claimPool[E._randInt(claimPool.length)] : 'civilian';
      }
      var claimRole = E.ROLES[claimRoleId];
      var claimName = claimRole ? claimRole.name : claimRoleId;
      E._logPlayer(state, ww.id, 'SETUP', 'info',
        'Washerwoman: one of ' + playerLabel(pairA) + ', ' + playerLabel(pairB) +
        ' is the ' + claimName + '.');
    }
  };

  function playerLabel(p) {
    return p.name || 'Player ' + p.seat;
  }
})(typeof window !== 'undefined' ? window : globalThis);
