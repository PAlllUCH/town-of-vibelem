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
describe('Spy', () => {
  test('learns the team of every player who visited the watched player', () => {
    const state = assignRoles(['spy', 'civilian', 'blackmailer', 'doctor', 'godfather', 'mafioso']);
    act(state, 5, 'doctor', 4, 2);
    act(state, 8, 'blackmailer', 3, 2);
    act(state, 11, 'spy', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Spy) watches P2: TOWN, MAFIA.'));
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.at === 'N1' && e.text === 'Spy watch on P2: TOWN, MAFIA.'));
  });

  test('learns "no one" when nobody visited the watched player', () => {
    const state = assignRoles(['spy', 'civilian', 'civilian', 'civilian', 'godfather', 'mafioso']);
    act(state, 11, 'spy', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Spy) watches P2: no one.'));
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.text === 'Spy watch on P2: no one.'));
  });

  test('a Drunk Spy learns one random team per visitor', () => {
    const state = assignRoles(['spy', 'civilian', 'poisoner', 'blackmailer', 'godfather', 'mafioso']);
    act(state, 1, 'poisoner', 3, 1);
    act(state, 8, 'blackmailer', 4, 2);
    act(state, 11, 'spy', 1, 2);
    night(state);
    const info = state.playerLog['1'].find((e) => e.kind === 'info');
    assert.ok(info && info.text.indexOf('Spy watch on P2: ') === 0);
    const teams = info.text.replace('Spy watch on P2: ', '').replace('.', '');
    assert.ok(['TOWN', 'MAFIA', 'NEUTRAL'].indexOf(teams) !== -1);
  });

  test('a living Spy counts as Neutral: does not block a Town win and shares it', () => {
    const state = assignRoles(['sheriff', 'civilian', 'spy', 'godfather', 'mafioso', 'civilian']);
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    const victory = engine.checkVictory(state);
    assert.strictEqual(victory.winner, 'TOWN');
    assert.ok(victory.survivors.indexOf(3) !== -1);
  });
});

// ---------------------------------------------------------------------------
// Oracle (nightly)
// ---------------------------------------------------------------------------

