// The configuration file: the company domains, how email addresses are compared, the columns of the leavers file, the
// account exports with their fields and statuses, the rules and the fail level. Every number a rule compares comes from
// this file: the tool has no threshold of its own, and a file must state at least one rule and one export. The defaults
// that exist are listed in DEFAULTS and in docs/inputs.md, each with its reason, and none of them is a threshold. Every
// key the tool does not know is an error, so a typo such as graceDay cannot silently change a rule. The file is read with
// the strict JSON reader of src/json.js, which refuses an object that names a key twice.

import { JsonError, jsonProblem, parseJson } from './json.js';
import { EXPORT_FORMATS, IDENTIFIER_KINDS, LEVELS } from './data.js';
import { PRESETS, PRESET_NAMES } from './presets.js';
import { isDelimiter } from './csv.js';
import { safeText } from './text.js';

export const CONFIG_LIMITS = { maxExports: 50, maxDomains: 100, maxAliases: 100, maxFields: 20, maxStatusValues: 50, maxString: 200, maxGraceDays: 3650 };

// The defaults, none of them a threshold: the level of a finding, the fail level, the delimiter of a CSV file, and
// whether an export is held to company addresses.
export const DEFAULTS = { level: 'warning', failOn: 'warning', delimiter: ',', companyAccountsOnly: false, plusAddressing: false };

// The keys of the configuration file, as a tree: what each level may hold.
export const KEYS = {
  name: 'string',
  company: { domains: 'domains' },
  email: { plusAddressing: 'boolean', domainAliases: 'domainAliases' },
  leavers: {
    columns: { email: 'columns', username: 'columns', name: 'columns', end: 'string' },
    delimiter: 'delimiter'
  },
  exports: 'exports',
  rules: {
    stillActive: { graceDays: 'graceDays', level: 'level' },
    possibleMatch: { level: 'level' },
    personalAddress: { level: 'level' }
  },
  failOn: 'level'
};

// The keys of one export in the exports list.
export const EXPORT_KEYS = {
  name: 'exportName',
  preset: 'preset',
  format: 'format',
  rows: 'path',
  delimiter: 'delimiter',
  fields: { email: 'columns', username: 'columns', name: 'columns' },
  status: 'status',
  companyAccountsOnly: 'boolean'
};

// The keys of one status field in the status list of an export.
export const STATUS_KEYS = { field: 'string', active: 'values', inactive: 'values' };

// The rule ids as the reports show them, by their key in the configuration.
export const RULE_IDS = { stillActive: 'still-active', possibleMatch: 'possible-match', personalAddress: 'personal-address' };

export class ConfigError extends Error {
  constructor(problems) {
    super(problems.map((p) => p.text).join('\n'));
    this.problems = problems;
  }
}

// The edit distance of two short words, for the "did you mean" of an unknown key.
function distance(a, b) {
  if (a.length > 40 || b.length > 40) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? 'a string' : typeof v === 'number' ? 'a number' : 'a boolean');
