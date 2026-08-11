'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function roleName(id) {
    var r = E.ROLES && E.ROLES[id];
    return r && r.name ? esc(r.name) : esc(id);
  }

  function teamOf(id) {
    var r = E.ROLES && E.ROLES[id];
    return r && r.team ? r.team : 'TOWN';
  }

  function teamLabel(t) {
    return { TOWN: 'Town', MAFIA: 'Mafia', NEUTRAL: 'Neutral' }[t] || t;
  }

  function playersBySeat(players) {
    var list = (players || []).slice();
    list.sort(function (a, b) { return (a.seat || 0) - (b.seat || 0); });
    return list;
  }

  function living(players) {
    return (players || []).filter(function (p) { return p.isAlive; });
  }

  function dead(players) {
    return (players || []).filter(function (p) { return !p.isAlive; });
  }

  function findPlayer(state, id) {
    var out = null;
    (state.players || []).forEach(function (p) {
      if (String(p.id) === String(id)) out = p;
    });
    return out;
  }

  function nameOf(state, id) {
    var p = findPlayer(state, id);
    if (p) return p.name;
    var g = null;
    (state.graveyard || []).forEach(function (x) {
      if (String(x.playerId) === String(id)) g = x;
    });
    return g ? g.name : id;
  }

  function statusTags(p) {
    var tags = [];
    if (p.isAlive) tags.push(['ALIVE', 'ok']);
    else tags.push(['GHOST', 'ghost']);
    if (p.isDrunk) tags.push(['DRUNK', 'warn']);
    if (p.inheritedRole) tags.push(['INHERITED SHERIFF', 'warn']);
    if (p.jailed) tags.push(['JAILED', 'warn']);
    if (p.isProtected) tags.push(['PROTECTED', 'ok']);
    if (p.poisoned) tags.push(['POISONED', 'warn']);
    if (p.alerted) tags.push(['ALERT', 'accent']);
    if (p.revealed) tags.push(['REVEALED', 'accent']);
    if (p.cleaned) tags.push(['CLEANED', 'bad']);
    if (p.blackmailed) tags.push(['BLACKMAILED', 'bad']);
    return tags.map(function (t) {
      return '<span class="tag tag-' + t[1] + '">' + t[0] + '</span>';
    }).join('');
  }

  function flowStrip(phase) {
    var order = ['NIGHT', 'MORNING', 'DAY', 'END'];
    var labels = { NIGHT: 'Night', MORNING: 'Morning', DAY: 'Day', END: 'End' };
    var cur = order.indexOf(phase);
    if (cur === -1 && (phase === 'SEATS' || phase === 'SETUP')) cur = 0;
    var html = '<div class="flow">';
    order.forEach(function (s, i) {
      var cls = i === cur ? ' on' : (cur > -1 && i < cur ? ' done' : '');
      html += '<div class="flow-step' + cls + '">' +
        '<span class="flow-dot"></span><span class="flow-label">' + labels[s] + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  function seatTiles(state, rolesHidden, cfg) {
    var n = (state.players || []).length;
    var html = cfg ? seatLayoutOpen(cfg) : '<div class="seat-tiles">';
    playersBySeat(state.players).forEach(function (p) {
      var team = teamOf(p.assignedRole);
      var roleTxt = rolesHidden ? '&#8226;&#8226;&#8226;' : roleName(p.assignedRole);
      var tile = '<div class="seat-tile team-' + team + '">' +
        '<div class="seat-tile-top"><span class="seat-label">' + p.seat + '</span>' +
        '<span class="seat-name">' + esc(p.name) + '</span></div>' +
        '<div class="seat-role">' + roleTxt + '</div>' +
        '<div class="seat-tags">' + statusTags(p) + '</div></div>';
      html += cfg
        ? '<div class="seat-tile-wrap"' + seatPosAttr(cfg, p.seat, n) + '>' + tile + '</div>'
        : tile;
    });
    html += cfg ? seatLayoutClose() : '</div>';
    return html;
  }

  function seatLayoutOpen(cfg) {
    if (cfg.layout === 'circle') return '<div class="circle">';
    return '<div class="seat-grid layout-' + esc(cfg.layout) + '">';
  }

  function seatLayoutClose() {
    return '</div>';
  }

  function seatPosAttr(cfg, seat, n) {
    if (cfg.layout !== 'circle') return '';
    var ang = ((seat - 1) / n) * 2 * Math.PI - Math.PI / 2;
    var x = Math.max(12, Math.min(88, 50 + 45 * Math.cos(ang)));
    var y = Math.max(12, Math.min(88, 50 + 45 * Math.sin(ang)));
    return ' style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%"';
  }

  var toastTimer = null;

  function toast(msg, kind) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    if (kind === 'success' || kind === 'warn' || kind === 'error') {
      t.classList.remove('toast-success', 'toast-warn', 'toast-error');
      t.classList.add('toast-' + kind);
    }
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function leftoverRoles(state, picks) {
    var counts = {};
    (state.deck || []).forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(picks || {}).forEach(function (seat) {
      var id = picks[seat];
      if (id && counts[id] != null) counts[id] = Math.max(0, counts[id] - 1);
    });
    var out = [];
    Object.keys(counts).forEach(function (id) {
      for (var c = 0; c < counts[id]; c += 1) out.push(id);
    });
    return out;
  }

  UI.esc = esc;
  UI.roleName = roleName;
  UI.teamOf = teamOf;
  UI.teamLabel = teamLabel;
  UI.playersBySeat = playersBySeat;
  UI.living = living;
  UI.dead = dead;
  UI.findPlayer = findPlayer;
  UI.nameOf = nameOf;
  UI.statusTags = statusTags;
  UI.flowStrip = flowStrip;
  UI.seatTiles = seatTiles;
  UI.seatLayoutOpen = seatLayoutOpen;
  UI.seatLayoutClose = seatLayoutClose;
  UI.seatPosAttr = seatPosAttr;
  UI.leftoverRoles = leftoverRoles;
  UI.toast = toast;

  window.UI = UI;
})();
