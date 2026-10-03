import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FACTS, PRESETS, PRESET_NAMES, presetList, readExport, source } from '../src/index.js';
import { configOf, configWith, csvText } from './helpers.js';

// Each preset is checked against its saved page: every field, column and status value it names is on the page, and a
// file in the shape the page shows is read by the preset.

const page = async (id) => readFile(new URL(`../research/sources/${source(id).file}`, import.meta.url), 'utf8');
const exportOf = (preset) => configOf(configWith({ exports: [{ name: 'tool', preset }] })).exports[0];

test('presets: five presets, each with a format, fields, a status list and the sentences of its page', () => {
  assert.deepEqual(PRESET_NAMES, ['github-org-members', 'github-outside-collaborators', 'google-directory-users', 'entra-users', 'atlassian-users']);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.ok(['csv', 'json'].includes(p.format), name);
    assert.ok(p.title.length > 20, name);
    assert.ok(p.facts.length >= 1, name);
    for (const k of p.facts) assert.ok(FACTS[k], `${name}: ${k}`);
    assert.ok(Object.values(p.fields).some((f) => f.length), name);
    if (p.format === 'csv') assert.equal(p.rows, '', name);
  }
  assert.equal(presetList().length, PRESET_NAMES.length);
  assert.match(presetList()[0], /^github-org-members \(json\): GitHub/);
});

test('presets: every field and status value a preset names is on its saved page', async () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    const text = (await Promise.all([...new Set(p.facts.map((k) => FACTS[k].source))].map(page))).join('\n');
    for (const field of [...p.fields.email, ...p.fields.username, ...p.fields.name, ...p.status.map((s) => s.field)]) {
      for (const part of field.split('.')) assert.ok(text.includes(part), `${name}: ${part}`);
    }
    // A status of true or false is on a page as a field of the type boolean; any other value is on the page itself.
    const boolean = (field) => text.includes(`"${field}": boolean`) || text.includes(`${field}\nBoolean\ntrue if`);
    for (const s of p.status) for (const v of [...s.active, ...s.inactive]) assert.ok(['true', 'false'].includes(v) ? boolean(s.field) : text.toLowerCase().includes(v.toLowerCase()), `${name}: ${s.field} ${v}`);
    if (p.rows) assert.ok(text.includes(`"${p.rows}": [`), `${name}: ${p.rows}`);
  }
});

test('presets: the GitHub presets read the example response saved from each page', async () => {
  for (const [preset, id] of [['github-org-members', 'github-members'], ['github-outside-collaborators', 'github-outside']]) {
    const text = await page(id);
    const body = text.slice(text.indexOf('Status: 200\n') + 'Status: 200\n'.length);
    const r = readExport(body, 'members.json', exportOf(preset));
    assert.equal(r.accounts.length, 1, preset);
    assert.deepEqual(r.accounts[0].values.username, [{ field: 'login', raw: 'octocat' }]);
    assert.equal(r.accounts[0].status, 'active', 'a list of members has no status: every row is a member');
  }
});

test('presets: the Google preset reads users with primaryEmail, aliases, name.fullName, suspended and archived', () => {
  const body = JSON.stringify({ kind: 'admin#directory#users', users: [
    { primaryEmail: 'ana@example.com', aliases: ['a.lopez@example.com'], name: { fullName: 'Ana Lopez' }, suspended: false, archived: false },
    { primaryEmail: 'ben@example.com', name: { fullName: 'Ben Ode' }, suspended: true, archived: false },
    { primaryEmail: 'cy@example.com', name: { fullName: 'Cy Moe' }, suspended: false, archived: true }
  ] });
  const r = readExport(body, 'users.json', exportOf('google-directory-users'));
  assert.deepEqual(r.accounts.map((a) => a.status), ['active', 'inactive', 'inactive']);
  assert.deepEqual(r.accounts[0].values.email.map((v) => v.field), ['primaryEmail', 'aliases']);
  assert.equal(r.accounts[0].values.name[0].raw, 'Ana Lopez');
});

test('presets: the Entra preset reads the attribute names of its page as column headings, with accountEnabled as the status', async () => {
  const text = await page('entra-download');
  const listed = text.slice(text.indexOf('The following user attributes are included:')).split('\n').slice(1, 26);
  assert.equal(listed.length, 25);
  for (const column of ['userPrincipalName', 'displayName', 'mail', 'accountEnabled']) assert.ok(listed.includes(column), column);
  const csv = csvText(listed, [listed.map((c) => ({ userPrincipalName: 'ana@example.com', displayName: 'Ana Lopez', accountEnabled: 'True' }[c] ?? '')), listed.map((c) => ({ userPrincipalName: 'ben@example.com', mail: 'ben@example.com', accountEnabled: 'False' }[c] ?? ''))]);
  const r = readExport(csv, 'users.csv', exportOf('entra-users'));
  assert.deepEqual(r.accounts.map((a) => a.status), ['active', 'inactive'], 'True and False are read without case');
  assert.deepEqual(r.accounts[1].values.email.map((v) => v.field), ['userPrincipalName', 'mail']);
});

test('presets: the Atlassian preset reads the four columns of its page and the three statuses', () => {
  const csv = csvText(['User ID', 'User name', 'Email', 'User status', 'Org role'], [['1', 'Ana Lopez', 'ana@example.com', 'Active', 'None'], ['2', 'Ben Ode', 'ben@example.com', 'Suspended', 'None'], ['3', 'Cy Moe', 'cy@example.com', 'Deactivated', 'None']]);
  const r = readExport(csv, 'users.csv', exportOf('atlassian-users'));
  assert.deepEqual(r.accounts.map((a) => a.status), ['active', 'inactive', 'inactive']);
  assert.deepEqual(r.accounts[0].values.name, [{ field: 'User name', raw: 'Ana Lopez' }]);
});
