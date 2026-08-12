'use strict';
const engine = require('../js/engine.js');
const fs = require('fs');

const PRESET = process.argv[2] || 'p1';
const PLAYER_COUNT = parseInt(process.argv[3]) || 11;
const NUM_GAMES = parseInt(process.argv[4]) || 50;
const MAX_DAYS = 25;
const OUTPUT_FILE = process.argv[5] || 'sim-result.json';

function randInt(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr.length ? arr[randInt(arr.length)] : null; }
function living(state) { return state.players.filter(function (p) { return p.isAlive; }); }
function byId(state, id) { return state.players[id - 1] || null; }
function pname(state, id) { const p = byId(state, id); return p ? p.name : 'P' + id; }
function roleName(roleId) { const r = engine.ROLES[roleId]; return r ? r.name : String(roleId); }
function teamOfRole(roleId) { const r = engine.ROLES[roleId]; return r ? r.team : 'NEUTRAL'; }

const KILL_PRIORITY = { jailor: 1, sheriff: 2, doctor: 3, mayor: 4, vigilante: 5, retributionist: 6, medium: 7, undertaker: 8, tracker: 9, lookout: 10, escort: 11 };
const KNOWN_POWER = {};
Object.keys(KILL_PRIORITY).forEach(function (k) { KNOWN_POWER[k] = true; });

function makeModels(state) {
  const members = {};
  state.players.forEach(function (p) { if (engine.ROLES[p.assignedRole].team === 'MAFIA') members[p.id] = true; });
  return {
    town: { sheriffResults: {}, undertakerResults: {}, confirmedTown: {}, deadById: {}, evidence: {}, inspectedBefore: {} },
    mafia: { members: members, consigliereResults: {}, killTarget: null, lastKillTarget: null, lastBlackmailId: null, lastFramedId: null, avoid: {} },
    lastJailId: null
  };
}

function suspicionLevel(state, models, p) {
  if (models.town.sheriffResults[p.id] === 'SUSPICIOUS') return 3;
  const ur = models.town.undertakerResults[p.id];
  if (ur && teamOfRole(ur) === 'MAFIA' && p.isAlive) return 2;
  if (models.town.evidence[p.id]) return 1;
  return 0;
}

function mostSuspicious(state, models, excludeIds, noConfirmed) {
  const ex = excludeIds || [];
  const cands = living(state).filter(function (p) {
    return ex.indexOf(p.id) === -1 && !(noConfirmed && models.town.confirmedTown[p.id]);
  });
  if (!cands.length) return null;
  let best = [];
  let bestS = -1;
  cands.forEach(function (p) {
    const s = suspicionLevel(state, models, p);
    if (s > bestS) { bestS = s; best = [p]; } else if (s === bestS) { best.push(p); }
  });
  return pick(best);
}

function livingByRole(state, roleOrder) {
  for (let i = 0; i < roleOrder.length; i += 1) {
    const p = state.players.find(function (x) { return x.isAlive && x.assignedRole === roleOrder[i]; });
    if (p) return p;
  }
  return null;
}

function rec(state, action, recorded, notes, note) {
  if (!engine.recordNightAction(state, action)) throw new Error('recordNightAction rejected ' + JSON.stringify(action));
  recorded.push(action);
  if (note) notes.push(typeof note === 'string' ? { pos: action.position, text: note } : note);
}

function mafiaKillTarget(state, models) {
  const doctorAlive = state.players.some(function (p) { return p.isAlive && p.assignedRole === 'doctor'; });
  const cands = living(state).filter(function (p) { return !models.mafia.members[p.id] && !(doctorAlive && models.mafia.avoid[p.id]); });
  if (!cands.length) return null;
  let best = [];
  let bestS = 99;
  cands.forEach(function (p) {
    let s = 5;
    const known = models.mafia.consigliereResults[p.id];
    if (known && KNOWN_POWER[known]) s -= 2;
    else if (known && engine.ROLES[known] && engine.ROLES[known].team === 'TOWN') s -= 1;
    if (s < bestS) { bestS = s; best = [p]; } else if (s === bestS) { best.push(p); }
  });
  return pick(best);
}

