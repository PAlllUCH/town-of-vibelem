'use strict';
(function (root) {
  var E = root.VillageEngine;

  function resolvePoisoner(ctx) {
    var poisonAction = ctx.actions.find(function (a) { return a.position === 1 && a.roleId === 'poisoner'; });
    if (poisonAction) {
      var poisoner = E._byId(ctx.state, poisonAction.playerId);
      if (poisoner && poisoner.isAlive && !ctx.isBlocked(poisoner.id) && !ctx.isVoided(poisonAction) &&
          poisonAction.targetId && ctx.alive(poisonAction.targetId)) {
        var poisonedTarget = E._byId(ctx.state, poisonAction.targetId);
        poisonedTarget.isDrunk = true;
        poisonedTarget.poisoned = true;
        ctx.setEff(poisoner.id, poisonAction.targetId);
        ctx.log(poisoner.name + ' poisoned ' + poisonedTarget.name + '.');
      }
    }
  }

  function resolveWitchReveal(ctx) {
    if (ctx.witchAction && ctx.control && ctx.control.valid &&
        E._byId(ctx.state, ctx.witchAction.playerId).isAlive) {
      var w = E._byId(ctx.state, ctx.witchAction.playerId);
      ctx.setEff(w.id, ctx.control.controlledId);
      var ctrl = E._byId(ctx.state, ctx.control.controlledId);
      var ctrlRole = E.ROLES[ctrl.assignedRole];
      ctx.log('The Witch controls ' + ctrl.name + ' and learns their role: ' + (ctrlRole ? ctrlRole.name : ctrl.assignedRole) + '.');
    }
  }

  function resolveJailor(ctx) {
    if (ctx.jailAction) {
      var jailTarget = ctx.jailAction.targetId;
      if (ctx.control && ctx.control.valid && ctx.control.controlledId === ctx.jailor.id && ctx.control.redirect) {
        jailTarget = ctx.control.redirect;
      }
      if (ctx.jailor && ctx.jailor.isAlive && !ctx.isBlocked(ctx.jailor.id) && !ctx.isVoided(ctx.jailAction) &&
          jailTarget && ctx.alive(jailTarget) && jailTarget !== ctx.state.night.lastJailTarget) {
        ctx.blocked.push(jailTarget);
        ctx.setEff(ctx.jailor.id, jailTarget);
        var jailed = E._byId(ctx.state, jailTarget);
        jailed.jailed = true;
        ctx.log(ctx.jailor.name + ' jailed ' + jailed.name + '.');
        var decision = (ctx.jailAction.extra && ctx.jailAction.extra.jailorDecision) || 'SPARE';
        if (decision === 'EXECUTE' && ctx.nightNum !== 1 && !ctx.noKillN1 && ctx.jailor.executionsUsed < 3) {
          ctx.jailor.executionsUsed += 1;
          ctx.applyAttack(jailTarget, 'unstoppable', 'executed by the Jailor');
        }
        ctx.state.night.lastJailTarget = jailTarget;
      } else {
        ctx.state.night.lastJailTarget = null;
      }
    }
  }

  function resolveRoleblockers(ctx) {
    for (var rbi2 = 0; rbi2 < ctx.rbActions.length; rbi2 += 1) {
      var rba2 = ctx.rbActions[rbi2];
      if (ctx.isVoided(rba2)) continue;
      var rbActor2 = E._byId(ctx.state, rba2.playerId);
      if (!rbActor2 || !rbActor2.isAlive || ctx.isBlocked(rbActor2.id)) continue;
      if (rba2.targetId && ctx.alive(rba2.targetId)) {
        ctx.blocked.push(rba2.targetId);
        ctx.setEff(rbActor2.id, rba2.targetId);
        ctx.log(rbActor2.name + ' roleblocked ' + E._byId(ctx.state, rba2.targetId).name + '.');
      }
    }
  }

  function resolveDoctor(ctx) {
    var docAction = ctx.actions.find(function (a) { return a.position === 5 && a.roleId === 'doctor'; });
    if (docAction) {
      var doc = E._byId(ctx.state, docAction.playerId);
      if (doc && doc.isAlive && !ctx.isBlocked(doc.id) && !ctx.isVoided(docAction) && !doc.isDrunk &&
          docAction.targetId && ctx.alive(docAction.targetId)) {
        E._byId(ctx.state, docAction.targetId).isProtected = true;
        ctx.setEff(doc.id, docAction.targetId);
        ctx.log(doc.name + ' protected ' + E._byId(ctx.state, docAction.targetId).name + '.');
      }
    }
  }

  function resolveMafia(ctx) {
    var mafiaAction = ctx.actions.find(function (a) {
      return a.position === 6 && (a.roleId === 'godfather' || a.roleId === 'mafioso');
    });
    if (mafiaAction && !ctx.isVoided(mafiaAction)) {
      var gf = ctx.state.players.find(function (p) { return p.assignedRole === 'godfather'; });
      var mafioso = ctx.state.players.find(function (p) { return p.assignedRole === 'mafioso'; });
      var gfAlive = !!gf && gf.isAlive;
      var mfAlive = !!mafioso && mafioso.isAlive;
      var gfBlocked = gfAlive && ctx.isBlocked(gf.id);
      var mfBlocked = mfAlive && ctx.isBlocked(mafioso.id);
      var killer = null;
      if (gfAlive && !gfBlocked) killer = gf;
      else if (mfAlive && !mfBlocked) killer = mafioso;
      if (killer) {
        var mTarget = mafiaAction.targetId;
        if (ctx.control && ctx.control.valid && ctx.control.controlledId === gf.id && ctx.control.redirect) {
          mTarget = ctx.control.redirect;
        }
        if (mTarget && ctx.alive(mTarget)) {
          ctx.setEff(killer.id, mTarget);
          if (ctx.noKillN1) {
            ctx.log('The Mafia kill is void (No Kill on Night One): ' + E._byId(ctx.state, mTarget).name + ' is unharmed.');
          } else {
            ctx.applyAttack(mTarget, 'basic', 'killed by the Mafia');
            ctx.log('The Mafia killed ' + E._byId(ctx.state, mTarget).name + '.');
          }
        }
      } else {
        ctx.log('The Mafia kill failed: no available killer.');
      }
    }
  }

  function resolveJanitor(ctx) {
    var janitorAction = ctx.actions.find(function (a) { return a.position === 7 && a.roleId === 'janitor'; });
    if (janitorAction) {
      var janitor = E._byId(ctx.state, janitorAction.playerId);
      if (janitor && janitor.isAlive && !ctx.isBlocked(janitor.id) && !ctx.isVoided(janitorAction) &&
          !janitor.isDrunk && janitorAction.targetId && !ctx.alive(janitorAction.targetId)) {
        var jEntry = ctx.latestEntry(ctx.state, janitorAction.targetId);
        if (jEntry) {
          jEntry.wasCleaned = true;
          var jd = ctx.deaths.find(function (d) { return d.playerId === janitorAction.targetId; });
          if (jd) jd.wasCleaned = true;
          var jp = E._byId(ctx.state, janitorAction.targetId);
          if (jp) jp.cleaned = true;
          ctx.setEff(janitor.id, janitorAction.targetId);
          ctx.log(janitor.name + ' cleaned the corpse of ' + E._byId(ctx.state, janitorAction.targetId).name + '.');
        }
      }
    }
  }

  function resolveForger(ctx) {
    var forgerAction = ctx.actions.find(function (a) { return a.position === 7 && a.roleId === 'forger'; });
    if (forgerAction) {
      var forger = E._byId(ctx.state, forgerAction.playerId);
      if (forger && forger.isAlive && !ctx.isBlocked(forger.id) && !ctx.isVoided(forgerAction) && forgerAction.targetId) {
        ctx.forgedWills[forgerAction.targetId] = true;
        ctx.setEff(forger.id, forgerAction.targetId);
        ctx.log(forger.name + ' forged a will for ' + E._byId(ctx.state, forgerAction.targetId).name + '.');
      }
    }
  }

  function resolveBlackmailer(ctx) {
    var bmAction = ctx.actions.find(function (a) { return a.position === 8 && a.roleId === 'blackmailer'; });
    if (bmAction) {
      var bm = E._byId(ctx.state, bmAction.playerId);
      if (bm && bm.isAlive && !ctx.isBlocked(bm.id) && !ctx.isVoided(bmAction) &&
          bmAction.targetId && ctx.alive(bmAction.targetId) && bmAction.targetId !== ctx.prevBlackmailTarget) {
        E._byId(ctx.state, bmAction.targetId).blackmailed = true;
        ctx.state.night.lastBlackmailTarget = bmAction.targetId;
        ctx.setEff(bm.id, bmAction.targetId);
        ctx.log(bm.name + ' blackmailed ' + E._byId(ctx.state, bmAction.targetId).name + '.');
      }
    }
  }

  function resolveSerialKiller(ctx) {
    var skAction = ctx.actions.find(function (a) { return a.position === 9 && a.roleId === 'serialkiller'; });
    if (skAction && !ctx.isVoided(skAction)) {
      var sk = E._byId(ctx.state, skAction.playerId);
      if (sk && sk.isAlive && !ctx.isBlocked(sk.id) && skAction.targetId) {
        var skTarget = skAction.targetId;
        if (ctx.control && ctx.control.valid && ctx.control.controlledId === sk.id && ctx.control.redirect) {
          skTarget = ctx.control.redirect;
        }
        if (ctx.alive(skTarget)) {
          ctx.setEff(sk.id, skTarget);
          if (!ctx.noKillN1) ctx.applyAttack(skTarget, 'basic', 'killed by the Serial Killer');
          ctx.log('The Serial Killer attacked ' + E._byId(ctx.state, skTarget).name + '.');
        }
      }
    }
  }

  function resolveFramer(ctx) {
    var frAction = ctx.actions.find(function (a) { return a.position === 10 && a.roleId === 'framer'; });
    if (frAction) {
      var fr = E._byId(ctx.state, frAction.playerId);
      if (fr && fr.isAlive && !ctx.isBlocked(fr.id) && !ctx.isVoided(frAction) &&
          frAction.targetId && ctx.alive(frAction.targetId)) {
        E._byId(ctx.state, frAction.targetId).framed = true;
        ctx.setEff(fr.id, frAction.targetId);
        ctx.log(fr.name + ' framed ' + E._byId(ctx.state, frAction.targetId).name + '.');
      }
    }
  }

  function resolveInvestigators(ctx) {
    var invActions = ctx.actions.filter(function (a) { return a.position === 11 && !ctx.isVoided(a); });
    for (var ii = 0; ii < invActions.length; ii += 1) {
      var ia = invActions[ii];
      var actor = E._byId(ctx.state, ia.playerId);
      if (!actor || !actor.isAlive || ctx.isBlocked(actor.id)) continue;
      var tgt = ia.targetId;
      if (!tgt) continue;
      var isSheriffActor = actor.assignedRole === 'sheriff' ||
        (actor.assignedRole === 'deputy' && actor.inheritedRole === 'sheriff');
      if ((ia.roleId === 'sheriff' || ia.roleId === 'deputy') && isSheriffActor) {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        var target = E._byId(ctx.state, tgt);
        var result = target.framed
          ? 'SUSPICIOUS'
          : (ctx.sheriffSuspicious(ctx.state, target) ? 'SUSPICIOUS' : 'INNOCENT');
        if (actor.isDrunk) result = result === 'SUSPICIOUS' ? 'INNOCENT' : 'SUSPICIOUS';
        ctx.log(actor.name + ' (Sheriff) checks ' + target.name + ': ' + result + '.');
      } else if (ia.roleId === 'tracker') {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        ctx.deferred.push({ actor: actor, kind: 'tracker', targetId: tgt });
      } else if (ia.roleId === 'lookout') {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        ctx.deferred.push({ actor: actor, kind: 'lookout', targetId: tgt });
      } else if (ia.roleId === 'consigliere') {
        if (!ctx.alive(tgt)) continue;
        ctx.setEff(actor.id, tgt);
        var learned = E._byId(ctx.state, tgt).assignedRole;
        if (actor.isDrunk) {
          var aligned = E._alignmentOf(ctx.state, E._byId(ctx.state, tgt));
          var pool = Object.keys(E.ROLES).filter(function (id) { return E.ROLES[id].team !== aligned; });
          learned = pool[E._randInt(pool.length)];
        }
        var lRole = E.ROLES[learned];
        ctx.log(actor.name + ' (Consigliere) learns the role of ' + E._byId(ctx.state, tgt).name + ': ' +
          (lRole ? lRole.name : learned) + '.');
      } else if (ia.roleId === 'undertaker') {
        if (actor.assignedRole !== 'undertaker') continue;
        var uEntry = ctx.latestEntry(ctx.state, tgt);
        if (!uEntry || uEntry.wasCleaned) continue;
        if (uEntry.inspectedByUndertaker) continue;
        uEntry.inspectedByUndertaker = true;
        ctx.setEff(actor.id, tgt);
        var uRole = E.ROLES[uEntry.trueRole];
        ctx.log(actor.name + ' (Undertaker) inspects the corpse of ' + E._byId(ctx.state, tgt).name + ': ' +
          (uRole ? uRole.name : uEntry.trueRole) + '.');
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
      if (d.kind === 'tracker') {
        var eff = ctx.getEff(d.targetId);
        ctx.log(d.actor.name + ' (Tracker) tracks ' + E._byId(ctx.state, d.targetId).name + ': ' +
          (eff ? E._byId(ctx.state, eff).name : 'no one') + '.');
      } else {
        var visitors = [];
        for (var ei = 0; ei < ctx.effectiveTargets.length; ei += 1) {
          var e2 = ctx.effectiveTargets[ei];
          if (e2.targetId === d.targetId && e2.playerId !== d.actor.id) {
            var vp = E._byId(ctx.state, e2.playerId);
            if (vp) visitors.push(vp.name);
          }
        }
        ctx.log(d.actor.name + ' (Lookout) watches ' + E._byId(ctx.state, d.targetId).name + ': ' +
          (visitors.length > 0 ? visitors.join(', ') : 'no one') + '.');
      }
    }
  }

  E._nightActions = {
    poisoner: resolvePoisoner,
    witchReveal: resolveWitchReveal,
    jailor: resolveJailor,
    roleblockers: resolveRoleblockers,
    doctor: resolveDoctor,
    mafia: resolveMafia,
    janitor: resolveJanitor,
    forger: resolveForger,
    blackmailer: resolveBlackmailer,
    serialkiller: resolveSerialKiller,
    framer: resolveFramer,
    investigators: resolveInvestigators,
    revivers: resolveRevivers,
    medium: resolveMedium,
    deferred: resolveDeferred
  };
})(typeof window !== 'undefined' ? window : globalThis);
