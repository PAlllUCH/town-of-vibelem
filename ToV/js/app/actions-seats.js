'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function playerBySeat(seat) {
    return (APP.state.players || []).find(function (p) { return String(p.seat) === String(seat); }) || null;
  }

  function seatRole(seat, roleId) {
    var s = Number(seat);
    if (roleId) APP.app.pendingRoles[s] = roleId;
    else delete APP.app.pendingRoles[s];
    APP.afterMutation();
  }

  function autoFill() {
    var leftovers = UI.leftoverRoles(APP.state, APP.app.pendingRoles);
    leftovers = E._shuffle(leftovers);
    for (var s = 1; s <= APP.state.playerCount; s++) {
      if (!APP.app.pendingRoles[s] && leftovers.length) {
        APP.app.pendingRoles[s] = leftovers.pop();
      }
    }
    APP.afterMutation();
  }

  function lockRoles() {
    var names = [];
    for (var s = 1; s <= (APP.state.playerCount || APP.cfg.playerCount); s++) {
      names.push({ seat: s, name: (APP.app.names[s] || '').trim() || ('Player ' + s) });
    }
    E.setPlayerNames(APP.state, names);
    try {
      E.assignRoles(APP.state, APP.app.pendingRoles);
      APP.app.namingMode = false;
      UI.toast('Roles assigned.', 'success');
      APP.afterMutation();
    } catch (e) {
      UI.toast(e.message, 'error');
    }
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
      UI.toast('Roles swapped.', 'success');
      APP.afterMutation();
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  }

  function editNames() {
    APP.app.names = {};
    APP.app.pendingRoles = {};
    (APP.state.players || []).forEach(function (p) {
      APP.app.names[p.seat] = p.name || '';
      if (p.assignedRole) APP.app.pendingRoles[p.seat] = p.assignedRole;
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

  APP.seatRole = seatRole;
  APP.autoFill = autoFill;
  APP.lockRoles = lockRoles;
  APP.swapSelect = swapSelect;
  APP.editNames = editNames;
  APP.beginNight = beginNight;
})();
