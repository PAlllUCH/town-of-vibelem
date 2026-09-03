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

  test('one Evil-aligned player versus one Town-aligned player ends with the Evil win', () => {
    const state = assignRoles(['succubus', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    pid(state, 3).isAlive = false;
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'EVIL');
    assert.strictEqual(state.phase, 'END');
  });

  test('Mafia majority counts only Mafia vs Town, so Mafia plus Demon beats equal Town', () => {
    const state = assignRoles(['godfather', 'mafioso', 'demon', 'sheriff', 'civilian', 'civilian']);
    pid(state, 6).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'MAFIA');
    assert.strictEqual(state.phase, 'END');
  });

  test('Town wins once all Mafia and the SK are dead even with a living Necromant or Succubus', () => {
    const state = assignRoles(['sheriff', 'civilian', 'necromant', 'succubus', 'godfather', 'serialkiller']);
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
  });

  test('Demon holds its own majority in a one versus one', () => {
    const state = assignRoles(['demon', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian']);
    pid(state, 3).isAlive = false;
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'DEMON');
    assert.strictEqual(state.phase, 'END');
  });

  test('Town cannot win while the Demon lives; killing the Demon triggers the win', () => {
    const state = assignRoles(['demon', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian']);
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    assert.strictEqual(engine.checkVictory(state), null);
    pid(state, 1).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
  });

  test('an endgame with zero Town-aligned players never yields TOWN', () => {
    const state = assignRoles(['succubus', 'survivor', 'civilian', 'civilian', 'civilian', 'civilian']);
    pid(state, 3).isAlive = false;
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    assert.strictEqual(engine.checkVictory(state), null);
    pid(state, 1).isAlive = false;
    assert.strictEqual(engine.checkVictory(state), null);
  });

  test('a lynched Jester registers the win before faction checks and the game continues', () => {
    const state = assignRoles(['jester', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.ok(engine.startTrial(state, 1, 2));
    [2, 3, 4, 5].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'AGREE' }), true);
    });
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    [2, 3, 4, 5, 6].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    [2, 3, 4, 5, 6].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'LYNCHED');
    assert.strictEqual(resolved.jesterWin, true);
    assert.strictEqual(resolved.victory, null);
    assert.strictEqual(state.winner, null);
    assert.strictEqual(state.jester.haunted, true);
    assert.strictEqual(pid(state, 1).isAlive, false);
    assert.notStrictEqual(state.phase, 'END');
  });

  test('an Executioner converts when the target dies at night; lynching the converted Executioner is a Jester win', () => {
    const state = dealExact(
      ['executioner', 'civilian', 'civilian', 'civilian', 'godfather', 'civilian', 'civilian'],
      { houseRules: { noLynchD1: false } }
    );
    const target = state.executionerTarget;
    assert.strictEqual(pid(state, target).assignedRole, 'civilian', 'the Executioner targets a Town player');
    act(state, 6, 'godfather', 5, target);
    night(state);
    engine.beginDay(state);
    assert.strictEqual(state.executionerConverted, true);
    const voters = aliveIds(state).filter((id) => id !== 1);
    assert.ok(engine.startTrial(state, 1, 5));
    voters.slice(0, 4).forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'AGREE' }), true);
    });
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    voters.forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    voters.forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'LYNCHED');
    assert.strictEqual(resolved.jesterWin, true);
    assert.strictEqual(resolved.victory, null);
    assert.strictEqual(state.winner, null);
    assert.strictEqual(state.jester.haunted, true);
  });
});


