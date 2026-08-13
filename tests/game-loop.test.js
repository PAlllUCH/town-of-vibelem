'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

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

const engine = require('../js/engine.js');
require('../js/ui/common.js');
require('../js/ui/setup.js');
require('../js/ui/seats.js');
require('../js/ui/wizard.js');
require('../js/ui/day.js');
require('../js/ui/end.js');
require('../js/ui/reference.js');
require('../js/app/config.js');
require('../js/app/persistence.js');
require('../js/app/router.js');
require('../js/app/actions-setup.js');
require('../js/app/actions-seats.js');
require('../js/app/actions-game.js');
require('../js/app/actions-panels.js');
require('../js/app/actions.js');
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

describe('house rule defaults', () => {
  test('the default config inherits noLynchD1 ON', () => {
    APP.newGame();
    assert.strictEqual(APP.cfg.houseRules.noLynchD1, true);
    assert.strictEqual(APP.cfg.houseRules.noKillN1, true);
    assert.strictEqual(APP.cfg.houseRules.classicReveal, false);
  });
});

describe('full-app game loop driver', () => {

  test('full 10-player game: prep, Day-1 two-stage trial, Godfather lynch, Town victory, END reveal', () => {
    const roles = ['civilian', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian',
      'doctor', 'godfather', 'survivor', 'jester'];
    startRoles(10, { town: 6, mafia: 3, neutral: 1 }, roles, null, { noLynchD1: false });
    assert.ok(html('seats-body').indexOf('Begin Day 1') !== -1);
    APP.beginDay1();
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.strictEqual(APP.state.dayNumber, 1);
    assert.ok(html('game-header').indexOf('Day 1') !== -1);
    assert.ok(!APP.app.wizard);
    APP.app.trialNom = 1;
    APP.startTrial(8);
    assert.ok(APP.state.trial.active);
    assert.strictEqual(APP.state.trial.stage, 'SECONDS');
    assert.ok(html('game-body').indexOf('Resolve Nomination') !== -1);
    secondAll();
    assert.strictEqual(APP.state.trial.seconds.length, 9);
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'VOTE');
    assert.ok(APP.state.trial.active);
    assert.ok(html('game-bar').indexOf('Resolve Trial') !== -1);
    castAll('GUILTY');
    assert.strictEqual(APP.state.trial.votes.length, 10);
    APP.resolveTrial();
    assert.ok(APP.app.lastTrialResult && APP.app.lastTrialResult.lynchedId === 8);
    assert.strictEqual(APP.state.phase, 'END');
    assert.strictEqual(APP.state.winner, 'TOWN');
    assert.ok(Array.isArray(APP.app.endReveal) && APP.app.endReveal.length === 10);
    assert.ok(html('end-body').indexOf('Role Reveal') !== -1);
    assert.ok(html('end-body').indexOf('seat-tile') !== -1);
  });

  test('three full day/night cycles with a Witch and Jester never crash, never self-target, and clamp the wizard index', () => {
    const roles = ['civilian', 'doctor', 'sheriff', 'escort', 'godfather', 'mafioso', 'jester', 'witch'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.state.witchSide = 'TOWN';
    for (let day = 1; day <= 3; day += 1) {
      if (day === 1) APP.beginDay1();
      assert.strictEqual(APP.state.phase, 'DAY');
      assert.ok(html('game-body').indexOf('Discussion Timer') !== -1);
      APP.app.trialNom = 1;
      APP.startTrial(day === 3 ? 5 : 3);
      assert.strictEqual(APP.state.trial.stage, 'SECONDS');
      secondAll();
      APP.resolveTrial();
      assert.strictEqual(APP.state.trial.stage, 'VOTE');
      assert.ok(APP.state.trial.active);
      castAll('ABSTAIN');
      APP.resolveTrial();
      assert.ok(APP.state.phase === 'DAY' || APP.state.phase === 'END');
      if (day === 3) break;
      APP.endDay();
      assert.strictEqual(APP.state.phase, 'NIGHT');
      assert.ok(APP.app.wizard && APP.app.wizard.steps.length >= 1);
      driveNight();
      assert.ok(noSelfTargets(), 'cycle ' + day + ' recorded a self-target');
      assert.ok(APP.app.wizard.idx >= 0 && APP.app.wizard.idx < APP.app.wizard.steps.length);
      APP.resolveNight();
      assert.strictEqual(APP.state.phase, 'MORNING');
      assert.ok(html('game-body').indexOf('Morning Announcement') !== -1);
      APP.beginDay();
      assert.strictEqual(APP.state.phase, 'DAY');
    }
  });

  test('6-player zero-Neutral game renders seats without an executioner hint and plays one night', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso'];
    startRoles(6, { town: 4, mafia: 2, neutral: 0 }, roles);
    assert.strictEqual(APP.state.executionerTarget, null);
    assert.ok(html('seats-body').indexOf('Begin Day 1') !== -1);
    assert.ok(html('seats-body').indexOf('Executioner target') === -1);
    APP.beginDay1();
    assert.strictEqual(APP.state.phase, 'DAY');
    APP.endDay();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.ok(html('game-body').indexOf('Morning Announcement') !== -1);
  });

  test('15-player max-rollup game plays a full 15-step night; corpse-role steps skipped on N1', () => {
    const roles = ['veteran', 'jailor', 'escort', 'doctor', 'sheriff', 'tracker', 'undertaker',
      'retributionist', 'medium', 'godfather', 'mafioso', 'consort', 'forger', 'witch', 'amnesiac'];
    startRoles(15, { town: 9, mafia: 4, neutral: 2 }, roles);
    APP.beginDay1();
    APP.endDay();
    const titles = APP.app.wizard.steps.map(function (s) { return s.title; });
    ['Veteran Alert', 'Witch', 'Jailor', 'Escort', 'Consort', 'Doctor', 'Mafia', 'Forger',
      'Sheriff', 'Tracker', 'Undertaker', 'Retributionist', 'Amnesiac', 'Medium and Ghosts', 'Morning']
      .forEach(function (t) {
        assert.ok(titles.indexOf(t) !== -1, 'night steps missing expected step: ' + t);
      });
    driveNight();
    assert.strictEqual(APP.app.wizard.idx, APP.app.wizard.steps.length - 1);
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.ok(html('game-body').indexOf('Morning Announcement') !== -1);
  });

  test('wizBack then re-recording an investigator replaces the action in place, newest target wins', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'tracker', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.wizActor('doctor', 3);
    APP.wizTarget(1);
    APP.wizNext();
    APP.wizMafiaTarget(1);
    APP.wizNext();
    assert.strictEqual(APP.app.wizard.idx, 2);
    APP.wizActor('tracker', 4);
    APP.wizTarget(2);
    let trackerActions = APP.state.night.actions.filter(function (a) {
      return a.position === 11 && a.roleId === 'tracker';
    });
    assert.strictEqual(trackerActions.length, 1);
    assert.strictEqual(trackerActions[0].targetId, 2);
    APP.wizBack();
    APP.wizNext();
    APP.wizActor('tracker', 4);
    APP.wizTarget(3);
    trackerActions = APP.state.night.actions.filter(function (a) {
      return a.position === 11 && a.roleId === 'tracker';
    });
    assert.strictEqual(trackerActions.length, 1);
    assert.strictEqual(trackerActions[0].targetId, 3);
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
  });

  test('Blackmailer night resolves to a day phase with morning.blackmailTarget set', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'blackmailer', 'survivor'];
    startRoles(8, { town: 4, mafia: 3, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.ok(APP.state.morning && APP.state.morning.blackmailTarget != null);
    APP.beginDay();
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.ok(html('game-body').indexOf('Discussion Timer') !== -1);
    const silenced = APP.state.players.filter(function (p) { return p.blackmailed; });
    assert.strictEqual(silenced.length, 1);
    assert.strictEqual(silenced[0].id, APP.state.morning.blackmailTarget);
  });

  test('Jester haunt with zero living Guilty voters: night step renders and advances silently (haunt unfired)', () => {
    const roles = ['veteran', 'vigilante', 'deputy', 'civilian', 'doctor', 'jester',
      'survivor', 'godfather', 'mafioso'];
    startRoles(9, { town: 5, mafia: 2, neutral: 2 }, roles, null, { noKillN1: false, noLynchD1: false });
    APP.beginDay1();
    assert.strictEqual(APP.state.phase, 'DAY');
    APP.app.trialNom = 2;
    APP.startTrial(6);
    assert.strictEqual(APP.state.trial.stage, 'SECONDS');
    secondAll();
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'VOTE');
    assert.ok(APP.state.trial.active);
    castVotes({
      1: 'GUILTY', 3: 'GUILTY', 6: 'GUILTY', 7: 'GUILTY', 8: 'GUILTY',
      2: 'ABSTAIN', 4: 'ABSTAIN', 5: 'ABSTAIN', 9: 'ABSTAIN'
    });
    APP.resolveTrial();
    assert.ok(APP.app.lastTrialResult && APP.app.lastTrialResult.lynchedId === 6);
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.strictEqual(APP.state.jester.haunted, true);
    APP.doDayAbility('deputy', 8);
    APP.doDayAbility('vigilante', 7);
    APP.doDayAbility('vigilante', 1);
    APP.doDayAbility('vigilante', 3);
    assert.strictEqual(livingGuiltyVoters(APP.state).length, 0);
    APP.endDay();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    assert.ok(APP.app.wizard.steps[0].roles.indexOf('jester') !== -1);
    APP.wizActor('jester', 6);
    assert.ok(html('game-body').indexOf('No living Guilty voters') !== -1);
    APP.wizNext();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.ok(html('game-body').indexOf('?? UNKNOWN ??') !== -1);
    assert.strictEqual(APP.state.jester.haunted, false);
  });

  test('legacy-save deserialize backfills documented state fields and the game still plays', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.wizActor('doctor', 3);
    APP.wizTarget(1);
    APP.wizNext();
    APP.wizMafiaTarget(1);
    APP.wizNext();
    assert.strictEqual(APP.app.wizard.idx, 2);
    const st2 = JSON.parse(E.serialize(APP.state));
    delete st2.executionerConverted;
    delete st2.pendingInheritanceNote;
    delete st2.night.lastJailTarget;
    delete st2.night.lastBlackmailTarget;
    delete st2.morning;
    localStorage.setItem(APP.SAVE_KEY, JSON.stringify({
      cfg: APP.cfg,
      ui: {
        rolesHidden: false,
        namingMode: false,
        wizardIdx: APP.app.wizard.idx,
        pendingRoles: APP.app.pendingRoles,
        names: APP.app.names,
        dayTimerEnds: null,
        dayTimerTotal: null
      },
      game: JSON.stringify(st2)
    }));
    APP.resumeGame();
    assert.ok(APP.state);
    assert.strictEqual(APP.state.phase, 'NIGHT');
    assert.ok(Array.isArray(APP.state.morning.deaths));
    assert.strictEqual(APP.state.executionerConverted, false);
    assert.strictEqual(APP.state.pendingInheritanceNote, '');
    assert.strictEqual(APP.state.night.lastJailTarget, null);
    assert.strictEqual(APP.state.night.lastBlackmailTarget, null);
    assert.ok(APP.app.wizard);
    assert.strictEqual(APP.app.wizard.idx, 2);
    driveNight();
    assert.strictEqual(APP.app.wizard.idx, APP.app.wizard.steps.length - 1);
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
  });

  test('blank names fall back to Player N and hostile names are escaped in seat rendering', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso'];
    const names = {
      1: '   ',
      2: 'X <img src=x> "quote"',
      3: 'Alice', 4: 'Bob', 5: 'Carol', 6: 'Dave'
    };
    startRoles(6, { town: 4, mafia: 2, neutral: 0 }, roles, names);
    assert.strictEqual(APP.state.players[0].name, 'Player 1');
    assert.strictEqual(APP.state.players[1].name, 'X <img src=x> "quote"');
    assert.ok(html('seats-body').indexOf('<img') === -1);
    assert.ok(html('seats-body').indexOf('&lt;img') !== -1);
  });

  test('corrupted save JSON boots into setup and resume without throwing', () => {
    localStorage.setItem(APP.SAVE_KEY, '{broken json');
    APP.init();
    APP.goto('setup');
    assert.ok(html('setup-body').indexOf('Start Session') !== -1);
    APP.resumeGame();
    assert.strictEqual(APP.state, null);
  });

  test('two-tap steps (Witch, Jailor, Forger, Medium) record their extra fields on a full night walk', () => {
    const roles = ['jailor', 'medium', 'doctor', 'sheriff', 'godfather', 'mafioso', 'forger', 'witch'];
    startRoles(8, { town: 4, mafia: 3, neutral: 1 }, roles);
    APP.state.witchSide = 'TOWN';
    APP.beginDay1();
    APP.endDay();
    driveNight();
    const witchAc = APP.state.night.actions.find(function (a) { return a.roleId === 'witch'; });
    assert.ok(witchAc && witchAc.extra && witchAc.extra.controlRedirect != null);
    const jailAc = APP.state.night.actions.find(function (a) { return a.roleId === 'jailor'; });
    assert.ok(jailAc && jailAc.extra && jailAc.extra.jailorDecision === 'SPARE');
    const forgeAc = APP.state.night.actions.find(function (a) { return a.roleId === 'forger'; });
    assert.ok(forgeAc && forgeAc.targetId != null);
    const medAc = APP.state.night.actions.find(function (a) { return a.roleId === 'medium'; });
    assert.ok(medAc && medAc.targetId == null);
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
  });

  test('prep flow: Begin Day 1 before Night 1, Day-1 save resumes, N1 rules in effect (noKillN1, Jailor SPARE-only)', () => {
    const roles = ['jailor', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    assert.strictEqual(APP.state.phase, 'SEATS');
    assert.ok(html('seats-body').indexOf('Begin Day 1') !== -1);
    APP.beginDay1();
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.strictEqual(APP.state.dayNumber, 1);
    assert.ok(!APP.app.wizard);
    assert.ok(html('game-header').indexOf('Day 1') !== -1);
    APP.save();
    APP.resumeGame();
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.ok(!APP.app.wizard);
    assert.ok(html('game-header').indexOf('Day 1') !== -1);
    APP.endDay();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    assert.strictEqual(APP.state.night.number, 1);
    assert.ok(html('game-header').indexOf('Night 1') !== -1);
    assert.ok(APP.app.wizard && APP.app.wizard.steps.length >= 1);
    const jailStep = APP.app.wizard.steps.find(function (s) { return s.title === 'Jailor'; });
    assert.ok(jailStep && jailStep.prompt.indexOf('cannot execute') !== -1);
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.ok(html('game-body').indexOf('No deaths last night.') !== -1);
    APP.beginDay();
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.strictEqual(APP.state.dayNumber, 2);
    assert.ok(html('game-header').indexOf('Day 2') !== -1);
  });

  test('naming grid renders tappable seat buttons and no inline inputs', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    const h = html('seats-body');
    assert.ok(h.indexOf('seat-btn') !== -1);
    assert.ok(h.indexOf('data-action="open-naming-sheet"') !== -1);
    assert.ok(h.indexOf('seat-name-input') === -1);
    assert.ok(h.indexOf('data-action="seat-role"') === -1);
    assert.ok(h.indexOf('left to assign') !== -1);
    APP.closeSheet();
  });

  test('naming sheet civilian option is gated by deck civilian capacity', () => {
    APP.newGame();
    APP.cfg.playerCount = 8;
    APP.startGame();
    assert.strictEqual(APP.state.deck.indexOf('civilian'), -1);
    APP.openNamingSheet(1);
    let h = html('sheet-root');
    assert.ok(h.indexOf('data-role="civilian"') === -1);
    assert.ok(h.indexOf('data-role="sheriff"') !== -1);
    APP.closeSheet();

    APP.newGame();
    APP.cfg.playerCount = 15;
    APP.cfg.teamCounts = { town: 9, mafia: 4, neutral: 2 };
    APP.cfg.deckConfig.town = ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist'];
    APP.startGame();
    const civCount = APP.state.deck.filter(function (r) { return r === 'civilian'; }).length;
    assert.ok(civCount >= 1, 'p1 at 15 players should include civilians');
    APP.openNamingSheet(1);
    assert.ok(html('sheet-root').indexOf('data-role="civilian"') !== -1);
    APP.closeSheet();

    APP.app.pendingRoles = { 1: 'civilian' };
    APP.openNamingSheet(2);
    assert.ok(html('sheet-root').indexOf('data-role="civilian"') !== -1);
    APP.closeSheet();
    APP.app.pendingRoles = { 1: 'civilian', 2: 'civilian' };
    APP.openNamingSheet(3);
    assert.ok(html('sheet-root').indexOf('data-role="civilian"') === -1);
    APP.closeSheet();

    APP.app.pendingRoles = { 1: 'sheriff' };
    APP.openNamingSheet(2);
    assert.ok(html('sheet-root').indexOf('data-role="sheriff"') !== -1);
    assert.ok(html('sheet-root').indexOf('TAKEN') !== -1);
    APP.closeSheet();
    APP.openNamingSheet(1);
    assert.ok(html('sheet-root').indexOf('data-role="sheriff"') !== -1);
    APP.closeSheet();
  });

  test('naming grid shows the pending role under each seat name', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.app.pendingRoles = { 3: 'sheriff', 5: 'doctor' };
    APP.afterMutation();
    const h = html('seats-body');
    const seat3 = h.slice(h.indexOf('data-seat="3"'), h.indexOf('data-seat="4"'));
    assert.ok(seat3.indexOf('seat-btn-role') !== -1);
    assert.ok(seat3.indexOf('Sheriff') !== -1);
    const seat4 = h.slice(h.indexOf('data-seat="4"'), h.indexOf('data-seat="5"'));
    assert.ok(seat4.indexOf('&ndash;') !== -1);
    const seat5 = h.slice(h.indexOf('data-seat="5"'), h.indexOf('data-seat="6"'));
    assert.ok(seat5.indexOf('Doctor') !== -1);
    APP.closeSheet();
  });

  test('naming picker lists taken roles as disabled rows and keeps the current seat role enabled', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'jailor' };
    APP.openNamingSheet(2);
    const h = html('sheet-root');
    const jailor = roleButton(h, 'jailor');
    assert.ok(jailor.indexOf('disabled') !== -1);
    assert.ok(jailor.indexOf('TAKEN') !== -1);
    assert.ok(jailor.indexOf('aria-selected="true"') === -1);
    const sheriff = roleButton(h, 'sheriff');
    assert.ok(sheriff.indexOf('disabled') === -1);
    assert.ok(h.indexOf('No role yet') !== -1);
    assert.ok(h.indexOf('Currently:') === -1);
    APP.closeSheet();
  });

  test('naming sheet marks the current seat pending role pill as on', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'jailor', 2: 'sheriff' };
    APP.openNamingSheet(2);
    const h = html('sheet-root');
    const sheriff = roleButton(h, 'sheriff');
    assert.ok(sheriff.indexOf('seat-sheet-role-btn btn btn-sm on') !== -1);
    assert.ok(sheriff.indexOf('aria-selected="true"') !== -1);
    assert.ok(sheriff.indexOf('disabled') === -1);
    assert.ok(h.indexOf('Currently: <strong>Sheriff</strong>') !== -1);
    const jailor = roleButton(h, 'jailor');
    assert.ok(jailor.indexOf('disabled') !== -1);
    assert.ok(jailor.indexOf('class="seat-sheet-role-btn btn btn-sm on"') === -1);
    APP.closeSheet();
  });

  test('detail sheet shows the per-player activity log after a resolved night', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    const doc = APP.state.players.find(function (p) { return p.assignedRole === 'doctor'; });
    const log = (APP.state.playerLog[String(doc.id)] || []).map(function (e) { return e.text; });
    assert.ok(log.some(function (t) { return t.indexOf('assigned') !== -1; }));
    assert.ok(log.some(function (t) { return t.indexOf('targeted') !== -1; }));
    APP.openDetailSheet(String(doc.seat));
    const h = html('sheet-root');
    assert.ok(h.indexOf('Activity Log') !== -1);
    assert.ok(h.indexOf('seat-sheet-role-name') !== -1);
    assert.ok(h.indexOf('assigned') !== -1);
    assert.ok(h.indexOf('targeted') !== -1);
    assert.ok(h.indexOf('ALIVE') !== -1);
    assert.ok(h.indexOf('log-kind-tag') !== -1);
    assert.ok(h.indexOf('data-kind=') !== -1);
    APP.closeSheet();
  });

  test('pick-role updates the open naming sheet in place without remounting', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'sheriff' };
    APP.openNamingSheet(1);
    const before = html('sheet-root');
    assert.ok(before.indexOf('Currently: <strong>Sheriff</strong>') !== -1);

    const sheetCls = { 'seat-sheet': true, open: true };
    const sheetEl = {
      classList: {
        contains(c) { return !!sheetCls[c]; }
      }
    };
    const strong = { textContent: '' };
    const buttons = [];
    const btnRe = /<button class="seat-sheet-role-btn btn btn-sm([^"]*)" role="option" aria-selected="(true|false)"[^>]*data-role="([^"]+)"/g;
    let m;
    while ((m = btnRe.exec(before))) {
      const cls = {};
      if (m[1].indexOf(' on') !== -1) cls.on = true;
      const attrs = { 'data-role': m[3], 'aria-selected': m[2] };
      buttons.push({
        classList: {
          add(c) { cls[c] = true; },
          remove(c) { delete cls[c]; },
          contains(c) { return !!cls[c]; }
        },
        getAttribute(k) { return attrs[k] != null ? attrs[k] : null; },
        setAttribute(k, v) { attrs[k] = v; },
        focus() {}
      });
    }
    const sheriffBtn = buttons.find(function (b) { return b.getAttribute('data-role') === 'sheriff'; });
    const jailorBtn = buttons.find(function (b) { return b.getAttribute('data-role') === 'jailor'; });
    assert.ok(sheriffBtn && sheriffBtn.classList.contains('on'));
    assert.ok(jailorBtn && !jailorBtn.classList.contains('on'));

    const origHost = els['sheet-root'];
    els['sheet-root'] = {
      id: 'sheet-root',
      innerHTML: before,
      sheetEl: sheetEl,
      strong: strong,
      buttons: buttons,
      querySelectorAll: function (sel) { return sel === '.seat-sheet-role-btn' ? this.buttons : []; },
      querySelector: function (sel) {
        if (sel === '.seat-sheet.open') return this.sheetEl;
        if (sel === '.seat-sheet-role-btn.on') {
          return this.buttons.find(function (b) { return b.classList.contains('on'); }) || null;
        }
        if (sel === '.seat-sheet-current strong') return this.strong;
        return null;
      }
    };
    try {
      APP.pickRole({ getAttribute: function (k) { return k === 'data-role' ? 'jailor' : null; } });
      assert.ok(jailorBtn.classList.contains('on'));
      assert.ok(!sheriffBtn.classList.contains('on'));
      assert.strictEqual(jailorBtn.getAttribute('aria-selected'), 'true');
      assert.strictEqual(sheriffBtn.getAttribute('aria-selected'), 'false');
      assert.strictEqual(strong.textContent, 'Jailor');
      assert.strictEqual(html('sheet-root'), before, 'the sheet innerHTML must not be rewritten');
      assert.ok(sheetEl.classList.contains('open'), 'the sheet must stay open');
      assert.strictEqual(APP.app.sheet.role, 'jailor');
    } finally {
      els['sheet-root'] = origHost;
    }
  });

  test('mountSheet does not re-run the open animation on an already-open sheet', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.openNamingSheet(1);
    const prevRaf = globalThis.requestAnimationFrame;
    const origHost = els['sheet-root'];
    let rafCalls = 0;
    globalThis.requestAnimationFrame = function (cb) { rafCalls += 1; cb(); return 0; };
    try {
      els['sheet-root'] = {
        id: 'sheet-root',
        innerHTML: html('sheet-root'),
        querySelector: function (sel) {
          return sel === '.seat-sheet.open' && this.innerHTML.indexOf('seat-sheet') !== -1 ? this.sheetEl : null;
        },
        querySelectorAll: function () { return []; },
        sheetEl: { classList: { add: function () {} } }
      };
      APP.updateSheetDom();
      assert.strictEqual(rafCalls, 0, 're-mounting an open sheet must not re-add .open via rAF');
      APP.closeSheet();
      APP.openNamingSheet(2);
      assert.strictEqual(rafCalls, 1, 'a fresh sheet mount still animates via rAF');
    } finally {
      els['sheet-root'] = origHost;
      if (prevRaf === undefined) delete globalThis.requestAnimationFrame;
      else globalThis.requestAnimationFrame = prevRaf;
    }
  });

  test('night wizard living-target buttons show the target role next to the name', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    assert.strictEqual(APP.state.night.number, 1);
    APP.wizActor('doctor', 3);
    APP.wizTarget(1);
    APP.wizNext();
    assert.strictEqual(APP.app.wizard.steps[APP.app.wizard.idx].position, 6);
    const h = html('game-body');
    assert.ok(h.indexOf('A \u00B7 Civilian') !== -1);
    assert.ok(h.indexOf('D \u00B7 Sheriff') !== -1);
    assert.ok(h.indexOf('F \u00B7 Mafioso') !== -1);
    assert.ok(h.indexOf('G \u00B7 Jester') !== -1);
    assert.ok(h.indexOf('E \u00B7 Godfather') === -1, 'the kill leader is excluded from the target list');
  });

  test('night wizard corpse buttons show the stored corpse role next to the name', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'undertaker', 'godfather', 'mafioso', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'U', 6: 'E', 7: 'F', 8: 'S' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names, { noLynchD1: false });
    APP.beginDay1();
    APP.app.trialNom = 2;
    APP.startTrial(1);
    secondAll();
    APP.resolveTrial();
    castAll('GUILTY');
    APP.resolveTrial();
    assert.ok(!APP.state.players[0].isAlive, 'player 1 should be lynched on day 1');
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.ok(APP.state.graveyard.length === 1);
    APP.endDay();
    assert.strictEqual(APP.state.night.number, 1);
    APP.wizActor('doctor', 3);
    APP.wizTarget(2);
    APP.wizNext();
    APP.wizNext();
    APP.wizActor('sheriff', 4);
    APP.wizTarget(2);
    APP.wizNext();
    const ustep = APP.app.wizard.steps[Math.min(APP.app.wizard.idx, APP.app.wizard.steps.length - 1)];
    assert.strictEqual(ustep.title, 'Undertaker');
    APP.wizActor('undertaker', 5);
    const h = html('game-body');
    assert.ok(h.indexOf('A \u00B7 Civilian') !== -1);
  });

});

