'use strict';

(function () {
  var UI = window.UI;
  var E = window.VillageEngine || {};

  function currentRole(state, app, seat) {
    var pr = app.pendingRoles && app.pendingRoles[seat];
    if (pr != null && pr !== '') return pr;
    var p = state.players && state.players[seat - 1];
    return p && p.assignedRole ? p.assignedRole : '';
  }

  function roleOptions(state, app, seat) {
    var others = {};
    Object.keys(app.pendingRoles || {}).forEach(function (s) {
      if (String(s) !== String(seat)) {
        var rid = app.pendingRoles[s];
        if (rid && rid !== 'civilian') others[rid] = true;
      }
    });
    var ids = ['civilian'];
    (state.deck || []).forEach(function (rid) {
      if (rid !== 'civilian' && ids.indexOf(rid) === -1 && !others[rid]) ids.push(rid);
    });
    var cur = currentRole(state, app, seat);
    var out = '';
    ids.forEach(function (rid) {
      var r = E.ROLES[rid] || {};
      out += '<option value="' + rid + '"' + (cur === rid ? ' selected' : '') +
        ' title="' + UI.esc(r.blurb || '') + '">' + UI.roleName(rid) + '</option>';
    });
    return out;
  }

  UI.renderSeats = function (state, cfg, app) {
    if (!app.namingMode && state.players && state.players.length &&
        state.players.every(function (p) { return p.assignedRole; })) {
      return UI.renderSeatsDealt(state, cfg, app);
    }
    return UI.renderSeatsNaming(state, cfg, app);
  };

  UI.renderSeatsNaming = function (state, cfg, app) {
    var n = state.playerCount || cfg.playerCount;
    var left = 0;
    for (var seat = 1; seat <= n; seat++) {
      if (!currentRole(state, app, seat)) left++;
    }
    var html = '<div class="card">';
    html += '<div class="card-head"><h2>Name the Seats</h2>' +
      '<button class="btn btn-sm" data-action="goto-setup">Setup</button></div>';
    html += '<div class="hint" data-role-remaining>' + left + ' seat' + (left === 1 ? '' : 's') +
      ' left to assign</div>';
    html += UI.seatLayoutOpen(cfg);
    for (var s = 1; s <= n; s++) {
      html += '<div class="seat-input-wrap"' + UI.seatPosAttr(cfg, s, n) + '>' +
        '<span class="seat-label">' + s + '</span>' +
        '<input class="seat-name-input" data-seat="' + s +
        '" value="' + UI.esc(app.names[s] || ('Player ' + s)) +
        '" placeholder="Name" aria-label="Seat ' + s + ' name">' +
        '<select class="select" data-action="seat-role" data-seat="' + s +
        '" aria-label="Seat ' + s + ' role">' +
        '<option value="">Pick a role...</option>' +
        roleOptions(state, app, s) +
        '</select></div>';
    }
    html += UI.seatLayoutClose();
    html += '<div class="btn-row">' +
      '<button class="btn" data-action="auto-fill">Auto-fill rest</button>' +
      '<button class="btn btn-primary" data-action="lock-roles">Lock Roles</button></div>' +
      '</div>';
    html += '<div class="hint">Deal one role per player in private. The app is moderator-only: keep the screen to yourself.</div>';
    return html;
  };

  UI.renderSeatsDealt = function (state, cfg, app) {
    var n = state.playerCount || cfg.playerCount;
    var html = '<div class="card">';
    html += '<div class="card-head"><h2>Seats</h2>' +
      '<button class="btn btn-sm" data-action="toggle-roles">' +
      (app.rolesHidden ? 'Show' : 'Hide') + ' Roles</button>' +
      '<button class="btn btn-sm' + (app.swapMode ? ' on' : '') + '" data-action="swap-mode">' +
      (app.swapMode ? 'Cancel Swap' : 'Swap Roles') + '</button></div>';
    html += UI.flowStrip(state.phase);
    if (app.swapMode) {
      html += '<div class="hint"><strong>Swap mode:</strong> ' +
        (app.swapSel == null
          ? 'Tap a seat to select it, then tap a second seat to swap their roles.'
          : 'Seat ' + app.swapSel + ' selected. Tap a second seat to swap, or Cancel Swap to exit.') +
        '</div>';
    }
    html += UI.seatLayoutOpen(cfg);
    UI.playersBySeat(state.players).forEach(function (p) {
      var team = UI.teamOf(p.assignedRole);
      var sel = app.swapMode && app.swapSel != null && String(app.swapSel) === String(p.seat)
        ? ' swap-selected' : '';
      var clickable = app.swapMode
        ? ' data-action="swap-select" data-seat="' + UI.esc(p.seat) + '"'
        : '';
      html += '<div class="seat-input-wrap' + sel + '"' + UI.seatPosAttr(cfg, p.seat, n) + '>' +
        '<span class="seat-label">' + UI.esc(p.seat) + '</span>' +
        '<div class="seat-dealt team-' + team + '"' + clickable + '>' +
        '<div class="seat-dealt-name">' + UI.esc(p.name || ('Player ' + p.seat)) + '</div>' +
        '<div class="seat-role">' + (app.rolesHidden ? '&#8226;&#8226;&#8226;' : UI.roleName(p.assignedRole)) + '</div>' +
        '<div class="seat-tags">' + UI.statusTags(p) + '</div></div></div>';
    });
    html += UI.seatLayoutClose();
    html += '<div class="btn-row">' +
      '<button class="btn" data-action="edit-names">Edit Names</button>' +
      '<button class="btn" data-action="redeal">Redeal</button></div>';
    html += '</div>';

    html += '<div class="card">';
    if (state.gfBluffs && state.gfBluffs.length) {
      html += '<div class="hint"><strong>Godfather bluffs:</strong> ' + state.gfBluffs.map(UI.roleName).join(', ') + '</div>';
    }
    if (state.executionerTarget) {
      html += '<div class="hint"><strong>Executioner target:</strong> ' + UI.esc(UI.nameOf(state, state.executionerTarget)) + '</div>';
    }
    if (state.deck && state.deck.indexOf('witch') !== -1) {
      html += '<div class="hint"><strong>Witch side:</strong> ' +
        '<button class="btn btn-sm' + (state.witchSide !== 'TOWN' ? ' on' : '') + '" data-action="witch-side" data-side="MAFIA">Mafia</button> ' +
        '<button class="btn btn-sm' + (state.witchSide === 'TOWN' ? ' on' : '') + '" data-action="witch-side" data-side="TOWN">Town</button>' +
        ' <span class="muted small">(ask the Witch privately before the game starts)</span></div>';
    }
    html += '<p class="muted small">Whisper the bluffs and targets above when roles are dealt.</p>';
    html += '</div>';

    html += '<button class="btn btn-primary btn-block btn-big" data-action="begin-night">Begin Night 1</button>';
    return html;
  };
})();
