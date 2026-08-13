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
    var order = ['PREP', 'DAY', 'NIGHT', 'MORNING', 'END'];
    var labels = { PREP: 'Prep', DAY: 'Day', NIGHT: 'Night', MORNING: 'Morning', END: 'End' };
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

  function seatTiles(state, rolesHidden, cfg, tappable) {
    var n = (state.players || []).length;
    var html = cfg ? seatLayoutOpen(cfg, n) : '<div class="seat-tiles">';
    if (tappable === undefined) tappable = !!cfg;
    playersBySeat(state.players).forEach(function (p) {
      var team = teamOf(p.assignedRole);
      var roleTxt = rolesHidden ? '&#8226;&#8226;&#8226;' : roleName(p.assignedRole);
      var clickable = tappable
        ? ' data-action="open-detail-sheet" data-seat="' + esc(p.seat) + '"'
        : '';
      var tile = '<div class="seat-tile team-' + team + '"' + clickable + '>' +
        '<div class="seat-tile-top"><span class="seat-label">' + esc(p.seat) + '</span>' +
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

  function seatLayoutOpen(cfg, n) {
    if (cfg.layout === 'circle') {
      var w = Math.max(72, Math.min(90, 90 - (n - 6) * 2));
      return '<div class="circle" style="--tile-w:' + w + 'px">';
    }
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

  var toastQueue = [];
  var toastTimer = null;

  function toastNext() {
    if (!toastQueue.length) return;
    var item = toastQueue.shift();
    var t = document.getElementById('toast');
    t.textContent = item.msg;
    t.classList.remove('toast-success', 'toast-warn', 'toast-error');
    if (item.kind === 'success' || item.kind === 'warn' || item.kind === 'error') {
      t.classList.add('toast-' + item.kind);
    }
    t.classList.add('show');
    toastTimer = setTimeout(function () {
      t.classList.remove('show');
      toastNext();
    }, 2600);
  }

  function toast(msg, kind) {
    toastQueue.push({ msg: msg, kind: kind });
    if (document.getElementById('toast').classList.contains('show')) return;
    toastNext();
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

  UI.renderWhispers = function (state, app) {
    var html = '<div class="panel-backdrop" data-action="toggle-whispers"></div>';
    html += '<div class="whispers-panel panel-overlay" id="whispers-panel" role="dialog" aria-label="Tonight\'s whispers">';
    html += '<div class="panel-head"><h2>Tonight\'s Whispers</h2>' +
      '<button class="btn btn-icon" data-action="toggle-whispers" aria-label="Close">&times;</button></div>';
    html += '<p class="muted small">Relay to the player before they wake. Info never shows in-game otherwise.</p>';
    var found = false;
    playersBySeat(state.players).forEach(function (p) {
      var log = (state.playerLog && state.playerLog[String(p.id)]) || [];
      var infos = log.filter(function (e) { return e.kind === 'info'; });
      if (!infos.length) return;
      found = true;
      html += '<div class="whisper-group"><div class="whisper-actor">' + esc(p.name) + '</div>';
      for (var i = infos.length - 1; i >= 0; i -= 1) {
        html += '<div class="whisper-entry"><span class="tag tag-accent">' + esc(infos[i].at) + '</span>' +
          '<span class="whisper-text">' + esc(infos[i].text) + '</span></div>';
      }
      html += '</div>';
    });
    if (!found) html += '<p class="muted">No night info yet.</p>';
    html += '</div>';
    return html;
  };

  UI.renderClaimsPanel = function (state, cfg, app) {
    var claims = (app && app.claims) || {};
    var html = '<div class="panel-backdrop" data-action="toggle-claims"></div>';
    html += '<div class="claims-panel panel-overlay" role="dialog" aria-label="Public claims">';
    html += '<div class="panel-head"><h2>Public Claims</h2>' +
      '<button class="btn btn-icon" data-action="toggle-claims" aria-label="Close">&times;</button></div>';
    playersBySeat(state.players).forEach(function (p) {
      if (!p.isAlive) return;
      var claimed = claims[String(p.seat)];
      html += '<button class="claim-row" data-action="claim-open" data-seat="' + esc(p.seat) + '">' +
        '<span class="claim-name">' + esc(p.name) + '</span>' +
        '<span class="claim-chip' + (claimed ? ' on' : '') + '">' +
        (claimed ? roleName(claimed) : 'No claim') + '</span></button>';
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
      var ta = order[teamOf(a)] != null ? order[teamOf(a)] : 3;
      var tb = order[teamOf(b)] != null ? order[teamOf(b)] : 3;
      if (ta !== tb) return ta - tb;
      var na = roleName(a).toLowerCase();
      var nb = roleName(b).toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    }).forEach(function (id) {
      var t = teamOf(id);
      if (t !== lastTeam) {
        html += '<div class="claim-team-head">' + teamLabel(t) + '</div>';
        lastTeam = t;
      }
      html += '<button class="claim-role-btn btn btn-sm' + (claims[String(seat)] === id ? ' on' : '') + '"' +
        ' data-action="' + action + '" data-seat="' + esc(seat) + '" data-role="' + esc(id) + '">' +
        '<span class="team-dot team-' + t + '"></span>' + roleName(id) + '</button>';
    });
    return html;
  };

  UI.renderClaimRound = function (state, app) {
    var cr = app && app.claimRound;
    if (!cr || !cr.active) return '';
    if (state.phase !== 'DAY' || (state.dayNumber || 1) !== 1) return '';
    var livingP = playersBySeat(living(state.players));
    if (!livingP.length) return '';
    var claims = (app && app.claims) || {};
    var html = '<div class="card claim-round-card"><div class="card-head"><h2>Claim Round</h2>' +
      '<span class="muted small">Day 1 \u00B7 public claims</span></div>';
    if (cr.picker != null) {
      var ep = null;
      livingP.forEach(function (p) {
        if (String(p.seat) === String(cr.picker)) ep = p;
      });
      if (!ep) {
        cr.picker = null;
        return UI.renderClaimRound(state, app);
      }
      html += '<p class="wizard-label">Claim for ' + esc(ep.name) + ' (seat ' + esc(ep.seat) + ')</p>' +
        '<p class="muted small">Moderator-only role: ' + roleName(ep.assignedRole) + '</p>' +
        UI.claimRoleButtons(state, app, cr.picker, 'claim-round-pick') +
        '<button class="btn btn-block" data-action="claim-round-cancel">Cancel</button>';
    } else if (cr.idx < livingP.length) {
      var cur = livingP[cr.idx];
      var has = claims[String(cur.seat)];
      html += '<p class="muted small">Player ' + (cr.idx + 1) + ' of ' + livingP.length + '</p>' +
        '<div class="claim-round-player"><span class="seat-label">' + esc(cur.seat) + '</span>' +
        '<span class="claim-name">' + esc(cur.name) + '</span>' +
        '<span class="muted small">(' + roleName(cur.assignedRole) + ')</span></div>' +
        '<p class="muted small">' + (has ? 'Currently claiming: <strong>' + roleName(has) + '</strong>' : 'No claim yet.') + '</p>' +
        '<button class="btn btn-primary btn-block" data-action="claim-round-open">' +
        (has ? 'Change claim\u2026' : 'Claim\u2026') + '</button>';
    } else {
      html += '<p class="muted small">All claims recorded. Tap a claim to edit.</p>';
      livingP.forEach(function (p) {
        var c = claims[String(p.seat)];
        html += '<button class="claim-row" data-action="claim-round-edit" data-seat="' + esc(p.seat) + '">' +
          '<span class="claim-name">' + esc(p.name) + '</span>' +
          '<span class="claim-chip' + (c ? ' on' : '') + '">' + (c ? roleName(c) : 'No claim') + '</span></button>';
      });
      html += '<button class="btn btn-primary btn-block" data-action="claim-round-done">Done</button>';
    }
    html += '</div>';
    return html;
  };

  UI.freshInfoEntries = function (state, nightNum) {
    var key = 'N' + (nightNum || 0);
    var out = [];
    playersBySeat(state.players).forEach(function (p) {
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
    var html = '<div class="card whisper-results"><div class="card-head"><h2>Whisper Results</h2>' +
      '<span class="muted small">Night ' + (nightNum || 1) + '</span></div>';
    rows.forEach(function (r) {
      r.entries.forEach(function (e) {
        var done = !!relayed['N' + nightNum + ':' + r.player.id];
        var inverted = !!(r.player.isDrunk && r.player.assignedRole === 'consigliere');
        html += '<div class="notice info">' +
          '<strong>' + esc(r.player.name) + '</strong> <span class="whisper-text">' + esc(e.text) + '</span>' +
          (inverted ? ' <span class="tag tag-bad">INVERTED</span>' : '') +
          (done
            ? '<span class="tag tag-ok">RELAYED</span>'
            : '<button class="btn btn-sm" data-action="whisper-done" data-player="' + esc(r.player.id) +
              '" data-night="' + (nightNum || 1) + '">\uD83D\uDD0A Whisper done</button>') +
          '</div>';
      });
    });
    html += '</div>';
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
    html += '<div class="seat-sheet-head"><div><h3>Claim for ' + esc(p.name) + '</h3>' +
      '<div class="seat-sheet-current">' + (claims[String(seat)] ? 'Currently: <strong>' +
      roleName(claims[String(seat)]) + '</strong>' : 'No claim yet') + '</div></div>' +
      '<button class="btn btn-icon" data-action="claim-close" aria-label="Close">&times;</button></div>';
    html += UI.claimRoleButtons(state, app, seat, 'claim-pick');
    html += '<div class="seat-sheet-footer">' +
      (claims[String(seat)] ? '<button class="btn btn-danger" data-action="claim-clear" data-seat="' +
        esc(seat) + '">Clear</button>' : '') +
      '<button class="btn" data-action="claim-close">Cancel</button></div>';
    html += '</div>';
    return html;
  };

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
