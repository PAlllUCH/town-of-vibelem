'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../js/engine.js');
const {
  pid, roleIdByName, assignRoles, act, night, sorted, preview,
  logText, aliveIds, deathCauses, graveyardEntry, dealExact
} = require('./helpers.js');

function second(state, ids) {
  ids.forEach((id) => {
    assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'AGREE' }), true, 'second by P' + id);
  });
}

function sentence(state, ids, verdict) {
  ids.forEach((id) => {
    assert.strictEqual(engine.castVote(state, { voterId: id, verdict: verdict || 'GUILTY' }), true, 'sentence vote by P' + id);
  });
}

// ---------------------------------------------------------------------------
// Executioner
// ---------------------------------------------------------------------------

describe('Executioner', () => {
  test('converts to Jester when the target dies by a night kill', () => {
    const state = assignRoles(['executioner', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    state.executionerTarget = 4;
    act(state, 6, 'godfather', 2, 4);
    night(state);
    assert.strictEqual(state.executionerConverted, true);
    assert.ok(logText(state).includes('the Executioner becomes a Jester'));
  });

  test('converts to Jester when the target dies by a day kill', () => {
    const state = assignRoles(['executioner', 'vigilante', 'civilian', 'civilian', 'civilian', 'godfather']);
    state.executionerTarget = 4;
    engine.vigilanteShoot(state, 2, 4);
    assert.strictEqual(state.executionerConverted, true);
    assert.ok(logText(state).includes('the Executioner becomes a Jester'));
  });

  test('wins when the target is lynched by the town', () => {
    const state = assignRoles(['executioner', 'sheriff', 'civilian', 'civilian', 'civilian', 'godfather']);
    state.executionerTarget = 4;
    assert.ok(engine.startTrial(state, 4, 2));
    second(state, [1, 2, 3, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [1, 2, 3, 5]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.lynchedId, 4);
    assert.strictEqual(resolved.executionerWin, true);
    assert.strictEqual(resolved.victory.winner, 'EXECUTIONER');
    assert.strictEqual(state.phase, 'END');
  });

  test('a converted Executioner wins as a Jester when lynched', () => {
    const state = assignRoles(['executioner', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    state.executionerTarget = 4;
    act(state, 6, 'godfather', 2, 4);
    night(state); // target dies at night -> conversion
    assert.ok(engine.startTrial(state, 1, 5));
    second(state, [2, 3, 5, 6]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 6, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 5, 6, 7, 8]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.jesterWin, true);
    assert.strictEqual(resolved.executionerWin, false);
    assert.strictEqual(resolved.victory, null); // the game continues
    assert.strictEqual(state.jester.haunted, true);
    assert.strictEqual(state.jester.hauntTarget, null);
  });
});

// ---------------------------------------------------------------------------
// Jester
// ---------------------------------------------------------------------------

describe('Jester', () => {
  function lynchJester(state) {
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 4, 5]);
    return engine.resolveSentence(state);
  }

  test('wins immediately when lynched and schedules the haunt', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    const resolved = lynchJester(state);
    assert.strictEqual(resolved.jesterWin, true);
    assert.strictEqual(resolved.victory, null); // the game continues for everyone else
    assert.strictEqual(pid(state, 1).hasGhostVote, false); // no ghost vote token
    assert.strictEqual(state.jester.haunted, true);
    assert.strictEqual(state.jester.hauntTarget, null);
  });

  test('the Jester ghost haunts one Guilty voter at the start of the next night', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    lynchJester(state);
    assert.ok(engine.getNightSteps(state).find((s) => s.position === 0).roles.includes('jester'));
    act(state, 0, 'jester', 1, 2); // P2 voted GUILTY
    act(state, 6, 'godfather', 5, 3);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[2], 'haunted by the Jester');
    assert.strictEqual(state.jester.hauntTarget, 2);
    assert.strictEqual(state.jester.haunted, false);
  });

  test('a non-Guilty voter is not haunted', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    lynchJester(state);
    act(state, 0, 'jester', 1, 4); // P4 voted INNOCENT
    const result = night(state);
    assert.strictEqual(result.deaths.length, 0);
    assert.strictEqual(pid(state, 4).isAlive, true);
  });
});

