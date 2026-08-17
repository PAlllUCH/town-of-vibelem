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
          APP.bumpStepper(btn);
        }
        break;
      case 'count-inc':
        if (cfg.playerCount < 15) {
          cfg.playerCount++;
          var r2 = (E.RATIO_TABLE && E.RATIO_TABLE[cfg.playerCount]) || { town: 0, mafia: 0, neutral: 0 };
          cfg.teamCounts = { town: r2.town, mafia: r2.mafia, neutral: r2.neutral };
          APP.refreshSetup();
          APP.bumpStepper(btn);
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
        APP.teamInc(btn.getAttribute('data-team'), btn);
        break;
      case 'team-count-dec':
        APP.teamDec(btn.getAttribute('data-team'), btn);
        break;
      case 'civ-inc':
        APP.civInc(btn);
        break;
      case 'civ-dec':
        APP.civDec(btn);
        break;
      case 'civ-reset':
        APP.civReset();
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

      case 'auto-fill':
        APP.autoFill();
        break;
      case 'lock-roles':
        APP.lockRoles();
        break;
      case 'redeal':
        try { E.redeal(state); APP.afterMutation(); } catch (e) { UI.toast(e.message, 'error'); }
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
      case 'nz-toggle':
        APP.nzToggle(btn.getAttribute('data-nz'));
        break;
      case 'toggle-tokens':
        APP.toggleTokens();
        break;
      case 'toggle-claims':
        APP.toggleClaims();
        break;
      case 'toggle-mod':
        APP.toggleMod();
        break;
      case 'claim-open':
        APP.claimOpen(btn.getAttribute('data-seat'));
        break;
      case 'claim-pick':
        APP.claimPick(btn.getAttribute('data-seat'), btn.getAttribute('data-role'));
        break;
      case 'claim-clear':
        APP.claimClear(btn.getAttribute('data-seat'));
        break;
      case 'claim-close':
        APP.claimClose();
        break;
      case 'begin-night':
        APP.beginNight();
        break;
      case 'begin-night-zero':
        APP.beginNightZero();
        break;
      case 'resolve-night-zero':
        APP.resolveNightZero();
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
      case 'wizard-mafia-target':
        APP.wizMafiaTarget(btn.getAttribute('data-target'));
        break;
      case 'wizard-alert':
        APP.wizAlert(btn.getAttribute('data-alert') === 'true');
        break;
      case 'wizard-decision':
        APP.wizJailorDecision(btn.getAttribute('data-decision'));
        break;
      case 'wizard-witness-confirm':
        APP.wizWitnessConfirm();
        break;
      case 'token-shown':
        APP.tokenShown(btn.getAttribute('data-player'), btn.getAttribute('data-night'));
        break;
      case 'resolve-night':
        APP.resolveNight();
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
      case 'resolve-sentence':
        APP.resolveSentence();
        break;
      case 'kill-player':
        APP.killPlayer();
        break;
      case 'undo-kill':
        APP.undoKill();
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
      case 'start-day-timer':
        app.dayTimerEnds = Date.now() + (Number(btn.getAttribute('data-seconds')) || 0) * 1000;
        app.dayTimerTotal = Number(btn.getAttribute('data-seconds')) || 0;
        APP.afterMutation();
        break;
      case 'adjust-day-timer':
        APP.adjustDayTimer(Number(btn.getAttribute('data-delta')) || 0);
        break;
      case 'stop-day-timer':
        app.dayTimerEnds = null;
        app.dayTimerTotal = null;
        APP.afterMutation();
        break;

      case 'toggle-seat-overlay':
        app.seatOverlay = !app.seatOverlay;
        APP.afterMutation();
        break;
      case 'toggle-logs':
        app.logsOpen = !app.logsOpen;
        APP.afterMutation();
        break;
      case 'toggle-card':
        APP.toggleCard(btn.getAttribute('data-card'));
        break;
      case 'toggle-reference':
        app.referenceOpen = !app.referenceOpen;
        APP.updateReferencePanel();
        APP.renderScreen(app.screen);
        break;
      case 'close-reference':
        if (!app.referenceOpen) break;
        app.referenceOpen = false;
        APP.updateReferencePanel();
        APP.renderScreen(app.screen);
        break;
      case 'reference-search':
        if (!app.referenceOpen) break;
        app.referenceQuery = btn.value || '';
        APP.updateReferenceList();
        break;
      case 'reference-detail': {
        if (!app.referenceOpen) break;
        var rid = btn.getAttribute('data-role');
        app.referenceDetail = app.referenceDetail === rid ? null : rid;
        APP.updateReferenceList();
        break;
      }
      case 'toggle-mode':
        APP.toggleMode();
        break;
      case 'open-helper-sheet':
        app.helperSheetPid = btn.getAttribute('data-helper-pid');
        APP.afterMutation();
        break;
      case 'close-helper-sheet':
        app.helperSheetPid = null;
        APP.afterMutation();
        break;
      case 'set-helper-status':
        APP.toggleHelperStatus(btn.getAttribute('data-helper-pid'), btn.getAttribute('data-helper-status'));
        APP.afterMutation();
        break;
      default:
        break;
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!btn) return;
    dispatch(btn.getAttribute('data-action'), btn);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (APP.app.helperSheetPid != null) {
      APP.app.helperSheetPid = null;
      APP.afterMutation();
    }
    else if (APP.app.claimPicker != null) APP.claimClose();
    else if (APP.app.claimsOpen) APP.toggleClaims();
    else if (APP.app.tokensOpen) APP.toggleTokens();
    else if (APP.app.modOpen) APP.toggleMod();
  });

  function toggleCard(key) {
    var app = APP.app;
    if (!key) return;
    if (!app.collapsed) app.collapsed = {};
    app.collapsed[key] = !app.collapsed[key];
    APP.afterMutation();
  }
  APP.toggleCard = toggleCard;

  function adjustDayTimer(delta) {
    var app = APP.app;
    if (!app.dayTimerEnds) return;
    var remaining = Math.max(0, Math.round((app.dayTimerEnds - Date.now()) / 1000));
    var next = remaining + delta;
    if (next <= 0) {
      app.dayTimerEnds = null;
      app.dayTimerTotal = null;
      APP.afterMutation();
      return;
    }
    app.dayTimerEnds = app.dayTimerEnds + delta * 1000;
    app.dayTimerTotal = Math.max((app.dayTimerTotal == null ? remaining : app.dayTimerTotal + delta), next);
    APP.afterMutation();
  }
  APP.adjustDayTimer = adjustDayTimer;
})();
