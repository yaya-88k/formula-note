// Quick smoke test for parser.js
import { evaluateLine, evaluateLines, extractVariableNames } from '../js/parser.js';

let pass = 0, fail = 0;
function eq(label, actual, expected) {
  const ok = (typeof expected === 'number' && typeof actual === 'number')
    ? Math.abs(actual - expected) < 1e-9
    : actual === expected;
  if (ok) { pass++; console.log(`  ok  ${label}: ${actual}`); }
  else { fail++; console.log(`  FAIL ${label}: got ${actual}, expected ${expected}`); }
}

// --- Single-line tests ---
console.log('Single-line:');
const ctx = {};
eq('0.4 * 1.2', evaluateLine('0.4 * 1.2', ctx).result, 0.48);
eq('512 mod 12', evaluateLine('512 mod 12', ctx).result, 8);
eq('(1234 + 567 - 89) / 72', evaluateLine('(1234 + 567 - 89) / 72', ctx).result, (1234 + 567 - 89) / 72);
eq('125%', evaluateLine('125%', ctx).result, 1.25);
eq('2^10', evaluateLine('2^10', ctx).result, 1024);
eq('5!', evaluateLine('5!', ctx).result, 120);
eq('sin(0)', evaluateLine('sin(0)', ctx).result, 0);
eq('cos(π)', evaluateLine('cos(π)', ctx).result, -1);
eq('sqrt(81)', evaluateLine('sqrt(81)', ctx).result, 9);
eq('√81 via tokenizer alias', evaluateLine('√(81)', ctx).result, 9);
eq('log(100)', evaluateLine('log(100)', ctx).result, 2);
eq('ln(e)', evaluateLine('ln(e)', ctx).result, 1);
eq('-3 + 5', evaluateLine('-3 + 5', ctx).result, 2);
eq('round(2.7)', evaluateLine('round(2.7)', ctx).result, 3);
eq('ceil(2.1)', evaluateLine('ceil(2.1)', ctx).result, 3);
eq('floor(2.9)', evaluateLine('floor(2.9)', ctx).result, 2);
eq('abs(-7)', evaluateLine('abs(-7)', ctx).result, 7);
eq('nCr(5,2)', evaluateLine('nCr(5,2)', ctx).result, 10);
eq('nPr(5,2)', evaluateLine('nPr(5,2)', ctx).result, 20);
eq('40 * 500 * 8 // comment', evaluateLine('40 * 500 * 8 // 単価×日数', ctx).result, 160000);
eq('empty', evaluateLine('', ctx).empty, true);
eq('comment only', evaluateLine('// just a note', ctx).empty, true);

// --- Variables and positional scope ---
console.log('Variables:');
{
  const res = evaluateLines([
    'a = 12',
    '√a',
    'a = 20',
    '512a',
  ]);
  eq('line0 assigned a', res[0].assigned, 'a');
  eq('line0 result 12', res[0].result, 12);
  eq('line1 √a = √12', res[1].result, Math.sqrt(12));
  eq('line2 re-assign a=20', res[2].result, 20);
  eq('line3 512a = 512*20 (re-scoped)', res[3].result, 10240);
}

// --- Implicit multiplication ---
console.log('Implicit mult:');
{
  const res = evaluateLines([
    'a = 3',
    '2a',
    '2(a + 1)',
    'a(a + 2)',
  ]);
  eq('2a = 6', res[1].result, 6);
  eq('2(a+1) = 8', res[2].result, 8);
  eq('a(a+2) = 15', res[3].result, 15);
}

// --- Error handling ---
console.log('Errors:');
{
  const r = evaluateLine('1 + ', {});
  eq('incomplete expr is error', r.ok, false);
}
{
  const r = evaluateLine('undef_var * 2', {});
  eq('undefined var is error', r.ok, false);
}

// --- Variable name extraction ---
console.log('Variable extraction:');
{
  const names = extractVariableNames(['a = 1', 'b = 2', 'a + b', 'price = 100', 'sin(0) = 0']);
  eq('extracts a, b, price', JSON.stringify(names.sort()), JSON.stringify(['a', 'b', 'price'].sort()));
}

// --- Ans equivalent (if exists in context) ---
console.log('Special cases:');
eq('comma in input is error (avoids conflict with function args)', evaluateLine('1,000 + 1', {}).ok, false);
eq('chained mult', evaluateLine('40 * 500 * 8', {}).result, 160000);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
