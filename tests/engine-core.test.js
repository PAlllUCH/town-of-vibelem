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
// Phase E locale helpers
// ---------------------------------------------------------------------------

describe('locale helpers', () => {
  test('roleName and roleBlurb return English text by default', () => {
    engine.setLocale('en');
    assert.strictEqual(engine.roleName('demon'), engine.ROLES.demon.name);
    assert.strictEqual(engine.roleBlurb('demon'), engine.ROLES.demon.blurb);
  });

  test('switches role names between English and Polish', () => {
    engine.setLocale('en');
    const english = engine.roleName('sheriff');
    engine.setLocale('pl');
    assert.strictEqual(engine.roleName('sheriff'), engine.ROLES.sheriff.namePl);
    assert.notStrictEqual(engine.roleName('sheriff'), english);
    engine.setLocale('en');
    assert.strictEqual(engine.roleName('sheriff'), english);
  });

  test('all Phase E roles have Polish names', () => {
    for (const id of [
      'innkeeper', 'demon', 'imp', 'outcast', 'possessed',
      'succubus', 'necromant', 'leper'
    ]) {
      assert.ok(engine.ROLES[id], id);
      assert.strictEqual(typeof engine.ROLES[id].namePl, 'string', id);
      assert.ok(engine.ROLES[id].namePl.length > 0, id);
    }
  });

  test('every role has non-empty Polish name and blurb', () => {
    for (const id of Object.keys(engine.ROLES)) {
      const role = engine.ROLES[id];
      assert.strictEqual(typeof role.namePl, 'string', id);
      assert.ok(role.namePl.length > 0, id);
      assert.strictEqual(typeof role.blurbPl, 'string', id);
      assert.ok(role.blurbPl.length > 0, id);
    }
  });

  test('roleBlurb returns Polish text in pl locale and falls back to English when blurbPl is missing', () => {
    engine.setLocale('pl');
    assert.strictEqual(engine.roleBlurb('sheriff', 'pl'), engine.ROLES.sheriff.blurbPl);
    const original = engine.ROLES;
    engine.ROLES = { sheriff: { name: original.sheriff.name, blurb: original.sheriff.blurb } };
    try {
      assert.strictEqual(engine.roleBlurb('sheriff', 'pl'), original.sheriff.blurb);
      assert.strictEqual(engine.roleBlurb('unknown-role', 'pl'), 'unknown-role');
    } finally {
      engine.ROLES = original;
    }
    assert.strictEqual(engine.roleBlurb('sheriff', 'en'), engine.ROLES.sheriff.blurb);
    engine.setLocale('en');
  });
});

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
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 0);
    assert.ok(p.town.includes('oracle'));
    assert.ok(p.town.includes('witness'));
    assert.strictEqual(p.mafia.length, 4);
    assert.strictEqual(p.neutral.length, 2);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length, 15);
  });

  test('town overflow also applies to shorter town lists (15 players, preset p2)', () => {
    const p = preview(engine.createGame({ playerCount: 15, presetId: 'p2' }));
    assert.strictEqual(p.town.length, 9);
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 0);
    assert.ok(p.town.includes('oracle'));
    assert.ok(p.town.includes('washerwoman'));
    assert.ok(p.town.includes('witness'));
  });

  test('Oracle reaches every preset from 13 players, and Presets 2-6 also from 11', () => {
    for (const presetId of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 13, presetId })).town.includes('oracle'));
    }
    for (const presetId of ['p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 11, presetId })).town.includes('oracle'));
    }
    assert.ok(!preview(engine.createGame({ playerCount: 11, presetId: 'p1' })).town.includes('oracle'));
  });

  test('preset town priority lists match the GDD', () => {
    assert.deepStrictEqual(engine.PRESETS.p1.town, ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p2.town, ['jailor', 'doctor', 'sheriff', 'lookout', 'escort', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef', 'innkeeper']);
    assert.deepStrictEqual(engine.PRESETS.p3.town, ['jailor', 'deputy', 'veteran', 'vigilante', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef', 'innkeeper']);
    assert.deepStrictEqual(engine.PRESETS.p4.town, ['jailor', 'mayor', 'doctor', 'sheriff', 'lookout', 'tracker', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p5.town, ['jailor', 'sheriff', 'undertaker', 'medium', 'doctor', 'retributionist', 'oracle', 'witness', 'washerwoman', 'chef']);
    assert.deepStrictEqual(engine.PRESETS.p6.town, ['jailor', 'vigilante', 'veteran', 'deputy', 'doctor', 'escort', 'oracle', 'witness', 'washerwoman', 'chef', 'innkeeper']);
  });

  test('Blank preset is a lean core that fills leftovers with Civilians', () => {
    assert.deepStrictEqual(engine.PRESETS.blank.town, ['jailor', 'doctor', 'sheriff']);
    assert.deepStrictEqual(engine.PRESETS.blank.mafia, ['godfather', 'mafioso']);
    assert.deepStrictEqual(engine.PRESETS.blank.neutral, ['jester']);
    const p = preview(engine.createGame({ playerCount: 8, presetId: 'blank' }));
    assert.ok(p.town.includes('jailor'));
    assert.ok(p.town.includes('doctor'));
    assert.ok(p.town.includes('sheriff'));
    assert.strictEqual(p.town.filter((r) => r === 'civilian').length, 2);
    assert.deepStrictEqual(sorted(p.mafia), ['godfather', 'mafioso']);
    assert.deepStrictEqual(sorted(p.neutral), ['jester']);
  });

  test('Blank preset is valid at every player count and only Civilians repeat', () => {
    for (let n = 6; n <= 15; n += 1) {
      const p = preview(engine.createGame({ playerCount: n, presetId: 'blank' }));
      const all = p.town.concat(p.mafia, p.neutral);
      assert.strictEqual(all.length, n, 'deck length at ' + n);
      const nonCiv = all.filter((id) => id !== 'civilian');
      assert.strictEqual(new Set(nonCiv).size, nonCiv.length, 'no repeats at ' + n);
    }
  });

  test('Framer is preset p4 slot 3 and enters the deck once 3+ Mafia slots exist', () => {
    assert.deepStrictEqual(engine.PRESETS.p4.mafia, ['godfather', 'mafioso', 'framer', 'consigliere']);
    assert.ok(preview(engine.createGame({ playerCount: 14, presetId: 'p4' })).mafia.includes('framer'));
    assert.ok(preview(engine.createGame({ playerCount: 10, presetId: 'p4' })).mafia.includes('framer'));
    assert.ok(!preview(engine.createGame({ playerCount: 8, presetId: 'p4' })).mafia.includes('framer'));
  });

  test('Witness enters every preset at 14 players, and Presets 2-6 also from 13', () => {
    for (const presetId of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 14, presetId })).town.includes('witness'));
    }
    for (const presetId of ['p2', 'p3', 'p4', 'p5', 'p6']) {
      assert.ok(preview(engine.createGame({ playerCount: 13, presetId })).town.includes('witness'));
    }
    assert.ok(!preview(engine.createGame({ playerCount: 13, presetId: 'p1' })).town.includes('witness'));
    assert.ok(!preview(engine.createGame({ playerCount: 12, presetId: 'p2' })).town.includes('witness'));
  });

  test('Blackmailer is preset p5 slot 4 and enters the deck at 4 Mafia slots', () => {
    assert.deepStrictEqual(engine.PRESETS.p5.mafia, ['godfather', 'mafioso', 'poisoner', 'blackmailer']);
    assert.ok(preview(engine.createGame({ playerCount: 14, presetId: 'p5' })).mafia.includes('blackmailer'));
    assert.ok(!preview(engine.createGame({ playerCount: 10, presetId: 'p5' })).mafia.includes('blackmailer'));
  });

  test('the deck always matches the player count and only Civilians may repeat (6-15, all presets)', () => {
    for (let n = 6; n <= 15; n += 1) {
      for (const presetId of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
        const p = preview(engine.createGame({ playerCount: n, presetId }));
        const all = p.town.concat(p.mafia, p.neutral);
        assert.strictEqual(all.length, n);
        const nonCivilian = all.filter((id) => id !== 'civilian');
        assert.strictEqual(new Set(nonCivilian).size, nonCivilian.length);
      }
    }
  });
});

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
    assert.deepStrictEqual(sorted(preview(state).town), ['doctor', 'mayor', 'sheriff', 'veteran', 'vigilante']);
  });

  test('a short town override is padded with Civilians', () => {
    const state = engine.createGame({ playerCount: 8, presetId: 'p1', town: ['doctor'] });
    const p = preview(state);
    assert.strictEqual(p.town.length, 5);
    assert.ok(p.town.includes('doctor'));
    assert.strictEqual(p.town.filter((id) => id === 'civilian').length, 4);
  });

  test('teamCounts demanding more unique Mafia roles than exist throws', () => {
    assert.throws(
      () => engine.createGame({ playerCount: 15, presetId: 'p1', teamCounts: { town: 2, mafia: 12, neutral: 1 } }),
      /unique MAFIA roles/
    );
  });

  test('teamCounts demanding more unique Neutral roles than exist throws', () => {
    const uniqueNeutral = Object.keys(engine.ROLES).filter((id) => engine.ROLES[id].team === 'NEUTRAL').length;
    assert.throws(
      () => engine.createGame({
        playerCount: 15, presetId: 'p1',
        teamCounts: { town: 2, mafia: 1, neutral: 12 },
        neutral: []
      }),
      /unique NEUTRAL roles/
    );
    assert.ok(uniqueNeutral < 12);
  });
});

