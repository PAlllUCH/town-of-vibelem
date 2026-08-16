'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function tokenShown(playerId, nightNum) {
    var relayed = APP.app.relayedWhispers || (APP.app.relayedWhispers = {});
    relayed['N' + (nightNum || 1) + ':' + playerId] = true;
    APP.afterMutation();
  }

  function startTrial(accusedId) {
    try {
      E.startTrial(APP.state, APP.resolveId(accusedId), APP.resolveId(APP.app.trialNom));
      APP.app.trialStage = null;
      APP.app.trialNom = null;
      APP.app.lastTrialResult = null;
      APP.afterMutation();
    } catch (e) {
      UI.toast('Trial error: ' + e.message, 'error');
    }
  }

  function castVote(btn) {
    if (!APP.state.trial || !APP.state.trial.active) return;
    try {
      E.castVote(APP.state, {
        voterId: APP.resolveId(btn.getAttribute('data-voter')),
        verdict: btn.getAttribute('data-verdict'),
        ghostToken: btn.getAttribute('data-ghost') === '1'
      });
      APP.afterMutation();
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  }

  function resolveTrial() {
    try {
      var res = E.resolveTrial(APP.state);
      if (res && (res.result === 'ACCEPTED' || res.result === 'SENTENCED')) {
        APP.app.lastTrialResult = null;
        APP.app.trialStage = null;
        APP.app.trialNom = null;
        APP.afterMutation();
        return;
      }
      APP.app.lastTrialResult = res || {};
      if (APP.state.trial && APP.state.trial.active) APP.state.trial.active = false;
      APP.app.trialStage = null;
      APP.app.trialNom = null;
      APP.afterMutation();
      APP.checkEnd();
    } catch (e) {
      UI.toast('Trial error: ' + e.message, 'error');
    }
  }

  function resolveSentence() {
    try {
      var res = E.resolveSentence(APP.state);
      APP.app.lastTrialResult = res || {};
      APP.app.trialStage = null;
      APP.app.trialNom = null;
      APP.afterMutation();
      APP.checkEnd();
    } catch (e) {
      UI.toast('Trial error: ' + e.message, 'error');
    }
  }

  function killPlayer() {
    APP.app.picker = {
      title: 'Kill Player',
      sub: 'Pick a living player.',
      ability: 'moderator-kill'
    };
    APP.afterMutation();
  }

  function undoKill() {
    var g = APP.state.graveyard || [];
    var last = g.length ? g[g.length - 1] : null;
    if (last) E.undoKill(APP.state, last.playerId);
    APP.afterMutation();
    APP.checkEnd();
  }

  function openDayAbility(ability) {
    if (ability === 'mayor') {
      var may = APP.roleHolder('mayor');
      if (may) doDayAbility('mayor', null);
      return;
    }
    var titles = {
      vigilante: 'Vigilante - choose a target',
      deputy: 'Deputy - choose a target'
    };
    APP.app.picker = {
      title: titles[ability] || ability,
      sub: 'Pick a living player.',
      ability: ability
    };
    APP.afterMutation();
  }

  function doDayAbility(ability, targetId) {
    APP.app.picker = null;
    try {
      if (ability === 'vigilante') {
        var vig = APP.roleHolder('vigilante');
        if (vig) E.vigilanteShoot(APP.state, vig.id, APP.resolveId(targetId));
      } else if (ability === 'deputy') {
        var dep = APP.roleHolder('deputy');
        if (dep) E.deputyShoot(APP.state, dep.id, APP.resolveId(targetId));
      } else if (ability === 'mayor') {
        var may = APP.roleHolder('mayor');
        if (may) E.mayorReveal(APP.state, may.id);
      } else if (ability === 'moderator-kill') {
        var mt = APP.resolveId(targetId);
        if (mt != null) E.killPlayer(APP.state, mt);
      }
      APP.afterMutation();
      APP.checkEnd();
    } catch (e) {
      UI.toast(e.message, 'error');
      APP.afterMutation();
    }
  }

  function endDay() {
    if (APP.checkEnd()) return;
    APP.state.phase = 'NIGHT';
    APP.app.dayTimerEnds = null;
    APP.app.dayTimerTotal = null;
    APP.app.trialStage = null;
    APP.app.trialNom = null;
    APP.app.lastTrialResult = null;
    APP.app.picker = null;
    if (APP.state.trial) {
      APP.state.trial.sentenceVotes = [];
      if (APP.state.trial.stage === 'SENTENCE') {
        APP.state.trial.active = false;
        APP.state.trial.stage = null;
      }
    }
    APP.app.wizard = { steps: E.getNightSteps(APP.state), idx: 0, actor: null, pending: null };
    APP.afterMutation();
    APP.goto('game');
  }
  APP.tokenShown = tokenShown;
  APP.startTrial = startTrial;
  APP.castVote = castVote;
  APP.resolveTrial = resolveTrial;
  APP.resolveSentence = resolveSentence;
  APP.killPlayer = killPlayer;
  APP.undoKill = undoKill;
  APP.openDayAbility = openDayAbility;
  APP.doDayAbility = doDayAbility;
  APP.endDay = endDay;
})();
