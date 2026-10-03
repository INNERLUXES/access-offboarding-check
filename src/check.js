// Puts the parts together: reads the configuration, the leavers file and every account export, matches the accounts to
// the leavers, runs the rules and builds the report. This is the only place that knows every part. An input that cannot
// be read stops the run with an InputError that names every problem; there is then no verdict.

import { ConfigError, readConfig } from './config.js';
import { FILE_LIMITS, readTextFile } from './files.js';
import { LeaversError, LEAVER_LIMITS, readLeavers } from './leavers.js';
import { ACCOUNT_LIMITS, ExportError, readExport } from './accounts.js';
import { buildIndex, matchAccount, outsideAddresses } from './match.js';
import { RULES, decide, dueOf, ruleById } from './rules.js';
import { daysSinceEnd, dateOfDay, dayOfDate } from './days.js';
import { shownValue } from './identity.js';
import { FACTS, LEVELS, factPage } from './data.js';
import { PRESETS } from './presets.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

// maxMatches caps the pairs of a leaver and an account: one name or identifier held by thousands of rows on both sides
// would make the report grow with leavers times accounts, so past the cap the run stops with no verdict.
export const LIMITS = { ...FILE_LIMITS, ...LEAVER_LIMITS, maxAccounts: ACCOUNT_LIMITS.maxAccounts, maxMatches: 200000 };

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

const KIND_WORDS = { email: 'email address', username: 'username', name: 'full name' };
const STRENGTH_ORDER = { exact: 0, possible: 1 };

// The text of a value from the input as a report shows it: cleaned, capped and, for an email address, masked unless
// --show-identifiers was given.
const showOf = (show) => (kind, raw) => safeText(shownValue(kind, raw, show), 120);

// The last day of work as a report says it.
function endText(end, daysSince, asOfGiven) {
  if (end.kind === 'none') return 'no end of work given';
  const rel = daysSince === 0 ? 'on the as-of day' : daysSince > 0 ? `${plural(daysSince, 'day')} before the as-of day` : `${plural(-daysSince, 'day')} after the as-of day`;
  return end.kind === 'date' && asOfGiven ? `last day ${dateOfDay(end.day)}, ${rel}` : `last day ${rel}`;
}

// A short name of an account for the report: its first username, else its first name, else its first email address.
function accountLabel(account, show) {
  for (const kind of ['username', 'name', 'email']) if (account.values[kind].length) return show(kind, account.values[kind][0].raw);
  return `item ${grouped(account.item)}`;
}

// A short name of a leaver: the first name, else the first username, else the first email address.
function leaverLabel(leaver, show) {
  if (leaver.names.length) return show('name', leaver.names[0].raw);
  if (leaver.usernames.length) return show('username', leaver.usernames[0].raw);
  return show('email', leaver.emails[0].raw);
}

// The status of an account in a few words, for a table.
const statusValues = (account) => account.statusValues.map((v) => `${safeText(v.field, 60)} ${v.value === null ? 'empty' : safeText(v.value, 40)}`).join(', ');

function statusShort(account) {
  const values = statusValues(account);
  if (account.status === 'active') return values ? `active (${values})` : 'active (listed)';
  if (account.status === 'inactive') return `inactive (${values})`;
  return `counted as active (${values})`;
}

// The status of an account in a sentence, for the reasons of a finding.
function statusText(account) {
  const values = statusValues(account);
  if (account.status === 'active') return values ? `active (${values})` : 'active (listed; the export has no status field)';
  if (account.status === 'inactive') return `inactive (${values})`;
  return `status not listed in the configuration (${values}); counted as active`;
}

function reasonText(r, show) {
  const steps = [...new Set([...r.leaverSteps, ...r.accountSteps])];
  return `${KIND_WORDS[r.kind]} ${show(r.kind, r.leaverValue)} in the leavers column ${safeText(r.leaverColumn, 60)} and ${show(r.kind, r.accountValue)} in the field ${safeText(r.accountField, 60)}, equal ${steps.length ? `after their normal form (${steps.join('; ')})` : 'as written'}`;
}

