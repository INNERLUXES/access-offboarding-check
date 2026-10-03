import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExportError, readExport, statusOf, valueAt } from '../src/index.js';
import { accountsCsv, configOf, configWith, csvText, lineOf } from './helpers.js';

const exportOf = (e) => configOf(configWith({ exports: [e] })).exports[0];
const CSV_EXPORT = exportOf({ name: 'tool', format: 'csv', fields: { email: ['email'], username: ['login'], name: ['name'] }, status: [{ field: 'status', active: ['Active'], inactive: ['Disabled', 'Removed'] }] });
const JSON_EXPORT = exportOf({ name: 'tool', format: 'json', rows: 'data.users', fields: { email: ['mail', 'aliases'], username: ['handle'], name: ['profile.name'] }, status: [{ field: 'state', active: ['on'], inactive: ['off'] }, { field: 'locked', active: ['false'], inactive: ['true'] }] });

test('accounts: a CSV export gives each row with its line, its identifiers and its status', () => {
  const text = accountsCsv([['Ana', 'ana@example.com', 'ana-l', 'active'], ['Ben', ' ', 'bode', ' DISABLED '], ['Cy', 'cy@example.com', '', 'pending'], ['Di', 'di@example.com', 'di', '']]);
  const r = readExport(text, 'tool.csv', CSV_EXPORT);
  assert.equal(r.rows, 4);
  assert.deepEqual(r.accounts.map((a) => [a.line, a.status]), [[2, 'active'], [3, 'inactive'], [4, 'unknown'], [5, 'unknown']]);
  assert.deepEqual(r.accounts[0].values, { email: [{ field: 'email', raw: 'ana@example.com' }], username: [{ field: 'login', raw: 'ana-l' }], name: [{ field: 'name', raw: 'Ana' }] });
  assert.deepEqual(r.accounts[1].values.email, [], 'an empty cell gives no value');
  assert.deepEqual(r.accounts[1].statusValues, [{ field: 'status', value: 'DISABLED' }]);
  assert.deepEqual(r.accounts[3].statusValues, [{ field: 'status', value: '' }]);
  assert.deepEqual({ accounts: r.counts.accounts, active: r.counts.active, inactive: r.counts.inactive, unknown: r.counts.unknown }, { accounts: 4, active: 1, inactive: 1, unknown: 2 });
});

test('accounts: a CSV export whose header lacks a named column stops the run, and so does a CSV problem', () => {
  assert.throws(() => readExport('name,email,login\nA,a@example.com,a\n', 'tool.csv', CSV_EXPORT), (e) => e instanceof ExportError && /^tool\.csv:1: the header has no column status, which the export tool names/.test(e.problems[0]));
  const wiki = exportOf({ name: 'wiki', preset: 'atlassian-users' });
  assert.throws(() => readExport('User name,Email\nA,a@example.com\n', 'wiki.csv', wiki), /the header has no column User status, which the export wiki \(preset atlassian-users\) names/);
  const text = 'name,email,login,status\nA,a@example.com,a,active\nB,b@example.com\n';
  assert.throws(() => readExport(text, 'tool.csv', CSV_EXPORT), new RegExp(`^Error: tool\\.csv:${lineOf(text, 'B,')}: 2 fields where the header`));
  assert.throws(() => readExport(accountsCsv([['A', '', 'a', 'active'], ['B', '', 'b', 'active']]), 'tool.csv', CSV_EXPORT, { maxAccounts: 1 }), /more than 2 records|more than 1 accounts/);
});

test('accounts: a JSON export reads the rows at its path, dot paths inside each row, lists of values and booleans', () => {
  const text = JSON.stringify({ data: { users: [
    { mail: 'ana@example.com', aliases: ['ana.l@example.com', 7, null], handle: 'ana-l', profile: { name: 'Ana Lopez' }, state: 'on', locked: false },
    { mail: null, handle: 'bode', profile: {}, state: 'ON', locked: true },
    { mail: 'cy@example.com', state: 'on' }
  ] } }, null, 2);
  const r = readExport(text, 'tool.json', JSON_EXPORT);
  const [ana, ben, cy] = r.accounts;
  assert.deepEqual(ana.values.email.map((v) => v.raw), ['ana@example.com', 'ana.l@example.com', '7']);
  assert.deepEqual(ana.values.name, [{ field: 'profile.name', raw: 'Ana Lopez' }]);
  assert.equal(ana.status, 'active');
  assert.equal(ana.line, lineOf(text, '{', 3));
  assert.equal(ana.item, 1);
  assert.equal(ben.status, 'inactive', 'a true in the inactive list wins over an active value');
  assert.deepEqual(ben.values.email, []);
  assert.equal(cy.status, 'unknown', 'a missing status field is an unknown status');
  assert.equal(r.counts.oddValues, 0);
  assert.equal(r.counts.missing.size, 0);
});