// ---------------------------------------------------------------------------
// BotC trial (SECONDS -> VOTE -> SENTENCE)
// ---------------------------------------------------------------------------

describe('BotC trial', () => {
  test('a nomination at strict majority (6 living -> 4 incl. nominator) proceeds to VOTE', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    const accepted = engine.resolveTrial(state);
    assert.strictEqual(accepted.result, 'ACCEPTED');
    assert.strictEqual(accepted.stage, 'VOTE');
    assert.strictEqual(accepted.agree, 4);
    assert.strictEqual(accepted.needed, 4);
    assert.strictEqual(state.trial.stage, 'VOTE');
    assert.strictEqual(state.trial.active, true);
  });

  test('a nomination below the threshold is CANCELLED with no death and the day continues', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.ok(engine.startTrial(state, 6, 1));
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'DISAGREE' }), true);
    const resolved = engine.resolveTrial(state); // agree = P2 = 1 < 4
    assert.strictEqual(resolved.result, 'CANCELLED');
    assert.strictEqual(resolved.agree, 1);
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.deathLog.length, 0);
    assert.strictEqual(state.winner, null);
    assert.ok(engine.startTrial(state, 5, 2), 'a new nomination is allowed the same day');
  });

  test('the nominator has no free second: with only the accused able to second, the nomination falls', () => {
    const state = assignRoles(['civilian', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    pid(state, 3).isAlive = false;
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    pid(state, 6).isAlive = false;
    assert.ok(engine.startTrial(state, 1, 2)); // only P2 and P1 are living
    const resolved = engine.resolveTrial(state); // no one seconded -> agree 0 < 2
    assert.strictEqual(resolved.result, 'CANCELLED');
    assert.strictEqual(resolved.agree, 0);
    assert.strictEqual(resolved.needed, 2);
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.deathLog.length, 0);
  });

  test('ghosts may not second a nomination', () => {
    const state = assignRoles(['godfather', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 2);
    night(state);
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 3));
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'AGREE' }), false);
  });

  test('a tie verdict acquits the accused (no lynch, no victory check)', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 6, verdict: 'ABSTAIN' }), true);
    const resolved = engine.resolveTrial(state); // guilty 2 vs innocent 2
    assert.strictEqual(resolved.result, 'SURVIVES');
    assert.strictEqual(resolved.reason, 'tie');
    assert.strictEqual(resolved.lynchedId, null);
    assert.strictEqual(resolved.victory, null);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(state.winner, null);
  });

  test('a SURVIVES tie does not block a second nomination that proceeds to VOTE', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 6, verdict: 'ABSTAIN' }), true);
    const survived = engine.resolveTrial(state); // guilty 2 vs innocent 2
    assert.strictEqual(survived.result, 'SURVIVES');
    assert.ok(engine.startTrial(state, 6, 1), 'a new nomination is allowed after SURVIVES');
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(state.trial.stage, 'VOTE');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [1, 2, 3, 4, 5]);
    const lynched = engine.resolveSentence(state);
    assert.strictEqual(lynched.result, 'LYNCHED');
    assert.strictEqual(lynched.lynchedId, 6);
  });

  test('more innocent than guilty verdicts SURVIVES with reason not-guilty', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    const resolved = engine.resolveTrial(state); // guilty 1 vs innocent 3
    assert.strictEqual(resolved.result, 'SURVIVES');
    assert.strictEqual(resolved.reason, 'not-guilty');
    assert.strictEqual(resolved.lynchedId, null);
    assert.strictEqual(resolved.victory, null);
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(pid(state, 6).isAlive, true);
    assert.strictEqual(state.winner, null);
  });

  test('a guilty strict majority lynches after the sentence and runs the victory check', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    const sentenced = engine.resolveTrial(state);
    assert.strictEqual(sentenced.result, 'SENTENCED');
    assert.strictEqual(sentenced.reason, 'guilty-majority');
    assert.strictEqual(state.trial.active, true);
    assert.strictEqual(state.trial.stage, 'SENTENCE');
    sentence(state, [1, 2, 3, 4, 5]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'LYNCHED');
    assert.strictEqual(resolved.lynchedId, 6);
    assert.strictEqual(resolved.reason, 'guilty-stands');
    assert.strictEqual(resolved.victory.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
  });

  test('abstain votes are recorded but ignored: 3 guilty vs 2 innocent with 5 abstains sentences', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian',
      'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.ok(engine.startTrial(state, 11, 1));
    second(state, [1, 2, 3, 4, 5, 6]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    [1, 2, 3].forEach(function (id) {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true);
    });
    [4, 5].forEach(function (id) {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'INNOCENT' }), true);
    });
    [6, 7, 8, 9, 10].forEach(function (id) {
      assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'ABSTAIN' }), true);
    });
    assert.strictEqual(state.trial.votes.length, 10);
    const sent = engine.resolveTrial(state); // guilty 3 > innocent 2, abstains ignored
    assert.strictEqual(sent.result, 'SENTENCED');
    assert.strictEqual(sent.guilty, 3);
    assert.strictEqual(sent.innocent, 2);
    assert.strictEqual(sent.lynchedId, null);
    assert.strictEqual(state.trial.stage, 'SENTENCE');
    assert.strictEqual(state.trial.active, true);
  });

  test('the accused may not vote in the verdict round', () => {
    const state = assignRoles(['godfather', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), false);
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'ABSTAIN' }), false);
    assert.strictEqual(state.trial.votes.length, 0);
  });

  test('ghosts cannot vote in the sentence round', () => {
    const state = assignRoles(['godfather', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian'],
      { houseRules: { noLynchD1: false } });
    act(state, 6, 'godfather', 1, 2); // P2 dies on night 1
    night(state);
    assert.strictEqual(pid(state, 2).hasGhostVote, true);
    engine.beginDay(state); // 5 living: need 3 seconds
    assert.ok(engine.startTrial(state, 1, 3));
    second(state, [3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'INNOCENT', ghostToken: true }), false);
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'INNOCENT' }), true);
  });

  test('ghost token verdicts count in the vote tally and spend the token', () => {
    const state = assignRoles(['godfather', 'sheriff', 'civilian', 'civilian', 'civilian', 'civilian'],
      { houseRules: { noLynchD1: false } });
    act(state, 6, 'godfather', 1, 2); // P2 dies on night 1
    night(state);
    assert.strictEqual(pid(state, 2).hasGhostVote, true);
    engine.beginDay(state); // 5 living: need 3 seconds incl. nominator
    assert.ok(engine.startTrial(state, 1, 3));
    second(state, [3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY', ghostToken: true }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 6, verdict: 'ABSTAIN' }), true);
    const sentenced = engine.resolveTrial(state); // guilty 3 (incl. ghost) vs innocent 1
    assert.strictEqual(sentenced.result, 'SENTENCED');
    sentence(state, [3, 4, 5, 6]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'LYNCHED');
    assert.strictEqual(resolved.lynchedId, 1);
    assert.strictEqual(pid(state, 2).ghostVoteSpent, true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY', ghostToken: true }), false); // spent
  });

  test('a lynched Jester still wins and schedules the haunt', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 4, 5]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'LYNCHED');
    assert.strictEqual(resolved.jesterWin, true);
    assert.strictEqual(resolved.victory, null);
    assert.strictEqual(state.jester.haunted, true);
    assert.strictEqual(state.jester.hauntTarget, null);
    assert.strictEqual(pid(state, 1).hasGhostVote, false);
  });

  test('the Executioner wins when the target is lynched', () => {
    const state = assignRoles(['executioner', 'sheriff', 'civilian', 'civilian', 'civilian', 'godfather']);
    state.executionerTarget = 4;
    assert.ok(engine.startTrial(state, 4, 2));
    second(state, [1, 2, 3, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [1, 2, 3, 5]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.executionerWin, true);
    assert.strictEqual(resolved.victory.winner, 'EXECUTIONER');
    assert.strictEqual(state.phase, 'END');
  });

  test('a converted Executioner counts as a Jester when lynched', () => {
    const state = assignRoles(['executioner', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    state.executionerTarget = 4;
    act(state, 6, 'godfather', 2, 4);
    night(state); // target dies at night -> conversion
    assert.ok(engine.startTrial(state, 1, 5));
    second(state, [2, 3, 5, 6]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 6, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 5, 6, 7, 8]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.jesterWin, true);
    assert.strictEqual(resolved.executionerWin, false);
    assert.strictEqual(resolved.victory, null);
    assert.strictEqual(state.jester.haunted, true);
  });

  test('noLynchD1 blocks a Day-1 sentence when enabled', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: true } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    const resolved = engine.resolveTrial(state);
    assert.strictEqual(resolved.result, 'SURVIVES');
    assert.strictEqual(resolved.reason, 'no-lynch-day-1');
    assert.notStrictEqual(state.trial.stage, 'SENTENCE');
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(pid(state, 6).isAlive, true);
    assert.strictEqual(state.winner, null);
  });

  test('a Day-1 lynch is allowed when noLynchD1 is disabled', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [1, 2, 3, 4, 5]);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'LYNCHED');
    assert.strictEqual(pid(state, 6).isAlive, false);
  });

  test('createGame defaults noLynchD1 to ON unless explicitly disabled', () => {
    const on = engine.createGame({ playerCount: 6, presetId: 'p1' });
    assert.strictEqual(on.houseRules.noLynchD1, true);
    const off = engine.createGame({ playerCount: 6, presetId: 'p1', houseRules: { noLynchD1: false } });
    assert.strictEqual(off.houseRules.noLynchD1, false);
  });

  test('with the default ON, a Day-1 trial still runs SECONDS/VOTE and returns a no-lynch result', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    const resolved = engine.resolveTrial(state);
    assert.strictEqual(resolved.result, 'SURVIVES');
    assert.strictEqual(resolved.reason, 'no-lynch-day-1');
    assert.strictEqual(pid(state, 6).isAlive, true);
    assert.strictEqual(state.winner, null);
  });
});

