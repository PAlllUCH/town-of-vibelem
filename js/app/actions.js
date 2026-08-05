'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function dispatch(action, btn) {
    var cfg = APP.cfg;
    var state = APP.state;
    var app = APP.app;
    switch (action) {
      case 'count-dec':
        if (cfg.playerCount > 6) {
          cfg.playerCount--;
          var r1 = (E.RATIO_TABLE && E.RATIO_TABLE[cfg.playerCount]) || { town: 0, mafia: 0, neutral: 0 };
          cfg.teamCounts = { town: r1.town, mafia: r1.mafia, neutral: r1.neutral };
          APP.refreshSetup();
        }
        break;
      case 'count-inc':
        if (cfg.playerCount < 15) {
          cfg.playerCount++;
          var r2 = (E.RATIO_TABLE && E.RATIO_TABLE[cfg.playerCount]) || { town: 0, mafia: 0, neutral: 0 };
          cfg.teamCounts = { town: r2.town, mafia: r2.mafia, neutral: r2.neutral };
          APP.refreshSetup();
        }
        break;
      case 'preset-select':
        APP.selectPreset(btn.getAttribute('data-preset'));
        APP.refreshSetup();
        break;
      case 'rule-toggle': {
        var rule = btn.getAttribute('data-rule');
        cfg.houseRules[rule] = !cfg.houseRules[rule];
        APP.refreshSetup();
        break;
      }
      case 'layout-select':
        cfg.layout = btn.getAttribute('data-layout');
        APP.refreshSetup();
        break;
      case 'deck-add':
        APP.addRole(btn.getAttribute('data-team'));
        APP.refreshSetup();
        break;
      case 'team-count-inc':
        APP.teamInc(btn.getAttribute('data-team'));
        break;
      case 'team-count-dec':
        APP.teamDec(btn.getAttribute('data-team'));
        break;
      case 'civ-inc':
        APP.civInc();
        break;
      case 'civ-dec':
        APP.civDec();
        break;
      case 'deck-remove':
        APP.removeRole(btn.getAttribute('data-team'), Number(btn.getAttribute('data-index')));
        APP.refreshSetup();
        break;
      case 'deck-up':
        APP.moveRole(btn.getAttribute('data-team'), Number(btn.getAttribute('data-index')), -1);
        APP.refreshSetup();
        break;
      case 'deck-down':
        APP.moveRole(btn.getAttribute('data-team'), Number(btn.getAttribute('data-index')), 1);
        APP.refreshSetup();
        break;
      case 'start-game':
        APP.startGame();
        break;
      case 'resume-game':
        APP.resumeGame();
        break;
      case 'new-game':
        APP.newGame();
        break;

      case 'deal-roles':
        APP.dealRoles();
        break;
      case 'redeal':
        try { E.redeal(state); APP.afterMutation(); } catch (e) { UI.toast(e.message); }
        break;
      case 'edit-names':
        APP.editNames();
        break;
      case 'toggle-roles':
        app.rolesHidden = !app.rolesHidden;
        APP.save();
        APP.renderScreen('seats');
        break;
      case 'witch-side':
        state.witchSide = btn.getAttribute('data-side') === 'TOWN' ? 'TOWN' : 'MAFIA';
        APP.afterMutation();
        break;
      case 'begin-night':
        APP.beginNight();
        break;
      case 'goto-setup':
        APP.goto('setup');
        break;
      case 'swap-mode':
        app.swapMode = !app.swapMode;
        if (!app.swapMode) app.swapSel = null;
        APP.afterMutation();
        break;
      case 'swap-cancel':
        app.swapMode = false;
        app.swapSel = null;
        APP.afterMutation();
        break;
      case 'swap-select':
        APP.swapSelect(btn.getAttribute('data-seat'));
        break;

      case 'wizard-next':
        APP.wizNext();
        break;
      case 'wizard-back':
        APP.wizBack();
        break;
      case 'wizard-skip':
        APP.wizNext();
        break;
      case 'wizard-actor':
        APP.wizActor(btn.getAttribute('data-role'), btn.getAttribute('data-player'));
        break;
      case 'wizard-actor-back':
        APP.wizActorBack();
        break;
      case 'wizard-target':
        APP.wizTarget(btn.getAttribute('data-target'));
        break;
      case 'wizard-alert':
        APP.wizAlert(btn.getAttribute('data-alert') === 'true');
        break;
      case 'wizard-decision':
        APP.wizJailorDecision(btn.getAttribute('data-decision'));
        break;
      case 'wizard-forge':
        APP.wizForgeConfirm();
        break;
      case 'resolve-night':
        APP.resolveNight();
        break;
      case 'pencils-down':
        app.willOpen = false;
        app.timerDeadline = null;
        UI.toast('Pencils down! Wills are locked.');
        APP.afterMutation();
        break;
      case 'begin-day':
        APP.beginDay();
        break;

      case 'start-trial':
        app.trialStage = 'nominator';
        app.lastTrialResult = null;
        APP.afterMutation();
        break;
      case 'pick-nom':
        app.trialNom = btn.getAttribute('data-target');
        app.trialStage = 'accused';
        APP.afterMutation();
        break;
      case 'pick-acc':
        APP.startTrial(btn.getAttribute('data-target'));
        break;
      case 'cast-vote':
        APP.castVote(btn);
        break;
      case 'resolve-trial':
        APP.resolveTrial();
        break;
      case 'clear-trial':
        app.lastTrialResult = null;
        app.trialStage = null;
        APP.afterMutation();
        break;

      case 'day-ability':
        APP.openDayAbility(btn.getAttribute('data-ability'));
        break;
      case 'pick-day-target':
        APP.doDayAbility(btn.getAttribute('data-ability'), btn.getAttribute('data-target'));
        break;
      case 'picker-cancel':
        app.picker = null;
        APP.afterMutation();
        break;
      case 'end-day':
        APP.endDay();
        break;

      case 'toggle-seat-overlay':
        app.seatOverlay = !app.seatOverlay;
        APP.afterMutation();
        break;
      case 'toggle-logs':
        app.logsOpen = !app.logsOpen;
        APP.afterMutation();
        break;
      default:
        break;
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'will-input') return;
    dispatch(action, btn);
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.classList && t.classList.contains('seat-name-input')) {
      APP.app.names[Number(t.getAttribute('data-seat'))] = t.value;
      return;
    }
    if (t.getAttribute('data-action') === 'will-input') {
      if (APP.state && APP.state.phase === 'MORNING' && APP.app.willOpen) {
        try {
          E.updateWill(APP.state, t.getAttribute('data-player'), t.value);
          APP.save();
        } catch (e) { }
      }
    }
  });
})();
