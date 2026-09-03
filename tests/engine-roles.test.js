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
// Phase E roles
// ---------------------------------------------------------------------------

describe('Phase E roles', () => {
  test('Lookout sees every visitor to the watched player', () => {
    const state = assignRoles(['lookout', 'civilian', 'doctor', 'godfather', 'mafioso', 'civilian']);
    act(state, 5, 'doctor', 3, 2);
    act(state, 6, 'godfather', 4, 2);
    act(state, 11, 'lookout', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Lookout) watches P2: P3, P4.'));
  });

  test('Tracker learns the target of the tracked player', () => {
    const state = assignRoles(['tracker', 'civilian', 'doctor', 'godfather', 'mafioso', 'civilian']);
    act(state, 5, 'doctor', 3, 2);
    act(state, 11, 'tracker', 1, 3);
    night(state);
    assert.ok(logText(state).includes('(Tracker) tracks P3: P2.'));
  });

  test('Escort roleblocks the Mafia kill when no Mafioso exists', () => {
    const state = assignRoles(['escort', 'godfather', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 4, 'escort', 1, 2);
    act(state, 6, 'godfather', 2, 4);
    night(state);
    assert.ok(!logText(state).includes('killed by the Mafia'));
  });

  test('Veteran on alert kills visitors', () => {
    const state = assignRoles(['veteran', 'godfather', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 0, 'veteran', 1, null, { alert: true });
    act(state, 6, 'godfather', 2, 1);
    night(state);
    assert.strictEqual(pid(state, 2).isAlive, false);
    assert.strictEqual(pid(state, 1).isAlive, true);
  });

  test('Witch redirects a selected player', () => {
    const state = assignRoles(['witch', 'godfather', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 1, 2, { controlRedirect: 4 });
    act(state, 6, 'godfather', 2, 3);
    night(state);
    assert.strictEqual(pid(state, 3).isAlive, true);
    assert.strictEqual(pid(state, 4).isAlive, false);
  });

  test('all Phase E roles are present in the role catalog', () => {
    [
      'innkeeper', 'leper', 'outcast', 'succubus', 'necromant',
      'demon', 'imp', 'possessed'
    ].forEach((role) => assert.ok(engine.ROLES[role]));
  });
});

describe('Innkeeper', () => {
  test('shields the guest from one basic Mafia kill and is consumed', () => {
    const state = assignRoles(['innkeeper', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 4, 'innkeeper', 1, 4);
    act(state, 6, 'godfather', 2, 4);
    night(state);
    assert.strictEqual(pid(state, 4).isAlive, true);
    assert.strictEqual(pid(state, 1).protectedByInnkeeper, true);
    assert.strictEqual(pid(state, 4).protectedByInnkeeper, true);
    act(state, 6, 'godfather', 2, 4);
    const result = night(state);
    assert.strictEqual(pid(state, 4).isAlive, false);
    assert.strictEqual(deathCauses(result)[4], 'killed by the Mafia');
  });

  test('a roleblocked guest loses their action but no one is saved from kills', () => {
    const state = assignRoles(['innkeeper', 'sheriff', 'godfather', 'mafioso', 'civilian', 'civilian']);
    act(state, 4, 'innkeeper', 1, 2);
    act(state, 11, 'sheriff', 2, 3);
    act(state, 6, 'godfather', 3, 5);
    night(state);
    assert.ok(state.playerLog['2'].some((e) =>
      e.kind === 'info' && e.text === 'Sheriff check on P3: no result (roleblocked).'));
    assert.ok(!logText(state).includes('(Sheriff) checks'));
    assert.strictEqual(pid(state, 5).isAlive, false);
  });

  test('a killer guest attacking the protected innkeeper is blocked', () => {
    const state = assignRoles(['innkeeper', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    act(state, 4, 'innkeeper', 1, 2);
    act(state, 6, 'godfather', 2, 1);
    night(state);
    assert.strictEqual(pid(state, 1).isAlive, true);
    assert.strictEqual(pid(state, 1).isProtected, true);
    assert.strictEqual(pid(state, 2).isRoleblocked, true);
  });
});

describe('Leper', () => {
  test('visitors are Drunk the following night and recover the night after', () => {
    const state = assignRoles(['sheriff', 'leper', 'doctor', 'godfather', 'mafioso', 'civilian']);
    act(state, 5, 'doctor', 3, 2);
    act(state, 6, 'godfather', 4, 2);
    act(state, 11, 'sheriff', 1, 2);
    night(state);
    assert.strictEqual(pid(state, 2).isAlive, true);
    assert.strictEqual(pid(state, 1).isDrunk, true);
    assert.strictEqual(pid(state, 1).leperDrunkUntil, 2);
    act(state, 11, 'sheriff', 1, 5);
    night(state);
    assert.ok(logText(state).includes('P1 (Sheriff) checks P5: INNOCENT.'));
    act(state, 11, 'sheriff', 1, 5);
    night(state);
    assert.ok(logText(state).includes('P1 (Sheriff) checks P5: SUSPICIOUS.'));
  });
});

describe('Succubus', () => {
  test('enchant flags the target and restricts a Guilty vote at the next day verdict', () => {
    const state = assignRoles(['succubus', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 11, 'succubus', 1, 2);
    night(state);
    assert.strictEqual(pid(state, 2).enchanted, true);
    assert.strictEqual(pid(state, 2).enchantedBy, 'succubus');
    assert.strictEqual(engine.startTrial(state, 1, 3), true);
    [2, 3, 4, 5, 6].forEach((id) => assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'AGREE' }), true));
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    engine.castVote(state, { voterId: 2, verdict: 'GUILTY' });
    engine.castVote(state, { voterId: 3, verdict: 'GUILTY' });
    assert.strictEqual(state.trial.votes.find((v) => v.voterId === 2).verdict, 'ABSTAIN');
    assert.strictEqual(state.trial.votes.find((v) => v.voterId === 3).verdict, 'GUILTY');
  });

  test('enchant flags clear on the following night', () => {
    const state = assignRoles(['succubus', 'civilian', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 11, 'succubus', 1, 2);
    night(state);
    assert.strictEqual(pid(state, 2).enchantedBy, 'succubus');
    night(state);
    assert.strictEqual(pid(state, 2).enchanted, false);
    assert.strictEqual(pid(state, 2).enchantedBy, null);
  });
});

describe('Necromant', () => {
  test('borrows a dead Sheriff check once and produces a real result', () => {
    const state = assignRoles(['necromant', 'sheriff', 'mafioso', 'civilian', 'civilian', 'civilian']);
    engine._recordDeath(state, 2, 'killed in the night', false, true);
    act(state, 12, 'necromant', 1, 2, { livingTarget: 3 });
    night(state);
    assert.ok(logText(state).includes('P1 (Sheriff) checks P3: SUSPICIOUS.'));
    assert.ok(logText(state).includes("P1 (Necromant) borrowed the night ability of the corpse's role."));
    assert.strictEqual(pid(state, 1).usedOncePerGame, true);
    assert.strictEqual(state.necromant.used, true);
    assert.strictEqual(state.necromant.rememberedRole, 'sheriff');
    assert.ok(!engine.getNightSteps(state).some((s) =>
      s.position === 12 && s.roles.includes('necromant')));
  });

  test('a second borrow is impossible after the use is spent', () => {
    const state = assignRoles(['necromant', 'sheriff', 'mafioso', 'civilian', 'civilian', 'civilian']);
    engine._recordDeath(state, 2, 'killed in the night', false, true);
    act(state, 12, 'necromant', 1, 2, { livingTarget: 3 });
    night(state);
    assert.strictEqual((logText(state).match(/borrowed the night ability/g) || []).length, 1);
    act(state, 12, 'necromant', 1, 2, { livingTarget: 4 });
    night(state);
    assert.strictEqual((logText(state).match(/borrowed the night ability/g) || []).length, 1);
  });

  test('refuses corpses on the blocklist and burns the once-per-game use', () => {
    const state = assignRoles(['necromant', 'civilian', 'jester', 'civilian', 'civilian', 'civilian']);
    engine._recordDeath(state, 2, 'killed in the night', false, true);
    engine._recordDeath(state, 3, 'killed in the night', false, true);
    act(state, 12, 'necromant', 1, 2);
    night(state);
    assert.ok(logText(state).includes("P1 (Necromant) cannot borrow the role of the corpse."));
    assert.strictEqual(pid(state, 1).usedOncePerGame, true);
    assert.strictEqual(state.necromant.used, true);
    assert.strictEqual(state.necromant.rememberedRole, 'civilian');
    assert.ok(!logText(state).includes('borrowed the night ability'));
  });
});

describe('Demon', () => {
  test('resolves a basic kill that Doctor protection can block', () => {
    const state = assignRoles(['demon', 'doctor', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 5, 'doctor', 2, 4);
    act(state, 9, 'demon', 1, 4);
    night(state);
    assert.strictEqual(pid(state, 4).isAlive, true);
    act(state, 9, 'demon', 1, 5);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[5], 'killed by the Demon');
  });

  test('Witch control redirects the Demon kill', () => {
    const state = assignRoles(['demon', 'witch', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 2, 'witch', 2, 1, { controlRedirect: 4 });
    act(state, 9, 'demon', 1, 3);
    night(state);
    assert.strictEqual(pid(state, 3).isAlive, true);
    assert.strictEqual(pid(state, 4).isAlive, false);
  });

  test('reads INNOCENT to the Sheriff', () => {
    const state = assignRoles(['sheriff', 'demon', 'civilian', 'civilian', 'civilian', 'civilian']);
    act(state, 11, 'sheriff', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P2: INNOCENT.'));
  });
});

describe('Imp succession', () => {
  test('while the Demon lives the Imp has no kill step', () => {
    const state = assignRoles(['demon', 'imp', 'civilian', 'civilian', 'veteran', 'civilian']);
    const steps = engine.getNightSteps(state);
    assert.ok(steps.some((s) => s.position === 9 && s.roles.includes('demon')));
    assert.ok(!steps.some((s) => s.roles.includes('imp')));
  });

  test('after the Demon falls the Imp gains the position 9 step and its kill resolves', () => {
    const state = assignRoles(['demon', 'imp', 'civilian', 'civilian', 'veteran', 'civilian']);
    act(state, 0, 'veteran', 5, null, { alert: true });
    act(state, 9, 'demon', 1, 5);
    night(state);
    assert.strictEqual(pid(state, 1).isAlive, false);
    assert.strictEqual(pid(state, 2).inheritedRole, 'demon');
    assert.ok(engine.getNightSteps(state).some((s) => s.position === 9 && s.roles.includes('demon')));
    act(state, 9, 'demon', 2, 3);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[3], 'killed by the Demon');
  });

  test('the inherited Demon kill is a basic attack that protection can block', () => {
    const state = assignRoles(['demon', 'imp', 'doctor', 'civilian', 'veteran', 'civilian']);
    act(state, 0, 'veteran', 5, null, { alert: true });
    act(state, 9, 'demon', 1, 5);
    night(state);
    assert.strictEqual(pid(state, 2).inheritedRole, 'demon');
    act(state, 5, 'doctor', 3, 6);
    act(state, 9, 'demon', 2, 6);
    night(state);
    assert.strictEqual(pid(state, 6).isAlive, true);
  });
});

describe('Possessed', () => {
  test('reads Evil to investigators and has no ability of its own', () => {
    const state = assignRoles(['sheriff', 'possessed', 'oracle', 'civilian', 'civilian', 'civilian']);
    act(state, 11, 'sheriff', 1, 2);
    act(state, 11, 'oracle', 3, 2);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P2: SUSPICIOUS.'));
    assert.ok(logText(state).includes('(Oracle) reads P2: NOT TOWN.'));
    assert.ok(!engine.getNightSteps(state).some((s) => s.roles.includes('possessed')));
  });
});

describe('Outcast', () => {
  test('reads SUSPICIOUS to the Sheriff and shares a Town victory when surviving', () => {
    const state = assignRoles(['sheriff', 'outcast', 'civilian', 'godfather', 'mafioso', 'survivor']);
    act(state, 11, 'sheriff', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P2: SUSPICIOUS.'));
    pid(state, 4).isAlive = false;
    pid(state, 5).isAlive = false;
    const victory = engine.checkVictory(state);
    assert.strictEqual(victory.winner, 'TOWN');
    assert.ok(victory.survivors.indexOf(2) !== -1);
    assert.ok(victory.survivors.indexOf(6) !== -1);
  });
});

// ---------------------------------------------------------------------------
// Amnesiac
// ---------------------------------------------------------------------------

describe('Amnesiac', () => {
  function remember(state, rolePlayerId, roleId) {
    engine._recordDeath(state, rolePlayerId, 'killed in the night', false, true);
    act(state, 12, 'amnesiac', 1, rolePlayerId);
    night(state);
    assert.strictEqual(state.amnesiac.used, true);
    assert.strictEqual(state.amnesiac.rememberedRole, roleId);
  }

  test('remembering a role grants the Amnesiac that role\'s night action step', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'sheriff', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'sheriff');
    assert.ok(engine.getNightSteps(state).some((step) =>
      step.position === 11 && step.roles.includes('sheriff')));
  });

  test('a remembered Godfather becomes the Mafia kill leader', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    remember(state, 2, 'godfather');
    act(state, 6, 'godfather', 1, 4);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[4], 'killed by the Mafia');
  });

  test('a remembered Mafioso becomes the Mafia kill leader', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'mafioso', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'mafioso');
    pid(state, 2).isAlive = false;
    act(state, 6, 'mafioso', 1, 4);
    const result = night(state);
    assert.strictEqual(deathCauses(result)[4], 'killed by the Mafia');
  });

  test('a remembered Sheriff performs the Sheriff investigation', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'sheriff', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'sheriff');
    act(state, 11, 'sheriff', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Sheriff) checks P2: INNOCENT'));
  });

  test('a remembered Consigliere performs the Consigliere investigation', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'consigliere', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'consigliere');
    act(state, 11, 'consigliere', 1, 2);
    night(state);
    assert.ok(logText(state).includes('(Consigliere) learns the role of P2: Godfather.'));
  });

  test('a remembered Jester wins when lynched', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'jester', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'jester');
    assert.ok(engine.startTrial(state, 1, 2));
    [2, 4, 5, 6].forEach((id) => assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'AGREE' }), true));
    assert.strictEqual(engine.resolveTrial(state).result, 'ACCEPTED');
    engine.castVote(state, { voterId: 2, verdict: 'GUILTY' });
    engine.castVote(state, { voterId: 4, verdict: 'GUILTY' });
    assert.strictEqual(engine.resolveTrial(state).result, 'SENTENCED');
    [2, 4, 5, 6].forEach((id) => assert.strictEqual(engine.castVote(state, { voterId: id, verdict: 'GUILTY' }), true));
    const resolved = engine.resolveSentence(state);
    assert.strictEqual(resolved.jesterWin, true);
  });

  test('a remembered Executioner keeps its remembered role', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'executioner', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'executioner');
    assert.strictEqual(state.amnesiac.rememberedRole, 'executioner');
  });

  test('a remembered Vigilante can shoot', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'vigilante', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'vigilante');
    const shot = engine.vigilanteShoot(state, 1, 4);
    assert.ok(shot);
    assert.strictEqual(pid(state, 4).isAlive, false);
  });

  test('a remembered Deputy can shoot', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'deputy', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'deputy');
    const shot = engine.deputyShoot(state, 1, 4);
    assert.ok(shot);
    assert.strictEqual(pid(state, 4).isAlive, false);
  });

  test('a remembered Mayor can reveal', () => {
    const state = assignRoles(['amnesiac', 'godfather', 'mayor', 'civilian', 'civilian', 'civilian']);
    remember(state, 3, 'mayor');
    assert.ok(engine.mayorReveal(state, 1));
    assert.strictEqual(pid(state, 1).revealed, true);
  });
});

describe('role catalog', () => {
  test('Spy has no n1Only property and Jailor has unlimited uses', () => {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(engine.ROLES.spy, 'n1Only'), false);
    assert.strictEqual(engine.ROLES.jailor.maxUses, null);
  });
});

