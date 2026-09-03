'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Loads the engine + ui/common.js the same way the browser does (window ===
// globalThis, window.APP defined only after config at click time), captures the
// real document click handler, then fires a toggle-locale event. Guards the fix
// for the bug where the handler closed over an undefined (load-time) APP.
const HARNESS = [
  'globalThis.window = globalThis;',
  'const handlers = [];',
  "globalThis.addEventListener = function () {};",
  "globalThis.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };",
  "globalThis.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return { style: {}, classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } }, setAttribute: function () {}, getAttribute: function () { return null; }, addEventListener: function () {}, appendChild: function () {}, removeChild: function () {} }; }, addEventListener: function (t, fn) { if (t === 'click') handlers.push(fn); }, body: { classList: { add: function () {}, remove: function () {}, toggle: function () {} }, appendChild: function () {} } };",
  "const path = require('path');",
  "const engine = require(path.resolve(__dirname, '../js/engine.js'));",
  "require(path.resolve(__dirname, '../js/ui/common.js'));",
  "engine.setLocale('en');",
  'let rendered = 0;',
  "globalThis.APP = { locale: 'en', renderScreen: function () { rendered += 1; }, toggleLocale: function () { const n = engine.locale === 'en' ? 'pl' : 'en'; engine.setLocale(n); globalThis.APP.locale = n; } };",
  "const fakeBtn = { getAttribute: function () { return 'toggle-locale'; } };",
  "const ev = { target: { closest: function (s) { return s === '[data-action=\"toggle-locale\"]' ? fakeBtn : null; } }, preventDefault: function () {} };",
  'const before = engine.locale;',
  'handlers.forEach(function (h) { h(ev); });',
  "process.stdout.write('RESULT ' + JSON.stringify({ before: before, after: engine.locale, rendered: rendered }) + '\\n');"
].join('\n');

test('language toggle click handler flips locale via window.APP', () => {
  const tmp = path.join(__dirname, '.locale_harness_tmp.cjs');
  fs.writeFileSync(tmp, HARNESS);
  try {
    const out = execFileSync(process.execPath, [tmp], { cwd: path.resolve(__dirname, '..') }).toString();
    const m = out.match(/RESULT (\{.*\})/);
    assert.ok(m, 'harness should emit RESULT: ' + out);
    const r = JSON.parse(m[1]);
    assert.strictEqual(r.before, 'en');
    assert.strictEqual(r.after, 'pl', 'clicking the language toggle must switch locale to pl');
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
});