// ---------------------------------------------------------------------------
// Sentence round
// ---------------------------------------------------------------------------

describe('sentence round', () => {
  test('a spare majority spares the accused and closes the trial', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    // 6 living, accused excluded -> 5 sentence voters; spare needs innocent >= floor(6/2)+1 = 4
    sentence(state, [2, 3, 4, 5], 'INNOCENT');
    const spared = engine.resolveSentence(state);
    assert.strictEqual(spared.result, 'SPARED');
    assert.strictEqual(spared.reason, 'spared');
    assert.strictEqual(spared.lynchedId, null);
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.trial.stage, null);
    assert.strictEqual(state.trial.votes.length, 0);
    assert.strictEqual(state.trial.seconds.length, 0);
    assert.strictEqual(state.trial.sentenceVotes.length, 0);
    assert.strictEqual(pid(state, 6).isAlive, true);
    assert.ok(engine.startTrial(state, 3, 2), 'a new trial can start after a spare');
  });

  test('without a spare majority the accused is lynched with the full handling', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 4, 5]); // all GUILTY -> no spare majority
    const lynched = engine.resolveSentence(state);
    assert.strictEqual(lynched.result, 'LYNCHED');
    assert.strictEqual(lynched.reason, 'guilty-stands');
    assert.strictEqual(lynched.lynchedId, 1);
    assert.strictEqual(lynched.jesterWin, true);
    assert.strictEqual(lynched.victory, null);
    assert.strictEqual(state.jester.haunted, true);
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.trial.dayTrialsDone, 1);
    assert.strictEqual(pid(state, 1).hasGhostVote, false);
  });

  test('resolveSentence does nothing outside the SENTENCE stage', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.strictEqual(engine.resolveSentence(state), null);
    engine.beginDay(state);
    assert.strictEqual(engine.resolveSentence(state), null);
  });

  test('a revealed Mayor weighs 3 in the verdict round and in the sentence round', () => {
    const state = assignRoles(['mayor', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.strictEqual(engine.mayorReveal(state, 1).revealed, true);
    assert.ok(engine.startTrial(state, 5, 2));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    // 2 guilty votes (Mayor 3 + P2 1) vs 2 innocent: only the Mayor weight sentences
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    const verdict = engine.resolveTrial(state);
    assert.strictEqual(verdict.result, 'SENTENCED');
    assert.strictEqual(verdict.guilty, 4);
    assert.strictEqual(verdict.innocent, 2);
    // spare needs innocent >= floor(6/2)+1 = 4; Mayor(3) + 1 spares only with the weight
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'INNOCENT' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'INNOCENT' }), true);
    const spared = engine.resolveSentence(state);
    assert.strictEqual(spared.result, 'SPARED');
    assert.strictEqual(spared.reason, 'spared');
    assert.strictEqual(spared.innocent, 4);
    assert.strictEqual(pid(state, 5).isAlive, true);
  });

  test('resolveSentence with a dead accused returns SURVIVES with reason accused-dead', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    assert.strictEqual(state.trial.stage, 'SENTENCE');
    engine.killPlayer(state, 6);
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.result, 'SURVIVES');
    assert.strictEqual(resolved.reason, 'accused-dead');
    assert.strictEqual(resolved.lynchedId, null);
    assert.strictEqual(state.trial.active, false);
  });
});

