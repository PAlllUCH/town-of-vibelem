'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../js/engine.js');

// ---------------------------------------------------------------------------
// Helpers
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
    p.lastWill = '';
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
  state.trial = { active: false, accusedId: null, nominatorId: null, votes: [], dayTrialsDone: 0 };
  state.night = { number: 1, actions: [], lastJailTarget: null, lastBlackmailTarget: null };
  state.dayNumber = 0;
  state.winner = null;
  state.logs = [];
  state.executionerTarget = null;
  state.executionerConverted = false;
  state.jester = { haunted: false, hauntTarget: null };
  state.retributionist = { used: false };
  state.amnesiac = { used: false, rememberedRole: null };
  state.pendingInheritanceNote = '';
  state.morning = { deaths: [], revivals: [], inheritanceNote: '', blackmailTarget: null };
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

// ---------------------------------------------------------------------------
// Alignment ratio table
// ---------------------------------------------------------------------------

describe('alignment ratio table', () => {
  const expected = {
    6: { town: 4, mafia: 2, neutral: 0 },
    7: { town: 5, mafia: 2, neutral: 0 },
    8: { town: 5, mafia: 2, neutral: 1 },
    9: { town: 6, mafia: 2, neutral: 1 },
    10: { town: 6, mafia: 3, neutral: 1 },
    11: { town: 7, mafia: 3, neutral: 1 },
    12: { town: 7, mafia: 3, neutral: 2 },
    13: { town: 8, mafia: 3, neutral: 2 },
    14: { town: 9, mafia: 4, neutral: 1 },
    15: { town: 9, mafia: 4, neutral: 2 }
  };

  test('matches the GDD table for every player count from 6 to 15', () => {
    for (let n = 6; n <= 15; n += 1) {
      assert.deepStrictEqual(engine.RATIO_TABLE[n], expected[n], 'count ' + n);
    }
  });

  test('every row sums to its player count', () => {
    for (let n = 6; n <= 15; n += 1) {
      const row = engine.RATIO_TABLE[n];
      assert.strictEqual(row.town + row.mafia + row.neutral, n, 'count ' + n);
    }
  });
});

// ---------------------------------------------------------------------------
// Preset deck composition
// ---------------------------------------------------------------------------

