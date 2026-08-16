'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function selectPreset(id) {
    var p = E.PRESETS[id];
    if (!p) return;
    var target = {
      town: (p.town || []).slice(),
      mafia: (p.mafia || []).slice(),
      neutral: (p.neutral || []).slice()
    };
    var cur = APP.cfg.deckConfig || { town: [], mafia: [], neutral: [] };
    var same = ['town', 'mafia', 'neutral'].every(function (k) {
      var a = cur[k] || [];
      var b = target[k];
      return a.length === b.length && a.every(function (x, i) { return x === b[i]; });
    });
    if (!same && typeof window.confirm === 'function' &&
        !window.confirm('Switching presets will reset your deck edits. Continue?')) {
      return;
    }
    APP.cfg.presetId = id;
    APP.cfg.deckConfig = target;
  }

  function addRole(team) {
    if (!APP.teamAddAllowed(team)) {
      var tc = APP.teamCountsObj();
      var slots = tc[String(team).toLowerCase()] || 0;
      var reason;
      if (team === 'TOWN' && APP.cfg.civilians != null && APP.cfg.civilians > 0) {
        var free = Math.max(0, slots - Math.min(slots, Number(APP.cfg.civilians) || 0));
        reason = 'Only ' + free + ' named Town slot' + (free === 1 ? '' : 's') + ' remain (' +
          APP.cfg.civilians + ' civilian' + (APP.cfg.civilians === 1 ? '' : 's') + ' reserved).';
      } else {
        reason = 'All ' + slots + ' ' + APP.teamLabel(team) + ' slot' + (slots === 1 ? '' : 's') + ' are assigned.';
      }
      UI.toast(reason);
      return;
    }
    var sel = APP.el('add-' + team);
    if (!sel) return;
    var id = sel.value;
    var list = APP.deckList(team);
    if (list.indexOf(id) === -1) list.push(id);
  }

  function removeRole(team, index) {
    var list = APP.deckList(team);
    if (index >= 0 && index < list.length) list.splice(index, 1);
  }

  function moveRole(team, index, dir) {
    var list = APP.deckList(team);
    var j = index + dir;
    if (index < 0 || j < 0 || index >= list.length || j >= list.length) return;
    var tmp = list[index];
    list[index] = list[j];
    list[j] = tmp;
  }

  function teamInc(team, btn) {
    var tc = APP.teamCountsObj();
    var total = (tc.town || 0) + (tc.mafia || 0) + (tc.neutral || 0);
    if (total >= APP.cfg.playerCount) {
      UI.toast('Team totals cannot exceed the player count (' + APP.cfg.playerCount + '). Lower another team first.');
      return;
    }
    APP.cfg.teamCounts = { town: tc.town, mafia: tc.mafia, neutral: tc.neutral };
    APP.cfg.teamCounts[String(team).toLowerCase()] += 1;
    APP.refreshSetup();
    bumpStepper(btn);
  }

  function teamDec(team, btn) {
    var tc = APP.teamCountsObj();
    var key = String(team).toLowerCase();
    if ((tc[key] || 0) <= 0) return;
    APP.cfg.teamCounts = { town: tc.town, mafia: tc.mafia, neutral: tc.neutral };
    APP.cfg.teamCounts[key] -= 1;
    APP.refreshSetup();
    bumpStepper(btn);
  }

  function civInc(btn) {
    var slots = APP.teamCountsObj().town || 0;
    var cur = APP.cfg.civilians == null ? APP.townLeftoverCivilians() : Number(APP.cfg.civilians) || 0;
    if (cur >= slots) {
      UI.toast('Civilian count cannot exceed the Town slot count (' + slots + ').');
      return;
    }
    APP.cfg.civilians = cur + 1;
    APP.refreshSetup();
    bumpStepper(btn);
  }

  function civDec(btn) {
    var cur = APP.cfg.civilians == null ? APP.townLeftoverCivilians() : Number(APP.cfg.civilians) || 0;
    if (cur <= 0) {
      UI.toast('Civilian count cannot go below zero.');
      return;
    }
    APP.cfg.civilians = cur - 1;
    APP.refreshSetup();
    bumpStepper(btn);
  }

  function civReset() {
    APP.cfg.civilians = null;
    APP.refreshSetup();
  }

  function bumpStepper(btn) {
    if (!btn) return;
    var action = btn.getAttribute('data-action') || '';
    var team = btn.getAttribute('data-team') || '';
    var strong = null;
    if (action === 'civ-inc' || action === 'civ-dec') {
      strong = document.querySelector('.civ-stepper-num strong');
    } else if (action === 'count-inc' || action === 'count-dec') {
      strong = document.querySelector('.stepper-num strong');
    } else if (action === 'team-count-inc' || action === 'team-count-dec') {
      var dot = document.querySelector('.team-stepper .team-dot.team-' + team);
      if (dot && dot.parentNode) strong = dot.parentNode.querySelector('.team-stepper-num strong');
    }
    if (!strong) return;
    strong.classList.add('bump');
    setTimeout(function () { strong.classList.remove('bump'); }, 300);
  }

  function startGame() {
    var tc = APP.cfg.teamCounts;
    if (tc) {
      var total = (tc.town || 0) + (tc.mafia || 0) + (tc.neutral || 0);
      if (total !== APP.cfg.playerCount) {
        UI.toast('Team totals must equal the player count (' + APP.cfg.playerCount + '), currently ' + total + '.');
        return;
      }
    }
    try {
      APP.state = E.createGame({
        playerCount: APP.cfg.playerCount,
        presetId: APP.cfg.presetId,
        houseRules: APP.cfg.houseRules,
        town: APP.cfg.deckConfig.town,
        mafia: APP.cfg.deckConfig.mafia,
        neutral: APP.cfg.deckConfig.neutral,
        teamCounts: tc || undefined,
        civilians: APP.cfg.civilians == null ? undefined : APP.cfg.civilians
      });
      APP.resetAppFlags();
      APP.save();
      APP.goto('seats');
    } catch (e) {
      UI.toast('Setup error: ' + e.message, 'error');
    }
  }

  function newGame() {
    APP.clearSave();
    APP.state = null;
    APP.cfg = APP.defaultCfg();
    APP.resetAppFlags();
    APP.goto('setup');
  }

  function resumeGame() {
    var data = APP.loadSave();
    if (!data || !data.game) { UI.toast('No saved game found.'); return; }
    try {
      APP.state = E.deserialize(data.game);
      if (data.cfg) APP.cfg = APP.mergeCfg(APP.cfg, data.cfg);
      APP.app.rolesHidden = !!(data.ui && data.ui.rolesHidden);
      APP.app.namingMode = false;
      APP.app.pendingRoles = (data.ui && data.ui.pendingRoles) || {};
      APP.app.names = (data.ui && data.ui.names) || {};
      APP.app.nightZeroDone = (data.ui && data.ui.nightZeroDone) || {};
      APP.app.claims = (data.ui && data.ui.claims) || {};
      APP.app.relayedWhispers = (data.ui && data.ui.relayedWhispers) || {};
      APP.app.dayTimerEnds = (data.ui && data.ui.dayTimerEnds) || null;
      if (APP.app.dayTimerEnds && APP.app.dayTimerEnds <= Date.now()) APP.app.dayTimerEnds = null;
      APP.app.dayTimerTotal = (data.ui && data.ui.dayTimerTotal) || null;
      if (!APP.app.dayTimerEnds) APP.app.dayTimerTotal = null;
      APP.app.collapsed = (data.ui && data.ui.collapsed) || {};
      APP.app.lastTrialResult = null;
      APP.app.lastVictory = null;
      APP.app.picker = null;
      APP.app.seatOverlay = false;
      APP.app.swapMode = false;
      APP.app.swapSel = null;
      APP.app.endReveal = null;
      if (APP.state.phase === 'NIGHT') {
        APP.app.wizard = {
          steps: E.getNightSteps(APP.state),
          idx: Math.min((data.ui && data.ui.wizardIdx) || 0, Math.max(0, E.getNightSteps(APP.state).length - 1)),
          actor: null,
          pending: null
        };
      } else {
        APP.app.wizard = null;
      }
      var screen = { SETUP: 'setup', SEATS: 'seats', NIGHT: 'game', MORNING: 'game', DAY: 'game', END: 'end' }[APP.state.phase] || 'setup';
      APP.goto(screen);
      UI.toast('Game restored.', 'success');
    } catch (e) {
      UI.toast('Could not restore save.', 'error');
    }
  }

  APP.selectPreset = selectPreset;
  APP.addRole = addRole;
  APP.removeRole = removeRole;
  APP.moveRole = moveRole;
  APP.teamInc = teamInc;
  APP.teamDec = teamDec;
  APP.civInc = civInc;
  APP.civDec = civDec;
  APP.civReset = civReset;
  APP.bumpStepper = bumpStepper;
  APP.startGame = startGame;
  APP.newGame = newGame;
  APP.resumeGame = resumeGame;
})();
