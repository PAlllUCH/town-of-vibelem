'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Loads the engine + common.js + seats.js the way the browser does and fires
// real captured click events at a fake seat box. Guards the regression where a
// tap-to-zoom interceptor swallowed the first tap on a seat box, so the naming/
// detail sheet needed a second tap. Now seat taps pass straight through to the
// sheet action: no zoom class, no focus backdrop, no preventDefault and no
// stopPropagation on the click.
const HARNESS = [
  'globalThis.window = globalThis;',
  'const handlers = [];',
  'let backdrop = null;',
  'let tile = null;',
  "globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };",
  'function mkCls() { const s = {}; return { add: c => { s[c] = true; }, remove: c => { delete s[c]; }, contains: c => !!s[c] }; }',
  'tile = { classList: mkCls(), closest: sel => /seat-btn|seat-tile|seat-dealt/.test(sel) ? tile : null };',
  "globalThis.document = {",
  "  getElementById: id => (id === 'seat-zoom-backdrop') ? backdrop : null,",
  '  createElement: () => { const el = { id: "", className: "", classList: mkCls(), parentNode: { removeChild() { backdrop = null; } }, appendChild() {} }; return el; },',
  '  querySelector: sel => (tile.classList.contains("is-zoomed") && /is-zoomed/.test(sel)) ? tile : null,',
  '  querySelectorAll: sel => (tile.classList.contains("is-zoomed") && /is-zoomed/.test(sel)) ? [tile] : [],',
  '  addEventListener: (t, fn, cap) => { if (t === "click" && cap) handlers.push(fn); },',
  "  body: { classList: mkCls(), appendChild: el => { backdrop = el; } }",
  '};',
  "globalThis.addEventListener = function () {};",
  "const path = require('path');",
  "require(path.resolve(__dirname, '../js/engine.js'));",
  "require(path.resolve(__dirname, '../js/ui/common.js'));",
  "require(path.resolve(__dirname, '../js/ui/seats.js'));",
  "globalThis.APP = { app: { swapMode: false } };",
  'function click(target) { const ev = { target, pd: 0, sp: 0, preventDefault() { this.pd += 1; }, stopPropagation() { this.sp += 1; } }; handlers.forEach(h => h(ev)); return ev; }',
  'const out = {};',
  'let ev = click(tile);',
  "out.zoomed = tile.classList.contains('is-zoomed'); out.pd = ev.pd; out.sp = ev.sp; out.backdrop = !!backdrop;",
  "process.stdout.write('RESULT ' + JSON.stringify(out));"
].join('\n');

test('seat boxes open their sheet on the first tap: no tap-to-zoom interceptor remains', () => {
  const tmp = path.join(__dirname, '.seat_harness_tmp.cjs');
  fs.writeFileSync(tmp, HARNESS);
  try {
    const out = execFileSync(process.execPath, [tmp], { cwd: path.resolve(__dirname, '..') }).toString();
    const m = out.match(/RESULT (\{.*\})/);
    assert.ok(m, 'harness should emit RESULT: ' + out);
    const r = JSON.parse(m[1]);
    assert.strictEqual(r.zoomed, false, 'a seat tap must not zoom the box');
    assert.strictEqual(r.backdrop, false, 'a seat tap must not create a focus backdrop');
    assert.strictEqual(r.pd, 0, 'a seat tap must not prevent default, so the sheet action fires');
    assert.strictEqual(r.sp, 0, 'a seat tap must not stop propagation, so the sheet action fires');
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
});