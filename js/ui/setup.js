'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI;
  var APP = window.APP;

  function teamSlotCounts(cfg) {
    var ratio = (E.RATIO_TABLE && E.RATIO_TABLE[cfg.playerCount]) || { town: 0, mafia: 0, neutral: 0 };
    return cfg.teamCounts || ratio;
  }

  function townCivilians(cfg, slots, listLen) {
    var civs = cfg.civilians;
    if (civs == null) return Math.max(0, slots - Math.min(listLen, slots));
    return Math.max(0, Math.min(slots, Number(civs) || 0));
  }

  function deckBuilder(cfg) {
    var teams = ['TOWN', 'MAFIA', 'NEUTRAL'];
    var tc = teamSlotCounts(cfg);
    var out = '';
    teams.forEach(function (team) {
      var key = team.toLowerCase();
      var slots = tc[key] || 0;
      var list = cfg.deckConfig[key] || [];
      var isTown = team === 'TOWN';
      var pool = Object.keys(E.ROLES || {}).filter(function (id) {
        var r = E.ROLES[id];
        if (!r || r.team !== team) return false;
        if (isTown && id === 'civilian') return false;
        return list.indexOf(id) === -1;
      });
      var civs = isTown ? townCivilians(cfg, tc.town || 0, list.length) : 0;
      var civMin = isTown && cfg.civilians != null ? Math.max(0, Math.min(tc.town || 0, Number(cfg.civilians) || 0)) : 0;
      var namedLimit = isTown ? Math.max(0, slots - civMin) : slots;
      var full = list.length >= namedLimit;
      out += '<div class="team-edit"><div class="team-edit-head"><span class="team-dot team-' + team + '"></span>' +
        '<strong>' + UI.teamLabel(team) + ' priority</strong><span class="muted small">(top = drawn first)</span>' +
        '<span class="deck-count">' + list.length + '/' + slots + '</span></div>';
      if (!list.length) out += '<p class="muted small">Empty list. ' + (isTown ? 'Slots fill with Civilians.' : 'Slots pad from the preset and role pool.') + '</p>';
      list.forEach(function (rid, i) {
        out += '<div class="team-row"><span class="team-rank">' + (i + 1) + '</span>' +
          '<span class="team-row-name">' + UI.roleNameInline(rid) + '</span>' +
          '<button class="btn btn-icon" data-action="deck-up" data-team="' + team + '" data-index="' + i + '" aria-label="Move up">&#9650;</button>' +
          '<button class="btn btn-icon" data-action="deck-down" data-team="' + team + '" data-index="' + i + '" aria-label="Move down">&#9660;</button>' +
          '<button class="btn btn-icon btn-danger" data-action="deck-remove" data-team="' + team + '" data-index="' + i + '" aria-label="Remove">&#10005;</button>' +
          '<div class="role-blurb">' + UI.esc(UI.roleBlurb(rid)) + '</div></div>';
      });
      if (isTown) {
        out += '<div class="civ-stepper"><span class="muted small">Civilians:</span>' +
          '<button class="btn btn-stepper-sm" data-action="civ-dec" aria-label="Fewer civilians"' + (civs <= 0 ? ' disabled' : '') + '>-</button>' +
          '<div class="civ-stepper-num"><strong>' + civs + '</strong></div>' +
          '<button class="btn btn-stepper-sm" data-action="civ-inc" aria-label="More civilians"' + (civs >= (tc.town || 0) ? ' disabled' : '') + '>+</button>' +
          (cfg.civilians == null ? '<span class="muted small">auto</span>' : '<button class="civ-reset" data-action="civ-reset">Reset to auto</button>') +
          '</div>';
      }
      out += '<div class="team-add"><select id="add-' + team + '" class="select" aria-label="Add role to ' + team + '">' +
        pool.map(function (id) {
          return '<option value="' + UI.esc(id) + '" title="' + UI.esc(UI.roleBlurb(id)) + '">' +
            UI.roleNameInline(id) + '</option>';
        }).join('') +
        '</select>' +
        (full ? '<span data-action="deck-add"><button class="btn btn-add" disabled>Add</button></span>' :
          '<button class="btn btn-add" data-action="deck-add" data-team="' + team + '">Add</button>') +
        '</div></div>';
    });
    return out;
  }

  function deckPreview(cfg) {
    var pre = { town: [], mafia: [], neutral: [] };
    try {
      pre = E.getDeckPreview(E.createGame({
        playerCount: cfg.playerCount,
        presetId: cfg.presetId,
        houseRules: cfg.houseRules,
        town: cfg.deckConfig.town,
        mafia: cfg.deckConfig.mafia,
        neutral: cfg.deckConfig.neutral,
        teamCounts: cfg.teamCounts || undefined,
        civilians: cfg.civilians == null ? undefined : cfg.civilians
      }));
    } catch (e) {
      return '<div class="deck-preview"><p class="muted small">Deck preview</p><p class="muted small">' + UI.esc(e.message) + '</p></div>';
    }
    var out = '<div class="deck-preview"><p class="muted small">Deck preview</p>';
    ['TOWN', 'MAFIA', 'NEUTRAL'].forEach(function (team) {
      var roles = pre[team.toLowerCase()] || [];
      out += '<div class="deck-team"><div class="deck-team-head"><span class="team-dot team-' + team + '"></span><strong>' +
        UI.teamLabel(team) + '</strong><span class="deck-count">' + roles.length + '</span></div><div class="deck-chips">' +
        (roles.length ? roles.map(function (r) {
          return '<span class="deck-chip team-' + team + '">' + UI.roleNameInline(r) + '</span>';
        }).join('') : '<span class="muted small">none</span>') + '</div></div>';
    });
    return out + '</div>';
  }

  UI.renderSetup = function (cfg) {
    var pc = cfg.playerCount;
    var ratio = (E.RATIO_TABLE && E.RATIO_TABLE[pc]) || { town: 0, mafia: 0, neutral: 0 };
    var tc = cfg.teamCounts || ratio;
    var total = tc.town + tc.mafia + tc.neutral;
    var html = '<div class="card"><h2>Players</h2><div class="stepper">' +
      '<button class="btn btn-stepper" data-action="count-dec" aria-label="Fewer players">-</button>' +
      '<div class="stepper-num"><strong>' + pc + '</strong><span>players</span></div>' +
      '<button class="btn btn-stepper" data-action="count-inc" aria-label="More players">+</button></div>' +
      '<div class="ratio">' + pc + ' players: <span class="team-TOWN-text">' + ratio.town + ' Town</span>, ' +
      '<span class="team-MAFIA-text">' + ratio.mafia + ' Mafia</span>, <span class="team-NEUTRAL-text">' + ratio.neutral + ' Neutral</span></div>' +
      '<div class="team-structure"><div class="team-structure-head"><span class="muted small">Team structure (must total ' + pc + ')</span></div>' +
      ['TOWN', 'MAFIA', 'NEUTRAL'].map(function (team) {
        var key = team.toLowerCase(), val = tc[key] || 0;
        return '<div class="team-stepper"><span class="team-dot team-' + team + '"></span><strong class="team-stepper-label">' +
          UI.teamLabel(team) + '</strong><button class="btn btn-stepper-sm" data-action="team-count-dec" data-team="' + team + '"' +
          (val <= 0 ? ' disabled' : '') + ' aria-label="Fewer ' + UI.teamLabel(team) + ' slots">-</button><div class="team-stepper-num"><strong>' +
          val + '</strong></div><button class="btn btn-stepper-sm" data-action="team-count-inc" data-team="' + team + '" aria-label="More ' +
          UI.teamLabel(team) + ' slots">+</button></div>';
      }).join('') + '<div class="ratio">Total: <strong>' + total + '</strong> / ' + pc + ' players</div></div></div>';

    html += '<div class="card"><h2>Scenario</h2><div class="preset-grid">';
    Object.keys(E.PRESETS || {}).forEach(function (id) {
      var p = E.PRESETS[id];
      html += '<button class="preset-card' + (id === cfg.presetId ? ' selected' : '') + '" data-action="preset-select" data-preset="' +
        UI.esc(id) + '"><span class="preset-name">' + UI.esc(p.name) + '</span><span class="preset-tag">' + UI.esc(p.tagline) + '</span></button>';
    });
    html += '</div></div><div class="card"><h2>House Rules</h2>';
    [['noKillN1', 'No Kill on Night One', 'Night kills are void on the first night.'], ['noLynchD1', 'No Lynch on Day One', 'No trial may end in a lynch on day one.'], ['classicReveal', 'Classic Reveal Mode', 'Morning deaths show true roles.']].forEach(function (r) {
      html += '<button class="toggle-row" data-action="rule-toggle" data-rule="' + r[0] + '"><span class="toggle-text"><strong>' + r[1] +
        '</strong><small>' + r[2] + '</small></span><span class="toggle' + (cfg.houseRules[r[0]] ? ' on' : '') + '"><span class="toggle-knob"></span></span></button>';
    });
    html += '</div><div class="card"><h2>Seat Layout</h2><div class="layout-grid">';
    (E.SEAT_LAYOUTS || ['circle']).forEach(function (l) {
      html += '<button class="layout-card' + (l === cfg.layout ? ' selected' : '') + '" data-action="layout-select" data-layout="' + UI.esc(l) +
        '"><span class="layout-icon layout-icon-' + UI.esc(l) + '"></span><span>' + ({ circle: 'Circle', u_shape: 'U Shape' }[l] || l) + '</span></button>';
    });
    html += '</div></div><div class="card"><h2>Deck Builder</h2><p class="muted small">Edit each team priority list, then check the live deck preview.</p>' +
      deckBuilder(cfg) + deckPreview(cfg) + '</div>';
    if (total !== pc) html += '<div class="notice bad">Team totals (' + total + ') must equal ' + pc + ' players.</div>';
    return html + '<button class="btn btn-primary btn-block btn-big" data-action="start-game">Start Session</button>';
  };
})();