function pickBestCorpse(state, gy) {
  let best = null, bs = 99;
  gy.forEach(function (e) {
    if (e.wasCleaned) return;
    const s = 5;
    if (s < bs) { bs = s; best = e; }
  });
  return best;
}

function witchAction(state, models, actor, recorded, notes) {
  const witchSide = state.witchSide === 'TOWN' ? 'TOWN' : 'MAFIA';
  const gf = livingByRole(state, ['godfather']);
  const sk = livingByRole(state, ['serialkiller']);
  const jailor = livingByRole(state, ['jailor']);
  const sheriff = livingByRole(state, ['sheriff']);
  const doctor = livingByRole(state, ['doctor']);
  const mayor = livingByRole(state, ['mayor']);
  const vigilante = livingByRole(state, ['vigilante']);
  if (witchSide === 'MAFIA') {
    if (gf) {
      const redir = pick([sheriff, doctor, mayor, vigilante].filter(function (p) { return p && p.id !== gf.id; }));
      if (redir) {
        rec(state, { position: 2, roleId: 'witch', playerId: actor.id, targetId: gf.id, extra: { controlRedirect: redir.id } }, recorded, notes,
          actor.name + ' (Witch) controlled ' + gf.name + ' (Godfather) redirect kill to ' + redir.name);
        return;
      }
    }
    if (sk) {
      const redir = pick([sheriff, doctor, mayor, vigilante].filter(function (p) { return p && p.id !== sk.id; }));
      if (redir) {
        rec(state, { position: 2, roleId: 'witch', playerId: actor.id, targetId: sk.id, extra: { controlRedirect: redir.id } }, recorded, notes,
          actor.name + ' (Witch) controlled ' + sk.name + ' (Serial Killer) redirect kill to ' + redir.name);
        return;
      }
    }
    if (jailor) {
      const redir = pick([sheriff, doctor, mayor, vigilante].filter(function (p) { return p && p.id !== jailor.id; }));
      if (redir) {
        rec(state, { position: 2, roleId: 'witch', playerId: actor.id, targetId: jailor.id, extra: { controlRedirect: redir.id } }, recorded, notes,
          actor.name + ' (Witch) controlled ' + jailor.name + ' (Jailor) redirect to ' + redir.name);
        return;
      }
    }
  } else {
    if (jailor) {
      const redir = pick([gf, sk].filter(function (p) { return p && p.id !== jailor.id; }));
      if (redir) {
        rec(state, { position: 2, roleId: 'witch', playerId: actor.id, targetId: jailor.id, extra: { controlRedirect: redir.id } }, recorded, notes,
          actor.name + ' (Witch) controlled ' + jailor.name + ' (Jailor) redirect to ' + redir.name);
        return;
      }
    }
    if (sheriff) {
      const redir = pick([gf, sk].filter(function (p) { return p && p.id !== sheriff.id; }));
      if (redir) {
        rec(state, { position: 2, roleId: 'witch', playerId: actor.id, targetId: sheriff.id, extra: { controlRedirect: redir.id } }, recorded, notes,
          actor.name + ' (Witch) controlled ' + sheriff.name + ' (Sheriff) redirect to ' + redir.name);
        return;
      }
    }
  }
}

function jailorAction(state, models, actor, recorded, notes) {
  const ex = [actor.id];
  if (models.lastJailId != null) ex.push(models.lastJailId);
  const target = mostSuspicious(state, models, ex);
  if (!target) return;
  const known = models.mafia.consigliereResults[target.id];
  const evil = known && teamOfRole(known) === 'MAFIA';
  const canExecute = state.night.number > 1 && actor.executionsUsed < 3;
  const decision = canExecute && (models.town.sheriffResults[target.id] === 'SUSPICIOUS' || evil) ? 'EXECUTE' : 'SPARE';
  rec(state, { position: 3, roleId: 'jailor', playerId: actor.id, targetId: target.id, extra: { jailorDecision: decision } }, recorded, notes,
    actor.name + ' (Jailor) jailed ' + target.name + ', ' + decision.toLowerCase());
}

