'use strict';

const assert = require('node:assert/strict');
const engine = require('../js/engine.js');

// ---------------------------------------------------------------------------
// Shared engine test helpers (from engine.test.js)
// ---------------------------------------------------------------------------

function pid(state, id) {
  return state.players[id - 1];
}

function roleIdByName(name) {
  const found = Object.keys(engine.ROLES).find(function (id) { return engine.ROLES[id].name === name; });
  return found || null;
}

// Build a game with an exact, deterministic role assignment (player i gets roles[i - 1]).
function assignRoles(roles, opts) {
  const state = engine.createGame(Object.assign({ playerCount: roles.length, presetId: 'p1' }, opts || {}));
  state.deck = roles.slice();
  state.players.forEach(function (p, i) {
    p.name = 'P' + p.id;
    p.assignedRole = roles[i];
    p.inheritedRole = null;
    p.isAlive = true;
    p.isDrunk = false;
    p.hasGhostVote = false;
    p.ghostVoteSpent = false;
    p.nightTarget = null;
    p.jailorDecision = null;
    p.isRoleblocked = false;
    p.isProtected = false;
    p.framed = false;
    p.blackmailed = false;
    p.revealed = false;
    p.shotsFired = 0;
    p.executionsUsed = 0;
    p.alertsUsed = 0;
    p.usedOncePerGame = false;
    p.guiltPending = false;
  });
  state.graveyard = [];
  state.deathLog = [];
  state.trial = { active: false, stage: null, accusedId: null, nominatorId: null, seconds: [], votes: [], sentenceVotes: [], dayTrialsDone: 0 };
  state.night = { number: 1, actions: [], lastJailTarget: null, lastBlackmailTarget: null };
  state.dayNumber = 0;
  state.winner = null;
  state.logs = [];
  state.playerLog = {};
  state.executionerTarget = null;
  state.executionerConverted = false;
  state.jester = { haunted: false, hauntTarget: null };
  state.retributionist = { used: false };
  state.amnesiac = { used: false, rememberedRole: null };
  state.pendingInheritanceNote = '';
  state.morning = { deaths: [], revivals: [], inheritanceNote: '', blackmailTarget: null, forgedWills: [] };
  state.phase = 'NIGHT';
  return state;
}

function act(state, position, roleId, playerId, targetId, extra) {
  const ok = engine.recordNightAction(state, {
    position: position,
    roleId: roleId,
    playerId: playerId,
    targetId: targetId,
    extra: extra
  });
  assert.ok(ok, 'action was not recorded');
}

function night(state) {
  return engine.resolveNight(state);
}

function sorted(list) { return list.slice().sort(); }
function preview(state) { return engine.getDeckPreview(state); }
function logText(state) { return state.logs.join('\n'); }
function aliveIds(state) { return state.players.filter(function (p) { return p.isAlive; }).map(function (p) { return p.id; }); }

function deathCauses(result) {
  const map = {};
  result.deaths.forEach(function (d) { map[d.playerId] = d.cause; });
  return map;
}

function graveyardEntry(state, id) {
  for (let i = state.graveyard.length - 1; i >= 0; i -= 1) {
    if (state.graveyard[i].playerId === id) return state.graveyard[i];
  }
  return null;
}

// Deal an exact role array through the real assignRoles path so setup info
// (Executioner target, GF bluffs, start-knowing claims) is computed.
function dealExact(roles, opts) {
  const state = engine.createGame(Object.assign({ playerCount: roles.length, presetId: 'p1' }, opts || {}));
  state.deck = roles.slice();
  const seatToRole = {};
  roles.forEach(function (r, i) { seatToRole[i + 1] = r; });
  state.players.forEach(function (p) { p.name = 'P' + p.id; });
  engine.assignRoles(state, seatToRole);
  return state;
}

// ---------------------------------------------------------------------------
// Stubbed DOM + full-app driver (from game-loop.test.js)
// ---------------------------------------------------------------------------

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

function makeEl(id) {
  const attrs = {};
  return {
    id: id, innerHTML: '', textContent: '', value: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k] != null ? attrs[k] : null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

const els = {};
if (typeof global.document === 'undefined') {
  global.document = {
    getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeEl(''); },
    addEventListener() {},
    body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} }
  };
}
if (typeof global.navigator === 'undefined') global.navigator = {};
if (typeof global.location === 'undefined') global.location = { protocol: 'https:' };
const store = {};
if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem(k) { return store[k] != null ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };
}
globalThis.window.scrollTo = function () {};