test('accounts: a top list of objects, a field that is in no row, and values that are objects are counted for the notes', () => {
  const e = exportOf({ name: 'gh', preset: 'github-org-members' });
  const r = readExport('[{"login": "a", "id": 1}, {"login": "b"}]', 'gh.json', e);
  assert.deepEqual(r.accounts.map((a) => [a.values.username[0].raw, a.status]), [['a', 'active'], ['b', 'active']]);
  const g = exportOf({ name: 'g', preset: 'google-directory-users' });
  const r2 = readExport(JSON.stringify({ users: [{ primaryEmail: 'a@example.com', name: { fullName: 'A B' }, suspended: false, archived: false, aliases: [{ x: 1 }] }] }), 'g.json', g);
  assert.equal(r2.accounts[0].status, 'active');
  assert.equal(r2.counts.oddValues, 1);
  const r3 = readExport(JSON.stringify({ users: [{ primary: 'a@example.com', suspended: false, archived: false }] }), 'g.json', g);
  assert.deepEqual([...r3.counts.missing.keys()].sort(), ['aliases', 'name.fullName', 'primaryEmail']);
});

test('accounts: a JSON export whose rows are not a list of objects stops the run with the line', () => {
  const e = exportOf({ name: 'gh', preset: 'github-org-members' });
  assert.throws(() => readExport('{"login": "a"}', 'gh.json', e), /gh\.json: the top value is not a list of accounts as the preset github-org-members expects/);
  assert.throws(() => readExport('{"data": {}}', 'tool.json', JSON_EXPORT), /the value at data\.users is not a list of accounts/);
  const text = '[\n  {"login": "a"},\n  "b"\n]';
  assert.throws(() => readExport(text, 'gh.json', e), new RegExp(`gh\\.json:${lineOf(text, '"b"')}: account 2 is not an object`));
  assert.throws(() => readExport('[{"login": "a", "login": "b"}]', 'gh.json', e), /gh\.json: line 1, column \d+: the name "login" appears twice/);
  assert.throws(() => readExport('[{"login": "a"}, {"login": "b"}]', 'gh.json', e, { maxAccounts: 1 }), /more than 1 accounts/);
});

test('accounts: valueAt follows own properties only', () => {
  const row = JSON.parse('{"a": {"b": "x"}, "__proto__": {"c": "y"}}');
  assert.equal(valueAt(row, 'a.b'), 'x');
  assert.equal(valueAt(row, '__proto__.c'), 'y');
  assert.equal(valueAt(row, 'toString'), undefined);
  assert.equal(valueAt(row, 'a.b.c'), undefined);
  assert.equal(valueAt({ a: [1] }, 'a.0'), undefined, 'a list is not followed by a dot path');
});

test('accounts: statusOf, with no status field, with values in neither list and with several fields', () => {
  const s = [{ field: 'f', active: new Set(['on']), inactive: new Set(['off']) }, { field: 'g', active: new Set(['false']), inactive: new Set(['true']) }];
  assert.deepEqual(statusOf([], []), { status: 'active', values: [] });
  assert.equal(statusOf(s, ['ON ', 'false']).status, 'active');
  assert.equal(statusOf(s, ['on', 'true']).status, 'inactive');
  assert.equal(statusOf(s, ['maybe', 'true']).status, 'inactive');
  assert.equal(statusOf(s, ['maybe', 'false']).status, 'unknown');
  assert.equal(statusOf(s, [null, 'false']).status, 'unknown');
  assert.deepEqual(statusOf(s, [null, ' false ']).values, [{ field: 'f', value: null }, { field: 'g', value: 'false' }]);
});

test('accounts: a CSV export with a semicolon delimiter and quoted cells', () => {
  const e = exportOf({ name: 'tool', format: 'csv', delimiter: ';', fields: { email: ['mail'] } });
  const r = readExport(csvText(['mail', 'x'], [['a@example.com', '1']]).replace(',', ';').replace(',', ';'), 'tool.csv', e);
  assert.equal(r.accounts[0].values.email[0].raw, 'a@example.com');
  assert.equal(r.accounts[0].status, 'active');
});
