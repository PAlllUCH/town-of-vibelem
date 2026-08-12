'use strict';

/*
 * fallback.js - heuristic policies for the LLM-agentic simulator.
 * Every decision has a fallback that never throws. initFallback(state) builds
 * a shared memory mirroring the agentic.js models; syncFromStore(state, store)
 * folds the private knowledge store (real engine results) back into it so
 * fallback voters/checkers act on accurate information.
 */

const engine = require('../../js/engine.js');
const knowledge = require('./knowledge.js');

const KILL_PRIORITY = {
  jailor: 1, sheriff: 2, doctor: 3, mayor: 4, vigilante: 5,
  retributionist: 6, medium: 7, undertaker: 8, tracker: 9, lookout: 10, escort: 11
};

let MEM = null;

function randInt(n) { return Math.floor(Math.random() * n); }

function initFallback(state) {
  MEM = {
    mafiaMembers: {},
    sheriffChecked: {},
    consigliereKnown: {},
    undertakerSeen: {},
    avoid: {},
    lastKill: null,
    lastJailId: null,
    lastBlackmailId: null,
    lastFramedId: null
  };
  state.players.forEach(function (p) {
    if (engine.ROLES[p.assignedRole].team === 'MAFIA') MEM.mafiaMembers[p.id] = true;
  });
  return MEM;
}

function syncFromStore(state, store, prevLogCount) {
  if (!MEM) initFallback(state);
  MEM.avoid = {};
  Object.keys(store).forEach(function (pid) {
    const s = store[pid];
    (s.checks || []).forEach(function (c) {
      const id = knowledge.idByName(state, c.target);
      if (id != null) MEM.sheriffChecked[id] = c.result;
    });
    (s.consigliere || []).forEach(function (c) {
      const id = knowledge.idByName(state, c.target);
      if (id != null) MEM.consigliereKnown[id] = c.role;
    });
    (s.undertaker || []).forEach(function (c) {
      const id = knowledge.idByName(state, c.target);
      if (id != null) MEM.undertakerSeen[id] = true;
    });
  });
  (state.logs || []).slice(prevLogCount || 0).forEach(function (line) {
    const m = /^\[Night \d+\] (.+) survived an attack \(Doctor protection\)\.$/.exec(line);
    if (m) {
      const id = knowledge.idByName(state, m[1]);
      if (id != null) MEM.avoid[id] = true;
    }
  });
}

function living(state) { return state.players.filter(function (p) { return p.isAlive; }); }

function teamOfRoleName(name) {
  const id = knowledge.roleIdByName(name);
  return id ? engine.ROLES[id].team : null;
}

function checkOn(store, voterId, accusedName) {
  const s = store[voterId] || {};
  const arr = s.checks || [];
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (arr[i].target === accusedName) return arr[i].result;
  }
  return null;
}

function undertakerOn(store, voterId, accusedName) {
  const s = store[voterId] || {};
  const arr = s.undertaker || [];
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (arr[i].target === accusedName) return arr[i].role;
  }
  return null;
}

