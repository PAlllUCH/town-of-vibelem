'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../js/engine.js');
const {
  pid, roleIdByName, assignRoles, act, night, sorted, preview,
  logText, aliveIds, deathCauses, graveyardEntry, dealExact
} = require('./helpers.js');

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
    // The 10-role Town list covers all 9 slots: the tail roles displace Civilians.
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 0);
    assert.ok(p.town.includes('oracle'), 'Oracle should fill an 8th Town slot at 15 players');
    assert.ok(p.town.includes('witness'), 'Witness should fill the 9th Town slot at 15 players');
    assert.strictEqual(p.mafia.length, 4);
    assert.strictEqual(p.neutral.length, 2);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length, 15);
  });

  test('town overflow also applies to shorter town lists (15 players, preset p2)', () => {
    const p = preview(engine.createGame({ playerCount: 15, presetId: 'p2' }));
    assert.strictEqual(p.town.length, 9);
    // The 9-role Town list covers all 9 slots exactly: no Civilians are needed.
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 0);
    assert.ok(p.town.includes('oracle'));
    assert.ok(p.town.includes('washerwoman'));
    assert.ok(p.town.includes('witness'), 'Witness should fill the 9th Town slot in preset p2 at 15 players');
  });

  test('Oracle reaches every preset from 13 players, and Presets 2-6 also from 11', () => {
    for (const presetId of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 13, presetId })).town.includes('oracle'), '13p ' + presetId);
    }
    for (const presetId of ['p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 11, presetId })).town.includes('oracle'), '11p ' + presetId);
    }
    assert.ok(!preview(engine.createGame({ playerCount: 11, presetId: 'p1' })).town.includes('oracle'), 'p1 @ 11');
  });

  test('preset town priority lists match the GDD', () => {
    assert.deepStrictEqual(engine.PRESETS.p1.town, ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p2.town, ['jailor', 'doctor', 'sheriff', 'lookout', 'escort', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p3.town, ['jailor', 'deputy', 'veteran', 'vigilante', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p4.town, ['jailor', 'mayor', 'doctor', 'sheriff', 'lookout', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p5.town, ['jailor', 'sheriff', 'undertaker', 'medium', 'doctor', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p6.town, ['jailor', 'vigilante', 'veteran', 'deputy', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef']);
  });

  test('Framer is preset p4 slot 3 and enters the deck once 3+ Mafia slots exist', () => {
    assert.deepStrictEqual(engine.PRESETS.p4.mafia, ['godfather', 'mafioso', 'framer', 'consigliere']);
    assert.ok(preview(engine.createGame({ playerCount: 14, presetId: 'p4' })).mafia.includes('framer'));
    assert.ok(preview(engine.createGame({ playerCount: 10, presetId: 'p4' })).mafia.includes('framer'));
    assert.ok(!preview(engine.createGame({ playerCount: 8, presetId: 'p4' })).mafia.includes('framer'));
  });

  test('Witness enters every preset at 14 players, and Presets 2-6 also from 13', () => {
    for (const presetId of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 14, presetId })).town.includes('witness'), '14p ' + presetId);
    }
    for (const presetId of ['p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 13, presetId })).town.includes('witness'), '13p ' + presetId);
    }
    assert.ok(!preview(engine.createGame({ playerCount: 13, presetId: 'p1' })).town.includes('witness'), 'p1 @ 13');
    assert.ok(!preview(engine.createGame({ playerCount: 12, presetId: 'p2' })).town.includes('witness'), 'p2 @ 12');
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
// playerLog (per-player detail sheet)
// ---------------------------------------------------------------------------

describe('playerLog', () => {
  test('assignRoles writes a set entry per player', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    engine.assignRoles(state, {
      1: 'sheriff', 2: 'civilian', 3: 'civilian', 4: 'civilian', 5: 'civilian', 6: 'godfather'
    });
    assert.ok(state.playerLog['1'].some((e) => e.kind === 'set' && e.at === 'SETUP'));
    assert.ok(state.playerLog['6'].some((e) => e.kind === 'set' && e.text.includes('Godfather')));
  });

  test('a recorded night action writes a night-action entry', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    assert.ok(state.playerLog['1'].some((e) =>
      e.kind === 'night-action' && e.at === 'N1' && e.text.includes('P3')));
  });

  test('re-recording the same action does not duplicate the night-action entry', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    act(state, 6, 'godfather', 1, 3);
    const entries = state.playerLog['1'].filter((e) => e.kind === 'night-action');
    assert.strictEqual(entries.length, 1);
  });

  test('a wizard-back re-record with a changed target keeps exactly one night-action entry', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    act(state, 6, 'godfather', 1, 4);
    const entries = state.playerLog['1'].filter((e) => e.kind === 'night-action');
    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].text.includes('P4'), 'the surviving row must describe the newest target');
    assert.ok(!entries[0].text.includes('P3'), 'the stale target must not survive');
  });

  test('a night kill writes a death entry with the deathLog cause', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    night(state);
    assert.ok(state.playerLog['3'].some((e) =>
      e.kind === 'death' && e.at === 'N1' && e.text.includes('killed by the Mafia')));
  });

  test('a lynch writes death and lynched entries', () => {
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
    assert.ok(state.playerLog['6'].some((e) => e.kind === 'death' && e.at === 'D1'));
    assert.ok(state.playerLog['6'].some((e) => e.kind === 'lynched'));
  });

  test('swapRoles writes swap entries for both players', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    engine.swapRoles(state, 1, 3);
    assert.ok(state.playerLog['1'].some((e) => e.kind === 'swap' && e.at === 'SETUP' && e.text.includes('Godfather')));
    assert.ok(state.playerLog['3'].some((e) => e.kind === 'swap' && e.at === 'SETUP' && e.text.includes('Jailor')));
  });

  test('deserialize defaults playerLog for old saves and the game still plays', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    const legacy = JSON.parse(engine.serialize(state));
    delete legacy.playerLog;
    delete legacy.trial.stage;
    delete legacy.trial.seconds;
    const restored = engine.deserialize(JSON.stringify(legacy));
    assert.deepStrictEqual(restored.playerLog, {});
    assert.strictEqual(restored.trial.stage, null);
    assert.deepStrictEqual(restored.trial.seconds, []);
    assert.ok(engine.startTrial(restored, 6, 1));
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


describe('assignRoles', () => {
  test('valid full assignment assigns each seat, sets phase to SEATS and runs setup info', () => {
    const state = assignRoles(['executioner', 'jailor', 'civilian', 'godfather', 'mafioso', 'civilian']);
    engine.assignRoles(state, {
      1: 'executioner', 2: 'jailor', 3: 'civilian',
      4: 'godfather', 5: 'mafioso', 6: 'civilian'
    });
    assert.strictEqual(state.phase, 'SEATS');
    assert.strictEqual(pid(state, 1).assignedRole, 'executioner');
    assert.strictEqual(pid(state, 2).assignedRole, 'jailor');
    assert.strictEqual(pid(state, 3).assignedRole, 'civilian');
    assert.strictEqual(pid(state, 4).assignedRole, 'godfather');
    assert.strictEqual(pid(state, 5).assignedRole, 'mafioso');
    assert.strictEqual(pid(state, 6).assignedRole, 'civilian');
    const target = pid(state, state.executionerTarget);
    assert.ok(target, 'executioner target is set');
    assert.ok(target.isAlive, 'executioner target is alive');
    assert.strictEqual(engine.ROLES[target.assignedRole].team, 'TOWN');
    assert.strictEqual(state.gfBluffs.length, 3, 'Godfather gets 3 bluffs');
    state.gfBluffs.forEach((b) => {
      assert.strictEqual(engine.ROLES[b].team, 'TOWN', 'bluff is a Town role');
      assert.ok(state.deck.indexOf(b) === -1, 'bluff is not in the deck');
    });
    assert.ok(logText(state).includes('Roles assigned.'));
  });

  test('civilian repeats are allowed', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'godfather', 'mafioso']);
    engine.assignRoles(state, {
      1: 'jailor', 2: 'civilian', 3: 'civilian', 4: 'civilian', 5: 'godfather', 6: 'mafioso'
    });
    assert.strictEqual(pid(state, 2).assignedRole, 'civilian');
    assert.strictEqual(pid(state, 3).assignedRole, 'civilian');
    assert.strictEqual(pid(state, 4).assignedRole, 'civilian');
    assert.strictEqual(state.phase, 'SEATS');
  });

  test('throws when a seat is missing', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.assignRoles(state, {
      1: 'jailor', 2: 'sheriff', 3: 'godfather', 5: 'civilian', 6: 'civilian'
    }), /seat 4 is missing/);
  });

  test('throws when a role is not in the deck', () => {
    const state = assignRoles(['sheriff', 'doctor', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.assignRoles(state, {
      1: 'jailor', 2: 'doctor', 3: 'godfather', 4: 'mafioso', 5: 'civilian', 6: 'civilian'
    }), /role jailor is not in the deck/);
  });

  test('throws when the assigned multiset differs from the deck', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.assignRoles(state, {
      1: 'jailor', 2: 'sheriff', 3: 'godfather', 4: 'mafioso', 5: 'sheriff', 6: 'civilian'
    }), /do not match the deck/);
  });
});