describe('EVIL custom deck overrides', () => {
  test('a custom neutral override may contain EVIL roles and previews them in the evil bucket', () => {
    const state = engine.createGame({ playerCount: 8, presetId: 'p1', neutral: ['demon'] });
    const p = preview(state);
    assert.deepStrictEqual(p.evil, ['demon']);
    assert.deepStrictEqual(p.neutral, []);
    assert.strictEqual(p.town.length, 5);
    assert.strictEqual(p.mafia.length, 2);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length + p.evil.length, 8);
  });

  test('a short neutral override pads with Neutral roles while keeping the EVIL pick', () => {
    const state = engine.createGame({ playerCount: 12, presetId: 'p1', neutral: ['demon'] });
    const p = preview(state);
    assert.deepStrictEqual(p.evil, ['demon']);
    assert.deepStrictEqual(sorted(p.neutral), ['amnesiac']);
    assert.strictEqual(p.town.length, 7);
    assert.strictEqual(p.mafia.length, 3);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length + p.evil.length, 12);
  });

  test('an explicit evil override list feeds the evil bucket from the neutral slots', () => {
    const state = engine.createGame({
      playerCount: 12, presetId: 'p1',
      mafia: ['godfather', 'mafioso', 'consort'],
      neutral: [],
      evil: ['succubus', 'demon']
    });
    const p = preview(state);
    assert.deepStrictEqual(sorted(p.evil), ['demon', 'succubus']);
    assert.deepStrictEqual(p.neutral, []);
    assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length + p.evil.length, 12);
  });

  test('EVIL picks truncate away when the ratio has no neutral slots', () => {
    for (const n of [6, 7]) {
      const state = engine.createGame({ playerCount: n, presetId: 'p1', neutral: ['demon'] });
      const p = preview(state);
      assert.deepStrictEqual(p.evil, [], 'count ' + n);
      assert.strictEqual(p.town.length + p.mafia.length + p.neutral.length + p.evil.length, n, 'count ' + n);
    }
  });

  test('decks with EVIL picks hold ratio math and the only-Civilians-repeat rule from 6 to 15 players', () => {
    for (let n = 6; n <= 15; n += 1) {
      const state = engine.createGame({ playerCount: n, presetId: 'p1', neutral: ['demon'] });
      const p = preview(state);
      const all = p.town.concat(p.mafia, p.neutral, p.evil);
      assert.strictEqual(all.length, n, 'count ' + n);
      const nonCivilian = all.filter((id) => id !== 'civilian');
      assert.strictEqual(new Set(nonCivilian).size, nonCivilian.length, 'count ' + n);
      assert.strictEqual(p.evil.length, Math.min(1, engine.RATIO_TABLE[n].neutral), 'count ' + n);
      assert.doesNotThrow(() => engine.dealRoles(state), 'count ' + n);
    }
  });
});

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
    assert.ok(state.playerLog['1'].some((e) => e.kind === 'night-action' && e.at === 'N1' && e.text.includes('P3')));
  });

  test('re-recording the same action does not duplicate the night-action entry', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    act(state, 6, 'godfather', 1, 3);
    assert.strictEqual(state.playerLog['1'].filter((e) => e.kind === 'night-action').length, 1);
  });

  test('a wizard-back re-record with a changed target keeps exactly one night-action entry', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    act(state, 6, 'godfather', 1, 4);
    const entries = state.playerLog['1'].filter((e) => e.kind === 'night-action');
    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].text.includes('P4'));
    assert.ok(!entries[0].text.includes('P3'));
  });

  test('a night kill writes a death entry with the deathLog cause', () => {
    const state = assignRoles(['godfather', 'mafioso', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 6, 'godfather', 1, 3);
    night(state);
    assert.ok(state.playerLog['3'].some((e) => e.kind === 'death' && e.at === 'N1' && e.text.includes('killed by the Mafia')));
  });

  test('a lynch writes death and lynched entries', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'], { houseRules: { noLynchD1: false } });
    engine.beginDay(state);
    assert.ok(engine.startTrial(state, 6, 1));
    [1, 2, 3, 4].forEach((id) => engine.castVote(state, { voterId: id, verdict: 'AGREE' }));
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    [1, 2].forEach((id) => engine.castVote(state, { voterId: id, verdict: 'GUILTY' }));
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    [1, 2, 3, 4, 5].forEach((id) => engine.castVote(state, { voterId: id, verdict: 'GUILTY' }));
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
    assert.ok(target && target.isAlive);
    assert.strictEqual(engine.ROLES[target.assignedRole].team, 'TOWN');
    assert.strictEqual(state.gfBluffs.length, 3);
    state.gfBluffs.forEach((b) => {
      assert.strictEqual(engine.ROLES[b].team, 'TOWN');
      assert.ok(state.deck.indexOf(b) === -1);
    });
    assert.ok(logText(state).includes('Roles assigned.'));
  });

  test('civilian repeats are allowed', () => {
    const state = assignRoles(['jailor', 'civilian', 'civilian', 'civilian', 'godfather', 'mafioso']);
    engine.assignRoles(state, { 1: 'jailor', 2: 'civilian', 3: 'civilian', 4: 'civilian', 5: 'godfather', 6: 'mafioso' });
    assert.strictEqual(state.phase, 'SEATS');
  });

  test('throws when a seat is missing', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.assignRoles(state, { 1: 'jailor', 2: 'sheriff', 3: 'godfather', 5: 'civilian', 6: 'civilian' }), /seat 4 is missing/);
  });

  test('throws when a role is not in the deck', () => {
    const state = assignRoles(['sheriff', 'doctor', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.assignRoles(state, { 1: 'jailor', 2: 'doctor', 3: 'godfather', 4: 'mafioso', 5: 'civilian', 6: 'civilian' }), /role jailor is not in the deck/);
  });

  test('throws when the assigned multiset differs from the deck', () => {
    const state = assignRoles(['jailor', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    assert.throws(() => engine.assignRoles(state, { 1: 'jailor', 2: 'sheriff', 3: 'godfather', 4: 'mafioso', 5: 'sheriff', 6: 'civilian' }), /do not match the deck/);
  });
});

describe('deserialize transient defaults (regression)', () => {
  test('restores omitted trial, morning, ghost, and player transient fields', () => {
    const state = assignRoles(['sheriff', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather']);
    const legacy = JSON.parse(engine.serialize(state));
    delete legacy.trial.dayTrialsDone;
    delete legacy.ghosts;
    delete legacy.morning.blackmailTarget;
    legacy.players.forEach((p) => {
      ['hasGhostVote', 'ghostVoteSpent', 'revealed', 'shotsFired', 'executionsUsed', 'alertsUsed', 'usedOncePerGame', 'guiltPending', 'inheritedRole', 'isRoleblocked', 'isProtected', 'framed', 'blackmailed', 'isDrunk', 'nightTarget', 'jailorDecision'].forEach((f) => delete p[f]);
    });
    const restored = engine.deserialize(JSON.stringify(legacy));
    assert.strictEqual(restored.trial.dayTrialsDone, 0);
    assert.ok(restored.ghosts && typeof restored.ghosts === 'object');
    assert.strictEqual(restored.morning.blackmailTarget, null);
    restored.players.forEach((p) => {
      assert.strictEqual(p.hasGhostVote, false);
      assert.strictEqual(p.ghostVoteSpent, false);
      assert.strictEqual(p.revealed, false);
      assert.strictEqual(p.shotsFired, 0);
      assert.strictEqual(p.executionsUsed, 0);
      assert.strictEqual(p.alertsUsed, 0);
      assert.strictEqual(p.usedOncePerGame, false);
      assert.strictEqual(p.guiltPending, false);
      assert.strictEqual(p.inheritedRole, null);
      assert.strictEqual(p.isRoleblocked, false);
      assert.strictEqual(p.isProtected, false);
      assert.strictEqual(p.framed, false);
      assert.strictEqual(p.blackmailed, false);
      assert.strictEqual(p.isDrunk, false);
      assert.strictEqual(p.nightTarget, null);
      assert.strictEqual(p.jailorDecision, null);
    });
    assert.ok(engine.startTrial(restored, 6, 1));
  });
});

describe('localization', () => {
  test('E.localized resolves strings and maps per locale with en fallback', () => {
    assert.strictEqual(engine.localized('plain', 'pl'), 'plain');
    assert.strictEqual(engine.localized({ en: 'A', pl: 'B' }, 'en'), 'A');
    assert.strictEqual(engine.localized({ en: 'A', pl: 'B' }, 'pl'), 'B');
    assert.strictEqual(engine.localized({ en: 'A', pl: 'B' }, 'de'), 'A', 'unknown locale falls back to en');
    assert.strictEqual(engine.localized({ en: 'A', pl: 'B' }), 'A', 'undefined locale falls back to en');
    assert.strictEqual(engine.localized(null, 'pl'), '');
  });

  test('E.str is locale-key driven and falls back to en', () => {
    assert.strictEqual(engine.str('outstandingTitle', 'pl'), 'Zaległe akcje nocy');
    assert.strictEqual(engine.str('outstandingTitle', 'de'), 'Outstanding Night Actions');
  });

  test('preset name and tagline are localized maps resolved per locale', () => {
    const b = engine.PRESETS.blank;
    assert.deepStrictEqual(Object.keys(b.name).sort(), ['en', 'pl']);
    assert.strictEqual(engine.localized(b.name, 'pl'), 'Czysta Tablica');
    assert.strictEqual(engine.localized(b.name, 'en'), 'Blank Slate');
    assert.notStrictEqual(engine.localized(b.tagline, 'pl'), engine.localized(b.tagline, 'en'));
    assert.ok(engine.localized(b.tagline, 'pl').includes('Więziennik'));
    assert.strictEqual(engine.localized(engine.PRESETS.p1.name, 'pl'), 'Szepty z Kostnicy');
    assert.strictEqual(engine.localized(engine.PRESETS.p1.name, 'en'), 'Whispers from the Morgue');
  });

  test('E.roleName/E.roleBlurb tolerate unknown locales and fall back to base text', () => {
    assert.strictEqual(engine.roleName('jailor', 'de'), engine.ROLES.jailor.name);
    assert.strictEqual(engine.roleName('jailor', 'pl'), engine.ROLES.jailor.namePl);
    assert.strictEqual(engine.roleBlurb('jailor', 'de'), engine.ROLES.jailor.blurb);
  });
});