describe('Oracle', () => {
  test('night 1 reads TOWN for a Town target', () => {
    const state = assignRoles(['oracle', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    act(state, 11, 'oracle', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P2: TOWN.'));
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.at === 'N1' && e.text === 'Oracle read on P2: TOWN.'));
  });

  test('reads NOT TOWN for a Mafia target', () => {
    const state = assignRoles(['oracle', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    act(state, 11, 'oracle', 1, 4);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P4: NOT TOWN.'));
  });

  test('reads NOT TOWN for a Neutral target', () => {
    const state = assignRoles(['oracle', 'civilian', 'serialkiller', 'godfather', 'mafioso', 'civilian']);
    act(state, 11, 'oracle', 1, 3);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P3: NOT TOWN.'));
  });

  test('a Drunk Oracle inverts a Town read to NOT TOWN', () => {
    const state = assignRoles(['oracle', 'civilian', 'poisoner', 'civilian', 'godfather', 'mafioso']);
    act(state, 1, 'poisoner', 3, 1);
    act(state, 11, 'oracle', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P2: NOT TOWN.'));
  });

  test('a Drunk Oracle inverts a NOT TOWN read to TOWN', () => {
    const state = assignRoles(['oracle', 'civilian', 'poisoner', 'godfather', 'mafioso', 'civilian']);
    act(state, 1, 'poisoner', 3, 1);
    act(state, 11, 'oracle', 1, 4);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P4: TOWN.'));
  });

  test('a roleblocked Oracle gets no result and an info log entry', () => {
    const state = assignRoles(['oracle', 'escort', 'civilian', 'civilian', 'godfather', 'mafioso']);
    act(state, 4, 'escort', 2, 1);
    act(state, 11, 'oracle', 1, 3);
    night(state);
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.text === 'Oracle read on P3: no result (roleblocked).'));
  });

  test('a Witch-controlled Oracle reads the redirect target', () => {
    const state = assignRoles(['oracle', 'civilian', 'witch', 'godfather', 'mafioso', 'civilian']);
    act(state, 2, 'witch', 3, 1, { controlRedirect: 4 });
    act(state, 11, 'oracle', 1, 5);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P4: NOT TOWN.'));
  });

  test('reads on night 2 and logs the result as an info entry on the Oracle playerLog', () => {
    const state = assignRoles(['oracle', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    night(state);
    assert.ok(engine.getNightSteps(state).some((s) => s.title === 'Oracle'));
    act(state, 11, 'oracle', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Oracle) reads P2: TOWN.'));
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.text === 'Oracle read on P2: TOWN.'));
  });
});

// ---------------------------------------------------------------------------
// Witness (pairwise info)
// ---------------------------------------------------------------------------

describe('Witness', () => {
  test('both targets Town reads Both Town and logs an info entry', () => {
    const state = assignRoles(['witness', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    act(state, 11, 'witness', 1, 2, { secondTarget: 3 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P2 and P3: Both Town.'));
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.at === 'N1' && e.text === 'Witness check on P2 and P3: Both Town.'));
  });

  test('both targets Mafia reads Both Mafia', () => {
    const state = assignRoles(['witness', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 11, 'witness', 1, 3, { secondTarget: 4 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P3 and P4: Both Mafia.'));
  });

  test('one Town one Mafia reads Different alignments', () => {
    const state = assignRoles(['witness', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 11, 'witness', 1, 2, { secondTarget: 3 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P2 and P3: Different alignments.'));
  });

  test('one Neutral one Mafia reads Different alignments', () => {
    const state = assignRoles(['witness', 'civilian', 'jester', 'godfather', 'mafioso', 'civilian']);
    act(state, 11, 'witness', 1, 3, { secondTarget: 4 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P3 and P4: Different alignments.'));
  });

  test('both Neutral reads Both Neutral', () => {
    const state = assignRoles(['witness', 'civilian', 'jester', 'survivor', 'godfather', 'mafioso']);
    act(state, 11, 'witness', 1, 3, { secondTarget: 4 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P3 and P4: Both Neutral.'));
  });

  test('the Serial Killer counts as Mafia for the comparison (Nemesis rule)', () => {
    const state = assignRoles(['witness', 'civilian', 'serialkiller', 'civilian', 'godfather', 'mafioso']);
    act(state, 11, 'witness', 1, 3, { secondTarget: 5 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P3 and P5: Both Mafia.'));
  });

  test('a dead target is compared by its last assigned alignment', () => {
    const state = assignRoles(['witness', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 4);
    act(state, 11, 'witness', 1, 3, { secondTarget: 4 });
    night(state);
    assert.strictEqual(pid(state, 4).isAlive, false);
    assert.ok(logText(state).includes('(Witness) compares P3 and P4: Both Mafia.'));
  });

  test('a Drunk Witness inverts an equal pair to Different alignments', () => {
    const state = assignRoles(['witness', 'civilian', 'poisoner', 'civilian', 'godfather', 'mafioso']);
    act(state, 1, 'poisoner', 3, 1);
    act(state, 11, 'witness', 1, 2, { secondTarget: 4 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P2 and P4: Different alignments.'));
  });

  test('a Drunk Witness turns a Different pair into one of the equal options at random', () => {
    const state = assignRoles(['witness', 'civilian', 'poisoner', 'godfather', 'mafioso', 'civilian']);
    act(state, 1, 'poisoner', 3, 1);
    act(state, 11, 'witness', 1, 2, { secondTarget: 3 });
    night(state);
    const info = state.playerLog['1'].find((e) => e.kind === 'info');
    assert.ok(info && /Witness check on P2 and P3: (Both Town|Both Mafia|Both Neutral)\.$/.test(info.text),
      'unexpected drunk result: ' + (info && info.text));
  });

  test('a roleblocked Witness gets no result and an info log entry', () => {
    const state = assignRoles(['witness', 'escort', 'civilian', 'civilian', 'godfather', 'mafioso']);
    act(state, 4, 'escort', 2, 1);
    act(state, 11, 'witness', 1, 3, { secondTarget: 4 });
    night(state);
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.text === 'Witness check on P3 and P4: no result (roleblocked).'));
  });

  test('a Witch-controlled Witness keeps the second pick and compares the redirect pair', () => {
    const state = assignRoles(['witness', 'civilian', 'witch', 'godfather', 'civilian', 'mafioso']);
    act(state, 2, 'witch', 3, 1, { controlRedirect: 4 });
    act(state, 11, 'witness', 1, 2, { secondTarget: 5 });
    night(state);
    assert.ok(logText(state).includes('(Witness) compares P4 and P5: Different alignments.'));
  });

  test('recordNightAction accepts the second target via extra.secondTarget', () => {
    const state = assignRoles(['witness', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    const ok = engine.recordNightAction(state, {
      position: 11, roleId: 'witness', playerId: 1, targetId: 2, extra: { secondTarget: 3 }
    });
    assert.ok(ok);
    assert.strictEqual(state.night.actions.length, 1);
    assert.strictEqual(state.night.actions[0].targetId, 2);
    assert.strictEqual(state.night.actions[0].extra.secondTarget, 3);
  });

  test('recordNightAction rejects a self second target', () => {
    const state = assignRoles(['witness', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    let ok = engine.recordNightAction(state, {
      position: 11, roleId: 'witness', playerId: 1, targetId: 2, extra: { secondTarget: 1 }
    });
    assert.strictEqual(ok, false);
    assert.strictEqual(state.night.actions.length, 0);
    ok = engine.recordNightAction(state, {
      position: 11, roleId: 'witness', playerId: 1, targetId: 2, extra: { secondTarget: 2 }
    });
    assert.strictEqual(ok, false, 'secondTarget equal to the first target is rejected');
    assert.strictEqual(state.night.actions.length, 0);
  });

  test('the Witness wakes in its own position-11 step while alive, and never once dead', () => {
    const state = assignRoles(['witness', 'civilian', 'sheriff', 'godfather', 'mafioso', 'civilian']);
    const step = engine.getNightSteps(state).find((s) => s.title === 'Witness');
    assert.ok(step, 'Witness step is generated');
    assert.strictEqual(step.position, 11);
    assert.deepStrictEqual(step.roles, ['witness']);
    pid(state, 1).isAlive = false;
    assert.ok(!engine.getNightSteps(state).some((s) => s.title === 'Witness'));
  });
});

// ---------------------------------------------------------------------------
// N1-only step gating and start-knowing roles
// ---------------------------------------------------------------------------

describe('Washerwoman', () => {
  test('the claim names the holder of a named Town role in the deck', () => {
    const state = dealExact(['washerwoman', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    const info = state.playerLog['1'].find((e) => e.kind === 'info' && e.at === 'SETUP');
    assert.ok(info, 'washerwoman has no SETUP info entry');
    const m = info.text.match(/^Washerwoman: one of (P\d+), (P\d+) is the ([^.]+)\.$/);
    assert.ok(m, 'unexpected claim text: ' + info.text);
    assert.notStrictEqual(m[1], m[2], 'pair must be two distinct players');
    assert.strictEqual(m[3], 'Sheriff');
    const first = pid(state, Number(m[1].slice(1)));
    assert.strictEqual(engine.ROLES[first.assignedRole].name, 'Sheriff');
  });

  test('with several named Town roles the claim is still true for the holder', () => {
    const state = dealExact(['washerwoman', 'sheriff', 'doctor', 'lookout', 'godfather', 'mafioso']);
    const info = state.playerLog['1'].find((e) => e.kind === 'info' && e.at === 'SETUP');
    const m = info.text.match(/^Washerwoman: one of (P\d+), (P\d+) is the ([^.]+)\.$/);
    assert.ok(m, 'unexpected claim text: ' + info.text);
    const first = pid(state, Number(m[1].slice(1)));
    assert.strictEqual(engine.ROLES[first.assignedRole].name, m[3], 'the first named player must hold the claimed role');
  });

  test('the misreg fallback still stores a pair when no named Town role besides the Washerwoman is in the deck', () => {
    const state = dealExact(['washerwoman', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian']);
    const info = state.playerLog['1'].find((e) => e.kind === 'info' && e.at === 'SETUP');
    assert.ok(info, 'washerwoman has no SETUP info entry');
    const m = info.text.match(/^Washerwoman: one of (P\d+), (P\d+) is the ([^.]+)\.$/);
    assert.ok(m, 'unexpected claim text: ' + info.text);
    assert.notStrictEqual(m[1], m[2], 'pair must be two distinct players');
    assert.ok(m[3] !== 'Godfather' && m[3] !== 'Mafioso', 'the claimed role must be a townsfolk role, got: ' + m[3]);
    const claim = roleIdByName(m[3]);
    assert.ok(claim, 'claimed role unknown: ' + m[3]);
    assert.strictEqual(engine.ROLES[claim].team, 'TOWN', 'claimed role must be Town-aligned');
  });

  test('a role swap does not recompute the claim', () => {
    const state = dealExact(['washerwoman', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    const before = state.playerLog['1'].find((e) => e.kind === 'info' && e.at === 'SETUP').text;
    engine.swapRoles(state, 2, 3);
    const after = state.playerLog['1'].filter((e) => e.kind === 'info' && e.at === 'SETUP');
    assert.strictEqual(after.length, 1);
    assert.strictEqual(after[0].text, before);
  });

  test('redeal recomputes the claim', () => {
    const state = dealExact(['washerwoman', 'sheriff', 'civilian', 'civilian', 'godfather', 'mafioso']);
    engine.redeal(state);
    const ww = state.players.find((p) => p.assignedRole === 'washerwoman');
    const info = state.playerLog[String(ww.id)].filter((e) => e.kind === 'info' && e.at === 'SETUP');
    assert.strictEqual(info.length, 1);
    assert.ok(info[0].text.indexOf('Washerwoman: one of ') === 0);
  });
});

// ---------------------------------------------------------------------------
// Chef (start-knowing)
// ---------------------------------------------------------------------------

describe('Chef', () => {
  function chefInfo(state) {
    const chef = state.players.find((p) => p.assignedRole === 'chef');
    return state.playerLog[String(chef.id)].find((e) => e.kind === 'info' && e.at === 'SETUP');
  }

  test('counts adjacent evil pairs in the seat circle (6 players)', () => {
    const state = dealExact(['chef', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    assert.strictEqual(chefInfo(state).text, 'Chef: 1 adjacent pair of evil players.');
  });

  test('counts the wrap-around seat n / seat 1 pair', () => {
    const state = dealExact(['mafioso', 'chef', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.strictEqual(chefInfo(state).text, 'Chef: 1 adjacent pair of evil players.');
  });

  test('counts pairs for 8 players including the wrap-around pair', () => {
    const state = dealExact(['mafioso', 'chef', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.strictEqual(chefInfo(state).text, 'Chef: 1 adjacent pair of evil players.');
  });

  test('counts the Serial Killer as evil but not Neutral Benign roles', () => {
    const state = dealExact(['chef', 'spy', 'serialkiller', 'mafioso', 'civilian', 'godfather']);
    assert.strictEqual(chefInfo(state).text, 'Chef: 1 adjacent pair of evil players.');
  });

  test('reports no adjacent pairs when no two evil players are adjacent', () => {
    const state = dealExact(['chef', 'godfather', 'civilian', 'mafioso', 'civilian', 'civilian']);
    assert.strictEqual(chefInfo(state).text, 'Chef: no adjacent pairs of evil players.');
  });

  test('reports a multi-pair count', () => {
    const state = dealExact(['chef', 'godfather', 'mafioso', 'serialkiller', 'civilian', 'civilian']);
    // pairs: (2,3) GF+Mafioso, (3,4) Mafioso+SK -> 2
    assert.strictEqual(chefInfo(state).text, 'Chef: 2 adjacent pairs of evil players.');
  });
});

// ---------------------------------------------------------------------------
// Info results in playerLog
// ---------------------------------------------------------------------------

describe('info results in playerLog', () => {
  test('a Sheriff check writes an info playerLog entry', () => {
    const state = assignRoles(['sheriff', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 11, 'sheriff', 1, 2);
    night(state);
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.text === 'Sheriff check on P2: INNOCENT.'));
  });

  test('a roleblocked Sheriff logs no result (roleblocked)', () => {
    const state = assignRoles(['sheriff', 'escort', 'civilian', 'civilian', 'godfather', 'mafioso']);
    act(state, 4, 'escort', 2, 1);
    act(state, 11, 'sheriff', 1, 3);
    night(state);
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'info' && e.text === 'Sheriff check on P3: no result (roleblocked).'));
  });
});

// ---------------------------------------------------------------------------
// Deputy inheritance
// ---------------------------------------------------------------------------

describe('Deputy inheritance', () => {
  test('the Deputy inherits the Sheriff badge when the Sheriff dies', () => {
    const state = assignRoles(['sheriff', 'deputy', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 1);
    const result = night(state);
    assert.strictEqual(pid(state, 1).isAlive, false);
    assert.strictEqual(pid(state, 2).inheritedRole, 'sheriff');
    assert.strictEqual(result.inheritedSheriff, true);
    assert.ok(state.morning.inheritanceNote.includes('inherited the Sheriff'));
    assert.ok(logText(state).includes('inherited the Sheriff'));
  });

  test('the inherited Deputy performs the Sheriff check on the next night', () => {
    const state = assignRoles(['sheriff', 'deputy', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 1);
    night(state);
    assert.ok(engine.getNightSteps(state).some((s) => s.position === 11));
    act(state, 11, 'deputy', 2, 4);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P4: SUSPICIOUS'));
  });

  test('no inheritance while the Sheriff lives', () => {
    const state = assignRoles(['sheriff', 'deputy', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 5);
    night(state);
    assert.strictEqual(pid(state, 2).inheritedRole, null);
  });

  test('no inheritance if the Deputy is dead when the Sheriff dies', () => {
    const state = assignRoles(['sheriff', 'deputy', 'godfather', 'mafioso', 'serialkiller', 'civilian']);
    act(state, 6, 'godfather', 3, 1);
    act(state, 9, 'serialkiller', 5, 2);
    const result = night(state);
    assert.strictEqual(pid(state, 1).isAlive, false);
    assert.strictEqual(pid(state, 2).isAlive, false);
    assert.strictEqual(pid(state, 2).inheritedRole, null);
    assert.strictEqual(result.inheritedSheriff, false);
  });
});

// ---------------------------------------------------------------------------
// Drunk status engine
// ---------------------------------------------------------------------------

describe('Drunk status engine', () => {
  test('a poisoned Sheriff inverts INNOCENT to SUSPICIOUS', () => {
    const state = assignRoles(['poisoner', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 1, 'poisoner', 1, 2);
    act(state, 11, 'sheriff', 2, 5);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P5: SUSPICIOUS'));
  });

  test('a poisoned Sheriff inverts SUSPICIOUS to INNOCENT', () => {
    const state = assignRoles(['poisoner', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 1, 'poisoner', 1, 2);
    act(state, 11, 'sheriff', 2, 4);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P4: INNOCENT'));
  });

  test('sober Sheriff results: GF INNOCENT, Mafioso and SK SUSPICIOUS', () => {
    const state = assignRoles(['sheriff', 'godfather', 'mafioso', 'serialkiller', 'civilian', 'civilian']);
    act(state, 11, 'sheriff', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P2: INNOCENT'));
    act(state, 11, 'sheriff', 1, 3);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P3: SUSPICIOUS'));
    act(state, 11, 'sheriff', 1, 4);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P4: SUSPICIOUS'));
  });

  test('a Drunk Consigliere learns a random role of a different alignment, then the exact role when sober', () => {
    const state = assignRoles(['consigliere', 'poisoner', 'civilian', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 1, 'poisoner', 2, 1);
    act(state, 11, 'consigliere', 1, 3);
    night(state);
    const m = logText(state).match(/\(Consigliere\) learns the role of P3: ([^.]+)\./);
    assert.ok(m, 'consigliere result was not logged');
    const learnedId = roleIdByName(m[1]);
    assert.ok(learnedId, 'learned role name does not resolve: ' + m[1]);
    assert.notStrictEqual(engine.ROLES[learnedId].team, 'TOWN');
    assert.notStrictEqual(m[1], 'Civilian');
    act(state, 11, 'consigliere', 1, 3);
    night(state);
    assert.ok(logText(state).includes('(Consigliere) learns the role of P3: Civilian.'));
  });

  test('a Drunk Janitor fails to clean a corpse', () => {
    const state = assignRoles(['janitor', 'poisoner', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 5);
    act(state, 1, 'poisoner', 2, 1);
    act(state, 7, 'janitor', 1, 5);
    night(state);
    assert.strictEqual(graveyardEntry(state, 5).wasCleaned, false);
    assert.ok(!logText(state).includes('cleaned the corpse'));
  });

  test('a sober Janitor cleans a corpse', () => {
    const state = assignRoles(['janitor', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 5);
    act(state, 7, 'janitor', 1, 5);
    night(state);
    assert.strictEqual(graveyardEntry(state, 5).wasCleaned, true);
    assert.ok(logText(state).includes('cleaned the corpse of P5'));
  });

  test('a Drunk Doctor\'s protection fails', () => {
    const state = assignRoles(['doctor', 'poisoner', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 1, 'poisoner', 2, 1);
    act(state, 5, 'doctor', 1, 5);
    act(state, 6, 'godfather', 3, 5);
    night(state);
    assert.strictEqual(pid(state, 5).isAlive, false);
    assert.ok(!logText(state).includes('protected'));
  });
});

// ---------------------------------------------------------------------------
// Jailor
// ---------------------------------------------------------------------------

describe('Jailor', () => {
  test('night 1: jails but cannot execute', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    act(state, 6, 'godfather', 6, 5);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(pid(state, 1).executionsUsed, 0);
    assert.strictEqual(state.night.lastJailTarget, 2);
    assert.ok(logText(state).includes('jailed P2'));
    assert.ok(!logText(state).includes('executed by the Jailor'));
  });

  test('EXECUTE is an Unstoppable kill from night 2 onward', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    act(state, 6, 'godfather', 6, 5);
    night(state); // night 1: no execution
    act(state, 3, 'jailor', 1, 3, { jailorDecision: 'EXECUTE' });
    act(state, 6, 'godfather', 6, 4);
    const result = night(state);
    assert.strictEqual(pid(state, 3).isAlive, false);
    assert.strictEqual(deathCauses(result)[3], 'executed by the Jailor');
    assert.strictEqual(pid(state, 1).executionsUsed, 1);
  });

  test('SPARE leaves the target alive and the jail roleblocks the jailed player', () => {
    const state = assignRoles(['jailor', 'serialkiller', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'SPARE' });
    act(state, 9, 'serialkiller', 2, 5);
    act(state, 6, 'godfather', 3, 6);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(pid(state, 5).isAlive, true); // the jailed SK's kill never landed
  });

  test('the execution cap is three per game', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    pid(state, 1).executionsUsed = 3;
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(pid(state, 1).executionsUsed, 3);
  });

  test('cannot jail themselves (recordNightAction rejects self-targets)', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    const ok = engine.recordNightAction(state, {
      position: 3, roleId: 'jailor', playerId: 1, targetId: 1, extra: { jailorDecision: 'SPARE' }
    });
    assert.strictEqual(ok, false);
    assert.strictEqual(state.night.actions.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Vigilante
// ---------------------------------------------------------------------------

describe('Vigilante', () => {
  test('shooting a Town player causes guilt death at the start of the next night', () => {
    const state = assignRoles(['vigilante', 'civilian', 'civilian', 'civilian', 'godfather', 'mafioso']);
    const shot = engine.vigilanteShoot(state, 1, 2);
    assert.strictEqual(shot.guilty, true);
    assert.strictEqual(pid(state, 2).isAlive, false);
    assert.strictEqual(pid(state, 1).guiltPending, true);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[1], 'died of guilt');
    assert.strictEqual(pid(state, 1).isAlive, false);
  });

  test('shooting a Mafia player does not set guilt', () => {
    const state = assignRoles(['vigilante', 'godfather', 'mafioso', 'consort', 'civilian', 'civilian']);
    const shot = engine.vigilanteShoot(state, 1, 3);
    assert.strictEqual(shot.guilty, false);
    assert.strictEqual(pid(state, 1).guiltPending, false);
  });

  test('the three-shot cap blocks further shots', () => {
    const state = assignRoles(['vigilante', 'godfather', 'mafioso', 'consort', 'civilian', 'civilian']);
    assert.ok(engine.vigilanteShoot(state, 1, 2));
    assert.ok(engine.vigilanteShoot(state, 1, 3));
    assert.ok(engine.vigilanteShoot(state, 1, 4));
    assert.strictEqual(pid(state, 1).shotsFired, 3);
    assert.strictEqual(engine.vigilanteShoot(state, 1, 5), null);
    assert.strictEqual(pid(state, 5).isAlive, true);
  });
});

// ---------------------------------------------------------------------------
// Witch control
// ---------------------------------------------------------------------------

describe('Witch control', () => {
  test('controlling the Godfather redirects the Mafia kill and reveals his role', () => {
    const state = assignRoles(['witch', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 1, 2, { controlRedirect: 5 });
    act(state, 6, 'godfather', 2, 4);
    const result = night(state);
    assert.strictEqual(pid(state, 4).isAlive, true);
    assert.strictEqual(deathCauses(result)[5], 'killed by the Mafia');
    assert.ok(logText(state).includes('The Witch controls P2 and learns their role: Godfather.'));
  });

  test('a redirect onto a Mafia player kills them', () => {
    const state = assignRoles(['witch', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 1, 2, { controlRedirect: 3 });
    act(state, 6, 'godfather', 2, 4);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[3], 'killed by the Mafia');
    assert.ok(graveyardEntry(state, 3));
    assert.ok(!logText(state).includes('kill failed'));
  });

  test('the Witch cannot control herself', () => {
    const state = assignRoles(['witch', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    const ok = engine.recordNightAction(state, {
      position: 2, roleId: 'witch', playerId: 1, targetId: 1, extra: { controlRedirect: 4 }
    });
    assert.strictEqual(ok, false);
    assert.strictEqual(state.night.actions.length, 0);
  });

  test('controlling the Serial Killer redirects his kill', () => {
    const state = assignRoles(['witch', 'serialkiller', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 2, 'witch', 1, 2, { controlRedirect: 5 });
    act(state, 9, 'serialkiller', 2, 6);
    act(state, 6, 'godfather', 3, 6);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[5], 'killed by the Serial Killer');
    assert.strictEqual(deathCauses(result)[6], 'killed by the Mafia');
    assert.strictEqual(pid(state, 4).isAlive, true);
  });

  test('control of a jailed player fails (no redirect, no role reveal)', () => {
    const state = assignRoles(['jailor', 'witch', 'serialkiller', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 2, 3, { controlRedirect: 5 });
    act(state, 3, 'jailor', 1, 3, { jailorDecision: 'SPARE' });
    act(state, 9, 'serialkiller', 3, 4);
    const result = night(state);
    assert.strictEqual(result.deaths.length, 0);
    assert.strictEqual(pid(state, 4).isAlive, true);
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.ok(!logText(state).includes('learns their role'));
  });
});

// ---------------------------------------------------------------------------
// Framer
// ---------------------------------------------------------------------------

describe('Framer', () => {
  test('a framed target reads SUSPICIOUS to the Sheriff', () => {
    const state = assignRoles(['framer', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 10, 'framer', 1, 5);
    act(state, 11, 'sheriff', 2, 5);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P5: SUSPICIOUS'));
  });

  test('a framed Godfather reads SUSPICIOUS despite his innocence', () => {
    const state = assignRoles(['framer', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 10, 'framer', 1, 3);
    act(state, 11, 'sheriff', 2, 3);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P3: SUSPICIOUS'));
  });

  test('a Drunk Sheriff inverts a framed SUSPICIOUS result to INNOCENT', () => {
    const state = assignRoles(['framer', 'sheriff', 'poisoner', 'civilian', 'godfather', 'mafioso']);
    act(state, 1, 'poisoner', 3, 2);
    act(state, 10, 'framer', 1, 4);
    act(state, 11, 'sheriff', 2, 4);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P4: INNOCENT'));
  });
});

// ---------------------------------------------------------------------------
// Blackmailer
// ---------------------------------------------------------------------------

describe('Blackmailer', () => {
  test('a blackmailed player is silenced for the next day', () => {
    const state = assignRoles(['blackmailer', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 8, 'blackmailer', 1, 4);
    act(state, 6, 'godfather', 6, 5);
    night(state);
    assert.strictEqual(state.morning.blackmailTarget, 4);
    assert.strictEqual(engine.beginDay(state), null);
    assert.strictEqual(pid(state, 4).blackmailed, true);
    assert.strictEqual(pid(state, 5).blackmailed, false);
  });

  test('a blackmailed player may still vote by gesture', () => {
    const state = assignRoles(['blackmailer', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 8, 'blackmailer', 1, 4);
    act(state, 6, 'godfather', 6, 5);
    night(state);
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 2));
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'AGREE' }), true);
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'GUILTY' }), true);
  });

  test('a player cannot be blackmailed on consecutive nights', () => {
    const state = assignRoles(['blackmailer', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 8, 'blackmailer', 1, 4);
    act(state, 6, 'godfather', 6, 5);
    const r1 = night(state);
    assert.ok(r1.logs.some((l) => l.includes('blackmailed P4')));
    engine.beginDay(state);
    act(state, 8, 'blackmailer', 1, 4); // consecutive re-target fails
    const r2 = night(state);
    assert.ok(!r2.logs.some((l) => l.includes('blackmailed')));
  });
});

// ---------------------------------------------------------------------------
// Janitor and Undertaker
// ---------------------------------------------------------------------------

describe('Janitor and Undertaker', () => {
  test('a cleaned corpse cannot be inspected by the Undertaker', () => {
    const state = assignRoles(['janitor', 'undertaker', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 5);
    act(state, 7, 'janitor', 1, 5);
    act(state, 11, 'undertaker', 2, 5);
    night(state);
    assert.strictEqual(graveyardEntry(state, 5).wasCleaned, true);
    assert.ok(!logText(state).includes('(Undertaker) inspects the corpse of P5'));
  });

  test('the Undertaker learns a corpse\'s true role exactly once', () => {
    const state = assignRoles(['undertaker', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 5);
    act(state, 11, 'undertaker', 1, 5);
    act(state, 11, 'undertaker', 1, 5); // duplicate inspection the same night
    night(state);
    const inspects = logText(state).match(/\(Undertaker\) inspects the corpse of P5: ([^.]+)\./g) || [];
    assert.strictEqual(inspects.length, 1);
    assert.ok(inspects[0].includes('Civilian'));
  });

  test('cleaning still hides the role in Classic Reveal mode', () => {
    const state = assignRoles(['janitor', 'godfather', 'mafioso', 'serialkiller', 'civilian', 'civilian', 'civilian'],
      { houseRules: { classicReveal: true } });
    act(state, 6, 'godfather', 2, 6);
    act(state, 7, 'janitor', 1, 6);
    act(state, 9, 'serialkiller', 4, 7);
    night(state);
    const ann = engine.getMorningAnnouncement(state);
    const byName = {};
    ann.deaths.forEach((d) => { byName[d.name] = d.roleShown; });
    assert.strictEqual(byName['P6'], '?? UNKNOWN ??'); // cleaned
    assert.strictEqual(byName['P7'], 'Civilian'); // not cleaned
  });
});

// ---------------------------------------------------------------------------
// Mystery deaths vs Classic Reveal mode
// ---------------------------------------------------------------------------

describe('Retributionist', () => {
  test('revives a dead player at the next morning', () => {
    const state = assignRoles(['retributionist', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 5);
    act(state, 12, 'retributionist', 1, 5);
    const result = night(state);
    assert.deepStrictEqual(result.revived, [5]);
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.strictEqual(pid(state, 5).hasGhostVote, false);
    assert.ok(logText(state).includes('will revive P5'));
  });

  test('is once per game', () => {
    const state = assignRoles(['retributionist', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 5);
    act(state, 12, 'retributionist', 1, 5);
    night(state);
    act(state, 6, 'godfather', 2, 6);
    act(state, 12, 'retributionist', 1, 6);
    const r2 = night(state);
    assert.ok(!r2.logs.some((l) => l.includes('will revive')));
    assert.strictEqual(pid(state, 6).isAlive, false);
  });

  test('removes the revived player from the graveyard so corpse pickers skip them', () => {
    const state = assignRoles(['retributionist', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 5);
    act(state, 12, 'retributionist', 1, 5);
    night(state);
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.strictEqual(graveyardEntry(state, 5), null);
    assert.ok(!state.graveyard.some((e) => e.playerId === 5));
  });

  test('a revived player who dies again gets no second ghost vote token', () => {
    const state = assignRoles(['retributionist', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 5);
    act(state, 12, 'retributionist', 1, 5);
    night(state);
    assert.strictEqual(pid(state, 5).isAlive, true);
    assert.strictEqual(pid(state, 5).hasGhostVote, false);
    act(state, 6, 'godfather', 2, 5);
    night(state);
    assert.strictEqual(pid(state, 5).isAlive, false);
    assert.strictEqual(pid(state, 5).hasGhostVote, false);
  });
});

// ---------------------------------------------------------------------------
// Amnesiac
// ---------------------------------------------------------------------------

describe('Amnesiac', () => {
  test('starts Neutral with no ability until remembering', () => {
    const state = assignRoles(['amnesiac', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.strictEqual(state.amnesiac.used, false);
    assert.strictEqual(engine.ROLES.amnesiac.team, 'NEUTRAL');
  });

  test('remembers a dead player\'s role and joins that role\'s alignment', () => {
    const state = assignRoles(['amnesiac', 'civilian', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 3, 2);
    act(state, 12, 'amnesiac', 1, 2);
    night(state);
    assert.strictEqual(state.amnesiac.used, true);
    assert.strictEqual(state.amnesiac.rememberedRole, 'civilian');
    assert.strictEqual(pid(state, 1).usedOncePerGame, true);
    assert.strictEqual(engine.ROLES[state.amnesiac.rememberedRole].team, 'TOWN');
  });

  test('an Amnesiac who remembers a Mafia role counts as Mafia for victory', () => {
    const state = assignRoles(['amnesiac', 'vigilante', 'godfather', 'mafioso', 'civilian', 'civilian']);
    engine.vigilanteShoot(state, 2, 4); // day-kill the Mafioso
    act(state, 12, 'amnesiac', 1, 4);
    night(state);
    assert.strictEqual(state.amnesiac.rememberedRole, 'mafioso');
    assert.strictEqual(engine.ROLES[state.amnesiac.rememberedRole].team, 'MAFIA');
    assert.strictEqual(engine.checkVictory(state), null); // 2 Mafia vs 3 Town is no win
  });
});

// ---------------------------------------------------------------------------
// Mafioso promotion
// ---------------------------------------------------------------------------

describe('Mafioso promotion', () => {
  test('the Mafioso becomes the new Godfather when the Godfather dies and kills alone', () => {
    const state = assignRoles(['jailor', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 4);
    night(state); // night 1
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    act(state, 6, 'mafioso', 3, 5);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[2], 'executed by the Jailor');
    assert.strictEqual(pid(state, 3).inheritedRole, 'godfather');
    assert.ok(logText(state).includes('The Mafioso has become the new Godfather'));
    assert.strictEqual(deathCauses(result)[5], 'killed by the Mafia'); // the promoted Mafioso kills alone
  });

  test('a promoted Mafioso has Basic defense and reads INNOCENT', () => {
    const state = assignRoles(['jailor', 'godfather', 'mafioso', 'serialkiller', 'sheriff', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 2, 6);
    act(state, 9, 'serialkiller', 4, 7);
    night(state); // night 1
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    act(state, 11, 'sheriff', 5, 3);
    const r2 = night(state);
    assert.strictEqual(pid(state, 3).inheritedRole, 'godfather');
    assert.ok(r2.logs.some((l) => l.includes('(Sheriff) checks P3: SUSPICIOUS'))); // checked before promotion
    act(state, 9, 'serialkiller', 4, 3);
    act(state, 11, 'sheriff', 5, 3);
    const r3 = night(state);
    assert.strictEqual(pid(state, 3).isAlive, true); // SK Basic attack blocked
    assert.ok(r3.logs.some((l) => l.includes('P3 survived the attack')));
    assert.ok(r3.logs.some((l) => l.includes('(Sheriff) checks P3: INNOCENT')));
  });
});

// ---------------------------------------------------------------------------
// Session recap: death log
// ---------------------------------------------------------------------------

describe('stale blackmail state', () => {
  test('a failed consecutive blackmail does not silence the player the next day', () => {
    const state = assignRoles(['blackmailer', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 8, 'blackmailer', 1, 4);
    act(state, 6, 'godfather', 6, 5);
    night(state);
    engine.beginDay(state);
    act(state, 8, 'blackmailer', 1, 4); // consecutive re-target fails
    night(state);
    assert.strictEqual(state.morning.blackmailTarget, null);
    engine.beginDay(state);
    assert.strictEqual(pid(state, 4).blackmailed, false);
  });
});


describe('Amnesiac and the Serial Killer', () => {
  test('an Amnesiac remembering the Serial Killer triggers SK victory logic and blocks Town victory while alive', () => {
    const state = assignRoles(['amnesiac', 'serialkiller', 'godfather', 'mafioso', 'vigilante', 'civilian', 'civilian']);
    engine.vigilanteShoot(state, 5, 2); // day-kill the real SK so its role can be remembered
    act(state, 12, 'amnesiac', 1, 2);
    night(state);
    assert.strictEqual(state.amnesiac.rememberedRole, 'serialkiller');
    pid(state, 3).isAlive = false; // all Mafia dead
    pid(state, 4).isAlive = false;
    assert.strictEqual(engine.checkVictory(state), null); // SK alive blocks Town victory
    pid(state, 6).isAlive = false;
    pid(state, 7).isAlive = false;
    const v = engine.checkVictory(state);
    assert.strictEqual(v.winner, 'SERIAL_KILLER'); // SK majority recognizes the Amnesiac
  });
});


describe('failed jail attempts', () => {
  test('a Jailor who dies before jailing does not roleblock the intended target', () => {
    const state = assignRoles(['jailor', 'serialkiller', 'jester', 'civilian', 'civilian', 'civilian']);
    state.jester.haunted = true;
    state.trial.votes = [{ voterId: 1, verdict: 'GUILTY' }]; // the Jailor voted Guilty, so the haunt may target him
    act(state, 0, 'jester', 3, 1); // the Jester haunts the Jailor at the start of the night
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'SPARE' });
    act(state, 9, 'serialkiller', 2, 5);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[1], 'haunted by the Jester');
    assert.strictEqual(deathCauses(result)[5], 'killed by the Serial Killer'); // P2 was never roleblocked
  });

  test('the consecutive jail rule ignores failed jails', () => {
    const state = assignRoles(['jailor', 'escort', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 3, 'jailor', 1, 3, { jailorDecision: 'SPARE' });
    act(state, 6, 'godfather', 6, 4);
    night(state);
    assert.strictEqual(state.night.lastJailTarget, 3);
    engine.beginDay(state);
    act(state, 4, 'escort', 2, 1); // roleblock the Jailor: the jail fails
    act(state, 3, 'jailor', 1, 4, { jailorDecision: 'SPARE' });
    act(state, 6, 'godfather', 6, 5);
    night(state);
    engine.beginDay(state);
    act(state, 3, 'jailor', 1, 3, { jailorDecision: 'SPARE' }); // jailing P3 again is now allowed
    act(state, 6, 'godfather', 6, 2);
    night(state);
    const jailedLogs = logText(state).match(/jailed P3/g) || [];
    assert.strictEqual(jailedLogs.length, 2);
  });
});


describe('forged wills', () => {
  test('records the Forger target and reminds the moderator at resolve', () => {
    const state = assignRoles(['forger', 'serialkiller', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 7, 'forger', 1, 3);
    act(state, 9, 'serialkiller', 2, 3);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[3], 'killed by the Serial Killer');
    assert.ok(logText(state).includes('forged a will for P3'));
    assert.strictEqual(state.morning.forgedWills.length, 1);
    assert.strictEqual(state.morning.forgedWills[0].targetId, 3);
    assert.strictEqual(state.morning.forgedWills[0].targetName, 'P3');
    const ann = engine.getMorningAnnouncement(state);
    assert.strictEqual(ann.forgedWills[0].targetName, 'P3');
  });
});


describe('roleblock interactions', () => {
  test('a roleblocker voided by an alerting Veteran does not roleblock', () => {
    const state = assignRoles(['escort', 'veteran', 'serialkiller', 'civilian', 'witch', 'civilian']);
    act(state, 0, 'veteran', 2, null, { alert: true });
    act(state, 2, 'witch', 5, 1, { controlRedirect: 2 }); // the Witch forces the Escort to visit the Veteran
    act(state, 4, 'escort', 1, 3); // the Escort's raw target is the Serial Killer
    act(state, 9, 'serialkiller', 3, 6);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[1], 'visited an alerting Veteran');
    assert.strictEqual(deathCauses(result)[6], 'killed by the Serial Killer'); // the SK was never roleblocked
  });

  test('the Witch controlling the Jailor roleblocks only the redirect target', () => {
    const state = assignRoles(['witch', 'jailor', 'serialkiller', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 1, 2, { controlRedirect: 4 });
    act(state, 3, 'jailor', 2, 3, { jailorDecision: 'SPARE' });
    act(state, 9, 'serialkiller', 3, 5);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[5], 'killed by the Serial Killer'); // only P4 was jailed
    assert.strictEqual(pid(state, 4).isAlive, true); // P4 was jailed and spared
    assert.ok(logText(state).includes('jailed P4'));
  });
});


describe('witchSide', () => {
  test('witchSide can be set to TOWN and changes how the Witch counts for victory', () => {
    const state = engine.createGame({ playerCount: 8, presetId: 'p1', neutral: ['witch'] });
    engine.dealRoles(state);
    const witch = state.players.find((p) => p.assignedRole === 'witch');
    assert.ok(witch, 'the deck contains the Witch');
    state.players.forEach(function (p) { if (p.id !== witch.id) p.isAlive = false; });
    state.witchSide = 'TOWN';
    assert.strictEqual(engine.checkVictory(state).winner, 'TOWN');
    state.witchSide = 'MAFIA';
    assert.strictEqual(engine.checkVictory(state).winner, 'MAFIA');
  });
});


