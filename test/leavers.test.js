import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LeaversError, MAX_PROBLEMS, capProblems, columnIndex, readLeavers } from '../src/index.js';
import { DAY0, csvText, isoDay, leaversCsv, lineOf } from './helpers.js';

const COLUMNS = { email: ['email'], username: ['login'], name: ['name'], end: 'end', delimiter: ',' };
const read = (text, columns = COLUMNS, options = {}) => readLeavers(text, 'leavers.csv', columns, options);
const refused = (text, pattern, columns = COLUMNS) => assert.throws(() => read(text, columns), (e) => e instanceof LeaversError && e.problems.some((p) => pattern.test(p)), text.slice(0, 80));

test('leavers: each row gives its identifiers in their normal form, its line and its end of work', () => {
  const text = leaversCsv([['Ana Lopez', 'Ana+x@Example.com', '@ana-l', '-10'], ['Ben Ode', '', 'bode', isoDay(DAY0)], ['Cy Moe', 'cy@example.com', '', '']]);
  const r = read(text, COLUMNS, { plusAddressing: true });
  assert.equal(r.rows, 3);
  assert.deepEqual(r.endKinds, { relative: 1, date: 1, none: 1 });
  const [ana, ben, cy] = r.leavers;
  assert.equal(ana.line, 2);
  assert.equal(ana.emails[0].key, 'ana@example.com');
  assert.equal(ana.emails[0].column, 'email');
  assert.equal(ana.usernames[0].key, 'ana-l');
  assert.equal(ana.names[0].key, 'ana lopez');
  assert.deepEqual(ana.end, { kind: 'relative', value: -10 });
  assert.deepEqual(ben.emails, []);
  assert.deepEqual(ben.end, { kind: 'date', day: DAY0 });
  assert.deepEqual(cy.usernames, []);
  assert.deepEqual(cy.end, { kind: 'none' });
});

test('leavers: columns the configuration does not name are not read, and several columns of one kind are all read', () => {
  const text = csvText(['work', 'private', 'gh', 'other', 'notes'], [['a@example.com', 'a@mail.example.net', 'a1', 'a2', 'free text, "quoted"']]);
  const r = read(text, { email: ['work', 'private'], username: ['gh', 'other'], name: [], end: null, delimiter: ',' });
  assert.deepEqual(r.leavers[0].emails.map((e) => e.column), ['work', 'private']);
  assert.deepEqual(r.leavers[0].usernames.map((e) => e.key), ['a1', 'a2']);
  assert.deepEqual(r.endKinds, { relative: 0, date: 0, none: 1 });
});

test('leavers: a column the configuration names and the header lacks, or holds twice, stops the run', () => {
  refused('name,email,login\nA,a@example.com,a\n', /leavers\.csv:1: the header has no column end, which leavers\.columns names/);
  refused('name,email,login,end,email\nA,a@example.com,a,1,b@example.com\n', /holds the column email 2 times; the tool will not pick one/);
  const { index, problems } = columnIndex([' a ', 'b'], ['a', 'c'], 'x');
  assert.equal(index.get('a'), 0);
  assert.deepEqual(problems, ['the header has no column c, which x names']);
});

test('leavers: a row with no identifier, an email cell that is not an address, or an end that cannot be read stops the run with its line', () => {
  const text = leaversCsv([['Ana', 'ana@example.com', 'a', '-1'], ['', '', '', '-2'], ['Cy', 'cy at example.com', '', ''], ['Di', 'di@example.com', '', 'next week']]);
  try {
    read(text);
    assert.fail('not refused');
  } catch (error) {
    assert.ok(error instanceof LeaversError);
    assert.match(error.problems[0], new RegExp(`^leavers\\.csv:${lineOf(text, ',,,-2')}: the row holds no email address, username or name`));
    assert.match(error.problems[1], new RegExp(`^leavers\\.csv:${lineOf(text, 'Cy,')}: the column email holds c\\.\\.\\., which is not an email address`));
    assert.doesNotMatch(error.problems[1], /cy at example/, 'the bad value is not repeated in full');
    assert.match(error.problems[2], new RegExp(`^leavers\\.csv:${lineOf(text, 'Di,')}: the column end holds next week, which is neither a whole number of days from the as-of day nor a date YYYY-MM-DD`));
  }
});

test('leavers: a CSV problem stops the run with the line of the leavers file', () => {
  const text = 'name,email,login,end\nA,a@example.com,"a,1\n';
  refused(text, /^leavers\.csv:2: a field in double quotes that starts on line 2 is never closed/);
  refused('name;email;login;end\nA;a@example.com;a;1\n', /the header has no column email/);
  assert.equal(read('name;email;login;end\nA;a@example.com;a;1\n', { ...COLUMNS, delimiter: ';' }).leavers.length, 1);
});

test('leavers: at most twenty problems are listed, then a count of the rest; and the number of leavers is capped', () => {
  const many = Array.from({ length: MAX_PROBLEMS + 5 }, (_, i) => ['N', `bad${i}`, '', '']);
  try {
    read(leaversCsv(many));
    assert.fail('not refused');
  } catch (error) {
    assert.equal(error.problems.length, MAX_PROBLEMS + 1);
    assert.equal(error.problems.at(-1), 'and 5 more problems of the same kind');
  }
  assert.deepEqual(capProblems(['a']), ['a']);
  assert.throws(() => readLeavers(leaversCsv([['A', '', 'a', ''], ['B', '', 'b', '']]), 'l.csv', COLUMNS, {}, { maxLeavers: 1 }), /more than 1 leavers/);
});
