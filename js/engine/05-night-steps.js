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
        if (isNightOne) prompt3 += ' (Night 1: the Jailor jails and reads the will, but cannot execute.)';
        step = { position: 3, title: tpl.title, roles: tpl.roles.slice(), prompt: prompt3 };
      } else if (tpl.position === 4) {
        if (!hasLivingRole('escort') && !hasLivingRole('consort')) continue;
        step = { position: 4, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      } else if (tpl.position === 6) {
        if (!hasLivingRole('godfather') && !hasLivingRole('mafioso')) continue;
        step = { position: 6, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      } else if (tpl.position === 7) {
        if (!hasLivingRole('janitor') && !hasLivingRole('forger')) continue;
        step = { position: 7, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      } else if (tpl.position === 11) {
        var anyInvestigator = P.some(function (p) {
          return p.isAlive && (
            p.assignedRole === 'sheriff' ||
            p.assignedRole === 'tracker' ||
            p.assignedRole === 'lookout' ||
            p.assignedRole === 'consigliere' ||
            p.assignedRole === 'undertaker' ||
            (p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff')
          );
        });
        if (!anyInvestigator) continue;
        step = { position: 11, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      } else if (tpl.position === 12) {
        var retAvailable = P.some(function (p) {
          return p.isAlive && p.assignedRole === 'retributionist' && !p.usedOncePerGame;
        });
        var amnAvailable = P.some(function (p) {
          return p.isAlive && p.assignedRole === 'amnesiac' && !state.amnesiac.used;
        });
        if (!retAvailable && !amnAvailable) continue;
        var roles12 = [];
        if (retAvailable) roles12.push('retributionist');
        if (amnAvailable) roles12.push('amnesiac');
        step = { position: 12, title: tpl.title, roles: roles12, prompt: tpl.prompt };
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
})(typeof window !== 'undefined' ? window : globalThis);
