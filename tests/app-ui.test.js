'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  APP, engine, els, html, roleButton, startRoles,
  driveNight, secondAll, castAll, firstLivingNot
} = require('./helpers.js');
require('../js/ui/helper.js');
const E = engine;
E.setLocale('en');

function cardRegion(h, marker, key) {
  const idx = h.indexOf('data-card="' + key + '"');
  assert.ok(idx !== -1, key + ' card renders a collapse button');
  return h.slice(h.lastIndexOf(marker, idx), h.indexOf('id="card-body-' + key + '"'));
}

describe('app UI layer', () => {

  test('naming grid renders tappable seat buttons and no inline inputs', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    const h = html('seats-body');
    assert.ok(h.indexOf('seat-btn') !== -1);
    assert.ok(h.indexOf('data-action="open-naming-sheet"') !== -1);
    assert.ok(h.indexOf('seat-name-input') === -1);
    assert.ok(h.indexOf('data-action="seat-role"') === -1);
    assert.ok(h.indexOf('left to assign') !== -1);
    APP.closeSheet();
  });

  test('naming sheet civilian option is gated by deck civilian capacity', () => {
    APP.newGame();
    APP.cfg.presetId = 'p1';
    APP.cfg.deckConfig = {
      town: engine.PRESETS.p1.town.slice(),
      mafia: engine.PRESETS.p1.mafia.slice(),
      neutral: engine.PRESETS.p1.neutral.slice()
    };
    APP.cfg.playerCount = 8;
    APP.startGame();
    assert.strictEqual(APP.state.deck.indexOf('civilian'), -1);
    APP.openNamingSheet(1);
    let h = html('sheet-root');
    assert.ok(h.indexOf('data-role="civilian"') === -1);
    assert.ok(h.indexOf('data-role="sheriff"') !== -1);
    APP.closeSheet();

    APP.newGame();
    APP.cfg.playerCount = 15;
    APP.cfg.teamCounts = { town: 9, mafia: 4, neutral: 2 };
    APP.cfg.deckConfig.town = ['jailor', 'undertaker', 'medium', 'doctor', 'sheriff', 'tracker', 'retributionist'];
    APP.startGame();
    const civCount = APP.state.deck.filter(function (r) { return r === 'civilian'; }).length;
    assert.ok(civCount >= 1, 'p1 at 15 players should include civilians');
    APP.openNamingSheet(1);
    assert.ok(html('sheet-root').indexOf('data-role="civilian"') !== -1);
    APP.closeSheet();

    APP.app.pendingRoles = { 1: 'civilian' };
    APP.openNamingSheet(2);
    assert.ok(html('sheet-root').indexOf('data-role="civilian"') !== -1);
    APP.closeSheet();
    APP.app.pendingRoles = { 1: 'civilian', 2: 'civilian' };
    APP.openNamingSheet(3);
    assert.ok(html('sheet-root').indexOf('data-role="civilian"') === -1);
    APP.closeSheet();

    APP.app.pendingRoles = { 1: 'sheriff' };
    APP.openNamingSheet(2);
    assert.ok(html('sheet-root').indexOf('data-role="sheriff"') !== -1);
    assert.ok(html('sheet-root').indexOf('TAKEN') !== -1);
    APP.closeSheet();
    APP.openNamingSheet(1);
    assert.ok(html('sheet-root').indexOf('data-role="sheriff"') !== -1);
    APP.closeSheet();
  });

  test('naming grid shows the pending role under each seat name', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.app.pendingRoles = { 3: 'sheriff', 5: 'doctor' };
    APP.afterMutation();
    const h = html('seats-body');
    const seat3 = h.slice(h.indexOf('data-seat="3"'), h.indexOf('data-seat="4"'));
    assert.ok(seat3.indexOf('seat-btn-role') !== -1);
    assert.ok(seat3.indexOf('Sheriff') !== -1);
    const seat4 = h.slice(h.indexOf('data-seat="4"'), h.indexOf('data-seat="5"'));
    assert.ok(seat4.indexOf('&ndash;') !== -1);
    const seat5 = h.slice(h.indexOf('data-seat="5"'), h.indexOf('data-seat="6"'));
    assert.ok(seat5.indexOf('Doctor') !== -1);
    APP.closeSheet();
  });

  test('naming picker lists taken roles as disabled rows and keeps the current seat role enabled', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'jailor' };
    APP.openNamingSheet(2);
    const h = html('sheet-root');
    const jailor = roleButton(h, 'jailor');
    assert.ok(jailor.indexOf('disabled') !== -1);
    assert.ok(jailor.indexOf('TAKEN') !== -1);
    assert.ok(jailor.indexOf('aria-selected="true"') === -1);
    const sheriff = roleButton(h, 'sheriff');
    assert.ok(sheriff.indexOf('disabled') === -1);
    assert.ok(h.indexOf('No role yet') !== -1);
    assert.ok(h.indexOf('Currently:') === -1);
    APP.closeSheet();
  });

  test('naming sheet marks the current seat pending role pill as on', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'jailor', 2: 'sheriff' };
    APP.openNamingSheet(2);
    const h = html('sheet-root');
    const sheriff = roleButton(h, 'sheriff');
    assert.ok(sheriff.indexOf('seat-sheet-role-btn btn btn-sm on') !== -1);
    assert.ok(sheriff.indexOf('aria-selected="true"') !== -1);
    assert.ok(sheriff.indexOf('disabled') === -1);
    assert.ok(h.indexOf('Currently: <strong>Sheriff</strong>') !== -1);
    const jailor = roleButton(h, 'jailor');
    assert.ok(jailor.indexOf('disabled') !== -1);
    assert.ok(jailor.indexOf('class="seat-sheet-role-btn btn btn-sm on"') === -1);
    APP.closeSheet();
  });

  test('clear-role deselects the picked role and save drops the pending role', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 2: 'sheriff' };
    APP.openNamingSheet(2);
    let h = html('sheet-root');
    assert.ok(h.indexOf('data-action="clear-role"') !== -1, 'clear button shows when a role is selected');
    assert.ok(h.indexOf('Currently: <strong>Sheriff</strong>') !== -1);
    let sheriff = roleButton(h, 'sheriff');
    assert.ok(sheriff.indexOf('seat-sheet-role-btn btn btn-sm on') !== -1);
    assert.ok(sheriff.indexOf('aria-selected="true"') !== -1);

    APP.clearRole();
    assert.strictEqual(APP.app.sheet.role, '');
    h = html('sheet-root');
    assert.ok(h.indexOf('data-action="clear-role"') === -1, 'clear button hides when no role is selected');
    assert.ok(h.indexOf('No role yet') !== -1);
    assert.ok(h.indexOf('Currently:') === -1);
    sheriff = roleButton(h, 'sheriff');
    assert.ok(sheriff.indexOf('seat-sheet-role-btn btn btn-sm on') === -1);
    assert.ok(sheriff.indexOf('aria-selected="true"') === -1);

    APP.saveSeat();
    assert.ok(!APP.app.pendingRoles[2], 'pending role removed on save after clearing');
    APP.afterMutation();
    const grid = html('seats-body');
    const seat2 = grid.slice(grid.indexOf('data-seat="2"'), grid.indexOf('data-seat="3"'));
    assert.ok(seat2.indexOf('&ndash;') !== -1, 'seat shows no role after clearing');
    APP.closeSheet();
  });

  test('night actions overview marks an unacted role pending and a recorded one done', () => {
    const roles = ['sheriff', 'doctor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    startRoles(6, { town: 4, mafia: 2, neutral: 0 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.app.mode = 'helper';
    APP.app.collapsed = {};
    APP.renderScreen('game');
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="helper-night-actions"') !== -1);
    let cardBody = h.slice(h.indexOf('id="card-body-helper-night-actions"'), h.indexOf('data-card="helper-players"'));
    assert.ok(cardBody.indexOf('PENDING') !== -1, 'unacted role is listed as pending');
    const sher = APP.state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    assert.ok(E.recordNightAction(APP.state, {
      position: 11, roleId: 'sheriff', playerId: sher.id, targetId: firstLivingNot(sher.id)
    }));
    APP.afterMutation();
    h = html('game-body');
    cardBody = h.slice(h.indexOf('id="card-body-helper-night-actions"'), h.indexOf('data-card="helper-players"'));
    assert.ok(cardBody.indexOf('DONE') !== -1, 'recorded role is listed as done');
  });

  test('detail sheet shows the per-player activity log after a resolved night', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    const doc = APP.state.players.find(function (p) { return p.assignedRole === 'doctor'; });
    const log = (APP.state.playerLog[String(doc.id)] || []).map(function (e) { return e.text; });
    assert.ok(log.some(function (t) { return t.indexOf('assigned') !== -1; }));
    assert.ok(log.some(function (t) { return t.indexOf('targeted') !== -1; }));
    APP.openDetailSheet(String(doc.seat));
    const h = html('sheet-root');
    assert.ok(h.indexOf('Activity Log') !== -1);
    assert.ok(h.indexOf('seat-sheet-role-name') !== -1);
    assert.ok(h.indexOf('assigned') !== -1);
    assert.ok(h.indexOf('targeted') !== -1);
    assert.ok(h.indexOf('ALIVE') !== -1);
    assert.ok(h.indexOf('log-kind-tag') !== -1);
    assert.ok(h.indexOf('data-kind=') !== -1);
    APP.closeSheet();
  });

  test('dispatching wizard-jump from a summary row moves back to that actor step', () => {
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
    APP.dispatch('wizard-jump', { getAttribute: function (k) { return k === 'data-index' ? '0' : null; } });
    assert.strictEqual(APP.app.wizard.idx, 0);
    assert.ok(html('game-body').indexOf('Doctor') !== -1, 'rendered step is the jumped-to Doctor step');
  });

  test('pick-role updates the open naming sheet in place without remounting', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'sheriff' };
    APP.openNamingSheet(1);
    const before = html('sheet-root');
    assert.ok(before.indexOf('Currently: <strong>Sheriff</strong>') !== -1);

    const sheetCls = { 'seat-sheet': true, open: true };
    const sheetEl = {
      classList: {
        contains(c) { return !!sheetCls[c]; }
      }
    };
    const strong = { textContent: '' };
    const buttons = [];
    const btnRe = /<button class="seat-sheet-role-btn btn btn-sm([^"]*)" role="option" aria-selected="(true|false)"[^>]*data-role="([^"]+)"/g;
    let m;
    while ((m = btnRe.exec(before))) {
      const cls = {};
      if (m[1].indexOf(' on') !== -1) cls.on = true;
      const attrs = { 'data-role': m[3], 'aria-selected': m[2] };
      buttons.push({
        classList: {
          add(c) { cls[c] = true; },
          remove(c) { delete cls[c]; },
          contains(c) { return !!cls[c]; }
        },
        getAttribute(k) { return attrs[k] != null ? attrs[k] : null; },
        setAttribute(k, v) { attrs[k] = v; },
        focus() {}
      });
    }
    const sheriffBtn = buttons.find(function (b) { return b.getAttribute('data-role') === 'sheriff'; });
    const jailorBtn = buttons.find(function (b) { return b.getAttribute('data-role') === 'jailor'; });
    assert.ok(sheriffBtn && sheriffBtn.classList.contains('on'));
    assert.ok(jailorBtn && !jailorBtn.classList.contains('on'));

    const origHost = els['sheet-root'];
    els['sheet-root'] = {
      id: 'sheet-root',
      innerHTML: before,
      sheetEl: sheetEl,
      strong: strong,
      buttons: buttons,
      querySelectorAll: function (sel) { return sel === '.seat-sheet-role-btn' ? this.buttons : []; },
      querySelector: function (sel) {
        if (sel === '.seat-sheet.open') return this.sheetEl;
        if (sel === '.seat-sheet-role-btn.on') {
          return this.buttons.find(function (b) { return b.classList.contains('on'); }) || null;
        }
        if (sel === '.seat-sheet-current strong') return this.strong;
        return null;
      }
    };
    try {
      APP.pickRole({ getAttribute: function (k) { return k === 'data-role' ? 'jailor' : null; } });
      assert.ok(jailorBtn.classList.contains('on'));
      assert.ok(!sheriffBtn.classList.contains('on'));
      assert.strictEqual(jailorBtn.getAttribute('aria-selected'), 'true');
      assert.strictEqual(sheriffBtn.getAttribute('aria-selected'), 'false');
      assert.strictEqual(strong.textContent, 'Jailor');
      assert.strictEqual(html('sheet-root'), before, 'the sheet innerHTML must not be rewritten');
      assert.ok(sheetEl.classList.contains('open'), 'the sheet must stay open');
      assert.strictEqual(APP.app.sheet.role, 'jailor');
    } finally {
      els['sheet-root'] = origHost;
    }
  });

  test('mountSheet does not re-run the open animation on an already-open sheet', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.openNamingSheet(1);
    const prevRaf = globalThis.requestAnimationFrame;
    const origHost = els['sheet-root'];
    let rafCalls = 0;
    globalThis.requestAnimationFrame = function (cb) { rafCalls += 1; cb(); return 0; };
    try {
      els['sheet-root'] = {
        id: 'sheet-root',
        innerHTML: html('sheet-root'),
        querySelector: function (sel) {
          return sel === '.seat-sheet.open' && this.innerHTML.indexOf('seat-sheet') !== -1 ? this.sheetEl : null;
        },
        querySelectorAll: function () { return []; },
        sheetEl: { classList: { add: function () {} } }
      };
      APP.updateSheetDom();
      assert.strictEqual(rafCalls, 0, 're-mounting an open sheet must not re-add .open via rAF');
      APP.closeSheet();
      APP.openNamingSheet(2);
      assert.strictEqual(rafCalls, 1, 'a fresh sheet mount still animates via rAF');
    } finally {
      els['sheet-root'] = origHost;
      if (prevRaf === undefined) delete globalThis.requestAnimationFrame;
      else globalThis.requestAnimationFrame = prevRaf;
    }
  });

  test('night wizard living-target buttons show the target role next to the name', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    assert.strictEqual(APP.state.night.number, 1);
    APP.wizActor('doctor', 3);
    APP.wizTarget(1);
    APP.wizNext();
    assert.strictEqual(APP.app.wizard.steps[APP.app.wizard.idx].position, 6);
    const h = html('game-body');
    assert.ok(h.indexOf('A \u00B7 Civilian') !== -1);
    assert.ok(h.indexOf('D \u00B7 Sheriff') !== -1);
    assert.ok(h.indexOf('F \u00B7 Mafioso') !== -1);
    assert.ok(h.indexOf('G \u00B7 Jester') !== -1);
    assert.ok(h.indexOf('E \u00B7 Godfather') === -1, 'the kill leader is excluded from the target list');
  });

  test('recorded wizard action raises a toast offering undo of just that recording', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    APP.wizActor('doctor', 3);
    APP.wizTarget(1);
    const t = html('toast');
    assert.ok(t.indexOf('data-toast-action="undo"') !== -1, 'toast should offer a tappable Undo for the recorded action');
    assert.ok(t.indexOf('Recorded:') !== -1 && t.indexOf('Doctor') !== -1, 'toast summarizes the recorded action');
  });

  test('night wizard corpse buttons show the stored corpse role next to the name', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'undertaker', 'godfather', 'mafioso', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'U', 6: 'E', 7: 'F', 8: 'S' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names, { noLynchD1: false });
    APP.beginDay1();
    APP.app.trialNom = 2;
    APP.startTrial(1);
    secondAll();
    APP.resolveTrial();
    castAll('GUILTY');
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
    castAll('GUILTY');
    APP.resolveSentence();
    assert.ok(!APP.state.players[0].isAlive, 'player 1 should be lynched on day 1');
    assert.strictEqual(APP.state.phase, 'DAY');
    assert.ok(APP.state.graveyard.length === 1);
    APP.endDay();
    assert.strictEqual(APP.state.night.number, 1);
    APP.wizActor('doctor', 3);
    APP.wizTarget(2);
    APP.wizNext();
    APP.wizNext();
    APP.wizActor('sheriff', 4);
    APP.wizTarget(2);
    APP.wizNext();
    const ustep = APP.app.wizard.steps[Math.min(APP.app.wizard.idx, APP.app.wizard.steps.length - 1)];
    assert.strictEqual(ustep.title, 'Undertaker');
    APP.wizActor('undertaker', 5);
    const h = html('game-body');
    assert.ok(h.indexOf('A \u00B7 Civilian') !== -1);
  });

});

