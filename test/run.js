#!/usr/bin/env node
/* Test runner — ไม่มี dependency ภายนอก (ไม่ใช้ jest/mocha)
 * รัน:  node test/run.js
 * exit: 0 = ผ่านหมด · 1 = มีข้อไม่ผ่าน */
'use strict';

const results = [];
let currentName = null;
let currentFails = null;

function fail(msg) { currentFails.push(msg); }

function show(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

const T = {
  test(name, fn) {
    currentName = name;
    currentFails = [];
    try { fn(); } catch (e) { currentFails.push('threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
    results.push({ name, fails: currentFails });
    currentName = null;
    currentFails = null;
  },
  ok(cond, msg) { if (!cond) fail(msg || 'expected truthy'); },
  eq(actual, expected, msg) {
    if (actual !== expected) fail((msg ? msg + ': ' : '') + 'got ' + show(actual) + ', want ' + show(expected));
  },
  // เท่ากันแบบเงิน — ใช้เฉพาะที่ float สะสมโดยธรรมชาติ (annuity) · eps เล็กมากโดยตั้งใจ
  near(actual, expected, eps, msg) {
    eps = eps == null ? 1e-6 : eps;
    if (!(Math.abs(actual - expected) <= eps)) fail((msg ? msg + ': ' : '') + 'got ' + show(actual) + ', want ' + show(expected) + ' (±' + eps + ')');
  },
  eqDate(actual, expected, msg) {
    if (show(actual) !== expected) fail((msg ? msg + ': ' : '') + 'got ' + show(actual) + ', want ' + expected);
  },
  eqArr(actual, expected, msg) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) fail((msg ? msg + ': ' : '') + 'got ' + a + ', want ' + b);
  },
};

require('./loan_core.test.js')(T);

let pass = 0, failed = 0;
for (const r of results) {
  if (r.fails.length === 0) { pass++; console.log('  ✅ ' + r.name); }
  else {
    failed++;
    console.log('  ❌ ' + r.name);
    r.fails.slice(0, 8).forEach(f => console.log('       ↳ ' + f));
    if (r.fails.length > 8) console.log('       ↳ (+' + (r.fails.length - 8) + ' อีก)');
  }
}
console.log('\n' + '─'.repeat(60));
console.log(`ผ่าน ${pass} / ${results.length} ข้อ` + (failed ? `  ❌ ไม่ผ่าน ${failed} ข้อ` : '  ✅ ผ่านทั้งหมด'));
process.exit(failed ? 1 : 0);