describe('preset deck composition', () => {
  test('10 players, preset p1 matches the GDD worked example', () => {
    const p = preview(engine.createGame({ playerCount: 10, presetId: 'p1' }));
    assert.deepStrictEqual(sorted(p.town), ['doctor', 'jailor', 'medium', 'sheriff', 'tracker', 'undertaker']);
    assert.deepStrictEqual(sorted(p.mafia), ['godfather', 'janitor', 'mafioso']);
    assert.deepStrictEqual(sorted(p.neutral), ['amnesiac']);
  });

  test('8 players, preset p4 matches the GDD worked example', () => {
    const p = preview(engine.createGame({ playerCount: 8, presetId: 'p4' }));
    assert.deepStrictEqual(sorted(p.town), ['doctor', 'jailor', 'lookout', 'mayor', 'sheriff']);
    assert.deepStrictEqual(sorted(p.mafia), ['godfather', 'mafioso']);
    assert.deepStrictEqual(sorted(p.neutral), ['jester']);
  });

  test('6 players, preset p1 fills the zero-neutral ratio', () => {
    const p = preview(engine.createGame({ playerCount: 6, presetId: 'p1' }));
    assert.deepStrictEqual(sorted(p.town), ['doctor', 'jailor', 'medium', 'undertaker']);
    assert.deepStrictEqual(sorted(p.mafia), ['godfather', 'mafioso']);
    assert.deepStrictEqual(p.neutral, []);
  });

  test('town overflow is filled with Civilians (15 players, preset p1)', () => {
    const p = preview(engine.createGame({ playerCount: 15, presetId: 'p1' }));
    assert.strictEqual(p.town.length, 9);
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 2); // 7 listed roles, 9 slots
    assert.strictEqual(p.mafia.length, 4);
    assert.strictEqual(p.neutral.length, 2);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length, 15);
  });

  test('town overflow also applies to shorter town lists (15 players, preset p2)', () => {
    const p = preview(engine.createGame({ playerCount: 15, presetId: 'p2' }));
    assert.strictEqual(p.town.length, 9);
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 3);
  });

  test('preset town priority lists match the GDD', () => {
    assert.deepStrictEqual(engine.PRESETS.p1.town, ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist']);
    assert.deepStrictEqual(engine.PRESETS.p2.town, ['jailor', 'doctor', 'sheriff', 'lookout', 'escort', 'tracker']);
    assert.deepStrictEqual(engine.PRESETS.p3.town, ['jailor', 'deputy', 'veteran', 'vigilante', 'doctor', 'escort']);
    assert.deepStrictEqual(engine.PRESETS.p4.town, ['jailor', 'mayor', 'doctor', 'sheriff', 'lookout', 'tracker']);
    assert.deepStrictEqual(engine.PRESETS.p5.town, ['jailor', 'sheriff', 'undertaker', 'medium', 'doctor', 'retributionist']);
    assert.deepStrictEqual(engine.PRESETS.p6.town, ['jailor', 'vigilante', 'veteran', 'deputy', 'doctor', 'escort']);
  });

  test('Framer is preset p4 slot 3 and enters the deck once 3+ Mafia slots exist', () => {
    assert.deepStrictEqual(engine.PRESETS.p4.mafia, ['godfather', 'mafioso', 'framer', 'consigliere']);
    assert.ok(preview(engine.createGame({ playerCount: 14, presetId: 'p4' })).mafia.includes('framer'));
    assert.ok(preview(engine.createGame({ playerCount: 10, presetId: 'p4' })).mafia.includes('framer'));
    assert.ok(!preview(engine.createGame({ playerCount: 8, presetId: 'p4' })).mafia.includes('framer'));
  });

  test('Blackmailer is preset p5 slot 4 and enters the deck at 4 Mafia slots', () => {
    assert.deepStrictEqual(engine.PRESETS.p5.mafia, ['godfather', 'mafioso', 'poisoner', 'blackmailer']);
    assert.ok(preview(engine.createGame({ playerCount: 14, presetId: 'p5' })).mafia.includes('blackmailer'));
    assert.ok(!preview(engine.createGame({ playerCount: 10, presetId: 'p5' })).mafia.includes('blackmailer'));
  });

  test('the deck always matches the player count and only Civilians may repeat (6-15, all presets)', () => {
    for (let n = 6; n <= 15; n += 1) {
      for (const presetId of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
        const p = preview(engine.createGame({ playerCount: n, presetId: presetId }));
        const all = p.town.concat(p.mafia, p.neutral);
        assert.strictEqual(all.length, n, 'deck size ' + presetId + ' @ ' + n);
        const nonCivilian = all.filter((id) => id !== 'civilian');
        assert.strictEqual(new Set(nonCivilian).size, nonCivilian.length, 'non-civilian duplicate in ' + presetId + ' @ ' + n);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Custom overrides
// ---------------------------------------------------------------------------

describe('custom team overrides', () => {
  test('overrides fully replace the preset team lists', () => {
    const state = engine.createGame({
      playerCount: 10,
      presetId: 'p1',
      town: ['doctor', 'sheriff', 'mayor', 'veteran', 'jailor', 'deputy'],
      mafia: ['godfather', 'mafioso', 'consort'],
      neutral: ['witch']
    });
    const p = preview(state);
    assert.deepStrictEqual(sorted(p.town), ['deputy', 'doctor', 'jailor', 'mayor', 'sheriff', 'veteran']);
    assert.deepStrictEqual(sorted(p.mafia), ['consort', 'godfather', 'mafioso']);
    assert.deepStrictEqual(sorted(p.neutral), ['witch']);
    // none of preset p1's own roles survive
    assert.ok(!p.town.includes('undertaker'));
    assert.ok(!p.mafia.includes('janitor'));
    assert.ok(!p.neutral.includes('amnesiac'));
  });

  test('a town override longer than the ratio is truncated top-down', () => {
    const state = engine.createGame({
      playerCount: 8,
      presetId: 'p1',
      town: ['doctor', 'sheriff', 'mayor', 'veteran', 'vigilante', 'tracker', 'lookout']
    });
    const p = preview(state);
    assert.deepStrictEqual(sorted(p.town), ['doctor', 'mayor', 'sheriff', 'veteran', 'vigilante']);
  });

  test('a short town override is padded with Civilians', () => {
    const state = engine.createGame({ playerCount: 8, presetId: 'p1', town: ['doctor'] });
    const p = preview(state);
    assert.strictEqual(p.town.length, 5);
    assert.ok(p.town.includes('doctor'));
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 4);
  });
});

// ---------------------------------------------------------------------------
// Night resolution order, attack and defense model
// ---------------------------------------------------------------------------

describe('night resolution order and the attack/defense model', () => {
  test('Doctor protection blocks the first Basic attack and is then consumed', () => {
    const state = assignRoles(['doctor', 'civilian', 'godfather', 'mafioso', 'serialkiller', 'civilian']);
    act(state, 5, 'doctor', 1, 2);
    act(state, 6, 'godfather', 3, 2);
    act(state, 9, 'serialkiller', 5, 2);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, false);
    assert.strictEqual(deathCauses(result)[2], 'killed by the Serial Killer');
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
    assert.deepStrictEqual(steps.map((s) => s.position), [0, 3, 6, 9, 14, 15, 16]);
    assert.deepStrictEqual(steps.find((s) => s.position === 0).roles, ['veteran']);
    assert.ok(steps.find((s) => s.position === 3).prompt.includes('cannot execute'));
    night(state);
    const steps2 = engine.getNightSteps(state);
    assert.ok(!steps2.find((s) => s.position === 3).prompt.includes('cannot execute'));
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
  test('night 1: jails and reads the will but cannot execute', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    act(state, 3, 'jailor', 1, 2, { jailorDecision: 'EXECUTE' });
    act(state, 6, 'godfather', 6, 5);
    const result = night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(pid(state, 1).executionsUsed, 0);
    assert.strictEqual(state.night.lastJailTarget, 2);
    assert.ok(logText(state).includes('jailed P2 and read their will'));
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

  test('a redirect onto a Mafia player makes the Mafia kill fail', () => {
    const state = assignRoles(['witch', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 1, 2, { controlRedirect: 3 });
    act(state, 6, 'godfather', 2, 4);
    const result = night(state);
    assert.strictEqual(result.deaths.length, 0);
    assert.ok(logText(state).includes('The Mafia kill failed: P3 is Mafia-aligned.'));
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

  test('classicReveal shows the true role alongside the will', () => {
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
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    const resolved = engine.resolveTrial(state);
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
    assert.strictEqual(engine.castVote(state, { voterId: 5, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 6, verdict: 'GUILTY' }), true);
    const resolved = engine.resolveTrial(state);
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
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 3, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 4, verdict: 'INNOCENT' }), true);
    return engine.resolveTrial(state);
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
// Victory conditions
// ---------------------------------------------------------------------------

describe('victory conditions', () => {
  test('Town wins when every Mafia player and the SK are dead (via lynch)', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    assert.ok(engine.startTrial(state, 6, 1));
    assert.strictEqual(engine.castVote(state, { voterId: 1, verdict: 'GUILTY' }), true);
    assert.strictEqual(engine.castVote(state, { voterId: 2, verdict: 'GUILTY' }), true);
    const resolved = engine.resolveTrial(state);
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

// ---------------------------------------------------------------------------
// Regression tests: engine bug fixes
// ---------------------------------------------------------------------------

describe('short override deck padding', () => {
  test('a short Mafia override is padded so the deck matches the player count', () => {
    const state = engine.createGame({ playerCount: 10, presetId: 'p1', mafia: ['godfather'] });
    const p = preview(state);
    assert.strictEqual(p.mafia.length, 3);
    assert.ok(p.mafia.includes('godfather'));
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length, 10);
    engine.dealRoles(state);
    assert.strictEqual(state.players.length, 10);
    assert.ok(state.players.every(function (pl) {
      return typeof pl.assignedRole === 'string' && !!engine.ROLES[pl.assignedRole];
    }), 'dealRoles must never assign an undefined role');
  });

  test('a short Neutral override is padded so the deck matches the player count', () => {
    const state = engine.createGame({ playerCount: 12, presetId: 'p1', neutral: [] });
    const p = preview(state);
    assert.strictEqual(p.neutral.length, 2);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length, 12);
  });
});

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
    const jailedLogs = logText(state).match(/jailed P3 and read their will/g) || [];
    assert.strictEqual(jailedLogs.length, 2);
  });
});

describe('forged wills', () => {
  test('a forged will is shown for a Serial Killer victim who dies after the Forger acts', () => {
    const state = assignRoles(['forger', 'serialkiller', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 7, 'forger', 1, 3, { will: 'FORGED WILL TEXT' });
    act(state, 9, 'serialkiller', 2, 3);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[3], 'killed by the Serial Killer');
    const d3 = result.deaths.find((d) => d.playerId === 3);
    assert.strictEqual(d3.will, 'FORGED WILL TEXT');
    assert.strictEqual(graveyardEntry(state, 3).willShown, 'FORGED WILL TEXT');
    const ann = engine.getMorningAnnouncement(state);
    assert.strictEqual(ann.deaths[0].will, 'FORGED WILL TEXT');
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
    assert.ok(logText(state).includes('jailed P4 and read their will'));
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

// ---------------------------------------------------------------------------
// Team counts and deck size failsafe
// ---------------------------------------------------------------------------

describe('team counts and deck size', () => {
  test('createGame with teamCounts summing correctly produces a deck of that exact composition', () => {
    const state = engine.createGame({
      playerCount: 12,
      presetId: 'p1',
      teamCounts: { town: 6, mafia: 4, neutral: 2 }
    });
    const p = preview(state);
    assert.strictEqual(p.town.length, 6, 'town slots');
    assert.strictEqual(p.mafia.length, 4, 'mafia slots');
    assert.strictEqual(p.neutral.length, 2, 'neutral slots');
    assert.strictEqual(state.deck.length, 12, 'deck equals the player count');
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length, 12);
  });

  test('teamCounts summing to the wrong total throws', () => {
    assert.throws(() => engine.createGame({
      playerCount: 10,
      presetId: 'p1',
      teamCounts: { town: 7, mafia: 3, neutral: 1 }
    }), /sum to the player count/);
    assert.throws(() => engine.createGame({
      playerCount: 8,
      presetId: 'p1',
      teamCounts: { town: 5, mafia: 2, neutral: 0 }
    }), /sum to the player count/);
  });

  test('teamCounts with negative or non-integer values throws', () => {
    assert.throws(() => engine.createGame({
      playerCount: 8,
      presetId: 'p1',
      teamCounts: { town: 5, mafia: 3, neutral: -1 }
    }), /teamCounts/);
    assert.throws(() => engine.createGame({
      playerCount: 8,
      presetId: 'p1',
      teamCounts: { town: 5.5, mafia: 2, neutral: 0.5 }
    }), /teamCounts/);
  });

  test('a Town list longer than the slot count is truncated top-down', () => {
    const state = engine.createGame({
      playerCount: 10,
      presetId: 'p1',
      teamCounts: { town: 6, mafia: 3, neutral: 1 },
      town: ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'lookout', 'escort', 'retributionist']
    });
    const p = preview(state);
    assert.strictEqual(p.town.length, 6);
    assert.deepStrictEqual(sorted(p.town), ['doctor', 'jailor', 'medium', 'sheriff', 'tracker', 'undertaker']);
  });

  test('a civilian count of 2 with a 5-slot Town team yields 2 civilians and 3 named roles from the top of the list', () => {
    const state = engine.createGame({
      playerCount: 8,
      presetId: 'p1',
      civilians: 2,
      town: ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff']
    });
    const p = preview(state);
    assert.strictEqual(p.town.length, 5);
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 2);
    assert.deepStrictEqual(sorted(p.town.filter((id) => id !== 'civilian')), ['jailor', 'medium', 'undertaker']);
  });

  test('the deck size never exceeds the player count for random teamCounts and list overrides', () => {
    const pools = {
      TOWN: Object.keys(engine.ROLES).filter((id) => engine.ROLES[id].team === 'TOWN'),
      MAFIA: Object.keys(engine.ROLES).filter((id) => engine.ROLES[id].team === 'MAFIA'),
      NEUTRAL: Object.keys(engine.ROLES).filter((id) => engine.ROLES[id].team === 'NEUTRAL')
    };
    for (let trial = 0; trial < 60; trial += 1) {
      const n = 6 + Math.floor(Math.random() * 10); // 6..15
      const town = Math.floor(Math.random() * (n + 1));
      const mafia = Math.floor(Math.random() * (n - town + 1));
      const neutral = n - town - mafia;
      const state = engine.createGame({
        playerCount: n,
        presetId: 'p1',
        teamCounts: { town: town, mafia: mafia, neutral: neutral },
        town: pools.TOWN.slice(0, n + 2),
        mafia: pools.MAFIA.slice(0, n + 2),
        neutral: pools.NEUTRAL.slice(0, n + 2)
      });
      assert.ok(state.deck.length <= n,
        'deck of ' + state.deck.length + ' exceeds ' + n + ' (trial ' + trial + ')');
    }
  });
});

// ---------------------------------------------------------------------------
// Swap roles
// ---------------------------------------------------------------------------

describe('swapRoles', () => {
  test('swaps assignedRole between two players and logs the swap', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    engine.swapRoles(state, 1, 3);
    assert.strictEqual(pid(state, 1).assignedRole, 'godfather');
    assert.strictEqual(pid(state, 3).assignedRole, 'jailor');
    assert.strictEqual(pid(state, 2).assignedRole, 'sheriff');
    assert.ok(logText(state).includes('swapped roles'));
  });

  test('re-assigns the Executioner target when the swapped target is no longer a living Town player', () => {
    const state = assignRoles(['executioner', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian']);
    state.executionerTarget = 2; // the Jailor is the target
    engine.swapRoles(state, 2, 3); // Jailor and Godfather trade: seat 2 is now Mafia
    assert.notStrictEqual(state.executionerTarget, 2);
    const t = pid(state, state.executionerTarget);
    assert.ok(t, 'a new target exists');
    assert.ok(t.isAlive, 'the new target is alive');
    assert.strictEqual(engine.ROLES[t.assignedRole].team, 'TOWN', 'the new target is Town-aligned');
    assert.ok(logText(state).includes('reassigned'));
  });

  test('keeps the Executioner target when the swapped player stays a living Town player', () => {
    const state = assignRoles(['executioner', 'jailor', 'civilian', 'mafioso', 'civilian', 'civilian']);
    state.executionerTarget = 2; // Jailor is the target
    engine.swapRoles(state, 2, 5); // Jailor and Civilian trade: still Town
    assert.strictEqual(state.executionerTarget, 2);
  });

  test('throws for unknown players and self-swaps', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.swapRoles(state, 1, 99), /unknown player/);
    assert.throws(() => engine.swapRoles(state, 1, 1), /themself/);
  });
});
