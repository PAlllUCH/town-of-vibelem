'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;

  UI.renderTokens = function (state, app) {
    var html = '<div class="panel-backdrop" data-action="toggle-tokens"></div>';
    html += '<div class="whispers-panel panel-overlay" id="whispers-panel" role="dialog" aria-label="Info tokens to relay">';
    html += '<div class="panel-head"><h2>Info Tokens</h2>' +
      '<button class="btn btn-icon" data-action="toggle-tokens" aria-label="Close">&times;</button></div>';
    html += '<p class="muted small">Show the token to the player before they wake. Info never shows in-game otherwise.</p>';
    var found = false;
    UI.playersBySeat(state.players).forEach(function (p) {
      var log = (state.playerLog && state.playerLog[String(p.id)]) || [];
      var infos = log.filter(function (e) { return e.kind === 'info'; });
      if (!infos.length) return;
      found = true;
      html += '<div class="whisper-group"><div class="whisper-actor">' + UI.esc(p.name) + '</div>';
      for (var i = infos.length - 1; i >= 0; i -= 1) {
        html += '<div class="whisper-entry"><span class="tag tag-accent">' + UI.esc(infos[i].at) + '</span>' +
          '<span class="whisper-text">' + UI.esc(infos[i].text) + '</span></div>';
      }
      html += '</div>';
    });
    if (!found) html += '<p class="muted">No night info yet.</p>';
    html += '</div>';
    return html;
  };

  UI.renderModPanel = function (state, app) {
    var gy = state.graveyard || [];
    var last = gy.length ? gy[gy.length - 1] : null;
    var html = '<div class="panel-backdrop" data-action="toggle-mod"></div>';
    html += '<div class="panel-overlay" role="dialog" aria-label="Moderator">';
    html += '<div class="panel-head"><h2>Moderator</h2>' +
      '<button class="btn btn-icon" data-action="toggle-mod" aria-label="Close">&times;</button></div>';
    html += '<div class="btn-col">' +
      '<button class="btn" data-action="kill-player">Kill Player</button>' +
      '<button class="btn" data-action="undo-kill"' + (last ? '' : ' disabled') + '>Undo Last Kill' +
      (last ? ' (' + UI.esc(last.name) + ')' : '') + '</button></div>';
    html += '<p class="muted small">Kills and undos are moderator overrides for when the app does not predict something.</p>';
    html += '</div>';
    return html;
  };

  UI.freshInfoEntries = function (state, nightNum) {
    var key = 'N' + (nightNum || 0);
    var out = [];
    UI.playersBySeat(state.players).forEach(function (p) {
      var entries = ((state.playerLog && state.playerLog[String(p.id)]) || [])
        .filter(function (e) { return e.kind === 'info' && e.at === key; });
      if (entries.length) out.push({ player: p, entries: entries });
    });
    return out;
  };

  UI.whisperResultCard = function (state, app, nightNum, filterPids) {
    var relayed = (app && app.relayedWhispers) || {};
    var rows = UI.freshInfoEntries(state, nightNum).filter(function (r) {
      return !filterPids || filterPids.some(function (pid) { return String(pid) === String(r.player.id); });
    });
    if (!rows.length) return '';
    var html = '<div class="card whisper-results"><div class="card-head"><h2>Info to Show</h2>' +
      '<span class="muted small">Night ' + (nightNum || 1) + '</span></div>';
    rows.forEach(function (r) {
      r.entries.forEach(function (e) {
        var done = !!relayed['N' + nightNum + ':' + r.player.id];
        var inverted = !!(r.player.isDrunk && r.player.assignedRole === 'consigliere');
        html += '<div class="notice info">' +
          '<strong>' + UI.esc(r.player.name) + '</strong> <span class="whisper-text">' + UI.esc(e.text) + '</span>' +
          (inverted ? ' <span class="tag tag-bad">INVERTED</span>' : '') +
          (done
            ? '<span class="tag tag-ok">RELAYED</span>'
            : '<button class="btn btn-sm" data-action="token-shown" data-player="' + UI.esc(r.player.id) +
              '" data-night="' + (nightNum || 1) + '">Token shown</button>') +
          '</div>';
      });
    });
    html += '</div>';
    return html;
  };
})();
