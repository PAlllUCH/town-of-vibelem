'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  APP, engine, html, startRoles, driveNight, livingGuiltyVoters,
  noSelfTargets, secondAll, castAll, castVotes
} = require('./helpers.js');
const E = engine;

describe('house rule defaults', () => {
  test('the default config inherits noLynchD1 ON', () => {
    APP.newGame();
    assert.strictEqual(APP.cfg.houseRules.noLynchD1, true);
    assert.strictEqual(APP.cfg.houseRules.noKillN1, true);
    assert.strictEqual(APP.cfg.houseRules.classicReveal, false);
  });
});

describe('full-app game loop driver', () => {

  test('full 10-player game: prep, Day-1 trial, Godfather lynch, Town victory, END reveal', () => {
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
    assert.strictEqual(APP.state.trial.votes.length, 9); // the accused cannot vote
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
    assert.ok(APP.state.trial.active);
    castAll('GUILTY'); // no spare majority -> the Godfather is lynched
    APP.resolveSentence();
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
    assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
    castVotes({
      1: 'GUILTY', 2: 'GUILTY', 3: 'GUILTY', 4: 'GUILTY', 5: 'GUILTY',
      7: 'GUILTY', 8: 'GUILTY', 9: 'GUILTY'
    });
    APP.resolveSentence();
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

  test('day view renders the sentence stage and the moderator kill controls', () => {
    const roles = ['civilian', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' };
    startRoles(6, { town: 5, mafia: 1, neutral: 0 }, roles, names, { noLynchD1: false });
    APP.beginDay1();
    assert.strictEqual(APP.state.phase, 'DAY');
    let h = html('game-body');
    assert.ok(h.indexOf('Kill Player') === -1, 'the moderator kill control lives in the Mod panel, not the day body');
    APP.toggleMod();
    h = html('panel-root');
    assert.ok(h.indexOf('Kill Player') !== -1, 'the Mod panel shows Kill Player');
    assert.ok(h.indexOf('Undo Last Kill') !== -1, 'the Mod panel shows Undo Last Kill');
    assert.ok(h.indexOf('data-action="undo-kill" disabled') !== -1, 'undo disabled with an empty graveyard');
    APP.app.trialNom = 1;
    APP.startTrial(6);
    secondAll();
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'VOTE');
    castVotes({ 1: 'GUILTY', 2: 'GUILTY' });
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
    assert.ok(APP.state.trial.active);
    assert.ok(APP.app.lastTrialResult === null || APP.app.lastTrialResult === undefined);
    h = html('game-body');
    assert.ok(h.indexOf('last speech') !== -1, 'the sentence card shows the last-speech notice');
    assert.ok(h.indexOf('Resolve Sentence') !== -1, 'the sentence card has a resolve button');
    assert.ok(h.indexOf('GUILTY') !== -1, 'the verdict tally renders');
    // moderator kill through the shared living-player picker
    APP.killPlayer();
    assert.ok(APP.app.picker && APP.app.picker.ability === 'moderator-kill');
    h = html('game-body');
    assert.ok(h.indexOf('Pick a living player.') !== -1);
    APP.doDayAbility('moderator-kill', 1);
    assert.strictEqual(APP.state.players[0].isAlive, false);
    assert.strictEqual(APP.state.graveyard.length, 1);
    APP.updatePanels();
    assert.ok(html('panel-root').indexOf('Undo Last Kill (A)') !== -1, 'the undo button shows the dead name');
    APP.undoKill();
    assert.strictEqual(APP.state.players[0].isAlive, true);
    assert.strictEqual(APP.state.graveyard.length, 0);
    // resolve the sentence: no spare majority -> the Godfather is lynched, Town wins
    castVotes({ 1: 'GUILTY', 2: 'GUILTY', 3: 'GUILTY', 4: 'GUILTY', 5: 'GUILTY' });
    APP.resolveSentence();
    assert.ok(APP.app.lastTrialResult && APP.app.lastTrialResult.lynchedId === 6);
    assert.strictEqual(APP.state.phase, 'END');
    assert.strictEqual(APP.state.winner, 'TOWN');
    assert.ok(html('end-body').indexOf('Role Reveal') !== -1, 'the end screen renders after the sentence lynch');
  });

  test('an active trial left unresolved is closed when the next day begins', () => {
    const roles = ['civilian', 'civilian', 'civilian', 'civilian', 'civilian', 'godfather'];
    startRoles(6, { town: 5, mafia: 1, neutral: 0 }, roles, null, { noLynchD1: false });
    APP.beginDay1();
    APP.app.trialNom = 1;
    APP.startTrial(6);
    secondAll();
    APP.resolveTrial();
    castVotes({ 1: 'GUILTY', 2: 'GUILTY' });
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
    assert.ok(APP.state.trial.active);
    // the moderator ends the day mid-trial, sleeps, and the next day resets the trial
    APP.endDay();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    driveNight();
    APP.resolveNight();
    APP.beginDay();
    assert.strictEqual(APP.state.dayNumber, 2);
    assert.strictEqual(APP.state.trial.active, false);
    assert.strictEqual(APP.state.trial.stage, null);
    APP.app.trialNom = 2;
    APP.startTrial(6);
    assert.ok(APP.state.trial.active, 'a new trial can start on the new day');
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

});
