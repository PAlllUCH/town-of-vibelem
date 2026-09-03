'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  var TEAM_ORDER = ['TOWN', 'MAFIA', 'NEUTRAL', 'EVIL'];
  var TEAM_LABELS = { TOWN: 'Town', MAFIA: 'Mafia', NEUTRAL: 'Neutral', EVIL: 'Evil' };

  function teamRoles(team, query) {
    var q = String(query || '').trim().toLowerCase();
    var roles = Object.keys(E.ROLES || {}).map(function (id) { return E.ROLES[id]; })
      .filter(function (r) { return r && r.team === team; })
      .sort(function (a, b) {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
    if (!q) return roles;
    var label = TEAM_LABELS[team] || team;
    return roles.filter(function (r) {
      var pl = typeof E.roleName === 'function' ? String(E.roleName(r.id, 'pl') || '') : String(r.namePl || '');
      return r.name.toLowerCase().indexOf(q) !== -1 ||
        pl.toLowerCase().indexOf(q) !== -1 ||
        r.category.toLowerCase().indexOf(q) !== -1 ||
        label.toLowerCase().indexOf(q) !== -1 ||
        String(r.blurb || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function roleRow(r, open) {
    var html = '<button type="button" class="reference-row" data-action="reference-detail" data-role="' + UI.esc(r.id) + '">' +
      '<span class="reference-row-top">' +
      '<span class="reference-row-name">' + UI.roleNameInline(r.id) + '</span>' +
      '<span class="reference-cat">' + UI.esc(r.category) + '</span>' +
      '</span>' +
      '<span class="reference-blurb">' + UI.esc(r.blurb || '') + '</span>';
    if (open) {
      html += '<span class="reference-detail">' +
        '<span class="reference-detail-row"><span class="muted">Night action</span><strong>' + (r.nightAction ? 'Yes' : 'No') + '</strong></span>' +
        '<span class="reference-detail-row"><span class="muted">Day action</span><strong>' + (r.dayAction ? 'Yes' : 'No') + '</strong></span>' +
        '<span class="reference-detail-row"><span class="muted">Once per game</span><strong>' + (r.oncePerGame ? 'Yes' : 'No') + '</strong></span>' +
        '<span class="reference-detail-row"><span class="muted">Max uses</span><strong>' + (r.maxUses == null ? 'Unlimited' : r.maxUses) + '</strong></span>' +
        '</span>';
    }
    html += '</button>';
    return html;
  }

  UI.renderReferenceList = function (app) {
    var q = (app && app.referenceQuery) || '';
    var html = '';
    var found = false;
    TEAM_ORDER.forEach(function (team) {
      var roles = teamRoles(team, q);
      if (!roles.length) return;
      found = true;
      html += '<div class="reference-group">' +
        '<div class="reference-group-head"><span class="team-dot team-' + team + '"></span>' +
        '<strong>' + TEAM_LABELS[team] + '</strong></div>';
      roles.forEach(function (r) {
        html += roleRow(r, !!(app && app.referenceDetail === r.id));
      });
      html += '</div>';
    });
    if (!found) {
      var term = String(q).trim();
      html = '<p class="reference-none muted">No roles match' +
        (term ? ' "' + UI.esc(term) + '"' : '') + '.</p>';
    }
    return html;
  };

  UI.renderRoleReference = function (state, app) {
    var q = (app && app.referenceQuery) || '';
    return '<div class="reference-head">' +
      '<div class="reference-head-row"><h2>Role Reference</h2>' +
      '<button type="button" class="btn btn-sm" data-action="close-reference">Close</button></div>' +
      '<input class="reference-search" data-action="reference-search" placeholder="Search roles..." value="' + UI.esc(q) + '">' +
      '</div>' +
      '<div class="reference-list">' + UI.renderReferenceList(app) + '</div>';
  };
})();
