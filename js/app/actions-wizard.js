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
    if (E.recordNightAction(APP.state, action)) {
      var actions = (APP.state.night && APP.state.night.actions) || [];
      for (var i = actions.length - 2; i >= 0; i -= 1) {
        var existing = actions[i];
        if (existing.position === action.position && existing.roleId === action.roleId &&
            String(existing.playerId) === String(action.playerId)) {
          actions.splice(i, 1);
        }
      }
    }
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
    } else if (role === 'witness') {
      var picks = (w.pending && w.pending.witness) ? w.pending.witness.slice() : [];
      if (picks.indexOf(targetId) === -1) picks.push(targetId);
      w.pending = { witness: picks };
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

  function wizWitnessConfirm() {
    var w = wiz();
    var picks = (w.pending && w.pending.witness) || [];
    if (picks.length < 2) {
      UI.toast('Pick two players to compare.');
      return;
    }
    recordWizard('witness', w.actor.player, picks[0], { secondTarget: picks[1] });
    w.actor = null;
    w.pending = null;
    APP.afterMutation();
  }
  APP.findPlayer = findPlayer;
  APP.resolveId = resolveId;
  APP.roleHolder = roleHolder;
  APP.wizNext = wizNext;
  APP.wizBack = wizBack;
  APP.wizActor = wizActor;
  APP.wizActorBack = wizActorBack;
  APP.wizTarget = wizTarget;
  APP.wizAlert = wizAlert;
  APP.wizMafiaTarget = wizMafiaTarget;
  APP.wizJailorDecision = wizJailorDecision;
  APP.wizWitnessConfirm = wizWitnessConfirm;
})();
