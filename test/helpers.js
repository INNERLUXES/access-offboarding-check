// Shared test helpers: inputs built inline, checked in memory or written into a temporary folder that is removed after the
// test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and Windows. The
// line a test expects is found with lineOf(), which counts lines the way the tool does, so a test never holds a line
// number worked out by hand for one system only. A date is built from a day number with isoDay(), so no test file holds a
// number that reads like a year, and no test reads the clock.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { dateOfDay, lineStarts, main, positionOf, readConfig } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'access-offboarding-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return positionOf(lineStarts(text), at).line;
}

// A day number far from any edge of the calendar, and the date YYYY-MM-DD of a day number, in UTC.
export const DAY0 = 20000;
export const isoDay = (day) => dateOfDay(day);

// A CSV text from a header and rows of cells; a cell with a comma, a quote or a line break is quoted.
export function csvText(header, rows) {
  const cell = (c) => (/[",\r\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c));
  return `${[header, ...rows].map((r) => r.map(cell).join(',')).join('\n')}\n`;
}

// A leavers file: rows of [name, email, login, end].
export const leaversCsv = (rows) => csvText(['name', 'email', 'login', 'end'], rows);

// An export in CSV with the columns name, email, login and status.
export const accountsCsv = (rows) => csvText(['name', 'email', 'login', 'status'], rows);

// The configuration that most tests use: one CSV export named tool with a status column.
export const BASE_CONFIG = {
  company: { domains: ['example.com'] },
  leavers: { columns: { email: ['email'], username: ['login'], name: ['name'], end: 'end' } },
  exports: [{ name: 'tool', format: 'csv', fields: { email: ['email'], username: ['login'], name: ['name'] }, status: [{ field: 'status', active: ['active'], inactive: ['disabled'] }] }],
  rules: { stillActive: { graceDays: 0, level: 'error' }, possibleMatch: { level: 'warning' } }
};

// A configuration object with some parts replaced; a part set to undefined is left out.
export function configWith(parts = {}) {
  const c = { ...BASE_CONFIG, ...parts };
  for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
  return c;
}

// The normal form of a configuration written as an object, through the real reader.
export const configOf = (object) => readConfig(JSON.stringify(object), 'config.json');

// A configuration file text for the command line tests.
export const configText = (object) => `${JSON.stringify(object, null, 2)}\n`;

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err, dir };
  });
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// The arguments that most command line tests use, and the files they need.
export const ARGS = ['--config', 'config.json', '--leavers', 'leavers.csv', '--export', 'tool=tool.csv'];
export const LEAVERS = leaversCsv([['Ana Lopez', 'ana@example.com', 'ana-l', '-10'], ['Ben Ode', 'ben@example.com', 'bode', '-3']]);
export const ACCOUNTS = accountsCsv([['Ana Lopez', 'ana@example.com', 'ana-l', 'active'], ['Ben Ode', 'ben@example.com', 'bode', 'disabled'], ['Cy Moe', 'cy@example.com', 'cym', 'active']]);
export const filesWith = (extra = {}, config = BASE_CONFIG) => ({ 'config.json': configText(config), 'leavers.csv': LEAVERS, 'tool.csv': ACCOUNTS, ...extra });

export const findingsOf = (report, rule) => report.findings.filter((f) => !rule || f.rule === rule);
