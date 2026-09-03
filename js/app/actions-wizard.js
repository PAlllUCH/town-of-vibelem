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

  var UNDO_UNSAFE_ROLES = ['necromant', 'retributionist', 'amnesiac'];

  function describeAction(state, role, targetId) {
    var desc = UI.roleName(role);
    if (targetId != null) desc += ' \u2192 ' + UI.nameOf(state, targetId);
    return desc;
  }

  function undoRecording(rec) {
    var st = APP.state;
    var actions = (st.night && st.night.actions) || [];
    for (var i = actions.length - 1; i >= 0; i -= 1) {
      var a = actions[i];
      if (a.position === rec.position && a.roleId === rec.roleId &&
          String(a.playerId) === String(rec.playerId)) {
        actions.splice(i, 1);
        break;
      }
    }
    var logKey = String(rec.playerId);
    if (rec.logEntry && st.playerLog && st.playerLog[logKey]) {
      st.playerLog[logKey] = st.playerLog[logKey].filter(function (e) { return e !== rec.logEntry; });
    }
    var p = findPlayer(rec.playerId);
    if (p) {
      var stillTargeting = actions.some(function (x) {
        return String(x.playerId) === String(p.id) && x.targetId != null;
      });
      if (!stillTargeting) p.nightTarget = null;
      if (rec.roleId === 'jailor') p.jailorDecision = null;
    }
    APP.afterMutation();
  }

  function pendingSkipKeys(state, step) {
    var out = [];
    var actions = (state.night && state.night.actions) || [];
    var roles = step.roles || [];
    state.players.forEach(function (p) {
      if (!p.isAlive) return;
      var rid = null;
      if (roles.indexOf(p.assignedRole) !== -1) rid = p.assignedRole;
      else if (p.inheritedRole && p.inheritedRole !== p.assignedRole && roles.indexOf(p.inheritedRole) !== -1) rid = p.inheritedRole;
      if (!rid) return;
      var done = actions.some(function (ac) {
        return ac.position === step.position && ac.roleId === rid && String(ac.playerId) === String(p.id);
      });
      if (!done) out.push(step.position + '|' + rid + '|' + p.id);
    });
    return out;
  }

  function recordWizard(role, playerId, targetId, extra) {
    var step = curStep();
    var action = {
      position: step.position,
      roleId: role,
      playerId: playerId,
      targetId: targetId
    };
    if (extra) action.extra = extra;
    var logKey = String(playerId);
    var logLenBefore = ((APP.state.playerLog && APP.state.playerLog[logKey]) || []).length;
    if (E.recordNightAction(APP.state, action)) {
      var rec = null;
      if (APP.state.phase === 'NIGHT' && UNDO_UNSAFE_ROLES.indexOf(role) === -1 &&
          APP.state.playerLog && APP.state.playerLog[logKey].length > logLenBefore) {
        rec = {
          position: step.position,
          roleId: role,
          playerId: playerId,
          logEntry: APP.state.playerLog[logKey][APP.state.playerLog[logKey].length - 1]
        };
      }
      var actions = (APP.state.night && APP.state.night.actions) || [];
      for (var i = actions.length - 2; i >= 0; i -= 1) {
        var existing = actions[i];
        if (existing.position === action.position && existing.roleId === action.roleId &&
            String(existing.playerId) === String(action.playerId)) {
          actions.splice(i, 1);
        }
      }
      if (rec) {
        UI.toast(UI.str('wizardActionToast', describeAction(APP.state, role, targetId)), '',
          { label: '\u21A9 Undo', run: function () { undoRecording(rec); } });
      } else {
        UI.toast(UI.str('wizardActionToast', describeAction(APP.state, role, targetId)));
      }
    }
    APP.afterMutation();
  }

  function wizNext() {
    var w = wiz();
    var step = curStep();
    if (!w.nightZero && step && step.roles && step.roles.length && step.position < 14) {
      var skips = APP.app.nightSkips || (APP.app.nightSkips = {});
      pendingSkipKeys(APP.state, step).forEach(function (k) { skips[k] = true; });
    }
    w.idx = Math.min(w.idx + 1, Math.max(0, w.steps.length - 1));
    w.actor = null;
    w.pending = null;
    APP.afterMutation();
  }

  function wizBack() {
    wiz().idx = Math.max(0, wiz().idx - 1);
    wiz().actor = null;
    wiz().pending = null;
    APP.afterMutation();
  }

  function wizJump(index) {
    var maxIdx = Math.max(0, wiz().steps.length - 1);
    wiz().idx = Math.max(0, Math.min(Number(index) || 0, maxIdx));
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
    } else if (role === 'necromant') {
      if (!w.pending || !w.pending.corpse) {
        w.pending = { corpse: targetId };
        APP.afterMutation();
        return;
      }
      recordWizard(role, pid, w.pending.corpse, { livingTarget: targetId });
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
  APP.wizJump = wizJump;
  APP.wizActor = wizActor;
  APP.wizActorBack = wizActorBack;
  APP.wizTarget = wizTarget;
  APP.wizAlert = wizAlert;
  APP.wizMafiaTarget = wizMafiaTarget;
  APP.wizJailorDecision = wizJailorDecision;
  APP.wizWitnessConfirm = wizWitnessConfirm;
})();
