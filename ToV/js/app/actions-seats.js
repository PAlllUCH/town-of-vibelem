'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function playerBySeat(seat) {
    return (APP.state.players || []).find(function (p) { return String(p.seat) === String(seat); }) || null;
  }

  function dealRoles() {
    var names = [];
    for (var s = 1; s <= (APP.state.playerCount || APP.cfg.playerCount); s++) {
      names.push({ seat: s, name: (APP.app.names[s] || '').trim() || ('Player ' + s) });
    }
    E.setPlayerNames(APP.state, names);
    E.dealRoles(APP.state);
    APP.app.namingMode = false;
    APP.afterMutation();
  }

  function swapSelect(seat) {
    if (!APP.app.swapMode) return;
    var p = playerBySeat(seat);
    if (!p) return;
    if (APP.app.swapSel == null) {
      APP.app.swapSel = Number(seat);
      APP.afterMutation();
      return;
    }
    if (Number(APP.app.swapSel) === Number(seat)) {
      APP.app.swapSel = null;
      APP.afterMutation();
      return;
    }
    var a = playerBySeat(APP.app.swapSel);
    try {
      E.swapRoles(APP.state, a.id, p.id);
      APP.app.swapMode = false;
      APP.app.swapSel = null;
      UI.toast('Roles swapped.');
      APP.afterMutation();
    } catch (e) {
      UI.toast(e.message);
    }
  }

  function editNames() {
    APP.app.names = {};
    (APP.state.players || []).forEach(function (p) {
      APP.app.names[p.seat] = p.name || '';
    });
    APP.app.namingMode = true;
    APP.save();
    APP.renderScreen('seats');
  }

  function beginNight() {
    APP.state.phase = 'NIGHT';
    APP.app.namingMode = false;
    APP.app.wizard = { steps: E.getNightSteps(APP.state), idx: 0, actor: null, pending: null };
    APP.afterMutation();
    APP.goto('game');
  }

  APP.dealRoles = dealRoles;
  APP.swapSelect = swapSelect;
  APP.editNames = editNames;
  APP.beginNight = beginNight;
})();
