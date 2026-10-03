import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, atOrAbove, decide, dueOf, ruleById } from '../src/index.js';
import { ARGS, BASE_CONFIG, accountsCsv, configWith, filesWith, findingsOf, leaversCsv, run } from './helpers.js';

const jsonRun = async (files, extra = []) => {
  const r = await run(files, [...ARGS, '--format', 'json', ...extra]);
  assert.ok(r.code === 0 || r.code === 1, r.err);
  return { code: r.code, report: JSON.parse(r.out) };
};

test('rules: three rules, each with a title, a rule text and the sentences it rests on', () => {
  assert.deepEqual(RULES.map((r) => [r.id, r.key]), [['still-active', 'stillActive'], ['possible-match', 'possibleMatch'], ['personal-address', 'personalAddress']]);
  assert.match(ruleById('still-active').rule({ graceDays: 7 }), /more than 7 days have passed since the last day of work/);
  assert.match(ruleById('personal-address').rule({}, { companyDomains: ['example.com', 'example.org'] }), /is not example\.com, example\.org/);
  assert.equal(ruleById('nothing'), undefined);
});

test('rules: dueOf with the grace days, at the edge and on each side of it', () => {
  assert.deepEqual(dueOf(null, 7), { due: true, text: 'taken as left' });
  assert.equal(dueOf(8, 7).due, true);
  assert.equal(dueOf(7, 7).due, false, 'the last grace day is still grace');
  assert.match(dueOf(7, 7).text, /7 days of 7 grace days passed/);
  assert.equal(dueOf(1, 0).due, true);
  assert.equal(dueOf(1, 0).text, 'past the last day of work');
  assert.equal(dueOf(0, 0).due, false, 'the last day of work is a working day');
  assert.equal(dueOf(0, 0).text, 'the last day of work is the as-of day');
  assert.equal(dueOf(-3, 0).due, false);
  assert.match(dueOf(-3, 0).text, /still working/);
});

test('rules: the fail level and the verdict', () => {
  assert.equal(atOrAbove('error', 'warning'), true);
  assert.equal(atOrAbove('warning', 'warning'), true);
  assert.equal(atOrAbove('notice', 'warning'), false);
  assert.deepEqual(decide([], 'notice'), { pass: true, failOn: 'notice', failing: 0, byLevel: { error: 0, warning: 0, notice: 0 }, text: 'PASS - no finding at or above notice' });
  const v = decide([{ level: 'notice' }, { level: 'warning' }, { level: 'error' }], 'warning');
  assert.equal(v.pass, false);
  assert.equal(v.text, 'FAIL - 2 findings at or above warning');
  assert.equal(decide([{ level: 'notice' }], 'warning').text, 'PASS - no finding at or above warning (1 below it)');
});

test('still-active: an active account of a leaver past the grace days is a finding; inactive, in grace or still working is not', async () => {
  const leavers = leaversCsv([['Ana', 'ana@example.com', '', '-8'], ['Ben', 'ben@example.com', '', '-7'], ['Cy', 'cy@example.com', '', '-30'], ['Di', 'di@example.com', '', '2'], ['Ed', 'ed@example.com', '', '']]);
  const accounts = accountsCsv([['', 'ana@example.com', '', 'active'], ['', 'ben@example.com', '', 'active'], ['', 'cy@example.com', '', 'disabled'], ['', 'di@example.com', '', 'active'], ['', 'ed@example.com', '', 'active']]);
  const config = configWith({ rules: { stillActive: { graceDays: 7, level: 'error' } } });
  const { code, report } = await jsonRun(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }, config));
  assert.equal(code, 1);
  assert.deepEqual(findingsOf(report, 'still-active').map((f) => f.leaver), ['Ana', 'Ed']);
  const byLeaver = Object.fromEntries(report.leavers.map((l) => [l.label, [l.due, l.accounts.map((a) => a.finding)]]));
  assert.deepEqual(byLeaver, { Ana: [true, ['still-active']], Ben: [false, [null]], Cy: [true, [null]], Di: [false, [null]], Ed: [true, ['still-active']] });
  assert.equal(report.totals.due, 3);
});

