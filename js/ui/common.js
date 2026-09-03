'use strict';

(function () {
  var E = window.VillageEngine || {};
  var APP = window.APP;
  var UI = {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function roleName(id, locale) {
    var r = E.ROLES && E.ROLES[id];
    if (typeof E.roleName === 'function') return esc(E.roleName(id, locale || (APP && APP.locale)));
    return r && r.name ? esc(r.name) : esc(id);
  }

  function roleNameInline(id) {
    var locale = APP && APP.locale || E.locale || 'en';
    var primary = roleName(id, locale);
    var secondary = roleName(id, locale.toLowerCase() === 'pl' ? 'en' : 'pl');
    return primary === secondary ? primary : primary + ' <span class="role-alt">(' + secondary + ')</span>';
  }

  function roleBlurb(id, locale) {
    var r = E.ROLES && E.ROLES[id];
    if (typeof E.roleBlurb === 'function') return E.roleBlurb(id, locale || (APP && APP.locale)) || '';
    return r && r.blurb ? r.blurb : '';
  }

  function str(key) {
    var a = typeof window !== 'undefined' ? window.APP : null;
    var loc = (a && a.locale) || 'en';
    if (typeof E.str === 'function') {
      return E.str.apply(null, [key, loc].concat(Array.prototype.slice.call(arguments, 1)));
    }
    return key;
  }

  function teamOf(id) {
    var r = E.ROLES && E.ROLES[id];
    return r && r.team ? r.team : 'TOWN';
  }

  function teamLabel(t) {
    var names = { TOWN: 'teamTown', MAFIA: 'teamMafia', NEUTRAL: 'teamNeutral', EVIL: 'teamEvil' };
    return names[t] ? str(names[t]) : t;
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
    if (p.inheritedRole) tags.push([esc('INHERITED ' + String(p.inheritedRole).toUpperCase()), 'warn']);
    if (p.jailed) tags.push(['JAILED', 'warn']);
    if (p.isProtected) tags.push(['PROTECTED', 'ok']);
    if (p.poisoned) tags.push(['POISONED', 'warn']);
    if (p.alerted) tags.push(['ALERT', 'accent']);
    if (p.revealed) tags.push(['REVEALED', 'accent']);
    if (p.cleaned) tags.push(['CLEANED', 'bad']);
    if (p.blackmailed) tags.push(['BLACKMAILED', 'bad']);
    if (p.enchanted) tags.push(['ENCHANTED', 'bad']);
    return tags.map(function (t) {
      return '<span class="tag tag-' + t[1] + '">' + t[0] + '</span>';
    }).join('');
  }

  function flowStrip(phase) {
    var order = ['PREP', 'DAY', 'NIGHT', 'MORNING', 'END'];
    var labels = {
      PREP: str('phasePrep'), DAY: str('phaseDay'), NIGHT: str('phaseNight'),
      MORNING: str('phaseMorning'), END: str('phaseOver')
    };
    var cur = order.indexOf(phase);
    if (cur === -1 && (phase === 'SEATS' || phase === 'SETUP')) cur = 0;
    var html = '<div class="flow">';
    order.forEach(function (s, i) {
      var cls = i === cur ? ' on' : (cur > -1 && i < cur ? ' done' : '');
      html += '<div class="flow-step' + cls + '"><span class="flow-dot"></span><span class="flow-label">' +
        labels[s] + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  function seatTiles(state, rolesHidden, cfg, tappable, claims) {
    var n = (state.players || []).length;
    var html = cfg ? seatLayoutOpen(cfg, n) : '<div class="seat-tiles">';
    if (tappable === undefined) tappable = !!cfg;
    playersBySeat(state.players).forEach(function (p) {
      var team = teamOf(p.assignedRole);
      var roleTxt = rolesHidden ? '&#8226;&#8226;&#8226;' : roleNameInline(p.assignedRole);
      var clickable = tappable ? ' data-action="open-detail-sheet" data-seat="' + esc(p.seat) + '"' : '';
      var claimTxt = '';
      if (claims) {
        var c = claims[String(p.seat)];
        claimTxt = '<div class="seat-claim"><span class="claim-chip' + (c ? ' on' : '') + '">' +
          (c ? roleName(c) : str('noClaim')) + '</span></div>';
      }
      var tile = '<div class="seat-tile team-' + team + '"' + clickable + '>' +
        '<div class="seat-tile-top"><span class="seat-label">' + esc(p.seat) + '</span>' +
        '<span class="seat-name">' + esc(p.name) + '</span></div>' +
        '<div class="seat-role">' + roleTxt + '</div>' + claimTxt +
        '<div class="seat-tags">' + statusTags(p) + '</div></div>';
      html += cfg ? '<div class="seat-tile-wrap"' + seatPosAttr(cfg, p.seat, n) + '>' + tile + '</div>' : tile;
    });
    html += cfg ? seatLayoutClose() : '</div>';
    return html;
  }

  function seatLayoutOpen(cfg, n) {
    if (cfg.layout === 'circle') {
      var chord = 0.78 * Math.sin(Math.PI / n);
      var w = Math.max(96, Math.min(600, Math.round(1720 * chord)));
      var cap = Math.max(24, Math.min(100, Math.round(400 * chord)));
      return '<div class="circle" style="--tile-w:' + w + 'px;--tile-cap:' + cap + '%">';
    }
    return '<div class="seat-grid layout-' + esc(cfg.layout) + '">';
  }

  function seatLayoutClose() { return '</div>'; }

  function seatPosAttr(cfg, seat, n) {
    if (cfg.layout !== 'circle') return '';
    var ang = ((seat - 1) / n) * 2 * Math.PI - Math.PI / 2;
    var x = Math.max(12, Math.min(88, 50 + 45 * Math.cos(ang)));
    var y = Math.max(12, Math.min(88, 50 + 45 * Math.sin(ang)));
    return ' style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%"';
  }

  function localeToggleButton() {
    var locale = (APP && APP.locale || E.locale || 'en').toLowerCase();
    var pl = locale === 'pl';
    var opt = function (label, on) {
      return '<span class="locale-opt' + (on ? ' on' : '') + '">' + label + '</span>';
    };
    var first = opt('PL', pl);
    var second = opt('EN', !pl);
    if (!pl) { first = opt('EN', true); second = opt('PL', false); }
    return '<button type="button" class="locale-toggle" data-action="toggle-locale" aria-label="Change language">' +
      first + '<span class="locale-sep">|</span>' + second + '</button>';
  }

  var toastQueue = [];
  var toastTimer = null;
  var toastAction = null;

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    document.getElementById('toast').classList.remove('show');
    toastAction = null;
  }

  function toastNext() {
    if (!toastQueue.length) return;
    var item = toastQueue.shift();
    var t = document.getElementById('toast');
    t.textContent = item.msg;
    t.classList.remove('toast-success', 'toast-warn', 'toast-error');
    if (item.kind === 'success' || item.kind === 'warn' || item.kind === 'error') t.classList.add('toast-' + item.kind);
    if (item.action && typeof item.action.run === 'function') {
      t.textContent = '';
      t.innerHTML = '<span class="toast-msg">' + esc(item.msg) + '</span>' +
        '<button type="button" class="btn btn-sm btn-toast-undo" data-toast-action="undo">' +
        esc(item.action.label) + '</button>';
      toastAction = item.action;
    }
    t.classList.add('show');
    toastTimer = setTimeout(function () {
      toastAction = null;
      t.classList.remove('show');
      toastNext();
    }, 2600);
  }

  function toast(msg, kind, action) {
    toastQueue.push({ msg: msg, kind: kind, action: action });
    if (document.getElementById('toast').classList.contains('show')) return;
    toastNext();
  }

  var saveBannerDismissed = false;

  function dismissSaveWarning() {
    saveBannerDismissed = true;
    var b = document.getElementById('save-warning');
    if (!b) return;
    if (typeof b.remove === 'function') { b.remove(); return; }
    if (b.parentNode && typeof b.parentNode.removeChild === 'function') b.parentNode.removeChild(b);
  }

  function showSaveWarning() {
    if (saveBannerDismissed) return;
    var b = document.getElementById('save-warning');
    if (b && b.innerHTML) return;
    if (!b) {
      var host = document.body;
      if (!host || typeof host.appendChild !== 'function') return;
      b = document.createElement('div');
      b.id = 'save-warning';
      host.appendChild(b);
    }
    b.setAttribute('role', 'alert');
    b.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);bottom:76px;z-index:60;' +
      'display:flex;gap:12px;align-items:center;padding:10px 14px;background:var(--bg-near);' +
      'color:var(--warn);border:1px solid var(--warn);border-radius:10px;font-size:14px;');
    b.innerHTML =
      '<span class="save-warning-msg">Progress may not be saved.</span>' +
      '<button type="button" class="btn btn-sm" data-action="dismiss-save-warning">Dismiss</button>';
    if (typeof b.addEventListener !== 'function') return;
    b.addEventListener('click', function (ev) {
      var t = ev && ev.target;
      while (t && t !== b) {
        if (t.getAttribute && t.getAttribute('data-action') === 'dismiss-save-warning') {
          dismissSaveWarning();
          return;
        }
        t = t.parentNode;
      }
    });
  }

  function card(title, body, key, app) {
    var collapsed = !!(app && app.collapsed && app.collapsed[key]);
    return '<div class="card card-collapsible' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="card-head"><h2>' + title + '</h2><button class="btn btn-sm btn-collapse" data-action="toggle-card" data-card="' +
      esc(key) + '" aria-expanded="' + (collapsed ? 'false' : 'true') + '" aria-controls="card-body-' + esc(key) + '">' +
      (collapsed ? '+' : '-') + '</button></div><div class="card-body" id="card-body-' + esc(key) + '">' + body + '</div></div>';
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
  UI.str = str;
  UI.roleName = roleName;
  UI.roleNameInline = roleNameInline;
  UI.roleBlurb = roleBlurb;
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
  UI.localeToggleButton = localeToggleButton;
  UI.leftoverRoles = leftoverRoles;
  UI.card = card;
  UI.toast = toast;
  UI.showSaveWarning = showSaveWarning;
  UI.dismissSaveWarning = dismissSaveWarning;

  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-action="toggle-locale"]') : null;
      if (el && window.APP && typeof window.APP.toggleLocale === 'function') {
        ev.preventDefault();
        window.APP.toggleLocale();
      }
    });
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-toast-action="undo"]') : null;
      if (!el || !toastAction) return;
      var act = toastAction;
      hideToast();
      act.run();
      toastNext();
    });
  }

  window.UI = UI;
})();
