'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../js/engine.js');
const {
  pid, roleIdByName, assignRoles, act, night, sorted, preview,
  logText, aliveIds, deathCauses, graveyardEntry, dealExact
} = require('./helpers.js');
// ---------------------------------------------------------------------------
// Victory conditions
// ---------------------------------------------------------------------------

describe('victory conditions', () => {
  test('Town wins when every Mafia player and the SK are dead (via lynch)', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
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
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.victory.winner, 'TOWN');
    assert.strictEqual(state.winner.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
  });

  test('Town wins after the morning announcements (last Mafia killed at night)', () => {
    const state = assignRoles(['jailor', 'sheriff', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 6, 'godfather', 6, 3);
    night(state); // night 1
    act(state, 3, 'jailor', 1, 6, { jailorDecision: 'EXECUTE' });
    night(state); // night 2: last Mafia executed
    const victory = engine.beginDay(state);
    assert.strictEqual(victory.winner, 'TOWN');
  });

  test('a Vigilante shot that kills the last Mafia wins for Town immediately', () => {
    const state = assignRoles(['vigilante', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    const shot = engine.vigilanteShoot(state, 1, 6);
    assert.strictEqual(shot.guilty, false);
    assert.strictEqual(shot.victory.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
  });

  test('a Deputy shot that kills the last Mafia wins for Town immediately', () => {
    const state = assignRoles(['deputy', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    const shot = engine.deputyShoot(state, 1, 6);
    assert.strictEqual(shot.guilty, false);
    assert.strictEqual(shot.victory.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
  });

  test('Mafia wins on majority after a night kill, and a living Survivor shares the win', () => {
    const state = assignRoles(['godfather', 'mafioso', 'consort', 'sheriff', 'civilian', 'survivor']);
    act(state, 6, 'godfather', 1, 4);
    night(state);
    const victory = engine.beginDay(state);
    assert.strictEqual(victory.winner, 'MAFIA');
    assert.deepStrictEqual(victory.survivors, [6]);
    assert.strictEqual(state.phase, 'END');
  });

  test('a 1v1 Mafia/Town tie favors the Mafia', () => {
    const state = assignRoles(['godfather', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian']);
    pid(state, 3).isAlive = false;
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'MAFIA');
  });

  test('Serial Killer wins over a Mafia majority tie (GDD priority order)', () => {
    const state = assignRoles(['serialkiller', 'godfather', 'civilian', 'civilian', 'civilian', 'civilian']);
    pid(state, 3).isAlive = false;
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'SERIAL_KILLER');
  });

  test('Town cannot win while the SK lives; killing the SK triggers the win', () => {
    const state = assignRoles(['sheriff', 'civilian', 'serialkiller', 'civilian', 'civilian', 'civilian']);
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    assert.strictEqual(engine.checkVictory(state), null);
    pid(state, 3).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'TOWN');
  });
});