function doctorAction(state, models, actor, recorded, notes) {
  let target = null;
  if (models.town.sheriffResults) {
    const confirmed = Object.keys(models.town.confirmedTown).map(Number);
    if (confirmed.length) target = byId(state, confirmed[0]);
  }
  if (!target && models.mafia.lastKillTarget != null) {
    const prev = byId(state, models.mafia.lastKillTarget);
    if (prev && prev.isAlive) target = prev;
  }
  if (!target) target = actor;
  rec(state, { position: 5, roleId: 'doctor', playerId: actor.id, targetId: target.id }, recorded, notes,
    actor.name + ' (Doctor) protected ' + target.name + (target.id === actor.id ? ' (self)' : ''));
}

function janitorAction(state, models, actor, recorded, notes) {
  if (!state.graveyard.length) return;
  let target = null;
  if (models.mafia.lastKillTarget != null && state.graveyard[state.graveyard.length - 1].playerId === models.mafia.lastKillTarget) {
    target = state.graveyard[state.graveyard.length - 1];
  }
  if (!target) target = pickBestCorpse(state, state.graveyard);
  if (target) {
    rec(state, { position: 7, roleId: 'janitor', playerId: actor.id, targetId: target.playerId }, recorded, notes,
      actor.name + ' (Janitor) cleaned ' + target.name + '\'s corpse');
  }
}

function forgerAction(state, models, actor, recorded, notes) {
  let target = models.mafia.killTarget != null ? byId(state, models.mafia.killTarget) : null;
  if (!target || !target.isAlive) {
    target = pick(living(state).filter(function (p) { return p.id !== actor.id && !models.mafia.members[p.id]; }));
  }
  if (target) {
    rec(state, { position: 7, roleId: 'forger', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Forger) forged ' + target.name + '\'s will');
  }
}