function fallbackNight(state, playerId, role) {
  try {
    if (!MEM) initFallback(state);
    const me = engine._byId(state, playerId);
    if (!me) return null;
    const others = living(state).filter(function (p) { return p.id !== playerId; });
    const pickOther = function () { return others.length ? others[randInt(others.length)].id : null; };
    const nonMafiaOther = function () {
      const c = others.filter(function (p) { return !MEM.mafiaMembers[p.id]; });
      return c.length ? c[randInt(c.length)].id : pickOther();
    };
    const livingByRole = function (rid) {
      const q = state.players.find(function (x) { return x.isAlive && x.assignedRole === rid && x.id !== playerId; });
      return q ? q.id : null;
    };
    const latestCorpse = function (skipCleaned) {
      for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
        const e = state.graveyard[i];
        if (skipCleaned && e.wasCleaned) continue;
        return e.playerId;
      }
      return null;
    };
    switch (role) {
      case 'veteran':
        return { position: 0, roleId: 'veteran', playerId: playerId, extra: { alert: me.alertsUsed < 3 && Math.random() < 0.3 } };
      case 'poisoner': {
        const t = livingByRole('doctor') || livingByRole('jailor') || livingByRole('sheriff') || pickOther();
        return t == null ? null : { position: 1, roleId: 'poisoner', playerId: playerId, targetId: t };
      }
      case 'witch': {
        const leader = engine.mafiaKillActor(state);
        const doc = livingByRole('doctor');
        let ctrl = null;
        let redir = null;
        if (doc != null && leader) { ctrl = doc; redir = leader.id; }
        else if (leader && leader.id !== playerId) {
          const jailor = livingByRole('jailor');
          if (jailor != null) { ctrl = jailor; redir = leader.id; }
        }
        if (ctrl == null) ctrl = pickOther();
        if (ctrl == null) return null;
        if (redir != null && (redir === ctrl || redir === playerId || !engine._byId(state, redir).isAlive)) redir = null;
        return { position: 2, roleId: 'witch', playerId: playerId, targetId: ctrl, extra: redir ? { controlRedirect: redir } : null };
      }
      case 'jailor': {
        const ex = [playerId];
        if (state.night.lastJailTarget != null) ex.push(state.night.lastJailTarget);
        const cands = living(state).filter(function (p) { return ex.indexOf(p.id) === -1; });
        if (!cands.length) return null;
        const t = cands[randInt(cands.length)];
        MEM.lastJailId = t.id;
        const decision = state.night.number === 1 ? 'SPARE' : (Math.random() < 0.4 ? 'EXECUTE' : 'SPARE');
        return { position: 3, roleId: 'jailor', playerId: playerId, targetId: t.id, extra: { jailorDecision: decision } };
      }
      case 'escort': {
        const t = pickOther();
        return t == null ? null : { position: 4, roleId: 'escort', playerId: playerId, targetId: t };
      }
      case 'consort': {
        const t = livingByRole('doctor') || livingByRole('jailor') || livingByRole('sheriff') || pickOther();
        return t == null ? null : { position: 4, roleId: 'consort', playerId: playerId, targetId: t };
      }
      case 'doctor': {
        let t = livingByRole('sheriff') || livingByRole('jailor') || livingByRole('mayor') ||
          livingByRole('vigilante') || livingByRole('retributionist');
        if (t == null) t = playerId;
        return { position: 5, roleId: 'doctor', playerId: playerId, targetId: t };
      }
      case 'mafia': {
        const leader = engine.mafiaKillActor(state);
        if (!leader) return null;
        const isFaction = function (p) {
          return MEM.mafiaMembers[p.id] ||
            (p.assignedRole === 'witch' && state.witchSide === 'MAFIA');
        };
        let cands = living(state).filter(function (p) {
          return p.id !== leader.id && !isFaction(p);
        });
        const unblocked = cands.filter(function (p) { return !MEM.avoid[p.id]; });
        if (unblocked.length) cands = unblocked;
        if (!cands.length) return null;
        let best = null;
        let bs = 99;
        cands.forEach(function (p) {
          const s = KILL_PRIORITY[p.assignedRole] != null ? KILL_PRIORITY[p.assignedRole] : 12;
          if (s < bs) { bs = s; best = p; }
        });
        MEM.lastKill = best.id;
        return { position: 6, roleId: leader.assignedRole, playerId: leader.id, targetId: best.id };
      }
      case 'janitor': {
        const t = latestCorpse(true);
        return { position: 7, roleId: 'janitor', playerId: playerId, targetId: t };
      }
      case 'forger': {
        const t = nonMafiaOther();
        return t == null ? null : { position: 7, roleId: 'forger', playerId: playerId, targetId: t };
      }
      case 'blackmailer': {
        const cands = living(state).filter(function (p) { return p.id !== playerId && p.id !== MEM.lastBlackmailId; });
        const t = cands.length ? cands[randInt(cands.length)].id : pickOther();
        if (t == null) return null;
        MEM.lastBlackmailId = t;
        return { position: 8, roleId: 'blackmailer', playerId: playerId, targetId: t };
      }
      case 'serialkiller': {
        const t = pickOther();
        return t == null ? null : { position: 9, roleId: 'serialkiller', playerId: playerId, targetId: t };
      }
      case 'framer': {
        const cands = living(state).filter(function (p) {
          return p.id !== playerId && !MEM.mafiaMembers[p.id] && p.id !== MEM.lastFramedId;
        });
        if (!cands.length) return null;
        const t = cands[randInt(cands.length)].id;
        MEM.lastFramedId = t;
        return { position: 10, roleId: 'framer', playerId: playerId, targetId: t };
      }
      case 'sheriff':
      case 'deputy': {
        const checked = Object.keys(MEM.sheriffChecked).map(Number);
        const cands = living(state).filter(function (p) { return p.id !== playerId && checked.indexOf(p.id) === -1; });
        const t = cands.length ? cands[randInt(cands.length)].id : pickOther();
        return t == null ? null : { position: 11, roleId: role, playerId: playerId, targetId: t };
      }
      case 'tracker': {
        const t = pickOther();
        return t == null ? null : { position: 11, roleId: 'tracker', playerId: playerId, targetId: t };
      }
      case 'lookout': {
        const t = pickOther();
        return t == null ? null : { position: 11, roleId: 'lookout', playerId: playerId, targetId: t };
      }
      case 'consigliere': {
        const t = nonMafiaOther();
        return t == null ? null : { position: 11, roleId: 'consigliere', playerId: playerId, targetId: t };
      }
      case 'undertaker': {
        for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
          const e = state.graveyard[i];
          if (!e.wasCleaned && !MEM.undertakerSeen[e.playerId]) {
            MEM.undertakerSeen[e.playerId] = true;
            return { position: 11, roleId: 'undertaker', playerId: playerId, targetId: e.playerId };
          }
        }
        return { position: 11, roleId: 'undertaker', playerId: playerId, targetId: null };
      }
      case 'retributionist': {
        if (me.usedOncePerGame) return null;
        let t = null;
        ['sheriff', 'jailor', 'mayor'].forEach(function (r) {
          if (t == null) {
            const q = state.players.find(function (x) { return !x.isAlive && x.assignedRole === r; });
            if (q) t = q.id;
          }
        });
        if (t == null) {
          const e = state.graveyard[state.graveyard.length - 1];
          t = e ? e.playerId : null;
        }
        return { position: 12, roleId: 'retributionist', playerId: playerId, targetId: t };
      }
      case 'amnesiac': {
        if (state.amnesiac.used) return null;
        let t = null;
        ['jailor', 'sheriff', 'doctor'].forEach(function (r) {
          if (t == null) {
            const q = state.players.find(function (x) { return !x.isAlive && x.assignedRole === r; });
            if (q) t = q.id;
          }
        });
        if (t == null) {
          const e = state.graveyard[state.graveyard.length - 1];
          t = e ? e.playerId : null;
        }
        return { position: 12, roleId: 'amnesiac', playerId: playerId, targetId: t };
      }
      case 'medium': {
        if (me.isAlive) return { position: 13, roleId: 'medium', playerId: playerId };
        const t = livingByRole('sheriff') || livingByRole('jailor') || pickOther();
        return t == null ? null : { position: 13, roleId: 'medium', playerId: playerId, targetId: t };
      }
      case 'jester': {
        const targets = (state.trial.votes || []).filter(function (v) {
          return v.verdict === 'GUILTY' && engine._byId(state, v.voterId) && engine._byId(state, v.voterId).isAlive;
        }).map(function (v) { return v.voterId; });
        const t = targets.length ? targets[randInt(targets.length)] : null;
        return t == null ? null : { position: 0, roleId: 'jester', playerId: playerId, targetId: t };
      }
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

function fallbackVote(state, voterId, accusedId, dayInfo) {
  try {
    const voter = engine._byId(state, voterId);
    const accused = engine._byId(state, accusedId);
    if (!voter || !accused) return 'ABSTAIN';
    const accName = knowledge.sanitize(accused.name);
    const align = engine._alignmentOf(state, voter);
    if (align === 'TOWN') {
      const r = checkOn(dayInfo.store, voterId, accName);
      if (r === 'SUSPICIOUS') return 'GUILTY';
      if (r === 'INNOCENT') return 'INNOCENT';
      const ut = undertakerOn(dayInfo.store, voterId, accName);
      if (ut) return teamOfRoleName(ut) === 'MAFIA' ? 'GUILTY' : 'INNOCENT';
      return 'ABSTAIN';
    }
    if (align === 'MAFIA') {
      if (MEM && MEM.mafiaMembers[accusedId]) return 'INNOCENT';
      return 'GUILTY';
    }
    if (voter.assignedRole === 'jester') return accusedId === voterId ? 'GUILTY' : 'ABSTAIN';
    if (voter.assignedRole === 'executioner') {
      if (state.executionerConverted) return accusedId === voterId ? 'GUILTY' : 'ABSTAIN';
      return accusedId === state.executionerTarget ? 'GUILTY' : 'ABSTAIN';
    }
    return 'ABSTAIN';
  } catch (e) {
    return 'ABSTAIN';
  }
}

function ghostFallbackVote(state, voterId, accusedId, dayInfo) {
  const v = fallbackVote(state, voterId, accusedId, dayInfo);
  return v === 'GUILTY' ? 'GUILTY' : 'INNOCENT';
}

function fallbackNomination(state, voterId, dayInfo) {
  try {
    const me = engine._byId(state, voterId);
    if (!me) return null;
    const align = engine._alignmentOf(state, me);
    const cands = living(state).filter(function (p) { return p.id !== voterId; });
    if (!cands.length) return null;
    if (align === 'MAFIA') {
      const nonMafia = cands.filter(function (p) { return !(MEM && MEM.mafiaMembers[p.id]); });
      if (!nonMafia.length) return null;
      const known = (dayInfo.store[voterId] || {}).consigliere || [];
      for (let i = known.length - 1; i >= 0; i -= 1) {
        const tid = knowledge.idByName(state, known[i].target);
        if (tid != null && nonMafia.some(function (p) { return p.id === tid; })) return tid;
      }
      return nonMafia[randInt(nonMafia.length)].id;
    }
    const s = dayInfo.store[voterId] || {};
    const checks = s.checks || [];
    for (let i = checks.length - 1; i >= 0; i -= 1) {
      if (checks[i].result === 'SUSPICIOUS') {
        const tid = knowledge.idByName(state, checks[i].target);
        if (tid != null && engine._byId(state, tid).isAlive && tid !== voterId) return tid;
      }
    }
    const ut = s.undertaker || [];
    for (let i = ut.length - 1; i >= 0; i -= 1) {
      const tid = knowledge.idByName(state, ut[i].target);
      if (tid != null && engine._byId(state, tid).isAlive && teamOfRoleName(ut[i].role) === 'MAFIA') return tid;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function fallbackShoot(state, playerId, dayInfo) {
  try {
    const me = engine._byId(state, playerId);
    if (!me) return null;
    if (me.assignedRole === 'vigilante' && me.shotsFired >= 3) return null;
    if (me.assignedRole === 'deputy' && me.usedOncePerGame) return null;
    if (me.assignedRole !== 'vigilante' && me.assignedRole !== 'deputy') return null;
    const s = dayInfo.store[playerId] || {};
    const checks = s.checks || [];
    for (let i = checks.length - 1; i >= 0; i -= 1) {
      if (checks[i].result === 'SUSPICIOUS') {
        const tid = knowledge.idByName(state, checks[i].target);
        if (tid != null && tid !== playerId && engine._byId(state, tid).isAlive) return tid;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function fallbackReveal(state, playerId, dayInfo) {
  try {
    const me = engine._byId(state, playerId);
    return !!(me && me.assignedRole === 'mayor' && !me.revealed && dayInfo.dayNumber >= 2);
  } catch (e) {
    return false;
  }
}

function fallbackStatement(state, playerId, dayInfo) {
  try {
    const me = engine._byId(state, playerId);
    if (!me) return '';
    const align = engine._alignmentOf(state, me);
    if (align === 'TOWN') {
      const s = dayInfo.store[playerId] || {};
      const checks = s.checks || [];
      for (let i = checks.length - 1; i >= 0; i -= 1) {
        if (checks[i].result === 'SUSPICIOUS') {
          const tid = knowledge.idByName(state, checks[i].target);
          if (tid != null && engine._byId(state, tid).isAlive) {
            return 'I have a strong suspicion about someone but I will wait for the right moment to reveal it.';
          }
        }
      }
      return 'I am Town and I have nothing conclusive to report yet.';
    }
    if (align === 'MAFIA') return 'I am Town. I have no solid leads yet, but I am listening carefully.';
    if (me.assignedRole === 'jester' || me.assignedRole === 'executioner') {
      return 'I am Town. I think we should lynch someone today.';
    }
    return 'I am Town. Nothing to report.';
  } catch (e) {
    return '';
  }
}

module.exports = {
  initFallback: initFallback,
  syncFromStore: syncFromStore,
  fallbackNight: fallbackNight,
  fallbackVote: fallbackVote,
  ghostFallbackVote: ghostFallbackVote,
  fallbackNomination: fallbackNomination,
  fallbackShoot: fallbackShoot,
  fallbackReveal: fallbackReveal,
  fallbackStatement: fallbackStatement
};
