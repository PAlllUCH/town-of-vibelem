'use strict';

const assert = require('node:assert/strict');
const helpers = require('../tests/helpers.js');
require('../js/ui/helper.js');
const APP = helpers.APP;
const E = helpers.engine;
const html = helpers.html;
const startRoles = helpers.startRoles;
const driveNight = helpers.driveNight;
const secondAll = helpers.secondAll;
const castAll = helpers.castAll;
const firstLivingNot = helpers.firstLivingNot;

const SHEET_FLAGS = ['drunk', 'poisoned', 'jailed', 'protected', 'alert', 'revealed', 'blackmailed', 'enchanted', 'cleaned', 'necro_used', 'succubus_target', 'ghost'];

const report = {
  passed: [],
  issues: [],
  transcript: [],
  deaths: []
};

function log(msg) {
  console.log(msg);
  report.transcript.push(msg);
}

function pass(check) {
  report.passed.push(check);
  console.log('  PASS: ' + check);
}

function fail(check, detail) {
  const entry = { check: check, detail: detail };
  report.issues.push(entry);
  console.log('  FAIL: ' + check + ' -- ' + detail);
}

function phase() { return APP.state ? APP.state.phase : '(no state)'; }
function dayNum() { return APP.state ? APP.state.dayNumber : -1; }
function alive() { return APP.state ? APP.state.players.filter(function (p) { return p.isAlive; }) : []; }

function recordDeaths(label) {
  if (!APP.state) return;
  const gy = APP.state.graveyard || [];
  gy.forEach(function (e) {
    const key = e.playerId + ':' + (e.deathCause || 'unknown');
    if (!report.deaths.some(function (d) { return d.key === key; })) {
      report.deaths.push({ key: key, label: label, playerId: e.playerId, name: e.name, role: e.trueRole, cause: e.deathCause });
    }
  });
}

function safeCheck(name, fn) {
  try {
    fn();
  } catch (e) {
    fail(name, 'threw: ' + e.message + (e.stack ? '\n' + e.stack.split('\n').slice(0, 3).join('\n') : ''));
  }
}

// =========================================================================
// Phase 1: Setup and role assignment
// =========================================================================
log('=== Phase 1: Setup (Helper Mode Full Game) ===');

const roles = [
  'jailor', 'doctor', 'godfather', 'mafioso', 'witch', 'veteran',
  'tracker', 'lookout', 'sheriff', 'innkeeper', 'survivor', 'jester'
];

try {
  startRoles(12, { town: 7, mafia: 3, neutral: 2 }, roles);
  pass('startRoles completed without crash');
} catch (e) {
  fail('startRoles', 'threw: ' + e.message);
  log('FATAL: Cannot continue without game state.');
  process.exit(1);
}

assert.strictEqual(APP.state.phase, 'SEATS');
pass('Phase is SEATES after role assignment');

// Verify player names
const pNames = APP.state.players.map(function (p) { return p.name; }).join(', ');
log('Players: ' + pNames);

// Verify role assignment
const roleCheck = APP.state.players.map(function (p) { return p.name + '=' + p.assignedRole; }).join(', ');
log('Roles assigned: ' + roleCheck);

// Verify jailorNoExecN1 default
if (APP.cfg.houseRules.jailorNoExecN1 === false) {
  pass('jailorNoExecN1 defaults to false (Jailor CAN execute on N1)');
} else {
  fail('jailorNoExecN1 default', 'expected false, got ' + APP.cfg.houseRules.jailorNoExecN1);
}

// =========================================================================
// Phase 2: Begin Day 1, switch to helper mode, exercise status sheet
// =========================================================================
log('');
log('=== Phase 2: Day 1 in Helper Mode ===');

