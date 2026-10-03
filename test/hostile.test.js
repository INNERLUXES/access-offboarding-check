import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { IDENTITY_LIMITS, LIMITS, emailKey, parseJson } from '../src/index.js';
import { ARGS, BASE_CONFIG, accountsCsv, cli, configText, configWith, csvText, filesWith, leaversCsv, run, withFiles } from './helpers.js';

// Hostile input: files built to exhaust the memory or the time, to rewrite the terminal, to break a table, to be read as
// a formula, or to change how objects behave. Each test also checks the time, because work that grows faster than the
// input is a failure even when the answer is right. Tests that need a symbolic link or a device are guarded with
// process.platform, and none of them asserts a line or a column: those are asserted in the tests that run everywhere.

const LIMIT = { timeout: 120000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};

test('hostile: fifty thousand leavers against two hundred thousand accounts are matched in seconds, in one pass each', LIMIT, async () => {
  const leavers = leaversCsv(Array.from({ length: 50000 }, (_, i) => [`Person ${i}`, `p${i}@example.com`, `p${i}`, '-5']));
  const accounts = accountsCsv(Array.from({ length: 200000 }, (_, i) => [`Person ${i}`, `p${i}@example.com`, `u${i}`, i % 2 ? 'active' : 'disabled']));
  const r = await fast(() => run(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }), [...ARGS, '--format', 'json']), 30000);
  assert.equal(r.code, 1, r.err.slice(0, 500));
  const report = JSON.parse(r.out);
  assert.equal(report.totals.accounts, 200000);
  assert.equal(report.totals.matched, 50000);
  assert.equal(report.findings.length, 25000);
});

test('hostile: one identifier shared by every row does not make the work grow with leavers times accounts', LIMIT, async () => {
  const leavers = leaversCsv(Array.from({ length: 1500 }, (_, i) => [`Same Name`, `p${i}@example.com`, '', '-5']));
  const accounts = accountsCsv(Array.from({ length: 1500 }, (_, i) => [`Same Name`, `a${i}@example.com`, '', 'active']));
  // Every account matches every leaver by name: the answer itself would be leavers times accounts, more than two million
  // pairs, so the run stops at the cap of pairs with no verdict, quickly and with a short error.
  const r = await fast(() => run(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }, configWith({ rules: { possibleMatch: { level: 'notice' } } })), [...ARGS, '--format', 'json']), 10000);
  assert.equal(r.code, 2);
  assert.match(r.err, /more than 200,000 pairs of a leaver and an account match; an identifier or a name is held by very many rows on both sides \(the last one in tool\.csv:\d+\)/);
  assert.equal(r.out, '');
  const small = await run(filesWith({ 'leavers.csv': leaversCsv([['Same', '', '', '-1'], ['Same', '', '', '-1']]), 'tool.csv': accountsCsv([['Same', '', '', 'active']]) }, configWith({ rules: { possibleMatch: { level: 'notice' } } })), ARGS, { maxMatches: 1 });
  assert.equal(small.code, 2, 'two pairs are over a cap of one');
  assert.equal(LIMITS.maxMatches, 200000);
});

test('hostile: a file over its size limit is refused before it is read, and so are inputs over the total', LIMIT, async () => {
  const r = await fast(() => run(filesWith(), ARGS, { maxExportBytes: 50 }));
  assert.equal(r.code, 2);
  assert.match(r.err, /tool\.csv: \d+ bytes is over the 50 byte limit/);
  const total = await run(filesWith(), ARGS, { maxTotalBytes: 100 });
  assert.equal(total.code, 2);
  assert.match(total.err, /the inputs hold more than 100 bytes together/);
  assert.equal(LIMITS.maxExportBytes, 64 * 1024 * 1024);
});

test('hostile: a cell of a million characters, a quote never closed and a JSON value nested deep are refused at once', LIMIT, async () => {
  for (const [name, content] of [
    ['tool.csv', `name,email,login,status\n${'x'.repeat(1000000)},a,b,c\n`],
    ['tool.csv', `name,email,login,status\n"${'x'.repeat(1000000)}`],
    ['leavers.csv', `name,email,login,end\n"${'"'.repeat(1000001)}\n`]
  ]) {
    const r = await fast(() => run(filesWith({ [name]: content }), ARGS), 5000);
    assert.equal(r.code, 2);
    assert.ok(r.err.length < 3000, 'the error stays short');
  }
  const json = configWith({ exports: [{ name: 'tool', format: 'json', fields: { username: ['login'] } }] });
  for (const content of ['['.repeat(1000000), `[${'{"login": "a"},'.repeat(10)}${'"x",'.repeat(10)}]`]) {
    const r = await fast(() => run(filesWith({ 'tool.csv': content }, json), ARGS), 5000);
    assert.equal(r.code, 2);
  }
  await fast(async () => assert.throws(() => parseJson(`[${'1,'.repeat(300000)}1]`), /more than 100000 values/));
});

