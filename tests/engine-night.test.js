'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../js/engine.js');
const {
  pid, roleIdByName, assignRoles, act, night, sorted, preview,
  logText, aliveIds, deathCauses, graveyardEntry, dealExact
} = require('./helpers.js');
// ---------------------------------------------------------------------------
// Night resolution order, attack and defense model
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
describe('night resolution order and the attack/defense model', () => {
  test('Doctor protection blocks every Basic attack that night', () => {
    const state = assignRoles(['doctor', 'civilian', 'godfather', 'mafioso', 'serialkiller', 'civilian']);
    act(state, 5, 'doctor', 1, 2);
    act(state, 6, 'godfather', 3, 2);
    act(state, 9, 'serialkiller', 5, 2);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(result.deaths.length, 0);
    assert.ok(logText(state).includes('survived an attack (Doctor protection)'));
  });

  test('a single Basic attack is fully blocked by protection', () => {
    const state = assignRoles(['doctor', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 5, 'doctor', 1, 2);
    act(state, 6, 'godfather', 3, 2);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(result.deaths.length, 0);
  });

  test('the Doctor may protect themselves', () => {
    const state = assignRoles(['doctor', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 5, 'doctor', 1, 1);
    act(state, 6, 'godfather', 2, 3);
    const result = night(state);
    assert.strictEqual(pid(state, 1).isProtected, true);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(deathCauses(result)[3], 'killed by the Mafia');
  });

  test('the Mafia may kill a fellow Mafia member', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 2);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[2], 'killed by the Mafia');
    assert.ok(graveyardEntry(state, 2));
    assert.ok(!logText(state).includes('kill failed'));
  });

  test('two Basic attacks on an unprotected target: the first kills, the second is void', () => {
    const state = assignRoles(['doctor', 'civilian', 'godfather', 'mafioso', 'serialkiller', 'civilian']);
    act(state, 6, 'godfather', 3, 2);
    act(state, 9, 'serialkiller', 5, 2);
    const result = night(state);
    assert.strictEqual(result.deaths.length, 1);
    assert.strictEqual(result.deaths[0].playerId, 2);
    assert.strictEqual(result.deaths[0].cause, 'killed by the Mafia');
  });

  test('Basic defense (Godfather) blocks a Basic attack', () => {
    const state = assignRoles(['civilian', 'godfather', 'mafioso', 'serialkiller', 'civilian', 'civilian']);
    act(state, 9, 'serialkiller', 4, 2);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(result.deaths.length, 0);
    assert.ok(logText(state).includes('P2 survived the attack'));
  });

  test('Unstoppable execution kills through Basic defense', () => {
    const state = assignRoles(['jailor', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 3, 'jailor', 1, 4, { jailorDecision: 'SPARE' });
    night(state); // night 1
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, false);
    assert.strictEqual(deathCauses(result)[2], 'executed by the Jailor');
  });

  test('veteran alert kills visitors (Unstoppable) and voids their actions', () => {
    const state = assignRoles(['veteran', 'godfather', 'mafioso', 'serialkiller', 'civilian', 'civilian']);
    act(state, 0, 'veteran', 1, null, { alert: true });
    act(state, 6, 'godfather', 2, 1);
    act(state, 9, 'serialkiller', 4, 1);
    const result = night(state);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(deathCauses(result)[2], 'visited an alerting Veteran');
    assert.strictEqual(deathCauses(result)[4], 'visited an alerting Veteran');
    // voided actions never resolve
    assert.ok(!logText(state).includes('killed by the Mafia'));
    assert.ok(!logText(state).includes('The Serial Killer attacked'));
  });

  test('veteran alert kills every visitor, including a roleblocking Escort', () => {
    const state = assignRoles(['veteran', 'escort', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 0, 'veteran', 1, null, { alert: true });
    act(state, 4, 'escort', 2, 1);
    act(state, 6, 'godfather', 3, 1);
    const result = night(state);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(deathCauses(result)[2], 'visited an alerting Veteran');
    assert.strictEqual(deathCauses(result)[3], 'visited an alerting Veteran');
  });

  test('veteran alert caps at 3 uses per game', () => {
    const state = assignRoles(['veteran', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    pid(state, 1).alertsUsed = 3;
    act(state, 0, 'veteran', 1, null, { alert: true });
    act(state, 6, 'godfather', 2, 5);
    const result = night(state);
    assert.strictEqual(pid(state, 1).alertsUsed, 3);
    assert.ok(!logText(state).includes('visited an alerting Veteran'));
    assert.strictEqual(deathCauses(result)[5], 'killed by the Mafia');
  });

  test('a death at position 3 voids the victim\'s later step (an executed Doctor cannot protect)', () => {
    const state = assignRoles(['jailor', 'doctor', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 5);
    night(state); // night 1
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    act(state, 5, 'doctor', 2, 6);
    act(state, 6, 'godfather', 3, 6);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[2], 'executed by the Jailor');
    assert.strictEqual(deathCauses(result)[6], 'killed by the Mafia');
    assert.ok(!logText(state).includes('protected'));
  });

  test('a roleblocked night action fails (roleblocked SK kills no one)', () => {
    const state = assignRoles(['escort', 'serialkiller', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 4, 'escort', 1, 2);
    act(state, 9, 'serialkiller', 2, 5);
    const result = night(state);
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.strictEqual(result.deaths.length, 0);
  });

  test('roleblocking does not save the target from a kill', () => {
    const state = assignRoles(['escort', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 4, 'escort', 1, 2);
    act(state, 6, 'godfather', 3, 2);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[2], 'killed by the Mafia');
  });

  test('noKillN1 voids night kills on night 1 only', () => {
    const state = assignRoles(['veteran', 'godfather', 'mafioso', 'serialkiller', 'civilian', 'civilian'],
      { houseRules: { noKillN1: true } });
    act(state, 0, 'veteran', 1, null, { alert: true });
    act(state, 6, 'godfather', 2, 1);
    act(state, 9, 'serialkiller', 4, 5);
    const r1 = night(state);
    assert.strictEqual(r1.deaths.length, 0);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.strictEqual(pid(state, 1).alertsUsed, 1);
    act(state, 6, 'godfather', 2, 5);
    const r2 = night(state);
    assert.strictEqual(r2.deaths.length, 1);
    assert.strictEqual(deathCauses(r2)[5], 'killed by the Mafia');
  });
});

// ---------------------------------------------------------------------------
// Night wizard steps
// ---------------------------------------------------------------------------

describe('night wizard steps', () => {
  test('steps are filtered to living roles and note the night-1 jailor rule', () => {
    const state = assignRoles(['jailor', 'veteran', 'godfather', 'mafioso', 'serialkiller', 'civilian']);
    const steps = engine.getNightSteps(state);
    assert.deepStrictEqual(steps.map((s) => s.position), [0, 3, 6, 9, 14]);
    assert.deepStrictEqual(steps.find((s) => s.position === 0).roles, ['veteran']);
    assert.ok(steps.find((s) => s.position === 3).prompt.includes('cannot execute'));
    night(state);
    const steps2 = engine.getNightSteps(state);
    assert.ok(!steps2.find((s) => s.position === 3).prompt.includes('cannot execute'));
  });

  test('split investigator steps: sheriff, tracker, and undertaker get separate steps', () => {
    const state = assignRoles(['sheriff', 'tracker', 'undertaker', 'godfather', 'mafioso', 'civilian']);
    const pos11 = engine.getNightSteps(state).filter((s) => s.position === 11);
    assert.deepStrictEqual(pos11.map((s) => s.roles), [['sheriff'], ['tracker'], ['undertaker']]);
  });

  test('Spy and Oracle each wake in their own position-11 step', () => {
    const state = assignRoles(['spy', 'oracle', 'sheriff', 'godfather', 'mafioso', 'civilian']);
    const pos11 = engine.getNightSteps(state).filter((s) => s.position === 11);
    assert.deepStrictEqual(pos11.map((s) => s.roles), [['sheriff'], ['spy'], ['oracle']]);
  });

  test('an inherited Deputy produces a Sheriff step with roles [deputy]', () => {
    const state = assignRoles(['sheriff', 'deputy', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 1);
    night(state);
    const sheriffStep = engine.getNightSteps(state).find((s) => s.position === 11 && s.title === 'Sheriff');
    assert.ok(sheriffStep);
    assert.deepStrictEqual(sheriffStep.roles, ['deputy']);
  });
});

// ---------------------------------------------------------------------------
// Spy
// ---------------------------------------------------------------------------

describe('nightly vs start-knowing step gating', () => {
  test('the Oracle wakes on night 1 and again on night 2', () => {
    const state = assignRoles(['oracle', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    const steps1 = engine.getNightSteps(state);
    assert.ok(steps1.some((s) => s.title === 'Oracle'));
    night(state);
    const steps2 = engine.getNightSteps(state);
    assert.ok(steps2.some((s) => s.title === 'Oracle'));
  });

  test('start-knowing roles never appear in any wizard step', () => {
    const state = assignRoles(['washerwoman', 'chef', 'godfather', 'mafioso', 'civilian', 'civilian']);
    const steps = engine.getNightSteps(state);
    assert.ok(!steps.some((s) => s.roles.indexOf('washerwoman') !== -1));
    assert.ok(!steps.some((s) => s.roles.indexOf('chef') !== -1));
  });
});

describe('mystery deaths vs Classic Reveal mode', () => {
  test('default: true roles are hidden as ?? UNKNOWN ??', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    night(state);
    const ann = engine.getMorningAnnouncement(state);
    assert.strictEqual(ann.deaths.length, 1);
    assert.strictEqual(ann.deaths[0].name, 'P3');
    assert.strictEqual(ann.deaths[0].roleShown, '?? UNKNOWN ??');
  });

  test('classicReveal shows the true role in the morning announcement', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian'],
      { houseRules: { classicReveal: true } });
    act(state, 6, 'godfather', 1, 3);
    night(state);
    const ann = engine.getMorningAnnouncement(state);
    assert.strictEqual(ann.deaths[0].roleShown, 'Civilian');
  });
});

// ---------------------------------------------------------------------------
// Retributionist
// ---------------------------------------------------------------------------

describe('deathLog', () => {
  test('a Mafia night kill appends exactly one entry with name and cause', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 6, 'godfather', 6, 2);
    night(state);
    assert.strictEqual(state.deathLog.length, 1);
    const entry = state.deathLog[0];
    assert.strictEqual(entry.night, 'N1');
    assert.strictEqual(entry.playerId, 2);
    assert.strictEqual(entry.name, 'P2');
    assert.strictEqual(entry.cause, 'killed by the Mafia');
    assert.strictEqual(entry.roleShown, 'Civilian');
  });

  test('a lynch appends a Day entry', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    [1, 2, 3, 4, 5].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    assert.strictEqual(engine.resolveSentence(state).result, 'LYNCHED');
    assert.strictEqual(state.deathLog.length, 1);
    const entry = state.deathLog[0];
    assert.strictEqual(entry.night, 'Day 1');
    assert.strictEqual(entry.playerId, 6);
    assert.strictEqual(entry.name, 'P6');
    assert.strictEqual(entry.cause, 'lynched by the town');
  });

  test('survives a serialize/deserialize round trip', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 6, 'godfather', 6, 2);
    night(state);
    const restored = engine.deserialize(engine.serialize(state));
    assert.deepStrictEqual(restored.deathLog, state.deathLog);
    const legacy = JSON.parse(engine.serialize(state));
    delete legacy.deathLog;
    const backfilled = engine.deserialize(JSON.stringify(legacy));
    assert.deepStrictEqual(backfilled.deathLog, []);
  });
});


describe('noKillN1 mafia log', () => {
  test('noKillN1 does not log a Mafia kill when the kill is voided', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian'],
      { houseRules: { noKillN1: true } });
    act(state, 6, 'godfather', 1, 3);
    const result = night(state);
    assert.strictEqual(result.deaths.length, 0);
    assert.ok(!result.logs.some((l) => l.includes('The Mafia killed')));
    assert.ok(result.logs.some((l) => l.includes('void')));
  });
});