// ---------------------------------------------------------------------------
// Moderator overrides
// ---------------------------------------------------------------------------

describe('moderator overrides', () => {
  test('killPlayer kills a living player and runs the victory check', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    engine.beginDay(state);
    const v = engine.killPlayer(state, 6);
    assert.strictEqual(pid(state, 6).isAlive, false);
    assert.strictEqual(state.graveyard.length, 1);
    assert.strictEqual(state.graveyard[0].deathCause, 'killed by the moderator');
    assert.ok(v);
    assert.strictEqual(v.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
    assert.strictEqual(engine.killPlayer(state, 6), null, 'dead players cannot be killed again');
    assert.strictEqual(engine.killPlayer(state, 1), null, 'no kills after the game ended');
  });

  test('killPlayer accepts a custom cause', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    engine.beginDay(state);
    engine.killPlayer(state, 3, 'removed by the group');
    assert.strictEqual(state.graveyard[0].deathCause, 'removed by the group');
  });

  test('undoKill revives the player and clears victory side effects', () => {
    const state = assignRoles(['executioner', 'sheriff', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    state.executionerTarget = 4;
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 4, 2));
    second(state, [1, 2, 3, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [1, 2, 3, 5]);
    const lynched = engine.resolveSentence(state);
    assert.strictEqual(lynched.executionerWin, true);
    assert.strictEqual(state.phase, 'END');
    assert.ok(state.winner);
    assert.strictEqual(state.deathLog.length, 1);
    assert.ok(state.playerLog['4'].some((e) => e.kind === 'death'));
    const revived = engine.undoKill(state, 4);
    assert.deepStrictEqual(revived, { revivedId: 4 });
    assert.strictEqual(pid(state, 4).isAlive, true);
    assert.strictEqual(state.graveyard.length, 0);
    assert.strictEqual(state.deathLog.length, 0);
    assert.ok(!state.playerLog['4'].some((e) => e.kind === 'death'));
    assert.strictEqual(state.winner, null);
    assert.strictEqual(state.phase, 'DAY');
    assert.strictEqual(pid(state, 4).hasGhostVote, false);
    assert.strictEqual(pid(state, 4).nightTarget, null);
    assert.strictEqual(pid(state, 4).diedBefore, true, 'diedBefore is kept');
    assert.strictEqual(engine.undoKill(state, 4), null, 'living players cannot be revived');
  });

  test('undoKill on the accused of an active trial closes the trial and refunds the day lynch', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    assert.strictEqual(state.trial.active, true);
    const v = engine.killPlayer(state, 6); // the accused dies mid-trial -> Town wins
    assert.strictEqual(v.winner, 'TOWN');
    assert.strictEqual(state.phase, 'END');
    const revived = engine.undoKill(state, 6);
    assert.ok(revived);
    assert.strictEqual(pid(state, 6).isAlive, true);
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.trial.stage, null);
    assert.strictEqual(state.trial.dayTrialsDone, 0);
    assert.strictEqual(state.winner, null);
    assert.strictEqual(state.phase, 'DAY');
    assert.ok(engine.startTrial(state, 3, 1), 'a new trial can start after the undo');
  });

  test('undoKill on a lynched Jester clears the scheduled haunt', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 4, 5]);
    const lynched = engine.resolveSentence(state);
    assert.strictEqual(lynched.jesterWin, true);
    assert.strictEqual(state.jester.haunted, true);
    const revived = engine.undoKill(state, 1);
    assert.ok(revived);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(state.jester.haunted, false);
    assert.strictEqual(state.jester.hauntTarget, null);
  });

  test('undoKill on an unrelated player leaves a pending Jester haunt untouched', () => {
    const state = assignRoles(['jester', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 1, 2));
    second(state, [2, 3, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [2, 3, 4, 5]);
    const lynched = engine.resolveSentence(state);
    assert.strictEqual(lynched.jesterWin, true);
    assert.strictEqual(state.jester.haunted, true);
    engine.killPlayer(state, 5); // an unrelated moderator kill
    assert.ok(engine.undoKill(state, 5), 'the unrelated kill is undone');
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.strictEqual(state.jester.haunted, true, 'an unrelated revive must not cancel the haunt');
    assert.strictEqual(state.jester.hauntTarget, null);
  });

  test('undoKill refunds the day lynch after a completed lynch', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    sentence(state, [1, 2, 3, 4]);
    const lynched = engine.resolveSentence(state);
    assert.strictEqual(lynched.result, 'LYNCHED');
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.trial.dayTrialsDone, 1);
    assert.ok(engine.undoKill(state, 6));
    assert.strictEqual(state.trial.dayTrialsDone, 0, 'undoing a completed lynch refunds the day lynch');
    assert.ok(engine.startTrial(state, 3, 1), 'a new trial is possible after the undo');
  });
});