const CONTROL = /[\u0000-\u001f\u007f]/;
const DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const EXPORT_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Checks the value of the configuration against KEYS and builds the normal form.
export function validateConfig(value, lines = new Map(), file = 'config') {
  const problems = [];
  const lim = CONFIG_LIMITS;
  const at = (path) => (path === '' ? file : `${file}${lines.has(path) ? `:${lines.get(path)}` : ''}: ${path}`);
  const bad = (path, message) => {
    problems.push({ path, text: `${at(path)}: ${message}` });
  };
  const has = (prefix) => problems.some((p) => p.path === prefix || p.path.startsWith(`${prefix}.`) || p.path.startsWith(`${prefix}[`));

  const text = (v, path) => {
    if (typeof v !== 'string' || v.trim() === '') return bad(path, `must be a string that is not empty, not ${kindOf(v)}`);
    if (v.length > lim.maxString || CONTROL.test(v)) return bad(path, `must be at most ${lim.maxString} characters with no control character`);
    return v;
  };
  const list = (v, path, max, each, { allowEmpty = false } = {}) => {
    if (!Array.isArray(v)) return bad(path, `must be a list, not ${kindOf(v)}`);
    if (v.length === 0 && !allowEmpty) return bad(path, 'is an empty list; leave the key out instead');
    if (v.length > max) return bad(path, `holds more than ${max} entries`);
    const out = [];
    let ok = true;
    v.forEach((item, i) => {
      const r = each(item, `${path}[${i}]`, out);
      if (r === undefined) ok = false;
      else out.push(r);
    });
    return ok ? out : undefined;
  };
  const strings = (v, path, max, fold) => list(v, path, max, (s, p, out) => {
    const t = text(s, p);
    if (t === undefined) return undefined;
    const k = fold ? t.trim().toLowerCase() : t;
    if (out.some((o) => (fold ? o.trim().toLowerCase() : o) === k)) return bad(p, `${safeText(t, 60)} is named twice`);
    return t;
  });
  const domain = (v, path) => {
    const t = text(v, path);
    if (t === undefined) return undefined;
    const d = t.trim().toLowerCase();
    if (d.length > 253 || !DOMAIN.test(d)) return bad(path, `${safeText(t, 60)} is not a domain name such as example.com`);
    return d;
  };

  const check = (kind, v, p) => {
    if (kind === 'string' || kind === 'exportName' || kind === 'preset' || kind === 'format' || kind === 'path') return text(v, p);
    if (kind === 'boolean') return typeof v === 'boolean' ? v : bad(p, `must be true or false, not ${kindOf(v)}`);
    if (kind === 'level') return typeof v === 'string' && LEVELS.includes(v) ? v : bad(p, `must be one of ${LEVELS.join(', ')}`);
    if (kind === 'graceDays') {
      if (typeof v !== 'number') return bad(p, `must be a whole number of days, not ${kindOf(v)}`);
      if (!Number.isSafeInteger(v) || v < 0 || v > lim.maxGraceDays) return bad(p, `${safeText(String(v), 30)} is not a whole number of days from 0 to ${lim.maxGraceDays}`);
      return v;
    }
    if (kind === 'delimiter') return typeof v === 'string' && isDelimiter(v) ? v : bad(p, 'must be a comma, a semicolon or a tab ("\\t")');
    if (kind === 'columns') return strings(v, p, lim.maxFields, false);
    if (kind === 'values') return strings(v, p, lim.maxStatusValues, true);
    if (kind === 'domains') {
      return list(v, p, lim.maxDomains, (d, q, out) => {
        const r = domain(d, q);
        if (r !== undefined && out.includes(r)) return bad(q, `${r} is named twice`);
        return r;
      });
    }
    if (kind === 'domainAliases') {
      if (!isObject(v)) return bad(p, `must be an object that maps an alias domain to a company domain, not ${kindOf(v)}`);
      const names = Object.keys(v);
      if (names.length === 0) return bad(p, 'is an empty object; leave the key out instead');
      if (names.length > lim.maxAliases) return bad(p, `holds more than ${lim.maxAliases} aliases`);
      const map = new Map();
      let ok = true;
      for (const name of names) {
        const from = domain(name, `${p}.${name}`);
        const to = domain(v[name], `${p}.${name}`);
        if (from === undefined || to === undefined) {
          ok = false;
          continue;
        }
        if (from === to) {
          bad(`${p}.${name}`, 'maps a domain to itself');
          ok = false;
        } else if (map.has(from)) {
          bad(`${p}.${name}`, `${from} is named twice (domains are compared without case)`);
          ok = false;
        } else map.set(from, to);
      }
      for (const [from, to] of map) {
        if (map.has(to)) {
          bad(`${p}.${from}`, `maps to ${to}, which is itself an alias; map every alias to the company domain`);
          ok = false;
        }
      }
      return ok ? map : undefined;
    }
    if (kind === 'exports') return list(v, p, lim.maxExports, exportEntry);
    return bad(p, 'cannot be read');
  };

  // Walks a level of the configuration against its allowed keys; returns the checked values by key.
  const walk = (obj, spec, path) => {
    if (!isObject(obj)) {
      bad(path, `must be an object, not ${kindOf(obj)}`);
      return null;
    }
    const out = {};
    for (const key of Object.keys(obj)) {
      const p = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(spec, key)) {
        const near = Object.keys(spec).map((k) => [k, distance(k.toLowerCase(), key.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
        bad(p, `unknown key${near && near[1] <= 3 ? `; did you mean ${near[0]}?` : `; the keys here are ${Object.keys(spec).join(', ')}`}`);
        continue;
      }
      const kind = spec[key];
      out[key] = typeof kind === 'object' ? walk(obj[key], kind, p) : check(kind, obj[key], p);
    }
    return out;
  };

  // One status field of an export.
  const statusEntry = (v, p) => {
    const s = walk(v, STATUS_KEYS, p);
    if (!s) return undefined;
    let ok = !has(p);
    for (const k of ['field', 'active', 'inactive']) {
      if (s[k] === undefined && !has(`${p}.${k}`)) {
        bad(`${p}.${k}`, k === 'field' ? 'is needed: the column or field that holds the status' : `is needed: the values of the field that mean ${k === 'active' ? 'the account can be used' : 'the account cannot be used'}`);
        ok = false;
      }
    }
    if (!ok) return undefined;
    const active = new Set(s.active.map((x) => x.trim().toLowerCase()));
    const inactive = new Set(s.inactive.map((x) => x.trim().toLowerCase()));
    for (const x of active) {
      if (inactive.has(x)) {
        bad(`${p}.inactive`, `${safeText(x, 60)} is also in active`);
        return undefined;
      }
    }
    return { field: s.field, active, inactive, activeShown: s.active, inactiveShown: s.inactive };
  };

  // One export of the exports list.
  const exportNames = new Set();
  const exportEntry = (v, p) => {
    if (!isObject(v)) return bad(p, `must be an object with name and either preset or format and fields, not ${kindOf(v)}`);
    const known = Object.fromEntries(Object.entries(EXPORT_KEYS).filter(([k]) => k !== 'status'));
    const e = walk(Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'status')), known, p);
    let status;
    if (Object.hasOwn(v, 'status')) status = list(v.status, `${p}.status`, lim.maxFields, statusEntry, { allowEmpty: true });
    if (has(p)) return undefined;
    const name = e.name;
    if (name === undefined) return bad(`${p}.name`, 'is needed: the name of the tool, used with --export <name>=<file>');
    if (!EXPORT_NAME.test(name)) return bad(`${p}.name`, `${safeText(name, 60)} must be lower case letters, digits, - and _, starting with a letter or a digit, at most 40 characters`);
    if (exportNames.has(name)) return bad(`${p}.name`, `${name} is the name of another export`);
    exportNames.add(name);
    let shape;
    if (e.preset !== undefined) {
      for (const k of ['format', 'rows', 'fields', 'delimiter']) if (e[k] !== undefined) return bad(`${p}.${k}`, `give a preset or ${k}, not both; a preset sets the format, the rows, the fields and the status`);
      if (status !== undefined) return bad(`${p}.status`, 'give a preset or status, not both; a preset sets the format, the rows, the fields and the status');
      if (!Object.hasOwn(PRESETS, e.preset)) {
        const near = PRESET_NAMES.map((k) => [k, distance(k, e.preset)]).sort((a, b) => a[1] - b[1])[0];
        return bad(`${p}.preset`, `unknown preset${near[1] <= 4 ? `; did you mean ${near[0]}?` : ''}; the presets are ${PRESET_NAMES.join(', ')}`);
      }
      const pre = PRESETS[e.preset];
      shape = {
        preset: e.preset,
        format: pre.format,
        rows: pre.rows,
        delimiter: DEFAULTS.delimiter,
        fields: { email: [...pre.fields.email], username: [...pre.fields.username], name: [...pre.fields.name] },
        status: pre.status.map((s) => ({ field: s.field, active: new Set(s.active.map((x) => x.toLowerCase())), inactive: new Set(s.inactive.map((x) => x.toLowerCase())), activeShown: s.active, inactiveShown: s.inactive }))
      };
    } else {
      if (e.format === undefined) return bad(`${p}.format`, `is needed: ${EXPORT_FORMATS.join(' or ')}, or give a preset (${PRESET_NAMES.join(', ')})`);
      if (!EXPORT_FORMATS.includes(e.format)) return bad(`${p}.format`, `must be ${EXPORT_FORMATS.join(' or ')}`);
      if (e.fields === undefined) return bad(`${p}.fields`, 'is needed: the columns or fields that hold the email, the username and the name');
      const fields = { email: e.fields.email ?? [], username: e.fields.username ?? [], name: e.fields.name ?? [] };
      if (!IDENTIFIER_KINDS.some((k) => fields[k].length)) return bad(`${p}.fields`, 'names no column; give email, username or name');
      if (e.format === 'csv' && e.rows !== undefined) return bad(`${p}.rows`, 'is for a JSON export only');
      if (e.format === 'json' && e.delimiter !== undefined) return bad(`${p}.delimiter`, 'is for a CSV export only');
      shape = { preset: null, format: e.format, rows: e.rows ?? '', delimiter: e.delimiter ?? DEFAULTS.delimiter, fields, status: status ?? [] };
    }
    if (shape.format === 'json') {
      for (const f of [...IDENTIFIER_KINDS.flatMap((k) => shape.fields[k]), ...shape.status.map((s) => s.field), ...(shape.rows ? [shape.rows] : [])]) {
        if (f.split('.').some((part) => part === '')) return bad(`${p}`, `the path ${safeText(f, 60)} has an empty part; a JSON path is names joined by dots`);
      }
    }
    return { name, ...shape, companyAccountsOnly: e.companyAccountsOnly ?? DEFAULTS.companyAccountsOnly };
  };

  if (!isObject(value)) {
    bad('', `the configuration must be one JSON object, not ${kindOf(value)}`);
    throw new ConfigError(problems);
  }
  const top = walk(value, KEYS, '');
  const columns = top.leavers?.columns;
  if (top.leavers === undefined && !has('leavers')) bad('leavers', 'is needed, with columns: the columns of the leavers file that hold the email, the username, the name and the end of work');
  else if (top.leavers && columns === undefined && !has('leavers')) bad('leavers.columns', 'is needed: the columns of the leavers file');
  else if (columns && !has('leavers') && !IDENTIFIER_KINDS.some((k) => columns[k]?.length)) bad('leavers.columns', 'names no identifier column; give email, username or name');
  if (top.exports === undefined && !has('exports')) bad('exports', 'is needed: at least one account export');
  if (top.rules === undefined && !has('rules')) bad('rules', 'is needed: at least one rule; a check with no rule would always pass');
  const rules = top.rules;
  if (rules && !has('rules')) {
    const named = Object.keys(rules).filter((k) => rules[k]);
    if (named.length === 0) bad('rules', 'states no rule; a check with no rule would always pass');
    if (rules.stillActive && rules.stillActive.graceDays === undefined) bad('rules.stillActive.graceDays', 'is needed: the whole days after the last day of work before an active account is a finding; 0 for none');
  }
  const domains = top.company?.domains;
  if (top.company && domains === undefined && !has('company')) bad('company.domains', 'is needed: the domains of the company addresses');
  const companyOnly = (top.exports ?? []).filter((e) => e && e.companyAccountsOnly);
  if (!has('exports') && !has('company') && companyOnly.length && !domains) bad('company', `is needed: ${companyOnly.map((e) => e.name).join(', ')} ${companyOnly.length === 1 ? 'holds' : 'hold'} company accounts only, and the company domains say which addresses are the company's`);
  if (rules?.personalAddress && !has('exports') && top.exports && companyOnly.length === 0) bad('rules.personalAddress', 'needs an export with companyAccountsOnly: true; no export is held to company addresses');
  if (top.email?.domainAliases && domains) {
    for (const [from] of top.email.domainAliases) if (domains.includes(from)) bad(`email.domainAliases.${from}`, `${from} is a company domain; an alias is another domain that is read as a company domain`);
  }
  if (problems.length) throw new ConfigError(problems);

  const rule = (key) => (rules[key] ? { id: RULE_IDS[key], key, level: rules[key].level ?? DEFAULTS.level, ...(key === 'stillActive' ? { graceDays: rules[key].graceDays } : {}) } : null);
  return {
    name: typeof top.name === 'string' ? safeText(top.name, 120) : '',
    companyDomains: domains ?? [],
    plusAddressing: top.email?.plusAddressing ?? DEFAULTS.plusAddressing,
    domainAliases: top.email?.domainAliases ?? new Map(),
    leavers: {
      email: columns.email ?? [],
      username: columns.username ?? [],
      name: columns.name ?? [],
      end: columns.end ?? null,
      delimiter: top.leavers.delimiter ?? DEFAULTS.delimiter
    },
    exports: top.exports,
    rules: ['stillActive', 'possibleMatch', 'personalAddress'].map(rule).filter(Boolean),
    failOn: top.failOn ?? DEFAULTS.failOn
  };
}

// Reads the text of a configuration file into the normal form. file is the path shown. Throws ConfigError with every
// problem.
export function readConfig(text, file = 'config') {
  let parsed;
  try {
    parsed = parseJson(text);
  } catch (error) {
    if (error instanceof JsonError) throw new ConfigError([{ path: '', text: `${file}: ${jsonProblem(error, text)}` }]);
    throw error;
  }
  return validateConfig(parsed.value, parsed.lines, file);
}
