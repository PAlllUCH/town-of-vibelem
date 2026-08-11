'use strict';

(function () {
  var UI = window.UI;

  UI.renderEnd = function (state, cfg, app) {
    var html = '';
    var w = state.winner;
    var labels = {
      TOWN: 'The Town Wins',
      MAFIA: 'The Mafia Wins',
      'SERIAL KILLER': 'The Serial Killer Wins',
      SERIAL_KILLER: 'The Serial Killer Wins',
      SK: 'The Serial Killer Wins',
      JESTER: 'The Jester Wins',
      EXECUTIONER: 'The Executioner Wins',
      WITCH: 'The Witch Wins',
      SURVIVOR: 'The Survivor Wins'
    };
    var title = labels[w] || (w ? String(w) + ' Wins' : 'Session Over');
    html += '<div class="end-banner"><h1>' + UI.esc(title) + '</h1>';
    if (app.lastVictory) {
      if (app.lastVictory.reason) html += '<p class="muted">' + UI.esc(app.lastVictory.reason) + '</p>';
      if (app.lastVictory.survivors && app.lastVictory.survivors.length) {
        html += '<p class="muted">Surviving: ' + app.lastVictory.survivors.map(function (id) {
          return UI.esc(UI.nameOf(state, id));
        }).join(', ') + '</p>';
      }
    }
    html += '</div>';

    if (state.deathLog && state.deathLog.length) {
      html += '<div class="card"><div class="card-head"><h2>Session Recap</h2></div><ul class="recap-list">';
      state.deathLog.forEach(function (d) {
        html += '<li><span class="recap-night">' + UI.esc(d.night) + '</span>' +
          '<span class="recap-name">' + UI.esc(d.name) + '</span>' +
          '<span class="recap-cause">' + UI.esc(d.cause) + '</span></li>';
      });
      html += '</ul></div>';
    }

    html += '<div class="card"><div class="card-head"><h2>Role Reveal</h2></div>';
    if (app.endReveal && app.endReveal.length) {
      html += '<div class="seat-tiles">';
      app.endReveal.forEach(function (r) {
        var tags = r.isAlive ? '<span class="tag tag-ok">ALIVE</span>' : '<span class="tag tag-ghost">GHOST</span>';
        if (r.inheritedRole) tags += '<span class="tag tag-warn">INHERITED SHERIFF</span>';
        html += '<div class="seat-tile team-' + r.team + '">' +
          '<div class="seat-tile-top"><span class="seat-label">' + r.seat + '</span>' +
          '<span class="seat-name">' + UI.esc(r.name) + '</span></div>' +
          '<div class="seat-role">' + UI.esc(r.roleName || r.role) + '</div>' +
          '<div class="seat-tags">' + tags + '</div></div>';
      });
      html += '</div>';
    } else {
      html += UI.seatTiles(state, false);
    }
    html += '<p class="muted small">Mystery deaths and Janitor cleaning are void: true roles are shown for everyone.</p></div>';
    html += '<button class="btn btn-primary btn-block btn-big" data-action="new-game">New Session</button>';
    return html;
  };
})();