require('../js/ui/common.js');
require('../js/ui/panels.js');
require('../js/ui/claims.js');
require('../js/ui/setup.js');
require('../js/ui/seats.js');
require('../js/ui/wizard.js');
require('../js/ui/day.js');
require('../js/ui/day-trial.js');
require('../js/ui/end.js');
require('../js/ui/reference.js');
require('../js/app/config.js');
require('../js/app/persistence.js');
require('../js/app/router.js');
require('../js/app/actions-setup.js');
require('../js/app/actions-seats.js');
require('../js/app/actions-wizard.js');
require('../js/app/actions-day.js');
require('../js/app/actions-game.js');
require('../js/app/actions-panels.js');
require('../js/app/actions.js');
require('../js/app/actions-reference.js');
require('../js/app/actions-sheets.js');

const APP = globalThis.window.APP;
const E = engine;

globalThis.setTimeout = function () { return 0; };
globalThis.clearTimeout = function () {};
globalThis.setInterval = function () { return 0; };
globalThis.clearInterval = function () {};

APP.init();
APP.goto('setup');

function html(id) {
  return els[id] ? els[id].innerHTML : '';
}

function roleButton(h, rid) {
  const marker = 'data-role="' + rid + '"';
  const mid = h.indexOf(marker);
  assert.ok(mid !== -1, 'role ' + rid + ' should be listed in the picker');
  return h.slice(h.lastIndexOf('<button', mid), h.indexOf('</button>', mid));
}

function startRoles(playerCount, teamCounts, roles, names, houseRules) {
  APP.newGame();
  APP.cfg.playerCount = playerCount;
  APP.cfg.teamCounts = teamCounts;
  if (houseRules) {
    Object.keys(houseRules).forEach(function (k) { APP.cfg.houseRules[k] = houseRules[k]; });
  }
  APP.startGame();
  APP.state.deck = roles.slice();
  const pending = {};
  roles.forEach(function (r, i) { pending[i + 1] = r; });
  APP.app.pendingRoles = pending;
  if (names) APP.app.names = names;
  APP.lockRoles();
  assert.strictEqual(APP.state.phase, 'SEATS');
}

function firstLivingNot(id) {
  for (let i = 0; i < APP.state.players.length; i += 1) {
    const p = APP.state.players[i];
    if (p.isAlive && String(p.id) !== String(id)) return p.id;
  }
  return null;
}

function firstLivingNotBoth(a, b) {
  for (let i = 0; i < APP.state.players.length; i += 1) {
    const p = APP.state.players[i];
    if (p.isAlive && String(p.id) !== String(a) && String(p.id) !== String(b)) return p.id;
  }
  return null;
}

const corpseRoles = ['undertaker', 'janitor', 'retributionist', 'amnesiac'];

function wizardActorsNeeding(state, step) {
  const out = [];
  (step.roles || []).forEach(function (role) {
    state.players.forEach(function (p) {
      if (p.assignedRole !== role) return;
      const allowDead = (role === 'medium' && step.position === 13) ||
        (role === 'jester' && step.position === 0 && state.jester &&
          state.jester.haunted && state.jester.hauntTarget === null);
      if (!p.isAlive && !allowDead) return;
      const done = ((state.night && state.night.actions) || []).some(function (ac) {
        return ac.position === step.position && ac.roleId === role && String(ac.playerId) === String(p.id);
      });
      if (!done) out.push({ role: role, player: p });
    });
  });
  return out;
}

function livingGuiltyVoters(st) {
  return ((st.trial && st.trial.votes) || []).filter(function (v) {
    return v.verdict === 'GUILTY';
  }).map(function (v) {
    return st.players.find(function (p) { return String(p.id) === String(v.voterId); });
  }).filter(function (gp) {
    return gp && gp.isAlive;
  });
}

function pickTarget(role, pid) {
  if (corpseRoles.indexOf(role) !== -1) {
    return APP.state.graveyard && APP.state.graveyard.length ? APP.state.graveyard[0].playerId : null;
  }
  return firstLivingNot(pid);
}

