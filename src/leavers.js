// The leavers file: one row for each person who stopped working for the company, with the columns that the configuration
// names. It is read with the strict CSV reader of src/csv.js. A column the configuration names and the header lacks stops
// the run; columns the configuration does not name are not read. Every row needs at least one identifier, and an email
// cell must hold an email address, because a leaver who cannot be matched would make the check pass for the wrong reason.

import { CsvError, parseCsv } from './csv.js';
import { emailKey, nameKey, usernameKey } from './identity.js';
import { readEnd } from './days.js';
import { safeText } from './text.js';

export const LEAVER_LIMITS = { maxLeavers: 100000 };

// At most this many problems are listed, then a count of the rest.
export const MAX_PROBLEMS = 20;

export function capProblems(problems) {
  if (problems.length <= MAX_PROBLEMS) return problems;
  return [...problems.slice(0, MAX_PROBLEMS), `and ${(problems.length - MAX_PROBLEMS).toLocaleString('en-US')} more problems of the same kind`];
}

export class LeaversError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

// The index of each named column in the header, or the problems of the columns the header lacks or holds twice.
export function columnIndex(header, names, what) {
  const index = new Map();
  const problems = [];
  const seen = new Map();
  header.forEach((h, i) => {
    const k = h.trim();
    if (seen.has(k)) seen.get(k).push(i);
    else seen.set(k, [i]);
  });
  for (const name of names) {
    const at = seen.get(name.trim());
    if (!at) problems.push(`the header has no column ${safeText(name, 80)}, which ${what} names`);
    else if (at.length > 1) problems.push(`the header holds the column ${safeText(name, 80)} ${at.length} times; the tool will not pick one`);
    else index.set(name, at[0]);
  }
  return { index, problems };
}

// Reads the leavers file. columns is the leavers part of the configuration in normal form; options holds plusAddressing
// and domainAliases. Returns { leavers, endKinds, notes }; throws LeaversError with every problem and its line.
export function readLeavers(text, file, columns, options = {}, limits = LEAVER_LIMITS) {
  let csv;
  try {
    csv = parseCsv(text, { delimiter: columns.delimiter });
  } catch (error) {
    if (error instanceof CsvError) throw new LeaversError([`${file}:${error.line}: ${error.reason}`]);
    throw error;
  }
  const named = [...columns.email, ...columns.username, ...columns.name, ...(columns.end ? [columns.end] : [])];
  const { index, problems: headerProblems } = columnIndex(csv.header, named, 'leavers.columns');
  if (headerProblems.length) throw new LeaversError(headerProblems.map((p) => `${file}:1: ${p}`));
  if (csv.records.length > limits.maxLeavers) throw new LeaversError([`${file}: more than ${limits.maxLeavers.toLocaleString('en-US')} leavers`]);

  const problems = [];
  const leavers = [];
  const endKinds = { relative: 0, date: 0, none: 0 };
  for (const record of csv.records) {
    const cell = (column) => record.fields[index.get(column)];
    const leaver = { line: record.line, emails: [], usernames: [], names: [], end: { kind: 'none' }, endText: '' };
    for (const column of columns.email) {
      const raw = cell(column).trim();
      if (raw === '') continue;
      const k = emailKey(raw, options);
      if (!k) problems.push(`${file}:${record.line}: the column ${safeText(column, 60)} holds ${safeText(raw.slice(0, 1), 4)}..., which is not an email address`);
      else leaver.emails.push({ column, raw, ...k });
    }
    for (const column of columns.username) {
      const raw = cell(column).trim();
      if (raw === '') continue;
      const k = usernameKey(raw);
      if (k) leaver.usernames.push({ column, raw, ...k });
    }
    for (const column of columns.name) {
      const raw = cell(column).trim();
      if (raw === '') continue;
      const k = nameKey(raw);
      if (k) leaver.names.push({ column, raw, ...k });
    }
    if (!leaver.emails.length && !leaver.usernames.length && !leaver.names.length) {
      problems.push(`${file}:${record.line}: the row holds no email address, username or name in the columns the configuration names`);
    }
    if (columns.end) {
      const raw = cell(columns.end);
      const end = readEnd(raw);
      if (end.kind === 'bad') problems.push(`${file}:${record.line}: the column ${safeText(columns.end, 60)} holds ${safeText(raw, 40)}, which is neither a whole number of days from the as-of day nor a date YYYY-MM-DD`);
      else {
        leaver.end = end;
        leaver.endText = raw.trim();
        endKinds[end.kind] += 1;
      }
    } else endKinds.none += 1;
    leavers.push(leaver);
  }
  if (problems.length) throw new LeaversError(capProblems(problems));
  return { leavers, endKinds, rows: csv.records.length };
}