describe('stale-cycle draw rule', () => {
  function staleCycle(state) {
    engine.resolveNight(state);
    return engine.beginDay(state);
  }

  function runStaleCycles(state, count) {
    let last = null;
    for (let i = 0; i < count; i += 1) last = staleCycle(state);
    return last;
  }

  test('createGame defaults maxStaleDays to 5 and staleDays to 0', () => {
    const state = engine.createGame({ playerCount: 6 });
    assert.strictEqual(state.maxStaleDays, 5);
    assert.strictEqual(state.staleDays, 0);
    const tuned = engine.createGame({ playerCount: 6, maxStaleDays: 9 });
    assert.strictEqual(tuned.maxStaleDays, 9);
  });

  test('stale cycles count up one per cycle until maxStaleDays declares a DRAW', () => {
    const state = assignRoles(['survivor', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    [2, 3, 4, 5, 6].forEach((id) => { pid(state, id).isAlive = false; });
    assert.strictEqual(engine.beginDay(state), null);
    assert.strictEqual(state.staleDays, 0);
    assert.strictEqual(staleCycle(state), null);
    assert.strictEqual(state.staleDays, 1);
    assert.strictEqual(runStaleCycles(state, 3), null);
    assert.strictEqual(state.staleDays, 4);
    const victory = staleCycle(state);
    assert.strictEqual(victory.winner, 'DRAW');
    assert.ok(victory.reason.includes('no lynch and no night deaths'));
    assert.strictEqual(state.winner.winner, 'DRAW');
    assert.strictEqual(state.phase, 'END');
  });

  test('a single Survivor standoff ends as DRAW instead of returning null forever', () => {
    const state = assignRoles(['survivor', 'survivor', 'jester', 'jester', 'leper', 'outcast']);
    [2, 3].forEach((id) => { pid(state, id).isAlive = false; });
    assert.strictEqual(engine.checkVictory(state), null);
    const victory = runStaleCycles(state, 5);
    assert.strictEqual(victory.winner, 'DRAW');
    assert.strictEqual(state.phase, 'END');
    const over = engine.endGame(state);
    assert.strictEqual(over.winner.winner, 'DRAW');
    assert.ok(Array.isArray(over.reveal));
  });

  test('a lynch resets the stale counter to zero', () => {
    const state = assignRoles(
      ['survivor', 'survivor', 'survivor', 'survivor', 'survivor', 'survivor'],
      { houseRules: { noLynchD1: false } }
    );
    assert.strictEqual(engine.beginDay(state), null);
    assert.strictEqual(runStaleCycles(state, 2), null);
    assert.strictEqual(state.staleDays, 2);
    assert.ok(engine.startTrial(state, 6, 1));
    [1, 2, 3, 4, 5].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'AGREE' }), true);
    });
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    [1, 2, 3, 4, 5].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    [1, 2, 3, 4, 5].forEach((id) => {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    assert.strictEqual(engine.resolveSentence(state).result, 'LYNCHED');
    assert.strictEqual(state.staleDays, 0);
    assert.strictEqual(state.winner, null);
    assert.strictEqual(staleCycle(state), null);
    assert.strictEqual(state.staleDays, 0);
    assert.strictEqual(runStaleCycles(state, 4), null);
    assert.strictEqual(state.staleDays, 4);
    assert.strictEqual(staleCycle(state).winner, 'DRAW');
  });

  test('a night death resets the stale counter to zero', () => {
    const state = assignRoles(['survivor', 'survivor', 'survivor', 'survivor', 'survivor', 'serialkiller']);
    assert.strictEqual(engine.beginDay(state), null);
    assert.strictEqual(runStaleCycles(state, 2), null);
    assert.strictEqual(state.staleDays, 2);
    act(state, 9, 'serialkiller', 6, 2);
    assert.strictEqual(staleCycle(state), null);
    assert.strictEqual(pid(state, 2).isAlive, false);
    assert.strictEqual(state.staleDays, 0);
    assert.strictEqual(runStaleCycles(state, 4), null);
    assert.strictEqual(state.staleDays, 4);
    assert.strictEqual(staleCycle(state).winner, 'DRAW');
  });

  test('faction victory priorities still beat the draw declaration', () => {
    const state = assignRoles(['godfather', 'mafioso', 'survivor', 'survivor', 'survivor', 'survivor']);
    state.maxStaleDays = 5;
    state.staleDays = 5;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'MAFIA');
    assert.strictEqual(state.phase, 'END');
  });

  function recordTestDeath(state, playerId, cause) {
    const p = pid(state, playerId);
    p.isAlive = false;
    state.graveyard.push({ playerId: playerId, name: p.name, trueRole: p.assignedRole, deathCause: cause });
  }

  test('deserialize defaults stale fields for old saves and preserves fresh ones', () => {
    const live = engine.createGame({ playerCount: 6 });
    live.players.forEach((p) => { p.name = 'P' + p.id; });
    const legacy = JSON.parse(engine.serialize(live));
    delete legacy.staleDays;
    delete legacy.maxStaleDays;
    delete legacy.staleLynchSeen;
    delete legacy.staleCycleLynches;
    delete legacy.staleNightSeen;
    const loaded = engine.deserialize(JSON.stringify(legacy));
    assert.strictEqual(loaded.maxStaleDays, 5);
    assert.strictEqual(loaded.staleDays, 0);

    const midgame = engine.createGame({ playerCount: 6 });
    midgame.players.forEach((p) => { p.name = 'P' + p.id; });
    midgame.night.number = 4;
    recordTestDeath(midgame, 6, 'lynched by the town');
    recordTestDeath(midgame, 5, 'killed by the Mafia');
    midgame.staleDays = 3;
    midgame.maxStaleDays = 7;
    const legacyMidgame = JSON.parse(engine.serialize(midgame));
    delete legacyMidgame.staleLynchSeen;
    delete legacyMidgame.staleCycleLynches;
    delete legacyMidgame.staleNightSeen;
    const reloaded = engine.deserialize(JSON.stringify(legacyMidgame));
    assert.strictEqual(reloaded.staleDays, 3);
    assert.strictEqual(reloaded.maxStaleDays, 7);
    assert.strictEqual(reloaded.staleLynchSeen, 1);
    assert.strictEqual(reloaded.staleCycleLynches, 1);
    assert.strictEqual(reloaded.staleNightSeen, 3);
  });
});
