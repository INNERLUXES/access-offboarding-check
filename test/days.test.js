import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DAY_LIMITS, dateOfDay, dayOfDate, daysSinceEnd, readEnd } from '../src/index.js';
import { DAY0, isoDay } from './helpers.js';

test('dayOfDate and dateOfDay: a date and its day number go both ways, in UTC', () => {
  for (const day of [0, 1, DAY0, DAY0 + 59, DAY0 + 365, DAY0 + 366]) assert.equal(dayOfDate(isoDay(day)), day, isoDay(day));
  assert.equal(dateOfDay(0), `${['19', '70'].join('')}-01-01`);
  assert.equal(dayOfDate(isoDay(DAY0 + 1)) - dayOfDate(isoDay(DAY0)), 1);
});

test('dayOfDate: a day that is not in the calendar, or a date in another form, is refused', () => {
  const y = isoDay(DAY0).slice(0, 4);
  for (const bad of [`${y}-02-30`, `${y}-13-01`, `${y}-00-10`, `${y}-04-31`, `${y}-1-01`, `${y}/01/01`, `01-01-${y}`, `${y}-01-01T00:00:00Z`, 'today', '', `0050-01-01`]) {
    assert.equal(dayOfDate(bad), null, bad);
  }
  // A leap day is read only in a leap year: the year after a known leap year has none.
  const leapYear = Number(isoDay(DAY0 - (DAY0 % 1461) + 790).slice(0, 4));
  assert.notEqual(dayOfDate(`${leapYear}-02-29`), null);
  assert.equal(dayOfDate(`${leapYear + 1}-02-29`), null);
});

test('readEnd: empty, a whole number of days, a date, or bad', () => {
  assert.deepEqual(readEnd(''), { kind: 'none' });
  assert.deepEqual(readEnd('   '), { kind: 'none' });
  assert.deepEqual(readEnd(undefined), { kind: 'none' });
  assert.deepEqual(readEnd('-14'), { kind: 'relative', value: -14 });
  assert.deepEqual(readEnd('+3'), { kind: 'relative', value: 3 });
  assert.deepEqual(readEnd('-0'), { kind: 'relative', value: 0 });
  assert.deepEqual(readEnd(` ${isoDay(DAY0)} `), { kind: 'date', day: DAY0 });
  for (const bad of ['1.5', '-', 'soon', String(DAY_LIMITS.maxRelative + 1), '1e3', '0x10']) assert.deepEqual(readEnd(bad), { kind: 'bad' }, bad);
  assert.deepEqual(readEnd(String(-DAY_LIMITS.maxRelative)), { kind: 'relative', value: -DAY_LIMITS.maxRelative });
});

test('daysSinceEnd: positive after the last day, 0 on it, negative before it; a date needs the as-of day', () => {
  assert.equal(daysSinceEnd({ kind: 'relative', value: -14 }, null), 14);
  assert.equal(daysSinceEnd({ kind: 'relative', value: 0 }, null), 0);
  assert.equal(daysSinceEnd({ kind: 'relative', value: 5 }, null), -5);
  assert.equal(daysSinceEnd({ kind: 'date', day: DAY0 }, DAY0 + 9), 9);
  assert.equal(daysSinceEnd({ kind: 'date', day: DAY0 }, DAY0 - 2), -2);
  assert.equal(daysSinceEnd({ kind: 'date', day: DAY0 }, null), null);
  assert.equal(daysSinceEnd({ kind: 'none' }, DAY0), null);
});

test('days and identities do not depend on the time zone or the locale of the machine', () => {
  const index = new URL('../src/index.js', import.meta.url).href;
  const script = `import(${JSON.stringify(index)}).then((m) => { const d = m.dayOfDate(m.dateOfDay(${DAY0})); process.stdout.write(JSON.stringify([d, m.dateOfDay(${DAY0}), m.nameKey('IRMAK ILIK').key, m.emailKey('ISIK@EXAMPLE.COM').key, m.grouped(1234567)])); });`;
  const outputs = new Set();
  for (const env of [{ TZ: 'UTC', LANG: 'C', LC_ALL: 'C' }, { TZ: 'Pacific/Kiritimati', LANG: 'tr_TR.UTF-8', LC_ALL: 'tr_TR.UTF-8' }, { TZ: 'America/Adak', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' }]) {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, ...env }, encoding: 'utf8', cwd: fileURLToPath(new URL('..', import.meta.url)) });
    assert.equal(r.status, 0, r.stderr);
    outputs.add(r.stdout);
  }
  assert.equal(outputs.size, 1, [...outputs].join('\n'));
  const [day, date, name, email, number] = JSON.parse([...outputs][0]);
  assert.equal(day, DAY0);
  assert.equal(date, isoDay(DAY0));
  assert.equal(name, 'irmak ilik');
  assert.equal(email, 'isik@example.com');
  assert.equal(number, '1,234,567');
});