test('still-active: an account with a status the configuration does not list counts as active and is noted', async () => {
  const { report } = await jsonRun(filesWith({ 'leavers.csv': leaversCsv([['Ana', 'ana@example.com', '', '-3']]), 'tool.csv': accountsCsv([['', 'ana@example.com', '', 'pending']]) }));
  const [f] = findingsOf(report, 'still-active');
  assert.match(f.found, /is not marked inactive/);
  assert.ok(report.notes.some((n) => /tool: 1 account has a status the configuration does not list, and is counted as active/.test(n)));
});

test('possible-match: a name alone gives a finding of its own rule and level, only for a leaver who is due', async () => {
  const leavers = leaversCsv([['Ana Lopez', 'ana@example.com', 'ana-l', '-3'], ['Ben Ode', 'ben@example.com', '', '5']]);
  const accounts = accountsCsv([['Ana  LOPEZ', 'a.lopez@mail.example.net', 'al', 'active'], ['Ben Ode', 'bo@mail.example.net', '', 'active']]);
  const { report } = await jsonRun(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }, configWith({ rules: { stillActive: { graceDays: 0, level: 'error' }, possibleMatch: { level: 'notice' } } })));
  assert.deepEqual(report.findings.map((f) => [f.rule, f.level, f.leaver]), [['possible-match', 'notice', 'Ana Lopez']]);
  assert.equal(report.verdict.pass, true, 'a notice is below the fail level');
  assert.match(report.findings[0].found, /a possible match, to check by hand/);
});

test('possible-match: without the still-active rule, a leaver is due after the last day of work', async () => {
  const leavers = leaversCsv([['Ana Lopez', '', 'x', '-1'], ['Ben Ode', '', 'y', '0']]);
  const accounts = accountsCsv([['Ana Lopez', '', '', 'active'], ['Ben Ode', '', '', 'active']]);
  const { report } = await jsonRun(filesWith({ 'leavers.csv': leavers, 'tool.csv': accounts }, configWith({ rules: { possibleMatch: { level: 'warning' } } })));
  assert.deepEqual(report.findings.map((f) => f.leaver), ['Ana Lopez']);
  assert.equal(findingsOf(report, 'still-active').length, 0, 'a rule that is not stated is not run');
});

test('personal-address: an active account outside the company domains in a company-only export; not in other exports', async () => {
  const config = configWith({
    exports: [{ ...BASE_CONFIG.exports[0], companyAccountsOnly: true }, { name: 'other', format: 'csv', fields: { email: ['email'] } }],
    email: { domainAliases: { 'old.example.com': 'example.com' } },
    rules: { personalAddress: { level: 'error' } }
  });
  const accounts = accountsCsv([['A', 'a@example.com', '', 'active'], ['B', 'b@old.example.com', '', 'active'], ['C', 'c@mail.example.net', '', 'active'], ['D', 'd@mail.example.net', '', 'disabled'], ['E', '', 'e', 'active']]);
  const r = await run({ ...filesWith({ 'tool.csv': accounts }, config), 'other.csv': 'email\nz@mail.example.net\n' }, [...ARGS, '--export', 'other=other.csv', '--format', 'json']);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.findings.map((f) => [f.rule, f.export, f.found]), [['personal-address', 'tool', 'the account C in tool has c***@mail.example.net outside the company domains']]);
  assert.ok(report.notes.some((n) => /tool: 1 active account has no email address, so personal-address cannot check it/.test(n)));
  assert.equal(r.code, 1);
});

test('rules: findings are sorted by level, rule, leaver, export and line, and the order does not depend on the input order', async () => {
  const leavers = leaversCsv([['Ben', 'ben@example.com', '', '-3'], ['Ana', 'ana@example.com', '', '-3']]);
  const accounts = accountsCsv([['', 'ana@example.com', '', 'active'], ['', 'ben@example.com', '', 'active']]);
  const config = configWith({ rules: { stillActive: { graceDays: 0, level: 'warning' }, possibleMatch: { level: 'error' } } });
  const { report } = await jsonRun(filesWith({ 'leavers.csv': leavers, 'tool.csv': `${accounts}Ana Ann,x@mail.example.net,,active\n` }, config));
  assert.deepEqual(report.findings.map((f) => [f.level, f.leaver, f.line]), [['warning', 'Ben', 3], ['warning', 'Ana', 2]]);
});