// ---------------------------------------------------------------------------
// Trial lifecycle across days
// ---------------------------------------------------------------------------

describe('trial lifecycle', () => {
  test('an active trial resets when a new day begins and a new trial is allowed', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    second(state, [1, 2, 3, 4]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    assert.strictEqual(state.trial.active, true);
    engine.beginDay(state); // day 2, the trial is left unresolved
    assert.strictEqual(state.trial.active, false);
    assert.strictEqual(state.trial.stage, null);
    assert.deepStrictEqual(state.trial.seconds, []);
    assert.deepStrictEqual(state.trial.votes, []);
    assert.deepStrictEqual(state.trial.sentenceVotes, []);
    assert.strictEqual(state.trial.dayTrialsDone, 0);
    assert.ok(engine.startTrial(state, 3, 1), 'a new trial can start on the new day');
    second(state, [1, 2, 4, 5]);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
  });

  test('deserialize backfills sentenceVotes and the SENTENCE stage for old saves', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'],
      { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    const legacy = JSON.parse(engine.serialize(state));
    delete legacy.trial.sentenceVotes;
    delete legacy.trial.stage;
    const restored = engine.deserialize(JSON.stringify(legacy));
    assert.deepStrictEqual(restored.trial.sentenceVotes, []);
    assert.strictEqual(restored.trial.stage, null);
  });
});
