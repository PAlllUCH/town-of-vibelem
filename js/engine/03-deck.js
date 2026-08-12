'use strict';
(function (root) {
  var E = root.VillageEngine;

  E._randInt = function (n) {
    if (!n || n < 1) return 0;
    return Math.floor(Math.random() * n);
  };

  E._shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i -= 1) {
      var j = E._randInt(i + 1);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  function cleanList(list) {
    var out = [];
    if (!list) return out;
    for (var i = 0; i < list.length; i += 1) {
      var id = list[i];
      if (E.ROLES[id] && out.indexOf(id) === -1) out.push(id);
    }
    return out;
  }

  function padTeam(list, slots, presetList, team) {
    var out = list.slice(0, slots);
    var candidates = presetList.concat(Object.keys(E.ROLES));
    for (var i = 0; i < candidates.length && out.length < slots; i += 1) {
      var rid = candidates[i];
      if (E.ROLES[rid] && E.ROLES[rid].team === team && out.indexOf(rid) === -1) out.push(rid);
    }
    return out;
  }

  E._buildDeck = function (playerCount, presetId, opts) {
    var preset = E.PRESETS[presetId];
    var ratio = E.RATIO_TABLE[playerCount];
    var tc = (opts && opts.teamCounts) || ratio;
    var townSlots = tc.town;
    var mafiaSlots = tc.mafia;
    var neutralSlots = tc.neutral;
    var townList = cleanList((opts && opts.town) || preset.town);
    var mafiaList = cleanList((opts && opts.mafia) || preset.mafia);
    var neutralList = cleanList((opts && opts.neutral) || preset.neutral);
    var civMin = (opts && opts.civilians != null)
      ? Math.max(0, Math.min(townSlots, Number(opts.civilians)))
      : null;
    var townNamed = civMin == null
      ? townList.slice(0, townSlots)
      : townList.slice(0, Math.max(0, townSlots - civMin));
    var civCount = Math.max(civMin == null ? 0 : civMin, Math.max(0, townSlots - townNamed.length));
    var town = townNamed.slice();
    for (var c = 0; c < civCount; c += 1) town.push('civilian');
    var mafia = padTeam(mafiaList, mafiaSlots, preset.mafia, 'MAFIA');
    var neutral = padTeam(neutralList, neutralSlots, preset.neutral, 'NEUTRAL');
    return E._shuffle(town.concat(mafia, neutral));
  };

  E.getDeckPreview = function (state) {
    var out = { town: [], mafia: [], neutral: [] };
    for (var i = 0; i < state.deck.length; i += 1) {
      var id = state.deck[i];
      var role = E.ROLES[id];
      if (!role) continue;
      out[role.team.toLowerCase()].push(id);
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
