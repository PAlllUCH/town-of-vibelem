'use strict';

(function () {
  var E = window.VillageEngine || {};
  var APP = {
    SAVE_KEY: 'villagepub-save',
    locale: null,
    state: null,
    cfg: null,
    app: {
      screen: 'setup',
      mode: 'app',
      statuses: {},
      helperSheetPid: null,
      helperStepIdx: 0,
      wizard: null,
      rolesHidden: false,
      namingMode: false,
      trialStage: null,
      trialNom: null,
      lastTrialResult: null,
      lastVictory: null,
      picker: null,
      seatOverlay: false,
      swapMode: false,
      swapSel: null,
      names: {},
      pendingRoles: {},
      notes: {},
      nightZeroDone: {},
      claims: {},
      relayedWhispers: {},
      tokensOpen: false,
      claimsOpen: false,
      modOpen: false,
      claimPicker: null,
      endReveal: null,
      timerDeadline: null,
      dayTimerEnds: null,
      dayTimerTotal: null,
      referenceOpen: false,
      referenceQuery: '',
      referenceDetail: null,
      collapsed: {}
    }
  };

  function defaultCfg() {
    var def = (E.PRESETS && E.PRESETS.blank) ? 'blank' : (E.PRESETS ? Object.keys(E.PRESETS)[0] : 'p1');
    var preset = E.PRESETS[def] || { town: [], mafia: [], neutral: [] };
    var ratio = (E.RATIO_TABLE && E.RATIO_TABLE[8]) || { town: 5, mafia: 2, neutral: 1 };
    return {
      playerCount: 8,
      presetId: def,
      houseRules: { noKillN1: true, noLynchD1: true, classicReveal: false, jailorNoExecN1: false },
      layout: (E.SEAT_LAYOUTS && E.SEAT_LAYOUTS[0]) || 'circle',
      teamCounts: { town: ratio.town, mafia: ratio.mafia, neutral: ratio.neutral },
      civilians: null,
      deckConfig: {
        town: (preset.town || []).slice(),
        mafia: (preset.mafia || []).slice(),
        neutral: (preset.neutral || []).slice()
      }
    };
  }

  function mergeCfg(base, saved) {
    var out = JSON.parse(JSON.stringify(base));
    if (saved.playerCount) out.playerCount = saved.playerCount;
    if (saved.presetId) out.presetId = saved.presetId;
    if (saved.houseRules && typeof saved.houseRules === 'object') {
      var hr = {};
      Object.keys(saved.houseRules).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(saved.houseRules, k)) hr[k] = saved.houseRules[k];
      });
      out.houseRules = Object.assign({}, out.houseRules, hr);
    }
    if (saved.layout && E.SEAT_LAYOUTS && E.SEAT_LAYOUTS.indexOf(saved.layout) !== -1) out.layout = saved.layout;
    if (saved.teamCounts && saved.teamCounts.town != null) {
      out.teamCounts = { town: saved.teamCounts.town, mafia: saved.teamCounts.mafia, neutral: saved.teamCounts.neutral };
    } else {
      var ratio = (E.RATIO_TABLE && E.RATIO_TABLE[out.playerCount]) || { town: 0, mafia: 0, neutral: 0 };
      out.teamCounts = { town: ratio.town, mafia: ratio.mafia, neutral: ratio.neutral };
    }
    if (saved.civilians != null) out.civilians = saved.civilians;
    if (saved.deckConfig) {
      out.deckConfig = {
        town: (saved.deckConfig.town || []).slice(),
        mafia: (saved.deckConfig.mafia || []).slice(),
        neutral: (saved.deckConfig.neutral || []).slice()
      };
    }
    return out;
  }

  function teamCountsObj() {
    return APP.cfg.teamCounts || (E.RATIO_TABLE && E.RATIO_TABLE[APP.cfg.playerCount]) || { town: 0, mafia: 0, neutral: 0 };
  }

  function teamLabel(t) {
    return { TOWN: 'Town', MAFIA: 'Mafia', NEUTRAL: 'Neutral' }[t] || t;
  }

  function deckList(team) {
    return APP.cfg.deckConfig[String(team).toLowerCase()];
  }

  function teamAddAllowed(team) {
    var tc = teamCountsObj();
    var key = team.toLowerCase();
    var slots = tc[key] || 0;
    var list = deckList(team);
    if (team === 'TOWN') {
      var civs = APP.cfg.civilians == null ? 0 : Math.max(0, Math.min(slots, Number(APP.cfg.civilians) || 0));
      return list.length < Math.max(0, slots - civs);
    }
    return list.length < slots;
  }

  function townLeftoverCivilians() {
    var slots = teamCountsObj().town || 0;
    return Math.max(0, slots - Math.min(deckList('TOWN').length, slots));
  }

  function resetAppFlags() {
    APP.app.wizard = null;
    APP.app.rolesHidden = false;
    APP.app.namingMode = false;
    APP.app.trialStage = null;
    APP.app.trialNom = null;
    APP.app.lastTrialResult = null;
    APP.app.lastVictory = null;
    APP.app.picker = null;
    APP.app.seatOverlay = false;
    APP.app.swapMode = false;
    APP.app.swapSel = null;
    APP.app.names = {};
    APP.app.pendingRoles = {};
    APP.app.notes = {};
    APP.app.nightZeroDone = {};
    APP.app.claims = {};
    APP.app.relayedWhispers = {};
    APP.app.tokensOpen = false;
    APP.app.claimsOpen = false;
    APP.app.modOpen = false;
    APP.app.claimPicker = null;
    APP.app.endReveal = null;
    APP.app.timerDeadline = null;
    APP.app.dayTimerEnds = null;
    APP.app.dayTimerTotal = null;
    APP.app.referenceOpen = false;
    APP.app.referenceQuery = '';
    APP.app.referenceDetail = null;
    APP.app.collapsed = {};
    APP.app.helperSheetPid = null;
    APP.app.helperStepIdx = 0;
    APP.app.statuses = {};
    APP.app.mode = 'app';
  }

  APP.defaultCfg = defaultCfg;
  APP.mergeCfg = mergeCfg;
  APP.teamCountsObj = teamCountsObj;
  APP.teamLabel = teamLabel;
  APP.deckList = deckList;
  APP.teamAddAllowed = teamAddAllowed;
  APP.townLeftoverCivilians = townLeftoverCivilians;
  APP.resetAppFlags = resetAppFlags;
  APP.toggleLocale = function () {
    var next = (APP.locale || E.locale || 'en').toLowerCase() === 'pl' ? 'en' : 'pl';
    if (typeof E.setLocale === 'function') E.setLocale(next);
    APP.locale = E.locale || next;
    if (typeof APP.renderScreen === 'function') APP.renderScreen(APP.app.screen);
  };
  APP.toggleMode = function () {
    APP.app.mode = APP.app.mode === 'helper' ? 'app' : 'helper';
    if (typeof APP.afterMutation === 'function') APP.afterMutation();
  };
  APP.toggleHelperStatus = function (pid, status) {
    if (!APP.app.statuses) APP.app.statuses = {};
    if (!APP.app.statuses[pid]) APP.app.statuses[pid] = {};
    APP.app.statuses[pid][status] = !APP.app.statuses[pid][status];
  };
  APP.init = function () {
    APP.state = null;
    APP.cfg = APP.defaultCfg();
    APP.locale = E.locale || 'en';
  };

  window.APP = APP;
})();
