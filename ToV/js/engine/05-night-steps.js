'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.getNightSteps = function (state) {
    var steps = [];
    var nightNum = state.night.number;
    var isNightOne = nightNum === 1;
    var P = state.players;
    var hasLivingRole = function (roleId) {
      return P.some(function (p) { return p.isAlive && p.assignedRole === roleId; });
    };
    var hauntPending = state.jester.haunted && state.jester.hauntTarget === null;

    for (var i = 0; i < E.NIGHT_STEPS.length; i += 1) {
      var tpl = E.NIGHT_STEPS[i];
      var step = null;
      if (tpl.position === 0) {
        var vet = P.find(function (p) { return p.assignedRole === 'veteran'; });
        var vetAvailable = !!vet && vet.isAlive && vet.alertsUsed < 3;
        var roles0 = [];
        var prompt0 = tpl.prompt;
        if (vetAvailable) roles0.push('veteran');
        if (hauntPending) {
          roles0.push('jester');
          prompt0 += ' (If the Jester was lynched yesterday, the Jester ghost may point to one player who voted Guilty in that lynch trial.)';
        }
        if (roles0.length > 0) step = { position: 0, title: tpl.title, roles: roles0, prompt: prompt0 };
      } else if (tpl.position === 3) {
        if (!hasLivingRole('jailor')) continue;
        var prompt3 = tpl.prompt;
        if (isNightOne) prompt3 += ' (Night 1: the Jailor cannot execute.)';
        step = { position: 3, title: tpl.title, roles: tpl.roles.slice(), prompt: prompt3 };
      } else if (tpl.position === 11 && tpl.title === 'Sheriff') {
        var livingSheriff = P.some(function (p) { return p.isAlive && p.assignedRole === 'sheriff'; });
        var inheritedDeputy = P.some(function (p) {
          return p.isAlive && p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff';
        });
        if (!livingSheriff && !inheritedDeputy) continue;
        var roles11 = [];
        if (livingSheriff) roles11.push('sheriff');
        if (inheritedDeputy) roles11.push('deputy');
        step = { position: 11, title: tpl.title, roles: roles11, prompt: tpl.prompt };
      } else if (tpl.position === 12 && tpl.title === 'Retributionist') {
        var retAvailable = P.some(function (p) {
          return p.isAlive && p.assignedRole === 'retributionist' && !p.usedOncePerGame;
        });
        if (!retAvailable) continue;
        step = { position: 12, title: tpl.title, roles: ['retributionist'], prompt: tpl.prompt };
      } else if (tpl.position === 12 && tpl.title === 'Amnesiac') {
        var amnAvailable = hasLivingRole('amnesiac') && !state.amnesiac.used;
        if (!amnAvailable) continue;
        step = { position: 12, title: tpl.title, roles: ['amnesiac'], prompt: tpl.prompt };
      } else if (tpl.position === 13) {
        var anyMedium = P.some(function (p) { return p.assignedRole === 'medium'; });
        if (!anyMedium) continue;
        step = { position: 13, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      } else if (tpl.roles.length === 0) {
        step = { position: tpl.position, title: tpl.title, roles: [], prompt: tpl.prompt };
        if (tpl.timerSeconds) step.timerSeconds = tpl.timerSeconds;
      } else {
        var present = tpl.roles.some(function (r) { return hasLivingRole(r); });
        if (!present) continue;
        step = { position: tpl.position, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      }
      if (step) steps.push(step);
    }
    return steps;
  };

  E.recordNightAction = function (state, input) {
    input = input || {};
    var p = E._byId(state, input.playerId);
    if (!p) return false;
    var ghostAllowed = (input.position === 0 && input.roleId === 'jester') ||
      (input.position === 13 && input.roleId === 'medium');
    if (!p.isAlive && !ghostAllowed) return false;
    if (input.roleId && input.roleId !== p.assignedRole) return false;
    if (input.targetId != null && String(input.targetId) === String(input.playerId)) {
      var selfAllowed = input.roleId === 'doctor' ||
        (input.position === 6 && (input.roleId === 'godfather' || input.roleId === 'mafioso'));
      if (!selfAllowed) return false;
    }
    var action = {
      position: input.position,
      roleId: input.roleId,
      playerId: input.playerId,
      targetId: input.targetId != null ? input.targetId : null,
      extra: input.extra != null ? input.extra : null
    };
    state.night.actions.push(action);
    if (action.targetId != null) p.nightTarget = action.targetId;
    if (input.position === 3 && input.extra && input.extra.jailorDecision) {
      p.jailorDecision = input.extra.jailorDecision;
    }
    return true;
  };

  E.mafiaKillActor = function (state) {
    var gf = state.players.find(function (p) { return p.assignedRole === 'godfather' && p.isAlive; });
    if (gf) return gf;
    var mf = state.players.find(function (p) { return p.assignedRole === 'mafioso' && p.isAlive; });
    return mf ? mf : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