describe('moderator toolbox', () => {

  test('Night Zero checklist derives rows from state and toggling marks them done', () => {
    const roles = ['sheriff', 'jailor', 'doctor', 'civilian', 'civilian', 'civilian', 'civilian',
      'godfather', 'mafioso', 'consigliere', 'executioner', 'witch'];
    startRoles(12, { town: 7, mafia: 3, neutral: 2 }, roles);
    let h = html('seats-body');
    assert.ok(h.indexOf('Night Zero') !== -1);
    assert.ok(h.indexOf('GF: bluff as') !== -1);
    assert.ok(h.indexOf('data-nz="bluffs"') !== -1);
    assert.ok(h.indexOf('data-nz="witch"') !== -1);
    assert.ok(h.indexOf('Executioner target:') !== -1);
    assert.ok(h.indexOf('data-nz="deal"') !== -1);
    assert.ok(h.indexOf('0/4 done') !== -1);
    assert.ok(h.indexOf('data-nz="relays"') === -1);
    APP.nzToggle('bluffs');
    h = html('seats-body');
    const bluffsRow = h.slice(h.indexOf('data-nz="bluffs"') - 80, h.indexOf('data-nz="bluffs"') + 5);
    assert.ok(bluffsRow.indexOf('toggle-row on') !== -1);
    assert.ok(h.indexOf('1/4 done') !== -1);
    APP.nzToggle('bluffs');
    assert.ok(html('seats-body').indexOf('0/4 done') !== -1);
  });

  test('tokens panel lists info entries and the relay hint after a resolved night', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    const sheriff = APP.state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    const infos = ((APP.state.playerLog[String(sheriff.id)] || [])).filter(function (e) { return e.kind === 'info'; });
    assert.ok(infos.length >= 1, 'sheriff should have an info entry after the night');
    APP.toggleTokens();
    const h = html('panel-root');
    assert.ok(h.indexOf('Info Tokens') !== -1);
    assert.ok(h.indexOf('Show the token to the player before they wake') !== -1);
    assert.ok(h.indexOf('Sheriff check on') !== -1);
    assert.ok(h.indexOf('tag-accent') !== -1);
  });

  test('claims panel records a claim and survives a save/load round trip', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.toggleClaims();
    assert.ok(html('panel-root').indexOf('Public Claims') !== -1);
    assert.ok(html('panel-root').indexOf('No claim') !== -1);
    APP.claimOpen(1);
    assert.ok(html('panel-root').indexOf('Claim for') !== -1);
    assert.ok(html('panel-root').indexOf('claim-team-head') !== -1);
    APP.claimPick(1, 'sheriff');
    assert.ok(html('panel-root').indexOf('claim-chip on') !== -1);
    assert.ok(html('panel-root').indexOf('claim-chip on">Sheriff') !== -1);
    APP.save();
    APP.resumeGame();
    assert.strictEqual(APP.app.claims['1'], 'sheriff');
    APP.toggleClaims();
    APP.toggleClaims();
    assert.ok(html('panel-root').indexOf('Public Claims') !== -1);
    assert.ok(html('panel-root').indexOf('claim-chip on') !== -1);
    APP.claimOpen(1);
    APP.claimClear(1);
    assert.ok(html('panel-root').indexOf('No claim') !== -1);
  });

  test('role picker orders pills by team then alphabetically, current role pinned first', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    APP.state.deck = ['sheriff', 'jailor', 'godfather', 'mafioso', 'civilian', 'civilian'];
    APP.app.pendingRoles = { 1: 'jailor' };
    APP.openNamingSheet(2);
    let h = html('sheet-root');
    assert.ok(h.indexOf('data-role="jailor"') < h.indexOf('data-role="sheriff"'), 'alphabetical within Town');
    assert.ok(h.indexOf('data-role="sheriff"') < h.indexOf('data-role="godfather"'), 'Town before Mafia');
    APP.closeSheet();
    APP.app.pendingRoles = { 1: 'jailor', 2: 'sheriff' };
    APP.openNamingSheet(2);
    h = html('sheet-root');
    assert.ok(h.indexOf('data-role="sheriff"') < h.indexOf('data-role="jailor"'), 'current role pinned first');
    APP.closeSheet();
  });

  test('wizard shows the Step counter and a Resolve Night banner on the final step', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    assert.ok(html('game-body').indexOf('wizard-progress') !== -1);
    assert.ok(html('game-body').indexOf('Step 1 of') !== -1);
    while (APP.app.wizard.idx < APP.app.wizard.steps.length - 1) {
      APP.wizNext();
    }
    assert.ok(html('game-body').indexOf('Resolve Night') !== -1);
  });

  test('claims live only in the top-menu panel: pick, clear, and seat-tile chips', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    assert.strictEqual(APP.state.dayNumber, 1);
    let h = html('game-body');
    assert.ok(h.indexOf('claim-round-card') === -1, 'no claim round card on Day 1');
    assert.ok(h.indexOf('data-action="claim-round-edit"') === -1);
    APP.toggleClaims();
    h = html('panel-root');
    assert.ok(h.indexOf('Public Claims') !== -1);
    assert.ok(h.indexOf('No claim') !== -1);
    assert.ok(h.indexOf('A') !== -1 && h.indexOf('H') !== -1, 'every living player is listed');
    APP.claimOpen(3);
    assert.ok(html('panel-root').indexOf('Claim for C') !== -1);
    assert.ok(html('panel-root').indexOf('claim-team-head') !== -1);
    APP.claimPick(3, 'doctor');
    assert.strictEqual(APP.app.claims['3'], 'doctor');
    h = html('panel-root');
    assert.ok(h.indexOf('claim-chip on') !== -1);
    assert.ok(h.indexOf('claim-chip on">Doctor') !== -1);
    APP.app.seatOverlay = true;
    APP.afterMutation();
    assert.ok(html('game-body').indexOf('seat-claim') !== -1, 'seat overlay renders claim chips');
    APP.app.seatOverlay = false;
    APP.afterMutation();
    APP.claimOpen(3);
    APP.claimClear(3);
    assert.strictEqual(APP.app.claims['3'], undefined, 'clear removes the claim');
    assert.ok(html('panel-root').indexOf('No claim') !== -1);
  });

  test('Mod panel opens from the header with kill controls and a disabled undo on an empty graveyard', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    let h = html('sidebar-body');
    assert.ok(h.indexOf('data-action="toggle-mod"') !== -1, 'Mod item in the sidebar');
    assert.ok(h.indexOf('Mod</div>') !== -1);
    assert.ok(html('game-header').indexOf('toggle-mod') === -1, 'Mod button removed from header');
    assert.ok(h.indexOf('Kill Player') === -1, 'moderator controls are not in the day body');
    APP.toggleMod();
    h = html('panel-root');
    assert.ok(h.indexOf('panel-overlay') !== -1, 'mod panel renders as a panel overlay');
    assert.ok(h.indexOf('>Moderator</h2>') !== -1);
    assert.ok(h.indexOf('Kill Player') !== -1);
    assert.ok(h.indexOf('Undo Last Kill') !== -1);
    assert.ok(h.indexOf('data-action="undo-kill" disabled') !== -1, 'undo disabled with an empty graveyard');
    assert.ok(h.indexOf('moderator overrides') !== -1);
    APP.toggleMod();
    assert.strictEqual(html('panel-root'), '', 'toggle closes the mod panel');
  });

  test('Mod panel Kill Player opens the living-player picker during MORNING', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    APP.toggleMod();
    APP.killPlayer();
    const h = html('game-body');
    assert.ok(h.indexOf('picker-card') !== -1, 'picker card renders in MORNING');
    assert.ok(h.indexOf('Pick a living player.') !== -1, 'picker sub text renders');
    assert.ok(h.indexOf('data-action="pick-day-target"') !== -1, 'living player buttons render');
    const target = APP.state.players.find(function (p) { return p.isAlive; });
    assert.ok(target, 'a living player exists in MORNING');
    APP.doDayAbility('moderator-kill', target.id);
    assert.strictEqual(target.isAlive, false, 'moderator kill lands in MORNING');
  });

  test('game header shows the phase clock with the right data-phase and data-cycle', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    let h = html('game-header');
    assert.ok(h.indexOf('class="cycle-clock"') !== -1, 'clock in the header after beginDay');
    assert.ok(h.indexOf('data-phase="DAY"') !== -1, 'DAY phase after beginDay');
    assert.ok(h.indexOf('data-cycle="1"') !== -1, 'day 1 cycle after beginDay');
    assert.ok(h.indexOf('aria-label="Day 1"') !== -1, 'Day 1 label after beginDay');
    assert.ok(h.indexOf('cycle-clock-arc arc-night') !== -1, 'all four clock arcs render');
    APP.endDay();
    h = html('game-header');
    assert.ok(h.indexOf('data-phase="NIGHT"') !== -1, 'NIGHT phase after the night starts');
    assert.ok(h.indexOf('data-cycle="1"') !== -1, 'night 1 cycle after the night starts');
    assert.ok(h.indexOf('aria-label="Night 1"') !== -1, 'Night 1 label after the night starts');
    driveNight();
    APP.resolveNight();
    h = html('game-header');
    assert.ok(h.indexOf('data-phase="MORNING"') !== -1, 'MORNING phase after the night resolves');
    assert.ok(h.indexOf('data-cycle="1"') !== -1, 'morning 1 cycle after the night resolves');
    APP.beginDay();
    h = html('game-header');
    assert.ok(h.indexOf('data-phase="DAY"') !== -1, 'DAY phase after the next beginDay');
    assert.ok(h.indexOf('data-cycle="2"') !== -1, 'day 2 cycle after the next beginDay');
    assert.ok(h.indexOf('aria-label="Day 2"') !== -1, 'Day 2 label after the next beginDay');
  });

  test('discussion timer nudges +10s and -10s and clamps to a stop', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    let h = html('game-body');
    assert.ok(h.indexOf('data-action="adjust-day-timer"') === -1, 'no nudge buttons while idle');
    assert.ok(h.indexOf('data-action="start-day-timer" data-seconds="60"') !== -1, 'preset buttons stay');
    APP.app.dayTimerEnds = Date.now() + 120 * 1000;
    APP.app.dayTimerTotal = 120;
    APP.afterMutation();
    h = html('game-body');
    assert.ok(h.indexOf('data-delta="-10"') !== -1, '-10s button while running');
    assert.ok(h.indexOf('data-delta="10"') !== -1, '+10s button while running');
    assert.ok(h.indexOf('data-action="stop-day-timer"') !== -1, 'Stop button stays while running');
    const before = APP.app.dayTimerEnds;
    APP.adjustDayTimer(10);
    assert.strictEqual(APP.app.dayTimerEnds, before + 10000, 'end time moves +10s');
    assert.strictEqual(APP.app.dayTimerTotal, 130, 'total tracks the nudge');
    APP.adjustDayTimer(-10);
    assert.strictEqual(APP.app.dayTimerEnds, before, 'end time moves back -10s');
    assert.strictEqual(APP.app.dayTimerTotal, 120, 'total tracks the -10s nudge');
    APP.app.dayTimerEnds = null;
    APP.app.dayTimerTotal = null;
    APP.adjustDayTimer(10);
    assert.strictEqual(APP.app.dayTimerEnds, null, 'adjust is a no-op while the timer is stopped');
    assert.strictEqual(APP.app.dayTimerTotal, null);
    APP.app.dayTimerEnds = Date.now() + 5000;
    APP.app.dayTimerTotal = 5;
    APP.adjustDayTimer(-10);
    assert.strictEqual(APP.app.dayTimerEnds, null, 'a -10s nudge past zero stops the timer');
    assert.strictEqual(APP.app.dayTimerTotal, null);
  });

  test('morning token card shows fresh info with a Token shown relay button', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    const sheriff = APP.state.players.find(function (p) { return p.assignedRole === 'sheriff'; });
    const infos = ((APP.state.playerLog[String(sheriff.id)] || [])).filter(function (e) { return e.kind === 'info'; });
    assert.ok(infos.length >= 1, 'sheriff should have a fresh info entry');
    let h = html('game-body');
    assert.ok(h.indexOf('Info to Show') !== -1);
    assert.ok(h.indexOf('notice info') !== -1);
    assert.ok(h.indexOf('Token shown') !== -1);
    assert.ok(h.indexOf('Sheriff check on') !== -1);
    APP.tokenShown(sheriff.id, APP.state.night.number - 1);
    h = html('game-body');
    assert.ok(h.indexOf('Token shown') === -1, 'relayed results drop the button');
    assert.ok(h.indexOf('RELAYED') !== -1);
    APP.save();
    APP.app.relayedWhispers = {};
    APP.resumeGame();
    h = html('game-body');
    assert.ok(h.indexOf('RELAYED') !== -1, 'relayed tag persists across save/load');
  });

  test('wizard corpse picker marks a cleaned corpse with the CLEANED tag', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'undertaker', 'janitor', 'forger', 'godfather'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'U', 6: 'J', 7: 'F', 8: 'G' };
    startRoles(8, { town: 5, mafia: 3, neutral: 0 }, roles, names, { noLynchD1: false });
    APP.beginDay1();
    APP.app.trialNom = 2;
    APP.startTrial(1);
    secondAll();
    APP.resolveTrial();
    castAll('GUILTY');
    APP.resolveTrial();
    assert.strictEqual(APP.state.trial.stage, 'SENTENCE');
    castAll('GUILTY');
    APP.resolveSentence();
    assert.ok(!APP.state.players[0].isAlive, 'player 1 is lynched on day 1');
    assert.strictEqual(APP.state.graveyard.length, 1);
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.graveyard[0].wasCleaned, true);
    APP.beginDay();
    assert.strictEqual(APP.state.dayNumber, 2);
    APP.endDay();
    const ut = APP.app.wizard.steps.find(function (s) { return s.title === 'Undertaker'; });
    assert.ok(ut, 'the Undertaker step exists on night 2');
    APP.wizActor('undertaker', 5);
    const h = html('game-body');
    assert.ok(h.indexOf('CLEANED') !== -1);
    assert.ok(h.indexOf('tag-bad') !== -1);
  });

  test('wizard Forger confirm shows the Will forge target note above the button', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'forger', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    while (APP.app.wizard.steps[Math.min(APP.app.wizard.idx, APP.app.wizard.steps.length - 1)].title !== 'Forger') {
      APP.wizNext();
    }
    APP.wizActor('forger', 7);
    APP.wizTarget(1);
    const h = html('game-body');
    assert.ok(h.indexOf('Will forge: A \u00B7 Civilian') !== -1);
    assert.ok(h.indexOf('actor-done') !== -1);
  });

  test('wizard summary card lists every recorded action on the last step', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    assert.strictEqual(APP.app.wizard.idx, APP.app.wizard.steps.length - 1);
    const h = html('game-body');
    assert.ok(h.indexOf('Night Actions Summary') !== -1);
    assert.ok(h.indexOf('protect') !== -1);
    assert.ok(h.indexOf('kill') !== -1);
    assert.ok(h.indexOf('Sheriff') !== -1);
  });

  test('wizard Veteran shows the LAST ALERT chip on the final alert', () => {
    const roles = ['veteran', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.state.players[0].alertsUsed = 2;
    APP.beginDay1();
    APP.endDay();
    const vetStep = APP.app.wizard.steps.find(function (s) { return s.title === 'Veteran Alert'; });
    assert.ok(vetStep, 'the veteran step exists while alertsUsed < 3');
    APP.wizActor('veteran', 1);
    const h = html('game-body');
    assert.ok(h.indexOf('LAST ALERT') !== -1);
    assert.ok(h.indexOf('tag-bad') !== -1);
  });

  test('wizard Witness two-pick records extra.secondTarget on confirm', () => {
    const roles = ['civilian', 'civilian', 'witness', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    const names = { 1: 'A', 2: 'B', 3: 'W', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, names);
    APP.beginDay1();
    APP.endDay();
    while (APP.app.wizard.steps[Math.min(APP.app.wizard.idx, APP.app.wizard.steps.length - 1)].title !== 'Witness') {
      APP.wizNext();
    }
    APP.wizActor('witness', 3);
    let h = html('game-body');
    assert.ok(h.indexOf('first player') !== -1);
    APP.wizTarget(1);
    h = html('game-body');
    assert.ok(h.indexOf('second player') !== -1);
    assert.ok(h.indexOf('A \u00B7 first pick') !== -1);
    APP.wizTarget(4);
    h = html('game-body');
    assert.ok(h.indexOf('Witness: A and D \u2192 Both Town') !== -1);
    APP.wizWitnessConfirm();
    const wac = APP.state.night.actions.find(function (a) { return a.roleId === 'witness'; });
    assert.ok(wac, 'witness action recorded');
    assert.strictEqual(wac.targetId, 1);
    assert.ok(wac.extra && wac.extra.secondTarget === 4);
  });

  test('day cards collapse via toggle-card, hide their body, and survive a save/load round trip', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    function cardRegion(key) {
      const h = html('game-body');
      const idx = h.indexOf('data-card="' + key + '"');
      assert.ok(idx !== -1, key + ' card renders a collapse button');
      return h.slice(h.lastIndexOf('<div class="card card-collapsible', idx), h.indexOf('id="card-body-' + key + '"'));
    }
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="timer"') !== -1, 'timer card is collapsible');
    assert.ok(h.indexOf('data-card="abilities"') !== -1, 'abilities card is collapsible');
    assert.ok(h.indexOf('data-card="trial"') !== -1, 'trial card is collapsible');
    assert.ok(h.indexOf('data-card="log"') !== -1, 'log card is collapsible');
    assert.ok(h.indexOf('>Event Log (') !== -1, 'log card keeps its own toggle button');
    assert.ok(h.indexOf('card-collapsible collapsed') === -1, 'cards start expanded');
    assert.ok(cardRegion('abilities').indexOf('collapsed') === -1, 'abilities card starts expanded');
    assert.ok(h.indexOf('data-card="abilities" aria-expanded="true"') !== -1);

    APP.toggleCard('abilities');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="abilities" aria-expanded="false"') !== -1, 'collapsed button reports aria-expanded false');
    assert.ok(h.indexOf('data-card="abilities" aria-expanded="false" aria-controls="card-body-abilities">+</button>') !== -1, 'collapsed button shows +');
    assert.ok(cardRegion('abilities').indexOf('collapsed') !== -1, 'abilities card has class collapsed');
    assert.ok(cardRegion('timer').indexOf('collapsed') === -1, 'other cards stay expanded');

    APP.toggleCard('abilities');
    h = html('game-body');
    assert.ok(h.indexOf('card-collapsible collapsed') === -1, 'expanded again');
    assert.ok(h.indexOf('data-card="abilities" aria-expanded="true"') !== -1);
    assert.ok(cardRegion('abilities').indexOf('collapsed') === -1, 'abilities card is expanded again');

    APP.toggleCard('abilities');
    APP.toggleCard('trial');
    APP.save();
    APP.resumeGame();
    assert.strictEqual(APP.app.collapsed['abilities'], true, 'collapsed state restored');
    assert.strictEqual(APP.app.collapsed['trial'], true, 'trial collapsed state restored');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="abilities" aria-expanded="false"') !== -1, 'collapsed state survives save/load');
    assert.ok(h.indexOf('data-card="trial" aria-expanded="false"') !== -1);
    assert.ok(cardRegion('abilities').indexOf('collapsed') !== -1, 'abilities body hidden after resume');
  });

  test('helper panels collapse via toggle-card, switch to plus, and hide their bodies', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    const region = function (key) {
      return cardRegion(html('game-body'), '<div class="helper-card card-collapsible', key);
    };
    let h = html('game-body');
    ['helper-night-order', 'helper-players', 'helper-statuses'].forEach(function (key) {
      assert.ok(h.indexOf('data-card="' + key + '" aria-expanded="true" aria-controls="card-body-' + key + '">-</button>') !== -1,
        key + ' helper card starts expanded with a minus label');
    });
    assert.ok(h.indexOf('card-collapsible collapsed') === -1, 'helper cards start expanded');
    APP.toggleCard('helper-players');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="helper-players" aria-expanded="false" aria-controls="card-body-helper-players">+</button>') !== -1,
      'collapsed Players button shows +');
    assert.ok(region('helper-players').indexOf('collapsed') !== -1, 'Players card has class collapsed');
    assert.ok(region('helper-night-order').indexOf('collapsed') === -1, 'other helper cards stay expanded');
    assert.ok(h.indexOf('data-card="helper-statuses" aria-expanded="true"') !== -1, 'Statuses card stays expanded');
  });

  test('night wizard collapses via toggle-card during the NIGHT phase', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    const region = function (key) {
      return cardRegion(html('game-body'), '<div class="card night-card card-collapsible', key);
    };
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="night-wizard"') !== -1, 'night wizard card renders a collapse button');
    assert.ok(region('night-wizard').indexOf('collapsed') === -1, 'night card starts expanded');
    APP.toggleCard('night-wizard');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="night-wizard" aria-expanded="false"') !== -1, 'collapsed night button reports aria-expanded false');
    assert.ok(region('night-wizard').indexOf('collapsed') !== -1, 'night card has class collapsed');
    APP.toggleCard('night-wizard');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="night-wizard" aria-expanded="true"') !== -1, 'night card expands again');
  });

  test('seat overlay renders the seat-grid collapse button, keeps Close, and collapses on toggle', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.app.seatOverlay = true;
    APP.renderScreen('game');
    const region = function (key) {
      return cardRegion(html('game-body'), '<div class="card card-collapsible', key);
    };
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="seat-grid"') !== -1, 'seat overlay renders the seat-grid collapse button');
    assert.ok(h.indexOf('data-action="toggle-seat-overlay"') !== -1, 'overlay card has a Close button');
    APP.toggleCard('seat-grid');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="seat-grid" aria-expanded="false"') !== -1);
    assert.ok(region('seat-grid').indexOf('collapsed') !== -1, 'seat-grid body is hidden after toggle');
    assert.ok(h.indexOf('data-action="toggle-seat-overlay"') !== -1, 'overlay card keeps its Close button when collapsed');
  });

  test('day ability picker renders the picker collapse button and collapses on toggle', () => {
    const roles = ['civilian', 'civilian', 'vigilante', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.openDayAbility('vigilante');
    const region = function (key) {
      return cardRegion(html('game-body'), '<div class="card picker-card card-collapsible', key);
    };
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="picker"') !== -1, 'picker card renders a collapse button');
    assert.ok(h.indexOf('picker-card card-collapsible') !== -1);
    APP.toggleCard('picker');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="picker" aria-expanded="false"') !== -1);
    assert.ok(region('picker').indexOf('collapsed') !== -1, 'picker body is hidden after toggle');
  });

  test('morning whisper card renders only when results exist and collapses via toggle-card', () => {
    const roles = ['civilian', 'civilian', 'sheriff', 'civilian', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    const region = function (key) {
      return cardRegion(html('game-body'), '<div class="card whisper-results card-collapsible', key);
    };
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="whisper"') !== -1, 'whisper card renders when morning results exist');
    assert.ok(h.indexOf('data-card="whisper" aria-expanded="true" aria-controls="card-body-whisper">-</button>') !== -1,
      'whisper button starts expanded with a minus label');
    APP.toggleCard('whisper');
    h = html('game-body');
    assert.ok(h.indexOf('data-card="whisper" aria-expanded="false"') !== -1);
    assert.ok(region('whisper').indexOf('collapsed') !== -1, 'whisper body is hidden after toggle');
  });

  test('morning without info results renders no whisper collapse button', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'civilian', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.ok(html('game-body').indexOf('data-card="whisper"') === -1, 'no whisper card without morning results');
  });

  test('collapsible panel keys survive a save/load round trip', () => {
    const roles = ['civilian', 'civilian', 'vigilante', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.openDayAbility('vigilante');
    APP.toggleCard('picker');
    APP.app.seatOverlay = true;
    APP.renderScreen('game');
    APP.toggleCard('seat-grid');
    APP.endDay();
    driveNight();
    APP.resolveNight();
    APP.toggleCard('whisper');
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    APP.toggleCard('helper-players');
    APP.toggleCard('night-wizard');
    APP.save();
    APP.resumeGame();
    ['picker', 'seat-grid', 'whisper', 'helper-players', 'night-wizard'].forEach(function (key) {
      assert.strictEqual(APP.app.collapsed[key], true, key + ' collapsed state restored');
    });
  });

  test('prep phase renders the night order card after dealing', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    const h = html('seats-body');
    assert.ok(h.indexOf('Night Order') !== -1);
    assert.ok(h.indexOf('Jailor') !== -1);
    assert.ok(h.indexOf('night-order-step') !== -1);
  });

  test('toggle-mode swaps the game screen to the helper and back', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    assert.ok(html('game-body').indexOf('helper-card') === -1);
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    let h = html('game-body');
    assert.ok(h.indexOf('helper-card') !== -1);
    assert.ok(h.indexOf('Night Order') !== -1);
    assert.ok(html('sidebar-body').indexOf('Switch to App') !== -1);
    APP.toggleMode();
    assert.ok(html('game-body').indexOf('helper-card') === -1);
    assert.ok(html('sidebar-body').indexOf('Switch to Helper') !== -1);
  });

  test('helper status sheet opens and toggles a manual status', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    const pid = String(APP.state.players[0].id);
    APP.app.helperSheetPid = pid;
    APP.renderScreen('game');
    let h = html('game-body');
    assert.ok(h.indexOf('helper-sheet') !== -1);
    assert.ok(h.indexOf('helper-sheet open') !== -1);
    assert.ok(h.indexOf('helper-sheet-backdrop open') !== -1);
    assert.ok(h.indexOf(APP.state.players[0].name) !== -1);
    APP.toggleHelperStatus(pid, 'drunk');
    assert.strictEqual(APP.app.statuses[pid].drunk, true);
    APP.renderScreen('game');
    h = html('game-body');
    assert.ok(h.indexOf('helper-chip') !== -1);
    assert.ok(h.indexOf('<span class="helper-chip">DRUNK</span>') !== -1);
  });

  test('helper mode persists mode flag through save payload', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.app.mode = 'app';
    APP.toggleMode();
    assert.strictEqual(APP.app.mode, 'helper');
    APP.save();
    const payload = APP.loadSave();
    assert.ok(payload && payload.ui, 'a save payload exists');
    assert.strictEqual(payload.ui.mode, 'helper');
    APP.hydrateUi(payload.ui);
    assert.strictEqual(APP.app.mode, 'helper');
  });

  test('helper night bar advances steps, disables at both ends, and clamps past morning', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    let bar = html('game-bar');
    assert.ok(bar.indexOf('data-action="helper-step-prev"') !== -1, 'Prev button renders in the helper game bar');
    assert.ok(bar.indexOf('data-action="helper-step-next"') !== -1, 'Next button renders in the helper game bar');
    assert.ok(bar.indexOf('data-action="helper-step-prev" disabled') !== -1, 'Prev is disabled on the first step');
    assert.ok(bar.indexOf('1 / 4') !== -1, 'indicator counts only dealt living steps: Jailor, Doctor, Mafia, Morning');
    APP.helperStepNext();
    assert.ok(html('game-bar').indexOf('2 / 4') !== -1, 'Next advances to step two');
    assert.ok(html('game-bar').indexOf('data-action="helper-step-prev" disabled') === -1, 'Prev enables after advancing');
    APP.helperStepNext();
    APP.helperStepNext();
    const lastBar = html('game-bar');
    assert.ok(lastBar.indexOf('4 / 4') !== -1, 'indicator reaches the last step');
    assert.ok(lastBar.indexOf('>Done</button>') !== -1, 'last step labels the button Done');
    assert.ok(lastBar.indexOf('data-action="helper-step-next" disabled') !== -1, 'Done is disabled');
    APP.helperStepNext();
    assert.strictEqual(APP.app.helperStepIdx, 3, 'advancing past morning clamps to the last index');
    APP.helperStepPrev();
    assert.ok(html('game-bar').indexOf('3 / 4') !== -1, 'Prev steps back one index');
  });

  test('night step card tracks helperStepIdx and filters jailor and inherited roles', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'deputy', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    const bodyOf = function () {
      const h = html('game-body');
      return h.slice(h.indexOf('id="card-body-helper-night-step"'), h.indexOf('data-card="helper-players"'));
    };
    let h = html('game-body');
    assert.ok(h.indexOf('data-card="helper-night-step"') !== -1, 'focused step card renders during NIGHT');
    assert.ok(h.indexOf('data-card="helper-night-step"') < h.indexOf('data-card="helper-players"'), 'step card sits on top');
    let body = bodyOf();
    assert.ok(body.indexOf('Jailor') !== -1, 'first filtered step is the Jailor');
    assert.ok(body.indexOf(APP.state.players[3].name) !== -1, 'actor hint names the living jailor');
    assert.ok(body.indexOf('Jailor, open your eyes. Point to your target') !== -1, 'per-step guidance renders');
    assert.ok(body.indexOf('Target: point to a living player.') !== -1, 'target reminder renders');
    const dep = APP.state.players.find(function (p) { return p.assignedRole === 'deputy'; });
    dep.inheritedRole = 'sheriff';
    APP.state.players[0].jailed = true;
    APP.renderScreen('game');
    body = bodyOf();
    assert.ok(html('game-body').indexOf('Night Step 1 of 5') !== -1,
      'the inherited sheriff adds its step: Jailor, Doctor, Mafia, Sheriff, Morning');
    assert.ok(body.indexOf('Jailor') !== -1, 'jailor step appears while a living jailor is in the cast');
    APP.app.helperStepIdx = 3;
    APP.renderScreen('game');
    body = bodyOf();
    assert.ok(body.indexOf('Sheriff') !== -1, 'inherited sheriff step appears via the deputy');
    assert.ok(body.indexOf('INHERITED') !== -1, 'actor hint marks the inherited role');
    E.killPlayer(APP.state, APP.state.players[2].id);
    APP.app.helperStepIdx = 0;
    APP.renderScreen('game');
    body = bodyOf();
    assert.ok(body.indexOf('Doctor') === -1, 'dead actors drop out of the filter');
  });

  test('helperStepIdx persists through the save payload and resumeGame', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.app.mode = 'helper';
    APP.helperStepNext();
    assert.strictEqual(APP.app.helperStepIdx, 1);
    APP.save();
    const payload = APP.loadSave();
    assert.strictEqual(payload.ui.helperStepIdx, 1, 'save payload carries helperStepIdx');
    APP.app.helperStepIdx = 0;
    APP.resumeGame();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    assert.strictEqual(APP.app.helperStepIdx, 1, 'resumeGame restores helperStepIdx');
    assert.strictEqual(APP.app.mode, 'helper', 'resumeGame keeps helper mode');
  });

  test('helper player sheet offers manual Kill Player and Undo Last Kill controls', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'jailor', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.app.mode = 'helper';
    const victim = APP.state.players[0];
    APP.app.helperSheetPid = String(victim.id);
    APP.renderScreen('game');
    let h = html('game-body');
    assert.ok(h.indexOf('data-action="helper-kill-player"') !== -1, 'Kill Player control renders in the sheet');
    assert.ok(h.indexOf('data-action="helper-undo-kill" disabled') !== -1, 'undo disabled on an empty graveyard');
    APP.doDayAbility('moderator-kill', victim.id);
    assert.strictEqual(victim.isAlive, false, 'manual kill lands through the shared moderator path');
    h = html('game-body');
    assert.ok(h.indexOf('<span class="helper-chip helper-chip-dead">GHOST</span>') !== -1, 'roster shows the ghost chip');
    assert.ok(h.indexOf('data-helper-pid="' + victim.id + '" disabled') !== -1, 'kill disabled for a dead player');
    assert.ok(h.indexOf('data-action="helper-undo-kill">Undo Last Kill (' + victim.name + ')') !== -1,
      'undo enabled naming the last corpse');
    APP.undoKill();
    assert.strictEqual(victim.isAlive, true, 'undo revives through the shared path');
  });

  test('helper bar shows Begin Day during MORNING and driving it advances the phase', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.endDay();
    APP.app.mode = 'helper';
    driveNight();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    APP.renderScreen('game');
    let bar = html('game-bar');
    assert.ok(bar.indexOf('data-action="begin-day"') !== -1, 'helper bar offers Begin Day during MORNING');
    assert.ok(bar.indexOf('>Begin Day</button>') !== -1, 'helper bar button label reads Begin Day');
    assert.ok(bar.indexOf('data-action="helper-step-prev"') === -1, 'night step controls are replaced during MORNING');
    assert.ok(bar.indexOf('data-action="resolve-night"') === -1, 'Resolve Night is replaced during MORNING');
    APP.beginDay();
    assert.strictEqual(APP.state.phase, 'DAY', 'driving Begin Day advances the phase');
    APP.renderScreen('game');
    bar = html('game-bar');
    assert.ok(bar.indexOf('data-action="begin-day"') === -1, 'Begin Day leaves the bar after advancing');
  });

  test('helper bar shows End Day during DAY', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    assert.strictEqual(APP.state.phase, 'DAY');
    const bar = html('game-bar');
    assert.ok(bar.indexOf('data-action="end-day"') !== -1, 'helper bar offers End Day during DAY');
    assert.ok(bar.indexOf('>End Day</button>') !== -1, 'helper bar button label reads End Day');
    assert.ok(bar.indexOf('data-action="begin-day"') === -1, 'Begin Day is not shown during DAY');
  });

  test('helper morning recap card lists the night kill, is collapsible, and carries helper-recap', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles, null, { noKillN1: false });
    APP.beginDay1();
    APP.endDay();
    const victim = APP.state.players[0];
    APP.wizActor('doctor', 3);
    APP.wizTarget(2);
    APP.wizNext();
    APP.wizMafiaTarget(1);
    APP.wizNext();
    APP.resolveNight();
    assert.strictEqual(APP.state.phase, 'MORNING');
    assert.strictEqual(victim.isAlive, false, 'scripted night kill lands');
    APP.app.mode = 'helper';
    APP.renderScreen('game');
    const h = html('game-body');
    const idx = h.indexOf('data-card="helper-recap"');
    assert.ok(idx !== -1, 'recap card carries data-card helper-recap');
    assert.ok(h.indexOf('aria-expanded="true" aria-controls="card-body-helper-recap">-</button>', idx) !== -1,
      'recap card follows the standard aria expanded/controls pattern');
    assert.ok(idx < h.indexOf('data-card="helper-night-order"'), 'recap card sits above the existing cards');
    const recap = h.slice(h.lastIndexOf('<div class="card card-collapsible', idx), h.indexOf('data-card="helper-night-order"'));
    assert.ok(recap.indexOf('Morning Recap') !== -1, 'recap card is titled Morning Recap');
    assert.ok(recap.indexOf(victim.name) !== -1, 'recap lists the killed victim by name');
    assert.ok(recap.indexOf('DEAD') !== -1, 'recap marks the dead');
    APP.app.collapsed['helper-recap'] = true;
    APP.renderScreen('game');
    assert.ok(html('game-body').indexOf('data-card="helper-recap" aria-expanded="false"') !== -1,
      'recap collapse state persists through app.collapsed');
  });

});


