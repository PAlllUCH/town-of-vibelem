'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  UI.renderClaimsPanel = function (state, cfg, app) {
    var claims = (app && app.claims) || {};
    var html = '<div class="panel-backdrop" data-action="toggle-claims"></div>';
    html += '<div class="claims-panel panel-overlay" role="dialog" aria-label="Public claims">';
    html += '<div class="panel-head"><h2>Public Claims</h2>' +
      '<button class="btn btn-icon" data-action="toggle-claims" aria-label="Close">&times;</button></div>';
    UI.playersBySeat(state.players).forEach(function (p) {
      if (!p.isAlive) return;
      var claimed = claims[String(p.seat)];
      html += '<button class="claim-row" data-action="claim-open" data-seat="' + UI.esc(p.seat) + '">' +
        '<span class="claim-name">' + UI.esc(p.name) + '</span>' +
        '<span class="claim-chip' + (claimed ? ' on' : '') + '">' +
        (claimed ? UI.roleNameInline(claimed) : 'No claim') + '</span></button>';
    });
    html += '<p class="muted small claims-hint">Players state their claims publicly; the moderator records them here.</p>';
    html += '</div>';
    return html;
  };

  UI.claimRoleButtons = function (state, app, seat, action) {
    var claims = (app && app.claims) || {};
    var order = { TOWN: 0, MAFIA: 1, NEUTRAL: 2 };
    var lastTeam = '';
    var html = '';
    Object.keys(E.ROLES || {}).sort(function (a, b) {
      var ta = order[UI.teamOf(a)] != null ? order[UI.teamOf(a)] : 3;
      var tb = order[UI.teamOf(b)] != null ? order[UI.teamOf(b)] : 3;
      if (ta !== tb) return ta - tb;
      var na = UI.roleName(a).toLowerCase();
      var nb = UI.roleName(b).toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    }).forEach(function (id) {
      var t = UI.teamOf(id);
      if (t !== lastTeam) {
        html += '<div class="claim-team-head">' + UI.teamLabel(t) + '</div>';
        lastTeam = t;
      }
      html += '<button class="claim-role-btn btn btn-sm' + (claims[String(seat)] === id ? ' on' : '') + '"' +
        ' data-action="' + action + '" data-seat="' + UI.esc(seat) + '" data-role="' + UI.esc(id) + '">' +
        '<span class="team-dot team-' + t + '"></span>' + UI.roleNameInline(id) + '</button>';
    });
    return html;
  };

  UI.renderClaimPicker = function (state, app) {
    var seat = app.claimPicker;
    var p = null;
    (state.players || []).forEach(function (x) {
      if (String(x.seat) === String(seat)) p = x;
    });
    if (!p) return '';
    var claims = app.claims || {};
    var html = '<div class="claim-picker-backdrop" data-action="claim-close"></div>';
    html += '<div class="claim-picker" role="dialog" aria-label="Claim picker">';
    html += '<div class="seat-sheet-handle"></div>';
    html += '<div class="seat-sheet-head"><div><h3>Claim for ' + UI.esc(p.name) + '</h3>' +
      '<div class="seat-sheet-current">' + (claims[String(seat)] ? 'Currently: <strong>' +
      UI.roleName(claims[String(seat)]) + '</strong>' : 'No claim yet') + '</div></div>' +
      '<button class="btn btn-icon" data-action="claim-close" aria-label="Close">&times;</button></div>';
    html += UI.claimRoleButtons(state, app, seat, 'claim-pick');
    html += '<div class="seat-sheet-footer">' +
      (claims[String(seat)] ? '<button class="btn btn-danger" data-action="claim-clear" data-seat="' +
        UI.esc(seat) + '">Clear</button>' : '') +
      '<button class="btn" data-action="claim-close">Cancel</button></div>';
    html += '</div>';
    return html;
  };
})();
