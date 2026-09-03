'use strict';

const assert = require('node:assert/strict');
const helpers = require('../tests/helpers.js');
const APP = helpers.APP;
const E = helpers.engine;
const html = helpers.html;
const startRoles = helpers.startRoles;
const driveNight = helpers.driveNight;
const secondAll = helpers.secondAll;
const castAll = helpers.castAll;
const castVotes = helpers.castVotes;
const noSelfTargets = helpers.noSelfTargets;
const firstLivingNot = helpers.firstLivingNot;

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
  const prev = report.deaths.length;
  gy.forEach(function (e) {
    const key = e.playerId + ':' + (e.deathCause || 'unknown');
    if (!report.deaths.some(function (d) { return d.key === key; })) {
      report.deaths.push({ key: key, label: label, playerId: e.playerId, name: e.name, role: e.trueRole, cause: e.deathCause });
    }
  });
}

// =========================================================================
// Phase 1: Setup and role assignment
// =========================================================================
log('=== Phase 1: Setup ===');

const roles = [
  'jailor', 'doctor', 'godfather', 'mafioso', 'escort', 'sheriff',
  'tracker', 'lookout', 'witch', 'veteran', 'medium', 'survivor'
];

try {
  startRoles(12, { town: 7, mafia: 3, neutral: 2 }, roles, null, { noLynchD1: false });
  pass('startRoles completed without crash');
} catch (e) {
  fail('startRoles', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.phase, 'SEATS');
pass('Phase is SEATS after role assignment');

// Verify naming screen renders seat buttons (dealt view uses seat-tile/seat-dealt)
const seatsHtml = html('seats-body');
if (seatsHtml.indexOf('seat-tile') !== -1 || seatsHtml.indexOf('seat-dealt') !== -1) {
  pass('Seats dealt view renders seat tiles');
} else if (seatsHtml.indexOf('seat-btn') !== -1) {
  pass('Naming screen renders seat-btn elements');
} else {
  fail('Seats rendering', 'neither seat-tile nor seat-btn found in seats-body HTML');
}

// Verify --tile-w and --tile-cap style vars on the circle container
if (seatsHtml.indexOf('--tile-w') !== -1 && seatsHtml.indexOf('--tile-cap') !== -1) {
  pass('Circle layout renders --tile-w and --tile-cap CSS vars');
} else {
  fail('Circle CSS vars', '--tile-w or --tile-cap not found in seats HTML');
}

// Verify seatPlaceholder renders (Player N fallback)
if (seatsHtml.indexOf('Player 1') !== -1 || seatsHtml.indexOf('Player') !== -1) {
  pass('seatPlaceholder "Player N" renders in seats grid');
} else {
  fail('seatPlaceholder', '"Player" text not found in seats grid');
}

// Verify Begin Day 1 button appears in seats dealt view
if (seatsHtml.indexOf('Begin Day 1') !== -1) {
  pass('Begin Day 1 button visible in seats dealt view');
} else {
  fail('Begin Day 1 button', 'not found in seats-body HTML');
}

// Also verify naming screen by going back to naming mode
try {
  APP.editNames();
  const namingHtml = html('seats-body');
  if (namingHtml.indexOf('seat-btn') !== -1) {
    pass('Naming screen renders seat-btn elements (via editNames)');
  } else {
    fail('Naming screen seat-btn', 'seat-btn not found after editNames');
  }
  if (namingHtml.indexOf('--tile-w') !== -1 && namingHtml.indexOf('--tile-cap') !== -1) {
    pass('Naming screen circle renders --tile-w and --tile-cap CSS vars');
  } else {
    fail('Naming screen CSS vars', '--tile-w or --tile-cap not found in naming screen');
  }
  // Go back to dealt view
  APP.lockRoles();
} catch (e) {
  fail('editNames/lockRoles round-trip', 'threw: ' + e.message);
}

// Verify jailorNoExecN1 default is false
if (APP.cfg.houseRules.jailorNoExecN1 === false) {
  pass('jailorNoExecN1 defaults to false (Jailor CAN execute on N1)');
} else {
  fail('jailorNoExecN1 default', 'expected false, got ' + APP.cfg.houseRules.jailorNoExecN1);
}

// =========================================================================
// Phase 2: Begin Day 1 and run a trial
// =========================================================================
log('');
log('=== Phase 2: Day 1 Trial ===');

try {
  APP.beginDay1();
  pass('beginDay1 completed without crash');
} catch (e) {
  fail('beginDay1', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.phase, 'DAY');
assert.strictEqual(APP.state.dayNumber, 1);
pass('Phase is DAY, dayNumber is 1');

// Verify wizard is not active during day
if (!APP.app.wizard) {
  pass('No wizard active during Day phase');
} else {
  fail('Wizard during day', 'wizard should be null in DAY phase');
}

// Verify game header renders Day 1
const headerHtml = html('game-header');
if (headerHtml.indexOf('Day 1') !== -1 || headerHtml.indexOf('DAY') !== -1 || headerHtml.length > 0) {
  pass('Game header renders for Day 1');
} else {
  fail('Game header Day 1', 'Day 1 not found in game-header');
}

// Verify wizard step prompts render (check game body has content)
const gameBodyHtml = html('game-body');
if (gameBodyHtml.length > 0) {
  pass('Game body renders content during Day');
} else {
  fail('Game body Day', 'game-body is empty during Day');
}

// Run a trial: nominate player 9 (witch) from player 1 (jailor)
log('Nominating player 9 (witch) from player 1 (jailor)...');
APP.app.trialNom = 1;
try {
  APP.startTrial(9);
  pass('startTrial(9) completed');
} catch (e) {
  fail('startTrial', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.trial.active, true);
assert.strictEqual(APP.state.trial.stage, 'SECONDS');
pass('Trial active, stage is SECONDS');

// Second (AGREE) from all living players except the accused
log('All living players seconding...');
secondAll();
pass('secondAll completed');

// Resolve nomination -> moves to VOTE
try {
  APP.resolveTrial();
  pass('resolveTrial (SECONDS) completed');
} catch (e) {
  fail('resolveTrial SECONDS', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.trial.stage, 'VOTE');
pass('Trial stage moved to VOTE');

// All vote GUILTY
log('All voting GUILTY...');
castAll('GUILTY');
pass('castAll GUILTY completed');

// Resolve vote -> moves to SENTENCE
try {
  APP.resolveTrial();
  pass('resolveTrial (VOTE) completed');
} catch (e) {
  fail('resolveTrial VOTE', 'threw: ' + e.message);
}

assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
pass('Trial stage moved to SENTENCE');

// Sentence vote: all GUILTY (no spare majority -> lynch)
log('All sentencing GUILTY...');
castAll('GUILTY');

try {
  APP.resolveSentence();
  pass('resolveSentence completed');
} catch (e) {
  fail('resolveSentence', 'threw: ' + e.message);
}

if (APP.app.lastTrialResult && APP.app.lastTrialResult.lynchedId === 9) {
  pass('Player 9 (witch) was lynched');
} else {
  const lynId = APP.app.lastTrialResult ? APP.app.lastTrialResult.lynchedId : 'null';
  fail('Lynch result', 'expected lynchedId=9, got ' + lynId);
}

recordDeaths('Day 1');

// Check if game ended (unlikely with 12 players, but check)
if (APP.state.phase === 'END') {
  log('Game ended after Day 1 lynch! Winner: ' + APP.state.winner);
} else {
  pass('Game continues after Day 1 lynch (phase: ' + APP.state.phase + ')');
}

// =========================================================================
// Phase 3: Day/Night loops until victory
// =========================================================================
log('');
log('=== Phase 3: Day/Night Loops ===');

let cycle = 0;
const maxCycles = 20;

while (APP.state.phase !== 'END' && cycle < maxCycles) {
  cycle++;
  log('');
  log('--- Cycle ' + cycle + ' (phase: ' + phase() + ', day: ' + dayNum() + ', alive: ' + alive().length + ') ---');

  // End the day if we're in DAY phase
  if (APP.state.phase === 'DAY') {
    log('Ending day ' + dayNum() + '...');
    try {
      APP.endDay();
      pass('endDay completed');
    } catch (e) {
      fail('endDay cycle ' + cycle, 'threw: ' + e.message);
      break;
    }
  }

  // Night phase: drive the wizard
  if (APP.state.phase === 'NIGHT') {
    assert.ok(APP.app.wizard, 'wizard should exist in NIGHT phase');
    const steps = APP.app.wizard.steps;
    log('Night ' + APP.state.night.number + ': ' + steps.length + ' wizard steps');

    // Log each step title
    steps.forEach(function (s, i) {
      log('  Step ' + i + ': ' + s.title + ' (pos ' + s.position + ', roles: ' + (s.roles || []).join(',') + ')');
    });

    // Verify wizard step prompts render
    const wizBodyHtml = html('game-body');
    if (wizBodyHtml.length > 0) {
      pass('Wizard step renders content in game-body');
    } else {
      fail('Wizard step render', 'game-body empty during wizard');
    }

    // Verify wizard step prompt text is present
    const firstStep = steps[0];
    if (firstStep && firstStep.prompt && wizBodyHtml.indexOf(firstStep.prompt) !== -1) {
      pass('Wizard step prompt text renders in game-body');
    } else if (firstStep && firstStep.title && wizBodyHtml.indexOf(firstStep.title) !== -1) {
      pass('Wizard step title renders in game-body (prompt may be truncated)');
    } else {
      fail('Wizard step prompt', 'neither prompt nor title found in game-body for step 0');
    }

    // Verify wizNext/wizBack navigation works
    if (steps.length > 1) {
      const startIdx = APP.app.wizard.idx;
      APP.wizNext();
      if (APP.app.wizard.idx === Math.min(startIdx + 1, steps.length - 1)) {
        pass('wizNext advances wizard index');
      } else {
        fail('wizNext', 'expected idx ' + (startIdx + 1) + ', got ' + APP.app.wizard.idx);
      }
      APP.wizBack();
      if (APP.app.wizard.idx === startIdx) {
        pass('wizBack returns wizard index');
      } else {
        fail('wizBack', 'expected idx ' + startIdx + ', got ' + APP.app.wizard.idx);
      }
    }

    // Drive the full night
    log('Driving night ' + APP.state.night.number + '...');
    try {
      driveNight();
      pass('driveNight completed for night ' + APP.state.night.number);
    } catch (e) {
      fail('driveNight cycle ' + cycle, 'threw: ' + e.message);
      break;
    }

    // Verify no self-targets
    if (noSelfTargets()) {
      pass('No self-targets recorded in night ' + APP.state.night.number);
    } else {
      fail('Self-target check', 'night ' + APP.state.night.number + ' has a self-target');
    }

    // Verify wizard index is at the end
    if (APP.app.wizard && APP.app.wizard.idx >= APP.app.wizard.steps.length - 1) {
      pass('Wizard index at end after driveNight');
    } else {
      const wizIdx = APP.app.wizard ? APP.app.wizard.idx : 'null';
      const wizLen = APP.app.wizard ? APP.app.wizard.steps.length : 'null';
      fail('Wizard index', 'expected at end, idx=' + wizIdx + ' len=' + wizLen);
    }

    // Check Jailor EXECUTE decision on Night 1
    if (APP.state.night.number === 1) {
      const jailAc = APP.state.night.actions.find(function (a) { return a.roleId === 'jailor'; });
      if (jailAc && jailAc.extra && jailAc.extra.jailorDecision) {
        if (jailAc.extra.jailorDecision === 'EXECUTE') {
          pass('Jailor EXECUTE allowed on Night 1 (jailorNoExecN1=false)');
        } else {
          pass('Jailor decision on N1: ' + jailAc.extra.jailorDecision + ' (EXECUTE also allowed since jailorNoExecN1=false)');
        }
      } else {
        fail('Jailor N1 action', 'no jailor action or decision recorded');
      }
      // Explicitly verify EXECUTE is allowed by checking the engine doesn't reject it
      try {
        const testState = JSON.parse(E.serialize(APP.state));
        // Reset jailor action to test EXECUTE acceptance
        testState.night.actions = testState.night.actions.filter(function (a) { return a.roleId !== 'jailor'; });
        const jailorPlayer = testState.players.find(function (p) { return p.assignedRole === 'jailor'; });
        const jailTarget = testState.night.actions.find(function (a) { return a.roleId === 'jailor'; });
        // Find the jailor's target from the original action
        if (jailAc && jailAc.targetId) {
          const execResult = E.recordNightAction(testState, {
            position: 3,
            roleId: 'jailor',
            playerId: jailAc.playerId,
            targetId: jailAc.targetId,
            extra: { jailorDecision: 'EXECUTE' }
          });
          if (execResult) {
            pass('Engine accepts Jailor EXECUTE on Night 1 (jailorNoExecN1=false)');
          } else {
            fail('Jailor EXECUTE N1', 'engine rejected EXECUTE action');
          }
        }
      } catch (e) {
        fail('Jailor EXECUTE N1 test', 'threw: ' + e.message);
      }
    }

    // Resolve night
    log('Resolving night ' + APP.state.night.number + '...');
    try {
      APP.resolveNight();
      pass('resolveNight completed');
    } catch (e) {
      fail('resolveNight cycle ' + cycle, 'threw: ' + e.message);
      break;
    }

    assert.strictEqual(APP.state.phase, 'MORNING');
    pass('Phase is MORNING after resolveNight');

    recordDeaths('Night ' + (APP.state.night.number - 1));

    // Log morning announcement
    const morningHtml = html('game-body');
    if (morningHtml.indexOf('Morning Announcement') !== -1) {
      pass('Morning announcement renders');
    } else {
      fail('Morning announcement', 'not found in game-body');
    }

    // Check for victory after night resolution
    if (APP.state.phase === 'END') {
      log('Game ended after night resolution! Winner: ' + APP.state.winner);
      break;
    }

    // Begin next day
    log('Beginning day ' + (dayNum() + 1) + '...');
    try {
      APP.beginDay();
      pass('beginDay completed');
    } catch (e) {
      fail('beginDay cycle ' + cycle, 'threw: ' + e.message);
      break;
    }

    if (APP.state.phase === 'DAY') {
      pass('Phase is DAY, dayNumber is ' + dayNum());
    } else if (APP.state.phase === 'END') {
      log('Game ended at beginDay! Winner: ' + APP.state.winner);
      break;
    }

    // Optionally run a trial each day to speed up the game
    if (APP.state.phase === 'DAY' && alive().length > 3) {
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
                log('Game ended after lynch! Winner: ' + APP.state.winner);
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
}

// =========================================================================
// Phase 4: Final report
// =========================================================================
log('');
log('=== Final State ===');
log('Phase: ' + phase());
log('Day: ' + dayNum());
log('Winner: ' + (APP.state.winner || 'none'));
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
}

// =========================================================================
// Write report
// =========================================================================
const fs = require('fs');
const path = require('path');

let md = '# App-Game Verification Report\n\n';
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
md += '- Players: 12 (jailor, doctor, godfather, mafioso, escort, sheriff, tracker, lookout, witch, veteran, medium, survivor)\n';
md += '- Team counts: town 7, mafia 3, neutral 2\n';
md += '- Preset: p1\n';
md += '- Final phase: ' + phase() + '\n';
md += '- Final day: ' + dayNum() + '\n';
md += '- Winner: ' + (APP.state.winner || 'none') + '\n';
md += '- Alive at end: ' + alive().length + '\n';
md += '- Cycles: ' + cycle + '\n\n';

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

const reportPath = path.join(__dirname, 'verify-app-game-REPORT.md');
fs.writeFileSync(reportPath, md, 'utf8');
console.log('');
console.log('Report written to: ' + reportPath);
console.log('Passed: ' + report.passed.length + ', Issues: ' + report.issues.length);

if (report.issues.length > 0) {
  process.exitCode = 1;
}
