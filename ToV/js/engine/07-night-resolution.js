'use strict';
(function (root) {
  var E = root.VillageEngine;

  E._alignmentOf = function (state, player) {
    if (!player) return 'NEUTRAL';
    if (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole) {
      var r = E.ROLES[state.amnesiac.rememberedRole];
      return r ? r.team : 'NEUTRAL';
    }
    if (player.assignedRole === 'witch') {
      return state.witchSide === 'TOWN' ? 'TOWN' : 'MAFIA';
    }
    var role = E.ROLES[player.assignedRole];
    return role ? role.team : 'NEUTRAL';
  };

  function isGodfatherLike(state, player) {
    return player.assignedRole === 'godfather' ||
      player.inheritedRole === 'godfather' ||
      (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'godfather');
  }

  E._isSerialKiller = function (state, player) {
    return player.assignedRole === 'serialkiller' ||
      (player.assignedRole === 'amnesiac' && state.amnesiac.used && state.amnesiac.rememberedRole === 'serialkiller');
  };

  E._hasBasicDefense = function (state, player) {
    return isGodfatherLike(state, player) || E._isSerialKiller(state, player);
  };

  function sheriffSuspicious(state, player) {
    if (isGodfatherLike(state, player)) return false;
    if (E._isSerialKiller(state, player)) return true;
    return E._alignmentOf(state, player) === 'MAFIA';
  }

  function latestEntry(state, pid) {
    for (var i = state.graveyard.length - 1; i >= 0; i -= 1) {
      if (state.graveyard[i].playerId === pid) return state.graveyard[i];
    }
    return null;
  }

  function convertExecutioner(state, cause) {
    if (state.executionerConverted || !state.executionerTarget) return;
    var p = E._byId(state, state.executionerTarget);
    state.executionerConverted = true;
    state.logs.push('The Executioner\'s target ' + (p ? p.name : String(state.executionerTarget)) +
      ' died (' + cause + '); the Executioner becomes a Jester.');
  }

  E._recordDeath = function (state, pid, cause, byLynch, skipToken) {
    var p = E._byId(state, pid);
    if (!p || !p.isAlive) return null;
    p.isAlive = false;
    var firstDeath = !state.graveyard.some(function (e) { return e.playerId === pid; });
    if (firstDeath && !skipToken) p.hasGhostVote = true;
    var entry = {
      playerId: pid,
      name: p.name,
      trueRole: p.assignedRole,
      inspectedByUndertaker: false,
      wasCleaned: false,
      lastWill: p.lastWill,
      deathCause: cause,
      willShown: p.lastWill
    };
    state.graveyard.push(entry);
    if (!byLynch && state.executionerTarget === pid) convertExecutioner(state, cause);
    return entry;
  };

  E._livingSharers = function (state) {
    return state.players.filter(function (p) {
      if (!p.isAlive) return false;
      var r = p.assignedRole;
      return r === 'survivor' || r === 'drunk' || (r === 'amnesiac' && !state.amnesiac.used);
    }).map(function (p) { return p.id; });
  };

  E._updateInheritance = function (state) {
    var sheriff = state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    var deputy = state.players.find(function (p) { return p.assignedRole === 'deputy'; });
    if (sheriff && !sheriff.isAlive && deputy && deputy.isAlive && deputy.inheritedRole !== 'sheriff') {
      deputy.inheritedRole = 'sheriff';
      state.pendingInheritanceNote = 'The Deputy has inherited the Sheriff\'s badge.';
      state.logs.push('The Deputy has inherited the Sheriff\'s badge.');
    }
    var gf = state.players.find(function (p) { return p.assignedRole === 'godfather'; });
    var mafioso = state.players.find(function (p) { return p.assignedRole === 'mafioso'; });
    if (gf && !gf.isAlive && mafioso && mafioso.isAlive && mafioso.inheritedRole !== 'godfather') {
      mafioso.inheritedRole = 'godfather';
      state.logs.push('The Mafioso has become the new Godfather.');
    }
  };

  E.resolveNight = function (state) {
    var logs = [];
    var deaths = [];
    var revivals = [];
    var nightNum = state.night.number;
    var noKillN1 = !!state.houseRules.noKillN1 && nightNum === 1;
    var actions = state.night.actions.slice();
    var P = state.players;
    var alive = function (id) {
      var p = E._byId(state, id);
      return !!p && p.isAlive;
    };
    var voided = [];
    var isVoided = function (a) { return voided.indexOf(a) !== -1; };
    var blocked = [];
    var isBlocked = function (id) { return blocked.indexOf(id) !== -1; };
    var effectiveTargets = [];
    var getEff = function (pid) {
      for (var i = 0; i < effectiveTargets.length; i += 1) {
        if (effectiveTargets[i].playerId === pid) return effectiveTargets[i].targetId;
      }
      return null;
    };
    var setEff = function (pid, tid) {
      for (var i = 0; i < effectiveTargets.length; i += 1) {
        if (effectiveTargets[i].playerId === pid) {
          effectiveTargets[i].targetId = tid;
          return;
        }
      }
      effectiveTargets.push({ playerId: pid, targetId: tid });
    };
    var forgedWills = {};
    var log = function (m) {
      var line = '[Night ' + nightNum + '] ' + m;
      logs.push(line);
      state.logs.push(line);
    };

    function killPlayer(targetId, cause) {
      var target = E._byId(state, targetId);
      if (!target || !target.isAlive) return false;
      E._recordDeath(state, targetId, cause, false, false);
      deaths.push({
        playerId: targetId, name: target.name, cause: cause,
        trueRole: target.assignedRole, will: target.lastWill, wasCleaned: false
      });
      log(target.name + ' died: ' + cause + '.');
      return true;
    }

    function applyAttack(targetId, type, cause) {
      if (veteranAlerting && vet && targetId === vet.id) return false;
      var target = E._byId(state, targetId);
      if (!target || !target.isAlive) return false;
      if (type === 'unstoppable') return killPlayer(targetId, cause);
      if (target.isProtected) {
        target.isProtected = false;
        log(target.name + ' survived an attack (Doctor protection).');
        return false;
      }
      if (E._hasBasicDefense(state, target)) {
        log(target.name + ' survived the attack.');
        return false;
      }
      return killPlayer(targetId, cause);
    }

    P.forEach(function (p) {
      if (p.assignedRole === 'drunk') p.isDrunk = true;
      else p.isDrunk = false;
      p.isRoleblocked = false;
      p.isProtected = false;
      p.framed = false;
      p.jailed = false;
      p.poisoned = false;
      p.alerted = false;
      p.nightTarget = null;
      p.jailorDecision = null;
    });

    var prevBlackmailTarget = null;
    for (var pi = 0; pi < P.length; pi += 1) {
      if (P[pi].blackmailed) prevBlackmailTarget = P[pi].id;
      P[pi].blackmailed = false;
    }
    state.night.lastBlackmailTarget = null;

    var rbActions = actions.filter(function (a) {
      return a.position === 4 && (a.roleId === 'escort' || a.roleId === 'consort');
    });
    for (var rbi = 0; rbi < rbActions.length; rbi += 1) {
      var rba = rbActions[rbi];
      var rbActor = E._byId(state, rba.playerId);
      if (!rbActor || !rbActor.isAlive || isBlocked(rbActor.id)) continue;
      if (rba.targetId && alive(rba.targetId)) blocked.push(rba.targetId);
    }
    var jailAction = actions.find(function (a) { return a.position === 3 && a.roleId === 'jailor'; });
    var jailor = jailAction ? E._byId(state, jailAction.playerId) : null;
    var witchAction = actions.find(function (a) { return a.position === 2 && a.roleId === 'witch'; });
    var jailProvisionalTarget = jailAction ? jailAction.targetId : null;
    if (jailAction && witchAction && witchAction.targetId === jailor.id &&
        witchAction.extra && witchAction.extra.controlRedirect) {
      jailProvisionalTarget = witchAction.extra.controlRedirect;
    }
    var jailorProvisionalValid = !!jailor && jailor.isAlive && !isBlocked(jailor.id) &&
      !!jailProvisionalTarget && alive(jailProvisionalTarget) &&
      jailProvisionalTarget !== state.night.lastJailTarget;
    if (jailorProvisionalValid) blocked.push(jailProvisionalTarget);

    var control = null;
    if (witchAction) {
      var witch = E._byId(state, witchAction.playerId);
      var controlledId = witchAction.targetId;
      var redirect = witchAction.extra && witchAction.extra.controlRedirect
        ? witchAction.extra.controlRedirect
        : null;
      var controlledJailed = jailorProvisionalValid && jailAction.targetId === controlledId;
      var controlValid = !!witch && witch.isAlive && !isBlocked(witch.id) &&
        !!controlledId && alive(controlledId) && !controlledJailed;
      control = { controlledId: controlledId, redirect: redirect, valid: controlValid };
    }

    var alertAction = actions.find(function (a) {
      return a.position === 0 && a.roleId === 'veteran' && a.extra && a.extra.alert;
    });
    var vet = alertAction ? E._byId(state, alertAction.playerId) : null;
    var veteranAlerting = !!vet && vet.isAlive && vet.assignedRole === 'veteran' && vet.alertsUsed < 3;
    if (veteranAlerting) {
      vet.alertsUsed += 1;
      vet.alerted = true;
    }

    for (var gi = 0; gi < P.length; gi += 1) {
      if (P[gi].isAlive && P[gi].guiltPending) {
        P[gi].guiltPending = false;
        killPlayer(P[gi].id, 'died of guilt');
      }
    }

    if (veteranAlerting) {
      for (var vi = 0; vi < actions.length; vi += 1) {
        var va = actions[vi];
        if (va.position === 0 && va.roleId === 'veteran') continue;
        if (!va.targetId) continue;
        var vActor = E._byId(state, va.playerId);
        if (!vActor || !vActor.isAlive) continue;
        if (isBlocked(vActor.id)) continue;
        var effTarget = (control && control.valid && control.controlledId === vActor.id && control.redirect)
          ? control.redirect
          : va.targetId;
        if (effTarget === vet.id) {
          voided.push(va);
          if (!noKillN1) {
            killPlayer(va.playerId, 'visited an alerting Veteran');
          } else {
            log(vActor.name + ' visited the alerting Veteran; their action is void.');
          }
        }
      }
    }

    E._applyJesterHaunt(state, actions, alive, applyAttack);

    blocked = [];
    for (var rbx = 0; rbx < rbActions.length; rbx += 1) {
      var rbax = rbActions[rbx];
      if (isVoided(rbax)) continue;
      var rbActorX = E._byId(state, rbax.playerId);
      if (!rbActorX || !rbActorX.isAlive || isBlocked(rbActorX.id)) continue;
      if (rbax.targetId && alive(rbax.targetId)) blocked.push(rbax.targetId);
    }
    var jailEffTarget = jailAction ? jailAction.targetId : null;
    if (jailAction && control && control.valid && control.controlledId === jailor.id && control.redirect) {
      jailEffTarget = control.redirect;
    }
    jailorProvisionalValid = !!jailor && jailor.isAlive && !isBlocked(jailor.id) && !isVoided(jailAction) &&
      !!jailEffTarget && alive(jailEffTarget) && jailEffTarget !== state.night.lastJailTarget;
    if (jailorProvisionalValid) blocked.push(jailEffTarget);

    if (witchAction) {
      var wc = E._byId(state, witchAction.playerId);
      var cId = witchAction.targetId;
      var cRed = witchAction.extra && witchAction.extra.controlRedirect
        ? witchAction.extra.controlRedirect
        : null;
      var cJailed = jailorProvisionalValid && jailAction.targetId === cId;
      control = {
        controlledId: cId,
        redirect: cRed,
        valid: !!wc && wc.isAlive && !isBlocked(wc.id) && !isVoided(witchAction) &&
          !!cId && alive(cId) && !cJailed
      };
    }

    var ctx = {
      state: state,
      actions: actions,
      deaths: deaths,
      nightNum: nightNum,
      noKillN1: noKillN1,
      alive: alive,
      isVoided: isVoided,
      isBlocked: isBlocked,
      effectiveTargets: effectiveTargets,
      getEff: getEff,
      setEff: setEff,
      forgedWills: forgedWills,
      log: log,
      applyAttack: applyAttack,
      latestEntry: latestEntry,
      sheriffSuspicious: sheriffSuspicious,
      blocked: blocked,
      control: control,
      prevBlackmailTarget: prevBlackmailTarget,
      rbActions: rbActions,
      jailAction: jailAction,
      jailor: jailor,
      witchAction: witchAction,
      deferred: [],
      reviveTarget: null
    };

    E._nightActions.poisoner(ctx);
    E._nightActions.witchReveal(ctx);
    E._nightActions.jailor(ctx);
    E._nightActions.roleblockers(ctx);
    E._nightActions.doctor(ctx);
    E._nightActions.mafia(ctx);
    E._nightActions.janitor(ctx);
    E._nightActions.forger(ctx);
    E._nightActions.blackmailer(ctx);
    E._nightActions.serialkiller(ctx);
    E._nightActions.framer(ctx);
    E._nightActions.investigators(ctx);
    E._nightActions.revivers(ctx);
    E._nightActions.medium(ctx);
    E._nightActions.deferred(ctx);

    if (ctx.reviveTarget) {
      var rp = E._byId(state, ctx.reviveTarget);
      rp.isAlive = true;
      rp.hasGhostVote = false;
      rp.ghostVoteSpent = false;
      var rEntry = latestEntry(state, ctx.reviveTarget);
      if (rEntry) rEntry.revived = true;
      revivals.push(ctx.reviveTarget);
      log(rp.name + ' has been revived.');
    }

    E._updateInheritance(state);

    Object.keys(forgedWills).forEach(function (fpid) {
      var fId = Number(fpid);
      if (alive(fId)) return;
      var fw = forgedWills[fpid];
      var fd = deaths.find(function (d) { return d.playerId === fId; });
      if (fd) fd.will = fw;
      var fe = latestEntry(state, fId);
      if (fe) {
        fe.willShown = fw;
        fe.lastWill = fw;
      }
    });

    state.morning = {
      deaths: deaths.map(function (d) {
        return { playerId: d.playerId, name: d.name, will: d.will, trueRole: d.trueRole, wasCleaned: d.wasCleaned, cause: d.cause };
      }),
      revivals: revivals.slice(),
      inheritanceNote: state.pendingInheritanceNote || '',
      blackmailTarget: state.night.lastBlackmailTarget
    };
    state.pendingInheritanceNote = '';

    state.night.actions = [];
    state.night.number += 1;
    state.phase = 'MORNING';

    return {
      deaths: deaths.map(function (d) {
        return { playerId: d.playerId, name: d.name, cause: d.cause, role: d.trueRole, will: d.will, wasCleaned: d.wasCleaned };
      }),
      revived: revivals.slice(),
      inheritedSheriff: !!(state.morning.inheritanceNote),
      logs: logs
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
