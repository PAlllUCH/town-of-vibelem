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
        if (!r) return false;
        if (team === 'NEUTRAL') {
          if (r.team !== 'NEUTRAL' && r.team !== 'EVIL') return false;
        } else if (r.team !== team) return false;
        if (isTown && id === 'civilian') return false;
        return list.indexOf(id) === -1;
      });
      var civs = isTown ? townCivilians(cfg, tc.town || 0, list.length) : 0;
      var civMin = isTown && cfg.civilians != null ? Math.max(0, Math.min(tc.town || 0, Number(cfg.civilians) || 0)) : 0;
      var namedLimit = isTown ? Math.max(0, slots - civMin) : slots;
      var full = list.length >= namedLimit;
      out += '<div class="team-edit"><div class="team-edit-head"><span class="team-dot team-' + team + '"></span>' +
        '<strong>' + UI.teamLabel(team) + ' ' + UI.str('priorityLabel') + '</strong><span class="muted small">' + UI.str('topDrawnHint') + '</span>' +
        '<span class="deck-count">' + list.length + '/' + slots + '</span></div>';
      if (!list.length) out += '<p class="muted small">' + (isTown ? UI.str('emptyTownList') : UI.str('emptyPaddedList')) + '</p>';
      list.forEach(function (rid, i) {
        out += '<div class="team-row"><span class="team-rank">' + (i + 1) + '</span>' +
          '<span class="team-row-name">' + UI.roleNameInline(rid) + '</span>' +
          '<button class="btn btn-icon" data-action="deck-up" data-team="' + team + '" data-index="' + i + '" aria-label="Move up">&#9650;</button>' +
          '<button class="btn btn-icon" data-action="deck-down" data-team="' + team + '" data-index="' + i + '" aria-label="Move down">&#9660;</button>' +
          '<button class="btn btn-icon btn-danger" data-action="deck-remove" data-team="' + team + '" data-index="' + i + '" aria-label="Remove">&#10005;</button>' +
          '<div class="role-blurb">' + UI.esc(UI.roleBlurb(rid)) + '</div></div>';
      });
      if (isTown) {
        out += '<div class="civ-stepper"><span class="muted small">' + UI.str('civiliansLabel') + '</span>' +
          '<button class="btn btn-stepper-sm" data-action="civ-dec" aria-label="Fewer civilians"' + (civs <= 0 ? ' disabled' : '') + '>-</button>' +
          '<div class="civ-stepper-num"><strong>' + civs + '</strong></div>' +
          '<button class="btn btn-stepper-sm" data-action="civ-inc" aria-label="More civilians"' + (civs >= (tc.town || 0) ? ' disabled' : '') + '>+</button>' +
          (cfg.civilians == null ? '<span class="muted small">' + UI.str('autoLabel') + '</span>' : '<button class="civ-reset" data-action="civ-reset">' + UI.str('resetToAuto') + '</button>') +
          '</div>';
      }
      out += '<div class="team-add"><select id="add-' + team + '" class="select" aria-label="Add role to ' + team + '">' +
        pool.map(function (id) {
          var evilPick = E.ROLES[id] && E.ROLES[id].team === 'EVIL';
          return '<option value="' + UI.esc(id) + '" title="' + UI.esc(UI.roleBlurb(id)) + '">' +
            UI.roleNameInline(id) + (evilPick ? ' \u00b7 Evil' : '') + '</option>';
        }).join('') +
        '</select>' +
        (full ? '<span data-action="deck-add"><button class="btn btn-add" disabled>' + UI.str('addVerb') + '</button></span>' :
          '<button class="btn btn-add" data-action="deck-add" data-team="' + team + '">' + UI.str('addVerb') + '</button>') +
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
        evil: cfg.deckConfig.evil,
        teamCounts: cfg.teamCounts || undefined,
        civilians: cfg.civilians == null ? undefined : cfg.civilians
      }));
    } catch (e) {
      return '<div class="deck-preview"><p class="muted small">' + UI.str('deckPreviewLabel') + '</p><p class="muted small">' + UI.esc(e.message) + '</p></div>';
    }
    var out = '<div class="deck-preview"><p class="muted small">' + UI.str('deckPreviewLabel') + '</p>';
    ['TOWN', 'MAFIA', 'NEUTRAL', 'EVIL'].forEach(function (team) {
      var roles = pre[team.toLowerCase()] || [];
      out += '<div class="deck-team"><div class="deck-team-head"><span class="team-dot team-' + team + '"></span><strong>' +
        UI.teamLabel(team) + '</strong><span class="deck-count">' + roles.length + '</span></div><div class="deck-chips">' +
        (roles.length ? roles.map(function (r) {
          return '<span class="deck-chip team-' + team + '">' + UI.roleNameInline(r) + '</span>';
        }).join('') : '<span class="muted small">' + UI.str('noneLabel') + '</span>') + '</div></div>';
    });
    return out + '</div>';
  }

  UI.renderSetup = function (cfg, app) {
    var pc = cfg.playerCount;
    var ratio = (E.RATIO_TABLE && E.RATIO_TABLE[pc]) || { town: 0, mafia: 0, neutral: 0 };
    var tc = cfg.teamCounts || ratio;
    var total = tc.town + tc.mafia + tc.neutral;
    var playersBody = '<div class="stepper">' +
      '<button class="btn btn-stepper" data-action="count-dec" aria-label="Fewer players">-</button>' +
      '<div class="stepper-num"><strong>' + pc + '</strong><span>' + UI.str('playersWord') + '</span></div>' +
      '<button class="btn btn-stepper" data-action="count-inc" aria-label="More players">+</button></div>' +
      '<div class="ratio">' + pc + ' ' + UI.str('playersWord') + ': <span class="team-TOWN-text">' + ratio.town + ' ' + UI.str('teamTown') + '</span>, ' +
      '<span class="team-MAFIA-text">' + ratio.mafia + ' ' + UI.str('teamMafia') + '</span>, <span class="team-NEUTRAL-text">' + ratio.neutral + ' ' + UI.str('teamNeutral') + '</span></div>' +
      '<div class="team-structure"><div class="team-structure-head"><span class="muted small">' + UI.str('teamStructureHead', pc) + '</span></div>' +
      ['TOWN', 'MAFIA', 'NEUTRAL'].map(function (team) {
        var key = team.toLowerCase(), val = tc[key] || 0;
        return '<div class="team-stepper"><span class="team-dot team-' + team + '"></span><strong class="team-stepper-label">' +
          UI.teamLabel(team) + '</strong><button class="btn btn-stepper-sm" data-action="team-count-dec" data-team="' + team + '"' +
          (val <= 0 ? ' disabled' : '') + ' aria-label="Fewer ' + UI.teamLabel(team) + ' slots">-</button><div class="team-stepper-num"><strong>' +
          val + '</strong></div><button class="btn btn-stepper-sm" data-action="team-count-inc" data-team="' + team + '" aria-label="More ' +
          UI.teamLabel(team) + ' slots">+</button></div>';
      }).join('') + '<div class="ratio">' + UI.str('totalPlayersLine', total, pc) + '</div></div>';
    var html = UI.card(UI.str('playersTitle'), playersBody, 'players', app);

    var scenarioBody = '<div class="preset-grid">';
    Object.keys(E.PRESETS || {}).forEach(function (id) {
      var p = E.PRESETS[id];
      scenarioBody += '<button class="preset-card' + (id === cfg.presetId ? ' selected' : '') + '" data-action="preset-select" data-preset="' +
      UI.esc(id) + '"><span class="preset-name">' + UI.esc(E.localized(p.name, E.locale)) + '</span><span class="preset-tag">' + UI.esc(E.localized(p.tagline, E.locale)) + '</span></button>';
    });
    scenarioBody += '</div>';
    html += UI.card(UI.str('scenarioCardTitle'), scenarioBody, 'scenario', app);

    var rulesBody = '';
    [['noKillN1', 'ruleNoKillN1T', 'ruleNoKillN1D'], ['noLynchD1', 'ruleNoLynchD1T', 'ruleNoLynchD1D'], ['classicReveal', 'ruleClassicRevealT', 'ruleClassicRevealD'], ['jailorNoExecN1', 'ruleJailorNoExecN1T', 'ruleJailorNoExecN1D']].forEach(function (r) {
      rulesBody += '<button class="toggle-row" data-action="rule-toggle" data-rule="' + r[0] + '"><span class="toggle-text"><strong>' + UI.str(r[1]) +
        '</strong><small>' + UI.str(r[2]) + '</small></span><span class="toggle' + (cfg.houseRules[r[0]] ? ' on' : '') + '"><span class="toggle-knob"></span></span></button>';
    });
    html += UI.card(UI.str('houseRulesTitle'), rulesBody, 'house-rules', app);

    var layoutBody = '<div class="layout-grid">';
    (E.SEAT_LAYOUTS || ['circle']).forEach(function (l) {
      layoutBody += '<button class="layout-card' + (l === cfg.layout ? ' selected' : '') + '" data-action="layout-select" data-layout="' + UI.esc(l) +
        '"><span class="layout-icon layout-icon-' + UI.esc(l) + '"></span><span>' + ({ circle: 'Circle', u_shape: 'U Shape' }[l] || l) + '</span></button>';
    });
    layoutBody += '</div>';
    html += UI.card(UI.str('seatLayoutTitle'), layoutBody, 'layout', app);

    var deckBody = '<p class="muted small">' + UI.str('deckBuilderHint') + '</p>' +
      deckBuilder(cfg) + deckPreview(cfg);
    html += UI.card(UI.str('deckBuilderTitle'), deckBody, 'deck-builder', app);
    if (total !== pc) html += '<div class="notice bad">' + UI.esc(UI.str('teamTotalsNotice', total, pc)) + '</div>';
    return html + '<button class="btn btn-primary btn-block btn-big" data-action="start-game">' + UI.str('startSession') + '</button>';
  };
})();