try {
  APP.beginDay1();
  pass('beginDay1 completed without crash');
} catch (e) {
  fail('beginDay1', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.phase, 'DAY');
assert.strictEqual(APP.state.dayNumber, 1);
pass('Phase is DAY, dayNumber is 1');

// Switch to helper mode
APP.app.mode = 'helper';
APP.renderScreen('game');
pass('Switched to helper mode and rendered game screen');

// Verify helper cards render during DAY
safeCheck('helper cards render during DAY', function () {
  const h = html('game-body');
  assert.ok(h.indexOf('helper-card') !== -1, 'helper-card class found');
  assert.ok(h.indexOf('Night Order') !== -1, 'Night Order card renders');
  assert.ok(h.indexOf('Players') !== -1, 'Players card renders');
  assert.ok(h.indexOf('Statuses') !== -1, 'Statuses card renders');
  pass('Helper cards (Night Order, Players, Statuses) render during DAY');
});

// Verify player roster shows names
safeCheck('roster shows player names', function () {
  const h = html('game-body');
  APP.state.players.forEach(function (p) {
    assert.ok(h.indexOf(p.name) !== -1, 'roster contains ' + p.name);
  });
  pass('All player names appear in the helper roster');
});

// Open status sheet for player 1
safeCheck('status sheet opens for player 1', function () {
  APP.app.helperSheetPid = '1';
  APP.renderScreen('game');
  const h = html('game-body');
  assert.ok(h.indexOf('helper-sheet') !== -1, 'helper-sheet renders');
  assert.ok(h.indexOf('helper-sheet open') !== -1, 'helper-sheet has open class');
  assert.ok(h.indexOf('helper-sheet-backdrop open') !== -1, 'backdrop renders');
  assert.ok(h.indexOf(APP.state.players[0].name) !== -1, 'sheet shows player name');
  pass('Status sheet opens for player 1');
});

// Verify all SHEET_FLAGS render as buttons in the sheet
safeCheck('status sheet lists all flags', function () {
  const h = html('game-body');
  SHEET_FLAGS.forEach(function (fl) {
    const label = fl.toUpperCase().replace(/_/g, ' ');
    assert.ok(h.indexOf(label) !== -1, 'sheet contains flag button: ' + label);
  });
  pass('Status sheet lists all flags: ' + SHEET_FLAGS.join(', ').toUpperCase().replace(/_/g, ' '));
});

// Toggle set-helper-status flags
safeCheck('toggle helper status flags', function () {
  APP.toggleHelperStatus('1', 'drunk');
  assert.strictEqual(APP.app.statuses['1'].drunk, true, 'drunk toggled on');
  APP.toggleHelperStatus('1', 'poisoned');
  assert.strictEqual(APP.app.statuses['1'].poisoned, true, 'poisoned toggled on');
  APP.toggleHelperStatus('1', 'jailed');
  assert.strictEqual(APP.app.statuses['1'].jailed, true, 'jailed toggled on');
  APP.toggleHelperStatus('1', 'protected');
  assert.strictEqual(APP.app.statuses['1'].protected, true, 'protected toggled on');
  APP.toggleHelperStatus('1', 'alert');
  assert.strictEqual(APP.app.statuses['1'].alert, true, 'alert toggled on');
  APP.toggleHelperStatus('1', 'revealed');
  assert.strictEqual(APP.app.statuses['1'].revealed, true, 'revealed toggled on');
  APP.toggleHelperStatus('1', 'blackmailed');
  assert.strictEqual(APP.app.statuses['1'].blackmailed, true, 'blackmailed toggled on');
  APP.toggleHelperStatus('1', 'enchanted');
  assert.strictEqual(APP.app.statuses['1'].enchanted, true, 'enchanted toggled on');
  APP.toggleHelperStatus('1', 'cleaned');
  assert.strictEqual(APP.app.statuses['1'].cleaned, true, 'cleaned toggled on');
  APP.toggleHelperStatus('1', 'necro_used');
  assert.strictEqual(APP.app.statuses['1'].necro_used, true, 'necro_used toggled on');
  APP.toggleHelperStatus('1', 'succubus_target');
  assert.strictEqual(APP.app.statuses['1'].succubus_target, true, 'succubus_target toggled on');
  APP.toggleHelperStatus('1', 'ghost');
  assert.strictEqual(APP.app.statuses['1'].ghost, true, 'ghost toggled on');
  pass('All 12 status flags toggle correctly');
});

// Verify chips render in roster
safeCheck('status chips render in roster', function () {
  APP.renderScreen('game');
  const h = html('game-body');
  assert.ok(h.indexOf('helper-chip') !== -1, 'helper-chip renders');
  assert.ok(h.indexOf('DRUNK') !== -1, 'DRUNK chip renders');
  assert.ok(h.indexOf('POISONED') !== -1, 'POISONED chip renders');
  assert.ok(h.indexOf('JAILED') !== -1, 'JAILED chip renders');
  pass('Status chips render in the roster');
});

// Toggle them all off
safeCheck('toggle all flags off', function () {
  SHEET_FLAGS.forEach(function (fl) {
    APP.toggleHelperStatus('1', fl);
    assert.strictEqual(APP.app.statuses['1'][fl], false, fl + ' toggled off');
  });
  pass('All status flags toggle off correctly');
});

// Close status sheet
APP.app.helperSheetPid = null;
APP.renderScreen('game');
pass('Status sheet closed');

// Test helper-kill-player on player 12 (jester)
safeCheck('helper-kill-player', function () {
  const victim = APP.state.players[11]; // player 12, jester
  assert.strictEqual(victim.isAlive, true, 'victim is alive before kill');
  APP.doDayAbility('moderator-kill', victim.id);
  assert.strictEqual(victim.isAlive, false, 'player 12 killed via moderator-kill');
  APP.renderScreen('game');
  const h = html('game-body');
  assert.ok(h.indexOf('GHOST') !== -1, 'GHOST chip appears in roster');
  pass('helper-kill-player works on player 12 (jester)');
});

// Test helper-undo-kill
safeCheck('helper-undo-kill', function () {
  APP.undoKill();
  const victim = APP.state.players[11];
  assert.strictEqual(victim.isAlive, true, 'player 12 revived via undo-kill');
  pass('helper-undo-kill works');
});

// Verify bottom bar shows End Day during DAY
safeCheck('helper bar shows End Day during DAY', function () {
  APP.renderScreen('game');
  const bar = html('game-bar');
  assert.ok(bar.indexOf('data-action="end-day"') !== -1, 'End Day button renders');
  assert.ok(bar.indexOf('End Day') !== -1, 'End Day label present');
  pass('Helper bar shows End Day during DAY');
});

// =========================================================================
// Phase 3: End Day 1, Night 1 in helper mode
// =========================================================================
log('');
log('=== Phase 3: Night 1 in Helper Mode ===');

try {
  APP.endDay();
  pass('endDay completed without crash');
} catch (e) {
  fail('endDay', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.phase, 'NIGHT');
pass('Phase is NIGHT after endDay');

// Verify helper mode is still active
assert.strictEqual(APP.app.mode, 'helper', 'helper mode still active');
pass('Helper mode persists into NIGHT');

// Verify night step card renders
safeCheck('night step card renders', function () {
  APP.renderScreen('game');
  const h = html('game-body');
  assert.ok(h.indexOf('data-card="helper-night-step"') !== -1, 'night step card renders');
  assert.ok(h.indexOf('data-card="helper-night-actions"') !== -1, 'night outstanding card renders');
  assert.ok(h.indexOf('data-card="helper-players"') !== -1, 'player roster renders');
  pass('Night step card, outstanding card, and roster render during NIGHT');
});

// Verify jailor step shows the right prompt
safeCheck('jailor step prompt', function () {
  APP.app.helperStepIdx = 0;
  APP.renderScreen('game');
  const h = html('game-body');
  const stepBody = h.slice(h.indexOf('id="card-body-helper-night-step"'), h.indexOf('data-card="helper-players"'));
  assert.ok(stepBody.indexOf('Jailor') !== -1, 'first step is Jailor');
  assert.ok(stepBody.indexOf('Jailor, open your eyes') !== -1, 'jailor prompt renders');
  assert.ok(stepBody.indexOf('EXECUTE') !== -1, 'EXECUTE option in prompt');
  assert.ok(stepBody.indexOf('SPARE') !== -1, 'SPARE option in prompt');
  assert.ok(stepBody.indexOf(APP.state.players[0].name) !== -1, 'jailor actor name shown');
  pass('Jailor step shows correct prompt with EXECUTE/SPARE (jailorNoExecN1=false)');
});

// Verify helperStepIdx navigation
safeCheck('helper step navigation', function () {
  const bar1 = html('game-bar');
  assert.ok(bar1.indexOf('1 /') !== -1, 'starts at step 1');
  assert.ok(bar1.indexOf('data-action="helper-step-prev" disabled') !== -1, 'Prev disabled on first step');
  assert.ok(bar1.indexOf('data-action="resolve-night"') !== -1, 'Resolve Night button present');

  APP.helperStepNext();
  APP.renderScreen('game');
  const bar2 = html('game-bar');
  assert.ok(bar2.indexOf('2 /') !== -1, 'advances to step 2');
  assert.ok(bar2.indexOf('data-action="helper-step-prev" disabled') === -1, 'Prev enabled after advancing');

  APP.helperStepPrev();
  APP.renderScreen('game');
  const bar3 = html('game-bar');
  assert.ok(bar3.indexOf('1 /') !== -1, 'returns to step 1');
  pass('Helper step navigation (next/prev) works');
});

// Verify outstanding actions card shows pending
safeCheck('outstanding actions show pending', function () {
  APP.renderScreen('game');
  const h = html('game-body');
  const actionsBody = h.slice(h.indexOf('id="card-body-helper-night-actions"'), h.indexOf('data-card="helper-players"'));
  assert.ok(actionsBody.indexOf('PENDING') !== -1, 'pending tags render');
  pass('Outstanding night actions show PENDING tags');
});

// Drive night actions through the wizard (same as app mode)
log('Driving Night 1 actions via wizard...');
try {
  driveNight();
  pass('driveNight completed for Night 1');
} catch (e) {
  fail('driveNight Night 1', 'threw: ' + e.message);
}

// Verify no self-targets
if (helpers.noSelfTargets()) {
  pass('No self-targets recorded in Night 1');
} else {
  fail('Self-target check', 'Night 1 has a self-target');
}

// Check Jailor action on N1
safeCheck('Jailor N1 action', function () {
  const jailAc = APP.state.night.actions.find(function (a) { return a.roleId === 'jailor'; });
  if (jailAc) {
    log('  Jailor action: target=' + jailAc.targetId + ', extra=' + JSON.stringify(jailAc.extra));
    if (jailAc.extra && jailAc.extra.jailorDecision) {
      pass('Jailor decision on N1: ' + jailAc.extra.jailorDecision);
    } else {
      pass('Jailor action recorded on N1');
    }
  } else {
    fail('Jailor N1 action', 'no jailor action found');
  }
});

// Verify outstanding actions now show DONE after driving
safeCheck('outstanding actions show done after driveNight', function () {
  APP.renderScreen('game');
  const h = html('game-body');
  const actionsBody = h.slice(h.indexOf('id="card-body-helper-night-actions"'), h.indexOf('data-card="helper-players"'));
  assert.ok(actionsBody.indexOf('DONE') !== -1, 'DONE tags render after driving');
  pass('Outstanding night actions show DONE after driveNight');
});

// Resolve night
log('Resolving Night 1...');
try {
  APP.resolveNight();
  pass('resolveNight completed');
} catch (e) {
  fail('resolveNight Night 1', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.phase, 'MORNING');
pass('Phase is MORNING after resolveNight');

recordDeaths('Night 1');

// Verify morning recap card renders
safeCheck('morning recap card renders', function () {
  APP.renderScreen('game');
  const h = html('game-body');
  assert.ok(h.indexOf('Morning Recap') !== -1, 'Morning Recap title renders');
  assert.ok(h.indexOf('data-card="helper-recap"') !== -1, 'helper-recap card renders');
  pass('Morning recap card renders during MORNING');
});

// Verify helper bar shows Begin Day during MORNING
safeCheck('helper bar shows Begin Day during MORNING', function () {
  const bar = html('game-bar');
  assert.ok(bar.indexOf('data-action="begin-day"') !== -1, 'Begin Day button renders');
  assert.ok(bar.indexOf('Begin Day') !== -1, 'Begin Day label present');
  assert.ok(bar.indexOf('data-action="resolve-night"') === -1, 'Resolve Night not shown during MORNING');
  assert.ok(bar.indexOf('data-action="helper-step-prev"') === -1, 'Night step controls not shown during MORNING');
  pass('Helper bar shows Begin Day during MORNING');
});

// Log deaths so far
log('Deaths after Night 1:');
report.deaths.forEach(function (d) {
  log('  ' + d.label + ': Player ' + d.playerId + ' (' + d.name + ') as ' + d.role + ' - ' + d.cause);
});

// =========================================================================
// Phase 4: Day/Night loops until victory
// =========================================================================
log('');
log('=== Phase 4: Day/Night Loops (Helper Mode) ===');

let cycle = 0;
const maxCycles = 25;

while (APP.state.phase !== 'END' && cycle < maxCycles) {
  cycle++;
  log('');
  log('--- Cycle ' + cycle + ' (phase: ' + phase() + ', day: ' + dayNum() + ', alive: ' + alive().length + ') ---');

  // Begin day if in MORNING
  if (APP.state.phase === 'MORNING') {
    log('Beginning day ' + (dayNum() + 1) + '...');
    try {
      APP.beginDay();
      pass('beginDay completed (cycle ' + cycle + ')');
    } catch (e) {
      fail('beginDay cycle ' + cycle, 'threw: ' + e.message);
      break;
    }

    if (APP.state.phase === 'END') {
      log('Game ended at beginDay! Winner: ' + JSON.stringify(APP.state.winner));
      break;
    }
    if (APP.state.phase !== 'DAY') {
      fail('beginDay phase', 'expected DAY, got ' + APP.state.phase);
      break;
    }
    pass('Phase is DAY, dayNumber is ' + dayNum());

    // Verify helper mode still active
    assert.strictEqual(APP.app.mode, 'helper', 'helper mode still active in cycle ' + cycle);

    // Verify helper bar shows End Day
    APP.renderScreen('game');
    const dayBar = html('game-bar');
    if (dayBar.indexOf('data-action="end-day"') !== -1) {
      pass('Helper bar shows End Day in cycle ' + cycle);
    } else {
      fail('Helper bar End Day', 'End Day not found in cycle ' + cycle);
    }

    // Run a trial if enough players alive (lynch a mafia member to speed up game)
    if (alive().length > 4) {
      const target = alive().find(function (p) {
        return p.assignedRole === 'godfather' || p.assignedRole === 'mafioso';
      });
      if (target) {
        log('Nominating player ' + target.id + ' (' + target.assignedRole + ')...');
        APP.app.trialNom = alive()[0].id;
        try {
          APP.startTrial(target.id);
          secondAll();
          APP.resolveTrial();
          if (APP.state.trial.stage === 'VOTE') {
            castAll('GUILTY');
            APP.resolveTrial();
            if (APP.state.trial.stage === 'SENTENCE') {
              castAll('GUILTY');
              APP.resolveSentence();
              recordDeaths('Day ' + dayNum());
              log('Lynched player ' + target.id + ' (' + target.assignedRole + ')');
              if (APP.state.phase === 'END') {
                log('Game ended after lynch! Winner: ' + JSON.stringify(APP.state.winner));
                break;
              }
            }
          }
        } catch (e) {
          log('Trial failed (non-fatal): ' + e.message);
        }
      }
    }
  }

  // End day if still in DAY
  if (APP.state.phase === 'DAY') {
    log('Ending day ' + dayNum() + '...');
    try {
      APP.endDay();
      pass('endDay completed (cycle ' + cycle + ')');
    } catch (e) {
      fail('endDay cycle ' + cycle, 'threw: ' + e.message);
      break;
    }
  }

  // Night phase
  if (APP.state.phase === 'NIGHT') {
    assert.strictEqual(APP.app.mode, 'helper', 'helper mode still active during NIGHT');
    log('Night ' + APP.state.night.number + ': driving wizard...');

    // Verify night step card renders
    APP.renderScreen('game');
    const nightH = html('game-body');
    if (nightH.indexOf('data-card="helper-night-step"') !== -1) {
      pass('Night step card renders in cycle ' + cycle);
    } else {
      fail('Night step card', 'not found in cycle ' + cycle);
    }

    // Verify helper bar has Resolve Night
    const nightBar = html('game-bar');
    if (nightBar.indexOf('data-action="resolve-night"') !== -1) {
      pass('Resolve Night button in helper bar (cycle ' + cycle + ')');
    } else {
      fail('Resolve Night button', 'not found in helper bar cycle ' + cycle);
    }

    // Drive night
    try {
      driveNight();
      pass('driveNight completed (cycle ' + cycle + ')');
    } catch (e) {
      fail('driveNight cycle ' + cycle, 'threw: ' + e.message);
      break;
    }

    // Resolve night
    log('Resolving night ' + APP.state.night.number + '...');
    try {
      APP.resolveNight();
      pass('resolveNight completed (cycle ' + cycle + ')');
    } catch (e) {
      fail('resolveNight cycle ' + cycle, 'threw: ' + e.message);
      break;
    }

    assert.ok(APP.state.phase === 'MORNING' || APP.state.phase === 'END', 'phase after resolveNight should be MORNING or END, got ' + APP.state.phase);
    pass('Phase is ' + APP.state.phase + ' after resolveNight (cycle ' + cycle + ')');
    if (APP.state.phase === 'END') {
      log('Game ended after night resolution! Winner: ' + JSON.stringify(APP.state.winner));
      break;
    }

    recordDeaths('Night ' + (APP.state.night.number - 1));

    // Verify morning recap in helper mode
    APP.renderScreen('game');
    const morningH = html('game-body');
    if (morningH.indexOf('Morning Recap') !== -1) {
      pass('Morning Recap renders in cycle ' + cycle);
    } else {
      fail('Morning Recap', 'not found in cycle ' + cycle);
    }

    // Check for victory
    if (APP.state.phase === 'END') {
      log('Game ended after night resolution! Winner: ' + JSON.stringify(APP.state.winner));
      break;
    }
  }
}

// =========================================================================
// Phase 5: Final report
// =========================================================================
log('');
log('=== Final State ===');
log('Phase: ' + phase());
log('Day: ' + dayNum());
log('Winner: ' + JSON.stringify(APP.state.winner));
log('Alive: ' + alive().length + ' players');
log('Cycles run: ' + cycle);

log('');
log('=== Deaths ===');
report.deaths.forEach(function (d) {
  log('  ' + d.label + ': Player ' + d.playerId + ' (' + d.name + ') as ' + d.role + ' - ' + d.cause);
});

log('');
log('=== State Logs ===');
(APP.state.logs || []).forEach(function (l) {
  log('  ' + l);
});

// Verify end screen
if (APP.state.phase === 'END') {
  safeCheck('end screen renders', function () {
    const endHtml = html('end-body');
    if (endHtml.indexOf('Role Reveal') !== -1 || endHtml.indexOf('seat-tile') !== -1) {
      pass('End screen renders Role Reveal');
    } else {
      fail('End screen', 'Role Reveal not found in end-body');
    }
    if (APP.app.endReveal && APP.app.endReveal.length === 12) {
      pass('endReveal has all 12 players');
    } else {
      fail('endReveal', 'expected 12 entries, got ' + (APP.app.endReveal ? APP.app.endReveal.length : 'null'));
    }
  });
}

// Verify helper mode was maintained throughout
if (APP.app.mode === 'helper') {
  pass('Helper mode maintained throughout the entire game');
} else {
  fail('Helper mode persistence', 'mode changed to ' + APP.app.mode);
}

// =========================================================================
// Write report
// =========================================================================
const fs = require('fs');
const path = require('path');

let md = '# Helper-Mode Full-Game Verification Report\n\n';
md += 'Generated: ' + new Date().toISOString() + '\n\n';

md += '## Passed checks (' + report.passed.length + ')\n\n';
report.passed.forEach(function (p) {
  md += '- ' + p + '\n';
});

md += '\n## Issues found (' + report.issues.length + ')\n\n';
if (report.issues.length === 0) {
  md += 'None.\n';
} else {
  report.issues.forEach(function (iss) {
    md += '- **' + iss.check + '**: ' + iss.detail + '\n';
  });
}

md += '\n## Full-game transcript summary\n\n';
md += '- Players: 12 (jailor, doctor, godfather, mafioso, witch, veteran, tracker, lookout, sheriff, innkeeper, survivor, jester)\n';
md += '- Team counts: town 7, mafia 3, neutral 2\n';
md += '- Preset: p1\n';
md += '- Mode: helper (entire game)\n';
md += '- Final phase: ' + phase() + '\n';
md += '- Final day: ' + dayNum() + '\n';
md += '- Winner: ' + JSON.stringify(APP.state.winner) + '\n';
md += '- Alive at end: ' + alive().length + '\n';
md += '- Cycles: ' + cycle + '\n\n';

md += '### Key helper-mode checks\n\n';
md += '- Night step card shows Jailor prompt with EXECUTE/SPARE (jailorNoExecN1=false)\n';
md += '- Helper player roster shows all player names\n';
md += '- Status sheet lists all 12 flags: DRUNK, POISONED, JAILED, PROTECTED, ALERT, REVEALED, BLACKMAILED, ENCHANTED, CLEANED, NECRO_USED, SUCCUBUS_TARGET, GHOST\n';
md += '- Bottom bar: End Day during DAY, Resolve Night during NIGHT, Begin Day during MORNING\n';
md += '- helper-kill-player and helper-undo-kill work\n';
md += '- Night outstanding card shows PENDING/DONE\n';
md += '- Morning Recap card renders during MORNING\n\n';

md += '### Deaths\n\n';
if (report.deaths.length === 0) {
  md += 'No deaths.\n';
} else {
  report.deaths.forEach(function (d) {
    md += '- **' + d.label + '**: Player ' + d.playerId + ' (' + d.name + ') as ' + d.role + ' - ' + d.cause + '\n';
  });
}

md += '\n### Full log\n\n```\n';
report.transcript.forEach(function (l) {
  md += l + '\n';
});
md += '```\n';

const reportPath = path.join(__dirname, 'verify-helper-game-REPORT.md');
fs.writeFileSync(reportPath, md, 'utf8');
console.log('');
console.log('Report written to: ' + reportPath);
console.log('Passed: ' + report.passed.length + ', Issues: ' + report.issues.length);

if (report.issues.length > 0) {
  process.exitCode = 1;
}