test('hostile: an identifier longer than the limit is not compared, and long values cost one pass', LIMIT, async () => {
  const long = `${'a'.repeat(IDENTITY_LIMITS.maxLength)}@example.com`;
  assert.equal(emailKey(long), null);
  const leavers = leaversCsv([['N', '', 'x'.repeat(60000), '-1']]);
  const accounts = accountsCsv([['N', `${'b@'.repeat(30000)}example.com`, 'x'.repeat(60000), 'active']]);
  const r = await fast(() => run(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }), [...ARGS, '--format', 'json']));
  const report = JSON.parse(r.out);
  assert.equal(report.findings.filter((f) => f.rule === 'still-active').length, 0, 'a username over the limit is not an identifier');
  assert.ok(report.notes.some((n) => /1 value in an email field is not an email address/.test(n)));
});

test('hostile: control, escape and direction characters in names, usernames, fields and statuses never reach the reports', async () => {
  const esc = String.fromCharCode(27);
  const rlo = String.fromCharCode(0x202e);
  const nel = String.fromCharCode(0x85);
  const leavers = leaversCsv([[`Ana${esc}[31m Red${rlo}`, 'ana@example.com', `ana${nel}x`, '-3']]);
  const accounts = csvText(['name', 'email', 'login', 'status'], [[`Eve${esc}]0;title${String.fromCharCode(7)}`, 'ana@example.com', 'z', `active${String.fromCharCode(0x2028)}`]]);
  for (const format of ['text', 'markdown', 'json']) {
    const r = await run(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }), [...ARGS, '--format', format, '--explain']);
    const shown = format === 'json' ? JSON.stringify(JSON.parse(r.out)) : r.out;
    for (const c of [esc, rlo, nel, String.fromCharCode(7), String.fromCharCode(0x2028)]) assert.ok(!r.out.includes(c), `${format}: ${c.charCodeAt(0)}`);
    if (format !== 'markdown') assert.ok(shown.includes('Ana [31m Red'), format);
    else assert.ok(shown.includes('Ana \\[31m Red'), 'Markdown escapes the bracket');
  }
});

test('hostile: __proto__, constructor and toString as names, usernames, columns and export fields are only data', async () => {
  const leavers = csvText(['__proto__', 'constructor', 'end'], [['toString', '__proto__', '-3'], ['hasOwnProperty', 'constructor', '-3']]);
  const accounts = JSON.stringify([{ login: '__proto__', name: 'toString' }, { login: 'constructor', name: 'valueOf' }, JSON.parse('{"__proto__": {"login": "x"}, "login": "y"}')]);
  const config = configWith({
    leavers: { columns: { username: ['constructor'], name: ['__proto__'], end: 'end' } },
    exports: [{ name: 'tool', format: 'json', fields: { username: ['login'], name: ['name', '__proto__.login'] } }]
  });
  const r = await run(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }, config), [...ARGS, '--format', 'json']);
  assert.equal(r.code, 1, r.err);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.findings.map((f) => [f.rule, f.leaver]), [['still-active', 'toString'], ['still-active', 'hasOwnProperty']]);
  assert.equal({}.login, undefined);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
});

test('hostile: a hundred thousand bad rows give twenty problems and a count, quickly', LIMIT, async () => {
  const leavers = leaversCsv(Array.from({ length: 100000 }, (_, i) => ['', `bad${i}`, '', '']));
  const r = await fast(() => run(filesWith({ 'leavers.csv': leavers }), ARGS), 10000);
  assert.equal(r.code, 2);
  assert.match(r.err, /and 199,980 more problems of the same kind/);
  assert.ok(r.err.split('\n').length < 30);
});

test('hostile: the configuration is refused at its limits, and a config file of megabytes is refused before it is read', async () => {
  const many = configWith({ exports: Array.from({ length: 51 }, (_, i) => ({ name: `t${i}`, format: 'csv', fields: { email: ['e'] } })) });
  const r = await run(filesWith({}, many), ARGS);
  assert.equal(r.code, 2);
  assert.match(r.err, /exports: holds more than 50 entries/);
  const big = await run(filesWith({ 'config.json': `{"name": "${'x'.repeat(2 * 1024 * 1024)}"}` }), ARGS);
  assert.equal(big.code, 2);
  assert.match(big.err, /config\.json: \d[\d,]* bytes is over the 1 MB limit/);
});

test('hostile: a device or a link to one is refused as not a regular file, with no line or column', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows has no /dev/zero and needs extra rights to make a symbolic link');
    return;
  }
  const device = await fast(() => cli(['--config', '/dev/zero', '--leavers', '/dev/zero', '--export', 'tool=/dev/zero'], process.cwd()));
  assert.equal(device.code, 2);
  assert.match(device.err, /not a regular file/);
  await withFiles({ 'config.json': configText(BASE_CONFIG), 'leavers.csv': leaversCsv([['A', 'a@example.com', 'a', '-1']]) }, async (dir) => {
    await symlink('/dev/zero', resolve(dir, 'tool.csv'));
    const r = await fast(() => cli(ARGS, dir));
    assert.equal(r.code, 2);
    assert.match(r.err, /tool\.csv: not a regular file/);
  });
});

test('hostile: a link to a regular file named on the command line is read, because the person who runs the tool named it', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows needs extra rights to make a symbolic link');
    return;
  }
  await withFiles(filesWith(), async (dir) => {
    await symlink(resolve(dir, 'tool.csv'), resolve(dir, 'linked.csv'));
    const r = await cli([...ARGS.slice(0, 4), '--export', 'tool=linked.csv'], dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /linked\.csv/);
  });
});
