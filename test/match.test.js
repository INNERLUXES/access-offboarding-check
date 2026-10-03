import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, matchAccount, outsideAddresses, readLeavers } from '../src/index.js';
import { leaversCsv } from './helpers.js';

const COLUMNS = { email: ['email'], username: ['login'], name: ['name'], end: 'end', delimiter: ',' };
const OPTIONS = { plusAddressing: true, domainAliases: new Map([['old.example.com', 'example.com']]) };
const leaversOf = (rows, options = OPTIONS) => readLeavers(leaversCsv(rows), 'l.csv', COLUMNS, options).leavers;
const account = (values) => ({ line: 2, item: 1, status: 'active', statusValues: [], values: { email: [], username: [], name: [], ...values } });
const v = (field, raw) => ({ field, raw });

const LEAVERS = leaversOf([['Ana Lopez', 'Ana.Lopez+contract@Example.com', 'ana-l', '-3'], ['Ben Ode', 'ben@old.example.com', 'bode', '-3'], ['Cy Moe', '', 'cym', '-3']]);
const INDEX = buildIndex(LEAVERS);
const match = (values, options = OPTIONS) => matchAccount(INDEX, account(values), options);

test('match: an email address read without case, with the plus tag left out, is an exact match, with its steps', () => {
  const [m] = match({ email: [v('Email', 'ana.lopez@EXAMPLE.com')] });
  assert.equal(m.leaver, 0);
  assert.equal(m.strength, 'exact');
  assert.deepEqual(m.reasons, [{ kind: 'email', leaverColumn: 'email', leaverValue: 'Ana.Lopez+contract@Example.com', leaverSteps: ['read without case', 'the plus tag left out'], accountField: 'Email', accountValue: 'ana.lopez@EXAMPLE.com', accountSteps: ['read without case'] }]);
  assert.equal(match({ email: [v('Email', 'ana.lopez+other@example.com')] })[0].leaver, 0, 'another plus tag on the account side');
});

test('match: without plus addressing, a plus tag makes another address', () => {
  const plain = { plusAddressing: false, domainAliases: new Map() };
  const index = buildIndex(leaversOf([['Ana Lopez', 'ana+x@example.com', '', '-1']], plain));
  assert.deepEqual(matchAccount(index, account({ email: [v('e', 'ana@example.com')] }), plain), []);
  assert.equal(matchAccount(index, account({ email: [v('e', 'ANA+X@example.com')] }), plain)[0].strength, 'exact');
});

test('match: a domain alias joins the old and the company domain, in either file', () => {
  assert.equal(match({ email: [v('e', 'ben@example.com')] })[0].leaver, 1);
  assert.equal(match({ email: [v('e', 'BEN@old.example.com')] })[0].leaver, 1);
  assert.deepEqual(match({ email: [v('e', 'ben@older.example.com')] }), [], 'a near domain is not the alias');
  const plain = { plusAddressing: false, domainAliases: new Map() };
  const index = buildIndex(leaversOf([['Ben Ode', 'ben@old.example.com', '', '-1']], plain));
  assert.deepEqual(matchAccount(index, account({ email: [v('e', 'ben@example.com')] }), plain), [], 'no alias: two domains');
});

test('match: a username is an exact match without case and with a leading @ left out; a near miss is no match', () => {
  assert.equal(match({ username: [v('login', '@BODE')] })[0].leaver, 1);
  assert.equal(match({ username: [v('login', 'cym')] })[0].strength, 'exact');
  for (const near of ['bode2', 'b0de', 'bo-de', 'cy', 'cymm']) assert.deepEqual(match({ username: [v('login', near)] }), [], near);
});

test('match: a full name alone is only a possible match, and never when an exact match to the same leaver exists', () => {
  const [p] = match({ name: [v('User name', '  ana   LOPEZ ')] });
  assert.equal(p.strength, 'possible');
  assert.equal(p.reasons[0].kind, 'name');
  const both = match({ name: [v('n', 'Ana Lopez')], username: [v('login', 'ana-l')] });
  assert.equal(both.length, 1);
  assert.equal(both[0].strength, 'exact');
  assert.deepEqual(both[0].reasons.map((r) => r.kind), ['username']);
  for (const near of ['Ana Lopes', 'Lopez Ana', 'Ana', 'Ana M Lopez']) assert.deepEqual(match({ name: [v('n', near)] }), [], near);
});

test('match: one account can match two leavers, and its reasons name every value that matched', () => {
  const ms = match({ email: [v('mail', 'ben@example.com')], username: [v('login', 'ana-l'), v('alt', 'bode')] });
  assert.deepEqual(ms.map((m) => [m.leaver, m.strength, m.reasons.map((r) => `${r.kind}:${r.accountField}`)]), [[0, 'exact', ['username:login']], [1, 'exact', ['email:mail', 'username:alt']]]);
});

test('match: an email value that is not an address is counted, not compared; other values are not looked at as addresses', () => {
  const bad = { emails: 0 };
  assert.deepEqual(matchAccount(INDEX, account({ email: [v('e', 'ana-l')] }), OPTIONS, bad), []);
  assert.equal(bad.emails, 1);
  assert.deepEqual(match({ username: [v('login', 'ana.lopez@example.com')] }), [], 'an address in a username field is compared with usernames');
});

test('match: identifiers held by two leavers are listed as shared', () => {
  const index = buildIndex(leaversOf([['A', 'same@example.com', 'x', '-1'], ['B', 'SAME@example.com', 'y', '-1'], ['C', 'c@example.com', 'x', '-1']]));
  assert.deepEqual(index.shared.map((s) => [s.kind, s.key, s.leavers]), [['email', 'same@example.com', [0, 1]], ['username', 'x', [0, 2]]]);
  assert.deepEqual(INDEX.shared, []);
});

test('outsideAddresses: the addresses outside the company domains, after the aliases; no address means not checked', () => {
  const companies = ['example.com'];
  assert.deepEqual(outsideAddresses(account({ email: [v('e', 'a@example.com'), v('f', 'a@OLD.example.com')] }), companies, OPTIONS), { checked: true, outside: [] });
  assert.deepEqual(outsideAddresses(account({ email: [v('e', 'a@example.com'), v('f', 'a@mail.example.net')] }), companies, OPTIONS), { checked: true, outside: [{ field: 'f', value: 'a@mail.example.net', domain: 'mail.example.net' }] });
  assert.deepEqual(outsideAddresses(account({ email: [v('e', 'a@sub.example.com')] }), companies, OPTIONS).outside.length, 1, 'a subdomain is another domain');
  assert.deepEqual(outsideAddresses(account({ email: [v('e', 'none')] }), companies, OPTIONS), { checked: false, outside: [] });
  assert.deepEqual(outsideAddresses(account({}), companies, OPTIONS), { checked: false, outside: [] });
});
