'use strict';
(function (root) {
  var E = root.VillageEngine;

  E.getNightZeroSteps = function (state) {
    var P = state.players || [];
    var hasLivingRole = function (roleId) {
      return P.some(function (p) {
        return p.isAlive && p.assignedRole === roleId;
      });
    };
    var steps = [];
    var hasAny = false;
    E.NIGHT_ZERO_STEPS.forEach(function (tpl) {
      if (!tpl.roles.length) return;
      if (tpl.roles.some(hasLivingRole)) {
        hasAny = true;
        steps.push({
          position: tpl.position,
          title: tpl.title,
          roles: tpl.roles.slice(),
          prompt: tpl.prompt
        });
      }
    });
    if (hasAny) {
      var morning = E.NIGHT_ZERO_STEPS[E.NIGHT_ZERO_STEPS.length - 1];
      steps.push({
        position: morning.position,
        title: morning.title,
        roles: [],
        prompt: morning.prompt
      });
    }
    return steps;
  };

  E.getNightSteps = function (state) {
    var steps = [];
    var nightNum = state.night.number;
    var isNightOne = nightNum === 1;
    var P = state.players;
    var amn = state.amnesiac || {};
    var hasLivingRole = function (roleId) {
      return P.some(function (p) {
        return p.isAlive && (
          p.assignedRole === roleId ||
          (p.assignedRole === 'amnesiac' && amn.used && amn.rememberedRole === roleId)
        );
      });
    };
    var hauntPending = state.jester.haunted && state.jester.hauntTarget === null;

    for (var i = 0; i < E.NIGHT_STEPS.length; i += 1) {
      var tpl = E.NIGHT_STEPS[i];
      var step = null;
      if (tpl.position === 0) {
        var vetAvailable = P.some(function (p) {
          return p.isAlive &&
            (p.assignedRole === 'veteran' ||
              (p.assignedRole === 'amnesiac' && amn.used && amn.rememberedRole === 'veteran')) &&
            p.alertsUsed < 3;
        });
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
        var livingSheriff = hasLivingRole('sheriff');
        var inheritedDeputy = P.some(function (p) {
          return p.isAlive && p.assignedRole === 'deputy' && p.inheritedRole === 'sheriff';
        });
        if (!livingSheriff && !inheritedDeputy) continue;
        var roles11 = [];
        if (livingSheriff) roles11.push('sheriff');
        if (inheritedDeputy) roles11.push('deputy');
        step = { position: 11, title: tpl.title, roles: roles11, prompt: tpl.prompt };
      } else if (tpl.position === 12 && tpl.title === 'Retributionist') {
        var retAvailable = hasLivingRole('retributionist') && !P.some(function (p) {
          return p.isAlive && p.assignedRole === 'retributionist' && p.usedOncePerGame;
        });
        if (!retAvailable) continue;
        step = { position: 12, title: tpl.title, roles: ['retributionist'], prompt: tpl.prompt };
      } else if (tpl.position === 12 && tpl.title === 'Amnesiac') {
        var amnAvailable = hasLivingRole('amnesiac') && !amn.used;
        if (!amnAvailable) continue;
        step = { position: 12, title: tpl.title, roles: ['amnesiac'], prompt: tpl.prompt };
      } else if (tpl.position === 13) {
        var anyMedium = P.some(function (p) {
          return p.assignedRole === 'medium' ||
            (p.assignedRole === 'amnesiac' && amn.used && amn.rememberedRole === 'medium');
        });
        if (!anyMedium) continue;
        step = { position: 13, title: tpl.title, roles: tpl.roles.slice(), prompt: tpl.prompt };
      } else if (tpl.roles.length === 0) {
        step = { position: tpl.position, title: tpl.title, roles: [], prompt: tpl.prompt };
        if (tpl.timerSeconds) step.timerSeconds = tpl.timerSeconds;
      } else {
        var rolesHere = tpl.roles.slice();
        var present = rolesHere.some(function (r) { return hasLivingRole(r); });
        if (!present) continue;
        step = { position: tpl.position, title: tpl.title, roles: rolesHere, prompt: tpl.prompt };
      }
      if (step) steps.push(step);
    }
    return steps;
  };

  E.recordNightAction = function (state, input) {
    input = input || {};
    var p = E._byId(state, input.playerId);
    if (!p) return false;
    var amn = state.amnesiac || {};
    var rememberedRoleAllowed = p.assignedRole === 'amnesiac' &&
      amn.used && input.roleId === amn.rememberedRole;
    var ghostAllowed = (input.position === 0 && input.roleId === 'jester') ||
      (input.position === 13 && input.roleId === 'medium');
    if (!p.isAlive && !ghostAllowed) return false;
    if (input.roleId && input.roleId !== p.assignedRole && !rememberedRoleAllowed) return false;
    if (input.position === 6 && input.targetId != null) {
      var killLeader = state.players.find(function (player) {
        return player.assignedRole === 'godfather' && player.isAlive;
      });
      if (!killLeader) {
        killLeader = state.players.find(function (player) {
          return player.assignedRole === 'mafioso' && player.isAlive;
        });
      }
      if (killLeader && String(input.targetId) === String(killLeader.id)) return false;
    }
    if (input.targetId != null && String(input.targetId) === String(input.playerId)) {
      if (input.roleId !== 'doctor') return false;
    }
    var secondTarget = input.extra && input.extra.secondTarget;
    if (secondTarget != null && String(secondTarget) === String(input.playerId)) return false;
    if (secondTarget != null && String(secondTarget) === String(input.targetId)) return false;
    var action = {
      position: input.position,
      roleId: input.roleId,
      playerId: input.playerId,
      targetId: input.targetId != null ? input.targetId : null,
      extra: input.extra != null ? input.extra : null
    };
    var isNew = !state.night.actions.some(function (a) {
      return a.position === action.position && a.roleId === action.roleId &&
        a.playerId === action.playerId && a.targetId === action.targetId &&
        JSON.stringify(a.extra || null) === JSON.stringify(action.extra || null);
    });
    var replacing = state.night.actions.some(function (a) {
      return a.position === action.position && a.roleId === action.roleId &&
        a.playerId === action.playerId;
    });
    state.night.actions.push(action);
    if (isNew) {
      if (replacing) {
        var atKey = E._logAt(state);
        var logKey = String(input.playerId);
        var logArr = state.playerLog && state.playerLog[logKey];
        if (logArr) {
          state.playerLog[logKey] = logArr.filter(function (e) {
            return !(e.kind === 'night-action' && e.at === atKey);
          });
        }
      }
      var role = E.ROLES[action.roleId];
      var roleName = role ? role.name : action.roleId;
      var tgt = action.targetId != null ? E._byId(state, action.targetId) : null;
      var targetName = tgt ? tgt.name : String(action.targetId);
      var extra2 = action.extra || {};
      var text;
      if (action.roleId === 'veteran' && extra2.alert) {
        text = roleName + ' went on alert.';
      } else if (action.roleId === 'jailor') {
        text = roleName + ' jailed ' + targetName + ' and chose ' + (extra2.jailorDecision || 'SPARE') + '.';
      } else if (action.roleId === 'medium' && tgt) {
        text = roleName + ' whispered with ' + targetName + '.';
      } else if (action.roleId === 'medium') {
        text = roleName + ' read the Ghost Ledger.';
      } else if (action.roleId === 'witness' && extra2.secondTarget != null) {
        var st2 = E._byId(state, extra2.secondTarget);
        text = roleName + ' targeted ' + targetName + ' and ' + (st2 ? st2.name : String(extra2.secondTarget)) + '.';
      } else if (action.targetId == null) {
        text = roleName + ' acted.';
      } else {
        text = roleName + ' targeted ' + targetName + '.';
      }
      E._logPlayer(state, input.playerId, E._logAt(state), 'night-action', text);
    }
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