const matchedBy = (reasons) => [...new Set(reasons.map((r) => KIND_WORDS[r.kind]))];

// Builds the report. leaversRead is the result of readLeavers; exportsRead is [{ exp, file, read }] in the order of the
// configuration. meta: { version, configFile, leaversFile, asOf (day number or null), showIdentifiers, maxMatches }.
export function buildReport(config, leaversRead, exportsRead, meta = {}) {
  const maxMatches = meta.maxMatches ?? LIMITS.maxMatches;
  let matches = 0;
  const show = showOf(Boolean(meta.showIdentifiers));
  const asOf = meta.asOf ?? null;
  const options = { plusAddressing: config.plusAddressing, domainAliases: config.domainAliases };
  const ruleOf = (id) => config.rules.find((r) => r.id === id) ?? null;
  const stillActive = ruleOf('still-active');
  const graceDays = stillActive ? stillActive.graceDays : 0;
  const leavers = leaversRead.leavers;
  const index = buildIndex(leavers);

  const people = leavers.map((l) => {
    const daysSince = daysSinceEnd(l.end, asOf);
    const due = dueOf(l.end.kind === 'none' ? null : daysSince, graceDays);
    return { leaver: l, label: leaverLabel(l, show), daysSince, due, accounts: [] };
  });

  const findings = [];
  const exportViews = [];
  const notes = [];
  exportsRead.forEach(({ exp, file, read }, order) => {
    const bad = { emails: 0 };
    let noAddress = 0;
    for (const account of read.accounts) {
      const at = `${file}:${account.line}`;
      const live = account.status !== 'inactive';
      for (const m of matchAccount(index, account, options, bad)) {
        matches += 1;
        if (matches > maxMatches) throw new InputError([`more than ${grouped(maxMatches)} pairs of a leaver and an account match; an identifier or a name is held by very many rows on both sides (the last one in ${at}), so the report would be too large to read`]);
        const p = people[m.leaver];
        const view = { export: exp.name, order, at, item: account.item, line: account.line, account: accountLabel(account, show), status: account.status, statusText: statusText(account), statusShort: statusShort(account), strength: m.strength, matchedBy: matchedBy(m.reasons), reasons: m.reasons.map((r) => reasonText(r, show)), finding: null };
        const rule = m.strength === 'exact' ? stillActive : ruleOf('possible-match');
        if (live && p.due.due && rule) {
          view.finding = rule.id;
          const found = m.strength === 'exact'
            ? `${p.label}: the account ${view.account} in ${exp.name} is ${account.status === 'active' ? 'active' : 'not marked inactive'}; matched by ${view.matchedBy.join(' and ')}`
            : `${p.label}: the account ${view.account} in ${exp.name} has the same full name and is ${account.status === 'active' ? 'active' : 'not marked inactive'}; a possible match, to check by hand`;
          findings.push({ rule: rule.id, level: rule.level, export: exp.name, order, leaver: p.label, leaverLine: m.leaver, at, line: account.line, item: account.item, found, why: [view.statusText, p.due.text, ...view.reasons] });
        }
        p.accounts.push(view);
      }
      if (exp.companyAccountsOnly && live) {
        const o = outsideAddresses(account, config.companyDomains, options);
        if (!o.checked) noAddress += 1;
        const rule = ruleOf('personal-address');
        if (o.outside.length && rule) {
          const label = accountLabel(account, show);
          findings.push({ rule: rule.id, level: rule.level, export: exp.name, order, leaver: null, leaverLine: Infinity, at, line: account.line, item: account.item, found: `the account ${label} in ${exp.name} has ${listText(o.outside.map((x) => show('email', x.value)), 3)} outside the company domains`, why: [statusText(account), ...o.outside.map((x) => `the field ${safeText(x.field, 60)} holds ${show('email', x.value)}, on the domain ${safeText(x.domain, 80)}, which is not ${config.companyDomains.join(', ')}`)] });
        }
      }
    }
    const c = read.counts;
    exportViews.push({ name: exp.name, file, format: exp.format, preset: exp.preset, companyAccountsOnly: exp.companyAccountsOnly, accounts: c.accounts, active: c.active, inactive: c.inactive, unknown: c.unknown });
    if (c.unknown) notes.push(`${exp.name}: ${plural(c.unknown, 'account')} ${c.unknown === 1 ? 'has' : 'have'} a status the configuration does not list, and ${c.unknown === 1 ? 'is' : 'are'} counted as active`);
    if (bad.emails) notes.push(`${exp.name}: ${plural(bad.emails, 'value')} in an email field ${bad.emails === 1 ? 'is' : 'are'} not an email address and ${bad.emails === 1 ? 'was' : 'were'} not compared`);
    if (c.oddValues) notes.push(`${exp.name}: ${plural(c.oddValues, 'value')} in an identifier field ${c.oddValues === 1 ? 'is' : 'are'} an object or a list inside a list and ${c.oddValues === 1 ? 'was' : 'were'} not read`);
    for (const [field, rows] of c.missing) notes.push(`${exp.name}: the field ${safeText(field, 60)} is in none of the ${plural(rows, 'account')}; check the fields of the configuration`);
    if (exp.companyAccountsOnly && noAddress && ruleOf('personal-address')) notes.push(`${exp.name}: ${plural(noAddress, 'active account')} ${noAddress === 1 ? 'has' : 'have'} no email address, so personal-address cannot check ${noAddress === 1 ? 'it' : 'them'}`);
  });

  const levelRank = (l) => LEVELS.length - LEVELS.indexOf(l);
  const ruleRank = (id) => RULES.findIndex((r) => r.id === id);
  findings.sort((a, b) => levelRank(a.level) - levelRank(b.level) || ruleRank(a.rule) - ruleRank(b.rule) || a.leaverLine - b.leaverLine || a.order - b.order || a.line - b.line);
  for (const p of people) p.accounts.sort((a, b) => a.order - b.order || STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || a.line - b.line);

  const noEnd = leavers.filter((l) => l.end.kind === 'none').length;
  if (noEnd) notes.push(`${plural(noEnd, 'leaver')} ${noEnd === 1 ? 'has' : 'have'} no end of work and ${noEnd === 1 ? 'is' : 'are'} taken as left`);
  for (const s of index.shared) notes.push(`the ${KIND_WORDS[s.kind]} ${show(s.kind, s.key)} is held by ${plural(s.leavers.length, 'leaver')} (lines ${s.leavers.map((i) => leavers[i].line).join(', ')}); an account with it is listed under each`);

  const leaverViews = people.map((p) => ({
    label: p.label,
    line: p.leaver.line,
    identifiers: { email: p.leaver.emails.map((e) => show('email', e.raw)), username: p.leaver.usernames.map((u) => show('username', u.raw)), name: p.leaver.names.map((n) => show('name', n.raw)) },
    end: endText(p.leaver.end, p.daysSince, asOf !== null),
    daysSinceEnd: p.leaver.end.kind === 'none' ? null : p.daysSince,
    due: p.due.due,
    dueText: p.due.text,
    accounts: p.accounts.map(({ order, ...a }) => a)
  }));

  const all = people.flatMap((p) => p.accounts);
  const totals = {
    leavers: leavers.length,
    due: people.filter((p) => p.due.due).length,
    exports: exportsRead.length,
    accounts: exportsRead.reduce((n, e) => n + e.read.counts.accounts, 0),
    matched: all.length,
    exactLive: all.filter((a) => a.strength === 'exact' && a.status !== 'inactive').length,
    exactInactive: all.filter((a) => a.strength === 'exact' && a.status === 'inactive').length,
    possible: all.filter((a) => a.strength === 'possible').length
  };

  const verdict = decide(findings, config.failOn);
  return {
    tool: 'access-offboarding-check',
    version: meta.version ?? '',
    config: {
      file: meta.configFile ?? 'config',
      name: config.name,
      failOn: config.failOn,
      companyDomains: config.companyDomains,
      plusAddressing: config.plusAddressing,
      domainAliases: config.domainAliases.size,
      rules: config.rules.map((r) => ({ id: r.id, level: r.level, ...(r.graceDays !== undefined ? { graceDays: r.graceDays } : {}), rule: ruleById(r.id).rule(r, config) }))
    },
    inputs: {
      leavers: { file: meta.leaversFile ?? 'leavers', rows: leaversRead.rows, endColumn: config.leavers.end, ends: leaversRead.endKinds },
      asOf: asOf === null ? null : dateOfDay(asOf),
      exports: exportViews
    },
    totals,
    showIdentifiers: Boolean(meta.showIdentifiers),
    findings: findings.map(({ order, leaverLine, ...f }) => ({ ...f, basis: ruleById(f.rule).facts.map((k) => ({ ...FACTS[k], page: factPage(k) })) })),
    leavers: leaverViews,
    verdict,
    notes
  };
}

