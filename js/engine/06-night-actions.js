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
        E._logPlayer(ctx.state, poisonAction.targetId, E._logAt(ctx.state), 'poisoned', poisonedTarget.name + ' was poisoned and is Drunk for one cycle.');
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
      var ctrlName = ctrlRole ? ctrlRole.name : ctrl.assignedRole;
      ctx.log('The Witch controls ' + ctrl.name + ' and learns their role: ' + ctrlName + '.');
      E._logPlayer(ctx.state, w.id, E._logAt(ctx.state), 'info',
        'Witch learned the role of ' + ctrl.name + ': ' + ctrlName + '.');
    }
  }

  function resolveInnkeeper(ctx) {
    var action = ctx.actions.find(function (a) { return a.position === 4 && a.roleId === 'innkeeper'; });
    if (!action) return;
    var innkeeper = E._byId(ctx.state, action.playerId);
    if (!innkeeper || !innkeeper.isAlive || ctx.isBlocked(innkeeper.id) || ctx.isVoided(action)) return;
    if (innkeeper.isDrunk) return;
    var guestId = action.targetId;
    if (!guestId || !ctx.alive(guestId)) return;
    var guest = E._byId(ctx.state, guestId);
    innkeeper.isProtected = true;
    guest.isProtected = true;
    guest.protectedByInnkeeper = true;
    innkeeper.protectedByInnkeeper = true;
    ctx.blocked.push(guestId);
    ctx.setEff(innkeeper.id, guestId);
    E._logPlayer(ctx.state, guestId, E._logAt(ctx.state), 'protected', guest.name + ' drank at the inn and was protected.');
    E._logPlayer(ctx.state, innkeeper.id, E._logAt(ctx.state), 'protected', innkeeper.name + ' worked at the inn and was protected.');
    ctx.log(innkeeper.name + ' shared a drink with ' + guest.name + ' at the inn; both are protected.');
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
        E._logPlayer(ctx.state, jailTarget, E._logAt(ctx.state), 'jailed', jailed.name + ' was jailed by the Jailor.');
        ctx.log(ctx.jailor.name + ' jailed ' + jailed.name + '.');
        var decision = (ctx.jailAction.extra && ctx.jailAction.extra.jailorDecision) || 'SPARE';
        if (decision === 'EXECUTE' && ctx.nightNum !== 1 && !ctx.noKillN1) {
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
      return a.position === 6 && (a.roleId === 'godfather' || a.roleId === 'mafioso' || a.roleId === 'amnesiac');
    });
    if (mafiaAction && !ctx.isVoided(mafiaAction)) {
      var rememberedRole = ctx.state.amnesiac && ctx.state.amnesiac.rememberedRole;
      var amnesiac = ctx.state.players.find(function (p) {
        return p.assignedRole === 'amnesiac' &&
          (rememberedRole === 'godfather' || rememberedRole === 'mafioso');
      });
      var effectiveRole = function (p) {
        if (p.assignedRole === 'godfather' || p.assignedRole === 'mafioso') return p.assignedRole;
        if (p === amnesiac) return rememberedRole;
        return null;
      };
      var gf = ctx.state.players.find(function (p) { return effectiveRole(p) === 'godfather'; });
      var mafioso = ctx.state.players.find(function (p) { return effectiveRole(p) === 'mafioso'; });
      var gfAlive = !!gf && gf.isAlive;
      var mfAlive = !!mafioso && mafioso.isAlive;
      var gfBlocked = gfAlive && ctx.isBlocked(gf.id);
      var mfBlocked = mfAlive && ctx.isBlocked(mafioso.id);
      var killer = null;
      if (gfAlive && !gfBlocked) killer = gf;
      else if (mfAlive && !mfBlocked) killer = mafioso;
      if (killer) {
        var mTarget = mafiaAction.targetId;
        if (ctx.control && ctx.control.valid && gf && ctx.control.controlledId === gf.id && ctx.control.redirect) {
          mTarget = ctx.control.redirect;
        }
        if (mTarget === killer.id) {
          ctx.log('The Mafia kill failed: the kill may not target the kill leader.');
        } else if (mTarget && ctx.alive(mTarget)) {
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

  function resolveDemon(ctx) {
    var action = ctx.actions.find(function (a) { return a.position === 9 && a.roleId === 'demon'; });
    if (!action || ctx.isVoided(action)) return;
    var demon = E._byId(ctx.state, action.playerId);
    if (demon && demon.isAlive && !ctx.isBlocked(demon.id) && action.targetId && ctx.alive(action.targetId)) {
      ctx.setEff(demon.id, action.targetId);
      if (!ctx.noKillN1) ctx.applyAttack(action.targetId, 'basic', 'killed by the Demon');
      ctx.log(demon.name + ' attacked ' + E._byId(ctx.state, action.targetId).name + '.');
    }
  }

  function resolveSuccubus(ctx) {
    var action = ctx.actions.find(function (a) { return a.position === 11 && a.roleId === 'succubus'; });
    if (!action || ctx.isVoided(action)) return;
    var succubus = E._byId(ctx.state, action.playerId);
    if (succubus && succubus.isAlive && !ctx.isBlocked(succubus.id) && action.targetId && ctx.alive(action.targetId)) {
      var target = E._byId(ctx.state, action.targetId);
      target.enchanted = true;
      ctx.setEff(succubus.id, target.id);
      ctx.log(succubus.name + ' enchanted ' + target.name + '.');
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
        E._logPlayer(ctx.state, bmAction.targetId, E._logAt(ctx.state), 'blackmailed', E._byId(ctx.state, bmAction.targetId).name + ' was blackmailed; silenced next day.');
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

  E._nightActions = {
    poisoner: resolvePoisoner,
    witchReveal: resolveWitchReveal,
    innkeeper: resolveInnkeeper,
    jailor: resolveJailor,
    roleblockers: resolveRoleblockers,
    doctor: resolveDoctor,
    mafia: resolveMafia,
    janitor: resolveJanitor,
    forger: resolveForger,
    blackmailer: resolveBlackmailer,
    demon: resolveDemon,
    serialkiller: resolveSerialKiller,
    framer: resolveFramer,
    succubus: resolveSuccubus
  };
})(typeof window !== 'undefined' ? window : globalThis);