function blackmailerAction(state, models, actor, recorded, notes) {
  let target = livingByRole(state, ['mayor', 'jailor', 'sheriff']);
  if (target && target.id === models.mafia.lastBlackmailId) target = null;
  if (target) {
    rec(state, { position: 8, roleId: 'blackmailer', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Blackmailer) blackmailed ' + target.name);
  }
}

function skAction(state, models, actor, recorded, notes) {
  let target = null;
  const confirmed = Object.keys(models.town.confirmedTown).map(Number);
  for (let i = 0; i < confirmed.length && !target; i += 1) {
    const p = byId(state, confirmed[i]);
    if (p && p.isAlive && p.id !== actor.id) target = p;
  }
  if (!target) target = pick(living(state).filter(function (p) { return p.id !== actor.id; }));
  if (target) {
    rec(state, { position: 9, roleId: 'serialkiller', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Serial Killer) attacked ' + target.name);
  }
}

function framerAction(state, models, actor, recorded, notes) {
  const target = pick(living(state).filter(function (p) {
    return p.id !== actor.id && !models.mafia.members[p.id];
  }));
  if (target) {
    rec(state, { position: 10, roleId: 'framer', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Framer) framed ' + target.name);
  }
}

function invActor(state, models, role, actor, recorded, notes) {
  const emit = function (targetId, kind, text) {
    rec(state, { position: 11, roleId: role, playerId: actor.id, targetId: targetId }, recorded, notes,
      { pos: 11, kind: kind, playerId: actor.id, targetId: targetId, text: text });
  };
  if (role === 'sheriff' || (role === 'deputy' && actor.inheritedRole === 'sheriff')) {
    const checked = {};
    const ex = [actor.id];
    Object.keys(models.town.sheriffResults).forEach(function (k) { checked[Number(k)] = true; ex.push(Number(k)); });
    let target = mostSuspicious(state, models, ex);
    if (!target) {
      target = state.players.filter(function (p) {
        return p.isAlive && p.id !== actor.id && !checked[p.id] && KILL_PRIORITY[p.assignedRole] !== undefined;
      }).sort(function (a, b) {
        return (KILL_PRIORITY[a.assignedRole] || 99) - (KILL_PRIORITY[b.assignedRole] || 99);
      })[0] || null;
    }
    if (target) emit(target.id, 'sheriff', actor.name + ' (' + (role === 'deputy' ? 'Deputy' : 'Sheriff') + ') checked ' + target.name + ':');
    return;
  }
  if (role === 'tracker') {
    const target = mostSuspicious(state, models, [actor.id]);
    if (target) emit(target.id, 'tracker', actor.name + ' (Tracker) tracked ' + target.name);
    return;
  }
  if (role === 'lookout') {
    const target = livingByRole(state, ['sheriff']);
    if (target) emit(target.id, 'lookout', actor.name + ' (Lookout) watched ' + target.name);
    return;
  }
  if (role === 'consigliere') {
    const known = {};
    Object.keys(models.mafia.consigliereResults).forEach(function (k) { known[Number(k)] = true; });
    let target = null;
    ['jailor', 'sheriff', 'doctor', 'mayor'].forEach(function (r) {
      if (!target) target = state.players.find(function (p) {
        return p.isAlive && p.id !== actor.id && !models.mafia.members[p.id] && !known[p.id] && p.assignedRole === r;
      });
    });
    if (!target) target = pick(living(state).filter(function (p) { return p.id !== actor.id && !models.mafia.members[p.id] && !known[p.id]; }));
    if (target) emit(target.id, 'consigliere', actor.name + ' (Consigliere) inspected ' + target.name + ':');
    return;
  }
  if (role === 'undertaker') {
    const jan = recorded.find(function (a) { return a.position === 7 && a.roleId === 'janitor'; });
    const janId = jan ? jan.targetId : null;
    let target = null;
    for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
      const e = state.graveyard[i];
      if (e.wasCleaned || models.town.inspectedBefore[e.playerId] || (janId != null && e.playerId === janId)) continue;
      target = e;
      break;
    }
    if (target) emit(target.playerId, 'undertaker', actor.name + ' (Undertaker) inspected ' + target.name + '\'s corpse:');
  }
}

function retributionistAction(state, models, actor, recorded, notes) {
  if (actor.usedOncePerGame) return;
  let target = null;
  for (let i = 0; i < 3 && !target; i += 1) target = state.players.find(function (p) { return !p.isAlive && p.assignedRole === ['sheriff', 'jailor', 'mayor'][i]; });
  if (!target) {
    for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
      const e = state.graveyard[i];
      if (teamOfRole(e.trueRole) === 'TOWN') { target = byId(state, e.playerId); break; }
    }
  }
  if (target) rec(state, { position: 12, roleId: 'retributionist', playerId: actor.id, targetId: target.id }, recorded, notes,
    actor.name + ' (Retributionist) will revive ' + target.name + ' (' + roleName(target.assignedRole) + ')');
}

function amnesiacAction(state, models, actor, recorded, notes) {
  if (state.amnesiac.used) return;
  let target = null;
  for (let i = 0; i < 3 && !target; i += 1) target = state.players.find(function (p) { return !p.isAlive && p.assignedRole === ['jailor', 'sheriff', 'doctor'][i]; });
  if (!target && state.graveyard.length) target = byId(state, state.graveyard[state.graveyard.length - 1].playerId);
  if (target) rec(state, { position: 12, roleId: 'amnesiac', playerId: actor.id, targetId: target.id }, recorded, notes,
    actor.name + ' (Amnesiac) remembered ' + roleName(target.assignedRole) + ' from ' + target.name);
}

function mediumAction(state, models, actor, recorded, notes) {
  if (actor.isAlive) {
    rec(state, { position: 13, roleId: 'medium', playerId: actor.id }, recorded, notes, actor.name + ' (Medium) read the Ghost Ledger');
    return;
  }
  const target = livingByRole(state, ['sheriff']) || livingByRole(state, ['jailor']);
  if (target) {
    rec(state, { position: 13, roleId: 'medium', playerId: actor.id, targetId: target.id }, recorded, notes,
      actor.name + ' (Medium) whispered to ' + target.name);
  }
}

function nightActor(state, models, pos, role, actor, recorded, notes) {
  if (pos === 0 && role === 'veteran') {
    if (actor.alertsUsed < 3) {
      const alert = Math.random() < 0.3;
      rec(state, { position: 0, roleId: 'veteran', playerId: actor.id, extra: { alert: alert } }, recorded, notes,
        alert ? actor.name + ' (Veteran) went on alert' : null);
    }
    return;
  }
  if (pos === 0 && role === 'jester') {
    const target = pick((state.trial.votes || []).filter(function (v) { return v.verdict === 'GUILTY' && byId(state, v.voterId) && byId(state, v.voterId).isAlive; }).map(function (v) { return v.voterId; }));
    if (target) rec(state, { position: 0, roleId: 'jester', playerId: actor.id, targetId: target }, recorded, notes, null);
    return;
  }
  if (pos === 1 && role === 'poisoner') {
    const target = livingByRole(state, ['doctor', 'jailor', 'sheriff']);
    if (target) rec(state, { position: 1, roleId: 'poisoner', playerId: actor.id, targetId: target.id }, recorded, notes, actor.name + ' (Poisoner) poisoned ' + target.name);
    return;
  }
  if (pos === 2 && role === 'witch') { witchAction(state, models, actor, recorded, notes); return; }
  if (pos === 3 && role === 'jailor') { jailorAction(state, models, actor, recorded, notes); return; }
  if (pos === 4) {
    const target = role === 'escort' ? mostSuspicious(state, models, [actor.id]) : livingByRole(state, ['doctor', 'jailor', 'sheriff']);
    if (target) rec(state, { position: 4, roleId: role, playerId: actor.id, targetId: target.id }, recorded, notes, actor.name + ' (' + (role === 'escort' ? 'Escort' : 'Consort') + ') roleblocked ' + target.name);
    return;
  }
  if (pos === 5 && role === 'doctor') { doctorAction(state, models, actor, recorded, notes); return; }
  if (pos === 7 && role === 'janitor') { janitorAction(state, models, actor, recorded, notes); return; }
  if (pos === 7 && role === 'forger') { forgerAction(state, models, actor, recorded, notes); return; }
  if (pos === 8 && role === 'blackmailer') { blackmailerAction(state, models, actor, recorded, notes); return; }
  if (pos === 9 && role === 'serialkiller') { skAction(state, models, actor, recorded, notes); return; }
  if (pos === 10 && role === 'framer') { framerAction(state, models, actor, recorded, notes); return; }
  if (pos === 11) { invActor(state, models, role, actor, recorded, notes); return; }
  if (pos === 12 && role === 'retributionist') { retributionistAction(state, models, actor, recorded, notes); return; }
  if (pos === 12 && role === 'amnesiac') { amnesiacAction(state, models, actor, recorded, notes); return; }
  if (pos === 13 && role === 'medium') { mediumAction(state, models, actor, recorded, notes); }
}

function runNight(state, models, recorded, notes) {
  models.mafia.lastKillTarget = models.mafia.killTarget;
  models.mafia.killTarget = null;
  models.town.evidence = {};
  const steps = engine.getNightSteps(state);
  for (const step of steps) {
    const pos = step.position;
    if (pos >= 14) continue;
    if (pos === 6) {
      const leader = engine.mafiaKillActor(state);
      const target = leader ? mafiaKillTarget(state, models) : null;
      if (leader && target) {
        rec(state, { position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: target.id }, recorded, notes,
          'Mafia killed ' + target.name + ' (' + roleName(target.assignedRole) + ')');
        models.mafia.killTarget = target.id;
      }
      continue;
    }
    for (const role of step.roles) {
      const actors = state.players.filter(function (p) {
        if (p.assignedRole !== role) return false;
        if (pos === 0 && role === 'jester') return !p.isAlive && state.jester.haunted && state.jester.hauntTarget === null;
        if (pos === 13 && role === 'medium') return true;
        return p.isAlive;
      });
      for (const actor of actors) nightActor(state, models, pos, role, actor, recorded, notes);
    }
  }
}

function morningUpdate(state, models, recorded, notes) {
  const strip = function (note) { if (note) note.text = note.text.replace(/:$/, ''); };
  
  const effTargets = [];
  const voided = [];
  recorded.forEach(function (a) {
    if (a.position === 0 && a.roleId === 'veteran' && a.extra && a.extra.alert) {
      recorded.forEach(function (x) {
        if (x.targetId === a.playerId && x.position !== 0) voided.push(x.playerId);
      });
    }
  });
  
  const witchAction = recorded.find(function (a) { return a.position === 2 && a.roleId === 'witch'; });
  const witchControl = witchAction && witchAction.extra && witchAction.extra.controlRedirect ? {
    controlledId: witchAction.targetId,
    redirect: witchAction.extra.controlRedirect
  } : null;
  
  recorded.forEach(function (a) {
    if (a.position === 13) return;
    const actor = byId(state, a.playerId);
    if (!actor || !actor.isAlive || actor.isRoleblocked || actor.jailed) return;
    if (voided.indexOf(a.playerId) !== -1) return;
    const target = a.targetId != null ? byId(state, a.targetId) : null;
    if (!target || !target.isAlive) return;
    let effTid = a.targetId;
    if (witchControl && a.playerId === witchControl.controlledId) {
      effTid = witchControl.redirect;
    } else if (a.extra && a.extra.controlRedirect) {
      effTid = a.extra.controlRedirect;
    }
    effTargets.push({ playerId: a.playerId, targetId: effTid });
  });
  const getEff = function (pid) {
    for (var i = 0; i < effTargets.length; i += 1) {
      if (effTargets[i].playerId === pid) return effTargets[i].targetId;
    }
    return null;
  };

  recorded.forEach(function (a) {
    if (a.position !== 11) return;
    const actor = byId(state, a.playerId);
    const t = a.targetId != null ? byId(state, a.targetId) : null;
    const note = notes.find(function (n) { return n.kind && n.playerId === a.playerId && n.targetId === a.targetId; });
    const acted = actor.isAlive && t && t.isAlive && !actor.isRoleblocked && !actor.jailed;
    const isSheriffLike = a.roleId === 'sheriff' || (a.roleId === 'deputy' && actor.inheritedRole === 'sheriff');
    if (isSheriffLike) {
      if (acted) {
        let r = t.framed ? 'SUSPICIOUS' : (engine._sheriffSuspicious(state, t) ? 'SUSPICIOUS' : 'INNOCENT');
        if (actor.isDrunk) r = r === 'SUSPICIOUS' ? 'INNOCENT' : 'SUSPICIOUS';
        models.town.sheriffResults[a.targetId] = r;
        if (note) note.text += ' ' + r;
      } else strip(note);
    } else if (a.roleId === 'consigliere') {
      if (acted) {
        let learned = t.assignedRole;
        if (actor.isDrunk) {
          const aligned = engine._alignmentOf(state, t);
          const pool = Object.keys(engine.ROLES).filter(function (id) { return engine.ROLES[id].team !== aligned; });
          learned = pool[randInt(pool.length)];
        }
        models.mafia.consigliereResults[a.targetId] = learned;
        if (note) note.text += ' ' + roleName(learned);
      } else strip(note);
    } else if (a.roleId === 'undertaker') {
      const entry = state.graveyard.find(function (e) { return e.playerId === a.targetId; });
      if (entry && entry.inspectedByUndertaker && !models.town.inspectedBefore[a.targetId]) {
        models.town.inspectedBefore[a.targetId] = true;
        models.town.undertakerResults[a.targetId] = entry.trueRole;
        if (note) note.text += ' ' + roleName(entry.trueRole);
      } else strip(note);
    }
  });
  const killVictim = models.mafia.killTarget;
  recorded.forEach(function (a) {
    if (a.position !== 11 || (a.roleId !== 'tracker' && a.roleId !== 'lookout')) return;
    const lo = a.roleId === 'lookout';
    const actor = byId(state, a.playerId);
    const watched = a.targetId;
    const note = notes.find(function (n) { return n.kind === a.roleId && n.playerId === a.playerId; });
    if (!actor.isAlive || !watched || !byId(state, watched).isAlive || actor.isRoleblocked || actor.jailed) {
      strip(note);
      return;
    }
    if (lo) {
      const visitors = effTargets.filter(function (x) {
        return x.targetId === watched && x.playerId !== a.playerId;
      });
      if (note) note.text += visitors.length ? ': ' + visitors.map(function (x) { return pname(state, x.playerId); }).join(', ') + ' visited' : ': no visitors';
    } else {
      const tgt = getEff(watched);
      if (note) note.text += tgt != null ? ': visited ' + pname(state, tgt) : ': visited no one';
      if (killVictim != null && tgt === killVictim) models.town.evidence[watched] = true;
    }
  });
  const m = state.morning || { deaths: [], revivals: [] };
  (m.deaths || []).forEach(function (d) { models.town.deadById[d.playerId] = d.cause; });
  (m.revivals || []).forEach(function (id) { models.town.confirmedTown[id] = true; });
  if (models.mafia.killTarget != null) {
    const prev = byId(state, models.mafia.killTarget);
    if (prev && prev.isAlive) {
      const doctorAlive = state.players.some(function (p) { return p.isAlive && p.assignedRole === 'doctor' && !p.isRoleblocked && !p.jailed; });
      if (doctorAlive) models.mafia.avoid[models.mafia.killTarget] = true;
    }
  }
}

function vigilanteTarget(state, models) {
  return pick(living(state).filter(function (p) {
    return models.town.sheriffResults[p.id] === 'SUSPICIOUS';
  }));
}

function undertakerEvil(state, models, accused) {
  const ur = models.town.undertakerResults[accused.id];
  return ur && teamOfRole(ur) === 'MAFIA';
}

function livingVote(state, models, voter, accused) {
  const a = engine._alignmentOf(state, voter);
  if (a === 'TOWN') {
    if (models.town.sheriffResults[accused.id] === 'SUSPICIOUS' || undertakerEvil(state, models, accused)) return 'GUILTY';
    if (models.town.confirmedTown[accused.id]) return 'INNOCENT';
    return 'ABSTAIN';
  }
  if (a === 'MAFIA') {
    if (models.mafia.members[accused.id]) return 'INNOCENT';
    const known = models.mafia.consigliereResults[accused.id];
    if (known && KNOWN_POWER[known]) return 'GUILTY';
    return 'ABSTAIN';
  }
  return 'ABSTAIN';
}

function ghostVote(state, models, accused) {
  if (models.town.sheriffResults[accused.id] === 'SUSPICIOUS' || undertakerEvil(state, models, accused)) return 'GUILTY';
  if (models.town.confirmedTown[accused.id]) return 'INNOCENT';
  return null;
}

function runTrial(state, models, dayInfo) {
  const accused = mostSuspicious(state, models, null, true);
  if (!accused) return null;
  const townAlive = living(state).filter(function (p) {
    return engine._alignmentOf(state, p) === 'TOWN' && p.id !== accused.id;
  });
  const nominator = townAlive.find(function (p) { return p.assignedRole === 'sheriff'; }) || pick(townAlive);
  if (!nominator || !engine.startTrial(state, accused.id, nominator.id)) return null;
  state.players.forEach(function (p) {
    if (p.isAlive) {
      const v = livingVote(state, models, p, accused);
      if (v) engine.castVote(state, { voterId: p.id, verdict: v, ghostToken: false });
    } else if (p.hasGhostVote && !p.ghostVoteSpent) {
      const g = ghostVote(state, models, accused);
      if (g) engine.castVote(state, { voterId: p.id, verdict: g, ghostToken: true });
    }
  });
  const res = engine.resolveTrial(state);
  let g = 0, o = 0;
  (state.trial.votes || []).forEach(function (v) {
    const voter = byId(state, v.voterId);
    const w = voter && voter.isAlive && voter.revealed && voter.assignedRole === 'mayor' ? 3 : 1;
    if (v.verdict === 'GUILTY') g += w; else o += w;
  });
  let line = '=== Day ' + state.dayNumber + ': ' + accused.name + ' accused by ' + nominator.name +
    '; votes ' + g + '-' + o + (res.lynchedId ? ' GUILTY' : ' no-lynch') + '; ';
  if (res.lynchedId) {
    const lynched = byId(state, res.lynchedId);
    line += lynched.name + ' lynched (' + roleName(lynched.assignedRole) + ')';
    if (res.jesterWin) line += ' - Jester wins!';
    if (res.executionerWin) line += ' - Executioner wins!';
  } else line += accused.name + ' survived';
  return line + ' ===';
}

function runDay(state, models, dayInfo) {
  const lines = [];
  const mayor = state.players.find(function (p) { return p.isAlive && p.assignedRole === 'mayor' && !p.revealed; });
  if (mayor && state.dayNumber >= 2) {
    engine.mayorReveal(state, mayor.id);
    models.town.confirmedTown[mayor.id] = true;
    lines.push(mayor.name + ' (Mayor) revealed');
  }
  const vig = state.players.find(function (p) { return p.isAlive && p.assignedRole === 'vigilante' && p.shotsFired < 3; });
  const vt = vig ? vigilanteTarget(state, models) : null;
  if (vig && vt && engine.vigilanteShoot(state, vig.id, vt.id)) lines.push(vig.name + ' (Vigilante) shot ' + vt.name);
  if (state.phase === 'END') return lines;
  const dep = state.players.find(function (p) { return p.isAlive && p.assignedRole === 'deputy' && !p.usedOncePerGame; });
  const dt = dep ? vigilanteTarget(state, models) : null;
  if (dep && dt && engine.deputyShoot(state, dep.id, dt.id)) lines.push(dep.name + ' (Deputy) shot ' + dt.name);
  if (state.phase === 'END') return lines;
  const trialLine = runTrial(state, models, dayInfo);
  if (trialLine) lines.push(trialLine);
  return lines;
}

function main() {
  const results = { preset: PRESET, playerCount: PLAYER_COUNT, games: NUM_GAMES, wins: { TOWN: 0, MAFIA: 0, NEUTRAL: 0, nobody: 0 }, details: [] };
  
  for (let i = 0; i < NUM_GAMES; i += 1) {
    const state = engine.createGame({ playerCount: PLAYER_COUNT, presetId: PRESET });
    const names = [];
    for (let s = 1; s <= PLAYER_COUNT; s += 1) names.push({ seat: s, name: 'P' + s });
    engine.setPlayerNames(state, names);
    engine.dealRoles(state);
    const models = makeModels(state);
    const dayInfo = {};
    let days = 0;
    while (state.phase !== 'END' && days < MAX_DAYS) {
      if (state.phase !== 'NIGHT') state.phase = 'NIGHT';
      const recorded = [], notes = [];
      runNight(state, models, recorded, notes);
      engine.resolveNight(state);
      models.lastJailId = state.night.lastJailTarget || null;
      models.mafia.lastBlackmailId = state.night.lastBlackmailTarget || null;
      if (state.jester.hauntTarget) {
        notes.push({ pos: 0, text: 'Jester haunted ' + pname(state, state.jester.hauntTarget) });
      }
      morningUpdate(state, models, recorded, notes);
      engine.beginDay(state);
      if (state.phase === 'END') break;
      runDay(state, models, dayInfo);
      if (state.phase === 'END') break;
      days += 1;
    }
    if (state.phase !== 'END') engine.endGame(state);
    
    const winner = state.winner ? state.winner.winner : 'nobody';
    if (winner === 'TOWN') results.wins.TOWN += 1;
    else if (winner === 'MAFIA') results.wins.MAFIA += 1;
    else if (winner === 'SERIAL_KILLER' || winner === 'EXECUTIONER' || winner === 'JESTER') results.wins.NEUTRAL += 1;
    else results.wins.nobody += 1;
    
    results.details.push({
      game: i + 1,
      winner: winner,
      reason: state.winner ? state.winner.reason : 'max days',
      days: days,
      townDeaths: state.graveyard.filter(function (e) { return teamOfRole(e.trueRole) === 'TOWN'; }).length,
      mafiaDeaths: state.graveyard.filter(function (e) { return teamOfRole(e.trueRole) === 'MAFIA'; }).length,
      neutralDeaths: state.graveyard.filter(function (e) { return teamOfRole(e.trueRole) === 'NEUTRAL'; }).length
    });
  }
  
  results.townWinRate = (results.wins.TOWN / NUM_GAMES * 100).toFixed(1) + '%';
  results.mafiaWinRate = (results.wins.MAFIA / NUM_GAMES * 100).toFixed(1) + '%';
  results.neutralWinRate = (results.wins.NEUTRAL / NUM_GAMES * 100).toFixed(1) + '%';
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
