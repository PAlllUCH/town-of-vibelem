'use strict';

(function () {
  var UI = window.UI;
  var E = window.VillageEngine || {};

  var TEAM_ORDER = ['TOWN', 'MAFIA', 'NEUTRAL'];
  var LOG_KIND_CLS = {
    death: 'log-bad', lynched: 'log-bad', shot: 'log-bad', haunted: 'log-bad',
    protected: 'log-ok', revive: 'log-ok', inherited: 'log-ok', promoted: 'log-ok',
    'night-action': 'log-accent', info: 'log-accent', poisoned: 'log-accent',
    jailed: 'log-accent', blackmailed: 'log-accent', silenced: 'log-accent',
    verdict: 'log-accent', nominated: 'log-accent'
  };
  var LOG_KIND_TAG = {
    death: 'DEATH', lynched: 'DEATH', shot: 'DEATH', haunted: 'DEATH',
    info: 'INFO', 'night-action': 'NIGHT', poisoned: 'NIGHT', jailed: 'NIGHT',
    blackmailed: 'NIGHT', silenced: 'NIGHT', protected: 'NIGHT', revive: 'NIGHT',
    remembered: 'NIGHT', inherited: 'NIGHT', promoted: 'NIGHT', converted: 'NIGHT',
    set: 'SET', swap: 'SWAP',
    nominated: 'DAY', verdict: 'DAY', acquitted: 'DAY', revealed: 'DAY'
  };
  var LOG_BOLD = { death: true, lynched: true, shot: true, haunted: true };

  function currentRole(state, app, seat) {
    var pr = app.pendingRoles && app.pendingRoles[seat];
    if (pr != null && pr !== '') return pr;
    var p = state.players && state.players[seat - 1];
    return p && p.assignedRole ? p.assignedRole : '';
  }

  function availableRoles(state, app, seat) {
    var others = {};
    var civPicks = 0;
    Object.keys(app.pendingRoles || {}).forEach(function (s) {
      if (String(s) !== String(seat)) {
        var rid = app.pendingRoles[s];
        if (!rid) return;
        if (rid === 'civilian') civPicks += 1;
        else others[rid] = true;
      }
    });
    var civInDeck = 0;
    (state.deck || []).forEach(function (rid) {
      if (rid === 'civilian') civInDeck += 1;
    });
    var ids = [];
    if (civInDeck - civPicks > 0) ids.push('civilian');
    (state.deck || []).forEach(function (rid) {
      if (rid !== 'civilian' && ids.indexOf(rid) === -1) ids.push(rid);
    });
    var taken = {};
    ids.forEach(function (rid) {
      if (rid !== 'civilian' && others[rid]) taken[rid] = true;
    });
    return { ids: ids, taken: taken };
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
    html += UI.seatLayoutOpen(cfg, n);
    for (var s = 1; s <= n; s++) {
      var role = currentRole(state, app, s);
      html += '<div class="seat-input-wrap"' + UI.seatPosAttr(cfg, s, n) + '>' +
        '<span class="seat-label">' + s + '</span>' +
        '<button class="seat-btn" data-action="open-naming-sheet" data-seat="' + s +
        '" aria-label="Edit seat ' + s + '">' +
        '<span class="seat-btn-name">' + UI.esc(app.names[s] || ('Player ' + s)) +
        '</span>' +
        '<span class="seat-btn-role' + (role ? ' team-' + UI.teamOf(role) + '-text' : '') + '">' +
        (role ? UI.roleName(role) : '&ndash;') + '</span></button></div>';
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
          : 'Seat ' + app.swapSel + ' selected. Tap a second seat to swap.') +
        '<button class="btn btn-sm btn-block" data-action="swap-cancel">Cancel Swap</button></div>';
    }
    html += UI.seatLayoutOpen(cfg, n);
    UI.playersBySeat(state.players).forEach(function (p) {
      var team = UI.teamOf(p.assignedRole);
      var sel = app.swapMode && app.swapSel != null && String(app.swapSel) === String(p.seat)
        ? ' swap-selected' : '';
      var clickable = app.swapMode
        ? ' data-action="swap-select" data-seat="' + UI.esc(p.seat) + '"'
        : ' data-action="open-detail-sheet" data-seat="' + UI.esc(p.seat) + '"';
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

    html += nightZeroCard(state, app);

    html += '<button class="btn btn-primary btn-block btn-big" data-action="begin-night">Begin Day 1</button>';
    return html;
  };

  function nightZeroCard(state, app) {
    var deck = state.deck || [];
    var done = app.nightZeroDone || {};
    var rows = [];
    var add = function (id, label, sub) {
      rows.push({ id: id, label: label, sub: sub });
    };
    if (state.gfBluffs && state.gfBluffs.length) {
      add('bluffs', 'Whisper the Godfather bluffs',
        'GF: bluff as ' + state.gfBluffs.map(UI.roleName).join(', '));
    }
    if (deck.indexOf('witch') !== -1) {
      add('witch', 'Set the Witch\u2019s side',
        'Witch sides with ' + (state.witchSide === 'TOWN' ? 'Town' : 'Mafia') + ' this game.');
    }
    if (state.executionerTarget) {
      add('executioner', 'Brief the Executioner',
        'Executioner target: ' + UI.esc(UI.nameOf(state, state.executionerTarget)));
    }
    var n1Roles = deck.filter(function (rid) {
      return E.ROLES[rid] && E.ROLES[rid].n1Only;
    });
    var relayRoles = deck.filter(function (rid) {
      return E.ROLES[rid] && (E.ROLES[rid].n1Only || E.ROLES[rid].startKnowing);
    });
    if (relayRoles.length) {
      add('relays', 'Inform blind roles', relayRoles.map(UI.roleName).join(', ') + ' relays');
    }
    if (n1Roles.length) {
      add('n1', 'Wake first-night roles',
        n1Roles.map(UI.roleName).join(', ') + ' wake on Night 1 only.');
    }
    add('deal', 'Deal role cards', 'Deal each player their role card / name tag.');
    var doneCount = 0;
    rows.forEach(function (r) { if (done[r.id]) doneCount += 1; });
    var html = '<div class="card"><div class="card-head"><h2>Night Zero</h2>' +
      '<span class="tag tag-accent">' + doneCount + '/' + rows.length + ' done</span></div>';
    html += '<p class="muted small">Prep ritual: finish every row before the table opens its eyes.</p>';
    rows.forEach(function (r) {
      var on = !!done[r.id];
      html += '<button class="toggle-row' + (on ? ' on' : '') + '" data-action="nz-toggle" data-nz="' + r.id + '">' +
        '<span class="toggle-text"><strong>' + UI.esc(r.label) + '</strong>' +
        (r.sub ? '<small>' + r.sub + '</small>' : '') + '</span>' +
        '<span class="toggle' + (on ? ' on' : '') + '"><span class="toggle-knob"></span></span></button>';
    });
    html += '</div>';
    return html;
  }

  function renderNamingSheet(state, cfg, app) {
    var seat = app.sheet.seat;
    var name = app.sheet.name != null ? app.sheet.name : (app.names[seat] || ('Player ' + seat));
    var cur = app.sheet.role != null ? app.sheet.role : currentRole(state, app, seat);
    var picker = availableRoles(state, app, seat);
    var ids = picker.ids.slice();
    if (cur && ids.indexOf(cur) === -1) ids.push(cur);
    ids.sort(function (a, b) {
      var ta = TEAM_ORDER.indexOf(UI.teamOf(a));
      var tb = TEAM_ORDER.indexOf(UI.teamOf(b));
      if (ta !== tb) return ta - tb;
      var na = UI.roleName(a).toLowerCase();
      var nb = UI.roleName(b).toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
    if (cur) {
      ids = [cur].concat(ids.filter(function (id) { return id !== cur; }));
    }
    var html = '<div class="seat-sheet-backdrop" data-action="close-sheet"></div>';
    html += '<div class="seat-sheet" role="dialog" aria-label="Edit seat ' + seat + '">';
    html += '<div class="seat-sheet-handle"></div>';
    html += '<div class="seat-sheet-head"><div>' +
      '<h3>Seat ' + seat + '</h3>' +
      '<div class="seat-sheet-current">' +
      (cur ? 'Currently: <strong>' + UI.roleName(cur) + '</strong>' : 'No role yet') +
      '</div></div>' +
      '<button class="btn btn-icon" data-action="close-sheet" aria-label="Close">&times;</button></div>';
    html += '<label class="seat-sheet-label" for="seat-name-input">Name</label>';
    html += '<input id="seat-name-input" class="seat-sheet-input" type="text" value="' + UI.esc(name) +
      '" placeholder="Player name" maxlength="20" aria-label="Player name">';
    html += '<label class="seat-sheet-label">Role</label>';
    var rem = { TOWN: 0, MAFIA: 0, NEUTRAL: 0 };
    ids.forEach(function (rid) { rem[UI.teamOf(rid)] += 1; });
    html += '<p class="muted small">Remaining: ' + rem.TOWN + ' Town, ' + rem.MAFIA + ' Mafia, ' + rem.NEUTRAL + ' Neutral</p>';
    html += '<div class="seat-sheet-role-list" role="listbox" aria-label="Role picker">';
    ids.forEach(function (rid) {
      var team = UI.teamOf(rid);
      var taken = !!picker.taken[rid] && rid !== cur;
      html += '<button class="seat-sheet-role-btn btn btn-sm' + (cur === rid ? ' on' : '') + '"' +
        ' role="option" aria-selected="' + (cur === rid ? 'true' : 'false') + '"' +
        (taken ? ' disabled' : '') +
        ' data-action="pick-role" data-role="' + UI.esc(rid) + '">' +
        '<span class="team-dot team-' + team + '"></span>' + UI.roleName(rid) +
        (taken ? '<span class="tag seat-sheet-taken-tag">TAKEN</span>' : '') +
        '</button>';
    });
    html += '</div>';
    html += '<div class="seat-sheet-footer">' +
      '<button class="btn" data-action="close-sheet">Cancel</button>' +
      '<button class="btn btn-primary" data-action="save-seat">Save</button></div>';
    html += '</div>';
    return html;
  }

  function renderDetailSheet(state, cfg, app) {
    var p = UI.findPlayer(state, app.sheet.id);
    if (!p) return '';
    var team = UI.teamOf(p.assignedRole);
    var r = E.ROLES[p.assignedRole] || {};
    var html = '<div class="seat-sheet-backdrop" data-action="close-sheet"></div>';
    html += '<div class="seat-sheet seat-sheet-detail" role="dialog" aria-label="Player details">';
    html += '<div class="seat-sheet-handle"></div>';
    html += '<div class="seat-sheet-head"><div class="seat-sheet-title-row">' +
      '<span class="team-dot team-' + team + '"></span>' +
      '<h3>' + UI.esc(p.name || ('Player ' + p.seat)) + '</h3></div>' +
      '<button class="btn btn-icon" data-action="close-sheet" aria-label="Close">&times;</button></div>';
    html += '<div class="seat-sheet-role-card team-' + team + '">' +
      '<span class="seat-sheet-role-name team-' + team + '-text">' +
      (app.rolesHidden ? '&#8226;&#8226;&#8226;' : UI.roleName(p.assignedRole)) + '</span>' +
      (r.category ? '<span class="reference-cat">' + UI.esc(r.category) + '</span>' : '') + '</div>';
    html += '<div class="seat-sheet-tags">' + UI.statusTags(p) + '</div>';
    html += '<p class="seat-sheet-desc muted">' + UI.esc(r.blurb || '') + '</p>';
    html += '<h4 class="seat-sheet-log-title">Activity Log</h4>';
    html += '<div class="seat-sheet-log" role="log" aria-label="Player activity log">';
    var log = (state.playerLog && state.playerLog[String(p.id)]) || [];
    if (!log.length) {
      html += '<div class="player-log-row">No activity yet.</div>';
    }
    for (var i = log.length - 1; i >= 0; i -= 1) {
      var entry = log[i];
      var cls = LOG_KIND_CLS[entry.kind] || '';
      var label = LOG_KIND_TAG[entry.kind] || String(entry.kind || '').toUpperCase();
      html += '<div class="player-log-row ' + cls + (LOG_BOLD[entry.kind] ? ' log-bold' : '') + '"' +
        ' data-kind="' + UI.esc(entry.kind) + '">' +
        '<span class="tag log-kind-tag">' + UI.esc(label) + '</span>' +
        UI.esc(entry.text) + '</div>';
    }
    html += '</div></div>';
    return html;
  }

  UI.renderSheet = function (state, cfg, app) {
    var sh = app.sheet;
    if (!sh) return '';
    if (sh.kind === 'naming') return renderNamingSheet(state, cfg, app);
    if (sh.kind === 'detail') return renderDetailSheet(state, cfg, app);
    return '';
  };

  UI.mountSheet = function (state, cfg, app) {
    var host = document.getElementById('sheet-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'sheet-root';
      if (document.body && document.body.appendChild) document.body.appendChild(host);
    }
    var alreadyOpen = !!(host.querySelector && host.querySelector('.seat-sheet.open'));
    host.innerHTML = UI.renderSheet(state, cfg, app);
    var open = function () {
      var back = host.querySelector('.seat-sheet-backdrop');
      var sheet = host.querySelector('.seat-sheet');
      if (back) back.classList.add('open');
      if (sheet) sheet.classList.add('open');
    };
    if (alreadyOpen) open();
    else if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(open);
    else open();
    if (document.body) document.body.classList.add('sheet-open');
    var firstMount = !!(app.sheet && app.sheet.focusFirst !== false);
    var focusEl = firstMount
      ? host.querySelector('#seat-name-input')
      : host.querySelector('.seat-sheet-role-btn.on') || host.querySelector('.seat-sheet-role-btn');
    if (!focusEl) focusEl = host.querySelector('.seat-sheet-head .btn-icon');
    if (focusEl && focusEl.focus) focusEl.focus();
    if (app.sheet) app.sheet.focusFirst = false;
  };

  UI.unmountSheet = function () {
    var host = document.getElementById('sheet-root');
    if (host) host.innerHTML = '';
    if (document.body) document.body.classList.remove('sheet-open');
  };
})();