function driveActor(actor) {
  const w = APP.app.wizard;
  const st = APP.state;
  const step = w.steps[Math.min(w.idx, w.steps.length - 1)];
  const role = actor.role;
  const rawPid = actor.player;
  const pid = (rawPid && typeof rawPid === 'object') ? rawPid.id : rawPid;
  if (role === 'veteran') {
    APP.wizAlert(st.night.number === 1);
  } else if (role === 'witch') {
    if (!w.pending || !w.pending.control) APP.wizTarget(firstLivingNot(pid));
    else APP.wizTarget(firstLivingNotBoth(pid, w.pending.control));
  } else if (role === 'jailor') {
    if (!w.pending || !w.pending.jail) APP.wizTarget(firstLivingNot(pid));
    else APP.wizJailorDecision(st.night.number === 1 ? 'SPARE' : 'EXECUTE');
  } else if (role === 'forger') {
    if (!w.pending || !w.pending.forge) APP.wizTarget(firstLivingNot(pid));
    else APP.wizJailorDecision('FORGE');
  } else if (role === 'medium') {
    const med = st.players.find(function (p) { return p.id === pid; });
    if (med && med.isAlive) APP.wizTarget('__none__');
    else APP.wizTarget(firstLivingNot(pid));
  } else if (role === 'jester') {
    const guilty = livingGuiltyVoters(st);
    if (guilty.length) APP.wizTarget(guilty[0].id);
    else APP.wizNext();
  } else {
    APP.wizTarget(pickTarget(role, pid));
  }
}

function driveStep(victim) {
  const w = APP.app.wizard;
  const idx = Math.min(w.idx, w.steps.length - 1);
  const step = w.steps[idx];
  if (step.position >= 14) return;
  if (w.actor) {
    driveActor(w.actor);
    return;
  }
  if (step.position === 6) {
    const mafiaDone = (APP.state.night.actions || []).some(function (ac) {
      return ac.position === 6 && (ac.roleId === 'godfather' || ac.roleId === 'mafioso');
    });
    if (!mafiaDone && victim != null) {
      APP.wizMafiaTarget(victim);
      return;
    }
    APP.wizNext();
    return;
  }
  const actors = wizardActorsNeeding(APP.state, step);
  if (!actors.length) {
    APP.wizNext();
    return;
  }
  const a = actors[0];
  if (corpseRoles.indexOf(a.role) !== -1 && !(APP.state.graveyard || []).length) {
    APP.wizNext();
    return;
  }
  APP.wizActor(a.role, a.player.id);
}

function driveNight() {
  const leader = E.mafiaKillActor(APP.state);
  const victim = leader ? firstLivingNot(leader.id) : null;
  let guard = 0;
  while (APP.app.wizard && APP.app.wizard.idx < APP.app.wizard.steps.length && guard++ < 300) {
    const w = APP.app.wizard;
    const step = w.steps[Math.min(w.idx, w.steps.length - 1)];
    if (step.position >= 14) break;
    driveStep(victim);
  }
}

function trialVoters() {
  const out = [];
  APP.state.players.forEach(function (p) {
    if (p.isAlive) out.push({ id: p.id, ghost: false });
  });
  APP.state.players.forEach(function (p) {
    if (!p.isAlive && p.hasGhostVote && !p.ghostVoteSpent) out.push({ id: p.id, ghost: true });
  });
  return out;
}

function voteBtn(id, verdict, ghost) {
  const attrs = { 'data-voter': id, 'data-verdict': verdict, 'data-ghost': ghost ? '1' : '0' };
  return {
    getAttribute(k) { return attrs[k] != null ? attrs[k] : null; }
  };
}

function castAll(verdict) {
  trialVoters().forEach(function (v) {
    APP.castVote(voteBtn(v.id, verdict, v.ghost));
  });
}

function castVotes(spec) {
  trialVoters().forEach(function (v) {
    const verdict = spec[v.id] != null ? spec[v.id] : 'ABSTAIN';
    APP.castVote(voteBtn(v.id, verdict, v.ghost));
  });
}

function secondAll() {
  const tr = APP.state.trial;
  APP.state.players.forEach(function (p) {
    if (!p.isAlive) return;
    if (String(p.id) === String(tr.accusedId)) return;
    APP.castVote(voteBtn(p.id, 'AGREE', false));
  });
}

function noSelfTargets() {
  return (APP.state.night.actions || []).every(function (ac) {
    return ac.targetId == null || String(ac.targetId) !== String(ac.playerId);
  });
}

module.exports = {
  engine, assert,
  pid, roleIdByName, assignRoles, act, night, sorted, preview,
  logText, aliveIds, deathCauses, graveyardEntry, dealExact,
  APP, E,
  els, html, roleButton, startRoles, firstLivingNot, firstLivingNotBoth, corpseRoles,
  wizardActorsNeeding, livingGuiltyVoters, pickTarget, driveActor, driveStep, driveNight,
  trialVoters, voteBtn, castAll, castVotes, secondAll, noSelfTargets
};