describe('moderator toolbox', () => {

  test('Night Zero checklist derives rows from state and toggling marks them done', () => {
    const roles = ['sheriff', 'jailor', 'doctor', 'civilian', 'civilian', 'civilian', 'civilian',
      'godfather', 'mafioso', 'consigliere', 'executioner', 'witch'];
    startRoles(12, { town: 7, mafia: 3, neutral: 2 }, roles);
    let h = html('seats-body');
    assert.ok(h.indexOf('Night Zero') !== -1);
    assert.ok(h.indexOf('GF: bluff as') !== -1);
    assert.ok(h.indexOf('data-nz="bluffs"') !== -1);
    assert.ok(h.indexOf('data-nz="witch"') !== -1);
    assert.ok(h.indexOf('Executioner target:') !== -1);
    assert.ok(h.indexOf('data-nz="deal"') !== -1);
    assert.ok(h.indexOf('0/4 done') !== -1);
    assert.ok(h.indexOf('data-nz="relays"') === -1);
    APP.nzToggle('bluffs');
    h = html('seats-body');
    const bluffsRow = h.slice(h.indexOf('data-nz="bluffs"') - 80, h.indexOf('data-nz="bluffs"') + 5);
    assert.ok(bluffsRow.indexOf('toggle-row on') !== -1);
    assert.ok(h.indexOf('1/4 done') !== -1);
    APP.nzToggle('bluffs');
    assert.ok(html('seats-body').indexOf('0/4 done') !== -1);
  });

  test('whispers panel lists info entries and the relay hint after a resolved night', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    const sheriff = APP.state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    const infos = ((APP.state.playerLog[String(sheriff.id)] || [])).filter(function (e) { return e.kind === 'info'; });
    assert.ok(infos.length >= 1, 'sheriff should have an info entry after the night');
    APP.toggleWhispers();
    const h = html('panel-root');
    assert.ok(h.indexOf('Tonight\'s Whispers') !== -1);
    assert.ok(h.indexOf('Relay to the player before they wake') !== -1);
    assert.ok(h.indexOf('Sheriff check on') !== -1);
    assert.ok(h.indexOf('tag-accent') !== -1);
  });

  test('claims panel records a claim and survives a save/load round trip', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.toggleClaims();
    assert.ok(html('panel-root').indexOf('Public Claims') !== -1);
    assert.ok(html('panel-root').indexOf('No claim') !== -1);
    APP.claimOpen(1);
    assert.ok(html('panel-root').indexOf('Claim for') !== -1);
    assert.ok(html('panel-root').indexOf('claim-team-head') !== -1);
    APP.claimPick(1, 'sheriff');
    assert.ok(html('panel-root').indexOf('claim-chip on') !== -1);
    assert.ok(html('panel-root').indexOf('>Sheriff</span>') !== -1);
    APP.save();
    APP.resumeGame();
    assert.strictEqual(APP.app.claims['1'], 'sheriff');
    APP.toggleClaims();
    APP.toggleClaims();
    assert.ok(html('panel-root').indexOf('Public Claims') !== -1);
    assert.ok(html('panel-root').indexOf('claim-chip on') !== -1);
    APP.claimOpen(1);
    APP.claimClear(1);
    assert.ok(html('panel-root').indexOf('No claim') !== -1);
  });

  test('role picker orders pills by team then alphabetically, current role pinned first', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'jailor' };
    APP.openNamingSheet(2);
    let h = html('sheet-root');
    assert.ok(h.indexOf('data-role="jailor"') < h.indexOf('data-role="sheriff"'), 'alphabetical within Town');
    assert.ok(h.indexOf('data-role="sheriff"') < h.indexOf('data-role="godfather"'), 'Town before Mafia');
    APP.closeSheet();
    APP.app.pendingRoles = { 1: 'jailor', 2: 'sheriff' };
    APP.openNamingSheet(2);
    h = html('sheet-root');
    assert.ok(h.indexOf('data-role="sheriff"') < h.indexOf('data-role="jailor"'), 'current role pinned first');
    APP.closeSheet();
  });

  test('wizard shows the Step counter and a Resolve Night banner on the final step', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    assert.ok(html('game-body').indexOf('wizard-progress') !== -1);
    assert.ok(html('game-body').indexOf('Step 1 of') !== -1);
    while (APP.app.wizard.idx < APP.app.wizard.steps.length - 1) {
      APP.wizNext();
    }
    assert.ok(html('game-body').indexOf('Resolve Night') !== -1);
  });

  test('guided claim round renders on Day 1, walks each living player, and ends in the claim grid', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    assert.strictEqual(APP.state.dayNumber, 1);
    let h = html('game-body');
    assert.ok(h.indexOf('Claim Round') !== -1);
    assert.ok(h.indexOf('Player 1 of 8') !== -1);
    assert.ok(h.indexOf('Claim\u2026') !== -1);
    APP.claimRoundOpen();
    h = html('game-body');
    assert.ok(h.indexOf('Claim for A (seat 1)') !== -1);
    assert.ok(h.indexOf('claim-team-head') !== -1);
    assert.ok(h.indexOf('data-action="claim-round-pick"') !== -1);
    APP.claimRoundPick(1, 'doctor');
    h = html('game-body');
    assert.ok(h.indexOf('Player 2 of 8') !== -1);
    assert.strictEqual(APP.app.claims['1'], 'doctor');
    for (let seat = 2; seat <= 8; seat += 1) {
      APP.claimRoundPick(seat, 'civilian');
    }
    h = html('game-body');
    assert.ok(h.indexOf('All claims recorded. Tap a claim to edit.') !== -1);
    assert.ok(h.indexOf('claim-chip on') !== -1);
    assert.strictEqual(Object.keys(APP.app.claims).length, 8);
    APP.save();
    APP.resumeGame();
    assert.ok(APP.app.claimRound, 'the claim round survives a save/load round trip');
    assert.strictEqual(APP.app.claims['1'], 'doctor');
    assert.strictEqual(APP.app.claims['4'], 'civilian');
    APP.claimRoundEdit(4);
    h = html('game-body');
    assert.ok(h.indexOf('Claim for D (seat 4)') !== -1);
    APP.claimRoundPick(4, 'sheriff');
    assert.strictEqual(APP.app.claims['4'], 'sheriff');
    APP.claimRoundDone();
    assert.strictEqual(APP.app.claimRound.active, false);
    assert.ok(html('game-body').indexOf('Claim Round') === -1);
    APP.endDay();
    APP.resolveNight();
    APP.beginDay();
    assert.strictEqual(APP.state.dayNumber, 2);
    assert.ok(html('game-body').indexOf('Claim Round') === -1, 'no guided round on later days');
  });

  test('morning whisper result card shows fresh info with a Whisper done relay button', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    const sheriff = APP.state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    const infos = ((APP.state.playerLog[String(sheriff.id)] || [])).filter(function (e) { return e.kind === 'info'; });
    assert.ok(infos.length >= 1, 'sheriff should have a fresh info entry');
    let h = html('game-body');
    assert.ok(h.indexOf('Whisper Results') !== -1);
    assert.ok(h.indexOf('notice info') !== -1);
    assert.ok(h.indexOf('Whisper done') !== -1);
    assert.ok(h.indexOf('Sheriff check on') !== -1);
    APP.whisperDone(sheriff.id, APP.state.night.number - 1);
    h = html('game-body');
    assert.ok(h.indexOf('Whisper done') === -1, 'relayed results drop the button');
    assert.ok(h.indexOf('RELAYED') !== -1);
    APP.save();
    APP.app.relayedWhispers = {};
    APP.resumeGame();
    h = html('game-body');
    assert.ok(h.indexOf('RELAYED') !== -1, 'relayed tag persists across save/load');
  });

  test('wizard corpse picker marks a cleaned corpse with the CLEANED tag', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'undertaker', 'janitor', 'forger', 'godfather'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'U', 6: 'J', 7: 'F', 8: 'G' };
    startRoles(8, { town: 5, mafia: 3, neutral: 0 }, roles, names, { noLynchD1: false });
    APP.beginDay1();
    APP.app.trialNom = 2;
    APP.startTrial(1);
    secondAll();
    APP.resolveTrial();
    castAll('GUILTY');
    APP.resolveTrial();
    assert.ok(!APP.state.players[0].isAlive, 'player 1 is lynched on day 1');
    assert.strictEqual(APP.state.graveyard.length, 1);
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.graveyard[0].wasCleaned, true);
    APP.beginDay();
    assert.strictEqual(APP.state.dayNumber, 2);
    APP.endDay();
    const ut = APP.app.wizard.steps.find(function (s) { return s.title === 'Undertaker'; });
    assert.ok(ut, 'the Undertaker step exists on night 2');
    APP.wizActor('undertaker', 5);
    const h = html('game-body');
    assert.ok(h.indexOf('CLEANED') !== -1);
    assert.ok(h.indexOf('tag-bad') !== -1);
  });

  test('wizard Forger confirm shows the Will forge target note above the button', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'forger', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    while (APP.app.wizard.steps[Math.min(APP.app.wizard.idx, APP.app.wizard.steps.length - 1)].title !== 'Forger') {
      APP.wizNext();
    }
    APP.wizActor('forger', 7);
    APP.wizTarget(1);
    const h = html('game-body');
    assert.ok(h.indexOf('Will forge: A \u00B7 Civilian') !== -1);
    assert.ok(h.indexOf('actor-done') !== -1);
  });

  test('wizard summary card lists every recorded action on the last step', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    assert.strictEqual(APP.app.wizard.idx, APP.app.wizard.steps.length - 1);
    const h = html('game-body');
    assert.ok(h.indexOf('Night Actions Summary') !== -1);
    assert.ok(h.indexOf('protect') !== -1);
    assert.ok(h.indexOf('kill') !== -1);
    assert.ok(h.indexOf('Sheriff') !== -1);
  });

  test('wizard Veteran shows the LAST ALERT chip on the final alert', () => {
    const roles = ['veteran', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.state.players[0].alertsUsed = 2;
    APP.beginDay1();
    APP.endDay();
    const vetStep = APP.app.wizard.steps.find(function (s) { return s.title === 'Veteran Alert'; });
    assert.ok(vetStep, 'the veteran step exists while alertsUsed < 3');
    APP.wizActor('veteran', 1);
    const h = html('game-body');
    assert.ok(h.indexOf('LAST ALERT') !== -1);
    assert.ok(h.indexOf('tag-bad') !== -1);
  });

  test('wizard Witness two-pick records extra.secondTarget on confirm', () => {
    const roles = ['civilian', 'civilian', 'witness', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'W', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    while (APP.app.wizard.steps[Math.min(APP.app.wizard.idx, APP.app.wizard.steps.length - 1)].title !== 'Witness') {
      APP.wizNext();
    }
    APP.wizActor('witness', 3);
    let h = html('game-body');
    assert.ok(h.indexOf('first player') !== -1);
    APP.wizTarget(1);
    h = html('game-body');
    assert.ok(h.indexOf('second player') !== -1);
    assert.ok(h.indexOf('A \u00B7 first pick') !== -1);
    APP.wizTarget(4);
    h = html('game-body');
    assert.ok(h.indexOf('Witness: A and D \u2192 Both Town') !== -1);
    APP.wizWitnessConfirm();
    const wac = APP.state.night.actions.find(function (a) { return a.roleId === 'witness'; });
    assert.ok(wac, 'witness action recorded');
    assert.strictEqual(wac.targetId, 1);
    assert.ok(wac.extra && wac.extra.secondTarget === 4);
  });

});
