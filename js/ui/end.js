'use strict';

(function () {
  var UI = window.UI;

  UI.renderEnd = function (state, cfg, app) {
    var html = '';
    var raw = state.winner;
    var w = raw && typeof raw === 'object' ? raw.winner : raw;
    var pl = ((app && app.locale) || 'en').toLowerCase() === 'pl';
    var labels = {
      TOWN: 'The Town Wins',
      MAFIA: 'The Mafia Wins',
      'SERIAL KILLER': 'The Serial Killer Wins',
      SERIAL_KILLER: 'The Serial Killer Wins',
      SK: 'The Serial Killer Wins',
      DEMON: 'The Demon Wins',
      EVIL: 'The Evil Team Wins',
      JESTER: 'The Jester Wins',
      EXECUTIONER: 'The Executioner Wins',
      WITCH: 'The Witch Wins',
      SURVIVOR: 'The Survivor Wins'
    };
    var title = labels[w] || (w ? String(w) + ' Wins' : UI.str('sessionOver'));
    var altTitle = '';
    if (w === 'DRAW') {
      title = pl ? 'Remis' : 'Draw';
      altTitle = pl ? 'Draw' : 'Remis';
    }
    html += '<div class="end-banner"><h1>' + UI.esc(title) +
      (altTitle ? ' <span class="role-alt">(' + UI.esc(altTitle) + ')</span>' : '') + '</h1>';
    if (app.lastVictory) {
      var reason = app.lastVictory.reason;
      if (w === 'DRAW') {
        reason = UI.str('drawReason', state.staleDays);
      }
      if (reason) html += '<p class="muted">' + UI.esc(reason) + '</p>';
      if (app.lastVictory.survivors && app.lastVictory.survivors.length) {
        html += '<p class="muted">' + UI.esc(UI.str('survivingLabel')) + ': ' + app.lastVictory.survivors.map(function (id) {
          return UI.esc(UI.nameOf(state, id));
        }).join(', ') + '</p>';
      }
    }
    html += '</div>';

    if (state.deathLog && state.deathLog.length) {
      var recap = '<ul class="recap-list">';
      state.deathLog.forEach(function (d) {
        recap += '<li><span class="recap-night">' + UI.esc(d.night) + '</span>' +
          '<span class="recap-name">' + UI.esc(d.name) + '</span>' +
          '<span class="recap-cause">' + UI.esc(d.cause) + '</span></li>';
      });
      recap += '</ul>';
      html += UI.card(UI.str('recapTitle'), recap, 'recap', app);
    }

    var reveal = '';
    if (app.endReveal && app.endReveal.length) {
      ['TOWN', 'MAFIA', 'NEUTRAL', 'EVIL'].forEach(function (team) {
        var list = app.endReveal.filter(function (r) { return r.team === team; });
        if (!list.length) return;
        reveal += '<h3 class="end-team-head"><span class="team-dot team-' + team + '"></span>' +
          UI.teamLabel(team) + '</h3>' +
          '<div class="seat-tiles">';
        list.forEach(function (r) {
          var tags = r.isAlive ? '<span class="tag tag-ok">ALIVE</span>' : '<span class="tag tag-ghost">GHOST</span>';
          if (r.inheritedRole) tags += '<span class="tag tag-warn">INHERITED ' + UI.esc(String(r.inheritedRole).toUpperCase()) + '</span>';
          reveal += '<div class="seat-tile team-' + r.team + '">' +
            '<div class="seat-tile-top"><span class="seat-label">' + UI.esc(r.seat) + '</span>' +
            '<span class="seat-name">' + UI.esc(r.name) + '</span></div>' +
            '<div class="seat-role">' + (r.role ? UI.roleNameInline(r.role) : UI.esc(r.roleName || r.role || '')) + '</div>' +
            '<div class="seat-tags">' + tags + '</div></div>';
        });
        reveal += '</div>';
      });
    } else {
      reveal += UI.seatTiles(state, false);
    }
    reveal += '<p class="muted small">' + UI.str('revealNote') + '</p>';
    html += UI.card(UI.str('roleRevealTitle'), reveal, 'end-reveal', app);
    html += '<button class="btn btn-primary btn-block btn-big" data-action="new-game">' + UI.str('newSessionLabel') + '</button>';
    return html;
  };
})();
