// An account export: the accounts of one tool, in CSV or JSON, with the fields the configuration or a preset names. Each
// row becomes an account with its identifiers, the line it starts on and its status. The status is read only from the
// status fields of the configuration: a value in the inactive list makes the account inactive, a value in the active
// list leaves it active, and any other value, or no value, is an unknown status that is counted as active and noted,
// because an account the tool cannot place must not drop out of the check. An export with no status field is a list of
// accounts that exist, such as the members of an organization, and every row in it is active.

import { CsvError, parseCsv } from './csv.js';
import { JsonError, jsonProblem, parseJson } from './json.js';
import { columnIndex } from './leavers.js';
import { safeText } from './text.js';

export const ACCOUNT_LIMITS = { maxAccounts: 1000000, json: { maxDepth: 64, maxValues: 20000000, maxStringLength: 65536 } };

export class ExportError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const KINDS = ['email', 'username', 'name'];

// The value at a dot path inside a JSON object, or undefined; only own properties are followed.
export function valueAt(object, path) {
  let cur = object;
  for (const part of path.split('.')) {
    if (!isObject(cur) || !Object.hasOwn(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

// The texts of a JSON value for an identifier: a string, number or boolean is one text, a list gives each string or
// number in it, and anything else gives none. odd counts the values that were not read.
function textsOf(value, odd) {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) {
      if (typeof v === 'string') out.push(v);
      else if (typeof v === 'number') out.push(String(v));
      else if (v !== null) odd.count += 1;
    }
    return out;
  }
  odd.count += 1;
  return [];
}

// The status of an account from the texts of its status fields: { status, values }. texts holds one entry for each status
// field of the export, as { field, text } with text null when the row has no single value there.
export function statusOf(status, texts) {
  if (!status.length) return { status: 'active', values: [] };
  let inactive = false;
  let unknown = false;
  const values = [];
  status.forEach((s, i) => {
    const t = texts[i];
    const v = t === null || t === undefined ? null : t.trim().toLowerCase();
    values.push({ field: s.field, value: t === null || t === undefined ? null : t.trim() });
    if (v !== null && s.inactive.has(v)) inactive = true;
    else if (v === null || !s.active.has(v)) unknown = true;
  });
  return { status: inactive ? 'inactive' : unknown ? 'unknown' : 'active', values };
}

function emptyCounts() {
  return { accounts: 0, active: 0, inactive: 0, unknown: 0, oddValues: 0, missing: new Map() };
}

function count(counts, account) {
  counts.accounts += 1;
  counts[account.status] += 1;
}

function readCsvExport(text, file, exp, limits) {
  let csv;
  try {
    csv = parseCsv(text, { delimiter: exp.delimiter, maxRecords: limits.maxAccounts + 1 });
  } catch (error) {
    if (error instanceof CsvError) throw new ExportError([`${file}:${error.line}: ${error.reason}`]);
    throw error;
  }
  if (csv.records.length > limits.maxAccounts) throw new ExportError([`${file}: more than ${limits.maxAccounts.toLocaleString('en-US')} accounts`]);
  const named = [...KINDS.flatMap((k) => exp.fields[k]), ...exp.status.map((s) => s.field)];
  const { index, problems } = columnIndex(csv.header, named, `the export ${exp.name}${exp.preset ? ` (preset ${exp.preset})` : ''}`);
  if (problems.length) throw new ExportError(problems.map((p) => `${file}:1: ${p}`));
  const counts = emptyCounts();
  const accounts = [];
  for (const record of csv.records) {
    const cell = (field) => record.fields[index.get(field)];
    const values = {};
    for (const k of KINDS) values[k] = exp.fields[k].map((field) => ({ field, raw: cell(field).trim() })).filter((v) => v.raw !== '');
    const st = statusOf(exp.status, exp.status.map((s) => cell(s.field)));
    const account = { line: record.line, item: accounts.length + 1, values, status: st.status, statusValues: st.values };
    accounts.push(account);
    count(counts, account);
  }
  return { accounts, counts, rows: csv.records.length };
}

function readJsonExport(text, file, exp, limits) {
  const depth = exp.rows ? exp.rows.split('.').length : 0;
  let parsed;
  try {
    parsed = parseJson(text, { ...limits.json, linesUpTo: depth + 1 });
  } catch (error) {
    if (error instanceof JsonError) throw new ExportError([`${file}: ${jsonProblem(error, text)}`]);
    throw error;
  }
  const rows = exp.rows ? valueAt(parsed.value, exp.rows) : parsed.value;
  if (!Array.isArray(rows)) throw new ExportError([`${file}: ${exp.rows ? `the value at ${safeText(exp.rows, 80)}` : 'the top value'} is not a list of accounts${exp.preset ? ` as the preset ${exp.preset} expects` : ''}`]);
  if (rows.length > limits.maxAccounts) throw new ExportError([`${file}: more than ${limits.maxAccounts.toLocaleString('en-US')} accounts`]);
  const counts = emptyCounts();
  const odd = { count: 0 };
  const accounts = [];
  const fields = [...new Set([...KINDS.flatMap((k) => exp.fields[k]), ...exp.status.map((s) => s.field)])];
  const seen = new Map(fields.map((f) => [f, 0]));
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const line = parsed.lines.get(`${exp.rows}[${i}]`);
    if (!isObject(row)) throw new ExportError([`${file}:${line}: account ${i + 1} is not an object`]);
    for (const f of fields) if (valueAt(row, f) !== undefined) seen.set(f, seen.get(f) + 1);
    const values = {};
    for (const k of KINDS) values[k] = exp.fields[k].flatMap((field) => textsOf(valueAt(row, field), odd).map((raw) => ({ field, raw: raw.trim() }))).filter((v) => v.raw !== '');
    const st = statusOf(exp.status, exp.status.map((s) => {
      const v = valueAt(row, s.field);
      return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
    }));
    const account = { line, item: i + 1, values, status: st.status, statusValues: st.values };
    accounts.push(account);
    count(counts, account);
  }
  counts.oddValues = odd.count;
  if (rows.length) for (const [f, n] of seen) if (n === 0) counts.missing.set(f, rows.length);
  return { accounts, counts, rows: rows.length };
}

// Reads one export. exp is an export of the configuration in normal form. Returns { accounts, counts, rows }; throws
// ExportError with the problems and their lines.
export function readExport(text, file, exp, limits = ACCOUNT_LIMITS) {
  const lim = { ...ACCOUNT_LIMITS, ...limits, json: { ...ACCOUNT_LIMITS.json, ...(limits.json ?? {}) } };
  return exp.format === 'csv' ? readCsvExport(text, file, exp, lim) : readJsonExport(text, file, exp, lim);
}