describe('persistence and prep regressions', () => {

  test('prep toggling works after Night Zero resolves', () => {
    const roles = ['sheriff', 'jailor', 'doctor', 'civilian', 'civilian', 'civilian', 'civilian',
      'godfather', 'mafioso', 'consigliere', 'executioner', 'witch'];
    startRoles(12, { town: 7, mafia: 3, neutral: 2 }, roles);
    APP.beginNightZero();
    assert.strictEqual(APP.state.phase, 'NIGHT');
    APP.resolveNightZero();
    assert.ok(APP.app.nightZeroDone && typeof APP.app.nightZeroDone === 'object',
      'nightZeroDone must be an object after Night Zero resolves');
    APP.nzToggle('bluffs');
    assert.strictEqual(APP.app.nightZeroDone.bluffs, true);
    APP.nzToggle('bluffs');
    assert.strictEqual(APP.app.nightZeroDone.bluffs, false);
    assert.strictEqual(localStorage.getItem(APP.SAVE_KEY) && true, true);
  });

  test('corrupted resume payload boots into setup cleanly without looping', () => {
    APP.newGame();
    localStorage.setItem(APP.SAVE_KEY, JSON.stringify({
      cfg: null,
      ui: { mode: 'helper', statuses: { x: true }, helperSheetPid: 1, helperStepIdx: 99 },
      game: { players: 'hostile', night: 'hostile' }
    }));
    let threw = false;
    try { APP.resumeGame(); } catch (e) { threw = true; }
    assert.strictEqual(threw, false);
    assert.strictEqual(APP.app.screen, 'setup');
    assert.strictEqual(APP.state, null);
    assert.strictEqual(localStorage.getItem(APP.SAVE_KEY), null);
    assert.strictEqual(APP.app.mode, 'app');
    assert.deepStrictEqual(APP.app.statuses, {});
    APP.resumeGame();
    assert.strictEqual(APP.app.screen, 'setup');
  });

  test('failed save surfaces a persistent dismissible warning banner once', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    const origSetItem = localStorage.setItem;
    let failures = 0;
    localStorage.setItem = function () { failures += 1; throw new Error('quota exceeded'); };
    try {
      APP.save();
      APP.save();
    } finally {
      localStorage.setItem = origSetItem;
    }
    assert.strictEqual(failures, 2);
    const banner = document.getElementById('save-warning');
    assert.ok(banner, 'banner should be injected after the first failed save');
    assert.ok(banner.innerHTML.indexOf('Progress may not be saved.') !== -1);
    assert.ok(banner.innerHTML.indexOf('data-action="dismiss-save-warning"') !== -1);
    window.UI.showSaveWarning();
    window.UI.dismissSaveWarning();
    window.UI.showSaveWarning();
    assert.ok(document.getElementById('save-warning'), 'dismiss keeps working without throwing');
  });

  test('wake lock is requested during NIGHT and released in every other phase', async () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    const prevDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const setNavigator = function (value) {
      Object.defineProperty(globalThis, 'navigator', {
        value, configurable: true, writable: true
      });
    };
    let requested = 0;
    let released = 0;
    const lock = {
      release() { released += 1; return Promise.resolve(); }
    };
    setNavigator({
      wakeLock: {
        request(kind) { requested += 1; return Promise.resolve(lock); }
      }
    });
    try {
      APP.state.phase = 'NIGHT';
      APP.updateWakeLock();
      await Promise.resolve();
      await Promise.resolve();
      assert.strictEqual(requested, 1, 'request fires when entering NIGHT');
      assert.strictEqual(global.window.APP.wakeLock, lock);

      APP.updateWakeLock();
      assert.strictEqual(requested, 1, 'no duplicate request while held');

      APP.releaseWakeLock();
      assert.strictEqual(released, 1);
      assert.strictEqual(global.window.APP.wakeLock, null);

      APP.state.phase = 'DAY';
      APP.updateWakeLock();
      assert.strictEqual(requested, 1, 'no request outside NIGHT');

      setNavigator({});
      APP.state.phase = 'NIGHT';
      APP.updateWakeLock();
      assert.strictEqual(requested, 1, 'unsupported browser is a silent no-op');

      setNavigator({ wakeLock: {} });
      APP.state.phase = 'NIGHT';
      APP.updateWakeLock();
      assert.strictEqual(requested, 1, 'missing request method is a silent no-op');
    } finally {
      APP.releaseWakeLock();
      if (prevDescriptor) Object.defineProperty(globalThis, 'navigator', prevDescriptor);
    }
  });

  test('moderator notes save from the detail sheet and survive a resume round trip', () => {
    const roles = ['civilian', 'civilian', 'doctor', 'sheriff', 'godfather', 'mafioso', 'jester', 'survivor'];
    startRoles(8, { town: 5, mafia: 2, neutral: 1 }, roles);
    APP.beginDay1();
    const doc = APP.state.players.find(function (p) { return p.assignedRole === 'doctor'; });
    APP.openDetailSheet(String(doc.seat));
    let h = html('sheet-root');
    assert.ok(h.indexOf('seat-note-input') !== -1, 'alive player shows an editable note field');
    assert.ok(h.indexOf('data-action="save-note"') !== -1);

    document.getElementById('seat-note-input').value = 'claims Sheriff night two <img>';
    APP.saveNote();
    h = html('sheet-root');
    assert.strictEqual(APP.app.notes[String(doc.id)], 'claims Sheriff night two <img>');
    assert.ok(h.indexOf('claims Sheriff night two &lt;img&gt;') !== -1, 'note text renders escaped');

    const payload = JSON.parse(localStorage.getItem(APP.SAVE_KEY));
    assert.strictEqual(payload.ui.notes[String(doc.id)], 'claims Sheriff night two <img>');

    E.killPlayer(APP.state, doc.id);
    APP.afterMutation();
    APP.openDetailSheet(String(doc.seat));
    h = html('sheet-root');
    assert.ok(h.indexOf('seat-note-input') === -1, 'dead player view has no editor');
    assert.ok(h.indexOf('claims Sheriff night two &lt;img&gt;') !== -1, 'dead player note shows read-only');

    localStorage.setItem(APP.SAVE_KEY, JSON.stringify(payload));
    APP.resumeGame();
    assert.strictEqual(
      APP.app.notes[String(doc.id)],
      'claims Sheriff night two <img>',
      'note survives serialize/deserialize round trip'
    );
    if (APP.app.sheet) APP.closeSheet();
  });

  test('naming screen strings follow the locale and the seat placeholder interpolates', () => {
    APP.newGame();
    APP.cfg.playerCount = 6;
    APP.cfg.teamCounts = { town: 4, mafia: 2, neutral: 0 };
    APP.startGame();
    let h = html('seats-body');
    assert.ok(h.indexOf('Name the Seats') !== -1, 'card title is English in en');
    assert.ok(h.indexOf('Auto-fill rest') !== -1, 'auto-fill button is English in en');
    assert.ok(h.indexOf('Lock Roles') !== -1, 'lock-roles button is English in en');
    assert.ok(h.indexOf('seat(s) left to assign') !== -1, 'remaining-seats hint is English in en');
    assert.ok(h.indexOf('Player 3') !== -1, 'seat placeholder interpolates the seat number in en');

    E.setLocale('pl');
    APP.locale = E.locale;
    APP.renderScreen('seats');
    h = html('seats-body');
    assert.ok(h.indexOf('Nazwij miejsca') !== -1, 'card title switches to Polish');
    assert.ok(h.indexOf('Uzupełnij resztę') !== -1, 'auto-fill button switches to Polish');
    assert.ok(h.indexOf('Zatwierdź role') !== -1, 'lock-roles button switches to Polish');
    assert.ok(h.indexOf('Pozostało miejsc do przypisania:') !== -1, 'remaining-seats hint switches to Polish');
    assert.ok(h.indexOf('Gracz 3') !== -1, 'seat placeholder interpolates the seat number in pl');

    E.setLocale('en');
    APP.locale = E.locale;
    APP.renderScreen('seats');
    h = html('seats-body');
    assert.ok(h.indexOf('Name the Seats') !== -1, 'card title returns to English after restoring the locale');
    if (APP.app.sheet) APP.closeSheet();
  });

});
