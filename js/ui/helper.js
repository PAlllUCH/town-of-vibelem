'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  var SHEET_FLAGS = ['drunk', 'poisoned', 'jailed', 'protected', 'alert', 'revealed', 'blackmailed', 'enchanted', 'cleaned', 'necro_used', 'succubus_target', 'ghost'];
  var LEGEND = [
    ['DRUNK', 'Role actions fail, results invert, protection fails'],
    ['POISONED', 'Will be drunk for one full cycle starting next night'],
    ['JAILED', 'Jailed by the Jailor, cannot act or vote'],
    ['PROTECTED', 'Got Doctor or Innkeeper protection last night'],
    ['ALERT', 'Veteran is armed, visitors die'],
    ['REVEALED', 'Mayor or role publicly revealed'],
    ['BLACKMAILED', 'Cannot speak today'],
    ['ENCHANTED', 'Succubus target, cannot vote guilty against the Succubus'],
    ['CLEANED', 'Janitor cleaned the role at death'],
    ['NECRO USED', 'Necromant already borrowed a dead role'],
    ['SUCCUBUS TARGET', 'Current enchant target of the Succubus'],
    ['GHOST', 'Dead, haunts or votes from the grave']
  ];

  function nightOrderCard(state, app) {
    var dealt = {};
    (state.players || []).forEach(function (p) {
      if (p.assignedRole) dealt[p.assignedRole] = true;
    });
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-night-order']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>Night Order</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-night-order"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-night-order">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-night-order">';
    html += '<div class="helper-list">';
    (E.NIGHT_STEPS || []).forEach(function (step) {
      if (!step.roles || !step.roles.length) return;
      var hit = false;
      step.roles.forEach(function (rid) { if (dealt[rid]) hit = true; });
      if (!hit) return;
      html += '<div class="helper-step">' +
        '<span class="helper-step-pos">' + step.position + '</span>' +
        '<strong class="helper-step-title">' + UI.esc(step.title) + '</strong>' +
        '<p class="helper-step-prompt">' + UI.esc(step.prompt) + '</p></div>';
    });
    html += '</div></div></div>';
    return html;
  }

  function statusFlags(app, pid) {
    var statuses = (app && app.statuses) || {};
    return statuses[String(pid)] || {};
  }

  function chip(flag, flags) {
    if (!flags[flag]) return '';
    var cls = 'helper-chip';
    if (flag === 'ghost') cls += ' helper-chip-dead';
    if (flag === 'poisoned') cls += ' helper-chip-bad';
    return '<span class="' + cls + '">' + String(flag).toUpperCase() + '</span>';
  }

  function rosterCard(state, app) {
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-players']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>Players</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-players"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-players">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-players">';
    (state.players || []).forEach(function (p) {
      var flags = statusFlags(app, p.id);
      var name = p.name != null ? p.name : ('Player ' + (p.seat != null ? p.seat : ''));
      var roleTxt = p.assignedRole ? UI.roleNameInline(p.assignedRole) : 'Unassigned';
      html += '<button type="button" class="helper-player" data-helper-pid="' + UI.esc(p.id) + '" data-action="open-helper-sheet">' +
        '<span class="helper-player-name">' + UI.esc(name) + '</span>' +
        '<span class="helper-player-role">' + roleTxt + '</span></button>';
      html += '<div class="helper-player-tags">';
      if (!p.isAlive) html += '<span class="helper-chip helper-chip-dead">SPIRIT</span>';
      SHEET_FLAGS.forEach(function (f) { html += chip(f, flags); });
      Object.keys(flags).filter(function (k) {
        return SHEET_FLAGS.indexOf(k) === -1 && flags[k];
      }).sort().forEach(function (k) { html += chip(k, flags); });
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function legendCard(app) {
    var collapsed = !!(app && app.collapsed && app.collapsed['helper-statuses']);
    var html = '<div class="helper-card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="helper-card-head"><h2>Statuses</h2>' +
      '<button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="helper-statuses"' +
      ' aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-helper-statuses">' +
      (collapsed ? '+' : '-') + '</button></div>';
    html += '<div class="helper-card-body" id="card-body-helper-statuses">';
    LEGEND.forEach(function (it) {
      html += '<div class="helper-status-legend">' +
        '<strong>' + UI.esc(it[0]) + '</strong>' +
        '<small>' + UI.esc(it[1]) + '</small></div>';
    });
    html += '</div></div>';
    return html;
  }

  UI.renderHelper = function (state, cfg, app) {
    return nightOrderCard(state, app) + rosterCard(state, app) + legendCard(app);
  };

  UI.renderHelperSheet = function (state, pid, app) {
    var p = UI.findPlayer(state, pid);
    var name = p && p.name != null ? p.name : String(pid);
    var flags = statusFlags(app, pid);
    var html = '<div class="helper-sheet-backdrop open" data-action="close-helper-sheet"></div>';
    html += '<div class="helper-sheet open" role="dialog" aria-label="Status sheet">';
    html += '<div class="helper-sheet-head"><h3>' + UI.esc(name) + '</h3>' +
      '<button type="button" class="btn btn-icon" data-action="close-helper-sheet" aria-label="Close">&times;</button></div>';
    html += '<div class="helper-sheet-grid">';
    SHEET_FLAGS.forEach(function (fl) {
      var on = !!flags[fl];
      html += '<button type="button" class="btn btn-sm helper-status-btn' + (on ? ' on' : '') + '"' +
        ' data-action="set-helper-status" data-helper-pid="' + UI.esc(pid) + '" data-helper-status="' + fl + '">' +
        fl.toUpperCase().replace(/_/g, ' ') + '</button>';
    });
    html += '</div>';
    html += '<button type="button" class="btn btn-block" data-action="close-helper-sheet">Done</button>';
    html += '</div>';
    return html;
  };

  UI.renderHelperNightOrderStandalone = function (state) {
    return nightOrderCard(state);
  };
})();