// Reads the paths and gives the report. o: { config, leavers, exports: [{ name, path }], asOf, showIdentifiers, failOn,
// base, limits, version }.
export async function checkPaths(o) {
  const base = o.base ?? process.cwd();
  const limits = { ...LIMITS, ...(o.limits ?? {}) };
  const problems = [];
  let config = null;
  let configFile = o.config;
  try {
    const read = await readTextFile(o.config, base, limits.maxConfigBytes);
    configFile = read.file;
    config = readConfig(read.text, read.file);
  } catch (error) {
    if (error instanceof ConfigError) problems.push(...error.problems.map((p) => p.text));
    else problems.push(error.message);
  }
  let total = 0;
  const budget = (read) => {
    total += read.size;
    if (total > limits.maxTotalBytes) throw new Error(`${read.file}: the inputs hold more than ${grouped(limits.maxTotalBytes)} bytes together`);
  };
  let leaversRead = null;
  let leaversFile = o.leavers;
  try {
    const read = await readTextFile(o.leavers, base, limits.maxLeaversBytes);
    budget(read);
    leaversFile = read.file;
    if (config) leaversRead = readLeavers(read.text, read.file, config.leavers, { plusAddressing: config.plusAddressing, domainAliases: config.domainAliases }, limits);
  } catch (error) {
    if (error instanceof LeaversError) problems.push(...error.problems);
    else problems.push(error.message);
  }
  const exportsRead = [];
  if (config) {
    const given = new Map(o.exports.map((e) => [e.name, e.path]));
    for (const e of o.exports) if (!config.exports.some((x) => x.name === e.name)) problems.push(`--export ${safeText(e.name, 60)}: the configuration declares no export with this name (it declares ${config.exports.map((x) => x.name).join(', ')})`);
    for (const exp of config.exports) {
      if (!given.has(exp.name)) {
        problems.push(`the configuration declares the export ${exp.name}; give its file with --export ${exp.name}=<file>`);
        continue;
      }
      try {
        const read = await readTextFile(given.get(exp.name), base, limits.maxExportBytes);
        budget(read);
        exportsRead.push({ exp, file: read.file, read: readExport(read.text, read.file, exp, { maxAccounts: limits.maxAccounts }) });
      } catch (error) {
        if (error instanceof ExportError) problems.push(...error.problems);
        else problems.push(error.message);
      }
    }
  }
  let asOf = null;
  if (o.asOf) asOf = dayOfDate(o.asOf);
  if (leaversRead && leaversRead.endKinds.date && asOf === null) {
    const first = leaversRead.leavers.find((l) => l.end.kind === 'date');
    problems.push(`${leaversFile}:${first.line}: the column ${config.leavers.end} holds a date; give the day to compare the dates with, --as-of YYYY-MM-DD (the tool reads no clock)`);
  }
  if (problems.length) throw new InputError(problems.map((p) => safeText(p, 1500)));
  if (o.failOn) config.failOn = o.failOn;
  return buildReport(config, leaversRead, exportsRead, { version: o.version, configFile, leaversFile, asOf, showIdentifiers: o.showIdentifiers, maxMatches: limits.maxMatches });
}

// The presets as the usage lists them.
export const presetList = () => Object.entries(PRESETS).map(([name, p]) => `${name} (${p.format}): ${p.title}`);
