'use strict';
(function (root) {
  var E = root.VillageEngine;

  var infoNouns = {
    sheriff: 'Sheriff check', deputy: 'Sheriff check', tracker: 'Tracker follow',
    lookout: 'Lookout watch', consigliere: 'Consigliere inspection',
    undertaker: 'Undertaker inspection', spy: 'Spy watch',
    oracle: 'Oracle read', witness: 'Witness check'
  };

  var borrowedResolverByRole = {
    poisoner: 'poisoner', escort: 'roleblockers', consort: 'roleblockers',
    innkeeper: 'innkeeper', doctor: 'doctor', godfather: 'mafia', mafioso: 'mafia',
    janitor: 'janitor', forger: 'forger', blackmailer: 'blackmailer',
    demon: 'demon', serialkiller: 'serialkiller', framer: 'framer',
    sheriff: 'investigators', deputy: 'investigators', tracker: 'investigators',
    lookout: 'investigators', witness: 'investigators', consigliere: 'investigators',
    undertaker: 'investigators', spy: 'investigators', oracle: 'investigators',
    medium: 'medium'
  };

  function hasRole(state, player, roleId) {
    return player && (
      player.assignedRole === roleId ||
      (player.assignedRole === 'amnesiac' && state.amnesiac && state.amnesiac.used &&
        state.amnesiac.rememberedRole === roleId)
    );
  }

  E._witnessTeam = function (state, player) {
    if (!player) return 'NEUTRAL';
    var role = E.ROLES[player.assignedRole];
    if (!role) return 'NEUTRAL';
    if (role.team === 'TOWN') return 'TOWN';
    if (role.team === 'MAFIA') return 'MAFIA';
    if (player.assignedRole === 'serialkiller') return 'MAFIA';
    return 'NEUTRAL';
  };

  function resolveInvestigators(ctx) {
    var invActions = ctx.actions.filter(function (a) { return a.position === 11 && !ctx.isVoided(a); });
    for (var ii = 0; ii < invActions.length; ii += 1) {
      var ia = invActions[ii];
      var actor = E._byId(ctx.state, ia.playerId);
      if (!actor || !actor.isAlive) continue;
      var tgt = ia.targetId;
      if (ctx.isBlocked(actor.id)) {
        var noun = infoNouns[ia.roleId];
        if (noun && tgt != null) {
          var bt = E._byId(ctx.state, tgt);
          var bScope = bt ? bt.name : String(tgt);
          var b2 = ia.extra && ia.extra.secondTarget != null ? E._byId(ctx.state, ia.extra.secondTarget) : null;
          if (b2) bScope += ' and ' + b2.name;
          E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
            noun + ' on ' + bScope + ': no result (roleblocked).');
        }
        continue;
      }
      if (!tgt) continue;
      var isSheriffActor = hasRole(ctx.state, actor, 'sheriff') ||
        (hasRole(ctx.state, actor, 'deputy') && actor.inheritedRole === 'sheriff') ||
        (actor.assignedRole === 'necromant' && (ia.roleId === 'sheriff' || ia.roleId === 'deputy'));
      if ((ia.roleId === 'sheriff' || ia.roleId === 'deputy') && isSheriffActor) {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        var target = E._byId(ctx.state, tgt);
        var result = target.framed
          ? 'SUSPICIOUS'
          : (ctx.sheriffSuspicious(ctx.state, target) ? 'SUSPICIOUS' : 'INNOCENT');
        if (actor.isDrunk) result = result === 'SUSPICIOUS' ? 'INNOCENT' : 'SUSPICIOUS';
        ctx.log(actor.name + ' (Sheriff) checks ' + target.name + ': ' + result + '.');
        E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
          'Sheriff check on ' + target.name + ': ' + result + '.');
      } else if (ia.roleId === 'tracker') {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        ctx.deferred.push({ actor: actor, kind: 'tracker', targetId: tgt });
      } else if (ia.roleId === 'lookout') {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        ctx.deferred.push({ actor: actor, kind: 'lookout', targetId: tgt });
      } else if (ia.roleId === 'witness') {
        var w1 = tgt;
        var w2 = ia.extra && ia.extra.secondTarget != null ? ia.extra.secondTarget : null;
        if (ctx.control && ctx.control.valid && ctx.control.controlledId === actor.id && ctx.control.redirect) {
          w1 = ctx.control.redirect;
        }
        if (w1 == null || w2 == null) continue;
        var witnessA = E._byId(ctx.state, w1);
        var witnessB = E._byId(ctx.state, w2);
        if (!witnessA || !witnessB) continue;
        ctx.setEff(actor.id, w1);
        ctx.setEff(actor.id, w2);
        var wtA = E._witnessTeam(ctx.state, witnessA);
        var wtB = E._witnessTeam(ctx.state, witnessB);
        var wResult;
        if (wtA === wtB) {
          wResult = wtA === 'TOWN' ? 'Both Town' : (wtA === 'MAFIA' ? 'Both Mafia' : 'Both Neutral');
        } else {
          wResult = 'Different alignments';
        }
        if (actor.isDrunk) {
          if (wtA === wtB) {
            wResult = 'Different alignments';
          } else {
            wResult = ['Both Town', 'Both Mafia', 'Both Neutral'][E._randInt(3)];
          }
        }
        ctx.log(actor.name + ' (Witness) compares ' + witnessA.name + ' and ' + witnessB.name + ': ' + wResult + '.');
        E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
          'Witness check on ' + witnessA.name + ' and ' + witnessB.name + ': ' + wResult + '.');
      } else if (ia.roleId === 'consigliere') {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        var cTarget = E._byId(ctx.state, tgt);
        var learned = cTarget.assignedRole;
        if (actor.isDrunk) {
          var aligned = E._alignmentOf(ctx.state, cTarget);
          var pool = Object.keys(E.ROLES).filter(function (id) { return E.ROLES[id].team !== aligned; });
          learned = pool[E._randInt(pool.length)];
        }
        var lRole = E.ROLES[learned];
        var lName = lRole ? lRole.name : learned;
        ctx.log(actor.name + ' (Consigliere) learns the role of ' + cTarget.name + ': ' + lName + '.');
        E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
          'Consigliere inspection on ' + cTarget.name + ': ' + lName + '.');
      } else if (ia.roleId === 'undertaker') {
        if (!hasRole(ctx.state, actor, 'undertaker') &&
            !(actor.assignedRole === 'necromant' && ia.roleId === 'undertaker')) continue;
        var uEntry = ctx.latestEntry(ctx.state, tgt);
        if (!uEntry || uEntry.wasCleaned) continue;
        if (uEntry.inspectedByUndertaker) continue;
        uEntry.inspectedByUndertaker = true;
        ctx.setEff(actor.id, tgt);
        var uTarget = E._byId(ctx.state, tgt);
        var uRole = E.ROLES[uEntry.trueRole];
        var uName = uRole ? uRole.name : uEntry.trueRole;
        ctx.log(actor.name + ' (Undertaker) inspects the corpse of ' + uTarget.name + ': ' + uName + '.');
        E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
          'Undertaker inspection on the corpse of ' + uTarget.name + ': ' + uName + '.');
      } else if (ia.roleId === 'spy') {
        var spyTgt = tgt;
        if (ctx.control && ctx.control.valid && ctx.control.controlledId === actor.id && ctx.control.redirect) {
          spyTgt = ctx.control.redirect;
        }
        if (!ctx.alive(spyTgt)) continue;
        ctx.setEff(actor.id, spyTgt);
        var spyTarget = E._byId(ctx.state, spyTgt);
        var teams = [];
        for (var si = 0; si < ctx.effectiveTargets.length; si += 1) {
          var se = ctx.effectiveTargets[si];
          if (se.playerId === actor.id || se.targetId !== spyTgt) continue;
          var sv = E._byId(ctx.state, se.playerId);
          if (!sv) continue;
          var team = E._alignmentOf(ctx.state, sv);
          if (actor.isDrunk) team = ['TOWN', 'MAFIA', 'NEUTRAL'][E._randInt(3)];
          teams.push(team);
        }
        var spyResult = teams.length > 0 ? teams.join(', ') : 'no one';
        ctx.log(actor.name + ' (Spy) watches ' + spyTarget.name + ': ' + spyResult + '.');
        E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
          'Spy watch on ' + spyTarget.name + ': ' + spyResult + '.');
      } else if (ia.roleId === 'oracle') {
        var oracleTgt = tgt;
        if (ctx.control && ctx.control.valid && ctx.control.controlledId === actor.id && ctx.control.redirect) {
          oracleTgt = ctx.control.redirect;
        }
        if (!ctx.alive(oracleTgt)) continue;
        ctx.setEff(actor.id, oracleTgt);
        var oracleTarget = E._byId(ctx.state, oracleTgt);
        var oracleResult = E._alignmentOf(ctx.state, oracleTarget) === 'TOWN' ? 'TOWN' : 'NOT TOWN';
        if (actor.isDrunk) oracleResult = oracleResult === 'TOWN' ? 'NOT TOWN' : 'TOWN';
        ctx.log(actor.name + ' (Oracle) reads ' + oracleTarget.name + ': ' + oracleResult + '.');
        E._logPlayer(ctx.state, actor.id, E._logAt(ctx.state), 'info',
          'Oracle read on ' + oracleTarget.name + ': ' + oracleResult + '.');
      }
    }
  }

  function resolveRevivers(ctx) {
    var retAction = ctx.actions.find(function (a) { return a.position === 12 && a.roleId === 'retributionist'; });
    if (retAction) {
      var ret = E._byId(ctx.state, retAction.playerId);
      if (ret && ret.isAlive && !ctx.isBlocked(ret.id) && !ctx.isVoided(retAction) &&
          !ret.usedOncePerGame && retAction.targetId && !ctx.alive(retAction.targetId)) {
        ret.usedOncePerGame = true;
        ctx.state.retributionist.used = true;
        ctx.reviveTarget = retAction.targetId;
        ctx.setEff(ret.id, retAction.targetId);
        ctx.log(ret.name + ' will revive ' + E._byId(ctx.state, retAction.targetId).name + '.');
      }
    }

    var necAction = ctx.actions.find(function (a) { return a.position === 12 && a.roleId === 'necromant'; });
    if (necAction && !ctx.isVoided(necAction)) {
      var nec = E._byId(ctx.state, necAction.playerId);
      var corpseId = necAction.targetId;
      var corpseEntry = corpseId && ctx.latestEntry(ctx.state, corpseId);
      if (nec && nec.isAlive && !ctx.isBlocked(nec.id) && !nec.usedOncePerGame &&
          corpseId && !ctx.alive(corpseId) && corpseEntry) {
        var borrowedRoleId = corpseEntry.trueRole;
        var borrowedRole = E.ROLES[borrowedRoleId];
        var borrowedStep = E.NIGHT_STEPS && E.NIGHT_STEPS.find(function (step) {
          return step.roles && step.roles.indexOf(borrowedRoleId) >= 0;
        });
        var borrowRefused = !borrowedRole || borrowedRoleId === 'civilian' || borrowedRoleId === 'jester' ||
            borrowedRoleId === 'executioner' || borrowedRoleId === 'leper' ||
            borrowedRoleId === 'outcast' || borrowedRoleId === 'possessed' ||
            borrowedRoleId === 'survivor' || borrowedRoleId === 'imp' ||
            borrowedRole.nightAction === false || !borrowedStep;
        if (borrowRefused) {
          nec.usedOncePerGame = true;
          if (!ctx.state.necromant) ctx.state.necromant = {};
          ctx.state.necromant.used = true;
          ctx.state.necromant.rememberedRole = borrowedRoleId;
          ctx.log(nec.name + ' (Necromant) cannot borrow the role of the corpse.');
        } else {
          var borrowedAction = {
            roleId: borrowedRoleId,
            playerId: nec.id,
            targetId: necAction.extra && necAction.extra.livingTarget,
            position: borrowedStep.position
          };
          if (necAction.extra && necAction.extra.secondTarget !== undefined) {
            borrowedAction.extra = borrowedAction.extra || {};
            borrowedAction.extra.secondTarget = necAction.extra.secondTarget;
          }
          var resolverName = borrowedResolverByRole[borrowedRoleId];
          if (resolverName && E._nightActions[resolverName]) {
            var borrowedCtx = Object.create(ctx);
            borrowedCtx.actions = [borrowedAction];
            if (resolverName === 'roleblockers') borrowedCtx.rbActions = [borrowedAction];
            E._nightActions[resolverName](borrowedCtx);
            ctx.log(nec.name + ' (Necromant) borrowed the night ability of the corpse\'s role.');
            nec.usedOncePerGame = true;
            if (!ctx.state.necromant) ctx.state.necromant = {};
            ctx.state.necromant.used = true;
            ctx.state.necromant.rememberedRole = borrowedRoleId;
          } else {
            ctx.log(nec.name + ' (Necromant) cannot borrow the role of the corpse.');
          }
        }
      }
    }

    var amnAction = ctx.actions.find(function (a) { return a.position === 12 && a.roleId === 'amnesiac'; });
    if (amnAction) {
      var amn = E._byId(ctx.state, amnAction.playerId);
      if (amn && amn.isAlive && !ctx.isBlocked(amn.id) && !ctx.isVoided(amnAction) &&
          !ctx.state.amnesiac.used && amnAction.targetId && !ctx.alive(amnAction.targetId)) {
        var amnEntry = ctx.latestEntry(ctx.state, amnAction.targetId);
        if (amnEntry) {
          ctx.state.amnesiac.used = true;
          ctx.state.amnesiac.rememberedRole = amnEntry.trueRole;
          amn.usedOncePerGame = true;
          ctx.setEff(amn.id, amnAction.targetId);
          var amnRole = E.ROLES[amnEntry.trueRole];
          E._logPlayer(ctx.state, amn.id, E._logAt(ctx.state), 'remembered', amn.name + ' remembered the role ' +
            (amnRole ? amnRole.name : amnEntry.trueRole) + '.');
          ctx.log(amn.name + ' (Amnesiac) remembered the role of ' + E._byId(ctx.state, amnAction.targetId).name + ': ' +
            (amnRole ? amnRole.name : amnEntry.trueRole) + '.');
        }
      }
    }
  }

  function resolveMedium(ctx) {
    var medAction = ctx.actions.find(function (a) { return a.position === 13 && a.roleId === 'medium'; });
    if (medAction && !ctx.isVoided(medAction)) {
      var med = E._byId(ctx.state, medAction.playerId);
      if (med) {
        if (med.isAlive) {
          if (!ctx.isBlocked(med.id)) ctx.log(med.name + ' reads the Ghost Ledger.');
        } else if (medAction.targetId && ctx.alive(medAction.targetId)) {
          ctx.setEff(med.id, medAction.targetId);
          ctx.log(med.name + ' whispers with ' + E._byId(ctx.state, medAction.targetId).name + '.');
        }
      }
    }
  }

  function resolveDeferred(ctx) {
    for (var di = 0; di < ctx.deferred.length; di += 1) {
      var d = ctx.deferred[di];
      var dTarget = E._byId(ctx.state, d.targetId);
      if (d.kind === 'tracker') {
        var eff = ctx.getEff(d.targetId);
        var tName = eff ? E._byId(ctx.state, eff).name : 'no one';
        ctx.log(d.actor.name + ' (Tracker) tracks ' + dTarget.name + ': ' + tName + '.');
        E._logPlayer(ctx.state, d.actor.id, E._logAt(ctx.state), 'info',
          'Tracker follow on ' + dTarget.name + ': ' + tName + '.');
      } else {
        var visitors = [];
        for (var ei = 0; ei < ctx.effectiveTargets.length; ei += 1) {
          var e2 = ctx.effectiveTargets[ei];
          if (e2.targetId === d.targetId && e2.playerId !== d.actor.id) {
            var vp = E._byId(ctx.state, e2.playerId);
            if (vp) visitors.push(vp.name);
          }
        }
        var vText = visitors.length > 0 ? visitors.join(', ') : 'no one';
        ctx.log(d.actor.name + ' (Lookout) watches ' + dTarget.name + ': ' + vText + '.');
        E._logPlayer(ctx.state, d.actor.id, E._logAt(ctx.state), 'info',
          'Lookout watch on ' + dTarget.name + ': ' + vText + '.');
      }
    }

    ctx.state.players.forEach(function (leper) {
      if (leper.assignedRole !== 'leper' || !leper.isAlive) return;
      ctx.effectiveTargets.forEach(function (entry) {
        if (entry.targetId !== leper.id || entry.playerId === leper.id) return;
        var visitor = E._byId(ctx.state, entry.playerId);
        if (!visitor || !visitor.isAlive || visitor.poisoned) return;
        visitor.isDrunk = true;
        visitor.poisoned = true;
        visitor.leperDrunkUntil = ctx.nightNum + 1;
        E._logPlayer(ctx.state, visitor.id, E._logAt(ctx.state), 'poisoned',
          visitor.name + ' was poisoned by the Leper and is Drunk for one cycle.');
        ctx.log(leper.name + ' poisoned ' + visitor.name + '.');
      });
    });
  }

  E._nightActions = Object.assign({}, E._nightActions, {
    investigators: resolveInvestigators,
    revivers: resolveRevivers,
    medium: resolveMedium,
    deferred: resolveDeferred
  });
})(typeof window !== 'undefined' ? window : globalThis);