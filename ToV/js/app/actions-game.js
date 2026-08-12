'use strict';

(function () {
  var E = window.VillageEngine || {};
  var UI = window.UI || {};
  var APP = window.APP;

  function findPlayer(id) {
    var out = null;
    (APP.state.players || []).forEach(function (p) {
      if (String(p.id) === String(id)) out = p;
    });
    return out;
  }

  function resolveId(id) {
    var p = findPlayer(id);
    return p ? p.id : id;
  }

  function roleHolder(roleId) {
    var out = null;
    (APP.state.players || []).forEach(function (p) {
      if (p.isAlive && p.assignedRole === roleId) out = p;
    });
    return out;
  }

  function wiz() { return APP.app.wizard; }

  function curStep() { return wiz().steps[Math.min(wiz().idx, wiz().steps.length - 1)]; }

  function recordWizard(role, playerId, targetId, extra) {
    var step = curStep();
    var action = {
      position: step.position,
      roleId: role,
      playerId: playerId,
      targetId: targetId
    };
    if (extra) action.extra = extra;
    E.recordNightAction(APP.state, action);
    APP.afterMutation();
  }

  function wizNext() {
    wiz().idx = Math.min(wiz().idx + 1, Math.max(0, wiz().steps.length - 1));
    wiz().actor = null;
    wiz().pending = null;
    APP.afterMutation();
  }

  function wizBack() {
    wiz().idx = Math.max(0, wiz().idx - 1);
    wiz().actor = null;
    wiz().pending = null;
    APP.afterMutation();
  }

  function wizActor(role, playerId) {
    var p = findPlayer(playerId);
    wiz().actor = { role: role, player: p ? p.id : playerId };
    wiz().pending = null;
    APP.afterMutation();
  }

  function wizActorBack() {
    wiz().actor = null;
    wiz().pending = null;
    APP.afterMutation();
  }

  function wizTarget(targetId) {
    var w = wiz();
    var role = w.actor.role;
    var pid = w.actor.player;
    if (targetId === '__none__') {
      recordWizard(role, pid, null, undefined);
      w.actor = null;
      w.pending = null;
      APP.afterMutation();
      return;
    }
    targetId = resolveId(targetId);
    if (role === 'witch') {
      if (!w.pending || !w.pending.control) {
        w.pending = { control: targetId };
        APP.afterMutation();
        return;
      }
      recordWizard(role, pid, w.pending.control, { controlRedirect: targetId });
    } else if (role === 'jailor') {
      w.pending = { jail: targetId };
      APP.afterMutation();
      return;
    } else if (role === 'forger') {
      w.pending = { forge: targetId };
      APP.afterMutation();
      return;
    } else {
      recordWizard(role, pid, targetId, undefined);
    }
    w.actor = null;
    w.pending = null;
    APP.afterMutation();
  }

  function wizAlert(alerting) {
    var w = wiz();
    recordWizard('veteran', w.actor.player, null, { alert: alerting });
    w.actor = null;
    w.pending = null;
    APP.afterMutation();
  }

  function wizMafiaTarget(targetId) {
    var leader = E.mafiaKillActor(APP.state);
    if (!leader) {
      UI.toast('No Mafia killer available.');
      return;
    }
    recordWizard(leader.assignedRole, leader.id, resolveId(targetId), undefined);
    wiz().actor = null;
    wiz().pending = null;
    APP.afterMutation();
  }

  function wizJailorDecision(decision) {
    var w = wiz();
    if (decision === 'FORGE') {
      recordWizard('forger', w.actor.player, w.pending.forge, undefined);
    } else {
      recordWizard('jailor', w.actor.player, w.pending.jail, { jailorDecision: decision });
    }
    w.actor = null;
    w.pending = null;
    APP.afterMutation();
  }

  function resolveNight() {
    try {
      E.resolveNight(APP.state);
      APP.state.phase = 'MORNING';
      APP.app.wizard = null;
      APP.app.timerDeadline = null;
      APP.afterMutation();
      checkEnd();
    } catch (e) {
      UI.toast('Night error: ' + e.message, 'error');
    }
  }

  function beginDay() {
    try {
      E.beginDay(APP.state);
      APP.afterMutation();
      checkEnd();
    } catch (e) {
      UI.toast('Day error: ' + e.message, 'error');
    }
  }

  function checkEnd() {
    if (APP.state.phase === 'END' || APP.state.winner) {
      finish(APP.app.lastVictory);
      return true;
    }
    var v = E.checkVictory(APP.state);
    if (v) {
      finish(v);
      return true;
    }
    return false;
  }

  function finish(v) {
    APP.app.lastVictory = v || APP.app.lastVictory;
    if (v && v.winner) APP.state.winner = v.winner;
    else if (APP.state.winner && typeof APP.state.winner === 'object' && APP.state.winner.winner) APP.state.winner = APP.state.winner.winner;
    try {
      if (APP.state.phase !== 'END') {
        var er = E.endGame(APP.state);
        APP.app.endReveal = er && er.reveal ? er.reveal : null;
      }
    } catch (e) { }
    APP.state.phase = 'END';
    APP.app.wizard = null;
    APP.afterMutation();
    APP.goto('end');
  }

  function startTrial(accusedId) {
    try {
      E.startTrial(APP.state, resolveId(accusedId), resolveId(APP.app.trialNom));
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
        voterId: resolveId(btn.getAttribute('data-voter')),
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
      APP.app.lastTrialResult = res || {};
      if (APP.state.trial && APP.state.trial.active) APP.state.trial.active = false;
      APP.afterMutation();
      checkEnd();
    } catch (e) {
      UI.toast('Trial error: ' + e.message, 'error');
    }
  }

  function openDayAbility(ability) {
    if (ability === 'mayor') {
      var may = roleHolder('mayor');
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
        var vig = roleHolder('vigilante');
        if (vig) E.vigilanteShoot(APP.state, vig.id, resolveId(targetId));
      } else if (ability === 'deputy') {
        var dep = roleHolder('deputy');
        if (dep) E.deputyShoot(APP.state, dep.id, resolveId(targetId));
      } else if (ability === 'mayor') {
        var may = roleHolder('mayor');
        if (may) E.mayorReveal(APP.state, may.id);
      }
      APP.afterMutation();
      checkEnd();
    } catch (e) {
      UI.toast(e.message, 'error');
      APP.afterMutation();
    }
  }

  function endDay() {
    if (checkEnd()) return;
    APP.state.phase = 'NIGHT';
    APP.app.dayTimerEnds = null;
    APP.app.trialStage = null;
    APP.app.trialNom = null;
    APP.app.lastTrialResult = null;
    APP.app.picker = null;
    APP.app.wizard = { steps: E.getNightSteps(APP.state), idx: 0, actor: null, pending: null };
    APP.afterMutation();
    APP.goto('game');
  }

  APP.wizNext = wizNext;
  APP.wizBack = wizBack;
  APP.wizActor = wizActor;
  APP.wizActorBack = wizActorBack;
  APP.wizTarget = wizTarget;
  APP.wizAlert = wizAlert;
  APP.wizMafiaTarget = wizMafiaTarget;
  APP.wizJailorDecision = wizJailorDecision;
  APP.resolveNight = resolveNight;
  APP.beginDay = beginDay;
  APP.checkEnd = checkEnd;
  APP.finish = finish;
  APP.startTrial = startTrial;
  APP.castVote = castVote;
  APP.resolveTrial = resolveTrial;
  APP.openDayAbility = openDayAbility;
  APP.doDayAbility = doDayAbility;
  APP.endDay = endDay;
})();
